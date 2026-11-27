const QINGLING_SKILLS = [
  { id: "sk_ql_1", name: "微灵封体", element: "ghost", power: 0, pp: 1, maxPp: 1, accuracy: 100, category: "status", priority: 15, immuneToPP: true,
    passiveLabel: "PP保护",
    desc: "本技能免疫常规删PP。净化回满，回复自身全体技能PP（含万念俱灰）。清除在场双方的限伤、减伤、护盾与反弹，并封锁双方全队再次获得同类效果，固有能力除外。永久防控，发动起至下回合结束免疫威力伤害。留场时，后续6回合向当时在场双方赋予微灵印记。",
    detail: "本技能免疫常规 PP 删除。\n① 净化自身的异常状态与负面强化，回复全部精力。自身携带的每个技能回复（3 + 施放前当前精力 ÷ 最大精力）点 PP，向上取整。（这次回复也适用于万念俱灰）\n② 解除当前在场双方已有的限伤、减伤、护盾和反弹（含技能效果反弹与伤害反弹）。本局剩余时间内，双方队伍的所有宠物都无法再获得这四类效果。血脉与技能被动自带的固有效果仍生效。\n③ 本局永久免疫异常状态与负面强化。从发动起至下回合结束，免疫威力伤害。\n④ 后续 6 回合内，每回合按施放者当时的已损精力计算微灵印记。当前在场双方各获得（5 + 已损精力 ÷ 50）点，向上取整，每次最多 15 点。清灵离场时停止发放。",
    onUse: function(u, t, ctx) {
      ctx.msg(u.name + " 释放了微灵封体！");
      var cap = u.maxHp + (u.maxHpBonus || 0);
      var ratio = u.hp / cap;
      ctx.cleanseAbnormalStatuses(u);
      STAGE_FIELDS.forEach(function(k){ if (u[k] < 0) u[k] = 0; });
      ctx.doHeal(u, cap - u.hp);
      var ppHeal = Math.ceil(3 + ratio);
      u.skills.forEach(function(s){ gainPP(u, s, ppHeal, "sk_ql_1"); });
      ctx.msg("净化并回复全部精力，全体技能+" + ppHeal + "PP！");
      gameState.banEffects = { shield: true, dmgReduction: true, damageCap: true, reflect: true };
      [u, t].forEach(clearGrantedDefenses);
      ctx.msg("本局全局屏蔽：限伤/减伤/护盾/反弹效果！");
      ctx.grantStatusImmunity(u, "微灵封体", Infinity, { stats: true });
      u.powerDamageImmuneThroughTurn = gameState.turnCount + 1;
      ctx.msg("永久免疫异常与负面强化，威力伤害免疫持续至下回合结束！");
      ctx.addTurnEffect(u, "微灵封体印", 6, function(owner) {
        var lost = Math.max(0, owner.maxHp + (owner.maxHpBonus || 0) - owner.hp);
        var add = Math.min(15, Math.ceil(5 + lost / 50));
        for (const pet of [ctx.playerActive, ctx.aiActive]) {
          if (!pet || pet.isFainted()) continue;
          pet.bloodlineData = pet.bloodlineData || {};
          pet.bloodlineData.microLing = (pet.bloodlineData.microLing || 0) + add;
          ctx.msg("微灵封体：" + pet.name + " 获得" + add + "点微灵印记！");
        }
      });
    }
  },
  { id: "sk_ql_2", name: "万念俱灰", element: "ghost", power: 150, pp: 6, maxPp: 6, accuracy: 100, category: "physical", priority: 11, immuneToPP: true, ppRecoverySource: "sk_ql_1",
    desc: "免疫常规删 PP，仅微灵封体可回 PP。威力随本招已损 PP 和微灵印记增加，首格空 PP 时切换伤害边界。先手追加固伤并重置强化，后手治疗双方。",
    detail: "本技能免疫常规删 PP，仅微灵封体可回复本技能 PP。\n① 实际威力为本技能已损 PP ×（150 + 微灵印记数），向上取整。首格有 PP 时上限 500，首格无 PP 时上限 1000。\n② 首格有 PP 时，威力伤害上限为对方最大精力的 90%。首格无 PP 时，下限为自身最大精力的 30%。\n③ 回复 150 点精力，并获得 6 回合异常免疫。\n④ 先手追加本次威力伤害的 30% 作为固伤，并强制重置双方强化。首格无 PP 时，本次威力伤害必暴。\n⑤ 后手时，双方各回复实际威力 × 1.1 点精力，回复量无额外上限。首格无 PP 时，清空对方本回合先手所用技能的 PP。",
    onUse: function(u, t, ctx) {
      var firstZero = u.skills[0] && u.skills[0].pp <= 0;
      var isFirst = gameState.pendingFirstMove === (gameState.playerActive === u ? "player" : "ai");
      var power = getWannenPower(u);
      ctx.msg(u.name + " 使用了万念俱灰！实际威力" + power + (firstZero ? "（首格PP=0，上限1000）" : ""));
      var res = ctx.doDamage(u, t, power, "physical", "ghost", {
        guaranteedCrit: firstZero && isFirst,
        maxDamage: firstZero ? undefined : Math.floor(t.maxHp * 0.9),
        minDamage: firstZero ? Math.floor(u.maxHp * 0.3) : 0
      });
      var dealt = res.damage;
      if (firstZero) ctx.msg("首格PP=0：伤害不低于30%最大精力" + (isFirst ? "，先手必定暴击" : "") + "！");
      ctx.msg("造成 " + dealt + " 点伤害！" + getEffLabel(res.effectiveness) + (res.isCrit ? " 命中要害！" : ""));
      ctx.doHeal(u, 150);
      ctx.grantStatusImmunity(u, "万念俱灰", 6, { statuses: ABNORMAL_WITHOUT_BIND });
      ctx.msg("回复150精力，6回合内免疫异常状态！");
      if (isFirst) {
        ctx.doFixedDamage(t, Math.floor(dealt * 0.3), u);
        ctx.transformStages(u, () => 0);
        ctx.transformStages(t, () => 0);
        ctx.msg("先手：追加" + Math.floor(dealt * 0.3) + "固伤并强制重置双方强化！");
      } else {
        var healAmt = Math.floor(power * 1.1);
        ctx.doHeal(u, healAmt); ctx.doHeal(t, healAmt);
        ctx.msg("后手：双方回复" + healAmt + "精力！");
        if (firstZero) {
          const slot = getRoundSkillSlot(t, true);
          if (slot >= 0) ctx.deletePP(t, slot, t.skills[slot].pp);
        }
      }
    }
  },
  { id: "sk_ql_3", name: "封灵千噬", element: "ghost", power: 70, pp: 8, maxPp: 8, accuracy: 100, category: "special", priority: 12, semiSure: true, sureFirst: true,
    desc: "连续三回合发动。首回合免疫对方后手施加给自身的效果，先手必中必暴。次回合另加一段物理伤害，末回合回复精力和 PP，太虚灵威满 PP 时触发清空联动。",
    detail: "实际威力为 70 + 万念俱灰实时威力 × 0.2，上限 150。未携带万念俱灰时，其参与计算的威力取 150。\n【三回合】首段立即发动，后两段由自己使用其他技能带出。每段发动一次威力攻击，获得 10 点微灵印记与 100 点护盾。首格无 PP 时回复 100 点精力。自身获得异常免疫，对方使用技能额外消耗 1 PP。\n【首回合】免疫对方后手施加给自身的效果，含伤害。删除对方本回合使用技能的 1 PP，施加换下即失效的封灵印记。若先手，首段必中必暴。\n【次回合】以对方上回合总输出 × 0.6 为威力，追加一次独立的物理攻击。\n【末回合】回复自身 30% 最大精力和全体技能各 1 PP。若太虚灵威满 8 PP，随机清空对方一个可删技能的 PP，并清空太虚灵威的剩余 PP。",
    onUse: function(u, t, ctx) {
      var isFirst = (gameState.pendingFirstMove === (gameState.playerActive === u ? "player" : "ai"));
      var currentOpp = function(p){ return gameState.playerActive === p ? gameState.aiActive : gameState.playerActive; };
      var perTurn = function(owner) {
        owner.bloodlineData = owner.bloodlineData || {};
        owner.bloodlineData.microLing = (owner.bloodlineData.microLing || 0) + 10;
        ctx.addShield(owner, 100);
        var firstZero = owner.skills[0] && owner.skills[0].pp <= 0;
        if (firstZero) ctx.doHeal(owner, 100);
        ctx.msg("封灵千噬每回合：+10微灵、100护盾" + (firstZero ? "、首格PP=0回100" : "") + "！");
      };
      var strike = function(owner, guaranteedCrit = false) {
        var opp = currentOpp(owner);
        if (!opp || opp.isFainted()) return;
        const power = Math.min(150, Math.floor(70 + getWannenPower(owner) * 0.2));
        var r = ctx.doDamage(owner, opp, power, "special", "ghost", { guaranteedCrit });
        ctx.msg("封灵千噬发动！造成 " + r.damage + " 点伤害。" + (r.isCrit ? "命中要害！" : ""));
        perTurn(owner);
      };
      endSkillContinuation(u, "sk_ql_3");
      ctx.grantStatusImmunity(u, "封灵千噬", 3, { statuses: ABNORMAL_WITHOUT_BIND });
      const removeExtraCost = ctx.setPPCostEffect(t, "封灵千噬", 3, { extra: 1 });
      strike(u, isFirst);
      u.immuneBackhandEffects = true;
      const slot = getRoundSkillSlot(t);
      if (slot >= 0) ctx.deletePP(t, slot, 1);
      ctx.markQinglingSeal(t);
      ctx.msg("首回合：免疫对方后手，给予封灵印记（换下失效）！");
      startSkillContinuation(u, "sk_ql_3", 3, function(stage, opp) {
        strike(u);
        if (stage === 2) {
          var extra = Math.floor((opp.lastTurnOutput || 0) * 0.6);
          if (extra > 0 && !opp.isFainted()) {
            const hit = createBattleContext().doDamage(u, opp, extra, "physical", "ghost");
            ctx.msg("封灵千噬次回合：追加" + hit.damage + "点物理伤害。");
          }
        } else {
          ctx.doHeal(u, Math.floor((u.maxHp + (u.maxHpBonus || 0)) * 0.3));
          u.skills.forEach(function(s){ gainPP(u, s, 1, undefined, "封灵千噬·末回合"); });
          ctx.msg("封灵千噬末回合：回复30%精力与全体技能1PP！");
          var txw = u.skills.find(function(s){ return s.id === "sk_ql_4"; });
          if (txw && txw.pp === txw.maxPp) {
            var opp2 = currentOpp(u);
            var pool = opp2 ? opp2.skills.filter(function(s){ return s.pp > 0 && !s.immuneToPP && !s.ppLocked; }) : [];
            if (pool.length) {
              var victim = pool[Math.floor(Math.random() * pool.length)];
              ctx.deletePP(opp2, opp2.skills.indexOf(victim), victim.pp);
              ctx.msg("太虚灵威联动：清空对方「" + victim.name + "」的PP！");
            }
            setSkillPP(u, txw, 0, "联动清空 PP", "封灵千噬·末回合");
            ctx.msg("太虚灵威剩余PP已清空。");
          } else { ctx.msg("太虚灵威PP未满，联动未触发。"); }
        }
      }, () => {
        ctx.revokeStatusImmunity(u, "封灵千噬");
        removeExtraCost?.();
      });
    }
  },
  { id: "sk_ql_4", name: "太虚灵威", element: "ghost", power: 0, pp: 8, maxPp: 8, accuracy: 100, category: "status", priority: 9, semiSure: true, ppLocked: true,
    passiveLabel: "PP保护",
    desc: "首次成功发动前免疫常规删 PP。未命中只删对方各招 2 PP。恐惧失败时另施加双损和换宠锁。微灵达到 200 时追加删 PP 并检查空 PP 技能数。",
    detail: "PP保护：首次成功发动前，本技能PP不会被常规删PP效果扣除。发动后解除锁定。\n① 未命中：仅删除对方全体技能2PP。\n② 恐惧对方；若恐惧失败：删除对方全体技能2PP，并在3回合内令对方使用技能额外消耗1PP、无法换宠。\n③ 当微灵印记≥200：额外删除对方上次使用技能6PP；此后若双方PP为空的技能数≥4，追加9999点固定伤害。",
    onUse: function(u, t, ctx) {
      var selfSk = u.skills.find(function(s){ return s.id === "sk_ql_4"; });
      if (selfSk && selfSk.ppLocked) { selfSk.ppLocked = false; ctx.msg("太虚灵威解除PP锁定。"); }
      ctx.msg(u.name + " 释放了太虚灵威！");
      if (!ctx.applyStatus(t, "fear")) {
        ctx.deletePP(t, -1, 2);
        ctx.setPPCostEffect(t, "太虚灵威", 3, { extra: 1 });
        ctx.lockSwitch(t, "太虚灵威", 3);
        ctx.msg("恐惧失败：删对方全体2PP，3回合内对方使用额外消耗1PP且无法换宠！");
      } else { ctx.msg("太虚灵威：对方陷入恐惧！"); }
      var bd = u.bloodlineData || {};
      var ml = bd.microLing || 0;
      if (ml >= 200) {
        var oppLast = t.skills.find(function(s){ return s.id === t.lastUsedSkillId; });
        if (oppLast) { ctx.deletePP(t, t.skills.indexOf(oppLast), 6); ctx.msg("微灵≥200：删除对方上次使用技能6PP！"); }
        var emptyCount = [u, t].reduce(function(s, pt){ return s + pt.skills.filter(function(sk){ return sk.pp === 0; }).length; }, 0);
        if (emptyCount >= 4) { ctx.doFixedDamage(t, 9999, u); ctx.msg("双方PP空技能数≥4：追加9999点固定伤害！"); }
      }
    },
    onMiss: function(u, t, ctx) { ctx.deletePP(t, -1, 2); ctx.msg("太虚灵威未命中：仅删除对方全体技能2PP！"); }
  },
  { id: "sk_ql_5", name: "万古遗恨", element: "ghost", power: 20, pp: 20, maxPp: 20, accuracy: 100, category: "physical", priority: 3, immuneToPP: true,
    desc: "召唤迷雾 12 回合。成功时按万念俱灰实时威力追加固伤，失败时重置双方强化。微灵超过 300 时，按施放回合的输出差治疗下一回合的在场对手。",
    detail: "① 尝试召唤迷雾 12 回合。召唤失败时，强制重置双方强化。\n② 召唤成功时，追加万念俱灰实时威力减 20 点的固伤，最低 0 点，上限 349 点。未携带万念俱灰时，其参与计算的威力取 150。\n③ 随后以 20 威力发动攻击。\n④ 微灵印记超过 300 时，记录施放回合双方各自的总输出。下一回合按两者差值的绝对值，治疗对方届时在场的宠物。施放者换下后仍结算。",
    onUse: function(u, t, ctx) {
      ctx.msg(u.name + " 释放了万古遗恨！");
      var bd = u.bloodlineData || {};
      var wjPower = getWannenPower(u);
      var ok = ctx.setWeather("mist", 12);
      if (!ok) {
        ctx.transformStages(u, () => 0);
        ctx.transformStages(t, () => 0);
        ctx.msg("环境在场，迷雾无法降临！强制重置双方强化！");
      } else {
        var fd = Math.min(349, Math.floor(wjPower - 20));
        if (fd > 0) ctx.doFixedDamage(t, fd, u);
        ctx.msg("迷雾天气降临12回合！追加" + Math.max(0, fd) + "点固伤！");
      }
      var r = ctx.doDamage(u, t, 20, "physical", "ghost");
      ctx.msg("造成 " + r.damage + " 点伤害！");
      var ml = bd.microLing || 0;
      const healTarget = ml > 300 ? skillEffectTarget(ctx, t, "heal") : null;
      if (healTarget) {
        gameState.wanguHeals.push({
          castTurn: gameState.turnCount,
          owner: u,
          opponent: t,
          targetSide: gameState.playerActive === healTarget ? "playerActive" : "aiActive"
        });
      }
    }
  }
];

const QINGLING_PET = { id: "pet_qingling", name: "清灵", element: "ghost", emoji: "\u{1F47B}", level: 100,
    baseStats: { hp: 149, atk: 152, def: 128, spatk: 151, spdef: 129, spd: 132 },
    skillIds: ["sk_ql_1", "sk_ql_2", "sk_ql_3", "sk_ql_4", "sk_ql_5"],
    bloodline: {
      name: "清念灵体",
      onTurnStart: function(pet, ctx) {
        var bd = pet.bloodlineData = pet.bloodlineData || {};
        var dead = [gameState.playerParty, gameState.aiParty].reduce(function(s, party){ return s + party.filter(function(p){ return p.isFainted(); }).length; }, 0);
        var alive = [gameState.playerParty, gameState.aiParty].reduce(function(s, party){ return s + party.filter(function(p){ return !p.isFainted(); }).length; }, 0);
        var dr = Math.min(5 * dead, 60 - alive);
        pet.passiveDamageReduction = Math.max(0, dr);
        if (dr > 0) ctx.msg("【清念灵体】减伤" + dr + "%（阵亡" + dead + "，存活" + alive + "）！");
      },
      onSkillUse: function(pet, target, ctx, skill) {
        var bd = pet.bloodlineData = pet.bloodlineData || {};
        if (skill.category === "status") {
          ctx.doHeal(pet, 200);
          ctx.msg("【清念灵体】使用变化技：回复200精力！");
          if (skill.pp <= 4) {
            const source = "清念灵体·变化招（" + skill.name + "）";
            for (const move of pet.skills) {
              if (move.category === "physical" || move.category === "special") {
                gainPP(pet, move, 2, undefined, source);
              }
            }
            ctx.invertHealing(target, 1.0, 2);
            ctx.msg("【清念灵体】技能PP≤4：恢复威力技能2PP，倒置对方治疗2回合！");
          }
        } else {
          var isFirst = (gameState.pendingFirstMove === (gameState.playerActive === pet ? "player" : "ai"));
          if (isFirst) {
            ctx.deletePP(target, -1, 1, "清念灵体·威力招先手");
            var stages = 0;
            [pet, target].forEach(function(p){ STAGE_FIELDS.forEach(function(k){ stages += Math.abs(p[k] || 0); }); });
            var fd = 30 + stages * 20 + Math.floor(pet.maxHp * 0.08);
            ctx.doFixedDamage(target, fd, pet);
            ctx.msg("【清念灵体】威力技先手：删对方全体1PP，追加固伤" + fd + "！");
          } else {
            const healTarget = skillEffectTarget(ctx, target, "heal");
            if (healTarget) healTarget.qinglingInvertNext = true;
            const slot = getRoundSkillSlot(target, true);
            if (slot >= 0) { ctx.deletePP(target, slot, 3, "清念灵体·威力招后手"); ctx.msg("【清念灵体】威力技后手：倒置对方下个获得治疗回合的最高一段，删除对方先手技能3PP！"); }
            else ctx.msg("【清念灵体】威力技后手：倒置对方下个获得治疗回合的最高一段！");
          }
        }
      }
    }
};

function getWannenPower(pet) {
  const skill = pet.skills.find(item => item.id === "sk_ql_2");
  if (!skill) return 150;
  const spent = Math.max(0, skill.maxPp - skill.pp);
  const marks = pet.bloodlineData?.microLing || 0;
  return Math.min(pet.skills[0]?.pp === 0 ? 1000 : 500, Math.ceil(spent * (150 + marks)));
}

function resolveQinglingHealBatches() {
  const batches = gameState.qinglingHealBatches;
  gameState.qinglingHealBatches = null;
  for (const [target, segments] of batches) {
    if (target.isFainted()) continue;
    let highest = -1;
    if (target.qinglingInvertNext) {
      highest = segments.reduce((best, segment, index) =>
        best < 0 || segment.effective > segments[best].effective ? index : best, -1);
      target.qinglingInvertNext = false;
      target.qinglingInvertThrough = gameState.turnCount + 2;
    }
    segments.forEach((segment, index) => {
      if (target.isFainted()) return;
      const result = target.applyHealSegment(segment.effective, index === highest ? 1 : segment.inversion);
      if (result > 0) addMessage(target.name + " 回复了" + result + "HP");
    });
  }
}

function resolveWanguHeals() {
  const ctx = createBattleContext();
  gameState.wanguHeals = gameState.wanguHeals.filter(heal => {
    if (heal.castTurn >= gameState.turnCount) return true;
    const target = gameState[heal.targetSide];
    if (target && !target.isFainted() && heal.amount > 0) {
      ctx.doHeal(target, heal.amount);
      ctx.msg("万古遗恨：按施放回合双方输出差给予对方" + heal.amount + "点治疗。");
    }
    return false;
  });
}

function recordQinglingMatchingSkills(action, otherPet) {
  if (gameState.microLingAwarded) return;
  const opponentAction = gameState.roundActions?.get(otherPet);
  if (!opponentAction?.used) return;
  const isStatus = action.skill.category === "status";
  if (isStatus !== (opponentAction.skill.category === "status")) return;
  const toAdd = Math.max(0, action.effectivePriority + opponentAction.effectivePriority);
  if (!Number.isFinite(toAdd) || toAdd === 0) return;
  gameState.microLingAwarded = true;
  const pets = [action.user, otherPet];
  const cap = 100 + 20 * pets.reduce((total, pet) => total + pet.skills.filter(skill => skill.pp === 0).length, 0);
  for (const pet of pets) {
    if (pet.bloodline?.name !== "清念灵体") continue;
    const bloodline = pet.bloodlineData ||= {};
    const prior = bloodline.microLingFromMatches || 0;
    const added = Math.min(toAdd, Math.max(0, cap - prior));
    if (!added) continue;
    bloodline.microLingFromMatches = prior + added;
    bloodline.microLing = (bloodline.microLing || 0) + added;
    addMessage("【清念灵体】双方同用" + (isStatus ? "变化" : "威力") + "技能，" + pet.name + " 获得" + added + "点微灵印记！");
  }
}
