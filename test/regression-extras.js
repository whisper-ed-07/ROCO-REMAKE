// 补充回归：把已确认的机制行为固化为固定断言。
// 运行：node test/regression-extras.js
// 固定种子：所有随机来源（伤害浮动、暴击、睡眠回合）在每次运行中完全一致。
const assert = require('assert');
const path = require('path');
const { loadEngine } = require('./lib/harness');
const html = path.join(__dirname, '..', 'ROCO REMAKE.html');

const SEED = 20261116;
let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (err) { failed++; console.error('FAIL ' + name + ': ' + err.message); }
}
function env() {
  const e = loadEngine(html, { seed: SEED });
  for (const k of ['renderBattle', 'renderBattleActions', 'updateBattleUI', 'spawnFloatText', 'showScreen']) e.sandbox[k] = () => {};
  return e;
}
function skill(id, fn = () => {}, priority = 8, pp = 5) {
  return { id, name: id, element: 'normal', category: 'status', power: 0, accuracy: 100, priority, pp, maxPp: 5, onUse: fn };
}
function pet(e, id, s = skill('idle'), spd = 100) {
  const p = new e.api.BattlePet({ id, name: id, element: 'normal', emoji: 'X', level: 100, baseStats: { hp: 200, atk: 100, def: 100, spatk: 100, spdef: 100, spd }, skillIds: [] });
  p.skills = s ? [s] : [];
  return p;
}
function setup(e, p, a) {
  Object.assign(e.api.gameState, {
    playerActive: p, aiActive: a, playerParty: [p], aiParty: [a], battleOver: false, turnCount: 0,
    pendingPlayerSkill: 0, pendingAISkill: 0, skipPlayerAction: false, messages: [], snapshots: [], ppHistory: []
  });
}
function built(e, id, ids) { return new e.api.BattlePet({ ...e.api.findPet(id), skillIds: ids }); }
const qids = ['sk_qy_3', 'sk_qy_4', 'sk_qy_5', 'sk_qy_2'];
const jids = ['sk_jydm_2', 'sk_jydm_3', 'sk_jydm_4', 'sk_jydm_5'];

test('R11 沉脉：窗口内威力累计30%封顶50%、变化招先手永久-1，窗口结束后不再增加', () => {
  const e = env(), p = pet(e, 'owner'), a = pet(e, 'enemy');
  const power = { id: 'enemy-power', name: 'enemy-power', element: 'normal', category: 'physical', power: 100, accuracy: 100, priority: 8, pp: 30, maxPp: 30, onUse() {} };
  const status = { id: 'enemy-status', name: 'enemy-status', element: 'normal', category: 'status', power: 0, accuracy: 100, priority: 9, pp: 30, maxPp: 30, onUse() {} };
  const unused = { ...power, id: 'enemy-unused', onUse() {} };
  a.skills = [power, status, unused];
  setup(e, p, a);
  a.qingnianWindowEnd = 3; // 窗口覆盖第 1-3 回合
  const cast = (s, turn) => { e.api.gameState.turnCount = turn; e.api.executeSkillTurn(a, p, s, 'ai'); };

  cast(power, 1);
  assert.strictEqual(power.qingnianPowerLoss, 0.3, '第一次威力出招削弱30%');
  assert.strictEqual(Math.round(e.sandbox.getSkillPower(power, 100)), 70);
  cast(power, 1);
  assert.strictEqual(power.qingnianPowerLoss, 0.5, '第二次累计到上限50%');
  cast(power, 1);
  assert.strictEqual(power.qingnianPowerLoss, 0.5, '上限后不再增加');
  assert.strictEqual(Math.round(e.sandbox.getSkillPower(power, 100)), 50);

  cast(status, 1);
  assert.strictEqual(status.qingnianPriorityLoss, 1, '变化招先手永久-1');
  cast(status, 1);
  assert.strictEqual(status.qingnianPriorityLoss, 2, '变化招按出招次数累计');
  assert.strictEqual(e.sandbox.getSkillPriority(status), 7);

  cast(status, 3);
  assert.strictEqual(status.qingnianPriorityLoss, 3, '窗口最后一回合仍可削弱');
  cast(power, 3);
  assert.strictEqual(power.qingnianPowerLoss, 0.5);

  cast(power, 4);
  cast(status, 4);
  assert.strictEqual(power.qingnianPowerLoss, 0.5, '窗口结束后威力不再增加');
  assert.strictEqual(status.qingnianPriorityLoss, 3, '窗口结束后先手不再增加');
  assert.ok(!unused.qingnianPowerLoss, '未使用的技能不受影响');
});

test('R12 残念：清念态记录出招后剩余PP并清零，残脉→清念恢复一次', () => {
  const e = env(), p = built(e, 'pet_qy', qids), a = pet(e, 'a');
  setup(e, p, a);
  p.bloodlineData = { mode: '清念', turnCount: 1, qfzn: 0, healCount: 0 };
  e.api.gameState.turnCount = 1;
  const memo = p.skills[0];
  assert.strictEqual(memo.id, 'sk_qy_3');
  e.api.executeSkillTurn(p, a, memo, 'player'); // 先扣出招 PP，再记录并清零
  assert.strictEqual(p.bloodlineData.qy3SavedPP, 5, '记录的是出招扣费后的剩余 PP');
  assert.strictEqual(memo.pp, 0, '清念态清空本技能 PP');

  const ctx = e.api.createBattleContext();
  p.skills[1].onUse(p, a, ctx); // 残风临霜：未携带清翎覆尘 → 残脉
  assert.strictEqual(p.bloodlineData.mode, '残脉');
  assert.strictEqual(p.bloodlineData.qy3SavedPP, 5, '仅进入残脉不恢复');

  p.skills[2].onUse(p, a, ctx); // 清念沉脉：残脉 → 清念
  assert.strictEqual(p.bloodlineData.mode, '清念');
  assert.strictEqual(memo.pp, 5, '残脉→清念恢复记录值');
  assert.strictEqual(p.bloodlineData.qy3SavedPP, undefined, '恢复后删除记录');

  memo.pp = 0;
  p.skills[1].onUse(p, a, ctx);
  p.skills[2].onUse(p, a, ctx);
  assert.strictEqual(memo.pp, 3, '第二次循环只吃到全体+3PP，不再恢复记录值');
  assert.strictEqual(p.bloodlineData.qy3SavedPP, undefined);
});

test('R13 明念：按实际施放次数触发，四招未全部使用时不触发', () => {
  const e = env(), p = built(e, 'pet_jydm', jids), a = pet(e, 'a');
  setup(e, p, a);
  for (const s of p.skills) s.onUse = () => {};
  p.bloodlineData = { marks: 0, marked: false, markTurns: 0, used: {}, jianghuaTurns: 0 };
  e.api.gameState.turnCount = 1;
  const ctx = e.api.createBattleContext();
  const use = (i) => e.api.executeSkillTurn(p, a, p.skills[i], 'player');

  use(0); use(1); use(2);
  p.bloodline.onTurnStart(p, ctx);
  assert.strictEqual(p.bloodlineData.marked, false, '只用了三招不触发');
  assert.strictEqual(p.bloodlineData.marks, 0);

  use(0); // 重复施放同一招，使用次数增加但不补齐第四招
  assert.strictEqual(p.skillUseCounts[p.skills[0].id], 2, '实际施放次数被记录');
  p.bloodline.onTurnStart(p, ctx);
  assert.strictEqual(p.bloodlineData.marked, false, '同一技能重复使用不能补齐四招');
  assert.strictEqual(p.bloodlineData.marks, 0);

  use(3);
  p.bloodline.onTurnStart(p, ctx);
  assert.strictEqual(p.bloodlineData.marked, true, '四招各实际施放一次后触发');
  assert.strictEqual(p.bloodlineData.marks, 1);
});

test('R14 炽光失败：按格位清空对方同格技能PP', () => {
  const e = env(), p = built(e, 'pet_jydm', ['sk_jydm_2', 'sk_jydm_3', 'sk_jydm_4', 'sk_jydm_5']), a = pet(e, 'a');
  a.skills = [skill('target-slot-0'), skill('target-slot-1'), skill('target-slot-2'), skill('target-other-id')];
  a.maxHp = a.hp = 100000;
  e.api.createBattleContext().grantStatusImmunity(a, '测试防烧伤', Infinity, { statuses: ['burn'] });
  setup(e, p, a);
  const burn = p.skills[3];
  assert.strictEqual(burn.id, 'sk_jydm_5', '炽光若焰位于第 4 格');

  burn.onUse(p, a, e.api.createBattleContext());
  assert.strictEqual(a.status, null, '烧伤被免疫');
  assert.strictEqual(a.skills[3].pp, 0, '清空对方第 4 格技能（按格位，不按技能 id）');
  assert.strictEqual(a.skills[0].pp, 5, '其他格技能不受影响');
  assert.strictEqual(burn.pp, 0, '自身技能 PP 清空');
  assert.strictEqual(burn.noPPRecover, true, '本技能 12 回合内无法回复');
  const ban = p.turnEffects.find((x) => x.name === '炽光禁回');
  assert.strictEqual(ban && ban.turnsLeft, 12);
});

test('R15 逆流回溯：按 snapshot.turn 定位并恢复精力/PP/强化/异常', () => {
  const e = env(), p = pet(e, 'p'), bench = pet(e, 'bench'), a = pet(e, 'a');
  setup(e, p, a);
  const gs = e.api.gameState;
  gs.playerParty = [p, bench];
  for (const x of [p, bench, a]) { x.maxHp = 1000; x.hp = 1000; }
  const ctx = e.api.createBattleContext();

  gs.turnCount = 1;
  p.hp = 800; bench.hp = 700; a.hp = 600;
  ctx.saveSnapshot();
  gs.turnCount = 3;
  p.hp = 300; p.skills[0].pp = 2; p.atkStage = -1; p.status = 'sleep'; p.statusTurns = 3;
  bench.hp = 444; bench.skills[0].pp = 1; a.hp = 300; a.spdStage = 2;
  ctx.saveSnapshot();
  gs.turnCount = 5;
  p.hp = 100; p.skills[0].pp = 0; p.atkStage = 0; p.status = null; p.statusTurns = 0;
  bench.hp = 111; bench.skills[0].pp = 0; a.hp = 100; a.spdStage = 0;
  ctx.saveSnapshot();

  // 第 7 回合回溯 3 回合 → 目标回合 4 → 应取第 3 回合的快照（不是第 5 回合）
  gs.turnCount = 7;
  p.hp = 900; p.skills[0].pp = 4; p.atkStage = 3; p.status = null; p.statusTurns = 0;
  bench.hp = 900; bench.skills[0].pp = 4; a.hp = 900; a.spdStage = -2;
  const diff = ctx.restoreSnapshot(3);

  assert.strictEqual(p.hp, 300, '精力恢复');
  assert.strictEqual(p.skills[0].pp, 2, 'PP 恢复');
  assert.strictEqual(p.atkStage, -1, '强化恢复');
  assert.strictEqual(p.status, 'sleep', '异常恢复');
  assert.strictEqual(p.statusTurns, 3);
  assert.strictEqual(bench.hp, 444, '场下宠物一同恢复');
  assert.strictEqual(bench.skills[0].pp, 1);
  assert.strictEqual(a.hp, 300, '对方也恢复');
  assert.strictEqual(a.spdStage, 2);
  assert.strictEqual(diff, 1656, '返回回溯前后精力差的绝对值');
});

test('R16 残脉：受伤结算后回血，回合开始不回血', () => {
  const e = env(), p = built(e, 'pet_qy', ['sk_qy_4', 'sk_qy_1']), a = pet(e, 'a');
  setup(e, p, a);
  p.maxHp = p.hp = 1000;
  a.maxHp = a.hp = 1000;
  p.bloodlineData = { mode: '残脉', turnCount: 1, qfzn: 0, healCount: 0 };

  p.hp = 300;
  p.bloodline.onTurnStart(p, e.api.createBattleContext());
  assert.strictEqual(p.hp, 300, '回合开始不触发残脉②回血');

  const ctx = e.api.createBattleContext();
  ctx.doFixedDamage(p, 50, a); // 300 - 50，受伤后仍 >200
  assert.strictEqual(p.hp, 550, '受伤结算后回复30%最大精力');

  p.hp = 210;
  ctx.doFixedDamage(p, 50, a); // 210 - 50 = 160，受伤后不足 200
  assert.strictEqual(p.hp, 160, '受伤后精力不高于200时不回复');
});

test('R17 原初血脉：从上场起减免威力伤害与固伤，限时减伤不覆盖常驻值', () => {
  const e = env();
  const attacker = pet(e, 'enemy');
  const primary = built(e, 'pet_qy', ['sk_qy_1', 'sk_qy_2']);
  const both = built(e, 'pet_qy', ['sk_qy_1', 'sk_qy_4']);
  const other = built(e, 'pet_qy', ['sk_qy_4', 'sk_qy_2']);
  setup(e, primary, attacker);
  const ctx = e.api.createBattleContext();
  const fixedLoss = (target) => {
    const before = target.hp;
    ctx.doFixedDamage(target, 100, attacker);
    return before - target.hp;
  };
  assert.equal(fixedLoss(primary), 80, '回合开始前的伤害也会减免');
  assert.equal(fixedLoss(other), 80, '缺少任一核心技能均生效');
  assert.equal(fixedLoss(both), 100, '同时携带两招时不应用此项减伤');

  const before = primary.hp;
  const hit = ctx.doDamage(attacker, primary, 100, 'special', 'normal');
  assert.equal(before - primary.hp, Math.floor(hit.damage * .8), '威力伤害走相同的减免结算');

  ctx.setDamageReduction(primary, 10);
  assert.equal(fixedLoss(primary), 80, '较小的限时减伤无法压低常驻减伤');
  ctx.setDamageReduction(primary, 40);
  assert.equal(fixedLoss(primary), 60, '较高的限时减伤生效');
  e.sandbox.tickEnvironments();
  assert.equal(fixedLoss(primary), 80, '限时减伤到期后回到原初血脉的 20%');
  e.api.gameState.banEffects = { dmgReduction: true };
  assert.equal(fixedLoss(primary), 100, '全局禁减伤可封锁原初血脉减伤');
});

test('R18 残脉：识别对方清羽的原初血脉减伤', () => {
  const e = env();
  const residual = built(e, 'pet_qy', ['sk_qy_4', 'sk_qy_1']);
  const opponent = built(e, 'pet_qy', ['sk_qy_2']);
  setup(e, residual, opponent);
  const ctx = e.api.createBattleContext();
  residual.bloodline.onEnter(residual, ctx);
  residual.lastTakenSegments = [100];
  residual.lastTakenTotal = 100;
  opponent.hp = 200;
  residual.bloodline.onTurnStart(residual, ctx);
  assert.equal(opponent.hp, 260, '目标持有有效常驻减伤时改为治疗');
});

test('R19 清羽：血脉切换期只持续一回合，空过后冰系技能不迟到切形态', () => {
  const e = env();
  const p = built(e, 'pet_qy', ['sk_qy_1', 'sk_qy_4']);
  const a = pet(e, 'enemy');
  setup(e, p, a);
  const ctx = e.api.createBattleContext();
  p.bloodline.onEnter(p, ctx);
  p.bloodlineData.turnCount = 4;
  p.hp -= 150;
  const before = p.hp;
  p.bloodline.onTurnStart(p, ctx);
  assert.equal(p.hp - before, 99);
  assert.equal(p.bloodlineData.switchTurn, true);

  // 空过第 5 回合，再走下一回合的开场步骤和正常出招钩子。
  p.bloodline.onTurnStart(p, ctx);
  assert.equal(p.bloodlineData.switchTurn, false);
  p.bloodline.onSkillUse(p, a, ctx, p.skills[1]);
  assert.equal(p.bloodlineData.mode, '清念');

  p.bloodlineData.turnCount = 9;
  p.bloodline.onTurnStart(p, ctx);
  p.bloodline.onSkillUse(p, a, ctx, p.skills[1]);
  assert.equal(p.bloodlineData.mode, '残脉', '新切换期的冰系技能仍正常转换');
});

test('R20 残风临霜：冰冻失败后按自身实扣后 PP 删对手符合条件的技能', () => {
  const e = env();
  const p = built(e, 'pet_qy', ['sk_qy_1', 'sk_qy_4']);
  const a = pet(e, 'enemy');
  setup(e, p, a);
  const ctx = e.api.createBattleContext();
  p.bloodline.onEnter(p, ctx);
  a.spd = p.spd + 10;
  a.skills = [
    { ...skill('seventh-use'), pp: 8, useCount: 7 },
    { ...skill('sixth-use'), pp: 8, useCount: 6 },
    { ...skill('immune'), pp: 8, useCount: 7, immuneToPP: true },
    { ...skill('locked'), pp: 8, useCount: 7, ppLocked: true }
  ];
  ctx.grantStatusImmunity(a, '防冰冻', Infinity, { statuses: ['freeze'] });

  e.api.executeSkillTurn(p, a, p.skills[1], 'player');

  assert.equal(p.skills[1].pp, 3);
  assert.deepEqual(a.skills.map(s => s.pp), [2, 8, 8, 8], '仅扣未受保护且用过七次及以上的技能，扣除 floor(1 + 3 + 0.25 × 10)');
});

test('R21 清羽：两招齐备但首格不符，从上场进入原初血脉', () => {
  const e = env();
  const p = built(e, 'pet_qy', ['sk_qy_2', 'sk_qy_1', 'sk_qy_4']);
  const a = pet(e, 'enemy');
  setup(e, p, a);
  const ctx = e.api.createBattleContext();
  p.bloodline.onEnter(p, ctx);
  p.hp -= 100;
  const hp = p.hp;
  p.bloodlineData.turnCount = 4;
  p.bloodline.onTurnStart(p, ctx);
  assert.equal(p.bloodlineData.mode, null, '首格错误不会进入任一形态');
  assert.equal(p.bloodlineData.switchTurn, false);
  assert.equal(p.hp, hp, '原初没有清念治疗或切换期治疗');
  assert.equal(p.getDamageReduction(), 20);
  assert.equal(e.sandbox.hasStatusImmunity(p, 'freeze'), true);
});

test('R22 清羽：技能进入清念或残脉时同步撤掉原初的两个效果', () => {
  for (const [ids, trigger, mode] of [
    [['sk_qy_5', 'sk_qy_1', 'sk_qy_4'], 'sk_qy_5', '清念'],
    [['sk_qy_4'], 'sk_qy_4', '残脉']
  ]) {
    const e = env();
    const p = built(e, 'pet_qy', ids);
    const a = pet(e, 'enemy');
    setup(e, p, a);
    const ctx = e.api.createBattleContext();
    p.bloodline.onEnter(p, ctx);
    ctx.grantStatusImmunity(p, '独立防控', 3, { statuses: ['sleep'] });
    assert.equal(p.statusImmunitySources.has('清羽原初血脉'), true);
    assert.equal(p.passiveDamageReduction, 20);

    e.api.executeSkillTurn(p, a, p.skills.find(skill => skill.id === trigger), 'player');

    assert.equal(p.bloodlineData.mode, mode);
    assert.equal(p.statusImmunitySources.has('清羽原初血脉'), false);
    assert.equal(p.passiveDamageReduction, 0);
    assert.equal(p.statusImmunitySources.has('独立防控'), true);
    assert.equal(e.sandbox.hasStatusImmunity(p, 'sleep'), true);

    p.bloodline.onEnter(p, ctx);
    assert.equal(p.bloodlineData.mode, null, '重新上场重新判定首格');
    assert.equal(p.statusImmunitySources.has('清羽原初血脉'), true);
    assert.equal(p.passiveDamageReduction, 20);
  }
});

test('R23 残风临霜：驱逐遵守免疫，并将睡眠失败的三段固伤结算给实际入场者', () => {
  for (const immune of [true, false]) {
    const e = env();
    const p = built(e, 'pet_qy', ['sk_qy_4', 'sk_qy_1']);
    const a = pet(e, 'enemy');
    const first = pet(e, 'first');
    const fainted = pet(e, 'fainted');
    const last = pet(e, 'last');
    setup(e, p, a);
    const ctx = e.api.createBattleContext();
    e.myMath.random = () => .99;
    fainted.hp = 0;
    last.maxHp = last.hp = 2000;
    last.bloodline = { onEnter() { last.entered = true; } };
    a.immuneEject = immune;
    e.api.gameState.aiParty = [a, first, fainted, last];
    ctx.grantStatusImmunity(last, '防睡眠', Infinity, { statuses: ['sleep'] });

    p.skills[0].onUse(p, a, ctx);

    assert.equal(a.status, 'freeze');
    assert.equal(first.status, null, '其他候补不受影响');
    if (immune) {
      assert.equal(e.api.gameState.aiActive, a);
      assert.equal(last.hp, 2000);
      assert.equal(last.entered, undefined);
    } else {
      assert.equal(e.api.gameState.aiActive, last, '随机候选排除濒死宠物');
      assert.equal(last.entered, true, '统一进场钩子');
      assert.deepEqual(Array.from(last.damageTakenThisTurn), [333, 333, 333]);
      assert.equal(last.hp, 1001);
      assert.equal(p.outputThisTurn, 999);
    }
  }
});

console.log('\n汇总：' + passed + ' 通过 / ' + failed + ' 失败（共 ' + (passed + failed) + ' 条）');
if (failed) process.exitCode = 1;
