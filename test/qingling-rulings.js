const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const root = path.join(__dirname, '..');
const { loadEngine } = require(path.join(root, 'test/lib/harness'));

const noop = () => {};
function slot(id, overrides = {}) {
  return { id, name: id, element: 'normal', category: 'status', power: 0,
    accuracy: 100, priority: 8, pp: 30, maxPp: 30, onUse: noop, ...overrides };
}

function setup(skillIds = []) {
  const { api, sandbox, myMath } = loadEngine(path.join(root, 'ROCO REMAKE.html'));
  myMath.random = () => 0.9;
  sandbox.spawnFloatText = noop;
  sandbox.updateBattleUI = noop;
  sandbox.renderBattle = noop;
  sandbox.renderBattleActions = noop;
  const state = api.gameState;
  const q = new api.BattlePet({ ...api.findPet('pet_qingling'), skillIds });
  function other(name) {
    const p = new api.BattlePet({ id: name, name, element: 'normal', level: 100, emoji: 'X',
      baseStats: { hp: 450, atk: 100, def: 100, spatk: 100, spdef: 100, spd: 100 }, skillIds: [] });
    p.skills.push(slot('wait-' + name));
    return p;
  }
  const foe = other('foe');
  const ally = other('ally');
  const bench = other('bench');
  Object.assign(state, { screen: 'battle', playerActive: q, playerParty: [q, ally],
    aiActive: foe, aiParty: [foe, bench] });
  function round(playerIndex = 0, enemyIndex = 0) {
    state.pendingPlayerSkill = playerIndex;
    state.pendingAISkill = enemyIndex;
    sandbox.resolveTurn();
    assert.equal(state.battleOver, false);
  }
  const mark = (pet = q) => pet.bloodlineData?.microLing || 0;
  return { api, sandbox, q, foe, ally, bench, state, round, mark };
}

test('灵1 · 用实际先手入账，未命中仍计，负值归零，上限只限制新印记', () => {
  const { q, foe, state, round, mark } = setup();
  q.skills.push(slot('miss', { element: 'ghost', priority: 12, accuracy: 0, qingnianPriorityLoss: 3 }));
  foe.skills[0].priority = 11;
  Object.assign(state, { weather: 'mist', weatherTurns: 5, field: 'dream', fieldTurns: 5 });
  round();
  assert.equal(mark(), 21);
  foe.skills[0].priority = -20;
  round();
  assert.equal(mark(), 21);
  q.bloodlineData.microLing = 123;
  foe.skills[0].priority = 11;
  round();
  assert.equal(mark(), 144);
  q.bloodlineData.microLingFromMatches = 100;
  round();
  assert.equal(mark(), 144);
});

test('灵1 · 被先手控制而未出手的变化技不入账', () => {
  const { q, foe, round, mark } = setup();
  q.skills.push(slot('controlled', { priority: 11 }));
  Object.assign(foe.skills[0], { priority: 12, onUse(user, target) {
    target.status = 'sleep';
    target.statusTurns = 3;
  } });
  round();
  assert.equal(mark(), 0);
});

test('灵2 · 空过治疗后仍等待，同回合只倒置最大一段，之后整整两回合倒置全部', () => {
  const { api, sandbox, q, foe, round, state } = setup();
  q.skills.push(slot('late-power', { priority: 3, category: 'physical', power: 1 }),
    slot('wait-q', { priority: 7 }));
  foe.hp = 450;
  Object.assign(foe.skills[0], { priority: 11 });
  round(0);
  round(1);
  assert.equal(foe.hp, 450);
  foe.healMod = 1;
  // 同回合两个时点、两个来源。第一段通过 turn effect 直接调用 heal。
  api.createBattleContext().addTurnEffect(foe, 'heal at turn start', 1, pet => pet.heal(40), null);
  foe.skills[0].onUse = (user, target, ctx) => {
    ctx.doHeal(user, 120);
    ctx.doHeal(user, 40);
  };
  round(1);
  assert.equal(foe.hp, 410);
  foe.skills[0].onUse = (user, target, ctx) => { ctx.doHeal(user, 50); ctx.doHeal(user, 10); };
  round(1);
  assert.equal(foe.hp, 350);
  round(1);
  assert.equal(foe.hp, 290);
  round(1);
  assert.equal(foe.hp, 350);
});

test('灵3及共2 · 封灵首回合先手无视必闪、保证首段暴击，拦针对清灵的效果，后手仍能自疗', () => {
  const { q, foe, round, state } = setup(['sk_ql_3']);
  const unaffected = slot('unselected');
  foe.skills.push(unaffected);
  const selfStart = 500;
  foe.hp = selfStart;
  foe.sureDodge = true;
  let reached = false;
  Object.assign(foe.skills[0], { category: 'physical', power: 1, onUse(user, target, ctx) {
    reached = true;
    ctx.doFixedDamage(target, 50, user);
    ctx.deletePP(target, 0, 2);
    ctx.modifyStat(target, 'def', -1);
    ctx.doHeal(user, 100);
  } });
  round();
  assert.equal(reached, true);
  assert.ok(foe.lastTakenSegments[0] > 0);
  assert.ok(state.messages.some(message => /要害|暴击/.test(message.text)));
  assert.equal(q.hp, q.maxHp);
  assert.equal(q.skills[0].pp, 7);
  // 清灵血脉另删全体 1；封灵首发只删已出招一格 1。
  assert.equal(foe.skills[0].pp, 27);
  assert.equal(unaffected.pp, 29);
  assert.equal(q.defStage, 0);
  assert.equal(foe.hp, selfStart - foe.lastTakenTotal + 100);
});

test('灵4 · 封灵使用万念当前威力，次回合额外走物攻和物抗，第三回合结束', () => {
  function damage(atk, wannenPP) {
    const { q, foe, round } = setup(['sk_ql_3', 'sk_ql_2', 'sk_ql_4']);
    foe.element = 'fire';
    q.bloodlineData = { microLing: 0, lastWjPower: 999 };
    q.atk = atk;
    q.skills[1].pp = wannenPP;
    q.skills.push(slot('wait-q'));
    Object.assign(foe.skills[0], { priority: 13, onUse(user, target, ctx) {
      ctx.doFixedDamage(target, 100, user);
    } });
    round(0);
    const first = foe.lastTakenSegments[0];
    round(3);
    const secondRound = Array.from(foe.lastTakenSegments);
    round(3);
    assert.equal(foe.lastTakenSegments.length, 1);
    assert.equal(q.skills[2].pp, 0);
    assert.equal(foe.skills[0].pp, 0);
    foe.skills[0].pp = 30;
    round(3);
    assert.equal(foe.lastTakenSegments.length, 0);
    return { first, secondRound };
  }
  const weak = damage(100, 6);
  const strong = damage(300, 6);
  assert.equal(weak.secondRound.length, 2);
  assert.deepEqual(weak.secondRound.slice(0, 1), strong.secondRound.slice(0, 1));
  assert.ok(strong.secondRound[1] > weak.secondRound[1]);
  assert.ok(damage(100, 4).first > weak.first);
});

test('灵5 · 后手首格 PP=0 无必暴，伤害仍有下限且回复超过400，免删招不被清空', () => {
  const { q, foe, round, state } = setup(['sk_ql_1', 'sk_ql_2']);
  q.skills[0].pp = 0;
  q.skills[1].pp = 2;
  q.hp = 30;
  Object.assign(foe.skills[0], { category: 'physical', power: 1, priority: 14, immuneToPP: true });
  round(1);
  assert.notEqual(foe.skills[0].pp, 0);
  assert.ok(q.hp > 480);
  assert.ok(foe.lastTakenTotal >= Math.floor(q.maxHp * 0.3));
  assert.ok(!state.messages.some(message => /必定暴击|命中要害/.test(message.text)));
});

test('灵6 · 先手血脉固伤记入输出，万古遗恨用施放双方输出，治疗当前对手', () => {
  const { q, foe, bench, sandbox, state, round } = setup(['sk_ql_5']);
  q.skills.push(slot('wait-q'));
  q.bloodlineData = { microLing: 350 };
  Object.assign(foe.skills[0], { priority: 1, onUse(user, target, ctx) {
    ctx.doFixedDamage(target, 35, user);
  } });
  round(0);
  assert.equal(q.lastTurnOutput, foe.lastTakenTotal);
  const expected = Math.abs(q.lastTurnOutput - foe.lastTurnOutput);
  assert.ok(expected > 0);
  const oldHp = foe.hp;
  bench.hp = 300;
  sandbox.executeSwitchAction({ kind: 'switch', user: foe, incoming: bench }, 'ai');
  round(1);
  assert.equal(bench.hp, Math.min(300 + expected, bench.maxHp));
  assert.equal(foe.hp, oldHp);
});

test('灵7 · 每回合给当前双方印记，清灵换下即中止，换回不恢复', () => {
  const { q, foe, ally, bench, sandbox, round, mark } = setup(['sk_ql_1']);
  q.skills.push(slot('wait-q'));
  Object.assign(foe.skills[0], { category: 'physical', power: 1 });
  Object.assign(bench.skills[0], { category: 'physical', power: 1 });
  round(0);
  assert.equal(mark(), 0);
  sandbox.executeSwitchAction({ kind: 'switch', user: foe, incoming: bench }, 'ai');
  round(1);
  assert.deepEqual([mark(), mark(foe), mark(bench)], [5, 0, 5]);
  sandbox.executeSwitchAction({ kind: 'switch', user: q, incoming: ally }, 'player');
  round(0);
  sandbox.executeSwitchAction({ kind: 'switch', user: ally, incoming: q }, 'player');
  round(1);
  assert.deepEqual([mark(), mark(ally), mark(bench)], [5, 0, 5]);
});

test('灵7 · 场下旧护盾、限伤、减伤、反弹失效，永久防御仍生效，新效果拒绝写入', () => {
  const { api, foe, bench, sandbox, round } = setup(['sk_ql_1']);
  const ctx = api.createBattleContext();
  Object.assign(bench, { shield: 70, damageCap: 5, damageCapTurns: 5, damageReduction: 50,
    damageReductionTurns: 5, reflectBackhand: true, passiveDamageReduction: 20 });
  round(0);
  sandbox.executeSwitchAction({ kind: 'switch', user: foe, incoming: bench }, 'ai');
  const hp = bench.hp;
  bench.takeDamage(100);
  assert.equal(bench.hp, hp - 80);
  assert.equal(bench.shield, 0);
  assert.equal(bench.reflectBackhand, false);
  ctx.addShield(bench, 150);
  ctx.setDamageReduction(bench, 80);
  ctx.setDamageCap(bench, 1, 1, 5);
  assert.equal(bench.shield, 0);
  assert.equal(bench.getDamageReduction(), 20);
  assert.equal(bench.damageCapTurns, 0);
  assert.equal(bench.damageReductionTurns, 0);
});
test('灵7/8 · 太虚首用前不能被删，首用后可删，对手上次受保护的技能仍免删', () => {
  const { api, q, foe, round } = setup(['sk_ql_4']);
  const ctx = api.createBattleContext();
  ctx.grantStatusImmunity(foe, 'test immunity', Infinity, { statuses: ['fear'] });
  ctx.deletePP(q, 0, 2);
  assert.equal(q.skills[0].pp, 8);
  q.bloodlineData = { microLing: 200 };
  Object.assign(foe.skills[0], { immuneToPP: true, priority: 7 });
  foe.lastUsedSkillId = foe.skills[0].id;
  round(0);
  assert.equal(q.skills[0].pp, 7);
  assert.equal(foe.skills[0].pp, 29);
  ctx.deletePP(q, 0, 2);
  assert.equal(q.skills[0].pp, 5);
});

test('灵3 · 封灵标记在神钟保命并被驱逐时消失', () => {
  const { api, sandbox, q, state, bench, round } = setup(['sk_ql_3']);
  const clock = new api.BattlePet({ ...api.findPet('pet_bmhs'), skillIds: [] });
  clock.skills.push(slot('wait-clock'));
  clock.hp = 1;
  clock.element = "ghost";
  q.spatk = 2000;
  Object.assign(state, { aiActive: clock, aiParty: [clock, bench] });
  round();
  assert.equal(state.aiActive, bench);
  assert.equal(clock.qlSealMark, false);
});
test('灵6 · 即使施放者离场，万古遗恨仍按施放双方输出治疗对方当前宠', () => {
  const { q, foe, ally, bench, sandbox, round } = setup(['sk_ql_5']);
  q.bloodlineData = { microLing: 350 };
  Object.assign(foe.skills[0], { priority: 15, onUse(user, target, ctx) {
    ctx.doFixedDamage(target, 50, user);
  } });
  round();
  const expected = Math.abs(q.lastTurnOutput - foe.lastTurnOutput);
  const oldHp = foe.hp;
  bench.hp = 300;
  sandbox.executeSwitchAction({ kind: 'switch', user: q, incoming: ally }, 'player');
  sandbox.executeSwitchAction({ kind: 'switch', user: foe, incoming: bench }, 'ai');
  round();
  assert.ok(expected > 0);
  assert.equal(bench.hp, 300 + expected);
  assert.equal(foe.hp, oldHp);
});

test('灵7 · 微灵封体后完整发放六回合，第七回合停发', () => {
  const { q, foe, round, mark } = setup(['sk_ql_1']);
  q.skills.push(slot('wait-q'));
  Object.assign(foe.skills[0], { category: 'physical', power: 1 });
  round(0);
  assert.equal(mark(), 0);
  for (let step = 1; step <= 7; step++) {
    round(1);
    assert.equal(mark(), Math.min(step, 6) * 5);
    assert.equal(mark(foe), Math.min(step, 6) * 5);
  }
});
test('共2 · 后手反弹转移全部伤害段、异常、删 PP 和降强化', () => {
  const { q, foe, state, round } = setup();
  q.skills.push(slot('prepare-reflect', { priority: 12, onUse(user) {
    user.reflectBackhand = true;
  } }));
  q.hp = 500;
  foe.hp = 500;
  Object.assign(foe.skills[0], { priority: 8, onUse(user, target, ctx) {
    ctx.doFixedDamage(target, 30, user);
    ctx.doFixedDamage(target, 20, user);
    ctx.deletePP(target, 0, 2);
    ctx.modifyStat(target, 'def', -2);
    ctx.applyStatus(target, 'poison');
    ctx.doHeal(user, 10);
  } });
  round();
  assert.equal(q.hp, Math.min(700, q.maxHp), '清灵只收到自身变化招回血');
  assert.equal(foe.hp, 460, '两段反弹伤害和自身治疗均结算');
  assert.equal(q.skills[0].pp, 29);
  assert.equal(foe.skills[0].pp, 27);
  assert.equal(q.defStage, 0);
  assert.equal(foe.defStage, -2);
  assert.equal(q.status, null);
  assert.equal(foe.poisoned, true);
  assert.equal(state.messages.filter(message => message.text.includes('反弹了后手技能效果')).length, 1);
});

test('共2 · 封灵印记和传统降强化共用后手效果判定', () => {
  const { api, sandbox, q, foe, state } = setup(['sk_ql_3']);
  state.pendingFirstMove = 'ai';
  foe.hp = foe.maxHp = 100000;
  foe.immuneBackhandEffects = true;
  api.executeSkillTurn(q, foe, q.skills[0], 'player');
  assert.equal(foe.qlSealMark, false);
  foe.immuneBackhandEffects = false;
  foe.reflectBackhand = true;
  api.executeSkillTurn(q, foe, q.skills[0], 'player');
  assert.equal(foe.qlSealMark, false);
  assert.equal(q.qlSealMark, true);

  state.pendingFirstMove = 'player';
  q.immuneBackhandEffects = false;
  q.reflectBackhand = true;
  Object.assign(foe.skills[0], { name: '烟雾', onUse: undefined });
  api.executeSkillTurn(foe, q, foe.skills[0], 'ai');
  assert.equal(q.accuracyStage, 0);
  assert.equal(foe.accuracyStage, -1);
});
