const CLOCK_SKILLS = [
  { id: "sk_cszn", name: "创世之能", element: "normal", power: 0, pp: 3, maxPp: 3, accuracy: 100, category: "status", priority: 14,
    passiveLabel: "携带被动",
    desc: "携带时免疫束缚、恐惧、睡眠和冰冻，本招无 PP 时免疫全部异常。主动发动三回合，增加速度与输出、吸取 PP，并分别结算回满精力、重置强化，末回合精力低于 30% 时回复精力并清空本招 PP。",
    detail: "① 创世神钟携带本技能时，无需出招即免疫束缚、恐惧、睡眠、冰冻。当前PP为0时，免疫所有异常状态。PP恢复后保留原有四种免疫。\n② 主动效果持续 3 回合。发动时在场的两只宠物速度各提高 10%，自身所有类型输出提高 25%。重复发动刷新效果。\n③ 首段立即发动，后两段须由自己使用其他技能带出。每次从当前在场对手的各技能最多吸取 2 PP，按实际扣除量回复自己的对应格。首回合吸取后，锁定对方所有并列最低 PP 的技能，使其出招额外消耗 1 PP。0 PP 也参与比较。\n④ 首回合回满精力，免疫对方后手施加给自身的效果。若先手，额外删除对方各技能 1 PP。\n⑤ 次回合强制清除在场双方强化，并尝试回满自身首格技能的 PP。\n⑥ 末回合自身精力低于最大精力的 30% 时，回复 70% 已损精力，并清空本招 PP。\n⑦ 免疫常规删 PP 和回 PP。时间回溯与逆流而行的强制清空可以越过对应保护。",
    immuneToPP: true, noPPRecover: true,
    onUse: function(user, target, ctx) {
      const data = user.bloodlineData ||= {};
      endCreation(user);
      const turn = gameState.turnCount;
      data.creationThrough = turn + 2;
      data.creationTarget = skillEffectTarget(ctx, target, "stat");
      data.creationActive = true;
      startSkillContinuation(user, "sk_cszn", 3, (stage, opponent) => {
        resolveCreationStage(user, opponent, stage, ctx);
      }, () => endCreation(user));
      (user.creationSpeedSources ||= new Set()).add(user);
      if (data.creationTarget) (data.creationTarget.creationSpeedSources ||= new Set()).add(user);

      user.immuneBackhandEffects = true;
      if (gameState.pendingFirstMove === (gameState.playerActive === user ? "player" : "ai")) ctx.deletePP(target, -1, 1);
      ctx.doHeal(user, user.maxHp + (user.maxHpBonus || 0) - user.hp);
      creationPP(user, target, ctx);
      if (target.skills.length) {
        const lowest = Math.min(...target.skills.map(skill => skill.pp));
        const charged = skillEffectTarget(ctx, target, "pp");
        data.creationCosts = [];
        for (const [slot, skill] of target.skills.entries()) {
          if (skill.pp !== lowest) continue;
          const source = { user, slot, skill: "创世之能" };
          ctx.setPPCostEffect(target, source, 3, { extra: 1, skill });
          if (charged) data.creationCosts.push([charged, source]);
        }
      }
      ctx.msg("创世之能发动，持续3回合！");
    }
  },
  { id: "sk_nlex", name: "逆流而行", element: "divine_water", power: 135, pp: 2, maxPp: 2, accuracy: 100, category: "physical", priority: 12,
    desc: "回溯双方全队的精力、PP、强化和异常，逆流而行的 PP 除外。按精力差追加固伤，同时为己方场下第二格回 PP。本招耗尽后自身失去属系，下一次威力招触发终结效果。",
    detail: "① 将双方全队的精力、PP、强化和异常回溯到 3 回合前，跳过双方所有逆流而行的 PP。每场战斗最多使用本招 2 次。开战不足 3 回合时回到开战初始。追加固伤等于双方全队合计精力在回溯前后的差值绝对值。\n② 回复己方仍存活的场下第二格宠物各技能 1 PP。若创世之能无 PP，则改回 2 PP。\n③ 本次使用后本招 PP 为 0 时，自身失去属系。下一次威力招结算时，按逆流而行的累计使用次数触发以下效果。\n④ 使用过 1 次时，追加 9999 点固伤，强制清空当前目标的全部技能 PP，回复自身各技能 1 PP。使用过 2 次时，回复自身各技能 3 PP 和 30% 最大精力。\n⑤ 若创世之能无 PP，清除并锁定在场双方的正负强化 6 回合。\n⑥ 本招免疫常规删 PP、回复 PP 和历史回溯。强制清空仍可作用于本招。",
    immuneToPP: true, noPPRecover: true, ppRewindImmune: true, useLimit: 2,
    onUse: function(user, target, ctx) {
      // 威力伤害
      var r = ctx.doDamage(user, target, 135, "physical", "divine_water");
      ctx.detail("计算伤害 " + r.damage + " 点。" + getEffLabel(r.effectiveness));
      const nlexSkill = user.skills.find(skill => skill.id === "sk_nlex");
      const spentLastPP = nlexSkill?.pp === 0 || (ctx.sourceSkill === nlexSkill && ctx.skillPPAfter === 0);
      // 时间回溯：双方全体宠物的精力/PP/强化/异常回到3回合前，追加精力差固伤
      var hpDiff = ctx.restoreSnapshot(3);
      if (hpDiff > 0) {
        ctx.doFixedDamage(target, hpDiff);
        ctx.detail("状态回溯追加固定伤害的计算值为 " + hpDiff + " 点。");
      }
      var party = gameState.playerActive === user ? gameState.playerParty : gameState.aiParty;
      var bench = party.filter(function(p) { return p !== user; })[1];
      var cszn = user.skills.find(function(s) { return s.id === "sk_cszn"; });
      if (bench && !bench.isFainted()) {
        var recover = cszn && cszn.pp === 0 ? 2 : 1;
        bench.skills.forEach(function(s) { gainPP(bench, s, recover, "sk_nlex"); });
        ctx.msg("场下" + bench.name + "全体技能恢复" + recover + "PP！");
      }
      // 通用出招流程已计入本次使用。
      if (!user.skillUseCounts) user.skillUseCounts = {};
      var nlexCount = ctx.sourceSkill?.useCount ?? ((user.skillUseCounts["sk_nlex"] || 0) + 1);
      // 当PP=0: 失去属系
      if (spentLastPP || nlexSkill?.pp === 0) {
        if (!user.elementLost) {
          user.elementOriginal = user.element;
          user.element = null;
          user.elementLost = true;
          ctx.msg(user.name + " 失去了属系！");
          battlePresentation.elementChanged?.(user);
        }
        // 根据使用次数记录延迟效果：下一次威力技能结算时触发
        user.pendingNilex = { cnt: nlexCount };
        ctx.msg("逆流之力积蓄：下一次威力技能将触发终结效果！");
      }
      // 若创世之能PP=0: 清除并锁定强化6回合
      if (cszn && cszn.pp === 0) {
        ctx.resetAndLockStages(user, 6);
        ctx.resetAndLockStages(target, 6);
        ctx.msg("创世之能PP=0：清除并锁定双方强化6回合！");
      }
    }
  },
  { id: "sk_mszw", name: "灭世之威", element: "fighting", power: 70, pp: 12, maxPp: 12, accuracy: 100, category: "physical", priority: 9,
    desc: "先手追加固伤和恐惧，后手必暴并删 PP。可提前结束创世之能以提高威力。满足空 PP 条件时额外造成 9999 点固伤并回复 PP。",
    detail: "① 先手追加对方最大精力 30% 的固伤，并施加恐惧。\n② 后手时必中必暴，删除对方每个技能（1 + 自身负面强化的等级绝对值之和）点 PP。威力伤害被抵抗时，额外尝试清空对方上次实际使用技能的 PP。\n③ 创世之能持续期间使用时，结束其剩余效果，本招威力提高到 170，本次物攻按 +3 级结算，并回复 200 点精力。\n④ 若创世之能无 PP，且至少 2 个技能无 PP（含创世之能），自身剩余 PP 合计少于 8，则追加 9999 点固伤，并回满自身可回复技能的 PP。",
    onUse: function(user, target, ctx) {
      var isFirst = (gameState.pendingFirstMove === (gameState.playerActive === user ? "player" : "ai"));
      var bd = user.bloodlineData;
      var inCreation = !!(bd && bd.creationActive);
      // 处于创世之能回合内：消耗剩余回合并把威力提升到 170、物攻按 +3
      if (inCreation) {
        endCreation(user);
        ctx.msg("创世之能剩余回合结束，威力提升至170，视物攻+3！");
      }
      var basePower = inCreation ? 170 : 70;
      var dmgOpts = inCreation ? { atkStageOverride: 3 } : {};
      var r;
      if (isFirst) {
        r = ctx.doDamage(user, target, basePower, "physical", "fighting", dmgOpts);
        var bonus = Math.floor(target.maxHp * 0.3);
        ctx.doFixedDamage(target, bonus);
        ctx.detail("先手计算伤害 " + r.damage + " 点，追加固定伤害的计算值为 " + bonus + " 点。");
        ctx.fear(target);
      } else {
        var backOpts = Object.assign({ guaranteedCrit: true }, dmgOpts);
        r = ctx.doDamage(user, target, basePower, "physical", "fighting", backOpts);
        var negCount = 0;
        STAGE_FIELDS.forEach(function(s) { if (user[s] < 0) negCount += Math.abs(user[s]); });
        ctx.deletePP(target, -1, 1 + negCount);
        ctx.detail("后手计算伤害 " + r.damage + " 点，尝试删除对方各技能 " + (1+negCount) + " PP。");
        if (r.effectiveness < 1) {
          var lastSlot = target.skills.findIndex(function(s) { return s.id === target.lastUsedSkillId; });
          if (lastSlot >= 0) { ctx.deletePP(target, lastSlot, target.skills[lastSlot].pp); ctx.msg("伤害被抵抗，删除对方上次使用技能PP！"); }
        }
      }
      if (inCreation) {
        ctx.doHeal(user, 200);
        ctx.detail("治疗按 200 点计算。");
      }
      // 创世之能PP=0且2技能PP=0且剩余PP<8
      var cszn = user.skills.find(function(s) { return s.id === "sk_cszn"; });
      var zeroPPSkills = user.skills.filter(function(s) { return s.pp === 0; });
      var totalPP = user.skills.reduce(function(a,s) { return a + s.pp; }, 0);
      if (cszn && cszn.pp === 0 && zeroPPSkills.length >= 2 && totalPP < 8) {
        ctx.doFixedDamage(target, 9999);
        user.skills.forEach(function(s) { gainPP(user, s, s.maxPp, "sk_mszw"); });
        ctx.msg("终焉效果触发，追加固定伤害并尝试回满各技能 PP。");
        ctx.detail("终焉追加固定伤害的计算值为 9999 点。");
      }
    }
  },
  { id: "sk_fthy", name: "覆体魂衣", element: "normal", power: 0, pp: 8, maxPp: 8, accuracy: 100, category: "status", priority: 11,
    desc: "净化、防控并提升双防，强化损失时对敌造成固伤。常规分支消耗精力换取限伤。创世之能无 PP 时改为回血、减伤和倒置治疗，天气或环境可追加回复。",
    detail: "① 常规分支消耗 15% 当前精力，最低保留 1 点。2 回合内，超过自身最大精力 15% 的单段伤害上限为 80 点。\n② 两个分支都获得 4 回合异常免疫，物防和魔防各提升 2 级，并净化自身异常、反转负面强化。\n③ 防控期间每次有强化消失，对敌造成该次等级变化的绝对值 × 80 点固伤。\n④ 若发动时有天气或环境，锁定额外回复条件，防控期间每回合回复 120 点精力和全体技能各 1 PP。\n⑤ 创世之能无 PP 时改为回复 400 点精力，1 回合减伤 70%，并倒置对方 1 回合的治疗。防控期间每回合回复自身 20% 最大精力和最低 PP 技能 1 PP，并随机将七项强化之一降低 1 级。",
    onUse: function(user, target, ctx) {
      var cszn = user.skills.find(function(s) { return s.id === "sk_cszn"; });
      var csznEmpty = cszn && cszn.pp === 0;
      if (csznEmpty) {
        // 不扣血，回复400
        ctx.doHeal(user, 400);
        ctx.setDamageReduction(user, 70);
        // 倒置对方1回合治疗
        ctx.invertHealing(target, 1.0, 1);
        ctx.msg("本回合所受伤害减少 70%。");
        ctx.detail("治疗按 400 点计算。");
        ctx.addTurnEffect(user, "覆体疗愈", 4,
          function(p) {
            ctx.doHeal(p, Math.floor(p.maxHp * 0.2));
            var lowest = p.skills.reduce(function(a,b) { return (a.pp <= b.pp) ? a : b; }, p.skills[0]);
            if (lowest) gainPP(p, lowest, 1, "sk_fthy");
            // 每回合给自身一个负面强化
            const stats = Object.keys(STAGE_LABELS);
            const rnd = stats[Math.floor(Math.random() * stats.length)];
            ctx.modifyStat(p, rnd, -1);
          }, null
        );
      } else {
        // 扣除15%当前HP
        var cost = Math.floor(user.hp * 0.15);
        if (user.hp - cost <= 0) cost = user.hp - 1; // 不会致死
        user.hp = Math.max(1, user.hp - cost);
        ctx.msg(user.name + " 消耗了" + cost + "点精力值！");
        // 2回合限伤: >15%最大HP的伤害减少至80
        ctx.setDamageCap(user, Math.floor(user.maxHp * 0.15), 80, 2);
      }
      ctx.grantStatusImmunity(user, "覆体魂衣", 4, { statuses: ABNORMAL_WITHOUT_BIND });
      user.futiThrough = gameState.turnCount + 3;
      // 物防和魔防各提升2级 + 净化 + 反转负面
      ctx.modifyStat(user, "def", 2);
      ctx.modifyStat(user, "spdef", 2);
      ctx.cleanseAbnormalStatuses(user);
      STAGE_FIELDS.forEach(function(s) {
        if (user[s] < 0) user[s] = Math.abs(user[s]);
      });
      ctx.msg(user.name + " 物防和魔防各+2，净化异常，反转负面强化！");
      // 若场上有天气/环境：防控回合内每回合回复
      if (gameState.weather || gameState.field) {
        ctx.addTurnEffect(user, "覆体天气", 4, function(p) {
          ctx.doHeal(p, 120);
          p.skills.forEach(function(s){ gainPP(p, s, 1, undefined, "覆体魂衣·场地回复"); });
          ctx.detail("覆体魂衣受天气或环境影响，治疗按 120 点计算，并尝试回复各技能 1 PP。");
        }, null);
        ctx.msg("场上存在天气/环境：防控回合内每回合回复120HP与全体1PP！");
      }
    }
  },
  { id: "sk_cyjy", name: "重衍纪元", element: "normal", power: 0, pp: 1, maxPp: 1, accuracy: 100, category: "status", priority: 1,
    passiveLabel: "携带被动",
    desc: "本招有 PP 时，自身所有输出伤害降低 40%。逆转双方全队 PP 至近 24 回合总 PP 最低的一份记录。其他技能有空 PP 时无效，后手结算后自身阵亡。",
    detail: "① 本招有 PP 时，自身造成的所有类型伤害降低 40%。本招免疫常规删 PP 和回 PP，时间回溯可恢复历史值。\n② 自身任一其他技能无 PP 时，本招无效。\n③ 从最近 24 回合中选出全场总 PP 最低的一份记录，使双方全队的技能 PP 一并回到该记录。该回溯可越过常规 PP 保护，跳过逆流而行的 PP。\n④ 先手时结算回溯后存活，后手时结算回溯后自身阵亡。",
    immuneToPP: true, noPPRecover: true,
    onUse: function(user, target, ctx) {
      // 检查是否有技能PP为空
      var hasEmpty = user.skills.some(function(s) { return s.pp === 0 && s.id !== "sk_cyjy"; });
      if (hasEmpty) {
        ctx.msg("有技能PP为空，重衍纪元无效！");
        return;
      }
      var isFirst = (gameState.pendingFirstMove === (gameState.playerActive === user ? "player" : "ai"));
      ctx.rewindPPToMin(24);
      if (isFirst) {
        ctx.msg(user.name + " 将双方全体宠物PP逆转至24回合最低！先手：自身不会死亡！");
      } else {
        user.hp = 0;
        ctx.msg(user.name + " 将双方全体宠物PP逆转至24回合最低！自身死亡！");
      }
    }
  },
];

const CLOCK_PET = { id: "pet_bmhs", name: "创世神钟", element: "normal", emoji: "🔔", level: 100,
    baseStats: { hp: 132, atk: 164, def: 172, spatk: 109, spdef: 168, spd: 139 },
    skillIds: ["sk_cszn", "sk_nlex", "sk_mszw", "sk_fthy", "sk_cyjy"],
    bloodline: {
      name: "不灭魂体",
      onBeforeDamage: function(pet, damage, type, attacker, ctx, element) {
        if (type === "fixed") {
          const inverted = Math.floor(damage * 0.3);
          createBattleContext().doHeal(pet, inverted);
          ctx.msg("【不灭魂体】将固伤的30%反转为治疗。");
          return damage - inverted;
        }
        if (type === "power" && attacker && attacker !== pet) {
          attacker.blockPPRecoveryOnTurn = gameState.turnCount + 1;
          ctx.msg("【不灭魂体】封锁攻击者下回合回复PP。");
          if (getEffectiveness(element, pet.element) >= 2) {
            ctx.msg("【不灭魂体】克制伤害降低40%！");
            return Math.floor(damage * 0.6);
          }
        }
        return damage;
      },
      onAfterDamageSegment: function(pet, segmentIndex, ctx) {
        if (pet.hp === 0 && pet.lethalHitThisTurn && (isEjectImmune(pet) || !getForcedSwitchCandidates(pet).length)) return;
        // 第n段伤害后恢复(30-4n)%已损精力
        var n = segmentIndex + 1;
        var pct = Math.max(0, 30 - 4 * n);
        if (pct > 0 && pet.hp < pet.maxHp) {
          var lost = pet.maxHp - pet.hp;
          var healAmt = Math.floor(lost * pct / 100);
          if (healAmt > 0) {
            ctx.doHeal(pet, healAmt);
            ctx.detail("【不灭魂体】第 " + n + " 段伤害后，按已损精力的 " + pct + "% 计算治疗，本次为 " + healAmt + " 点。");
          }
        }
      },
      onTurnStart: function(pet, ctx) {
        pet.bloodlineData = pet.bloodlineData || {};
        pet.bloodlineData.segmentIdx = 0;
      }
    }
};
