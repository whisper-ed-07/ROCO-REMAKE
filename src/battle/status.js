// ---------- LEGACY FUNCTIONS ----------
function calcDamage(attacker, defender, skill) {
  if (skill.power === 0) return { damage: 0, effectiveness: 1, isCrit: false };
  if (skill.power > 0 && hasPowerDamageImmunity(defender)) return { damage: 0, effectiveness: 1, isCrit: false };
  var isPhysical = skill.category === "physical";
  var atkStat = isPhysical ? attacker.getStat("atk") : attacker.getStat("spatk");
  var defStat = isPhysical ? defender.getStat("def") : defender.getStat("spdef");
  var dmg = Math.floor(((2 * attacker.level / 5 + 2) * getSkillPower(skill, skill.power) * (atkStat / defStat)) / 50 + 2);
  dmg = Math.floor(dmg * (0.85 + Math.random() * 0.15));
  const element = getEffectiveSkillElement(attacker, skill.element);
  if (element && element === attacker.element) dmg = Math.floor(dmg * 1.5);
  var eff = getEffectiveness(element, defender.element);
  dmg = Math.floor(dmg * eff);
  dmg = Math.floor(dmg * getWeatherDamageMod(element, defender.element));
  var isCrit = false;
  if (skill.category !== "status" && Math.random() < (0.0625 + (attacker.critRateBonus || 0)) && !attacker.preventCritNext && defender.bloodline?.name !== "不灭魂体") { dmg = Math.floor(dmg * 1.5); isCrit = true; }
  if (attacker.preventCritNext) attacker.preventCritNext = false;
  if (attacker.status === "burn" && isPhysical) dmg = Math.floor(dmg * 0.5);
  dmg = Math.floor(dmg * getOutputMultiplier(attacker));
  if (defender.bloodline?.name === "不灭魂体" && eff >= 2) dmg = Math.floor(dmg * 0.6);
  return { damage: Math.max(1, dmg), effectiveness: eff, isCrit: isCrit };
}

// 防控按宠物与来源登记，由同一处负责刷新、累加和到期。
const ABNORMAL_WITHOUT_BIND = ["burn", "freeze", "paralyze", "poison", "sleep", "deep_sleep", "confuse", "fear", "leech_seed"];
const ABNORMAL_STATUSES = ABNORMAL_WITHOUT_BIND.concat("bind");
const STATUS_LABELS = { burn: "烧伤", freeze: "冰冻", paralyze: "麻痹", poison: "中毒",
  sleep: "睡眠", deep_sleep: "沉睡", fear: "恐惧", confuse: "混乱", bind: "束缚", leech_seed: "寄生" };
const STATUS_MESSAGES = { burn: "烧伤了", freeze: "被冰冻了", paralyze: "麻痹了", poison: "中毒了",
  sleep: "睡着了", deep_sleep: "陷入沉睡", fear: "被恐惧了", confuse: "混乱了", bind: "被束缚了", leech_seed: "被寄生种子缠住了" };

function grantStatusImmunity(pet, source, turns, options = {}) {
  const sources = pet.statusImmunitySources;
  const previous = sources.get(source);
  const turnsLeft = options.stack && previous ? previous.turnsLeft + turns : turns;
  sources.set(source, {
    source,
    statuses: options.statuses || ABNORMAL_STATUSES,
    stats: options.stats,
    active: options.active,
    turnsLeft,
    createdTurn: gameState.turnCount
  });
  return turnsLeft;
}

function revokeStatusImmunity(pet, source) {
  pet.statusImmunitySources.delete(source);
}

function activeStatusImmunities(pet) {
  if (!pet.statusImmunitySources) return [];
  return Array.from(pet.statusImmunitySources.values()).filter(lock => !lock.active || lock.active());
}

function hasStatusImmunity(pet, status) {
  return activeStatusImmunities(pet).some(lock => lock.statuses.includes(status));
}

function hasStatDropImmunity(pet, stat) {
  return activeStatusImmunities(pet).some(lock =>
    lock.stats === true || (Array.isArray(lock.stats) && lock.stats.includes(stat))
  );
}

function tickStatusImmunities(pet) {
  for (const [source, lock] of pet.statusImmunitySources || []) {
    if (lock.turnsLeft === Infinity || lock.createdTurn === gameState.turnCount) continue;
    lock.turnsLeft--;
    if (lock.turnsLeft <= 0) revokeStatusImmunity(pet, source);
  }
}

function cleanseAbnormalStatuses(pet) {
  pet.status = null;
  pet.statusTurns = 0;
  pet.confuseTurns = 0;
  pet.bindTurns = 0;
  pet.leechSeed = false;
  pet.poisoned = false;
}

function clearAbnormalStatus(pet, effect) {
  if (effect === "confuse") pet.confuseTurns = 0;
  else if (effect === "bind") pet.bindTurns = 0;
  else if (effect === "leech_seed") pet.leechSeed = false;
  else if (effect === "poison") pet.poisoned = false;
  else if (pet.status === effect) { pet.status = null; pet.statusTurns = 0; }
}

function wakeFromPowerHit(pet) {
  if (pet.status !== "sleep") return;
  pet.status = null;
  pet.statusTurns = 0;
  addMessage(battlePetName(pet) + " 被威力技能击中后醒来！", "status", battlePetSide(pet));
}

function tickUnableToAct(pet, skill) {
  const name = battlePetName(pet);
  const side = battlePetSide(pet);
  const action = skill ? name + "的「" + skill.name + "」未能使出" : name + "本回合空过";
  const reason = action + "，原因是" + STATUS_LABELS[pet.status];
  if (["sleep", "deep_sleep", "fear"].includes(pet.status)) {
    pet.statusTurns--;
    if (pet.statusTurns <= 0) {
      pet.status = null;
      pet.statusTurns = 0;
      addMessage(reason + "，该异常在本回合解除。", "status", side);
    } else addMessage(reason + "。", "status", side);
  } else if (pet.status === "freeze") {
    if (Math.random() < 0.2) {
      pet.status = null;
      pet.statusTurns = 0;
      addMessage(reason + "，该异常在本回合解除。", "status", side);
    } else addMessage(reason + "。", "status", side);
  } else if (pet.status === "paralyze") {
    addMessage(reason + "。", "status", side);
  }
}

function applyEffect(pet, effect, options = {}) {
  if (!Object.hasOwn(STATUS_MESSAGES, effect)) return false;
  if (hasStatusImmunity(pet, effect)) {
    addMessage(battlePetName(pet) + " 免疫了" + STATUS_LABELS[effect] + "！", "status", battlePetSide(pet));
    return false;
  }
  // 页游互斥组：烧伤与控制同组，寄生与中毒同组，束缚独立。
  if (pet.status === effect || (effect === "confuse" && pet.confuseTurns > 0) ||
      (effect === "bind" && pet.bindTurns > 0) || (effect === "leech_seed" && pet.leechSeed) ||
      (effect === "poison" && pet.poisoned)) return true;
  const turns = options.turns ?? (
    effect === "sleep" || effect === "deep_sleep" ? 1 + Math.floor(Math.random() * 6) :
    effect === "fear" ? 1 + Math.floor(Math.random() * 2) :
    effect === "confuse" ? 2 + Math.floor(Math.random() * 3) :
    effect === "bind" ? 2 + Math.floor(Math.random() * 4) : 0
  );
  const version = (pet.abnormalSequence || 0) + 1;
  pet.abnormalSequence = version;
  if (effect === "bind") pet.bindTurns = turns;
  else if (effect === "leech_seed" || effect === "poison") {
    pet.leechSeed = effect === "leech_seed";
    pet.poisoned = effect === "poison";
  } else {
    pet.status = effect === "confuse" ? null : effect;
    pet.statusTurns = effect === "confuse" ? 0 : turns;
    pet.confuseTurns = effect === "confuse" ? turns : 0;
    if (effect === "deep_sleep") pet.deepSleepToken = version;
  }
  (pet.abnormalVersions ||= new Map()).set(effect, version);
  addMessage(options.message || battlePetName(pet) + " " + STATUS_MESSAGES[effect] +
    (turns > 0 ? "（" + turns + " 回合）" : "") + "！", "status", battlePetSide(pet));
  return true;
}



