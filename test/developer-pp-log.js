const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { loadEngine } = require('./lib/harness');

function fixture(playerSkills, opponentSkills) {
  const { api, sandbox: engine, myMath } = loadEngine(path.join(__dirname, '..', 'ROCO REMAKE.html'), { seed: 123 });
  myMath.random = () => 0.5;
  for (const name of ['renderBattle', 'renderBattleActions', 'updateBattleUI', 'spawnFloatText', 'showScreen']) engine[name] = () => {};
  const pet = (id, skillIds) => new api.BattlePet({ ...api.findPet(id), skillIds });
  const p = pet('pet_qingling', playerSkills);
  const a = pet('pet_qy', opponentSkills);
  const state = api.gameState;
  Object.assign(state, { battleMode: 'developer', screen: 'battle', playerActive: p, playerParty: [p],
    aiActive: a, aiParty: [a], turnCount: 0 });
  const ppLog = () => state.messages.map(message => message.text).filter(text => text.startsWith('【PP】')).join('\n');
  return { api, engine, p, a, pet, state, ppLog };
}

test('测试日志记录后手被冰冻前已支付的 PP，并区分应扣和实扣', () => {
  const { api, engine, p, a, state, ppLog } = fixture(['sk_ql_2'], ['sk_qy_4']);
  const skill = p.skills[0];
  skill.pp = 1;
  engine.setPPCostEffect(p, '化念中段', 3, { multiplier: 2 });
  engine.setPPCostEffect(p, '光幕三损:0', 3, { extra: 2, skill });
  engine.aiDecideAndResolve = () => {
    state.pendingAISkill = 0;
    engine.resolveTurn();
  };

  api.playerUseSkill(0);
  assert.equal(skill.pp, 0);
  assert.equal(a.status, null);
  assert.equal(p.status, 'freeze');
  assert.equal(skill.useCount || 0, 0);
  assert.match(ppLog(), /我方场上清灵第1格「万念俱灰」 1 → 0（−1 PP）｜第1回合选招扣费[^]*?应扣 4 PP，基础消耗 ×2（化念中段），额外 \+2 PP（极影光幕·三损），剩余 PP 不足，实扣 1 PP/);
  const lines = state.messages.map(message => message.text);
  const paidAt = lines.findIndex(line => line.includes('万念俱灰」 1 → 0'));
  assert.ok(lines.findIndex(line => line.includes('清灵 无法行动')) > paidAt);
});

test('删 PP 逐格记录实扣、免删、保护、空 PP 和反弹', () => {
  const { api, p, a, ppLog } = fixture(['sk_ql_1', 'sk_ql_3', 'sk_ql_4'], ['sk_qy_2']);
  const ctx = api.createBattleContext();
  ctx.sourceSkill = a.skills[0];
  const [protectedMove, regular, locked] = p.skills;
  const changes = ctx.deletePP(p, -1, 10);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].amount, regular.maxPp);
  ctx.deletePP(p, 1, 1);
  ctx.forceClearPP(p, '逆流而行·终结');

  assert.match(ppLog(), /第1格「微灵封体」 1 → 1[^\n]*免疫常规删 PP/);
  assert.match(ppLog(), /第2格「封灵千噬」 8 → 0[^\n]*删除 PP · 轻风散魂[^\n]*请求删除 10 PP/);
  assert.match(ppLog(), /第2格「封灵千噬」 0 → 0[^\n]*PP 已空/);
  assert.match(ppLog(), /第3格「太虚灵威」 8 → 8[^\n]*PP 受到保护/);
  assert.equal(protectedMove.pp, 0);
  assert.equal(locked.pp, 0);
  assert.match(ppLog(), /第1格「微灵封体」 1 → 0[^\n]*强制清空 PP · 逆流而行·终结/);

  a.reflectBackhand = true;
  ctx.skillAction = { user: p, target: a, backhand: true };
  regular.pp = 4;
  ctx.deletePP(a, 1, 1);
  assert.equal(regular.pp, 3);
  assert.match(ppLog(), /我方场上清灵第2格「封灵千噬」 4 → 3[^\n]*效果被反弹/);
});

test('回复 PP 记录指定来源、禁回、减半和上限', () => {
  const { engine, p, state, ppLog } = fixture(['sk_ql_2', 'sk_ql_3'], []);
  const [restricted, regular] = p.skills;
  restricted.pp = 2;
  assert.equal(engine.gainPP(p, restricted, 2, 'sk_qy_5'), 0);
  assert.equal(engine.gainPP(p, restricted, 2, 'sk_ql_1'), 2);
  regular.pp = 6;
  p.dimoFrostRecoveryThrough = state.turnCount;
  assert.equal(engine.gainPP(p, regular, 5, 'sk_ql_1'), 2);
  p.blockPPRecovery = true;
  assert.equal(engine.gainPP(p, regular, 1, 'sk_ql_1'), 0);

  assert.match(ppLog(), /万念俱灰」 2 → 2[^\n]*回 PP 失败 · 清念沉脉[^\n]*仅可由微灵封体回复/);
  assert.match(ppLog(), /万念俱灰」 2 → 4（\+2 PP）/);
  assert.match(ppLog(), /封灵千噬」 6 → 8（\+2 PP）[^\n]*请求回复 5 PP，瞬华若霜减半后为 3 PP，受最大 PP 限制/);
  assert.match(ppLog(), /封灵千噬」 8 → 8[^\n]*目标本回合禁止回复 PP/);
});

test('双方队伍的逆流 PP 跳过回溯，其他技能逐格回溯并记录', () => {
  const { api, pet, state, ppLog } = fixture(['sk_ql_1'], []);
  for (const party of [state.playerParty, state.aiParty]) {
    party.push(pet('pet_bmhs', ['sk_nlex', 'sk_fthy']));
  }
  const [leftReverse, leftOther] = state.playerParty[1].skills;
  const [rightReverse, rightOther] = state.aiParty[1].skills;
  const ctx = api.createBattleContext();
  ctx.saveSnapshot();
  state.turnCount++;
  leftReverse.pp = 0;
  rightReverse.pp = 1;
  leftOther.pp = 3;
  rightOther.pp = 5;
  ctx.savePPState();
  ctx.restoreSnapshot(3);
  assert.deepEqual([leftReverse.pp, rightReverse.pp], [0, 1]);
  assert.deepEqual([leftOther.pp, rightOther.pp], [8, 8]);

  leftReverse.pp = 1;
  rightReverse.pp = 2;
  ctx.rewindPPToMin(24);
  assert.deepEqual([leftReverse.pp, rightReverse.pp], [1, 2]);
  assert.deepEqual([leftOther.pp, rightOther.pp], [3, 5]);

  assert.match(ppLog(), /我方场下创世神钟第1格「逆流而行」 0 → 0[^\n]*跳过回溯 · 逆流而行/);
  assert.match(ppLog(), /对方场下创世神钟第1格「逆流而行」 1 → 1[^\n]*跳过回溯 · 逆流而行/);
  assert.match(ppLog(), /我方场下创世神钟第2格「覆体魂衣」 3 → 8[^\n]*回溯到第0回合 · 逆流而行/);
  assert.match(ppLog(), /我方场下创世神钟第1格「逆流而行」 1 → 1[^\n]*跳过回溯 · 重衍纪元/);
  assert.match(ppLog(), /对方场下创世神钟第1格「逆流而行」 2 → 2[^\n]*跳过回溯 · 重衍纪元/);
  assert.match(ppLog(), /对方场下创世神钟第2格「覆体魂衣」 8 → 5[^\n]*回溯到第1回合 · 重衍纪元/);
});

test('清羽 PP 封存和跨形态恢复单独记录，普通模式沿用原有日志', () => {
  const { api, engine, p, a, state, ppLog } = fixture(['sk_ql_1'], ['sk_qy_1', 'sk_qy_4', 'sk_qy_3']);
  engine.callBloodlineEnter(a);
  api.executeSkillTurn(a, p, a.skills[2], 'ai');
  assert.equal(a.skills[2].pp, 0);
  engine.enterQingyuMode(a, '残脉');
  engine.enterQingyuMode(a, '清念');
  assert.equal(a.skills[2].pp, 5);
  assert.match(ppLog(), /对方场上清羽第3格「残念余梦」 5 → 0[^\n]*封存 PP[^\n]*记录 5 PP/);
  assert.match(ppLog(), /对方场上清羽第3格「残念余梦」 0 → 5[^\n]*恢复封存 PP/);

  state.battleMode = 'solo';
  const prior = ppLog();
  api.createBattleContext().deletePP(a, 2, 1);
  assert.equal(a.skills[2].pp, 4);
  assert.equal(ppLog(), prior);
});

test('清念灵体②只恢复威力技能的 PP，日志记录触发技能', () => {
  const { api, p, a, state, ppLog } = fixture(['sk_ql_4', 'sk_ql_2', 'sk_ql_3', 'sk_ql_5'], []);
  const [taixu, protectedMove, specialMove, physicalMove] = p.skills;
  taixu.pp = 6;
  protectedMove.pp = specialMove.pp = physicalMove.pp = 3;
  state.turnCount = 1;
  api.executeSkillTurn(p, a, taixu, 'player');
  assert.deepEqual([taixu.pp, protectedMove.pp, specialMove.pp, physicalMove.pp], [5, 3, 3, 3]);
  assert.equal(a.healInvertTurns, 0);

  p.hp = 250;
  state.turnCount++;
  api.executeSkillTurn(p, a, taixu, 'player');
  assert.deepEqual([taixu.pp, protectedMove.pp, specialMove.pp, physicalMove.pp], [4, 3, 5, 5]);
  assert.equal(p.hp, 450);
  assert.equal(a.healInvertTurns, 2);
  assert.match(ppLog(), /太虚灵威」 5 → 4[^\n]*选招扣费/);
  assert.doesNotMatch(ppLog(), /太虚灵威」[^\n]*清念灵体·变化招/);
  assert.match(ppLog(), /封灵千噬」 3 → 5[^\n]*清念灵体·变化招（太虚灵威）/);
  assert.match(ppLog(), /万古遗恨」 3 → 5[^\n]*清念灵体·变化招（太虚灵威）/);
});

test('沉脉记录翼系回复被跳过，0 PP 不触发清念低 PP 回满', () => {
  const { api, engine, p, a, state, ppLog } = fixture([], ['sk_qy_5']);
  state.turnCount = 1;
  engine.enterQingyuMode(a, '清念');
  a.bloodlineData.qfzn = 1;
  api.executeSkillTurn(a, p, a.skills[0], 'ai');
  assert.match(ppLog(), /清念沉脉」 0 → 0[^\n]*清念·翼系招式（清念沉脉）[^\n]*跳过血脉回复/);
  assert.doesNotMatch(ppLog(), /清念·低PP回满（清念沉脉）/);
  assert.equal(a.skills[0].pp, 0);
  assert.equal(a.bloodlineData.qfzn, 1);
});
