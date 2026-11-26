// Run with node test/switch-turn-regressions.js.
const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { loadEngine } = require('./lib/harness');

function slot(priority, onUse) {
  return { id: 'probe', name: 'probe', element: 'normal', category: 'status',
    power: 0, accuracy: 100, priority, pp: 5, maxPp: 5, onUse };
}

function setup({ priority, outgoingSpeed = 50, dream = false, hit = () => {} }) {
  const { api, sandbox, clock } = loadEngine(path.join(__dirname, '..', 'ROCO REMAKE.html'), { seed: 55 });
  const state = api.gameState;
  const events = [];
  sandbox.renderBattle = () => {};
  sandbox.updateBattleUI = () => {};
  sandbox.spawnFloatText = () => {};
  function pet(name, spd, move, bloodline) {
    const result = new api.BattlePet({ id: name, name, emoji: 'X', element: 'normal', level: 100,
      baseStats: { hp: 200, atk: 100, def: 100, spatk: 100, spdef: 100, spd }, skillIds: [], bloodline });
    result.skills = [move];
    return result;
  }
  const unused = slot(8, () => assert.fail('换宠回合不该使用招式'));
  const outgoing = pet('旧宠', outgoingSpeed, unused);
  const incoming = pet('新宠', 250, { ...unused }, { onEnter: () => events.push('新宠入场') });
  const enemy = pet('对手', 100, slot(priority, (user, target, ctx) => {
    events.push('对手命中' + target.name);
    hit(user, target, ctx);
  }));
  Object.assign(state, { screen: 'battle', playerActive: outgoing, playerParty: [outgoing, incoming],
    aiActive: enemy, aiParty: [enemy], waitingForSwitch: true, field: dream ? 'dream' : null,
    fieldTurns: dream ? 3 : 0 });
  function switchPet() {
    sandbox.playerSwitch(1);
    assert.equal(state.turnCount, 1);
    assert.equal(state.waitingForSwitch, false);
    assert.equal(outgoing.skills[0].pp, 5);
    assert.equal(incoming.skills[0].pp, 5);
    assert.equal(enemy.skills[0].pp, 4);
    assert.equal(state.isPlayerTurn, true);
    assert.equal(clock.pending(), 1, '应只保留下一回合的计时器');
    clock.advance(800);
    assert.equal(state.turnCount, 1);
  }
  return { sandbox, state, events, incoming, outgoing, switchPet };
}

for (const { name, options, expected } of [
  { name: '先手值 9 的招先打旧宠', options: { priority: 9 },
    expected: ['对手命中旧宠', '新宠入场'] },
  { name: '先手值 7 的招后打新宠', options: { priority: 7 },
    expected: ['新宠入场', '对手命中新宠'] },
  { name: '先手值 8 的平手比较旧宠速度', options: { priority: 8 },
    expected: ['对手命中旧宠', '新宠入场'] },
  { name: '旧宠速度更快时换宠优先', options: { priority: 8, outgoingSpeed: 150 },
    expected: ['新宠入场', '对手命中新宠'] },
  { name: '梦境反转换宠和招式的顺序', options: { priority: 9, dream: true },
    expected: ['新宠入场', '对手命中新宠'] },
]) {
  test(name, () => {
    const { state, events, incoming, switchPet } = setup(options);
    switchPet();
    assert.deepEqual(events, expected);
    assert.equal(state.playerActive, incoming);
  });
}

test('换宠前被击倒，待执行换宠取消，由濒死流程补位', () => {
  const { state, events, incoming, outgoing, switchPet } = setup({ priority: 9,
    hit: (user, target, ctx) => ctx.doFixedDamage(target, target.hp) });
  switchPet();
  assert.deepEqual(events, ['对手命中旧宠', '新宠入场']);
  assert.equal(outgoing.isFainted(), true);
  assert.equal(state.playerActive, incoming);
  assert.ok(state.messages.some(message => (message.text ?? message).includes('旧宠 倒下了')));
  assert.ok(!state.messages.some(message => (message.text ?? message).includes('回来吧')));
});

test('先手施加换宠锁，拦下已提交的 8 速换宠行动', () => {
  const { state, events, outgoing, switchPet } = setup({ priority: 9,
    hit: (user, target) => { target.switchLocked = true; } });
  switchPet();
  assert.deepEqual(events, ['对手命中旧宠']);
  assert.equal(state.playerActive, outgoing);
  assert.ok(state.messages.some(message => (message.text ?? message).includes('无法换宠')));
});

test('驱逐仅在完成换入和入场结算后同步通知界面', () => {
  const { sandbox, state, events, incoming, outgoing } = setup({ priority: 9 });
  const updates = [];
  sandbox.setBattlePresentation({
    activePetChanged(update) {
      assert.equal(state.playerActive, incoming);
      assert.deepEqual(events, ['新宠入场']);
      assert.equal(state.messages.at(-1).text, '换上 新宠！');
      updates.push(update);
    },
  });

  outgoing.immuneEject = true;
  assert.equal(sandbox.forceSwitchPet(outgoing), undefined);
  assert.equal(updates.length, 0);
  outgoing.immuneEject = false;
  assert.equal(sandbox.forceSwitchPet(outgoing), incoming);
  assert.equal(updates.length, 1);
  assert.deepEqual({ ...updates[0] }, { side: 'player', previous: outgoing, incoming, reason: 'forced' });
});

test('没有界面时仍可结算换宠、伤害、PP 和战斗结果', () => {
  const { sandbox, state, incoming, outgoing, events } = setup({
    priority: 7,
    hit: (user, target, ctx) => ctx.doFixedDamage(target, 25, user),
  });
  sandbox.setBattlePresentation();
  Object.defineProperty(sandbox, 'document', {
    get() { assert.fail('战斗结算读取了 DOM'); },
  });
  state.battleMode = 'developer';

  sandbox.playerSwitch(1);
  assert.deepEqual(events, ['新宠入场', '对手命中新宠']);
  assert.equal(state.turnCount, 1);
  assert.equal(state.waitingForSwitch, false);
  assert.equal(state.playerActive, incoming);
  assert.equal(incoming.hp, incoming.maxHp - 25);
  assert.equal(state.aiActive.skills[0].pp, 4);
  assert.ok(state.messages.some(message => message.text.includes('【PP】')));

  outgoing.hp = incoming.hp = 0;
  assert.equal(sandbox.checkFaints(), true);
  assert.equal(state.battleOver, true);
  assert.equal(state.messages.at(-1).text, '战斗结束，对方胜利。');
});
