const DIMO_SKILLS = [
  { id: "sk_jydm_1", name: "极尽降华", element: "normal", power: 0, pp: 1, maxPp: 1, accuracy: 100, category: "status", priority: 15,
    ppRecoverySource: ["化念作刃清印", "瞬华若霜冰冻"], passiveLabel: "被动发动",
    desc: "使双方技能暂时变为光系，提高全场回复和输出。发动回合免疫外来效果，持续限伤并封禁原为神系的伤害来源技能。上场前三回合免删，删空可被动发动。",
    detail: "① 每次上场后的前三回合免疫删 PP。被删至 0 PP 时，若仍在场且存活，回合末被动发动并触发明念。只有化念作刃清印回首格，或瞬华若霜满足冰冻与印记条件回首格，才能回复本招 PP。\n② 双方队伍所有技能视为光系 6 回合，发动时被自身标记的目标单独持续 12 回合。6 回合内双方全队的精力回复和输出伤害各提高 100%，自身免疫异常与负面强化，场地锁定为无天气、无环境。\n③ 发动回合免疫外来的正面与负面效果，自身效果照常。对手同一只宠物在本次降华期间第 3 次尝试召唤天气或环境时受到 999 点固伤。\n④ 首次发动回满精力和其他可回复技能的 PP，后续回复量为上次的 85%。每回合累计承伤上限初始为 300 点，每次再发动降低 20 点，最低为 100 点。\n⑤ 若受到原为神水、神火或神草的技能造成的实际伤害，该来源技能下一回合无法使用。同一回合该招多段伤害只算一次封技。限伤与封技合计每触发两次，获得 1 层光明之印。",
    onUse: function(u, t, ctx) {
      const bd = mingnianData(u);
      const turn = gameState.turnCount;
      const priorCasts = bd.jianghuaCasts || 0;
      bd.jianghuaCasts = priorCasts + 1;
      bd.jianghuaThrough = turn + 5;
      bd.jianghuaCap = Math.max(100, 300 - 20 * priorCasts);
      bd.jianghuaDamage = 0;
      bd.jianghuaDamageTurn = turn;
      bd.jianghuaSummons = new Map();
      const roster = new Set([...ctx.playerParty, ...ctx.aiParty, u, t]);
      for (const pet of roster) {
        if (!pet) continue;
        setSkillElement(pet, u, "light", isMingnianMarked(u) && pet === bd.markTarget ? 12 : 6);
        pet.jianghuaGlobalThrough = Math.max(pet.jianghuaGlobalThrough ?? -1, turn + 5);
      }
      (gameState.jianghuaOwners ||= new Set()).add(u);
      gameState.weather = null; gameState.weatherTurns = 0;
      gameState.field = null; gameState.fieldTurns = 0;
      u.externalEffectImmuneTurn = turn;
      delete gameState.fieldLockedThrough;
      ctx.grantStatusImmunity(u, "极尽降华", 6, { stats: true });
      syncMingnianMaxHP(u);
      if (u.bloodline?.name === "明念") {
        const ratio = Math.pow(0.85, priorCasts);
        ctx.doHeal(u, Math.floor((u.maxHp + (u.maxHpBonus || 0)) * ratio));
        for (const skill of u.skills) gainPP(u, skill, Math.floor(skill.maxPp * ratio), "sk_jydm_1");
      }
      ctx.msg("【极尽降华】全场同调、锁定场地，当回合免疫外来效果！");
    } },
  { id: "sk_jydm_2", name: "化念作刃", element: "fighting", power: 90, pp: 9, maxPp: 9, accuracy: 100, category: "physical", priority: 11,
    desc: "先手时按对方的实际出招结算闪避。后手删对方先手招 3 PP，并施加双损。四回合内回复自身，按明念标记触发额外固伤和 PP 效果。",
    detail: "① 先手时，闪避对方后手常规非必中招式，闪避成功则本次物攻按 +2 级结算。若对方实际出招且无法闪避，倒置双方强化并删除对方各技能 2 PP。对方未出招时跳过闪避判定。\n② 后手时，删除对方本回合先手所用技能 3 PP，并使对方后续 4 回合获得双损，每次出招多消耗 1 PP。\n③ 4 回合内免疫异常与驱逐，每回合回复 30% 最大精力，并为上次被删 PP 的各技能回复 1 PP。\n④ 首段攻击标记目标时，追加（0.4 × 对方上回合输出 × 对方各项强化绝对级数之和）点固伤，自身永久免疫驱逐。光明之印少于 4 层时，对方各技能额外损失 1 PP，本次暴击则再删各 1 PP。至少 4 层时追加 999 点固伤，清除印记并回满首格，可回复极尽降华。\n⑤ 次回合与再次回合，对方技能的基础 PP 消耗翻倍，各项强化向零缩减 30%，并受到 60 点固伤。对方被标记时改为缩减 36% 并造成 72 点固伤。每回合回复自身第 2 格 1 PP，该格若是极尽降华则改回第 3 格。\n⑥ 末回合，若对方仍被标记、有至少两项负面强化且光明之印超过 2 层，追加（200 + 60% × 对方当前精力）点固伤。",
    onUse: function(u, t, ctx) {
      ctx.grantStatusImmunity(u, "化念作刃", 4, { statuses: ABNORMAL_WITHOUT_BIND });
      const through = gameState.turnCount + 3;
      u.dimoEjectImmuneThrough = Math.max(u.dimoEjectImmuneThrough ?? -1, through);
      const recover = function(p) {
        for (const skill of p.lastPPDeletedSkills || []) gainPP(p, skill, 1, "sk_jydm_2");
        ctx.doHeal(p, Math.floor((p.maxHp + (p.maxHpBonus || 0)) * 0.3));
      };
      recover(u);
      ctx.addTurnEffect(u, "化念作刃持续", 3, function(p) {
        recover(p);
        const opponent = getActiveOpponent(p);
        if (opponent && gameState.turnCount === through &&
            p.bloodlineData?.markTarget === opponent && p.bloodlineData.marks > 2 &&
            STAGE_FIELDS.filter(key => opponent[key] < 0).length >= 2) {
          ctx.doFixedDamage(opponent, 200 + Math.floor(0.6 * opponent.hp), p);
        }
      });
      ctx.setPPCostEffect(t, "化念中段", 3, { multiplier: 2 });
      ctx.addTurnEffect(u, "化念作刃削", 2, function(p) {
        const opponent = getActiveOpponent(p);
        if (!opponent) return;
        const marked = isMingnianMarked(p) && p.bloodlineData.markTarget === opponent;
        ctx.transformStages(opponent, value => Math.trunc(value * (marked ? 0.64 : 0.7)));
        const slot = p.skills[1]?.id === "sk_jydm_1" ? 2 : 1;
        gainPP(p, p.skills[slot], 1, "sk_jydm_2");
        ctx.doFixedDamage(opponent, marked ? 72 : 60, p);
      });
      const first = gameState.pendingFirstMove === (gameState.playerActive === u ? "player" : "ai");
      if (first && ctx.skillAction && gameState.resolvingTurn) {
        u.dimoPendingAttack = { target: t, ctx, action: ctx.skillAction, turn: gameState.turnCount };
      } else {
        if (!first) {
          const slot = getRoundSkillSlot(t, true);
          if (slot >= 0) ctx.deletePP(t, slot, 3);
          ctx.setPPCostEffect(t, "化念双损", 5, { extra: 1 });
        }
        dimoAttack(u, t, ctx, null);
      }
    } },
  { id: "sk_jydm_3", name: "极影光幕", element: "light", power: 0, pp: 6, maxPp: 6, accuracy: 90, category: "status", priority: 13, semiSure: true,
    desc: "回血、净化、加速并逐回合叠盾。十回合内可闪避一次致死伤害并回复全体技能 PP。对方在七回合窗口内连用同一招三回合后，该招进入三损。",
    detail: "① 回复自身 60% 最大精力，光明之印至少 2 层时回复量提高 50%。十回合内闪避一次致死伤害，闪避成功回复自身各技能 1 PP。\n② 净化自身，5 回合内免疫异常与负面强化。速度提高（5 + 自身上回合输出 ÷ 220）%，上限 10%。\n③ 4 回合内每回合获得（70 + 0.2 × 对方上回合输出 + 0.1 × 自身实际速度）点护盾，向下取整。护盾可叠加，上限为自身最大精力。若被标记目标击破护盾，清除自身异常和负面强化，之后本技能提供的护盾提高 20%。\n④ 检查发动前 3 回合、发动当回合和之后 3 回合，主动与明确计为被动的出招均计入。对方连续 3 回合使用同一个技能后，该技能之后每次使用额外消耗 2 PP。",
    onUse: function(u, t, ctx) {
      const m = mingnianData(u).marks;
      ctx.doHeal(u, Math.floor((u.maxHp + (u.maxHpBonus || 0)) * (m >= 2 ? 0.9 : 0.6)));
      u.dodgeLethalLeft = 1;
      u.dimoLethalDodgeThrough = gameState.turnCount + 9;
      ctx.cleanseAbnormalStatuses(u);
      STAGE_FIELDS.forEach(key => { if (u[key] < 0) u[key] = 0; });
      ctx.grantStatusImmunity(u, "极影光幕", 5, { stats: true });
      const speed = 1 + Math.min(10, 5 + (u.lastTurnOutput || 0) / 220) / 100;
      u.spdMod *= speed;
      ctx.addTurnEffect(u, "光幕速度", 5, null, p => p.spdMod /= speed);
      const shield = function(p) {
        const opponent = getActiveOpponent(p);
        const amount = Math.floor((70 + 0.2 * (opponent?.lastTurnOutput || 0) + 0.1 * p.getStat("spd")) *
            (p.dimoScreenShieldBoost ? 1.2 : 1));
        ctx.addShield(p, Math.max(0, Math.min(amount, p.maxHp + (p.maxHpBonus || 0) - p.shield)));
      };
      u.dimoScreenShieldThrough = gameState.turnCount + 3;
      u.dimoScreenShieldBoost = false;
      shield(u);
      ctx.addTurnEffect(u, "光幕护盾", 3, shield);
      const watched = skillEffectTarget(ctx, t, "pp");
      if (watched) {
        watched.dimoScreenWindows ||= new Map();
        watched.dimoScreenWindows.set(u, gameState.turnCount);
        applyDimoScreenCosts(watched);
      }
    } },
  { id: "sk_jydm_4", name: "瞬华若霜", element: "ice", power: 100, pp: 8, maxPp: 8, accuracy: 100, category: "physical", priority: 7,
    desc: "冰冻成功时删 PP 并减半对方回复，失败则回 PP 并倒置对方正面强化。先手非梦境时提高本招后续先手并追加两段固伤，后手追加冰冻并锁定梦境。",
    detail: "① 实际威力为（100 + 20 × 光明之印层数 + 0.05 × 自身实际速度），向下取整。\n② 冰冻成功时，删除对方各技能 1 PP。对方 2 回合内精力及 PP 回复减半，向上取整。光明之印至少 4 层时追加 9999 点固伤并回复自身各技能 2 PP，若首格为极尽降华，另为其回复 1 PP，同时自身前两格永久免删。\n③ 冰冻失败时，回复自身各技能 1 PP，并强制倒置对方的正面强化。\n④ 先手且场上不是梦境时，追加两段与本技能实际威力等量的固伤，随后两个回合本技能的基础先手提升至 +4。\n⑤ 后手追加冰冻并尝试锁定梦境 3 回合。光明之印至少 4 层时另回复自身各技能 4 PP。锁定梦境和追加回复均不依赖追加冰冻是否成功。梦境反转双方的先后判定。",
    onUse: function(u, t, ctx) {
      const m = mingnianData(u).marks;
      const power = Math.floor(100 + 20 * m + 0.05 * u.getStat("spd"));
      const first = gameState.pendingFirstMove === (gameState.playerActive === u ? "player" : "ai");
      const inDream = gameState.field === "dream";
      const r = ctx.doDamage(u, t, power, "physical", "ice");
      ctx.msg("造成 " + r.damage + " 点伤害！" + getEffLabel(r.effectiveness));
      if (ctx.applyStatus(t, "freeze")) {
        ctx.deletePP(t, -1, 1);
        ctx.halveRecovery(t, 2);
        if (m >= 4) {
          ctx.doFixedDamage(t, 9999, u);
          for (const skill of u.skills) gainPP(u, skill, 2, "sk_jydm_4");
          if (u.skills[0]?.id === "sk_jydm_1") gainPP(u, u.skills[0], 1, "瞬华若霜冰冻");
          u.skills.slice(0, 2).forEach(skill => skill.immuneToPP = true);
        }
      } else {
        for (const skill of u.skills) gainPP(u, skill, 1, "sk_jydm_4");
        ctx.transformStages(t, value => value > 0 ? -value : value);
      }
      if (first && !inDream) {
        const skill = u.skills.find(item => item.id === "sk_jydm_4");
        if (skill) skill.dimoFastThrough = gameState.turnCount + 2;
        ctx.doFixedDamage(t, power, u);
        ctx.doFixedDamage(t, power, u);
      } else if (!first) {
        ctx.applyStatus(t, "freeze");
        ctx.setField("dream", 3, { locked: true });
        if (m >= 4) for (const skill of u.skills) gainPP(u, skill, 4, "sk_jydm_4");
      }
    } },
  { id: "sk_jydm_5", name: "炽光若焰", element: "fire", power: 120, pp: 8, maxPp: 8, accuracy: 90, category: "special", priority: 9, semiSure: true, desc: "烧伤成功则追加多段固伤。失败则清空本招和对方同格技能的 PP，本招随后 12 回合禁回 PP。使用后可锁定瞬华环境。", detail: "① 实际威力等于（120 + 0.1 × 自身魔攻能力值），向下取整。烧伤成功时，追加 2–4 段固伤，每段 70–100 点。\n② 烧伤失败时，清空本招 PP，并尝试清空对方同一格技能的 PP。本招从发动起 12 个战斗回合无法回复 PP。\n③ 尝试召唤并锁定瞬华环境 4 回合。瞬华中，光系宠物速度提高 15%，先手出招的宠物回复 100 点精力。威力伤害被抵抗时，追加相当于原伤害 30% 的固伤。",
    onUse: function(u, t, ctx) {
      var power = Math.floor(120 + 0.1 * u.getStat("spatk"));
      ctx.msg(u.name + " 使用了炽光若焰！实际威力" + power + "！");
      var r = ctx.doDamage(u, t, power, "special", "fire");
      ctx.msg("造成 " + r.damage + " 点伤害！" + getEffLabel(r.effectiveness) + (r.isCrit ? " 命中要害！" : ""));
      // 烧伤效果
      if (ctx.applyStatus(t, "burn")) {
        var segs = 2 + Math.floor(Math.random() * 3); // 2~4段
        for (var i = 0; i < segs; i++) {
          ctx.doFixedDamage(t, 70 + Math.floor(Math.random() * 31));
        }
        ctx.msg("烧伤成功！追加" + segs + "段浮动固伤！");
      } else {
        var self = u.skills.find(function(s){ return s.id === "sk_jydm_5"; });
        if (self) {
          setSkillPP(u, self, 0, "清空自身 PP", "炽光若焰·烧伤失败");
          self.noPPRecoverThrough = gameState.turnCount + 11;
        }
        // R14：清空对方同格技能（不按技能 id 匹配）
        var mySlot = u.skills.findIndex(function(s){ return s.id === "sk_jydm_5"; });
        if (mySlot >= 0) ctx.deletePP(t, mySlot, Infinity);
        ctx.msg("烧伤失败：清空双方炽光若焰PP，本技能12回合内无法回复！");
      }
      // 4回合召唤锁定瞬华环境
      ctx.setField("shunhua", 4, { locked: true });
    } },
];

const DIMO_PET = { id: "pet_jydm", name: "极影迪莫", element: "light", emoji: "⚔️", level: 100,
    baseStats: { hp: 144, atk: 151, def: 130, spatk: 145, spdef: 131, spd: 137 },
    skillIds: ["sk_jydm_1", "sk_jydm_2", "sk_jydm_3", "sk_jydm_4", "sk_jydm_5"],
    bloodline: {
      name: "明念", markName: "光明之印",
      onEnter: function(pet) {
        mingnianData(pet).jianghuaDeleteProtectedThrough = gameState.turnCount + 3 - (gameState.resolvingTurn ? 1 : 0);
        syncMingnianMaxHP(pet);
      },
      onActionEnd: function(pet, target, ctx, skill) {
        if (!pet.dimoPendingAttack) advanceMingnian(pet, target, ctx, skill);
      },
      onTurnStart: function(pet, ctx) {
        const bd = mingnianData(pet);
        syncMingnianMaxHP(pet);
        if (!bd.markTarget || bd.markThrough < gameState.turnCount) {
          endMingnian(pet);
          return;
        }
        bd.markTurns = bd.markThrough - gameState.turnCount + 1;
        for (const skill of pet.skills) gainPP(pet, skill, 1, undefined, "明念·标记期间");
        ctx.msg("【明念】全体技能回复1PP，标记剩余" + (bd.markThrough - gameState.turnCount + 1) + "回合！");
      }
    }
};
