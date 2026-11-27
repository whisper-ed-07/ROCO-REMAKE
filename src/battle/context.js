// ---------- BATTLE CONTEXT (V3 extended) ----------
function recordAttemptedNegativeEffect(ctx, pet, replay) {
  const action = ctx.skillAction;
  if (!action || ctx.replayingNegativeEffects || pet === action.user) return;
  let record = pet.lastNegativeSkillEffects;
  if (!record || record.action !== action) {
    record = { action, replays: [], applied: new Map() };
    pet.lastNegativeSkillEffects = record;
  }
  record.replays.push(replay);
  return record;
}

function replayNegativeEffects(owner, opponent, ctx) {
  ctx.replayingNegativeEffects = true;
  try {
    const record = owner.lastNegativeSkillEffects;
    if (record) {
      for (const replay of record.replays) replay(ctx, opponent);
      for (const [effect, version] of record.applied) {
        if (owner.abnormalVersions?.get(effect) !== version) continue;
        clearAbnormalStatus(owner, effect);
      }
      delete owner.lastNegativeSkillEffects;
      return;
    }
    // 独立异常和来自场地的负面状态也能退回。
    if (owner.status) ctx.applyStatus(opponent, owner.status, { turns: owner.statusTurns });
    if (owner.confuseTurns > 0) ctx.applyStatus(opponent, "confuse", { turns: owner.confuseTurns });
    if (owner.bindTurns > 0) ctx.applyStatus(opponent, "bind", { turns: owner.bindTurns });
    if (owner.leechSeed) ctx.applyStatus(opponent, "leech_seed");
    if (owner.poisoned) ctx.applyStatus(opponent, "poison");
    cleanseAbnormalStatuses(owner);
  } finally {
    ctx.replayingNegativeEffects = false;
  }
}

function skillEffectTarget(ctx, target, kind) {
  const action = ctx?.skillAction;
  if (!action || target === action.user) return target;
  if (target.externalEffectImmuneTurn === gameState.turnCount) {
    addMessage(battlePetName(target) + " 免疫了外来技能效果！", "status", battlePetSide(target));
    return null;
  }
  if (!action.backhand || target !== action.target) return target;
  if (target.reflectBackhand && !gameState.banEffects?.reflect) {
    if (!action.reflected) addMessage(battlePetName(target) + " 反弹了后手技能效果！", "status", battlePetSide(target));
    action.reflected = true;
    return action.user;
  }
  if (target.immuneBackhandEffects || (target.immuneBackhand && kind === "damage")) {
    addMessage(battlePetName(target) + " 免疫了后手技能效果！", "status", battlePetSide(target));
    return null;
  }
  return target;
}

function createBattleContext() {
  return {
    doDamage: function(att, def, power, cat, el, opts) {
      def = skillEffectTarget(this, def, "damage");
      if (!def) {
        this._lastEff = 1; this._lastDmg = 0;
        return { damage: 0, effectiveness: 1, isCrit: false };
      }
      opts = opts || {};
      power = getSkillPower(this.sourceSkillOwner === att ? this.sourceSkill : null, power);
      el = getEffectiveSkillElement(att, el);
      if (!(power > 0)) return { damage: 0, effectiveness: 1, isCrit: false };
      wakeFromPowerHit(def);
      if (hasPowerDamageImmunity(def)) {
        addMessage(battlePetName(def) + " 免疫了威力伤害。", "status", battlePetSide(def));
        this._lastEff = 1; this._lastDmg = 0; att.lastOutputDmg = 0;
        return { damage: 0, effectiveness: 1, isCrit: false };
      }
      var isPhysical = cat === "physical";
      var atkStat = isPhysical ? (opts.atkStageOverride ? att.atk * ((2+opts.atkStageOverride)/2) : att.getStat("atk")) : att.getStat("spatk");
      var defStat = isPhysical ? def.getStat("def") : def.getStat("spdef");
      var dmg = Math.floor(((2 * att.level / 5 + 2) * power * (atkStat / defStat)) / 50 + 2); dmg = Math.floor(dmg * (0.85 + Math.random() * 0.15));
      if (el && el === att.element) dmg = Math.floor(dmg * 1.5);
      var eff = getEffectiveness(el, def.element);
      dmg = Math.floor(dmg * eff);
      dmg = Math.floor(dmg * getWeatherDamageMod(el, def.element));
      var isCrit = false;
      var critBlocked = !!att.preventCritNext || def.bloodline?.name === "不灭魂体";
      if (cat !== "status" && !critBlocked && (opts.guaranteedCrit || Math.random() < (0.0625 + (att.critRateBonus || 0)))) {
        dmg = Math.floor(dmg * 1.5); isCrit = true;
      }
      if (att.preventCritNext) att.preventCritNext = false;
      if (att.status === "burn" && isPhysical) dmg = Math.floor(dmg * 0.5);
      dmg = Math.floor(dmg * getOutputMultiplier(att));
      // Bloodline: onBeforeDamage
      if (def.bloodline && def.bloodline.onBeforeDamage) {
        dmg = def.bloodline.onBeforeDamage(def, dmg, "power", att, this, el);
      }
      // 技能级伤害上下限（万念俱灰等）：在全部修正之后、保底 1 之前生效
      if (opts.maxDamage !== undefined) dmg = Math.min(dmg, opts.maxDamage);
      if (opts.minDamage) dmg = Math.max(dmg, opts.minDamage);
      dmg = Math.max(1, dmg);
      this._lastEff = eff; this._lastDmg = dmg;
      // 明念：每次造成伤害追加（40+15×双方强化数）固伤
      att.currentDealt += dmg;
      att.outputThisTurn = (att.outputThisTurn || 0) + dmg;
      att.lastOutputDmg = dmg;
      const received = def.takeDamage(dmg, att, this.sourceSkillOwner === att ? this.sourceSkill : null,
        (eff === 0 ? "" : getEffLabel(eff)) + (isCrit ? " 命中要害！" : ""));
      if (received > 0 && isMingnianMarked(att) && att.bloodlineData.markTarget === def && !def.isFainted()) applyMingnianDamage(this, att, def);
      return { damage: dmg, effectiveness: eff, isCrit: isCrit };
    },
    doFixedDamage: function(target, amount, source, options = {}) {
      target = skillEffectTarget(this, target, "damage");
      if (!target) return 0;
      source ||= this.sourceSkillOwner;
      amount = Math.floor(amount * (!options.scaled && source && source !== target ? getOutputMultiplier(source) : 1));
      if (amount <= 0) return 0;
      if (source && source !== target) source.outputThisTurn = (source.outputThisTurn || 0) + amount;
      // Bloodline: onBeforeDamage for fixed
      if (target.bloodline && target.bloodline.onBeforeDamage) {
        amount = target.bloodline.onBeforeDamage(target, amount, "fixed", null, this);
      }
      const sourceSkill = !options.skipMingnian && this.sourceSkillOwner === source ? this.sourceSkill : null;
      const received = target.takeDamage(amount, source, sourceSkill);
      if (received > 0 && source && !options.skipMingnian && isMingnianMarked(source) && source.bloodlineData.markTarget === target && !target.isFainted()) applyMingnianDamage(this, source, target);
      return amount;
    },
    doHeal: function(target, amount, options) {
      target = skillEffectTarget(this, target, "heal");
      if (!target) return;
      target.heal(Math.floor(amount), options);
    },
    addShield: function(target, amount) {
      const side = battlePetSide(target);
      if (gameState.banEffects?.shield) {
        addMessage(battlePetName(target) + " 无法获得护盾，护盾已被微灵封体永久限制。", "status", side);
        return;
      }
      const amt = Math.floor(amount);
      target.shield += amt;
      if (amt > 0) {
        addMessage(battlePetName(target) + " 获得 " + amt + " 点护盾（当前 " + target.shield + " 点）。", "status", side);
        battlePresentation.floatText?.(target, amt, "shield");
      }
    },
    grantStatusImmunity: grantStatusImmunity,
    revokeStatusImmunity: revokeStatusImmunity,
    applyStatus: function(pet, effect, options) {
      const record = recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.applyStatus(target, effect, options));
      const target = skillEffectTarget(this, pet, "status");
      if (!target) return false;
      const before = target.abnormalVersions?.get(effect);
      const applied = applyEffect(target, effect, options);
      const version = target.abnormalVersions?.get(effect);
      if (record && target === pet && version !== before) record.applied.set(effect, version);
      return applied;
    },
    cleanseAbnormalStatuses: function(target) {
      target = skillEffectTarget(this, target, "cleanse");
      if (target) cleanseAbnormalStatuses(target);
    },
    fear: function(target) { return this.applyStatus(target, "fear"); },
    interruptSkillContinuations: function(pet) {
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.interruptSkillContinuations(target));
      const target = skillEffectTarget(this, pet, "turn");
      if (target) interruptSkillContinuations(target);
    },
    forceClearPP: function(pet, source = this.sourceSkill?.name) {
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.forceClearPP(target));
      const target = skillEffectTarget(this, pet, "pp");
      if (!target) {
        traceBlockedPPSlots(pet, -1, "强制清空失败", source, "技能效果被免疫");
        return;
      }
      for (const skill of target.skills) setSkillPP(target, skill, 0, "强制清空 PP", source, target !== pet ? "效果被反弹" : undefined);
    },
    forceSwitchPet: function(pet) {
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.forceSwitchPet(target));
      const target = skillEffectTarget(this, pet, "switch");
      return target ? forceSwitchPet(target) : undefined;
    },
    markQinglingSeal: function(pet) {
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.markQinglingSeal(target));
      const target = skillEffectTarget(this, pet, "turn");
      if (target) target.qlSealMark = true;
    },
    resetAndLockStages: function(pet, turns) {
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.resetAndLockStages(target, turns));
      const target = skillEffectTarget(this, pet, "stat");
      if (!target) return;
      for (const key of STAGE_FIELDS) target[key] = 0;
      target.statLockedThrough = gameState.turnCount + turns - 1;
    },
    transformStages: function(pet, transform, alreadyChanged) {
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.transformStages(target, transform));
      const target = skillEffectTarget(this, pet, "stat");
      if (target && target !== alreadyChanged) for (const key of STAGE_FIELDS) target[key] = transform(target[key]);
    },
    halveRecovery: function(pet, turns) {
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.halveRecovery(target, turns));
      const target = skillEffectTarget(this, pet, "heal");
      if (target) target.dimoFrostRecoveryThrough = gameState.turnCount + turns - 1;
    },
    modifyStat: function(target, stat, stages) {
      if (stages < 0) recordAttemptedNegativeEffect(this, target, (ctx, target) => ctx.modifyStat(target, stat, stages));
      target = skillEffectTarget(this, target, "stat");
      if (!target) return;
      if (!Object.hasOwn(STAGE_LABELS, stat) || target.statLockedThrough >= gameState.turnCount) return;
      if (stages < 0 && hasStatDropImmunity(target, stat)) return;
      var key = stat + "Stage";
      if (target[key] !== undefined) {
        var before = target[key];
        target[key] = Math.max(-6, Math.min(6, target[key] + stages));
        addMessage(battlePetName(target) + " 的" + STAGE_LABELS[stat] + " " + (target[key]>=0?"+":"") + target[key] + "级（" + (before>=0?"+":"") + before + "→" + (target[key]>=0?"+":"") + target[key] + "）！", "status", battlePetSide(target));
      }
    },
    deletePP: function(pet, slot, amount, source = this.sourceSkill?.name) {
      const requested = Math.floor(amount);
      if (requested > 0) recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.deletePP(target, slot, requested));
      const target = skillEffectTarget(this, pet, "pp");
      const requestLabel = requested === Infinity ? "请求清空" : "请求删除 " + requested + " PP";
      if (!target || !(requested > 0)) {
        traceBlockedPPSlots(target || pet, slot, "删 PP 无变化", source,
          !target ? requestLabel + "，技能效果被免疫" : "计算后无 PP 可扣除");
        return [];
      }
      const changed = [];
      for (const [index, skill] of target.skills.entries()) {
        if (slot >= 0 && index !== slot) continue;
        let blocked;
        if (skill.immuneToPP) blocked = "技能免疫常规删 PP";
        else if (skill.ppLocked) blocked = "技能 PP 受到保护";
        else if (skill.pp <= 0) blocked = "PP 已空";
        else if (skill.id === "sk_jydm_1" && target.bloodlineData?.jianghuaDeleteProtectedThrough >= gameState.turnCount) blocked = "极尽降华上场保护";
        const detail = requestLabel + (target !== pet ? "，效果被反弹" : "");
        if (blocked) {
          traceSkillPP(target, skill, skill.pp, skill.pp, "删 PP 失败", source, detail + "，" + blocked);
          continue;
        }
        const amount = Math.min(skill.pp, requested);
        setSkillPP(target, skill, skill.pp - amount, "删除 PP", source,
          amount < requested && requested !== Infinity ? detail + "，剩余 PP 不足" : detail);
        changed.push({ skill, slot: index, amount });
      }
      if (changed.length > 0) {
        if (!isDeveloperBattle()) {
          const losses = changed.map(({ skill, amount }) => "「" + skill.name + "」−" + amount + " PP");
          addMessage(battlePetName(target) + " 的技能失去 PP" + (source ? "（" + ppSourceName(source) + "）" : "") + "，" + losses.join("、") + "。", "status", battlePetSide(target));
        }
        target.lastPPDeletedSkills = changed.map(result => result.skill);
        target.lastPPDeletedSkill = changed[0].skill;
        recoverFromJianghuaDeletion(target, changed);
      }
      return changed;
    },
    restorePP: function(pet, slot, amount) {
      const target = skillEffectTarget(this, pet, "pp");
      const amt = Math.floor(amount);
      if (!target) {
        const requestLabel = amt === Infinity ? "请求回满" : "请求回复 " + amt + " PP";
        traceBlockedPPSlots(pet, slot, "回 PP 失败", this.sourceSkill?.name, requestLabel + "，技能效果被免疫");
        return;
      }
      const source = this.sourceSkill?.name || this.sourceSkill?.id;
      const logSource = target === pet ? source : (source ? source + "（反弹）" : "技能效果反弹");
      if (slot < 0) target.skills.forEach(skill => gainPP(target, skill, amt, this.sourceSkill?.id, logSource));
      else gainPP(target, target.skills[slot], amt, this.sourceSkill?.id, logSource);
    },
    addMark: function(target, name, amount) { if (!target.marks[name]) target.marks[name] = 0; target.marks[name] += amount; },
    getMark: function(target, name) { return target.marks[name] || 0; },
    addTurnEffect: function(target, name, turns, onTick, onExpire) {
      target = skillEffectTarget(this, target, "turn");
      if (!target) return;
      target.turnEffects.push({ name, turnsLeft: turns, onTick, onExpire, createdTurn: gameState.turnCount || 0 });
    },
    saveSnapshot: function() {
      var make = function(party) {
        return (party || []).map(function(pet) {
          return {
            id: pet.id, hp: pet.hp,
            pp: pet.skills.map(function(s){ return s.pp; }),
            stages: STAGE_FIELDS.map(function(key) { return pet[key]; }),
            status: pet.status, statusTurns: pet.statusTurns,
            confuseTurns: pet.confuseTurns, bindTurns: pet.bindTurns, leechSeed: pet.leechSeed,
            poisoned: pet.poisoned, deepSleepToken: pet.deepSleepToken, abnormalVersions: new Map(pet.abnormalVersions)
          };
        });
      };
      gameState.snapshots.push({ turn: gameState.turnCount, player: make(gameState.playerParty), ai: make(gameState.aiParty) });
      if (gameState.snapshots.length > 30) gameState.snapshots.shift();
    },
    // 时间回溯：恢复双方全体宠物的精力/PP/强化/异常，返回回溯前后精力差
    restoreSnapshot: function(turnsBack) {
      // 快照在回合末保存，按回合号定位：当前回合 - turnsBack
      var targetTurn = (gameState.turnCount || 0) - turnsBack;
      var idx = -1;
      for (var i = gameState.snapshots.length - 1; i >= 0; i--) {
        if (gameState.snapshots[i].turn <= targetTurn) { idx = i; break; }
      }
      if (idx < 0) idx = 0;
      var snap = gameState.snapshots[idx];
      if (!snap) return 0;
      var before = 0, after = 0;
      [[gameState.playerParty, snap.player], [gameState.aiParty, snap.ai]].forEach(function(cfg) {
        var party = cfg[0] || [], saved = cfg[1] || [];
        party.forEach(function(pet) { before += pet.hp; });
        saved.forEach(function(s) { after += s.hp; });
        party.forEach(function(pet, slot) {
          var s = saved[slot];
          if (!s) return;
          pet.hp = Math.min(pet.maxHp + (pet.maxHpBonus || 0), s.hp);
          pet.skills.forEach(function(skill, i) {
            restoreHistoricalPP(pet, skill, s.pp[i], snap.turn, "逆流而行");
          });
          STAGE_FIELDS.forEach(function(k, i){ if (s.stages[i] !== undefined) pet[k] = s.stages[i]; });
          pet.status = s.status; pet.statusTurns = s.statusTurns;
          pet.confuseTurns = s.confuseTurns || 0; pet.bindTurns = s.bindTurns || 0;
          pet.leechSeed = !!s.leechSeed; pet.poisoned = !!s.poisoned; pet.deepSleepToken = s.deepSleepToken;
          pet.abnormalVersions = new Map(s.abnormalVersions);
        });
      });
      return Math.abs(after - before);
    },
    savePPState: function() {
      var make = function(party) { return (party || []).map(function(p) { return p.skills.map(function(sk) { return sk.pp; }); }); };
      var state = { turn: gameState.turnCount, player: make(gameState.playerParty), ai: make(gameState.aiParty) };
      state.total = state.player.concat(state.ai).reduce(function(sum, pps) { return sum + pps.reduce(function(a,b) { return a+b; },0); },0);
      gameState.ppHistory.push(state);
      if (gameState.ppHistory.length > 30) gameState.ppHistory.shift();
    },
    rewindPPToMin: function(turns) {
      var cutoff = gameState.turnCount - turns + 1;
      var history = gameState.ppHistory.filter(function(h) { return h.turn >= cutoff && h.turn <= gameState.turnCount; });
      // 并列时保留最早快照，此选择仅为确定性实现，尚待玩家确认。
      var lowest = history.reduce(function(a,b) { return !a || b.total < a.total ? b : a; }, null);
      if (!lowest) return;
      [[gameState.playerParty, lowest.player], [gameState.aiParty, lowest.ai]].forEach(function(pair) {
        pair[0].forEach(function(pet, i) {
          pet.skills.forEach(function(skill, j) {
            restoreHistoricalPP(pet, skill, pair[1][i]?.[j], lowest.turn, "重衍纪元");
          });
        });
      });
    },
    setDamageCap: function(pet, threshold, cap, turns) {
      if (gameState.banEffects?.damageCap) return false;
      pet.damageCapThreshold = threshold;
      pet.damageCap = cap;
      pet.damageCapTurns = turns;
      return true;
    },
    setDamageReduction: function(pet, pct, turns = 1) {
      if (gameState.banEffects?.dmgReduction) return false;
      pet.damageReduction = pct;
      pet.damageReductionTurns = turns;
      return true;
    },
    setCritPrevention: function(pet) { pet.preventCritNext = true; },
    setWeather: function(type, turns) {
      if (jianghuaBlocksSummon(this, "天气")) return false;
      const name = WEATHER_DISPLAY[type]?.[1] || type;
      if (gameState.field) {
        addMessage("场上已有" + (FIELD_DISPLAY[gameState.field]?.[1] || "其他") + "环境，无法召唤" + name + "天气。", "system");
        return false;
      }
      gameState.weather = type;
      gameState.weatherTurns = turns;
      addMessage("天气变更为" + name + "，持续 " + turns + " 回合。", "system");
      return true;
    },
    mayClearField: function() { return !(gameState.fieldLockedThrough >= gameState.turnCount); },
    setField: function(type, turns, options = {}) {
      if (jianghuaBlocksSummon(this, "环境")) return false;
      const name = FIELD_DISPLAY[type]?.[1] || type;
      if (gameState.fieldLockedThrough >= gameState.turnCount && (!options.locked || gameState.field !== type)) {
        addMessage("场上环境已锁定，无法召唤" + name + "。", "system");
        return false;
      }
      if (options.locked) {
        if (gameState.weather) addMessage("召唤" + name + "环境，清除了场上的" + (WEATHER_DISPLAY[gameState.weather]?.[1] || gameState.weather) + "天气。", "system");
        gameState.weather = null; gameState.weatherTurns = 0;
        gameState.fieldLockedThrough = gameState.turnCount + turns - 1;
      }
      gameState.field = type;
      gameState.fieldTurns = turns;
      addMessage("环境变更为" + name + "，" + (options.locked ? "锁定 " : "持续 ") + turns + " 回合。", "system");
      return true;
    },
    addCritBonus: function(target, amount, turns) { target.critRateBonus = (target.critRateBonus || 0) + amount; var self = this; setTimeout(function() { target.critRateBonus = Math.max(0, (target.critRateBonus || 0) - amount); }, turns * 1000 || 2000); },
    invertHealing: function(target, pct, turns) {
      if (pct > 0) recordAttemptedNegativeEffect(this, target, (ctx, target) => ctx.invertHealing(target, pct, turns));
      target = skillEffectTarget(this, target, "heal");
      if (!target) return;
      target.healInvertPct = pct;
      target.healInvertTurns = turns;
      addMessage(battlePetName(target) + " 获得治疗倒置效果，倒置比例为 " + Math.round(pct * 100) + "%，持续 " + turns + " 回合。", "status", battlePetSide(target));
    },
    setPPCostEffect: function(pet, source, turns, options) {
      const slot = options.skill ? pet.skills.indexOf(options.skill) : -1;
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => {
        if (slot < 0 || target.skills[slot]) {
          ctx.setPPCostEffect(target, source, turns, { ...options, skill: slot < 0 ? undefined : target.skills[slot] });
        }
      });
      const target = skillEffectTarget(this, pet, "pp");
      if (target && (slot < 0 || target.skills[slot])) {
        return setPPCostEffect(target, source, turns, { ...options, skill: slot < 0 ? undefined : target.skills[slot] });
      }
    },
    lockSwitch: function(pet, source, turns) {
      recordAttemptedNegativeEffect(this, pet, (ctx, target) => ctx.lockSwitch(target, source, turns));
      const target = skillEffectTarget(this, pet, "switch");
      if (target) (target.switchLockSources ||= new Map()).set(source, gameState.turnCount + turns - 1);
    },
    msg: function(text) {
      const owner = this.sourceSkillOwner || this.logOwner;
      if (!owner) { addMessage(text); return; }
      const skill = this.sourceSkill?.name;
      const label = battlePetName(owner) + (skill && !text.startsWith("【") && !text.includes(skill) ? " · " + skill : "");
      addMessage("【" + label + "】" + text, classifyMessage(text), battlePetSide(owner));
    },
    detail: function(text) {
      if (isDeveloperBattle()) this.msg(text);
    },
    get playerActive() { return gameState.playerActive; },
    get aiActive() { return gameState.aiActive; },
    get playerParty() { return gameState.playerParty; },
    get aiParty() { return gameState.aiParty; }
  };
}

// 测试模式记录单个技能槽的 PP 结算，普通战斗仍用原有事件说明。
function ppSourceName(source) { return DEFAULT_SKILLS.find(item => item.id === source)?.name || source; }

function traceSkillPP(pet, skill, before, after, action, source, detail, turn) {
  if (!isDeveloperBattle() || !pet) return;
  const player = gameState.playerActive === pet || gameState.playerParty.includes(pet);
  const ai = !player && (gameState.aiActive === pet || gameState.aiParty.includes(pet));
  const active = pet === gameState.playerActive || pet === gameState.aiActive;
  const position = (player ? "我方" : ai ? "对方" : "") + (player || ai ? (active ? "场上" : "场下") : "");
  const slot = pet.skills.indexOf(skill);
  const delta = after - before;
  const change = delta > 0 ? "+" + delta + " PP" : delta < 0 ? "−" + -delta + " PP" : "无变化";
  const label = source && ppSourceName(source);
  addMessage("【PP】" + position + pet.name + (slot < 0 ? "" : "第" + (slot + 1) + "格") + "「" + skill.name + "」 " +
    before + " → " + after + "（" + change + "）｜" + action +
    (label ? " · " + label : "") + (detail ? "｜" + detail : ""), "action", player ? "player" : ai ? "ai" : "system", turn);
}

function traceBlockedPPSlots(pet, slot, action, source, detail) {
  if (!isDeveloperBattle() || !pet) return;
  for (const [index, skill] of pet.skills.entries()) {
    if (slot < 0 || index === slot) traceSkillPP(pet, skill, skill.pp, skill.pp, action, source, detail);
  }
}

function restoreHistoricalPP(pet, skill, value, turn, source) {
  if (value === undefined) return;
  if (skill.ppRewindImmune) {
    traceSkillPP(pet, skill, skill.pp, skill.pp, "跳过回溯", source, "本技能 PP 不参与时间回溯");
    return;
  }
  setSkillPP(pet, skill, value, "回溯到第" + turn + "回合", source);
}

function setSkillPP(pet, skill, value, action, source, detail, turn) {
  if (skill.useLimit) {
    const remaining = Math.max(0, skill.useLimit - (skill.useCount || 0));
    if (value > remaining) {
      value = remaining;
      const limit = "本局最多使用 " + skill.useLimit + " 次，剩余 " + remaining + " 次";
      detail = detail ? detail + "，" + limit : limit;
    }
  }
  const before = skill.pp;
  skill.pp = value;
  if (before !== value || detail) traceSkillPP(pet, skill, before, value, action, source, detail, turn);
  return value - before;
}

// PP 回复封锁与技能指定来源在此判定。
function isPPRecoveryBlocked(pet) {
  return !!pet && (pet.blockPPRecovery || pet.blockPPRecoveryOnTurn === gameState.turnCount);
}

function gainPP(pet, skill, amount, sourceSkillId, logSource = sourceSkillId) {
  if (!skill) return 0;
  if (amount <= 0) {
    traceSkillPP(pet, skill, skill.pp, skill.pp, "回 PP 无变化", logSource, "计算后的回复量为 " + amount + " PP");
    return 0;
  }
  const allowed = skill.ppRecoverySource;
  let blocked;
  if (skill.id === "sk_qy_5" && pet?.bloodlineData?.qingnianChannel &&
      (sourceSkillId === "清念·翼系招式" || sourceSkillId === "清念PP回复")) {
    blocked = "清念沉脉正在等待自身结算，跳过血脉回复";
  }
  else if (isPPRecoveryBlocked(pet)) blocked = "目标本回合禁止回复 PP";
  else if (skill.noPPRecover) blocked = "技能免疫常规 PP 回复";
  else if (skill.noPPRecoverThrough >= gameState.turnCount) blocked = "技能禁回至第" + skill.noPPRecoverThrough + "回合结束";
  else if (allowed && ![allowed].flat().includes(sourceSkillId)) {
    blocked = isDeveloperBattle() ? "仅可由" + [allowed].flat().map(ppSourceName).join("、") + "回复" : "仅可由指定来源回复";
  }
  else if ((skill.id === "sk_qy_2" && pet?.bloodlineData?.qingfengSavedPP !== undefined) ||
      (skill.id === "sk_qy_3" && pet?.bloodlineData?.qy3SavedPP !== undefined)) blocked = "PP 处于封存状态";
  const requestLabel = amount === Infinity ? "请求回满" : "请求回复 " + amount + " PP";
  if (blocked) {
    traceSkillPP(pet, skill, skill.pp, skill.pp, "回 PP 失败", logSource, requestLabel + "，" + blocked);
    return 0;
  }
  const requested = amount === Infinity ? skill.maxPp - skill.pp : amount;
  const reduced = pet?.dimoFrostRecoveryThrough >= gameState.turnCount;
  const recovered = reduced ? Math.ceil(requested / 2) : requested;
  const value = Math.min(skill.maxPp, skill.pp + recovered);
  let detail = requestLabel;
  if (reduced && requested > 0) detail += "，瞬华若霜减半后为 " + recovered + " PP";
  if (skill.pp === skill.maxPp) detail += "，PP 已满";
  else if (value < skill.pp + recovered) detail += "，受最大 PP 限制";
  return setSkillPP(pet, skill, value, "回复 PP", logSource, detail);
}

