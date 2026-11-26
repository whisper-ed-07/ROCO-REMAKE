const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { loadEngine } = require('./lib/harness');

const html = path.join(__dirname, '..', 'ROCO REMAKE.html');

function move(id, power, options = {}) {
  return { id, name: id, element: 'normal', power, pp: 5, maxPp: 5, category: 'physical',
    priority: 8, accuracy: 100, ...options };
}

function fixture(mode = 'solo') {
  const { api, sandbox, myMath } = loadEngine(html, { seed: 225 });
  const create = (name, speed) => new api.BattlePet({
    id: name, name, level: 100, element: 'normal', emoji: '·', skillIds: [],
    baseStats: { hp: 200, atk: 110, def: 110, spatk: 110, spdef: 110, spd: speed },
  });
  const player = create('玩家', 100);
  const opponent = create('对手', 120);
  player.skills = [move('占位', 0, { category: 'status', onUse() {} })];
  opponent.skills = [move('攻击', 120), move('恢复', 0, { name: '光合作用', category: 'status' })];
  const state = api.gameState;
  Object.assign(state, { screen: 'battle', battleMode: mode, playerActive: player, aiActive: opponent,
    playerParty: [player], aiParty: [opponent] });
  sandbox.setBattlePresentation();
  return { api, sandbox, myMath, player, opponent, state };
}

test('单机实际回合中会按对手当前精力在攻击和治疗之间选择', () => {
  for (const hpRatio of [1, 0.15]) {
    const { api, player, opponent, state } = fixture();
    opponent.hp = Math.floor(opponent.maxHp * hpRatio);
    const before = opponent.hp;
    api.playerUseSkill(0);
    assert.equal(state.turnCount, 1);
    if (hpRatio === 1) {
      assert.deepEqual(opponent.skills.map(skill => skill.pp), [4, 5]);
      assert.ok(player.hp < player.maxHp);
    } else {
      assert.deepEqual(opponent.skills.map(skill => skill.pp), [5, 4]);
      assert.ok(opponent.hp > before);
      assert.equal(player.hp, player.maxHp);
    }
  }
});

test('开发者模式继续使用原选招规则并保留扣费日志', () => {
  const { api, opponent, state } = fixture('developer');
  opponent.hp = 80;
  api.playerUseSkill(0);
  assert.deepEqual(opponent.skills.map(skill => skill.pp), [4, 5]);
  assert.ok(state.messages.some(message => message.text.includes('「攻击」 5 → 4')));
});

test('只避开下一回合生效的威力免疫，仍能选择变化招', () => {
  const { sandbox, player, opponent } = fixture();
  const fear = { ...sandbox.findSkill('sk_ql_4') };
  opponent.skills[1] = fear;
  player.powerDamageImmuneThroughTurn = 1;
  assert.equal(sandbox.chooseSoloSkill(opponent, player), fear);
  player.powerDamageImmuneThroughTurn = 0;
  assert.equal(sandbox.chooseSoloSkill(opponent, player), opponent.skills[0]);
});

test('选招考虑扣费，预测不扣 PP、不清计时、不抽随机数', () => {
  const { sandbox, myMath, player, opponent } = fixture();
  const [expensive, cheap] = [move('高耗攻击', 120), move('常规攻击', 120)];
  opponent.skills = [expensive, cheap];
  opponent.ppCostEffects = new Map([
    ['高耗', { skill: expensive, extra: 3, throughTurn: 1 }],
    ['过期', { skill: cheap, extra: 4, throughTurn: 0 }],
  ]);
  opponent.skillElementEffects = new Map([['旧天气', { element: 'water', throughTurn: 0 }]]);
  myMath.random = () => assert.fail('选招阶段抽取了随机数');
  assert.equal(sandbox.chooseSoloSkill(opponent, player), cheap);
  assert.deepEqual(opponent.skills.map(skill => skill.pp), [5, 5]);
  assert.equal(opponent.ppCostEffects.size, 2);
  assert.equal(opponent.skillElementEffects.size, 1);
});

test('在玩家预付 PP 前就锁定单机招式，照常执行实际扣费和封技', () => {
  const { api, sandbox, player, opponent, state } = fixture();
  const [sealed, available] = opponent.skills;
  player.skills[0].pp = 1;
  sealed.jianghuaSealedTurns = new Set([1]);
  available.pp = 1;
  available.extraPPCost = 2;
  const choose = sandbox.chooseSoloSkill;
  let calls = 0;
  sandbox.chooseSoloSkill = (...args) => {
    assert.equal(player.skills[0].pp, 1);
    calls++;
    return choose(...args);
  };
  api.playerUseSkill(0);
  assert.equal(calls, 1);
  assert.equal(state.turnCount, 1);
  assert.equal(sealed.pp, 5);
  assert.equal(available.pp, 0);
  assert.equal(available.useCount, 1);
});

test('以本局选定的 AI 标识分派招式，旧状态默认使用 Little Roco', () => {
  const { api, sandbox, opponent, state } = fixture();
  const littleRoco = sandbox.getSoloOpponentAI('little-roco-v0-preview');
  assert.equal(littleRoco.name, 'Little Roco V0-Preview');
  assert.equal(sandbox.getSoloOpponentAI(state.opponentAIId), littleRoco);
  assert.equal(sandbox.getSoloOpponentAI('unknown'), littleRoco);

  state.opponentAIId = littleRoco.id;
  const healingMove = opponent.skills[1];
  littleRoco.chooseSkill = () => healingMove;
  api.playerUseSkill(0);
  assert.deepEqual(opponent.skills.map(skill => skill.pp), [5, 4]);
});
