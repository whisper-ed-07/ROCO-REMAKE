// ============================================================
//  V3 ENGINE - 完整机制引擎
// ============================================================

const STAGE_LABELS = Object.freeze({ atk: "物攻", def: "物防", spatk: "魔攻", spdef: "魔防", spd: "速度", accuracy: "命中", evasion: "闪避" });
const STAGE_FIELDS = Object.keys(STAGE_LABELS).map(function(stat) { return stat + "Stage"; });

class BattlePet {
  constructor(petData) {
    this.id = petData.id; this.name = petData.name; this.element = petData.element;
    this.emoji = petData.emoji; this.level = petData.level;
    var s = calcAllStats(petData.baseStats, petData.level);
    this.maxHp = s.hp; this.hp = s.hp;
    this.atk = s.atk; this.def = s.def;
    this.spatk = s.spatk; this.spdef = s.spdef; this.spd = s.spd;
    for (const key of STAGE_FIELDS) {
      if (petData.bloodline?.name !== "不灭魂体") { this[key] = 0; continue; }
      let value = 0;
      Object.defineProperty(this, key, {
        enumerable: true,
        get: () => value,
        set: next => {
          const before = value;
          value = next;
          const fell = before !== 0 && (Math.sign(before) !== Math.sign(next) || Math.abs(next) < Math.abs(before));
          if (!fell || !(this.futiThrough >= gameState.turnCount)) return;
          const opponent = this === gameState.playerActive ? gameState.aiActive : this === gameState.aiActive ? gameState.playerActive : null;
          if (opponent && !opponent.isFainted()) {
            const lost = Math.abs(before - next);
            createBattleContext().doFixedDamage(opponent, lost * 80, this);
            addMessage("【覆体魂衣】强化消失" + lost + "级！");
          }
        }
      });
    }
    this.status = null; this.statusTurns = 0;
    this.poisoned = false;
    this.leechSeed = false; this.confuseTurns = 0; this.bindTurns = 0;
    // V2 fields
    this.shield = 0; this.marks = {}; this.turnEffects = [];
    this.qlSealMark = false;
    this.bloodline = petData.bloodline || null; this.bloodlineData = null;
    this.healMod = 1.0; this.dmgMod = 1.0; this.spdMod = 1.0;
    // V3 NEW fields
    this.segmentIdx = 0;               // 当前回合受击段数
    this.lethalHitThisTurn = false;    // 本回合有致死一击
    this.preDeathHP = 0;               // 致死前HP
    this.preventCritNext = false;      // 禁止对方下次暴击
    this.blockPPRecovery = false;      // 封锁PP回复(下回合)
    this.elementOriginal = null;       // 原始属系
    this.elementLost = false;          // 是否已丢失属系
    this.skillUseCounts = {};          // 技能使用次数追踪
    this.ppHistory = [];               // PP历史 [{turn, skills:[{id,pp}]}]
    this.damageCap = Infinity;         // 单段伤害上限
    this.damageCapThreshold = 0;       // 限伤触发阈值
    this.damageCapTurns = 0;           // 限伤剩余回合
    this.passiveDamageReduction = 0;   // 常驻伤害减免%
    this.damageReduction = 0;          // 伤害减免%
    this.damageReductionTurns = 0;     // 减免剩余回合
    this.powerDamageImmuneThroughTurn = -1; // 威力伤害免疫最后生效的战斗回合
    this.superEffReduction = 0;        // 克制伤害减免%
    this.fixedDmgHealPct = 0;         // 固伤反转治疗%
    this.statusImmunitySources = new Map();
    this.outputReduction = 0;          // 输出降低%
    this.healInvertPct = 0;            // 倒置治疗比例（0-1）
    this.healInvertTurns = 0;         // 倒置治疗剩余回合
    this.statLockedThrough = -1;      // 强化锁定至指定回合
    this.critRateBonus = 0;            // 暴击率加成（0-1）
    // === 极影迪莫明念引擎字段 ===
    this.lastDealtDamage = 0;         // 上回合造成伤害总值
    this.outputThisTurn = 0;          // 本回合累计对敌输出（含固伤）
    this.damageTakenThisTurn = [];    // 本回合承伤分段（残脉公式用）
    this.lastTakenSegments = [];      // 上回合承伤分段
    this.lastTakenTotal = 0;          // 上回合承伤总值
    this.skillsUsedThisTurn = 0;      // 本回合使用技能次数
    this.lastTurnOutput = 0;          // 上回合的总输出（回合末结算）
    this.currentDealt = 0;            // 本回合累计造成伤害
    this.lastPPDeletedSkill = null;   // 上次被删除PP的技能
    this.skillPPCostMult = 1;         // PP消耗倍率
    this.priorityOverride = null;     // 先手值覆盖
    this.dodgeLethalLeft = 0;         // 致命伤害闪避次数
    this.oppConsecutive = {};         // 对方连续使用技能计数
    this.lastUsedSkillId = null;      // 上回合使用的技能
    this.lastPowerSkillId = null;     // 上次使用的威力技能（明念回复目标）
    this.maxHpBonus = 0;              // 精力上限增幅
    this.mingNianDmg = 0;             // 明念追加固伤
    this.invincible = false;          // 免疫一切伤害与效果
    this.healReducePct = 0;           // 受到的治疗降低%（瞬华冰冻）
    // 出战最多 4 个技能（技能池可以更多）
    this.skills = petData.skillIds.slice(0, 4).map(function(sid) {
      var s = findSkill(sid); return s ? { ...s, pp: s.maxPp, priority: s.priority || 8 } : null;
    }).filter(Boolean);
    if (this.bloodline && this.bloodline.name === "清念/残脉" && getQingyuStartingMode(this) === null) {
      setQingyuOriginalBloodline(this, true);
    }
    if (this.bloodline && this.bloodline.name === "不灭魂体") {
      var creationSkill = this.skills.find(skill => skill.id === "sk_cszn");
      if (creationSkill) {
        grantStatusImmunity(this, "创世之能", Infinity, { statuses: ["freeze", "sleep", "fear", "bind"] });
        grantStatusImmunity(this, "创世之能（0 PP）", Infinity, { active: () => creationSkill.pp === 0 });
      }
    }
  }
  getStat(stat) {
    var stages = { atk: this.atkStage, def: this.defStage, spatk: this.spatkStage, spdef: this.spdefStage, spd: this.spdStage };
    var stage = stages[stat] || 0;
    var mult = stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
    var val = this[stat] * mult;
    if (stat === "spd") { if (this.status === "paralyze") val *= 0.5; val *= (this.spdMod || 1) * (isMingnianMarked(this) ? 1.05 : 1) * (gameState.field === "shunhua" && this.element === "light" ? 1.15 : 1) * (1 + (this.creationSpeedSources?.size || 0) * 0.1); }
    return Math.floor(val);
  }
  isFainted() { return this.hp <= 0; }
  canAct() {
    // 控制状态即时复查；只缓存麻痹随机数，不能缓存尚未受控时的 true。
    if (this.isFainted() || this.status === "freeze" || this.status === "sleep" || this.status === "deep_sleep" || this.status === "fear") return false;
    if (this.status !== "paralyze") return true;
    var turn = gameState.turnCount || 0;
    if (this.__canActTurn === turn && this.__canActValue !== undefined) return this.__canActValue;
    var v = Math.random() >= 0.25;
    this.__canActTurn = turn; this.__canActValue = v;
    return v;
  }
  getDamageReduction() {
    const timedReduction = !gameState.banEffects?.dmgReduction && this.damageReductionTurns > 0 ? this.damageReduction : 0;
    return Math.max(this.passiveDamageReduction, timedReduction);
  }
  hasDamageCap() {
    return !gameState.banEffects?.damageCap && (
      (this.damageCapTurns > 0 && this.damageCap < Infinity) ||
      (this.lightWindThroughTurn >= gameState.turnCount && this.hp < (this.maxHp + (this.maxHpBonus || 0)) * 0.6) ||
      this.bloodlineData?.jianghuaThrough >= gameState.turnCount
    );
  }
  takeDamage(dmg, source, sourceSkill) {
    if (this.invincible || (this.externalEffectImmuneTurn === gameState.turnCount && source !== this)) return 0;
    // 致命伤害闪避（极影光幕）
    if (this.dimoLethalDodgeThrough >= gameState.turnCount && this.dodgeLethalLeft > 0 && dmg >= this.hp && this.hp > 0) {
      this.dodgeLethalLeft--;
      for (const skill of this.skills) gainPP(this, skill, 1, "sk_jydm_3");
      addMessage(this.name + " 闪避了致命伤害！");
      return 0;
    }
    // 限伤检查
    if (!gameState.banEffects?.damageCap) {
      if (this.damageCapTurns > 0 && dmg > this.damageCapThreshold) dmg = Math.min(dmg, this.damageCap);
      if (this.lightWindThroughTurn >= gameState.turnCount && this.hp < (this.maxHp + (this.maxHpBonus || 0)) * 0.6) {
        dmg = Math.min(dmg, 150);
      }
    }
    // 伤害减免
    const reduction = this.getDamageReduction();
    if (reduction > 0) dmg = Math.floor(dmg * (100 - reduction) / 100);
    // 护盾吸收（带日志+飘字）
    if (!gameState.banEffects?.shield && this.shield > 0) {
      if (this.shield >= dmg) { this.shield -= dmg; if (!this.shield && dmg > 0) dimoShieldBroke(this, source); addMessage(this.name + " 的护盾吸收了" + dmg + "点伤害！"); spawnFloatText(this, dmg, "shield"); return 0; }
      addMessage(this.name + " 的护盾吸收了" + this.shield + "点伤害，剩余" + (dmg - this.shield) + "点穿透！");
      spawnFloatText(this, this.shield, "shield");
      dmg -= this.shield; this.shield = 0; dimoShieldBroke(this, source);
    }
    dmg = restrictJianghuaDamage(this, dmg);
    if (dmg <= 0) return 0;
    // 致死检测
    if (dmg > this.hp) {
      this.lethalHitThisTurn = true;
      this.preDeathHP = this.hp;
    }
    const received = Math.min(this.hp, dmg);
    this.hp = Math.max(0, this.hp - dmg);
    if (received > 0) {
      this.lastDamageSegment = received;
      sealDivineSkill(this, source, sourceSkill);
    }
    if (dmg > 0) { this.damageTakenThisTurn.push(dmg); spawnFloatText(this, dmg, "dmg"); }
    const segmentIndex = this.segmentIdx++;
    if (received > 0) this.bloodline?.onAfterDamageSegment?.(this, segmentIndex, createBattleContext());
    return dmg;
  }
  heal(amount, options = {}) {
    const before = this.hp;
    const modifier = (this.healMod ?? 1) + (isMingnianMarked(this) ? 0.15 : 0) + (this.jianghuaGlobalThrough >= gameState.turnCount ? 1 : 0);
    const reduced = this.dimoFrostRecoveryThrough >= gameState.turnCount ? 0.5 : 1 - (this.healReducePct || 0) / 100;
    const effective = Math.ceil(Math.floor(amount * modifier + 1e-9) * reduced);
    if (effective <= 0) return 0;
    const forcedInversion = options.invertPct || (this.qinglingInvertThrough >= gameState.turnCount ? 1 : 0);
    const inversion = forcedInversion || (this.healInvertTurns > 0 ? Math.max(0, this.healInvertPct) : 0);
    if (this.qinglingInvertNext && gameState.qinglingHealBatches) {
      const batch = gameState.qinglingHealBatches.get(this) || [];
      batch.push({ effective, inversion });
      gameState.qinglingHealBatches.set(this, batch);
      return 0;
    }
    return this.applyHealSegment(effective, inversion, before);
  }
  applyHealSegment(amount, inversion, before = this.hp) {
    const inverted = Math.floor(amount * inversion);
    const cap = this.maxHp + (this.maxHpBonus || 0);
    this.hp = Math.max(0, Math.min(cap, Math.max(0, this.hp - inverted) + amount - inverted));
    const change = this.hp - before;
    if (inverted > 0) addMessage(this.name + "的治疗被倒置，精力减少" + inverted + "点！");
    if (change > 0) spawnFloatText(this, change, "heal");
    return change;
  }
}

// ---------- GLOBAL STATE ----------
var gameState = {
  screen: "menu", battleMode: "solo", playerParty: [], aiParty: [],
  playerActive: null, aiActive: null,
  messages: [], isPlayerTurn: true,
  battleOver: false, waitingForSwitch: false, pendingPlayerSkill: null, pendingAISkill: null, pendingPlayerAction: null, resolvingTurn: false, turnTimer: null, autoSkipTimer: null, turnTimeLeft: 0,
  selectedTeamIds: [], opponentTeamIds: [],
  turnCount: 0, weather: null, weatherTurns: 0, field: null, fieldTurns: 0, banEffects: null, logFilter: "all", logCollapsed: {},
  wanguHeals: [],      // 万古遗恨施放回合的输出及下一回合的治疗
  qingnianWindows: {},
  snapshots: [],       // 状态快照历史
  ppHistory: []        // 全局PP历史 [{turn, pets: [{id,pp}]}]
};

let activePetChangeListener = null;

function setActivePetChangeListener(listener) {
  activePetChangeListener = listener;
}

function notifyActivePetChanged(side, previous, incoming, reason) {
  activePetChangeListener?.({ side, previous, incoming, reason });
}

