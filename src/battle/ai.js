const SOLO_OPPONENT_AIS = [
  {
    id: "little-roco-v0-preview",
    name: "Little Roco V0-Preview",
    chooseSkill(user, target) { return chooseSoloSkill(user, target); }
  }
];

function getSoloOpponentAI(id) {
  return SOLO_OPPONENT_AIS.find(ai => ai.id === id) || SOLO_OPPONENT_AIS[0];
}

function chooseOpponentSkill(user, target) {
  if (gameState.battleMode !== "solo") return chooseTestSkill(user, target);
  return getSoloOpponentAI(gameState.opponentAIId).chooseSkill(user, target);
}

// 对手只根据选招前已有的战场状态估分，不执行技能或抽取随机数。
function chooseSoloSkill(user, target) {
  const available = user.skills.filter(canSelectSkill);
  if (available.length < 2) return available[0] || null;

  const turn = gameState.turnCount + 1;
  const previous = target.skills.find(skill => skill.id === target.lastUsedSkillId);
  const targetPriority = predictSkillPriority(target, previous, turn);
  const speedDifference = user.getStat("spd") - target.getStat("spd");
  const maxHp = user.maxHp + (user.maxHpBonus || 0);
  const inverted = user.qinglingInvertThrough >= turn || user.qinglingInvertNext ||
    (user.healInvertTurns > 0 && user.healInvertPct > 0.5);
  const context = { user, target, turn, maxHp, missingHp: Math.max(0, maxHp - user.hp),
    inverted, targetPriority, speedDifference };
  let best = available[0], bestScore = -Infinity;
  for (const skill of available) {
    const score = scoreSoloSkill(skill, context);
    if (score > bestScore) {
      best = skill;
      bestScore = score;
    }
  }
  return best;
}

function predictSkillPriority(pet, skill, turn) {
  if (!skill) return 8;
  const element = getEffectiveSkillElement(pet, skill.element, turn);
  let priority = skill.dimoFastThrough >= turn ? 12 : pet.priorityOverride ?? skill.priority ?? 8;
  if (gameState.weather === "mist" && element === "ghost") priority++;
  if (gameState.field === "dream" && skill.id === "sk_qy_1") priority = 1;
  return priority - (skill.qingnianPriorityLoss || 0);
}

function soloStatusCanHelp(pet, status) {
  if (!status || hasStatusImmunity(pet, status) || pet.status === status) return false;
  if (status === "poison") return !pet.poisoned;
  if (status === "leech_seed") return !pet.leechSeed;
  if (status === "confuse") return !pet.confuseTurns;
  if (status === "bind") return !pet.bindTurns;
  return true;
}

function scoreSoloSkill(skill, context) {
  const { user, target, turn, maxHp, missingHp, inverted, targetPriority, speedDifference } = context;
  const paid = Math.min(skill.pp, getRequiredPPCost(user, skill, undefined, turn));
  const element = getEffectiveSkillElement(user, skill.element, turn);
  const priority = predictSkillPriority(user, skill, turn) - targetPriority;
  const order = priority || speedDifference;
  const first = gameState.field === "dream" ? order < 0 : order > 0;
  const plan = soloSkillBenefits(skill, context, paid, first);
  const canAffectTarget = target.externalEffectImmuneTurn !== turn &&
    (first || !target.reflectBackhand || gameState.banEffects?.reflect);
  const accuracy = skill.semiSure || (skill.sureFirst && first)
    ? Number(!target.sureDodge || (skill.sureFirst && first))
    : Math.max(0, Math.min(1, (skill.accuracy ?? 100) / 100));
  // 只作估算，前置效果、多段和随机伤害仍由回合结算处理。
  const physical = skill.category !== "special";
  const offense = user.getStat(physical ? "atk" : "spatk");
  const defense = target.getStat(physical ? "def" : "spdef");
  const matchup = getEffectiveness(element, target.element);
  const power = getSkillPower(skill, plan.power);
  const damage = power > 0 && !(target.powerDamageImmuneThroughTurn >= turn)
    ? Math.max(1, ((2 * user.level / 5 + 2) * power * offense / Math.max(1, defense) / 50 + 2) *
      0.925 * (element && element === user.element ? 1.5 : 1) * matchup * getWeatherDamageMod(element, target.element) *
      getOutputMultiplier(user) * (physical && user.status === "burn" ? 0.5 : 1))
    : 0;
  const guard = target.getDamageReduction() / 100;
  const gross = canAffectTarget ? (damage + plan.fixed) * (1 - guard) : 0;
  const shield = gameState.banEffects?.shield ? 0 : target.shield;
  const targetData = target.bloodlineData;
  const hasJianghuaCap = !gameState.banEffects?.damageCap && targetData?.jianghuaThrough >= turn;
  const injury = Math.min(Math.max(0, gross - shield), hasJianghuaCap ? targetData.jianghuaCap : Infinity);
  const canFinish = injury >= target.hp && skill.id !== "sk_nlex" &&
    !(target.bloodline?.name === "不灭魂体") &&
    !(target.dodgeLethalLeft > 0 && target.dimoLethalDodgeThrough >= turn) &&
    (!target.hasDamageCap() || hasJianghuaCap);
  const disruption = canAffectTarget && soloStatusCanHelp(target, plan.status)
    ? plan.statusValue * (first ? 1 : 0.75)
    : 0;
  const recovery = inverted ? -Math.min(user.hp, plan.heal) : Math.min(missingHp, plan.heal);
  const healWeight = 0.9 + missingHp / maxHp;
  const ppCost = (paid - 1) * 10 + (paid === skill.pp ? 7 : 0);
  const repeatedSupport = skill.category === "status" && skill.id === user.lastUsedSkillId ? 24 : 0;
  return accuracy * (Math.min(injury, target.hp) + 0.28 * Math.min(gross, shield) +
    (canFinish ? 65 + (first ? 40 : 0) : 0) + disruption + recovery * healWeight + plan.utility)
    - ppCost - repeatedSupport;
}

function soloSkillBenefits(skill, context, paid, first) {
  const { user, target, turn, maxHp, missingHp, speedDifference } = context;
  const data = user.bloodlineData || {};
  const plan = {
    power: skill.category === "status" ? 0 : skill.power || 0,
    fixed: 0, heal: 0, utility: 0,
    status: skill.effect, statusValue: 65 * (skill.effectChance || 0) / 100,
  };
  const marks = data.marks || 0;
  let ppRoom = 0;
  if (user.blockPPRecoveryOnTurn !== turn) {
    for (const move of user.skills) {
      if (move === skill || move.noPPRecover || move.noPPRecoverThrough >= turn) continue;
      if (move.ppRecoverySource && ![move.ppRecoverySource].flat().includes(skill.id)) continue;
      ppRoom += move.maxPp - move.pp;
    }
  }
  switch (skill.id) {
    case "sk_jydm_1":
      plan.heal = maxHp * Math.pow(0.85, data.jianghuaCasts || 0);
      plan.utility = Math.min(80, ppRoom * 8) + (data.jianghuaThrough >= turn ? 8 : 48);
      break;
    case "sk_jydm_2":
      plan.utility = data.markTarget === target ? 30 : 12;
      break;
    case "sk_jydm_3":
      plan.heal = maxHp * (marks >= 2 ? 0.9 : 0.6);
      plan.utility = gameState.banEffects?.shield || user.dimoScreenShieldThrough >= turn ? 10 : 35;
      if (user.dimoLethalDodgeThrough < turn || !user.dodgeLethalLeft) plan.utility += 16;
      break;
    case "sk_jydm_4":
      plan.power = Math.floor(100 + marks * 20 + 0.05 * user.getStat("spd"));
      plan.fixed = first && gameState.field !== "dream" ? 2 * plan.power : 0;
      plan.status = "freeze";
      plan.statusValue = marks >= 4 ? 125 : 65;
      break;
    case "sk_jydm_5":
      plan.power = Math.floor(120 + 0.1 * user.getStat("spatk"));
      if (!hasStatusImmunity(target, "burn")) plan.fixed = 225;
      else plan.utility = -Math.max(0, skill.pp - paid) * 12;
      break;
    case "sk_cszn":
      plan.heal = maxHp;
      plan.utility = data.creationActive ? 14 : 46;
      break;
    case "sk_nlex":
      plan.utility = user.hp < maxHp / 2 ? 36 : -20;
      break;
    case "sk_mszw":
      plan.power = data.creationActive ? 170 : skill.power;
      plan.heal = data.creationActive ? 200 : 0;
      plan.fixed = first ? target.maxHp * 0.3 : 0;
      if (user.pendingNilex?.cnt === 1) plan.fixed += 9999;
      plan.status = first ? "fear" : null;
      plan.statusValue = 48;
      break;
    case "sk_fthy":
      plan.heal = user.skills.some(move => move.id === "sk_cszn" && move.pp === 0) ? 400 : 0;
      plan.utility = (user.futiThrough >= turn ? 8 : 34) + (user.poisoned || user.status === "burn" ? 25 : 0);
      break;
    case "sk_cyjy":
      plan.utility = first && user.skills.every(move => move === skill || move.pp > 0) ? 24 : -1000;
      break;
    case "sk_qy_1":
      plan.heal = data.mode === "清念" && data.qfzn >= 3 ? maxHp : 0;
      plan.utility = user.shield > maxHp / 2 ? 16 : 40;
      break;
    case "sk_qy_2":
      plan.utility = 42 + (data.mode === "清念" && data.qfzn > 0 && target.element !== "flying" ? 28 : 0);
      break;
    case "sk_qy_3":
      plan.fixed = user.lastDamageSegment || 0;
      plan.status = first ? null : "deep_sleep";
      plan.statusValue = 110;
      plan.utility = first ? 22 : 4;
      break;
    case "sk_qy_4":
      plan.status = "freeze";
      plan.statusValue = 90;
      plan.utility = gameState.banEffects?.shield || user.shield > maxHp / 2 ? 6
        : 28 + Math.min(45, Math.abs(speedDifference) * 0.2);
      break;
    case "sk_qy_5":
      plan.utility = Math.min(110, ppRoom * 11) + 12;
      break;
    case "sk_ql_1":
      plan.heal = maxHp;
      plan.utility = Math.min(96, ppRoom * 10) + (user.powerDamageImmuneThroughTurn >= turn ? 12 : 44);
      break;
    case "sk_ql_2": {
      const missingPP = skill.maxPp - (skill.pp - paid);
      const emptyFirst = user.skills[0] === skill ? skill.pp === paid : user.skills[0]?.pp === 0;
      plan.power = Math.min(emptyFirst ? 1000 : 500, missingPP * (150 + (data.microLing || 0)));
      plan.heal = 150;
      if (!first) plan.utility = -Math.min(plan.power * 1.1, target.maxHp - target.hp);
      break;
    }
    case "sk_ql_3":
      plan.power = Math.min(150, 70 + getWannenPower(user) * 0.2);
      plan.utility = user.turnEffects.some(effect => effect.name === "封灵千噬") ? 0 : 36;
      break;
    case "sk_ql_4":
      plan.status = "fear";
      plan.statusValue = 105;
      plan.utility = soloStatusCanHelp(target, "fear") ? 0 : 32;
      break;
    case "sk_ql_5":
      if (!gameState.field) plan.fixed = Math.max(0, Math.min(349, getWannenPower(user) - 20));
      break;
    default:
      if (skill.category === "status") {
        if (skill.name === "水流环") plan.heal = maxHp * 0.25;
        if (skill.name === "光合作用") plan.heal = maxHp * 0.5;
        if (skill.name === "冰冻之风") plan.power = 55;
      }
  }
  if (skill.category === "status" && user.bloodline?.name === "清念灵体") plan.heal += 200;
  if (user.bloodline?.name === "明念" && !data.mingnianUses?.has(skill)) plan.utility += 22;
  return plan;
}

// 测试模式保留原有选招，供已有复现和对练使用。
function chooseTestSkill(user, target) {
  let best = null, bestScore = -Infinity;
  for (const skill of user.skills) {
    if (!canSelectSkill(skill)) continue;
    let score = (skill.power || 30) * getEffectiveness(getEffectiveSkillElement(user, skill.element), target.element);
    if (skill.effect && skill.effectChance > 30) score += 20;
    if (skill.onUse) score += 15;
    if (score > bestScore) {
      best = skill;
      bestScore = score;
    }
  }
  return best;
}
