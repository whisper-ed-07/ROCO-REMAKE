const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { loadEngine } = require('./lib/harness');

const html = path.join(__dirname, '..', 'ROCO REMAKE.html');
const labels = {
  atk: '物攻', def: '物防', spatk: '魔攻', spdef: '魔防', spd: '速度',
  accuracy: '命中', evasion: '闪避',
};
const stats = Object.keys(labels);
const neutral = stats.map(() => 0);

function fixture() {
  const { api, sandbox } = loadEngine(html, { seed: 55 });
  const player = new api.BattlePet({ ...api.findPet('pet_qy'), skillIds: ['sk_qy_5'] });
  const opponent = new api.BattlePet(api.findPet('pet_jydm'));
  Object.assign(api.gameState, {
    playerActive: player, aiActive: opponent, playerParty: [player], aiParty: [opponent],
    turnCount: 1, pendingFirstMove: 'player', snapshots: [], messages: [],
  });
  return { api, sandbox, player, opponent, ctx: api.createBattleContext() };
}

function stages(pet) {
  return stats.map(stat => pet[stat + 'Stage']);
}

function changeStages(ctx, pet, deltas) {
  stats.forEach((stat, i) => ctx.modifyStat(pet, stat, deltas[i]));
}

function pills(sandbox, pet) {
  return Array.from(sandbox.renderStages(pet).matchAll(/<span class="([^"]+)">([^<]+)<\/span>/g),
    ([, classes, label]) => [classes, label]);
}

test('七项能力等级从零开始，显示中文名称和正确的正负状态样式', () => {
  const { sandbox, player, ctx } = fixture();
  assert.deepEqual(stages(player), neutral);
  assert.deepEqual(pills(sandbox, player), stats.map(stat => ['stage-pill', labels[stat] + '±0']));

  changeStages(ctx, player, [1, -2, 3, -4, 5, -6, 6]);
  assert.deepEqual(pills(sandbox, player), [
    ['stage-pill up', '物攻+1'], ['stage-pill down', '物防-2'],
    ['stage-pill up', '魔攻+3'], ['stage-pill down', '魔防-4'],
    ['stage-pill up', '速度+5'], ['stage-pill down', '命中-6'],
    ['stage-pill up', '闪避+6'],
  ]);
});

test('七项能力等级均限制在正负六级，锁定和白名单阻止修改', () => {
  const { api, player, ctx } = fixture();
  for (const [stat, label] of Object.entries(labels)) {
    const key = stat + 'Stage';
    ctx.modifyStat(player, stat, 20);
    assert.equal(player[key], 6, label);
    assert.match(api.gameState.messages.at(-1).text, new RegExp(label + ' \\+6级'));
    ctx.modifyStat(player, stat, -20);
    assert.equal(player[key], -6, label);
  }

  ctx.resetAndLockStages(player, 6);
  api.gameState.turnCount = 6;
  changeStages(ctx, player, stats.map(() => 1));
  assert.deepEqual(stages(player), neutral);
  api.gameState.turnCount = 7;
  changeStages(ctx, player, stats.map(() => 1));
  assert.deepEqual(stages(player), stats.map(() => 1));

  for (const invalid of ['hp', 'toString', 'constructor']) {
    const key = invalid + 'Stage';
    player[key] = 2;
    ctx.modifyStat(player, invalid, 1);
    assert.equal(player[key], 2, '应忽略白名单外属性 ' + invalid);
  }
});

test('负面强化免疫可分别保护命中和闪避', () => {
  const { player, ctx } = fixture();
  ctx.grantStatusImmunity(player, 'test', 1, { stats: ['accuracy', 'evasion'] });

  ctx.modifyStat(player, 'accuracy', -1);
  ctx.modifyStat(player, 'evasion', -1);
  ctx.modifyStat(player, 'spd', -1);
  assert.equal(player.accuracyStage, 0);
  assert.equal(player.evasionStage, 0);
  assert.equal(player.spdStage, -1);

  ctx.revokeStatusImmunity(player, 'test');
  ctx.modifyStat(player, 'accuracy', -1);
  ctx.modifyStat(player, 'evasion', -1);
  assert.equal(player.accuracyStage, -1);
  assert.equal(player.evasionStage, -1);
});

test('时间回溯恢复双方的七项能力等级', () => {
  const { api, player, opponent, ctx } = fixture();
  const beforePlayer = [1, -2, 3, -4, 5, -6, 6];
  const beforeOpponent = [-1, 2, -3, 4, -5, 6, -6];
  changeStages(ctx, player, beforePlayer);
  changeStages(ctx, opponent, beforeOpponent);
  ctx.saveSnapshot();

  api.gameState.turnCount++;
  changeStages(ctx, player, stats.map(() => -1));
  changeStages(ctx, opponent, stats.map(() => 1));
  ctx.saveSnapshot();
  ctx.restoreSnapshot(1);
  assert.deepEqual(stages(player), beforePlayer);
  assert.deepEqual(stages(opponent), beforeOpponent);
});

test('清念沉脉强制清除双方七项能力等级，治疗量计入命中和闪避', () => {
  const { api, player, opponent, ctx } = fixture();
  changeStages(ctx, player, [1, -1, 1, -1, 1, -2, 3]);
  changeStages(ctx, opponent, [-1, 1, -1, 1, -1, 4, -5]);
  player.statLockedThrough = opponent.statLockedThrough = 5;
  player.bloodline = null; // 隔离清念翼系的额外治疗，只测沉脉。
  opponent.maxHp = 5000;
  opponent.hp = 1000;

  api.executeSkillTurn(player, opponent, player.skills[0], 'player');
  assert.deepEqual(stages(player), neutral);
  assert.deepEqual(stages(opponent), neutral);
  assert.equal(opponent.hp, 1000 + 24 * 60);
});

test('同先手按等级修正后的速度排序，先手值不同时由先手值决定', () => {
  function actions(playerPriority, playerSpeedStage) {
    const { api, sandbox, player, opponent, ctx } = fixture();
    const order = [];
    player.spd = 80;
    opponent.spd = 100;
    ctx.modifyStat(player, 'spd', playerSpeedStage);

    for (const [actor, side, priority] of [[player, 'player', playerPriority], [opponent, 'ai', 8]]) {
      actor.bloodline = null;
      actor.skills = [{
        id: 'test_' + side, name: '顺序探针', element: 'normal', category: 'status',
        priority, pp: 5, maxPp: 5, accuracy: 100, power: 0,
        onUse() { order.push(side); },
      }];
    }
    Object.assign(api.gameState, { pendingPlayerSkill: 0, pendingAISkill: 0 });
    sandbox.resolveTurn();
    return order;
  }

  assert.deepEqual(actions(8, 0), ['ai', 'player']);
  assert.deepEqual(actions(8, 1), ['player', 'ai']);
  assert.deepEqual(actions(7, 1), ['ai', 'player']);
});
