const QINGYU_ORIGINAL_BLOODLINE_DETAIL = "进入原初血脉状态：缺少清翎覆尘或残风临霜，或首格并非这两招之一时，自上场起永久免疫烧伤、冰冻、麻痹、中毒、睡眠、沉睡、混乱、恐惧、寄生，所受威力伤害和固定伤害降低 20%。进入清念或残脉时，原初血脉的免疫和减伤一并解除。";

const QINGYU_SKILLS = [
  { id: "sk_qy_1", ppRecoverySource: ["sk_qy_2", "清念PP回复"], noExtraPPCost: true, name: "清翎覆尘", element: "flying", power: 0, pp: 3, maxPp: 3, accuracy: 100, category: "status", priority: 15, immuneToPP: true,
    passiveLabel: "血脉联动",
    desc: "清念且清风之念至少 3 层时净化、回满精力并解除对手的回合效果。其他情况获得护盾并免疫当回合后手伤害。首用让双方技能变为各自主系，续用倒置对方治疗。",
    bloodlineDetail: "血脉联动：清羽同时携带清翎覆尘和残风临霜，且首格为清翎覆尘时，上场进入清念状态。\n" + QINGYU_ORIGINAL_BLOODLINE_DETAIL,
    detail: "① 本技能免疫删 PP 与额外 PP 消耗。轻风散魂和清念血脉的低 PP 回满可以回复本技能。\n② 清风之念不足 3 层或不在清念状态时，2 回合内每回合获得（200 + 0.4 × 已损精力）点护盾，并免疫发动当回合对方后手造成的伤害。\n③ 清念且至少 3 层时，净化自身并回满精力。每个其他技能回复其最大 PP 的 30%，向上取整。清除对方回合效果，含限时防控。自身 12 回合免疫异常与负面强化。\n④ 首次使用时，双方在场宠物的技能各自变为携带者的主系，持续（2 + 实际变系技能数 × 2）回合。清念额外倒置对方治疗 2 回合。残脉反弹对方后手施加给自身的效果。\n⑤ 后续使用按（0.3 + 已损精力比例）倒置对方治疗，持续（4 + 2 × 已损精力比例）回合，回合数四舍五入。\n⑥ 后续使用且处于清念时，若场上有非疾风天气或环境，倒置比例锁定为 0.7，持续 7 回合。疾风天气下锁定为（1.4 − 0.2 × 本技能累计使用次数），统计本次，持续 4 回合。\n⑦ 梦境中，本技能的基础先手值改为后手 −7。",
    onUse: function(u, t, ctx) {
      var bd = u.bloodlineData || {};
      var q = bd.qfzn || 0, inQ = bd.mode === "清念";
      ctx.msg(u.name + " 释放了清翎覆尘！");
      if (q < 3 || !inQ) {
        u.immuneBackhand = true;
        ctx.addTurnEffect(u, "清翎护盾", 2, function(p) {
          var cap = p.maxHp + (p.maxHpBonus || 0);
          var sh = Math.floor(200 + 0.4 * (cap - p.hp));
          ctx.addShield(p, sh);
          ctx.msg("【清翎】护盾+" + sh);
        }, null);
        ctx.msg("清风之念不足：2回合护盾并免疫后手伤害！");
      } else {
        ctx.cleanseAbnormalStatuses(u);
        STAGE_FIELDS.forEach(function(k){ if (u[k] < 0) u[k] = 0; });
        ctx.doHeal(u, (u.maxHp + (u.maxHpBonus || 0)) - u.hp);
        u.skills.forEach(function(s){ gainPP(u, s, Math.ceil(s.maxPp * 0.3), "sk_qy_1"); });
        ctx.clearTurnEffects(t);
        ctx.grantStatusImmunity(u, "清翎覆尘", 12, { stats: true });
        ctx.msg("清念：净化回满，其他技能+30%PP，清除对方回合效果，12回合免疫！");
      }
      if (!bd.qyFirstUse) {
        bd.qyFirstUse = true;
        const targets = [...new Set([u, skillEffectTarget(ctx, t, "element")].filter(Boolean))];
        const changed = targets.reduce((total, owner) =>
          total + owner.skills.filter(skill => getEffectiveSkillElement(owner, skill.element) !== owner.element).length, 0);
        const duration = 2 + changed * 2;
        targets.forEach(owner => setSkillElement(owner, "清翎同调", owner.element, duration));
        ctx.msg("首次使用：双方在场宠物的技能各视为自己的主系，持续" + duration + "回合！");
        if (inQ) ctx.invertHealing(t, 1.0, 2);
        else if (bd.mode === "残脉" && !gameState.banEffects?.reflect) u.reflectBackhand = true;
      } else {
        var cap2 = u.maxHp + (u.maxHpBonus || 0);
        var lostRatio = Math.min(1, 1 - u.hp / cap2);
        var turns = Math.round(4 + 2 * lostRatio);
        var ratio = 0.3 + lostRatio;
        if (inQ && gameState.weather === GALE_WEATHER) {
          var uses = ctx.sourceSkill?.useCount ?? ((u.skillUseCounts?.sk_qy_1 || 0) + 1);
          ratio = (7 - uses) / 5; // 1.4 - 0.2 × 使用次数，避免第二次的 1.0 出现浮点尾差。
          turns = 4;
        } else if (inQ && (gameState.weather || gameState.field)) {
          ratio = 0.7;
          turns = 7;
        }
        ctx.invertHealing(t, ratio, turns);
      }
    } },
  { id: "sk_qy_2", name: "轻风散魂", element: "flying", power: 0, pp: 8, maxPp: 8, accuracy: 100, category: "status", priority: 11, immuneToPP: true,
    desc: "按对方各招的最大 PP 比例删 PP，闪避当回合后手与下回合的常规非必中招式。清念按层数触发吸取、额外删 PP 或转残脉。残脉使用后封存本招 PP。",
    detail: "① 分别按对方各技能的最大 PP 删除（10 + 4 × 清风之念层数）%，上限 25%，向下取整。\n② 闪避对方当回合后手的常规非必中招式，以及下一回合的常规非必中招式。\n③ 先手时，等对方行动结算后回复本招 2 PP。后手时，对方各技能额外损失等同于清翎覆尘已损 PP 的点数，最少 1 点。\n④ 清念 1–2 层时，3 回合连动期间对方使用翼系技能额外消耗 1 PP，其他系额外消耗 2 PP。对在场非翼系对手，每回合吸取（50 + 0.2 × 双方速度差）点精力，向下取整。自身精力低于 60% 时，每段伤害限 150 点。\n⑤ 清念 3–4 层时，额外删除对方本回合先手所用技能的 PP。扣除量为清翎覆尘已损 PP、自身空 PP 技能数和本招已损 PP 之和，上限 7 点。\n⑥ 至少 5 层时清空清风之念，回复清翎覆尘 2 PP，转入残脉。\n⑦ 残脉下使用时，记录本次选招扣费后的剩余 PP 并清空本招，进入清念时恢复记录值。",
    onUse: function(u, t, ctx) {
      var bd = u.bloodlineData || {};
      var q = bd.qfzn || 0;
      var isFirst = (gameState.pendingFirstMove === (gameState.playerActive === u ? "player" : "ai"));
      var self = u.skills.find(function(s){ return s.id === "sk_qy_2"; });
      var ql = u.skills.find(function(s){ return s.id === "sk_qy_1"; });
      var pct = Math.min(25, 10 + 4 * q);
      t.skills.forEach((s, slot) => ctx.deletePP(t, slot, Math.floor(s.maxPp * pct / 100)));
      u.lightWindDodgeTurn = gameState.turnCount;
      ctx.msg("删除对方全体" + pct + "%PP，并闪避后手与下回合非必中技能！");
      if (isFirst) {
        const recover = () => {
          if (gainPP(u, self, 2, "sk_qy_2")) ctx.msg("先手：对方行动结算后回复本技能PP！");
        };
        if (gameState.afterActions) gameState.afterActions.push(recover);
        else recover();
      }
      else { var n = Math.max(1, ql ? ql.maxPp - ql.pp : 1); ctx.deletePP(t, -1, n); ctx.msg("后手：删除对方全体" + n + "PP！"); }
      if (bd.mode === "残脉") {
        if (self) {
          bd.qingfengSavedPP = ctx.skillPPAfter ?? self.pp;
          setSkillPP(u, self, 0, "封存 PP", "轻风散魂·残脉", "记录 " + bd.qingfengSavedPP + " PP");
        }
        ctx.msg("残脉：封存轻风散魂PP，进入清念时恢复。");
        return;
      }
      if (q >= 5) {
        bd.qfzn = 0; enterQingyuMode(u, "残脉");
        gainPP(u, ql, 2, "sk_qy_2");
        ctx.msg("层数≥5：清空清风之念，回复清翎覆尘2PP，转入残脉！");
      } else if (q >= 3) {
        var ex = Math.min(7, (ql ? ql.maxPp - ql.pp : 0) + u.skills.filter(function(s){ return s.pp === 0; }).length + (self ? self.maxPp - self.pp : 0));
        const slot = getRoundSkillSlot(t, true);
        if (slot >= 0) ctx.deletePP(t, slot, ex);
      } else if (q >= 1) {
        u.lightWindThroughTurn = gameState.turnCount + 2;
        const drain = owner => {
          const opponent = gameState.playerActive === owner ? gameState.aiActive : gameState.playerActive;
          if (!opponent || opponent.isFainted() || opponent.element === "flying") return;
          const amount = 50 + Math.floor(0.2 * Math.abs(owner.getStat("spd") - opponent.getStat("spd")));
          ctx.doFixedDamage(opponent, amount, owner);
          ctx.doHeal(owner, amount);
        };
        drain(u);
        ctx.addTurnEffect(u, "轻风连动", 2, drain);
        ctx.msg("清念1-2层：3回合连动！");
      }
    } },
  { id: "sk_qy_3", name: "残念余梦", element: "ice", power: 0, pp: 6, maxPp: 6, accuracy: 100, category: "status", priority: 7,
    desc: "尝试清场并召唤梦境，返还最近一段承伤和对手尝试施加的负面效果。先手删 PP。后手沉睡对方并锁定自身换宠。清念使用后封存本招 PP。",
    detail: "① 清除场上天气和环境，召唤梦境 1 回合。场地锁定时按场地规则结算。\n② 取最近一段实际承伤作为返还固伤的数值，并返还对手最近一次记录的负面效果尝试，包括当时未能施加的效果。\n③ 追加（0.3 × 双方速度差 × 残风临霜已损 PP × 自身空 PP 技能数）点固伤，上限 600。残脉下按（1.8 + 当前精力比例）倍计算，上限 1000。处于残脉且对方有生效的限伤时，这段追加固伤分四段。\n④ 先手额外删除对方各技能 3 PP。\n⑤ 后手使对方沉睡并锁定自身换宠。沉睡持续 1–6 回合，威力招命中也不会唤醒。只有目标阵亡或解除沉睡才解锁，目标换下后仍追踪原目标。沉睡失败时，删对方上次所用技能 3 PP，再删各技能 1 PP。\n⑥ 清念下实际出手时，记录当时的本招剩余 PP 并清空。先进入残脉、再进入清念时恢复记录值一次。",
    onUse: function(u, t, ctx) {
      var bd = u.bloodlineData || {};
      var isFirst = (gameState.pendingFirstMove === (gameState.playerActive === u ? "player" : "ai"));
      if (ctx.mayClearField() && !jianghuaBlocksSummon(ctx, "环境")) {
        gameState.weather = null; gameState.weatherTurns = 0;
        gameState.field = null; gameState.fieldTurns = 0;
        ctx.setField("dream", 1);
      }
      const returned = u.lastDamageSegment || 0;
      if (returned > 0) { ctx.doFixedDamage(t, returned, u); ctx.msg("返还最近一段所受伤害" + returned + "点！"); }
      replayNegativeEffects(u, t, ctx);
      var cf = u.skills.find(function(s){ return s.id === "sk_qy_4"; });
      var lostCf = cf ? cf.maxPp - cf.pp : 0;
      var empty = u.skills.filter(function(s){ return s.pp === 0; }).length;
      var spdDiff = Math.abs(u.getStat("spd") - t.getStat("spd"));
      var extra = Math.floor(0.3 * spdDiff * lostCf * empty);
      if (bd.mode === "残脉") extra = Math.floor(extra * (1.8 + u.hp / u.maxHp));
      extra = Math.min(bd.mode === "残脉" ? 1000 : 600, extra);
      if (extra > 0) {
        const segments = bd.mode === "残脉" && t.hasDamageCap() ? 4 : 1;
        for (let index = 0; index < segments; index++) {
          const amount = Math.floor((index + 1) * extra / segments) - Math.floor(index * extra / segments);
          if (amount > 0) ctx.doFixedDamage(t, amount, u);
        }
        ctx.msg("追加" + extra + "点固伤" + (segments === 4 ? "，分4段" : "") + "！");
      }
      if (isFirst) { ctx.deletePP(t, -1, 3); ctx.msg("先手：额外删除对方全体3PP！"); }
      else {
        if (ctx.applyStatus(t, "deep_sleep")) {
          const sleeping = skillEffectTarget(ctx, t, "status");
          u.deepSleepLock = { target: sleeping, token: sleeping.deepSleepToken };
          ctx.msg("后手：对方沉睡，自身换宠锁定！");
        } else {
          var last = t.skills.find(function(s){ return s.id === t.lastUsedSkillId; });
          if (last) ctx.deletePP(t, t.skills.indexOf(last), 3);
          ctx.deletePP(t, -1, 1);
          ctx.msg("沉睡失败：删除对方上次技能3PP与全体1PP！");
        }
      }
      if (bd.mode === "清念") {
        const self = u.skills.find(skill => skill.id === "sk_qy_3");
        if (self) {
          bd.qy3SavedPP = self.pp;
          setSkillPP(u, self, 0, "封存 PP", "残念余梦·清念", "记录 " + bd.qy3SavedPP + " PP");
        }
      }
    } },
  { id: "sk_qy_4", ppRecoverySource: "sk_qy_1", name: "残风临霜", element: "ice", power: 0, pp: 4, maxPp: 4, accuracy: 100, category: "status", priority: 12, immuneToPP: true,
    passiveLabel: "血脉联动",
    desc: "冰冻成功后尝试驱逐，新入场宠物若未能被施加睡眠，追加三段固伤。冰冻失败则删高频技能 PP，并按空 PP 技能数判定驱逐。随后减速并获得护盾。",
    bloodlineDetail: "血脉联动：清羽同时携带清翎覆尘和残风临霜，且首格为残风临霜时，上场进入残脉状态。\n" + QINGYU_ORIGINAL_BLOODLINE_DETAIL,
    detail: "① 本技能免疫常规删 PP，仅清翎覆尘能回复本招 PP。\n② 冰冻成功后尝试驱逐。成功换人时，对新入场的宠物施加睡眠。睡眠失败时才追加 999 点固伤，分三段结算。\n③ 冰冻失败时，对方累计使用超过 6 次的每个技能各损失（1 + 残风临霜剩余 PP + 0.25 × 双方速度差）点 PP，向下取整。对方至少 2 个技能无 PP 时尝试驱逐。\n④ 自身速度降低 30%，获得（20 + 0.8 × 双方速度差）×（1 + 2.5 × 已损精力比例）点护盾。\n⑤ 未携带清翎覆尘时，使用后进入残脉。",
    onUse: function(u, t, ctx) {
      var spdDiff = Math.abs(u.getStat("spd") - t.getStat("spd"));
      if (ctx.applyStatus(t, "freeze")) {
        var next = ctx.forceSwitchPet(t);
        if (next && !ctx.applyStatus(next, "sleep")) {
          for (var i = 0; i < 3; i++) ctx.doFixedDamage(next, 333, u);
          ctx.msg("睡眠失败：999固伤分3段！");
        }
      } else {
        var frost = u.skills.find(function(s) { return s.id === "sk_qy_4"; });
        var cut = Math.floor(1 + (frost ? frost.pp : 0) + 0.25 * spdDiff);
        t.skills.forEach(function(s, index) {
          if ((s.useCount || 0) > 6) ctx.deletePP(t, index, cut);
        });
        if (t.skills.filter(function(s){ return s.pp === 0; }).length >= 2) ctx.forceSwitchPet(t);
        ctx.msg("冰冻失败：按使用次数删除对方PP！");
      }
      u.spdMod = (u.spdMod || 1) * 0.7;
      ctx.addTurnEffect(u, "残风减速", 99, null, function(p){ p.spdMod = (p.spdMod || 1) / 0.7; });
      var cap = u.maxHp + (u.maxHpBonus || 0);
      var sh = Math.floor((20 + 0.8 * spdDiff) * (1 + (1 - u.hp / cap) * 2.5));
      ctx.addShield(u, sh);
      if (!u.skills.some(function(s){ return s.id === "sk_qy_1"; })) { enterQingyuMode(u, "残脉"); ctx.msg("未携带清翎覆尘：进入残脉！"); }
    } },
  { id: "sk_qy_5", name: "清念沉脉", element: "flying", power: 0, pp: 6, maxPp: 6, accuracy: 100, category: "status", priority: 11,
    desc: "清双方强化并治疗对手，自身各招回 3 PP。耗尽本招 PP 进入清念，期满按双方各自的 PP 净变化回复本招，随后四回合永久削弱对手实际用过的技能。",
    detail: "① 强制清除双方七项强化。把清除的正负等级分别取绝对值后求和，每级为对方回复 60 点精力。\n② 该次计算的治疗量低于 240 点时，额外删除对方上次所用技能 5 PP。\n③ 回复自身各技能 3 PP，然后清空本招。等待沉脉结算时，本招跳过清念翼系回 PP 与消耗清风之念回满。\n④ 进入清念，时长等于 1 加上本招实际扣费的 PP 和本招随后清空的 PP。\n⑤ 按每只在场宠物分别计算技能 PP 总量的期初和期末净变化，再对双方各自取绝对值后相加，乘 0.5 并四舍五入，期满一次回复本招。场下期间的 PP 改变不计。清羽换下暂停，重复发动时以该回合期初值重新计时和统计，提前转离清念则立即结算。\n⑥ 结算回复后开启 4 回合削弱窗口，跟随当前在场对手。对方出威力招时，按该招原始威力永久削弱 30%，累计上限 50%。出变化招时，该招先手永久减 1，本回合已排定的先后不重排。已造成的削弱持续到战斗结束。",
    onUse: function(u, t, ctx) {
      var total = 0;
      const recipient = skillEffectTarget(ctx, t, "stat");
      [...new Set([u, recipient].filter(Boolean))].forEach(function(p) { STAGE_FIELDS.forEach(function(k){ total += Math.abs(p[k] || 0); p[k] = 0; }); });
      var healAmt = total * 60;
      ctx.doHeal(t, healAmt);
      ctx.msg("清除双方强化，对敌方治疗" + healAmt + "！");
      if (healAmt < 240) { var last = t.skills.find(function(s){ return s.id === t.lastUsedSkillId; }); if (last) ctx.deletePP(t, t.skills.indexOf(last), 5); ctx.msg("治疗<240：额外删对方上次技能5PP！"); }
      u.skills.forEach(function(s){ gainPP(u, s, 3, undefined, "清念沉脉·发动"); });
      var self = u.skills.find(function(s){ return s.id === "sk_qy_5"; });
      var cp = self ? self.pp : 0;
      if (self) setSkillPP(u, self, 0, "清空自身 PP", "清念沉脉·进入清念");
      // 玩家裁定：本次常规出招消耗 + 本技能清空消耗，不计其他技能 PP。
      cp += ctx.skillPPCost || 0;
      enterQingyuMode(u, "清念");
      startQingnianChannel(u, t, 1 + cp, ctx);
      ctx.msg("进入清念" + (1 + cp) + "回合！");
    } },
];

const QINGYU_PET = { id: "pet_qy", name: "清羽", element: "flying", emoji: "🕊️", level: 100,
    baseStats: { hp: 172, atk: 0, def: 162, spatk: 0, spdef: 159, spd: 77 },
    skillIds: ["sk_qy_1", "sk_qy_2", "sk_qy_3", "sk_qy_4", "sk_qy_5"],
    bloodline: {
      name: "清念/残脉",
      onTurnStart: function(pet, ctx) {
        if (!pet.bloodlineData) pet.bloodline.onEnter(pet, ctx);
        var bd = pet.bloodlineData;
        bd.turnCount = (bd.turnCount || 0) + 1;
        bd.switchTurn = !!bd.mode && bd.turnCount % 5 === 0;
        if (!bd.mode) return;
        var opp = ctx.playerActive === pet ? ctx.aiActive : ctx.playerActive;
        if (bd.switchTurn) {
          ctx.doHeal(pet, 99);
          ctx.msg("【血脉切换期】回复99HP！使用翼系→清念 / 冰系→残脉");
          return;
        }
        if (bd.healCount >= 2) { bd.qfzn += Math.floor(bd.healCount / 2); bd.healCount = bd.healCount % 2; }
        if (bd.mode === "清念") {
          var ql = pet.skills.find(function(s) { return s.id === "sk_qy_1"; });
          var qlLost = ql ? ql.maxPp - ql.pp : 0;
          var spdDiff = opp ? Math.abs(pet.getStat("spd") - opp.getStat("spd")) : 0;
          var healAmt = Math.ceil(60 + pet.maxHp * 0.1 + bd.qfzn * 40 + 0.1 * spdDiff + qlLost * 50);
          ctx.doHeal(pet, healAmt);
          if (opp && !opp.isFainted()) ctx.doHeal(opp, healAmt);
          bd.healCount++;
          bd.qingLingLost = qlLost;

        } else if (bd.mode === "残脉") {
          if (opp && !opp.isFainted()) {
            var emptySkills = pet.skills.filter(function(s) { return s.pp === 0; }).length;
            var oppHasMit = opp.getDamageReduction() > 0 || opp.hasDamageCap();
            if (oppHasMit) {
              // 对方有减伤/限伤：改为治疗对方（0.3×上回合受伤总值 + 30 + 50×本回合使用技能次数）
              bd.residualHealingTurn = gameState.turnCount;
            } else {
              // 0.3×上回合所受最高两段伤害总值 + 50×空PP数
              var segs = (pet.lastTakenSegments || []).slice().sort(function(a, b) { return b - a; }).slice(0, 2);
              var top2 = segs.reduce(function(a, b) { return a + b; }, 0);
              var fixDmg = Math.floor(0.3 * top2 + 50 * emptySkills);
              if (fixDmg > 0) {
                ctx.doFixedDamage(opp, fixDmg, pet);
                ctx.doFixedDamage(pet, fixDmg);
                ctx.msg("【残脉】对双方各造成" + fixDmg + "固伤！");
              }
            }
          }
          // 回血改由 onAfterDamageSegment 处理（R16）
        }
      },
      // 上场钩子：按首格技能决定初始形态，并重置形态计时
      onEnter: function(pet, ctx) {
        var bd = pet.bloodlineData = pet.bloodlineData || {};
        if (bd.qingnianChannel) return;
        const mode = getQingyuStartingMode(pet);
        if (mode) enterQingyuMode(pet, mode);
        else {
          bd.mode = null;
          bd.modeEntered = false;
          setQingyuOriginalBloodline(pet, true);
        }
        bd.turnCount = 0; bd.qfzn = 0; bd.healCount = 0; bd.switchTurn = false;
        if (ctx) ctx.msg("【清羽】上场进入" + (bd.mode || "原初血脉") + "状态！");
      },
      // R16：残脉②改为每次受伤后结算（原文：每次受到伤害后）
      onAfterDamageSegment: function(pet) {
        var bd = pet.bloodlineData;
        if (!bd || bd.mode !== "残脉") return;
        if (pet.hp > 200) pet.heal(Math.floor((pet.maxHp + (pet.maxHpBonus || 0)) * 0.3));
      },
      onSkillUse: function(pet, target, ctx, skill) {
        var bd = pet.bloodlineData;
        if (!bd || !bd.mode) return;
        var opp = target;
        const element = ctx.skillElement ?? getEffectiveSkillElement(pet, skill.element);
        // 切换期判定：翼系→清念，冰系→残脉
        if (bd.switchTurn) {
          if (element === "flying") {
            enterQingyuMode(pet, "清念");
            ctx.msg("切换期使用翼系技能，进入【清念】状态！");
          }
          else if (element === "ice") { enterQingyuMode(pet, "残脉"); ctx.msg("切换期使用冰系技能，进入【残脉】状态！"); }
          bd.switchTurn = false;
        }
        // 翼系技能触发血脉效果（仅清念态）
        if (element === "flying" && bd.mode === "清念") {
          // (1) 3回合免疫异常与负面强化
          ctx.grantStatusImmunity(pet, "清念翼系", 3, { stats: true });
          ctx.msg("【清念】3回合内免疫异常与负面强化！");
          // 若技能PP<8：净化自身+回复其他技能1PP
          if (skill.pp < 8) {
            ctx.cleanseAbnormalStatuses(pet);
            STAGE_FIELDS.forEach(function(s){ if (pet[s] < 0) pet[s] = 0; });
            const source = "清念·翼系招式";
            pet.skills.forEach(function(s){ if (s.id !== "sk_qy_1") gainPP(pet, s, 1, source, source + "（" + skill.name + "）"); });
            ctx.msg("【清念】净化自身，其他技能回复1PP！");
          }
          // (2) 3回合速度-25%
          pet.spdMod = (pet.spdMod || 1) * 0.75;
          ctx.addTurnEffect(pet, "清念翼速", 3, null, function(p){ p.spdMod = (p.spdMod || 1) / 0.75; });
          // 30%减伤4回合；清翎覆尘PP=0时可叠加（最多60%）
          var ql = pet.skills.find(function(s){ return s.id === "sk_qy_1"; });
          var canStack = ql && ql.pp === 0;
          var reduction = canStack ? Math.min(60, (pet.damageReduction || 0) + 30) : Math.max(30, pet.damageReduction || 0);
          if (ctx.setDamageReduction(pet, reduction, 4)) {
            ctx.msg("【清念】速度-25%（3回合），减伤" + reduction + "%（4回合）" + (canStack?"（可叠加）":"") + "！");
          } else ctx.msg("【清念】速度-25%（3回合）！");
          // (3) 4回合每回合回复10%最大精力
          ctx.addTurnEffect(pet, "清念翼愈", 4, function(p){ ctx.doHeal(p, Math.floor(p.maxHp * 0.1)); ctx.msg("【清念】回复10%最大精力！"); }, null);
          // 对敌方治疗：0.2×双方已损精力之和
          var lostSum = (pet.maxHp - pet.hp) + (opp ? (opp.maxHp - opp.hp) : 0);
          var oppHeal = Math.ceil(0.2 * lostSum);
          if (opp && !opp.isFainted() && oppHeal > 0) { ctx.doHeal(opp, oppHeal); ctx.msg("【清念】对敌方治疗" + oppHeal + "HP！"); }
        }
        // 冰系技能触发血脉效果（仅残脉态）
        if (element === "ice" && bd.mode === "残脉") {
          // (1) 2回合免疫异常（可叠加回合数）
          var immuneTurns = ctx.grantStatusImmunity(pet, "残脉冰系", 2, { stack: true });
          ctx.msg("【冰系】2回合免疫异常（可叠加，现剩" + immuneTurns + "回合）！");
          // 若技能PP≤4：净化+回复300精力（间隔<2回合则-30%）
          if (skill.pp <= 4) {
            ctx.cleanseAbnormalStatuses(pet);
            var iceHeal = 300;
            if (pet.lastIceSkillTurn !== undefined && gameState.turnCount - pet.lastIceSkillTurn < 2) iceHeal = Math.floor(iceHeal * 0.7);
            pet.lastIceSkillTurn = gameState.turnCount;
            ctx.doHeal(pet, iceHeal);
            ctx.msg("【冰系】净化自身，回复" + iceHeal + "精力" + (iceHeal < 300 ? "（间隔惩罚-30%）" : "") + "！");
          }
          // (2) 删除对方全体1PP；技能PP=1时额外删(3+双方强化数×2)PP并清除双方强化
          ctx.deletePP(opp, -1, 1, "残脉·冰系招式");
          if (skill.pp === 1) {
            var iceStages = 0;
            [pet, opp].forEach(function(p){ if (!p) return; STAGE_FIELDS.forEach(function(k){ iceStages += Math.abs(p[k]||0); }); });
            var extraPP = 3 + iceStages * 2;
            ctx.deletePP(opp, -1, extraPP, "残脉·冰系招式额外删除");
            [pet, opp].forEach(function(p){ if (!p) return; STAGE_FIELDS.forEach(function(k){ p[k] = 0; }); });
            ctx.msg("【冰系】技能PP=1：额外删除对方" + extraPP + "PP并清除双方强化！");
          } else {
            ctx.msg("【冰系】删除对方全体技能1PP！");
          }
        }
        if (bd.mode === "清念" && skill.pp > 0 && skill.pp < skill.maxPp * 0.3) {
          const lost = skill.maxPp - skill.pp;
          const useAll = skill.pp <= skill.maxPp * 0.2 || skill.maxPp < 4;
          const marks = bd.qfzn || 0;
          const cost = useAll ? marks : Math.max(1, lost - 3);
          if (cost > 0 && marks >= cost) {
            const restored = gainPP(pet, skill, lost, "清念PP回复", "清念·低PP回满（" + skill.name + "）");
            if (restored > 0) {
              bd.qfzn = marks - cost;
              ctx.msg("【清念PP回复】" + skill.name + "回复" + restored + " PP，消耗" + cost + "层清风之念！");
            }
          }
        }
      },
      onActionEnd: function(pet) {
        const data = pet.bloodlineData;
        if (data?.residualHealingTurn !== gameState.turnCount) return;
        delete data.residualHealingTurn;
        const opponent = gameState.playerActive === pet ? gameState.aiActive : gameState.playerActive;
        if (!opponent || opponent.isFainted() || pet.isFainted()) return;
        const ice = pet.skills.find(skill => skill.id === "sk_qy_4");
        const amount = Math.ceil(0.3 * (pet.lastTakenTotal || 0) + 30 + 50 * (pet.skillsUsedThisTurn || 0));
        createBattleContext().doHeal(opponent, amount, { invertPct: pet.hp < 500 && ice && ice.pp !== 4 ? 1 : 0 });
      }
    }
};
