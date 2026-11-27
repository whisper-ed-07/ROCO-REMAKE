// ---------- TURN SYSTEM V4: 先手值优先级 ----------
// 机制：默认先手值=8，先手+x = 8+x，后手-x = 8-x。双方选定技能后比较先手值，高者先动。

function setPPCostEffect(pet, source, turns, options) {
  if (!pet || turns <= 0) return;
  const effects = pet.ppCostEffects ||= new Map();
  const effect = { ...options, throughTurn: gameState.turnCount + turns - 1 };
  effects.set(source, effect);
  return () => {
    if (effects.get(source) === effect) effects.delete(source);
  };
}

function getPPCostSourceLabel(source) {
  if (typeof source !== "string") return source?.skill;
  return source.startsWith("光幕三损:") ? "极影光幕·三损" : source;
}

function getRequiredPPCost(pet, skill, breakdown, forecastTurn) {
  if (skill.noExtraPPCost) {
    if (breakdown) breakdown.noExtra = true;
    return 1;
  }
  const turn = forecastTurn ?? gameState.turnCount + (gameState.resolvingTurn ? 0 : 1);
  let extra = skill.extraPPCost || 0;
  let multiplier = pet.skillPPCostMult || 1;
  if (breakdown && extra > 0) breakdown.extraSource = "技能自身";
  const opponent = pet === gameState.playerActive ? gameState.aiActive : gameState.playerActive;
  if (opponent?.lightWindThroughTurn >= turn) {
    const lightWind = getEffectiveSkillElement(pet, skill.element, forecastTurn) === "flying" ? 1 : 2;
    if (breakdown && lightWind > extra) breakdown.extraSource = "轻风散魂";
    extra = Math.max(extra, lightWind);
  }
  for (const [source, effect] of pet.ppCostEffects || []) {
    if (effect.throughTurn < turn) {
      if (forecastTurn === undefined) pet.ppCostEffects.delete(source);
      continue;
    }
    if (effect.skill && effect.skill !== skill) continue;
    const factor = effect.multiplier || 1;
    if (breakdown && factor > multiplier) breakdown.multiplierSource = getPPCostSourceLabel(source);
    multiplier = Math.max(multiplier, factor);
    const amount = effect.extraFor ? effect.extraFor(skill, getEffectiveSkillElement(pet, skill.element, forecastTurn)) : effect.extra;
    if (breakdown && (amount || 0) > extra) breakdown.extraSource = getPPCostSourceLabel(source);
    extra = Math.max(extra, amount || 0);
  }
  if (breakdown) { breakdown.multiplier = multiplier; breakdown.extra = extra; }
  return Math.max(1, Math.round(multiplier + extra));
}

function describePPCost(breakdown, requested, paid) {
  const parts = ["应扣 " + requested + " PP"];
  if (breakdown.noExtra) parts.push("免疫额外 PP 消耗");
  if (breakdown.multiplier > 1) parts.push("基础消耗 ×" + breakdown.multiplier +
    (breakdown.multiplierSource ? "（" + breakdown.multiplierSource + "）" : ""));
  if (breakdown.extra > 0) parts.push("额外 +" + breakdown.extra + " PP" +
    (breakdown.extraSource ? "（" + breakdown.extraSource + "）" : ""));
  if (paid < requested) parts.push("剩余 PP 不足，实扣 " + paid + " PP");
  return parts.join("，");
}

function isSkillSealed(skill, turn) {
  return skill?.jianghuaSealedTurns?.has(turn) === true;
}

function canSelectSkill(skill) {
  return skill?.pp > 0 && !isSkillSealed(skill, gameState.turnCount + 1);
}

function reserveSkillAction(user, skill, turn = gameState.turnCount) {
  if (!skill) return null;
  if (skill.pp <= 0 || isSkillSealed(skill, turn)) {
    traceSkillPP(user, skill, skill.pp, skill.pp, "第" + turn + "回合选招失败", undefined, skill.pp <= 0 ? "PP 已空" : "技能被封禁", turn);
    return null;
  }
  const ppBefore = skill.pp;
  const breakdown = isDeveloperBattle() ? {} : null;
  const requestedCost = getRequiredPPCost(user, skill, breakdown);
  const ppCost = Math.min(ppBefore, requestedCost);
  setSkillPP(user, skill, ppBefore - ppCost, "第" + turn + "回合选招扣费", undefined,
    breakdown ? describePPCost(breakdown, requestedCost, ppCost) : undefined, turn);
  return { kind: "skill", user, skill, ppBefore, ppAfter: skill.pp, ppCost, requestedCost };
}

function canSubmitPlayerAction() {
  return gameState.isPlayerTurn && !gameState.battleOver && !gameState.resolvingTurn;
}

function playerUseSkill(skillIdx) {
  if (!canSubmitPlayerAction() || gameState.waitingForSwitch) return;
  const player = gameState.playerActive;
  if (!player || player.isFainted()) return;
  const skill = player.skills[skillIdx];
  // 对手先锁定选招，避免读到我方这回合预付后的 PP。
  const opponentMove = gameState.battleMode === "solo" && canSelectSkill(skill)
    ? chooseOpponentSkill(gameState.aiActive, player) : undefined;
  const action = reserveSkillAction(player, skill, gameState.turnCount + 1);
  if (action) submitPlayerAction(action, opponentMove);
}

function submitPlayerAction(action, opponentMove) {
  gameState.pendingPlayerAction = action;
  gameState.pendingPlayerSkill = null;
  gameState.isPlayerTurn = false;
  stopTurnTimer();
  battlePresentation.actionSubmitted?.();
  aiDecideAndResolve(opponentMove);
}

function stopTurnTimer() {
  clearInterval(gameState.turnTimer);
  clearTimeout(gameState.autoSkipTimer);
  gameState.turnTimer = null;
  gameState.autoSkipTimer = null;
  battlePresentation.timerStopped?.();
}

function endTurnCleanup() {
  // 回合末的被动也已结算，场上和场下的限时威力伤害免疫统一到期。
  gameState.playerParty.concat(gameState.aiParty).forEach(function(pet) {
    if (pet.powerDamageImmuneThroughTurn === gameState.turnCount) pet.powerDamageImmuneThroughTurn = -1;
  });
  gameState.isPlayerTurn = !gameState.battleOver;
  battlePresentation.refresh?.();
  if (!gameState.battleOver) battlePresentation.awaitingAction?.();
}

function aiDecideAndResolve(opponentMove) {
  if (gameState.battleOver || gameState.resolvingTurn) return;
  const { aiActive: ai, playerActive: player } = gameState;
  const skill = opponentMove === undefined ? chooseOpponentSkill(ai, player) : opponentMove;
  gameState.pendingAISkill = ai.skills.indexOf(skill);
  resolveTurn();
}

function resolveTurn() {
  if (gameState.battleOver || gameState.resolvingTurn) return;
  gameState.resolvingTurn = true;
  gameState.isPlayerTurn = false;
  try {
    resolveTurnActions();
  } finally {
    gameState.resolvingTurn = false;
    gameState.roundActions = null;
    gameState.roundStartPP = null;
    gameState.qinglingHealBatches = null;
    gameState.afterActions = null;
    gameState.pendingPlayerAction = null;
    gameState.pendingPlayerSkill = null;
    gameState.pendingAISkill = null;
  }
  endTurnCleanup();
}

function resolveTurnActions() {
  var player = gameState.playerActive, ai = gameState.aiActive;
  const selected = gameState.pendingPlayerAction;
  gameState.roundStartPP = new Map([[player, totalSkillPP(player) + (selected?.ppCost || 0)], [ai, totalSkillPP(ai)]]);
  gameState.turnCount++;
  addMessage("━━━ 第 " + gameState.turnCount + " 回合 ━━━");
  for (const caster of gameState.jianghuaOwners || []) {
    if (caster.bloodlineData?.jianghuaThrough < gameState.turnCount) {
      syncMingnianMaxHP(caster);
      gameState.jianghuaOwners.delete(caster);
    }
  }
  // 在任何天气、异常或回合效果伤害前复位；场下宠物本回合也可能被换上。
  gameState.playerParty.concat(gameState.aiParty).forEach(function(pet) {
    pet.segmentIdx = 0; pet.lethalHitThisTurn = false; pet.lethalHandled = false;
    pet.immuneBackhand = false; pet.immuneBackhandEffects = false; pet.invincible = false;
  });
  [player, ai].forEach(function(pet) { pet.lastDealtDamage = pet.currentDealt || 0; pet.currentDealt = 0; });
  // 已经无法出招的一方空过；已支付的行动不依赖之后的剩余 PP。
  const playerCanAct = selected?.kind === "switch" || player.canAct();
  const aiCanAct = ai.canAct();
  const pAction = playerCanAct ? (selected || reserveSkillAction(player, player.skills[gameState.pendingPlayerSkill])) : null;
  const aAction = aiCanAct ? reserveSkillAction(ai, ai.skills[gameState.pendingAISkill]) : null;
  const pSkill = pAction?.skill;
  const aSkill = aAction?.skill;
  gameState.roundActions = new Map([[player, pAction], [ai, aAction]]);
  gameState.microLingAwarded = false;
  gameState.qinglingHealBatches = new Map();
  gameState.afterActions = [];

  if (!playerCanAct) tickUnableToAct(player, selected?.skill);
  if (!aiCanAct) tickUnableToAct(ai);
  for (const [pet, available, action] of [[player, playerCanAct, pAction], [ai, aiCanAct, aAction]]) {
    if (!available || action) continue;
    const reason = pet.skills.length && pet.skills.every(move => move.pp <= 0)
      ? " 所有技能的 PP 已耗尽，本回合空过。"
      : " 本回合没有选定可用行动，空过。";
    addMessage(battlePetName(pet) + reason, "action", battlePetSide(pet));
  }
  // 双方空过也走完整回合管线，持续效果和计时均正常推进。
  var pPrio = pAction?.kind === "switch" ? 8 : pSkill ? (pSkill.dimoFastThrough >= gameState.turnCount ? 12 : player.priorityOverride ?? pSkill.priority ?? 8) : 0;
  var aPrio = aSkill ? (aSkill.dimoFastThrough >= gameState.turnCount ? 12 : ai.priorityOverride ?? aSkill.priority ?? 8) : 0;
  // 迷雾天气：幽灵系技能先手值+1
  if (gameState.weather === "mist") {
    if (pSkill && getEffectiveSkillElement(player, pSkill.element) === "ghost") pPrio += 1;
    if (aSkill && getEffectiveSkillElement(ai, aSkill.element) === "ghost") aPrio += 1;
  }
  // 梦境环境：清翎覆尘出招速度反转为后手-7（先手+7→后手-7）
  if (gameState.field === "dream") {
    if (pSkill && pSkill.id === "sk_qy_1") pPrio = 1;
    if (aSkill && aSkill.id === "sk_qy_1") aPrio = 1;
  }
  if (pSkill) pPrio -= pSkill.qingnianPriorityLoss || 0;
  if (aSkill) aPrio -= aSkill.qingnianPriorityLoss || 0;
  if (pSkill) pAction.effectivePriority = pPrio;
  if (aSkill) aAction.effectivePriority = aPrio;
  
  processWeather();processField();
  battlePresentation.roundStarted?.();
  createBattleContext().savePPState();
  processBloodlines();
  applyEndOfTurnEffects(player); applyEndOfTurnEffects(ai);
  processTurnEffects(player); processTurnEffects(ai);
  resolveWanguHeals();
  
  // 先手值比较；平手时速度高者先动。梦境环境下整体反转：先手值低者先动，同值速度慢者先动

  var pSpdEff = player.getStat("spd"), aSpdEff = ai.getStat("spd");
  var dreamActive = gameState.field === "dream";
  var playerFirst;
  if (!pAction) playerFirst = false;
  else if (!aAction) playerFirst = true;
  else playerFirst = dreamActive
    ? ((pPrio < aPrio) || (pPrio === aPrio && pSpdEff <= aSpdEff))
    : ((pPrio > aPrio) || (pPrio === aPrio && pSpdEff >= aSpdEff));
  gameState.pendingFirstMove = playerFirst ? "player" : "ai";
  
  const firstSide = gameState.pendingFirstMove;
  const secondSide = playerFirst ? "ai" : "player";
  const firstPet = playerFirst ? player : ai, secondPet = playerFirst ? ai : player;
  const firstAction = playerFirst ? pAction : aAction, secondAction = playerFirst ? aAction : pAction;
  const firstPrio = playerFirst ? pPrio : aPrio, secondPrio = playerFirst ? aPrio : pPrio;
  if (firstAction) {
    const orderReason = !secondAction ? battlePetName(secondPet) + "本回合空过" :
      "先手值 " + fmtPriority(firstPrio) + " 对 " + fmtPriority(secondPrio) +
      (firstPrio === secondPrio ? "，有效速度 " + (playerFirst ? pSpdEff : aSpdEff) + " 对 " + (playerFirst ? aSpdEff : pSpdEff) : "") +
      (firstPrio === secondPrio && pSpdEff === aSpdEff ? "，相同时我方先动" : "") +
      (dreamActive ? "，梦境中先手值低者优先，同值时速度慢者优先" : "");
    addMessage(battlePetName(firstPet) + " 先行动（" + orderReason + "）。", "system", firstSide);
  } else {
    addMessage("双方本回合没有行动。");
  }
  const firstIncoming = runTurnAction(firstAction, secondPet, firstSide);
  // 主动换宠已完成时，后出手的对手以新上场宠物为目标。
  let secondIncoming = null;
  if (!player.isFainted() && !ai.isFainted()) {
    secondIncoming = runTurnAction(secondAction, firstIncoming || firstPet, secondSide);
  } else if (!gameState.battleOver && secondAction?.kind === "skill") {
    const fainted = player.isFainted() ? player : ai;
    addMessage(battlePetName(secondPet) + " 的「" + secondAction.skill.name + "」未能使出，因为" + battlePetName(fainted) + "已倒下。", "action", secondSide);
  }

  for (const afterAction of gameState.afterActions) afterAction();
  resolveDimoFirstAttack(firstPet);
  resolveQinglingHealBatches();
  postDamageProcessing();
  battlePresentation.refresh?.();
  checkFaints();
  if (!gameState.battleOver) tickEnvironments();
  for (const heal of gameState.wanguHeals) {
    if (heal.castTurn === gameState.turnCount) heal.amount = Math.abs(heal.owner.outputThisTurn - heal.opponent.outputThisTurn);
  }
  for (const owner of [player, ai]) {
    if (owner.bloodlineData?.qingnianChannel?.due) finishQingnianChannel(owner, false);
  }
  finishSkillContinuations();
  sampleQingnianEndOfRound();
  createBattleContext().saveSnapshot();
  const participants = new Set([player, ai]);
  if (firstIncoming) participants.add(firstIncoming);
  if (secondIncoming) participants.add(secondIncoming);
  participants.forEach(function(p) {
    p.lastTurnOutput = p.outputThisTurn || 0; p.outputThisTurn = 0;
    p.lastTakenSegments = p.damageTakenThisTurn.slice();
    p.lastTakenTotal = p.damageTakenThisTurn.reduce((sum, damage) => sum + damage, 0);
    p.damageTakenThisTurn = []; p.skillsUsedThisTurn = 0;
  });
}

function fmtPriority(p) {
  if (p > 8) return "+" + (p - 8);
  if (p < 8) return "-" + (8 - p);
  return "±0";
}

function getRoundSkillSlot(pet, requireUse = false) {
  const action = gameState.roundActions?.get(pet);
  if (!action || action.kind !== "skill" || (requireUse && !action.used)) return -1;
  return pet.skills.indexOf(action.skill);
}

function recordRoundSkillUse(action, otherPet) {
  action.used = true;
  const { user, skill } = action;
  user.skillsUsedThisTurn = (user.skillsUsedThisTurn || 0) + 1;
  skill.useCount = (skill.useCount || 0) + 1;
  // 先手的历史回溯可能在后手已付费后写回 PP，实际使用时重新套用剩余次数上限。
  if (skill.useLimit && skill.pp > skill.useLimit - skill.useCount) {
    setSkillPP(user, skill, skill.pp, "校正剩余使用次数", skill.id);
  }
  user.skillUseCounts[skill.id] = (user.skillUseCounts[skill.id] || 0) + 1;
  if (user.oppConsecutive) {
    user.oppConsecutive = user.lastUsedSkillId === skill.id ? user.oppConsecutive : {};
    user.oppConsecutive[skill.id] = (user.oppConsecutive[skill.id] || 0) + 1;
  }
  user.lastUsedSkillId = skill.id;
  if (skill.power > 0) user.lastPowerSkillId = skill.id;
  recordQinglingMatchingSkills(action, otherPet);
}

function runTurnAction(action, target, who) {
  if (!action) return null;
  gameState.currentActingSide = who;
  try {
    if (action.kind === "switch") {
      resolveDimoFirstAttack(target);
      return executeSwitchAction(action, who);
    }
    executeSkillTurn(action.user, target, action.skill, who, action);
    return null;
  } finally {
    gameState.currentActingSide = null;
  }
}

function executeSkillTurn(user, target, skill, who, action) {
  const move = battlePetName(user) + " 的「" + skill.name + "」";
  const blocked = reason => addMessage(move + "未能使出，" + reason + "。", "action", who);
  if (user.isFainted() || target.isFainted()) { blocked(battlePetName(user.isFainted() ? user : target) + "已倒下"); return; }
  // 执行前复查在场与控制。选招时已经支付的 PP 不再复查或重扣。
  if (user !== gameState.playerActive && user !== gameState.aiActive) { blocked("使用者已离场"); return; }
  if (target !== gameState.playerActive && target !== gameState.aiActive) { blocked(battlePetName(target) + "已离场"); return; }
  if (!user.canAct()) { blocked(battlePetName(user) + "因" + STATUS_LABELS[user.status] + "无法行动"); return; }
  if (isSkillSealed(skill, gameState.turnCount)) { blocked("技能已被封禁"); return; }
  action = action || reserveSkillAction(user, skill);
  if (!action) { blocked("技能的 PP 已耗尽"); return; }
  const ppChange = "（选招时 PP " + action.ppBefore + " → " + action.ppAfter + "）";
  // 迷雾天气：主动行动结算前 80% 概率令自身混乱
  if (gameState.weather === "mist" && !hasStatusImmunity(user, "confuse") && Math.random() < 0.8) {
    applyEffect(user, "confuse", { turns: 1, message: "迷雾缭绕，" + battlePetName(user) + " 在行动前陷入混乱！" });
  }
  var ctx = createBattleContext();
  ctx.sourceSkill = skill; ctx.sourceSkillOwner = user;
  ctx.skillPPCost = action.ppCost;
  ctx.skillPPAfter = action.ppAfter;
  ctx.wasInJianghua = user.bloodlineData?.jianghuaThrough >= gameState.turnCount;
  ctx.skillElement = getEffectiveSkillElement(user, skill.element);
  ctx.skillAction = { user, target, backhand: gameState.pendingFirstMove !== who };
  try {
    resolveSkillEffects(user, target, skill, who, action, ctx, ppChange);
    if (action.used) {
      user.bloodline?.onActionEnd?.(user, target, ctx, skill);
      triggerSkillContinuations(user, skill);
    }
  } finally {
    ctx.skillAction = null;
  }
}

function resolveSkillEffects(user, target, skill, who, action, ctx, ppChange) {
  const isPlayer = who === "player";
  const userIsBackhand = gameState.pendingFirstMove !== who;
  const priorNilex = user.pendingNilex;
  const move = battlePetName(user) + " 的「" + skill.name + "」";
  const defender = battlePetName(target);
  var lastEff = 1, lastDmgVal = 0;

  // 混乱判定
  if (user.confuseTurns > 0) {
    addMessage(battlePetName(user) + " 处于混乱状态！", "status", who);
    if (Math.random() < 0.5) {
      var selfDmg = Math.floor(((2 * user.level / 5 + 2) * 40 * (user.getStat("atk") / user.getStat("def"))) / 50 + 2);
      user.takeDamage(selfDmg);
      user.confuseTurns--;
      addMessage(move + " 因混乱自伤而未能使出" + ppChange + "。", "action", who);
      battlePresentation.refresh?.(); checkFaints(); return;
    }
  }
  
  const dodged = resolveDimoFirstAttack(target, skill);
  if (user.isFainted()) { battlePresentation.refresh?.(); checkFaints(); return; }
  recordRoundSkillUse(action, target);
  recordDimoSkillRound(user, skill);
  if (dodged) {
    addMessage(defender + " 以「化念作刃」闪避了" + move + ppChange + "。", "action", who);
    applyQingnianSuppression(user, skill);
    battlePresentation.refresh?.(); checkFaints();
    return;
  }

  const lightWindDodges = target.lightWindDodgeTurn === gameState.turnCount - 1 ||
    (target.lightWindDodgeTurn === gameState.turnCount && userIsBackhand);
  if (lightWindDodges && !skill.semiSure && skill.accuracy < 100) {
    applyQingnianSuppression(user, skill);
    addMessage(defender + " 以「轻风散魂」闪避了" + move + ppChange + "。", "action", who);
    return;
  }
  // 命中判定：半必中（semiSure）仅在对方"必定闪避"时 miss，其余必中
  const guaranteedFirst = skill.sureFirst && gameState.pendingFirstMove === who;
  if (skill.semiSure) {
    if (target.sureDodge && !guaranteedFirst) {
      applyQingnianSuppression(user, skill);
      addMessage(defender + " 必定闪避了" + move + ppChange + "。", "action", who);
      if (skill.onMiss) skill.onMiss(user, target, ctx);
      return;
    }
  } else if (skill.accuracy < 100 && Math.random() * 100 > skill.accuracy) {
    applyQingnianSuppression(user, skill);
    addMessage(move + " 未命中" + defender + ppChange + "。", "action", who);
    return;
  }
  // 化念作刃先手闪避：target 有标志、本技能非必中、user 为后手 → 闪避
  if (!skill.semiSure && target.dodgeNextNonSure && skill.accuracy < 100 && userIsBackhand) {
    applyQingnianSuppression(user, skill);
    addMessage(defender + " 闪避了后手施放的" + move + "，物攻提升 2 级" + ppChange + "。", "action", who);
    target.atkStage = Math.min(6, target.atkStage + 2);
    target.dodgeNextNonSure = false;
    battlePresentation.refresh?.(); checkFaints(); return;
  }
  // 闪避失败：target 有标志、本技能必中、user 为后手 → 倒置双方强化+删对方2PP
  if (!skill.semiSure && target.dodgeNextNonSure && skill.accuracy >= 100 && userIsBackhand) {
    target.dodgeNextNonSure = false;
    [user, target].forEach(function(p){
      STAGE_FIELDS.forEach(function(k){ if (p[k] !== 0) p[k] = -p[k]; });
    });
    ctx.deletePP(user, -1, 2);
    addMessage("闪避失败！倒置双方强化，删除对方全体2PP！");
  }
  
  addMessage(battlePetName(user) + " 使用了「" + skill.name + "」" + ppChange + "。", "action", who);
  applyQingnianSuppression(user, skill);

  // 瞬华环境：先手出招回100精力
  var userIsFirstMove = (gameState.pendingFirstMove === (isPlayer ? "player" : "ai"));
  if (gameState.field === "shunhua" && userIsFirstMove) {
    ctx.doHeal(user, 100);
    ctx.detail("瞬华环境的先手治疗按 100 点计算。");
  }
  if (skill.onUse) {
    skill.onUse(user, target, ctx);
  } else if (skill.category === "status") {
    applyLegacyStatusSkill(user, target, skill, ctx);
  } else {
    const result = ctx.doDamage(user, target, skill.power, skill.category, skill.element);
    lastEff = result.effectiveness; lastDmgVal = result.damage;
    if (skill.effect && skill.effectChance > 0 && Math.random() * 100 < skill.effectChance) {
      var eff = getEffectiveness(getEffectiveSkillElement(user, skill.element), target.element);
      if (eff > 0) ctx.applyStatus(target, skill.effect);
    }
  }
  
  if (priorNilex && skill.category !== "status" && skill.power > 0) resolveNilexFollowup(user, target, ctx, priorNilex);

  // 迷雾天气：主动行动结算后 80% 概率令对手混乱
  if (gameState.weather === "mist" && !target.isFainted() && !hasStatusImmunity(target, "confuse") && Math.random() < 0.8) {
    applyEffect(target, "confuse", { turns: 1, message: "迷雾缭绕，" + battlePetName(target) + " 在行动后陷入混乱！" });
  }
  // 瞬华环境：技能伤害被抵抗则追加原伤害30%固伤
  var resistEff = (ctx && ctx._lastEff !== undefined) ? ctx._lastEff : lastEff;
  var resistDmg = (ctx && ctx._lastDmg !== undefined) ? ctx._lastDmg : lastDmgVal;
  if (gameState.field === "shunhua" && skill.category !== "status" && resistEff < 1 && resistEff > 0 && resistDmg > 0) {
    var reflect = Math.floor(resistDmg * 0.3);
    ctx.doFixedDamage(target, reflect, user, { scaled: true });
    ctx.msg("【瞬华环境】伤害被抵抗，追加" + reflect + "固伤！");
  }
  // 血脉技能后钩子（清念翼系触发/PP回复/切换期）
  if (user.bloodline && user.bloodline.onSkillUse) {
    user.bloodline.onSkillUse(user, target, ctx, skill);
  }

  battlePresentation.refresh?.();
  checkFaints();
}

function applyLegacyStatusSkill(user, target, skill, ctx = createBattleContext()) {
  var name = skill.name;
  if (name === "祈雨") ctx.modifyStat(user, "spatk", 2);
  else if (name === "水流环" || name === "光合作用") {
    user.heal(Math.floor(user.maxHp / (name === "水流环" ? 4 : 2)), { source: name });
  }
  else if (name === "龙之舞") { ctx.modifyStat(user, "atk", 1); ctx.modifyStat(user, "spd", 1); }
  else if (name === "极光幕") { ctx.modifyStat(user, "def", 1); ctx.modifyStat(user, "spdef", 1); }
  else if (name === "烟雾") {
    ctx.modifyStat(target, "accuracy", -1);
  }
  else if (name === "冰冻之风") {
    ctx.modifyStat(target, "spd", -1);
    ctx.doDamage(user, target, 55, "special", skill.element); }
  else if (name === "寄生种子") { if (Math.random() * 100 < 90) ctx.applyStatus(target, "leech_seed"); }
  else if (skill.effect && skill.effectChance > 0 && Math.random() * 100 < skill.effectChance) ctx.applyStatus(target, skill.effect);
}

// ---------- SWITCH ----------
function applyEndOfTurnEffects(pet) {
  if (!pet || pet.isFainted()) return;
  for (const [affected, status, divisor] of [[pet.status === "burn", "烧伤", 16], [pet.poisoned, "中毒", 8]]) {
    if (!affected || pet.isFainted()) continue;
    const damage = Math.floor(pet.maxHp / divisor);
    addMessage(battlePetName(pet) + " 的" + status + "结算伤害。", "status", battlePetSide(pet));
    createBattleContext().doFixedDamage(pet, damage);
  }
  if (pet.bindTurns > 0) { pet.bindTurns--; if (pet.bindTurns <= 0) addMessage(battlePetName(pet) + " 解除了束缚！", "status", battlePetSide(pet)); }
  if (pet.leechSeed) {
    const drain = Math.floor(pet.maxHp / 8);
    addMessage("寄生种子对" + battlePetName(pet) + "结算伤害。", "status", battlePetSide(pet));
    pet.takeDamage(drain);
    const opp = pet === gameState.playerActive ? gameState.aiActive : gameState.playerActive;
    if (opp && !opp.isFainted()) {
      opp.heal(drain, { source: "寄生" });
    }
  }
}

function clearGrantedDefenses(pet) {
  pet.shield = 0;
  pet.damageReduction = 0;
  pet.damageReductionTurns = 0;
  pet.damageCap = Infinity;
  pet.damageCapTurns = 0;
  pet.damageCapThreshold = 0;
  pet.reflectBackhand = false;
}

function leaveBattlefield(pet) {
  updateQingnianSamples(pet.bloodlineData?.qingnianChannel);
  if (pet.bloodline?.name === "明念") endMingnian(pet);
  for (const active of [gameState.playerActive, gameState.aiActive]) {
    if (active?.bloodlineData?.markTarget === pet) endMingnian(active);
  }
  pet.qlSealMark = false;
  pet.turnEffects = pet.turnEffects.filter(effect => effect.name !== "微灵封体印");
}

function callBloodlineEnter(pet) {
  if (!pet) return;
  gameState.roundStartPP?.set(pet, totalSkillPP(pet));
  updateQingnianSamples(pet.bloodlineData?.qingnianChannel, true);
  if (gameState.banEffects) clearGrantedDefenses(pet);
  if (pet.bloodline?.onEnter) {
    const ctx = createBattleContext();
    ctx.logOwner = pet;
    pet.bloodline.onEnter(pet, ctx);
  }
}

function hasSwitchLock(pet) {
  if (pet.switchLocked) return true;
  if (pet.deepSleepLock) {
    const { target, token } = pet.deepSleepLock;
    if (!target.isFainted() && target.status === "deep_sleep" && target.deepSleepToken === token) return true;
    delete pet.deepSleepLock;
  }
  const turn = gameState.turnCount + (gameState.resolvingTurn ? 0 : 1);
  for (const [name, throughTurn] of pet.switchLockSources || []) {
    if (throughTurn >= turn) return true;
    pet.switchLockSources.delete(name);
  }
  return false;
}

function canSwitchPet(user) {
  if (user.bindTurns > 0) { addMessage(battlePetName(user) + " 受到束缚，无法换宠！", "status", battlePetSide(user)); return false; }
  if (hasSwitchLock(user)) { addMessage(battlePetName(user) + " 受到换宠限制，无法换宠！", "status", battlePetSide(user)); return false; }
  return true;
}

function playerSwitch(petIdx) {
  if (!canSubmitPlayerAction()) return;
  const user = gameState.playerActive, incoming = gameState.playerParty[petIdx];
  if (!user || user.isFainted() || !incoming || incoming === user || incoming.isFainted() || !canSwitchPet(user)) return;
  gameState.waitingForSwitch = false;
  battlePresentation.switchSelected?.();
  submitPlayerAction({ kind: "switch", user, incoming });
}

function executeSwitchAction(action, who) {
  const { user, incoming } = action;
  const activeKey = who === "player" ? "playerActive" : "aiActive";
  if (gameState[activeKey] !== user || user.isFainted() || incoming.isFainted() || !canSwitchPet(user)) return null;
  addMessage(battlePetName(user) + " 主动离场。", "action", who);
  leaveBattlefield(user);
  gameState[activeKey] = incoming;
  incoming.lastDealtDamage = incoming.currentDealt || 0; incoming.currentDealt = 0;
  callBloodlineEnter(incoming);
  addMessage(battlePetName(incoming) + " 替换上场。", "action", who);
  notifyActivePetChanged(who, user, incoming, "voluntary");
  return incoming;
}

function replaceFaintedPet(pet, side) {
  const isPlayer = side === "player";
  const party = isPlayer ? gameState.playerParty : gameState.aiParty;
  leaveBattlefield(pet);
  addMessage(battlePetName(pet) + " 倒下了！", "system", battlePetSide(pet));
  const incoming = party.find(candidate => candidate !== pet && !candidate.isFainted());
  if (!incoming) {
    endBattle(!isPlayer);
    return true;
  }
  gameState[isPlayer ? "playerActive" : "aiActive"] = incoming;
  callBloodlineEnter(incoming);
  addMessage(battlePetName(incoming) + " 因队友倒下而替补上场。", "system", side);
  notifyActivePetChanged(side, pet, incoming, "faint");
  return false;
}

function checkFaints() {
  // 先处理不灭魂体等致死保护，再判定濒死或胜负。
  postDamageProcessing();
  if (gameState.battleOver) return false;
  const { playerActive, aiActive } = gameState;
  if (playerActive?.isFainted() && replaceFaintedPet(playerActive, "player")) return true;
  if (aiActive?.isFainted() && replaceFaintedPet(aiActive, "ai")) return true;
  return false;
}

function endBattle(playerWin, fled = false) {
  battlePresentation.battleEnding?.();
  gameState.battleOver = true;
  stopTurnTimer();
  if (isDeveloperBattle()) {
    addMessage(fled ? "我方逃跑，测试结束。" : playerWin ? "战斗结束，我方胜利。" : "战斗结束，对方胜利。", "system");
  }
  battlePresentation.battleEnded?.(playerWin, fled);
}
