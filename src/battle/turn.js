// ---------- TURN SYSTEM V4: 先手值优先级 ----------
// 机制：默认先手值=8，先手+x = 8+x，后手-x = 8-x。双方选定技能后比较先手值，高者先动。

function setPPCostEffect(pet, source, turns, options) {
  if (!pet || turns <= 0) return;
  const effects = pet.ppCostEffects ||= new Map();
  effects.set(source, { ...options, throughTurn: gameState.turnCount + turns - 1 });
}

function getPPCostSourceLabel(source) {
  if (typeof source !== "string") return source?.skill;
  return source.startsWith("光幕三损:") ? "极影光幕·三损" : source;
}

function getRequiredPPCost(pet, skill, breakdown) {
  if (skill.noExtraPPCost) {
    if (breakdown) breakdown.noExtra = true;
    return 1;
  }
  const turn = gameState.turnCount + (gameState.resolvingTurn ? 0 : 1);
  let extra = skill.extraPPCost || 0;
  let multiplier = pet.skillPPCostMult || 1;
  if (breakdown && extra > 0) breakdown.extraSource = "技能自身";
  const opponent = pet === gameState.playerActive ? gameState.aiActive : gameState.playerActive;
  if (opponent?.lightWindThroughTurn >= turn) {
    const lightWind = getEffectiveSkillElement(pet, skill.element) === "flying" ? 1 : 2;
    if (breakdown && lightWind > extra) breakdown.extraSource = "轻风散魂";
    extra = Math.max(extra, lightWind);
  }
  for (const [source, effect] of pet.ppCostEffects || []) {
    if (effect.throughTurn < turn) {
      pet.ppCostEffects.delete(source);
      continue;
    }
    if (effect.skill && effect.skill !== skill) continue;
    const factor = effect.multiplier || 1;
    if (breakdown && factor > multiplier) breakdown.multiplierSource = getPPCostSourceLabel(source);
    multiplier = Math.max(multiplier, factor);
    const amount = effect.extraFor ? effect.extraFor(skill, getEffectiveSkillElement(pet, skill.element)) : effect.extra;
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
    traceSkillPP(user, skill, skill.pp, skill.pp, "第" + turn + "回合选招失败", undefined, skill.pp <= 0 ? "PP 已空" : "技能被封禁");
    return null;
  }
  const ppBefore = skill.pp;
  const breakdown = isDeveloperBattle() ? {} : null;
  const requestedCost = getRequiredPPCost(user, skill, breakdown);
  const ppCost = Math.min(ppBefore, requestedCost);
  setSkillPP(user, skill, ppBefore - ppCost, "第" + turn + "回合选招扣费", undefined,
    breakdown ? describePPCost(breakdown, requestedCost, ppCost) : undefined);
  return { kind: "skill", user, skill, ppBefore, ppAfter: skill.pp, ppCost, requestedCost };
}

function canSubmitPlayerAction() {
  return gameState.isPlayerTurn && !gameState.battleOver && !gameState.resolvingTurn;
}

function playerUseSkill(skillIdx) {
  if (!canSubmitPlayerAction() || gameState.waitingForSwitch) return;
  const player = gameState.playerActive;
  if (!player || player.isFainted()) return;
  const action = reserveSkillAction(player, player.skills[skillIdx], gameState.turnCount + 1);
  if (action) submitPlayerAction(action);
}

function submitPlayerAction(action) {
  gameState.pendingPlayerAction = action;
  gameState.pendingPlayerSkill = null;
  gameState.isPlayerTurn = false;
  stopTurnTimer();
  document.querySelectorAll("#battle-actions button").forEach(button => { button.disabled = true; });
  aiDecideAndResolve();
}

function endTurnCleanup() {
  // 回合末的被动也已结算，场上和场下的限时威力伤害免疫统一到期。
  gameState.playerParty.concat(gameState.aiParty).forEach(function(pet) {
    if (pet.powerDamageImmuneThroughTurn === gameState.turnCount) pet.powerDamageImmuneThroughTurn = -1;
  });
  gameState.isPlayerTurn = !gameState.battleOver;
  updateBattleUI();
  if (!gameState.battleOver) renderBattleActions();
}

function aiDecideAndResolve() {
  if (gameState.battleOver || gameState.resolvingTurn) return;
  var ai = gameState.aiActive, player = gameState.playerActive;
  
  // 先选招，行动能力统一在本回合结算内判定，选招阶段不抽取麻痹随机数。
  // AI选技能（与旧版相同逻辑）
  var available = ai.skills.filter(canSelectSkill);
  if (available.length === 0) {
    addMessage(ai.name + (ai.skills.some(skill => skill.pp > 0) ? " 没有可用技能！" : " 所有技能PP耗尽！"));
    gameState.pendingAISkill = -1; // signal no skill
  } else {
    var bestSkill = available[0], bestScore = -Infinity;
    for (var i = 0; i < available.length; i++) {
      var sk = available[i], score = sk.power || 30;
      var eff = getEffectiveness(getEffectiveSkillElement(ai, sk.element), player.element); score *= eff;
      if (sk.effect && sk.effectChance > 30) score += 20;
      if (sk.onUse) score += 15;
      if (score > bestScore) { bestScore = score; bestSkill = sk; }
    }
    gameState.pendingAISkill = ai.skills.indexOf(bestSkill);
  }
  
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

  if (!playerCanAct) tickUnableToAct(player);
  if (!aiCanAct) tickUnableToAct(ai);
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
  var ti=document.querySelector("#turn-indicator"); if (ti) ti.style.display = "none";
  createBattleContext().savePPState();
  processBloodlines();
  processCreationRounds();
  applyEndOfTurnEffects(player); applyEndOfTurnEffects(ai);
  processTurnEffects(player); processTurnEffects(ai);
  resolveWanguHeals();
  
  addMessage("━━━ 第 " + gameState.turnCount + " 回合 ━━━");
  
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
    addMessage(firstPet.name + " 先手！（先手" + fmtPriority(firstPrio) + " vs " + fmtPriority(secondPrio) + (dreamActive ? "，梦境反转！" : "") + "）");
  } else {
    addMessage("双方本回合没有行动。");
  }
  const firstIncoming = runTurnAction(firstAction, secondPet, firstSide);
  // 主动换宠已完成时，后出手的对手以新上场宠物为目标。
  const secondIncoming = !player.isFainted() && !ai.isFainted()
    ? runTurnAction(secondAction, firstIncoming || firstPet, secondSide) : null;

  for (const afterAction of gameState.afterActions) afterAction();
  resolveDimoFirstAttack(firstPet);
  resolveJianghuaDeletions();
  resolveQinglingHealBatches();
  sampleQingnianEndOfRound();
  postDamageProcessing();
  updateBattleUI();
  checkFaints();
  if (!gameState.battleOver) tickEnvironments();
  for (const heal of gameState.wanguHeals) {
    if (heal.castTurn === gameState.turnCount) heal.amount = Math.abs(heal.owner.outputThisTurn - heal.opponent.outputThisTurn);
  }
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
  if (user.isFainted() || target.isFainted()) return;
  // 执行前复查在场与控制。选招时已经支付的 PP 不再复查或重扣。
  if (user !== gameState.playerActive && user !== gameState.aiActive) { addMessage(user.name + " 已离场，行动取消！"); return; }
  if (target !== gameState.playerActive && target !== gameState.aiActive) { addMessage(target.name + " 已不在场上，本次行动取消！"); return; }
  if (!user.canAct()) { addMessage(user.name + " 无法行动！"); return; }
  if (isSkillSealed(skill, gameState.turnCount)) { addMessage(user.name + " 的" + skill.name + "被封禁！"); return; }
  action = action || reserveSkillAction(user, skill);
  if (!action) { addMessage(user.name + " 的" + skill.name + "已无PP，行动取消！"); return; }
  const ppChange = "（PP " + action.ppBefore + "→" + action.ppAfter + (action.requestedCost > 1 ? " ×" + action.requestedCost : "") + "）";
  // 迷雾天气：主动行动结算前 80% 概率令自身混乱
  if (gameState.weather === "mist" && !hasStatusImmunity(user, "confuse") && Math.random() < 0.8) {
    applyEffect(user, "confuse", { turns: 1, message: "迷雾缭绕，" + user.name + " 在行动前陷入混乱！" });
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
    if (action.used) user.bloodline?.onActionEnd?.(user, target, ctx, skill);
  } finally {
    ctx.skillAction = null;
  }
}

function resolveSkillEffects(user, target, skill, who, action, ctx, ppChange) {
  const isPlayer = who === "player";
  const userIsBackhand = gameState.pendingFirstMove !== who;
  const priorNilex = user.pendingNilex;
  var lastEff = 1, lastDmgVal = 0;

  // 混乱判定
  if (user.confuseTurns > 0) {
    addMessage(user.name + " 处于混乱状态！");
    if (Math.random() < 0.5) {
      var selfDmg = Math.floor(((2 * user.level / 5 + 2) * 40 * (user.getStat("atk") / user.getStat("def"))) / 50 + 2);
      user.takeDamage(selfDmg);
      addMessage(user.name + " 攻击了自己，受到 " + selfDmg + " 点伤害！");
      user.confuseTurns--;
      addMessage(user.name + " 混乱自伤！" + ppChange);
      updateBattleUI(); checkFaints(); return;
    }
  }
  
  const dodged = resolveDimoFirstAttack(target, skill);
  if (user.isFainted()) { updateBattleUI(); checkFaints(); return; }
  recordRoundSkillUse(action, target);
  recordDimoSkillRound(user, skill);
  if (dodged) {
    applyQingnianSuppression(user, skill);
    updateBattleUI(); checkFaints();
    return;
  }

  const lightWindDodges = target.lightWindDodgeTurn === gameState.turnCount - 1 ||
    (target.lightWindDodgeTurn === gameState.turnCount && userIsBackhand);
  if (lightWindDodges && !skill.semiSure && skill.accuracy < 100) {
    applyQingnianSuppression(user, skill);
    addMessage(target.name + " 闪避了" + user.name + " 的非必中技能！");
    return;
  }
  // 命中判定：半必中（semiSure）仅在对方"必定闪避"时 miss，其余必中
  const guaranteedFirst = skill.sureFirst && gameState.pendingFirstMove === who;
  if (skill.semiSure) {
    if (target.sureDodge && !guaranteedFirst) {
      applyQingnianSuppression(user, skill);
      addMessage(target.name + " 必定闪避了 " + user.name + " 的 " + skill.name + "！" + ppChange);
      if (skill.onMiss) skill.onMiss(user, target, ctx);
      return;
    }
  } else if (skill.accuracy < 100 && Math.random() * 100 > skill.accuracy) {
    applyQingnianSuppression(user, skill);
    addMessage(user.name + " 的 " + skill.name + " 没有命中！" + ppChange);
    return;
  }
  // 化念作刃先手闪避：target 有标志、本技能非必中、user 为后手 → 闪避
  if (!skill.semiSure && target.dodgeNextNonSure && skill.accuracy < 100 && userIsBackhand) {
    applyQingnianSuppression(user, skill);
    addMessage(target.name + " 闪避了后手非必中技能！视物攻+2！" + ppChange);
    target.atkStage = Math.min(6, target.atkStage + 2);
    target.dodgeNextNonSure = false;
    updateBattleUI(); checkFaints(); return;
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
  
  addMessage(user.name + " 使用了 " + skill.name + ppChange + "！");
  applyQingnianSuppression(user, skill);

  // 瞬华环境：先手出招回100精力
  var userIsFirstMove = (gameState.pendingFirstMove === (isPlayer ? "player" : "ai"));
  if (gameState.field === "shunhua" && userIsFirstMove) {
    ctx.doHeal(user, 100);
    ctx.msg("【瞬华环境】先手出招回复100精力！");
  }
  if (skill.onUse) {
    skill.onUse(user, target, ctx);
  } else if (skill.category === "status") {
    applyLegacyStatusSkill(user, target, skill, ctx);
  } else {
    const result = ctx.doDamage(user, target, skill.power, skill.category, skill.element);
    lastEff = result.effectiveness; lastDmgVal = result.damage;
    addMessage("造成 " + result.damage + " 点伤害！" + getEffLabel(result.effectiveness) + (result.isCrit ? " 命中要害！" : ""));
    if (skill.effect && skill.effectChance > 0 && Math.random() * 100 < skill.effectChance) {
      var eff = getEffectiveness(getEffectiveSkillElement(user, skill.element), target.element);
      if (eff > 0) ctx.applyStatus(target, skill.effect);
    }
  }
  
  if (priorNilex && skill.category !== "status" && skill.power > 0) resolveNilexFollowup(user, target, ctx, priorNilex);

  // 迷雾天气：主动行动结算后 80% 概率令对手混乱
  if (gameState.weather === "mist" && !target.isFainted() && !hasStatusImmunity(target, "confuse") && Math.random() < 0.8) {
    applyEffect(target, "confuse", { turns: 1, message: "迷雾缭绕，" + target.name + " 在行动后陷入混乱！" });
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

  updateBattleUI();
  checkFaints();
}

function applyLegacyStatusSkill(user, target, skill, ctx = createBattleContext()) {
  var name = skill.name;
  if (name === "祈雨") ctx.modifyStat(user, "spatk", 2);
  else if (name === "水流环") { user.heal(Math.floor(user.maxHp / 4)); addMessage(user.name + " 回复了HP！"); }
  else if (name === "光合作用") { user.heal(Math.floor(user.maxHp / 2)); addMessage(user.name + " 回复了大量HP！"); }
  else if (name === "龙之舞") { ctx.modifyStat(user, "atk", 1); ctx.modifyStat(user, "spd", 1); }
  else if (name === "极光幕") { ctx.modifyStat(user, "def", 1); ctx.modifyStat(user, "spdef", 1); }
  else if (name === "烟雾") {
    ctx.modifyStat(target, "accuracy", -1);
  }
  else if (name === "冰冻之风") {
    ctx.modifyStat(target, "spd", -1);
    var res = ctx.doDamage(user, target, 55, "special", skill.element); addMessage("造成 " + res.damage + " 点伤害！"); }
  else if (name === "寄生种子") { if (Math.random() * 100 < 90) ctx.applyStatus(target, "leech_seed"); }
  else if (skill.effect && skill.effectChance > 0 && Math.random() * 100 < skill.effectChance) ctx.applyStatus(target, skill.effect);
}

// ---------- SWITCH ----------
function applyEndOfTurnEffects(pet) {
  if (!pet || pet.isFainted()) return;
  for (const [affected, status, divisor] of [[pet.status === "burn", "烧伤", 16], [pet.poisoned, "中毒", 8]]) {
    if (!affected || pet.isFainted()) continue;
    const damage = Math.floor(pet.maxHp / divisor);
    createBattleContext().doFixedDamage(pet, damage);
    addMessage(pet.name + " 因" + status + "受到 " + damage + " 点伤害！");
  }
  if (pet.bindTurns > 0) { pet.bindTurns--; if (pet.bindTurns <= 0) addMessage(pet.name + " 解除了束缚！"); }
  if (pet.leechSeed) { var drain = Math.floor(pet.maxHp / 8); pet.takeDamage(drain); var opp = pet === gameState.playerActive ? gameState.aiActive : gameState.playerActive; if (opp && !opp.isFainted()) opp.heal(drain); addMessage(pet.name + " 被寄生种子吸取了 " + drain + " HP！"); }
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
  trackQingnianSwitch(pet, true);
  gameState.pendingJianghuaByPet?.delete(pet);
  if (pet.bloodline?.name === "明念") endMingnian(pet);
  for (const active of [gameState.playerActive, gameState.aiActive]) {
    if (active?.bloodlineData?.markTarget === pet) endMingnian(active);
  }
  pet.qlSealMark = false;
  pet.turnEffects = pet.turnEffects.filter(effect => effect.name !== "微灵封体印");
}

function callBloodlineEnter(pet) {
  if (!pet) return;
  if (gameState.banEffects) clearGrantedDefenses(pet);
  if (pet.bloodline?.onEnter) pet.bloodline.onEnter(pet, createBattleContext());
  trackQingnianSwitch(pet, false);
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
  if (user.bindTurns > 0) { addMessage(user.name + " 被束缚了，无法换宠！"); return false; }
  if (hasSwitchLock(user)) { addMessage(user.name + " 无法换宠！"); return false; }
  return true;
}

function playerSwitch(petIdx) {
  if (!canSubmitPlayerAction()) return;
  const user = gameState.playerActive, incoming = gameState.playerParty[petIdx];
  if (!user || user.isFainted() || !incoming || incoming === user || incoming.isFainted() || !canSwitchPet(user)) return;
  gameState.waitingForSwitch = false;
  const panel = document.querySelector("#switch-panel");
  if (panel?.closeLayer) panel.closeLayer(true);
  else if (panel) panel.classList.remove("show");
  submitPlayerAction({ kind: "switch", user, incoming });
}

function executeSwitchAction(action, who) {
  const { user, incoming } = action;
  const activeKey = who === "player" ? "playerActive" : "aiActive";
  if (gameState[activeKey] !== user || user.isFainted() || incoming.isFainted() || !canSwitchPet(user)) return null;
  addMessage(who === "player" ? "回来吧，" + user.name + "！" : "对手收回了 " + user.name + "！");
  leaveBattlefield(user);
  gameState[activeKey] = incoming;
  incoming.lastDealtDamage = incoming.currentDealt || 0; incoming.currentDealt = 0;
  callBloodlineEnter(incoming);
  addMessage(who === "player" ? "上吧，" + incoming.name + "！" : "对手换上了 " + incoming.name + "！");
  notifyActivePetChanged(who, user, incoming, "voluntary");
  return incoming;
}

function replaceFaintedPet(pet, side) {
  const isPlayer = side === "player";
  const party = isPlayer ? gameState.playerParty : gameState.aiParty;
  leaveBattlefield(pet);
  addMessage(pet.name + " 倒下了！");
  const incoming = party.find(candidate => candidate !== pet && !candidate.isFainted());
  if (!incoming) {
    endBattle(!isPlayer);
    return true;
  }
  gameState[isPlayer ? "playerActive" : "aiActive"] = incoming;
  callBloodlineEnter(incoming);
  addMessage((isPlayer ? "上吧，" : "对手派出了 ") + incoming.name + "！");
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
  closeBloodlinePreview();
  gameState.battleOver = true;
  stopTurnTimer();
  if (isDeveloperBattle()) {
    addMessage(fled ? "我方逃跑，测试结束。" : playerWin ? "战斗结束，我方胜利。" : "战斗结束，对方胜利。", "system");
    renderBattleLog();
    const leave = document.querySelector("#flee-btn");
    if (leave) { leave.textContent = "返回主菜单"; leave.title = "返回主菜单"; }
  }
  document.querySelector("#result-overlay").classList.add("show");
  document.querySelector("#result-emoji").textContent = fled ? "" : playerWin ? "\u{1F3C6}" : "\u{1F494}";
  const result = document.querySelector("#result-text");
  result.textContent = fled ? "测试结束" : playerWin ? "你赢了！" : "你输了...";
  result.className = "result-text " + (fled ? "" : playerWin ? "win" : "lose");
  const actions = document.querySelector("#battle-actions");
  if (actions) actions.innerHTML = "";
}

