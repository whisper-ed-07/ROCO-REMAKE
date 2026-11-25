const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { loadEngine } = require('./lib/harness');

function fixture(ids) {
  const engine = loadEngine(path.join(__dirname, '..', 'ROCO REMAKE.html'), { seed: 3 });
  const { api, sandbox, myMath } = engine;
  myMath.random = () => 0.5;
  for (const name of ['renderBattle', 'renderBattleActions', 'updateBattleUI', 'spawnFloatText', 'showScreen']) sandbox[name] = () => {};
  const build = (id, skills) => new api.BattlePet({ ...api.findPet(id), skillIds: skills });
  const owner = build('pet_bmhs', ids);
  const foe = build('pet_qingling', ['sk_ql_3', 'sk_ql_4', 'sk_ql_5']);
  const state = api.gameState;
  Object.assign(state, { playerActive: owner, aiActive: foe, playerParty: [owner], aiParty: [foe], pendingFirstMove: 'ai' });
  return { api, sandbox, owner, foe, state, build, ctx: api.createBattleContext() };
}

test('不灭魂体先治30再承受70，当前威力段无法暴击', () => {
  const { owner, foe, ctx, state } = fixture([]);
  owner.hp = 100;
  assert.equal(owner.bloodline.onBeforeDamage(owner, 100, 'fixed', null, ctx), 70);
  assert.equal(owner.hp, 130);
  ctx.doFixedDamage(owner, 100, foe);
  assert.equal(owner.lastDamageSegment, 70);
  assert.equal(ctx.doDamage(foe, owner, 40, 'physical', 'fighting', { guaranteedCrit: true }).isCrit, false);
  assert.equal(foe.blockPPRecoveryOnTurn, state.turnCount + 1);
});

test('不灭魂体只在严格超出精力时保命，扣除本人可删的PP', () => {
  const { owner, foe, state, build, sandbox } = fixture(['sk_cszn', 'sk_fthy', 'sk_mszw']);
  owner.hp = 10;
  owner.takeDamage(10, foe);
  assert.equal(owner.lethalHitThisTurn, false);
  owner.hp = 10;
  const reserve = build('pet_qy', ['sk_qy_2']);
  state.playerParty.push(reserve);
  const enemyPP = foe.skills.map(skill => skill.pp);
  owner.skills[2].ppLocked = true;
  owner.takeDamage(11, foe);
  sandbox.postDamageProcessing();
  assert.equal(owner.hp, 1);
  assert.equal(state.playerActive, reserve);
  assert.deepEqual(Array.from(owner.skills, skill => skill.pp), [3, 4, 12]);
  assert.deepEqual(Array.from(foe.skills, skill => skill.pp), Array.from(enemyPP));
});

test('创世吸取按格回复实际扣量，双损包括并列0PP，速度随原双方且刷新', () => {
  const { api, owner, foe, state, sandbox, build, ctx } = fixture(['sk_cszn', 'sk_fthy', 'sk_mszw']);
  foe.skills[2].immuneToPP = false;
  foe.skills[0].pp = 2;
  foe.skills[1].ppLocked = false;
  foe.skills[1].pp = 2;
  foe.skills[2].pp = 7;
  owner.skills[0].pp = owner.skills[1].pp = owner.skills[2].pp = 1;
  api.findSkill('sk_cszn').onUse(owner, foe, ctx);
  assert.deepEqual(Array.from(owner.skills, skill => skill.pp), [1,3,3]);
  assert.deepEqual(Array.from(foe.skills, skill => skill.pp), [0,0,5]);
  assert.equal(sandbox.getRequiredPPCost(foe, foe.skills[0]), 2);
  assert.equal(sandbox.getRequiredPPCost(foe, foe.skills[1]), 2);
  assert.equal(sandbox.getRequiredPPCost(foe, foe.skills[2]), 1);

  const reserve = build('pet_qy', ['sk_qy_2']);
  state.aiParty.push(reserve);
  sandbox.executeSwitchAction({ user: foe, incoming: reserve }, 'ai');
  assert.equal(foe.creationSpeedSources.size, 1);
  assert.equal(reserve.creationSpeedSources?.size ?? 0, 0);
  assert.equal(sandbox.getOutputMultiplier(owner), 1.25);
  api.findSkill('sk_cszn').onUse(owner, reserve, ctx);
  assert.equal(owner.creationSpeedSources.size, 1);
  assert.equal(foe.creationSpeedSources.size, 0);
  assert.equal(reserve.creationSpeedSources.size, 1);
});

test('回溯初始精力与寄生，重衍只恢复一份全队最低总PP快照', () => {
  const { owner, foe, state, build, ctx } = fixture(['sk_cszn', 'sk_nlex', 'sk_fthy']);
  const mirror = build('pet_bmhs', ['sk_cszn', 'sk_nlex', 'sk_fthy']);
  state.aiParty.push(mirror);
  owner.hp = 250;
  owner.leechSeed = true;
  ctx.saveSnapshot();
  state.turnCount = 1;
  owner.hp = 50;
  owner.leechSeed = false;
  ctx.restoreSnapshot(3);
  assert.equal(owner.hp, 250);
  assert.equal(owner.leechSeed, true);
  owner.skills[0].pp = 3; owner.skills[1].pp = 0; mirror.skills[0].pp = 1;
  ctx.savePPState();
  state.turnCount = 2;
  owner.skills[0].pp = 0; owner.skills[1].pp = 2; mirror.skills[0].pp = 1;
  ctx.savePPState();
  owner.skills[0].pp = 2; owner.skills[1].pp = 0; mirror.skills[0].pp = 2;
  ctx.rewindPPToMin(24);
  assert.deepEqual([owner.skills[0].pp, owner.skills[1].pp, mirror.skills[0].pp], [0, 2, 1]);
  assert.equal(owner.skills[0].noPPRecover, true);
  assert.equal(owner.skills[1].noPPRecover, true);
  assert.equal(foe.skills[0].pp, foe.skills[0].maxPp);
});

test('覆体零 PP 分支保留防控，失强按每次等级差结算', () => {
  const { api, owner, foe, state, sandbox, ctx } = fixture(['sk_cszn', 'sk_fthy']);
  owner.skills[0].pp = 0;
  state.turnCount = 4;
  api.findSkill('sk_fthy').onUse(owner, foe, ctx);
  assert.equal(sandbox.hasStatusImmunity(owner, 'leech_seed'), true);
  for (const [before, after, loss] of [[3,1,160], [3,0,240], [-2,0,160]]) {
    owner.atkStage = before;
    foe.hp = foe.maxHp;
    owner.atkStage = after;
    assert.equal(foe.maxHp - foe.hp, loss);
  }
});

test('重衍携带减输出实时随PP切换，也作用于固伤', () => {
  const { owner, foe, ctx } = fixture(['sk_cyjy']);
  let hp = foe.hp;
  ctx.doFixedDamage(foe, 100, owner);
  assert.equal(hp - foe.hp, 60);
  owner.skills[0].pp = 0;
  hp = foe.hp;
  ctx.doFixedDamage(foe, 100, owner);
  assert.equal(hp - foe.hp, 100);
});

test('逆流回溯跳过本招 PP，末点用完仍触发下一招普通威力技能的终结', () => {
  const { api, sandbox, owner, foe, state, ctx } = fixture(['sk_nlex', 'sk_mszw']);
  foe.hp = foe.maxHp = 100000;
  foe.skills[0].immuneToPP = true;
  owner.skills[1].name = '普通威力招';
  owner.skills[1].id = 'ordinary-power';
  owner.skills[1].onUse = undefined;
  owner.hp = 400;
  owner.atkStage = 2;
  owner.leechSeed = true;
  ctx.saveSnapshot();
  owner.hp = 200;
  owner.atkStage = 0;
  owner.leechSeed = false;
  owner.skills[0].pp = 1;
  owner.skills[1].pp = 2;
  state.turnCount = 1;
  state.pendingFirstMove = 'player';
  api.executeSkillTurn(owner, foe, owner.skills[0], 'player');
  assert.equal(owner.skills[0].pp, 0, '施放者本招保留实际扣费');
  assert.equal(owner.skills[1].pp, owner.skills[1].maxPp);
  assert.equal(owner.hp, 400);
  assert.equal(owner.atkStage, 2);
  assert.equal(owner.leechSeed, true);
  assert.equal(owner.element, null);
  assert.equal(owner.pendingNilex.cnt, 1);
  const before = foe.hp;
  api.executeSkillTurn(owner, foe, owner.skills[1], 'player');
  assert.ok(before - foe.hp >= 9999);
  assert.ok(foe.skills.every(skill => skill.pp === 0), '终结强制清空免删招');
  assert.equal(owner.pendingNilex, null);
});

test('逆流最多使用两次，其他历史回溯不能重新点亮用尽的逆流', () => {
  const { api, sandbox, owner, foe, state, ctx } = fixture(['sk_nlex', 'sk_mszw']);
  foe.hp = foe.maxHp = 100000;
  const reverse = owner.skills[0];
  ctx.saveSnapshot();
  ctx.savePPState();
  for (let turn = 1; turn <= 2; turn++) {
    state.turnCount = turn;
    api.executeSkillTurn(owner, foe, reverse, 'player');
    assert.equal(reverse.pp, 2 - turn);
    assert.equal(reverse.useCount, turn);
  }
  assert.equal(owner.pendingNilex.cnt, 2);
  ctx.rewindPPToMin(24);
  ctx.restoreSnapshot(3);
  assert.equal(reverse.pp, 0);
  assert.equal(sandbox.canSelectSkill(reverse), false);
  api.executeSkillTurn(owner, foe, reverse, 'player');
  assert.equal(reverse.useCount, 2);
});

test('免疫驱逐的神钟受到超出当前精力的伤害后倒下，存活后备正常登场', () => {
  const { owner, foe, state, build, sandbox } = fixture(['sk_fthy']);
  const reserve = build('pet_qy', ['sk_qy_2']);
  state.playerParty.push(reserve);
  owner.hp = 10;
  owner.immuneEject = true;
  owner.takeDamage(11, foe);
  assert.equal(owner.hp, 0, '致死段的回复不会让神钟从 0 精力复活');
  sandbox.checkFaints();
  assert.equal(owner.hp, 0);
  assert.equal(state.playerActive, reserve);
  assert.equal(owner.skills[0].pp, 8);
  assert.ok(state.messages.some(message => message.text.includes('倒下了')));
  assert.ok(!state.messages.some(message => message.text.includes('被迫换下')));
});

test('覆体魂衣单段限伤仍为 80，降华下限不改变此招', () => {
  const { ctx, owner, foe } = fixture(['sk_fthy']);
  owner.skills[0].onUse(owner, foe, ctx);
  assert.equal(owner.damageCap, 80);
  assert.equal(owner.takeDamage(140, foe), 80);
});
