// ---------- BLOODLINE & TURN EFFECT PROCESSING ----------
function processBloodlines() {
  [gameState.playerActive, gameState.aiActive].forEach(function(pet) {
    if (pet && !pet.isFainted() && pet.bloodline && pet.bloodline.onTurnStart) {
      const ctx = createBattleContext();
      ctx.logOwner = pet;
      pet.bloodline.onTurnStart(pet, ctx);
    }
  });
}

function getQingyuStartingMode(pet) {
  const first = pet.skills[0]?.id;
  if (first === "sk_qy_1" && pet.skills.some(skill => skill.id === "sk_qy_4")) return "清念";
  if (first === "sk_qy_4" && pet.skills.some(skill => skill.id === "sk_qy_1")) return "残脉";
  return null;
}

function setQingyuOriginalBloodline(pet, active) {
  const source = "清羽原初血脉";
  pet.passiveDamageReduction = active ? 20 : 0;
  if (active) grantStatusImmunity(pet, source, Infinity, { statuses: ABNORMAL_WITHOUT_BIND });
  else revokeStatusImmunity(pet, source);
}

// 残念余梦的封存 PP 只在真正的残脉→清念转换时恢复一次。
function enterQingyuMode(pet, mode) {
  var bd = pet.bloodlineData || (pet.bloodlineData = { turnCount: 0, qfzn: 0, healCount: 0 });
  var previous = bd.mode;
  if (previous === "清念" && mode !== "清念" && bd.qingnianChannel && !bd.qingnianChannel.due) finishQingnianChannel(pet, true);
  bd.mode = mode;
  bd.modeEntered = true;
  if (pet.bloodline?.name === "清念/残脉") setQingyuOriginalBloodline(pet, false);
  if (mode === "清念" && bd.qingfengSavedPP !== undefined) {
    const skill = pet.skills.find(item => item.id === "sk_qy_2");
    if (skill) setSkillPP(pet, skill, Math.min(skill.maxPp, bd.qingfengSavedPP), "恢复封存 PP", "轻风散魂·进入清念");
    delete bd.qingfengSavedPP;
  }
  if (previous === "残脉" && mode === "清念" && bd.qy3SavedPP !== undefined) {
    var skill = pet.skills.find(function(s) { return s.id === "sk_qy_3"; });
    if (skill) setSkillPP(pet, skill, Math.min(skill.maxPp, bd.qy3SavedPP), "恢复封存 PP", "残念余梦·残脉转清念");
    delete bd.qy3SavedPP;
  }
}

function mingnianData(pet) {
  const bd = pet.bloodlineData ||= {};
  bd.marks ??= 0;
  bd.mingnianUses ??= new Set();
  return bd;
}

function isMingnianMarked(pet) {
  return !!pet?.bloodlineData?.markTarget && pet.bloodlineData.markThrough >= gameState.turnCount;
}

function syncMingnianMaxHP(pet) {
  const bd = mingnianData(pet);
  const bonus = (isMingnianMarked(pet) ? 50 + 15 * bd.marks : 0) +
    (isMingnianMarked(pet) && bd.jianghuaThrough >= gameState.turnCount ? 100 : 0);
  pet.maxHpBonus = bonus;
  pet.hp = Math.min(pet.hp, pet.maxHp + bonus);
}

function endMingnian(pet, resetMarks = false) {
  const bd = mingnianData(pet);
  if (resetMarks) bd.marks = 0;
  if (!bd.markTarget) return;
  delete bd.markTarget; delete bd.markThrough;
  bd.marked = false; bd.markTurns = 0;
  pet.mingNianDmg = 0;
  revokeStatusImmunity(pet, "明念");
  syncMingnianMaxHP(pet);
}

function advanceMingnian(pet, target, ctx, skill) {
  if (![gameState.playerActive, gameState.aiActive].includes(pet) || pet.isFainted() ||
      ![gameState.playerActive, gameState.aiActive].includes(target) || target.isFainted()) return;
  const bd = mingnianData(pet);
  bd.mingnianUses.add(skill);
  const required = pet.skills.filter(item => item.id !== "sk_jydm_1" || item.pp > 0);
  if (!(ctx.isPassive || ctx.wasInJianghua) &&
      (!required.length || !required.every(item => bd.mingnianUses.has(item)))) return;
  const remark = bd.markTarget === target && bd.markThrough >= gameState.turnCount;
  if (remark) bd.marks++;
  else endMingnian(pet);
  bd.markTarget = target; bd.marked = true;
  bd.markTurns = remark ? 5 : 4;
  bd.markThrough = gameState.turnCount + bd.markTurns - 1;
  bd.mingnianUses.clear();
  syncMingnianMaxHP(pet);
  ctx.grantStatusImmunity(pet, "明念", Infinity, {
    statuses: ["sleep", "freeze", "paralyze", "fear", "confuse", "bind"],
    stats: ["spatk", "spd"],
    active: () => isMingnianMarked(pet)
  });
  pet.mingNianDmg = 40;
  ctx.msg("【明念】标记" + target.name + bd.markTurns + "回合，光明之印×" + bd.marks + "！");
}

function getActiveOpponent(pet) {
  return pet === gameState.playerActive ? gameState.aiActive : pet === gameState.aiActive ? gameState.playerActive : null;
}

function dimoAttack(u, t, ctx, dodgeResult) {
  if (!t || t.isFainted() || u.isFainted()) return;
  if (dodgeResult === false) {
    ctx.transformStages(u, value => -value);
    ctx.transformStages(t, value => -value, u);
    ctx.deletePP(t, -1, 2);
  }
  const damage = ctx.doDamage(u, t, 90, "physical", "fighting", dodgeResult ? { atkStageOverride: 2 } : undefined);
  ctx.detail("化念作刃计算伤害 " + damage.damage + " 点。");
  const bd = mingnianData(u);
  if (!isMingnianMarked(u) || bd.markTarget !== t) return;
  const stages = STAGE_FIELDS.reduce((total, key) => total + Math.abs(t[key]), 0);
  const extra = Math.floor(0.4 * (t.lastTurnOutput || 0) * stages);
  if (extra > 0) ctx.doFixedDamage(t, extra, u);
  u.immuneEject = true;
  if (bd.marks < 4) {
    ctx.deletePP(t, -1, 1);
    if (damage.isCrit) ctx.deletePP(t, -1, 1);
  } else {
    ctx.doFixedDamage(t, 999, u);
    endMingnian(u, true);
    const first = u.skills[0];
    if (first) gainPP(u, first, first.maxPp, "化念作刃清印");
  }
}

function resolveDimoFirstAttack(owner, opposingSkill) {
  const pending = owner?.dimoPendingAttack;
  if (!pending) return false;
  delete owner.dimoPendingAttack;
  const { target, ctx, action, turn } = pending;
  if (turn !== gameState.turnCount || getActiveOpponent(owner) !== target || owner.isFainted()) return false;
  const dodge = opposingSkill ? !opposingSkill.semiSure && opposingSkill.accuracy < 100 : null;
  ctx.skillAction = action;
  try {
    dimoAttack(owner, target, ctx, dodge);
    advanceMingnian(owner, target, ctx, ctx.sourceSkill);
  } finally {
    ctx.skillAction = null;
  }
  return dodge;
}

function recordDimoSkillRound(pet, skill) {
  const turn = gameState.turnCount;
  const history = pet.dimoRounds ||= new Map();
  for (const round of history.keys()) if (round < turn - 6) history.delete(round);
  if (!history.has(turn)) history.set(turn, new Set());
  history.get(turn).add(skill);
  applyDimoScreenCosts(pet);
}

function applyDimoScreenCosts(pet) {
  const turn = gameState.turnCount;
  const history = pet.dimoRounds;
  if (!history) return;
  for (const [source, cast] of pet.dimoScreenWindows || []) {
    const through = cast + 3;
    if (turn > through) {
      pet.dimoScreenWindows.delete(source);
      continue;
    }
    for (const skill of pet.skills) {
      for (let round = cast - 1; round <= Math.min(turn, through); round++) {
        if (!history.get(round)?.has(skill) || !history.get(round - 1)?.has(skill) || !history.get(round - 2)?.has(skill)) continue;
        const sourceKey = "光幕三损:" + pet.skills.indexOf(skill);
        setPPCostEffect(pet, sourceKey, through - turn + 1, { extra: 2, skill });
        break;
      }
    }
  }
}

function dimoShieldBroke(pet, source) {
  if (!(pet.dimoScreenShieldThrough >= gameState.turnCount) || pet.bloodlineData?.markTarget !== source) return;
  cleanseAbnormalStatuses(pet);
  for (const key of STAGE_FIELDS) if (pet[key] < 0) pet[key] = 0;
  pet.dimoScreenShieldBoost = true;
}

function restrictJianghuaDamage(pet, damage) {
  const bd = pet.bloodlineData;
  if (!bd || !(bd.jianghuaThrough >= gameState.turnCount) || gameState.banEffects?.damageCap || damage <= 0) return damage;
  if (bd.jianghuaDamageTurn !== gameState.turnCount) {
    bd.jianghuaDamage = 0;
    bd.jianghuaDamageTurn = gameState.turnCount;
  }
  const allowed = Math.min(damage, Math.max(0, bd.jianghuaCap - bd.jianghuaDamage));
  bd.jianghuaDamage += allowed;
  if (allowed < damage) countJianghuaRestriction(pet);
  return allowed;
}

function countJianghuaRestriction(pet) {
  const bd = pet.bloodlineData;
  bd.jianghuaRestrictions = (bd.jianghuaRestrictions || 0) + 1;
  if (bd.jianghuaRestrictions % 2 === 0) {
    bd.marks++;
    syncMingnianMaxHP(pet);
  }
}

function sealDivineSkill(defender, attacker, skill) {
  const turn = gameState.turnCount;
  if (!attacker || attacker === defender || !DIVINE_ELEMENTS.has(skill?.element) ||
      !(defender.bloodlineData?.jianghuaThrough >= turn) || !attacker.skills.includes(skill)) return;
  const sealedTurns = skill.jianghuaSealedTurns ||= new Set();
  for (const previous of sealedTurns) if (previous < turn) sealedTurns.delete(previous);
  if (sealedTurns.has(turn + 1)) return;
  sealedTurns.add(turn + 1);
  countJianghuaRestriction(defender);
  addMessage("【极尽降华】" + attacker.name + " 的" + skill.name + "在下一回合被封禁！");
}

function jianghuaBlocksSummon(ctx, kind) {
  const owner = ctx.sourceSkillOwner;
  const lockOwners = Array.from(gameState.jianghuaOwners || [])
    .filter(pet => pet.bloodlineData?.jianghuaThrough >= gameState.turnCount);
  if (!lockOwners.length) return false;
  addMessage("【极尽降华】" + kind + "召唤被封锁！");
  if (!owner) return true;
  for (const caster of lockOwners) {
    const ownParty = gameState.playerParty.includes(caster) ? gameState.playerParty : gameState.aiParty;
    if (caster === owner || ownParty.includes(owner)) continue;
    const counts = caster.bloodlineData.jianghuaSummons;
    const count = (counts.get(owner) || 0) + 1;
    counts.set(owner, count);
    if (count === 3) createBattleContext().doFixedDamage(owner, 999);
  }
  return true;
}

function recoverFromJianghuaDeletion(pet, changes) {
  if (pet.bloodline?.name !== "明念" || pet.isFainted()) return;
  const target = getActiveOpponent(pet);
  if (!target || target.isFainted()) return;
  const skill = changes.find(change => change.skill.id === "sk_jydm_1" && change.skill.pp === 0)?.skill;
  if (!skill) return;
  const ctx = createBattleContext();
  ctx.sourceSkill = skill;
  ctx.sourceSkillOwner = pet;
  ctx.isPassive = true;
  const breakdown = isDeveloperBattle() ? {} : null;
  const extra = getRequiredPPCost(pet, skill, breakdown) - 1;
  if (extra > 0) {
    const paid = Math.min(skill.pp, extra);
    setSkillPP(pet, skill, skill.pp - paid, "被动发动额外扣费", "极尽降华",
      breakdown ? describePPCost(breakdown, extra, paid) : undefined);
  }
  recordRoundSkillUse({ user: pet, skill, effectivePriority: getSkillPriority(skill) }, target);
  recordDimoSkillRound(pet, skill);
  applyQingnianSuppression(pet, skill);
  addMessage("【极尽降华】PP被删除，被动发动！");
  skill.onUse(pet, target, ctx);
  pet.bloodline?.onActionEnd?.(pet, target, ctx, skill);
}

function resolveNilexFollowup(user, target, ctx, pending) {
  if (user.pendingNilex === pending) user.pendingNilex = null;
  if (pending.cnt === 1) {
    ctx.doFixedDamage(target, 9999, user);
    ctx.forceClearPP(target, "逆流而行·终结");
    for (const skill of user.skills) gainPP(user, skill, 1, "sk_nlex", "逆流而行·终结");
    ctx.msg("逆流而行的终结效果发动，强制清空对方的 PP，并尝试回复自身各技能 1 PP。");
    ctx.detail("终结追加固定伤害的计算值为 9999 点。");
  } else if (pending.cnt === 2) {
    for (const skill of user.skills) gainPP(user, skill, 3, "sk_nlex", "逆流而行·后续回复");
    ctx.doHeal(user, Math.floor((user.maxHp + (user.maxHpBonus || 0)) * 0.3));
    ctx.msg("逆流而行的回溯效果发动，尝试回复自身各技能 3 PP。");
    ctx.detail("回溯治疗按最大精力的 30% 计算。");
  }
}

function endCreation(pet) {
  const data = pet.bloodlineData;
  if (!data?.creationActive) return;
  data.creationActive = false;
  data.creationThrough = -1;
  data.creationTarget?.creationSpeedSources?.delete(pet);
  pet.creationSpeedSources?.delete(pet);
  delete data.creationTarget;
  for (const [recipient, source] of data.creationCosts || []) recipient.ppCostEffects?.delete(source);
  delete data.creationCosts;
  pet.skillContinuations.delete("sk_cszn");
}

function creationPP(pet, opponent, ctx) {
  if (!opponent || opponent.isFainted()) return;
  for (const { slot, amount } of ctx.deletePP(opponent, -1, 2, "创世之能·吸取")) {
    gainPP(pet, pet.skills[slot], amount, "sk_cszn", "创世之能·吸取");
  }
}

function resolveCreationStage(owner, opponent, stage, ctx) {
  creationPP(owner, opponent, ctx);
  if (stage === 2) {
    ctx.transformStages(owner, () => 0);
    ctx.transformStages(opponent, () => 0);
    gainPP(owner, owner.skills[0], Infinity, "sk_cszn", "创世之能·次回合");
  } else {
    const cap = owner.maxHp + (owner.maxHpBonus || 0);
    if (owner.hp < cap * 0.3) ctx.doHeal(owner, Math.floor((cap - owner.hp) * 0.7));
    const skill = owner.skills.find(item => item.id === "sk_cszn");
    if (skill) setSkillPP(owner, skill, 0, "清空自身 PP", "创世之能·末回合", "当前精力 " + owner.hp + "/" + cap);
  }
}

function getOutputMultiplier(pet) {
  const buff = (pet.dmgMod ?? 1) + (isMingnianMarked(pet) ? 0.15 : 0) +
    (pet.jianghuaGlobalThrough >= gameState.turnCount ? 1 : 0) +
    (pet.bloodlineData?.creationThrough >= gameState.turnCount ? 0.25 : 0);
  const shroud = pet.skills.some(skill => skill.id === "sk_cyjy" && skill.pp > 0) ? 0.6 : 1;
  return buff * shroud * (1 - (pet.outputReduction || 0) / 100);
}

function applyMingnianDamage(ctx, owner, target) {
  const stages = STAGE_FIELDS.reduce((sum,key) => sum + Math.abs(owner[key] || 0) + Math.abs(target[key] || 0), 0);
  const amount = 40 + 15 * stages;
  ctx.doFixedDamage(target, amount, owner, { skipMingnian: true });
  ctx.msg(owner.name + " 明念追加" + amount + "点固伤！");
}

function totalSkillPP(pet) {
  return pet.skills.reduce((sum, skill) => sum + skill.pp, 0);
}

function qingnianPPSample(pet, paidPP = 0) {
  const previous = gameState.roundStartPP?.get(pet) ?? totalSkillPP(pet) + paidPP;
  return { pet, previous, change: 0 };
}

function startQingnianChannel(owner, samples, turns, ctx) {
  const data = owner.bloodlineData ||= {};
  const channel = data.qingnianChannel = { samples, attackingPlayer: gameState.playerActive === owner };
  owner.turnEffects = owner.turnEffects.filter(effect => effect.name !== "清念沉脉");
  ctx.addTurnEffect(owner, "清念沉脉", turns, null, () => {
    channel.due = true;
  });
}

function updateQingnianSamples(channel, resume = false) {
  if (!channel || channel.due) return;
  for (const sample of channel.samples) {
    const current = totalSkillPP(sample.pet);
    if (!resume) sample.change += current - sample.previous;
    sample.previous = current;
  }
}

function sampleQingnianEndOfRound() {
  for (const owner of [gameState.playerActive, gameState.aiActive]) {
    updateQingnianSamples(owner?.bloodlineData?.qingnianChannel);
  }
}

function finishQingnianChannel(owner, useCurrentPP) {
  const data = owner.bloodlineData;
  const channel = data.qingnianChannel;
  if (!channel) return;
  delete data.qingnianChannel;
  owner.turnEffects = owner.turnEffects.filter(effect => effect.name !== "清念沉脉");
  if (useCurrentPP) updateQingnianSamples(channel);
  const loss = channel.samples.reduce((sum, sample) => sum + Math.abs(sample.change), 0);
  if (isDeveloperBattle()) {
    const changes = channel.samples.map(({pet, change}) =>
      (pet === owner ? "施放者" : "锁定对手") + pet.name + " " + (change > 0 ? "+" : "") + change + " PP");
    addMessage("【清念沉脉】锁定双方的 PP 净变化：" + changes.join("、") + "，应回复 " + Math.round(loss / 2) + " PP。");
  }
  const restored = gainPP(owner, owner.skills.find(skill => skill.id === "sk_qy_5"), Math.round(loss / 2), undefined, "清念沉脉·期满");
  const targetSide = channel.attackingPlayer ? "aiActive" : "playerActive";
  const until = gameState.turnCount + (useCurrentPP ? 3 : 4);
  gameState.qingnianWindows[targetSide] = until;
  if (gameState[targetSide]) gameState[targetSide].qingnianWindowEnd = until;
  addMessage("清念沉脉结束，回复" + restored + "PP，开启4回合出招削弱窗口。");
}

function setSkillElement(pet, source, element, turns) {
  const effects = pet.skillElementEffects ||= new Map();
  effects.delete(source);
  effects.set(source, { element, throughTurn: gameState.turnCount + turns - 1 });
}

function getEffectiveSkillElement(pet, baseElement, forecastTurn) {
  if (gameState.forceSkillElement) return gameState.forceSkillElement;
  let element = baseElement;
  const turn = forecastTurn ?? gameState.turnCount;
  for (const [source, effect] of pet.skillElementEffects || []) {
    if (effect.throughTurn < turn) {
      if (forecastTurn === undefined) pet.skillElementEffects.delete(source);
    } else {
      element = effect.element;
    }
  }
  return element;
}

function getSkillPower(skill, power) {
  return power * (1 - (skill ? skill.qingnianPowerLoss || 0 : 0));
}

function getSkillPriority(skill) {
  return (skill.dimoFastThrough >= gameState.turnCount ? 12 : skill.priority ?? 8) - (skill.qingnianPriorityLoss || 0);
}

function applyQingnianSuppression(pet, skill) {
  const side = pet === gameState.playerActive ? "playerActive" : "aiActive";
  const until = gameState.qingnianWindows[side] ?? pet.qingnianWindowEnd;
  if (until === undefined || gameState.turnCount > until) return;
  if (skill.category === "status") {
    skill.qingnianPriorityLoss = (skill.qingnianPriorityLoss || 0) + 1;
    addMessage("【清念沉脉】" + pet.name + " 的" + skill.name + "先手永久-1！");
  } else {
    skill.qingnianPowerLoss = Math.min(0.5, (skill.qingnianPowerLoss || 0) + 0.3);
    addMessage("【清念沉脉】" + pet.name + " 的" + skill.name + "威力永久削弱" + Math.round(skill.qingnianPowerLoss * 100) + "%！");
  }
}

function startSkillContinuation(owner, skillId, turns, onUse, onEnd) {
  const turn = gameState.turnCount;
  owner.skillContinuations.set(skillId, { start: turn, through: turn + turns - 1, lastUse: turn, onUse, onEnd });
}

function endSkillContinuation(owner, skillId) {
  const sequence = owner.skillContinuations.get(skillId);
  if (!sequence) return;
  owner.skillContinuations.delete(skillId);
  sequence.onEnd();
}

function interruptSkillContinuations(owner) {
  for (const skillId of owner.skillContinuations.keys()) {
    endSkillContinuation(owner, skillId);
    addMessage("【打断】" + battlePetName(owner) + "的「" + findSkill(skillId).name + "」提前结束。", "status", battlePetSide(owner));
  }
}

function triggerSkillContinuations(owner, move) {
  const turn = gameState.turnCount;
  for (const [skillId, sequence] of owner.skillContinuations) {
    if (skillId === move.id || turn <= sequence.lastUse || turn > sequence.through) continue;
    const target = getActiveOpponent(owner);
    if (owner.isFainted() || !target || target.isFainted()) return;
    sequence.lastUse = turn;
    const stage = turn - sequence.start + 1;
    addMessage(battlePetName(owner) + "【" + move.name + "】带出「" + findSkill(skillId).name + "」第 " + stage + " 回合效果。", "action", battlePetSide(owner));
    sequence.onUse(stage, target);
  }
}

function finishSkillContinuations() {
  for (const owner of gameState.playerParty.concat(gameState.aiParty)) {
    for (const [skillId, sequence] of owner.skillContinuations) {
      if (gameState.turnCount >= sequence.through || owner.isFainted()) endSkillContinuation(owner, skillId);
    }
  }
}

function processTurnEffects(pet) {
  if (!pet || pet.isFainted()) return;
  // 先快照再清空：onTick 内注册的新效果写入新数组，不会被本轮结果覆盖
  var queue = pet.turnEffects.slice();
  pet.turnEffects = [];
  queue.forEach(function(e) {
    if (!e) return;
    if (e.onTick) e.onTick(pet);
    // 本回合刚创建的效果不在本回合递减，避免“1回合”当场归零
    if (e.createdTurn === (gameState.turnCount || 0)) { pet.turnEffects.push(e); return; }
    e.turnsLeft--;
    if (e.turnsLeft <= 0) { if (e.onExpire) e.onExpire(pet); }
    else pet.turnEffects.push(e);
  });
  tickStatusImmunities(pet);
  // 保留既有封锁结束点：上一回合施加的封锁仍覆盖本回合开场回复。
  pet.blockPPRecovery = false;
}

function postDamageProcessing() {
  // Check lethal hit survival (不灭魂体 mechanic)
  [gameState.playerActive, gameState.aiActive].forEach(function(pet) {
    if (!pet || !pet.bloodline) return;
    if (pet.lethalHitThisTurn && pet.bloodline.name === "不灭魂体" && !pet.lethalHandled) {
      pet.lethalHandled = true;
      addMessage("【不灭魂体】" + pet.name + "受到致死伤害，尝试删除自身各技能4PP。");
      createBattleContext().deletePP(pet, -1, 4, "不灭魂体·保命");
      const switched = forceSwitchPet(pet, () => {
        pet.hp = 1;
        addMessage("【不灭魂体】" + pet.name + "保留1点精力！");
      });
      if (!switched) {
        pet.hp = 0;
        addMessage("【不灭魂体】" + pet.name + "无法被驱逐，致死保命未生效。");
      }
    }
  });
}

function isEjectImmune(pet) {
  return pet.immuneEject || pet.dimoEjectImmuneThrough >= gameState.turnCount;
}

function getForcedSwitchCandidates(pet) {
  if (pet !== gameState.playerActive && pet !== gameState.aiActive) return [];
  const party = gameState.playerActive === pet ? gameState.playerParty : gameState.aiParty;
  return party.filter(candidate => candidate !== pet && !candidate.isFainted());
}

function forceSwitchPet(pet, beforeLeave) {
  if (pet !== gameState.playerActive && pet !== gameState.aiActive) return;
  if (isEjectImmune(pet)) { addMessage(pet.name + " 免疫了驱逐效果！"); return; }
  const candidates = getForcedSwitchCandidates(pet);
  if (!candidates.length) return;
  const next = candidates[Math.floor(Math.random() * candidates.length)];
  beforeLeave?.();
  leaveBattlefield(pet);
  const isPlayer = gameState.playerActive === pet;
  addMessage(pet.name + " 被迫换下！");
  gameState[isPlayer ? "playerActive" : "aiActive"] = next;
  callBloodlineEnter(next);
  addMessage((isPlayer ? "换上 " : "对手换上 ") + next.name + "！");
  notifyActivePetChanged(isPlayer ? "player" : "ai", pet, next, "forced");
  return next;
}

