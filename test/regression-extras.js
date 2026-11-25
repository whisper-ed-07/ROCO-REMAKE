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
  assert.strictEqual(p.bloodlineData.marks, 0);
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
  assert.equal(fixedLoss(primary), 80, '全局封锁期间保留原初血脉的固有减伤');
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
  assert.equal(opponent.hp, 200, '开场不提前治疗');
  const action = skill('noop-action');
  residual.skills.push(action);
  e.api.executeSkillTurn(residual, opponent, action, 'player');
  assert.equal(opponent.hp, 310, '目标持有有效常驻减伤时改为治疗');
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

    delete p.bloodlineData.qingnianChannel;
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

test('R24 清翎覆尘：初次保留原分支，后续按清念及天气环境确定倒置', () => {
  for (const [weather, field, mode, ratio, turns] of [
    ['rainy', null, '清念', 0.7, 7],
    [null, 'dream', '清念', 0.7, 7],
    [null, null, '清念', 0.8, 5],
    ['gale', null, '残脉', 0.8, 5],
    ['gale', null, null, 0.8, 5]
  ]) {
    const e = env(), p = built(e, 'pet_qy', ['sk_qy_1', 'sk_qy_4']), a = pet(e, 'enemy');
    setup(e, p, a);
    const ctx = e.api.createBattleContext();
    p.bloodline.onEnter(p, ctx);
    if (mode) e.sandbox.enterQingyuMode(p, mode);
    else p.bloodlineData.mode = null;
    p.maxHp = 1000;
    p.hp = 500;
    if (weather) ctx.setWeather(weather, 1);
    if (field) ctx.setField(field, 1);

    e.api.executeSkillTurn(p, a, p.skills[0], 'player');
    assert.equal(a.healInvertPct, mode === '清念' ? 1 : 0);
    assert.equal(a.healInvertTurns, mode === '清念' ? 2 : 0);

    e.api.executeSkillTurn(p, a, p.skills[0], 'player');
    assert.equal(a.healInvertPct, ratio);
    assert.equal(a.healInvertTurns, turns);
    e.sandbox.tickEnvironments();
    assert.equal(e.api.gameState.weather, null);
    assert.equal(e.api.gameState.field, null);
    assert.equal(a.healInvertPct, ratio, '天气或环境结束后沿用施放时锁定的比例');
    assert.equal(a.healInvertTurns, turns - 1);
    if (ratio === 0.7) {
      a.hp = 300;
      assert.equal(a.heal(100), -40, '原本100点治疗，70点倒置且剩余30点照常回复');
    }
    for (let i = 1; i < turns; i++) e.sandbox.tickEnvironments();
    a.hp = 300;
    assert.equal(a.heal(100), 100, '倒置到期后恢复普通治疗');
  }
});

test('R25 清翎覆尘：疾风优先，使用次数包含本次，比例为零或负时照常治疗', () => {
  const e = env(), p = built(e, 'pet_qy', ['sk_qy_1', 'sk_qy_4']), a = pet(e, 'enemy');
  setup(e, p, a);
  const ctx = e.api.createBattleContext();
  p.bloodline.onEnter(p, ctx);
  assert.equal(ctx.setWeather('gale', 10), true);
  ctx.setField('dream', 10);
  assert.ok(e.api.gameState.messages.some(msg => msg.text.includes('天气变更为疾风')));

  const qingling = p.skills[0];
  for (const [index, expected] of [1, 1, 0.8, 0.6, 0.4, 0.2, 0, -0.2].entries()) {
    qingling.pp = qingling.maxPp;
    e.api.executeSkillTurn(p, a, qingling, 'player');
    assert.equal(qingling.useCount, index + 1);
    assert.equal(a.healInvertPct, expected);
    assert.equal(a.healInvertTurns, index === 0 ? 2 : 4);
    a.hp = 300;
    if (index <= 1) assert.equal(a.heal(100), -100, '前两次应精确倒置全部治疗');
    if (expected <= 0) assert.equal(a.heal(100), 100);
  }
});

test('微灵封体只用自己的 PP 回复例外，万念俱灰仍受禁回 PP 约束', () => {
  for (const recoveryBlocked of [false, true]) {
    const e = env();
    const p = built(e, 'pet_qingling', ['sk_ql_1', 'sk_ql_2']);
    const a = pet(e, 'enemy');
    const [seal, wannen] = p.skills;
    setup(e, p, a);
    const ctx = e.api.createBattleContext();
    p.hp = 250;
    wannen.pp = 1;

    assert.equal(e.sandbox.gainPP(p, wannen, 2), 0);
    assert.equal(e.sandbox.gainPP(p, wannen, 2, 'sk_ql_3'), 0);
    ctx.deletePP(p, 0, 1);
    assert.equal(seal.pp, 1);

    p.blockPPRecovery = recoveryBlocked;
    e.api.executeSkillTurn(p, a, seal, 'player');
    assert.equal(wannen.pp, recoveryBlocked ? 1 : 5);
    assert.equal(seal.pp, recoveryBlocked ? 0 : 1);
  }
});

test('微灵封体发放给在场双方，施放者离场后终止', () => {
  const e = env();
  const qingling = built(e, 'pet_qingling', ['sk_ql_1']);
  const original = pet(e, 'original');
  const next = pet(e, 'next');
  const ally = pet(e, 'ally');
  setup(e, qingling, original);
  const game = e.api.gameState;
  game.aiParty.push(next);
  game.playerParty.push(ally);
  e.api.executeSkillTurn(qingling, original, qingling.skills[0], 'player');
  e.sandbox.executeSwitchAction({ user: original, incoming: next }, 'ai');

  qingling.hp -= 60;
  game.turnCount++;
  e.sandbox.processTurnEffects(qingling);
  assert.equal(qingling.bloodlineData.microLing, 7);
  assert.equal(next.bloodlineData.microLing, 7);
  assert.equal(original.bloodlineData?.microLing ?? 0, 0);

  e.sandbox.executeSwitchAction({ user: qingling, incoming: ally }, 'player');
  e.sandbox.executeSwitchAction({ user: ally, incoming: qingling }, 'player');
  game.turnCount++;
  e.sandbox.processTurnEffects(qingling);
  assert.equal(qingling.bloodlineData.microLing, 7);
  assert.equal(next.bloodlineData.microLing, 7);
});

test('微灵封体封锁获得的防御，保留血脉的固有减伤', () => {
  const e = env();
  const qingling = built(e, 'pet_qingling', ['sk_ql_1']);
  const opponent = pet(e, 'opponent');
  const incoming = built(e, 'pet_qy', ['sk_qy_1']);
  setup(e, qingling, opponent);
  e.api.gameState.aiParty.push(incoming);
  const ctx = e.api.createBattleContext();
  ctx.addShield(incoming, 70);
  ctx.setDamageCap(incoming, 0, 50, 4);
  ctx.setDamageReduction(incoming, 60, 4);
  incoming.reflectBackhand = true;

  e.api.executeSkillTurn(qingling, opponent, qingling.skills[0], 'player');
  e.sandbox.executeSwitchAction({ user: opponent, incoming }, 'ai');
  assert.equal(incoming.shield, 0);
  assert.equal(incoming.hasDamageCap(), false);
  assert.equal(incoming.reflectBackhand, false);
  assert.equal(incoming.getDamageReduction(), 20);
  assert.equal(ctx.setDamageReduction(incoming, 70, 4), false);
  assert.equal(ctx.setDamageCap(incoming, 0, 50, 4), false);
  ctx.addShield(incoming, 70);
  assert.equal(incoming.shield, 0);
});

test('轻风散魂在残脉封存选招扣费后的 PP，再进清念恢复一次', () => {
  const e = env();
  const p = built(e, 'pet_qy', ['sk_qy_4', 'sk_qy_1', 'sk_qy_2']);
  const a = pet(e, 'enemy');
  setup(e, p, a);
  p.bloodline.onEnter(p, e.api.createBattleContext());
  const lightWind = p.skills[2];
  lightWind.pp = 6;
  const action = e.sandbox.reserveSkillAction(p, lightWind);
  lightWind.pp -= 2;
  e.api.executeSkillTurn(p, a, lightWind, 'player', action);
  assert.equal(lightWind.pp, 0);
  assert.equal(e.sandbox.gainPP(p, lightWind, 3), 0);
  e.sandbox.enterQingyuMode(p, '清念');
  assert.equal(lightWind.pp, 5);
  lightWind.pp--;
  e.sandbox.enterQingyuMode(p, '清念');
  assert.equal(lightWind.pp, 4);
});

test('清翎与残风按裁定校验回复来源，清念只可回满清翎', () => {
  const e = env();
  const p = built(e, 'pet_qy', ['sk_qy_1', 'sk_qy_4', 'sk_qy_2']);
  const a = pet(e, 'enemy');
  setup(e, p, a);
  const ctx = e.api.createBattleContext();
  p.bloodline.onEnter(p, ctx);
  const [qingling, residualWind] = p.skills;
  qingling.pp = 0;
  residualWind.pp = 0;
  assert.equal(e.sandbox.gainPP(p, qingling, 3), 0);
  assert.equal(e.sandbox.gainPP(p, residualWind, 4, '清念PP回复'), 0);
  p.bloodlineData.qfzn = 4;
  p.bloodline.onSkillUse(p, a, ctx, qingling);
  assert.equal(qingling.pp, 3);
  assert.equal(residualWind.pp, 0);
  p.bloodlineData.qfzn = 3;
  e.api.executeSkillTurn(p, a, qingling, 'player');
  assert.equal(residualWind.pp, 2);
  qingling.pp = 0;
  assert.equal(e.sandbox.gainPP(p, qingling, 2, 'sk_qy_2'), 2);
});

test('清翎首次变系各按携带者主系，仅实际变系计入持续期', () => {
  const e = env();
  const p = built(e, 'pet_qy', ['sk_qy_1', 'sk_qy_4', 'sk_qy_2']);
  const a = pet(e, 'enemy', { ...skill('ice'), element: 'ice' });
  a.element = 'fire';
  a.skills.push({ ...skill('flame'), element: 'fire' });
  setup(e, p, a);
  const game = e.api.gameState;
  game.turnCount = 1;
  e.api.executeSkillTurn(p, a, p.skills[0], 'player');
  assert.equal(e.sandbox.getEffectiveSkillElement(p, 'ice'), 'flying');
  assert.equal(e.sandbox.getEffectiveSkillElement(a, 'ice'), 'fire');
  game.turnCount = 6;
  assert.equal(e.sandbox.getEffectiveSkillElement(a, 'ice'), 'fire');
  game.turnCount = 7;
  assert.equal(e.sandbox.getEffectiveSkillElement(a, 'ice'), 'ice');
});

test('全空 PP 只空过，不凭空攻击、掉精力或在 150 回合判负', () => {
  const e = env();
  const p = pet(e, 'p', skill('empty-p', undefined, 8, 0));
  const a = pet(e, 'a', skill('empty-a', undefined, 8, 0));
  setup(e, p, a);
  for (let i = 0; i < 151; i++) {
    e.api.gameState.pendingPlayerSkill = 0;
    e.api.gameState.pendingAISkill = 0;
    e.sandbox.resolveTurn();
  }
  assert.equal(e.api.gameState.turnCount, 151);
  assert.equal(e.api.gameState.battleOver, false);
  assert.equal(p.hp, p.maxHp);
  assert.equal(a.hp, a.maxHp);
});

test('残脉无减限伤分支也对自身结算固伤', () => {
  const e = env();
  const q = built(e, 'pet_qy', ['sk_qy_4', 'sk_qy_1']);
  const a = pet(e, 'enemy');
  setup(e, q, a);
  const ctx = e.api.createBattleContext();
  q.bloodline.onEnter(q, ctx);
  q.hp = 100;
  q.lastTakenSegments = [100];
  const before = a.hp;
  q.bloodline.onTurnStart(q, ctx);
  assert.equal(q.hp, 70);
  assert.equal(a.hp, before - 30);
  assert.equal(q.outputThisTurn, 30);
});

test('轻风先手在对方结算后回 PP，百分比删除向下取整', () => {
  const e = env();
  const q = built(e, 'pet_qy', ['sk_qy_1', 'sk_qy_4', 'sk_qy_2']);
  let during;
  const a = pet(e, 'enemy', skill('watch', (u, t) => { during = t.skills[2].pp; }));
  setup(e, q, a);
  q.bloodline.onEnter(q, e.api.createBattleContext());
  q.skills[2].pp = 6;
  e.api.gameState.pendingPlayerSkill = 2;
  e.sandbox.resolveTurn();
  assert.equal(during, 6);
  assert.equal(q.skills[2].pp, 8);
  assert.equal(a.skills[0].pp, 4);
});

test('双损、三损分别计时，源到期后只撤自己的扣费', () => {
  const e = env();
  const p = pet(e, 'owner');
  const a = pet(e, 'enemy');
  setup(e, p, a);
  const move = p.skills[0];
  e.api.gameState.turnCount = 1;
  e.sandbox.setPPCostEffect(p, 'three', 2, { extra: 2, skill: move });
  e.sandbox.setPPCostEffect(p, 'double', 4, { extra: 1 });
  assert.equal(e.sandbox.getRequiredPPCost(p, move), 3);
  e.api.gameState.turnCount++;
  assert.equal(e.sandbox.getRequiredPPCost(p, move), 2);
  e.api.gameState.turnCount = 4;
  assert.equal(e.sandbox.getRequiredPPCost(p, move), 1);
  move.noExtraPPCost = true;
  e.sandbox.setPPCostEffect(p, 'another', 3, { extra: 2 });
  assert.equal(e.sandbox.getRequiredPPCost(p, move), 1);
});

test('普通睡眠和沉睡均为1至6回合，命中只唤醒普通睡眠', () => {
  const e = env();
  const p = pet(e, 'owner');
  const a = pet(e, 'enemy');
  setup(e, p, a);
  const ctx = e.api.createBattleContext();
  e.myMath.random = () => 0;
  ctx.applyStatus(a, 'sleep');
  assert.equal(a.statusTurns, 1);
  ctx.doFixedDamage(a, 20, p);
  assert.equal(a.status, 'sleep');
  ctx.doDamage(p, a, 40, 'physical', 'normal');
  assert.equal(a.status, null);
  e.myMath.random = () => 0.99;
  ctx.applyStatus(a, 'deep_sleep');
  assert.equal(a.statusTurns, 6);
  assert.equal(a.canAct(), false);
  ctx.doDamage(p, a, 40, 'physical', 'normal');
  assert.equal(a.status, 'deep_sleep');
  for (let index = 0; index < 6; index++) e.sandbox.tickUnableToAct(a);
  assert.equal(a.status, null);
});

test('残念的换宠锁跟随沉睡目标，换下不解除，净化或阵亡解除', () => {
  const e = env();
  const p = built(e, 'pet_qy', ['sk_qy_3']);
  const old = pet(e, 'old');
  const next = pet(e, 'next');
  setup(e, p, old);
  const state = e.api.gameState;
  state.aiParty.push(next);
  state.pendingFirstMove = 'ai';
  e.api.executeSkillTurn(p, old, p.skills[0], 'player');
  assert.equal(old.status, 'deep_sleep');
  assert.equal(e.sandbox.hasSwitchLock(p), true);
  e.sandbox.executeSwitchAction({ user: old, incoming: next }, 'ai');
  assert.equal(e.sandbox.hasSwitchLock(p), true);
  e.api.createBattleContext().cleanseAbnormalStatuses(old);
  assert.equal(e.sandbox.hasSwitchLock(p), false);
  e.api.executeSkillTurn(p, next, p.skills[0], 'player');
  assert.equal(e.sandbox.hasSwitchLock(p), true);
  next.hp = 0;
  assert.equal(e.sandbox.hasSwitchLock(p), false);
});

test('残念返还最近一段承伤及上次被防控挡住的负面效果', () => {
  const e = env();
  const p = built(e, 'pet_qy', ['sk_qy_3']);
  const a = pet(e, 'enemy', skill('attack', (u, t, ctx) => {
    ctx.doFixedDamage(t, 70, u);
    ctx.doFixedDamage(t, 20, u);
    ctx.applyStatus(t, 'poison');
    ctx.modifyStat(t, 'def', -2);
    ctx.deletePP(t, 0, 2);
  }));
  setup(e, p, a);
  const ctx = e.api.createBattleContext();
  ctx.grantStatusImmunity(p, 'test', Infinity, {stats:true});
  e.api.executeSkillTurn(a, p, a.skills[0], 'ai');
  assert.equal(p.status, null);
  assert.equal(p.defStage, 0);
  const hp = a.hp;
  e.api.gameState.pendingFirstMove = 'player';
  e.api.executeSkillTurn(p, a, p.skills[0], 'player');
  assert.equal(a.hp, hp - 16, '仅返还减伤后的最近一段');
  assert.equal(a.status, 'poison');
  assert.equal(a.defStage, -2);
});

test('沉脉按每只在场宠物的期初期末差值，暂停并让削弱跟随当前对手', () => {
  const e = env();
  const p = built(e, 'pet_qy', ['sk_qy_5', 'sk_qy_3']);
  const a = pet(e, 'enemy', { ...skill('move'), pp: 2, maxPp: 9 });
  const bench = pet(e, 'bench');
  const foe = pet(e, 'incoming');
  setup(e,p,a);
  const state = e.api.gameState;
  state.playerParty.push(bench);
  state.aiParty.push(foe);
  p.bloodlineData = { mode:'清念' };
  p.skills[0].pp = 0;
  state.roundStartPP = new Map([[p, 10], [a, 2]]);
  e.sandbox.startQingnianChannel(p, a, 2, e.api.createBattleContext());
  a.skills[0].pp = 6;
  e.sandbox.sampleQingnianEndOfRound();
  // 清羽在场合计4点损失，对手合计增加4点。
  // 换下后后备环境中的PP变化不应加进这段差值。
  e.sandbox.executeSwitchAction({user:p,incoming:bench}, 'player');
  state.turnCount = 4;
  a.skills[0].pp = 2;
  e.sandbox.executeSwitchAction({user:bench,incoming:p}, 'player');
  assert.equal(p.bloodlineData.mode,'清念');
  assert.equal(p.turnEffects.find(effect => effect.name === '清念沉脉').turnsLeft,2);
  e.sandbox.enterQingyuMode(p, '残脉');
  assert.equal(p.skills[0].pp,4);
  e.sandbox.executeSwitchAction({user:a,incoming:foe}, 'ai');
  e.sandbox.applyQingnianSuppression(foe, foe.skills[0]);
  assert.equal(foe.skills[0].qingnianPriorityLoss,1);
  state.turnCount += 4;
  e.sandbox.applyQingnianSuppression(foe, foe.skills[0]);
  assert.equal(foe.skills[0].qingnianPriorityLoss,1);
});

console.log('\n汇总：' + passed + ' 通过 / ' + failed + ' 失败（共 ' + (passed + failed) + ' 条）');
if (failed) process.exitCode = 1;
