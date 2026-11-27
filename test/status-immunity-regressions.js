const assert = require('assert');
const path = require('path');
const { loadEngine } = require('./lib/harness');
const html = path.join(__dirname, '..', 'ROCO REMAKE.html');
let failed = 0;
function test(name, fn) { try { fn(); console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); } }
function fixture(id, ids) {
  const e = loadEngine(html, {seed: 55});
  const p = new e.api.BattlePet({...e.api.findPet(id), skillIds: ids});
  const a = new e.api.BattlePet({...e.api.findPet('pet_qy'), skillIds: ['sk_qy_1', 'sk_qy_4']});
  p.maxHp = p.hp = a.maxHp = a.hp = 100000;
  Object.assign(e.api.gameState, {playerActive:p, aiActive:a, playerParty:[p], aiParty:[a], turnCount:0, messages:[], pendingFirstMove:'player'});
  return {e,p,a,ctx:e.api.createBattleContext()};
}
function use(f, id, owner=f.p, target=f.a) { f.e.api.findSkill(id).onUse(owner,target,f.ctx); }
function tick(f, n=1) { for(let i=0;i<n;i++) { f.e.api.gameState.turnCount++; f.e.sandbox.processTurnEffects(f.p); } }
function blocked(f, status='freeze') { f.p.status=null; f.p.statusTurns=0; f.ctx.applyStatus(f.p,status); assert.strictEqual(f.p.status,null, status+' 应被阻挡'); }
function permitted(f, status='freeze') { f.p.status=null; f.p.statusTurns=0; f.ctx.applyStatus(f.p,status); assert.strictEqual(f.p.status,status, status+' 应可施加'); f.p.status=null; }

test('光幕刷新后旧光幕到期，状态栏与残风临霜均保留防控', () => {
  const f = fixture('pet_jydm', ['sk_jydm_3','sk_jydm_2']);
  f.e.api.executeSkillTurn(f.p, f.a, f.p.skills[0], 'player');
  tick(f, 2);
  f.e.api.executeSkillTurn(f.p, f.a, f.p.skills[0], 'player');
  tick(f, 3);
  assert.match(f.e.sandbox.renderStatusBadges(f.p), /免疫全部异常 2回合/);
  f.ctx.modifyStat(f.p, 'spatk', -1);
  assert.strictEqual(f.p.spatkStage, 0);
  const next = new f.e.api.BattlePet(f.e.api.findPet('pet_qy'));
  f.e.api.gameState.playerParty.push(next);
  f.e.api.executeSkillTurn(f.a, f.p, f.a.skills[1], 'ai');
  assert.strictEqual(f.p.status, null);
  assert.strictEqual(f.e.api.gameState.playerActive, f.p);
  assert(f.e.api.gameState.messages.some(m => m.text.includes('免疫了冰冻')));
  tick(f, 2);
  permitted(f);
  f.ctx.modifyStat(f.p, 'spatk', -1);
  assert.strictEqual(f.p.spatkStage, -1);
});
test('降华到期不清除后施放的光幕', () => {
  const f=fixture('pet_jydm',['sk_jydm_1','sk_jydm_3']); use(f,'sk_jydm_1'); tick(f,2); use(f,'sk_jydm_3'); tick(f,4); blocked(f); tick(f,1); permitted(f);
});
test('明念结束不清除光幕，光幕结束不清除明念', () => {
  const f=fixture('pet_jydm',['sk_jydm_3']);
  f.e.sandbox.advanceMingnian(f.p,f.a,f.ctx,f.p.skills[0]);
  use(f,'sk_jydm_3'); tick(f,4); f.p.bloodline.onTurnStart(f.p,f.ctx); blocked(f);
  f.e.sandbox.advanceMingnian(f.p,f.a,f.ctx,f.p.skills[0]);
  tick(f,1); blocked(f);
});
test('清翎十二回合防控不被清念翼系三回合清除', () => {
  const f=fixture('pet_qy',['sk_qy_1','sk_qy_2','sk_qy_4']); f.p.bloodlineData={mode:'清念',qfzn:3,turnCount:0}; use(f,'sk_qy_1');
  f.p.bloodline.onSkillUse(f.p,f.a,f.ctx,f.e.api.findSkill('sk_qy_2')); tick(f,3); blocked(f); tick(f,9); permitted(f);
});
test('清羽残脉冰系防控同源叠加时长', () => {
  const f=fixture('pet_qy',['sk_qy_4','sk_qy_1']); f.p.bloodlineData={mode:'残脉',qfzn:0,turnCount:0};
  const ice=f.e.api.findSkill('sk_qy_4'); f.p.bloodline.onSkillUse(f.p,f.a,f.ctx,ice); f.p.bloodline.onSkillUse(f.p,f.a,f.ctx,ice);
  tick(f,3); blocked(f); tick(f,1); permitted(f);
});
test('微灵封体永久防控不被万念短防控到期清除', () => {
  const f=fixture('pet_qingling',['sk_ql_1','sk_ql_2']); use(f,'sk_ql_1'); use(f,'sk_ql_2'); tick(f,6); blocked(f); tick(f,10); blocked(f);
});
test('化念作刃使用当下防控，四回合后到期', () => {
  const f=fixture('pet_jydm',['sk_jydm_2']); use(f,'sk_jydm_2'); blocked(f); tick(f,3); blocked(f); tick(f,1); permitted(f);
});
test('覆体到期后创世之能携带被动仍阻挡睡眠', () => {
  const f=fixture('pet_bmhs',['sk_cszn','sk_fthy']); f.p.bloodline.onTurnStart(f.p,f.ctx); use(f,'sk_fthy'); tick(f,4); blocked(f,'sleep'); permitted(f,'burn');
});
test('清翎打断化念，光幕防控和速度依然按时到期', () => {
  const f = fixture('pet_jydm', ['sk_jydm_2', 'sk_jydm_3']);
  f.a.bloodlineData = { mode: '清念', qfzn: 3 };
  use(f, 'sk_jydm_3');
  use(f, 'sk_jydm_2');
  assert.ok(f.e.sandbox.isEjectImmune(f.p));
  use(f, 'sk_qy_1', f.a, f.p);
  assert.equal(f.p.statusImmunitySources.has('化念作刃'), false);
  assert.equal(f.e.sandbox.isEjectImmune(f.p), false);
  assert.equal(f.a.ppCostEffects.has('化念中段'), false);
  blocked(f);
  assert.equal(f.p.spdMod, 1.05);
  tick(f, 5);
  permitted(f);
  assert.equal(f.p.spdMod, 1);
});
test('残脉反弹冰冻时攻击者的光幕防控生效', () => {
  const f=fixture('pet_jydm',['sk_jydm_3']);
  f.a=new f.e.api.BattlePet({...f.e.api.findPet('pet_jydm'),skillIds:['sk_jydm_4']});
  f.a.hp=f.a.maxHp=100000; f.e.api.gameState.aiActive=f.a; f.e.api.gameState.aiParty=[f.a];
  use(f,'sk_jydm_3'); f.a.reflectBackhand=true; f.e.api.gameState.pendingFirstMove='ai';
  const attack={id:'test_freeze',name:'测试冰冻',element:'ice',category:'status',power:0,accuracy:100,priority:8,pp:5,maxPp:5,onUse(u,t,c){c.applyStatus(t,'freeze');}};
  f.e.api.executeSkillTurn(f.p,f.a,attack,'player');
  assert.strictEqual(f.p.status,null); assert.ok(f.e.api.gameState.messages.some(m=>String(m.text || m).includes('免疫了冰冻')));
});
test('创世之能零PP实时启用全异常防控，恢复后仅保留携带被动', () => {
  const f=fixture('pet_bmhs',['sk_cszn','sk_fthy']); const creation=f.p.skills[0];
  permitted(f,'burn'); blocked(f,'sleep'); creation.pp=0; blocked(f,'burn'); blocked(f,'sleep');
  creation.pp=1; permitted(f,'burn'); blocked(f,'sleep');
});
test('已有同种异常保留技能原分支和时长，防控仍优先判定', () => {
  const f = fixture('pet_jydm', ['sk_jydm_3']);
  f.p.status = 'sleep';
  f.p.statusTurns = 2;
  assert.strictEqual(f.ctx.applyStatus(f.p, 'sleep'), true);
  assert.strictEqual(f.p.statusTurns, 2);
  f.ctx.grantStatusImmunity(f.p, '测试防睡眠', 2, { statuses: ['sleep'] });
  assert.strictEqual(f.ctx.applyStatus(f.p, 'sleep'), false);
  assert.strictEqual(f.p.status, 'sleep');
  assert.strictEqual(f.p.statusTurns, 2);
});

test('通用净化清除寄生并阻止再次施加', () => {
  const cases = [
    ['pet_jydm', ['sk_jydm_3'], 'sk_jydm_3'],
    ['pet_qingling', ['sk_ql_1'], 'sk_ql_1'],
    ['pet_bmhs', ['sk_fthy'], 'sk_fthy'],
    ['pet_qy', ['sk_qy_1', 'sk_qy_4'], 'sk_qy_1']
  ];
  for (const [petId, skills, id] of cases) {
    const f = fixture(petId, skills);
    if (id === 'sk_qy_1') f.p.bloodlineData = {mode:'清念', qfzn:3, turnCount:0};
    assert.equal(f.ctx.applyStatus(f.p, 'leech_seed'), true, id);
    assert.equal(f.ctx.applyStatus(f.p, 'burn'), true, id);
    assert.equal(f.ctx.applyStatus(f.p, 'bind'), true, id);
    use(f, id);
    assert.equal(f.p.leechSeed, false, id);
    assert.equal(f.p.status, null, id);
    assert.equal(f.p.bindTurns, 0, id);
    assert.equal(f.ctx.applyStatus(f.p, 'leech_seed'), false, id);
    assert.match(f.e.sandbox.renderStatusBadges(f.p), /免疫(?:全部)?异常/);
  }
});

test('清念翼系和残脉冰系的条件净化清除寄生', () => {
  const cases = [
    ['清念', ['sk_qy_1', 'sk_qy_4', 'sk_qy_2'], 'sk_qy_2', 7],
    ['残脉', ['sk_qy_4', 'sk_qy_1'], 'sk_qy_4', 4]
  ];
  for (const [mode, skills, id, pp] of cases) {
    const f = fixture('pet_qy', skills);
    const skill = f.p.skills.find(skill => skill.id === id);
    assert.equal(f.ctx.applyStatus(f.p, 'leech_seed'), true, mode);
    f.p.bloodlineData = {mode, qfzn:0, turnCount:0, switchTurn:false};
    skill.pp = pp;
    f.p.bloodline.onSkillUse(f.p, f.a, f.ctx, skill);
    assert.equal(f.p.leechSeed, false, mode);
    assert.equal(f.ctx.applyStatus(f.p, 'leech_seed'), false, mode);
  }
});

test('通用防控拦截寄生种子，防控到期后可重新施加', () => {
  const f = fixture('pet_jydm', ['sk_jydm_2']);
  f.e.myMath.random = () => 0;
  const seed = () => f.e.sandbox.applyLegacyStatusSkill(f.a, f.p, {name:'寄生种子'});
  use(f, 'sk_jydm_2');
  seed();
  assert.equal(f.p.leechSeed, false);
  assert.ok(f.e.api.gameState.messages.some(m => m.text.includes('免疫了寄生')));
  const badges = f.e.sandbox.renderStatusBadges(f.p);
  assert.match(badges, /免疫异常 4回合<\/summary>/);
  assert.match(badges, /化念作刃（4回合） · [^<]*寄生/);
  tick(f, 4);
  seed();
  assert.equal(f.p.leechSeed, true);
});

test('原初血脉免疫寄生，点名免疫与零 PP 通用免疫按各自条件生效', () => {
  const original = fixture('pet_qy', ['sk_qy_1']);
  assert.equal(original.ctx.applyStatus(original.p, 'leech_seed'), false);

  const mark = fixture('pet_jydm', ['sk_jydm_3']);
  mark.e.sandbox.advanceMingnian(mark.p, mark.a, mark.ctx, mark.p.skills[0]);
  assert.equal(mark.ctx.applyStatus(mark.p, 'leech_seed'), true);
  assert.equal(mark.ctx.applyStatus(mark.p, 'freeze'), false);

  const creation = fixture('pet_bmhs', ['sk_cszn']);
  assert.equal(creation.ctx.applyStatus(creation.p, 'leech_seed'), true);
  creation.p.leechSeed = false;
  creation.p.skills[0].pp = 0;
  assert.equal(creation.ctx.applyStatus(creation.p, 'leech_seed'), false);
  creation.p.skills[0].pp = 1;
  assert.equal(creation.ctx.applyStatus(creation.p, 'leech_seed'), true);
});
test('官方互斥表：各组内后施加替换，跨组及束缚双向共存', () => {
  const pairs = [
    ['fear', 'burn', false], ['leech_seed', 'poison', false], ['confuse', 'freeze', false],
    ['fear', 'poison', true], ['fear', 'leech_seed', true], ['burn', 'poison', true],
    ['burn', 'leech_seed', true], ['confuse', 'leech_seed', true], ['sleep', 'bind', true]
  ];
  const present = (p, effect) => ({ poison:p.poisoned, leech_seed:p.leechSeed,
    confuse:p.confuseTurns > 0, bind:p.bindTurns > 0 }[effect] ?? p.status === effect);
  for (const [a, b, coexist] of pairs) for (const [first, second] of [[a,b], [b,a]]) {
    const f = fixture('pet_jydm', []);
    assert.equal(f.ctx.applyStatus(f.p, first), true);
    assert.equal(f.ctx.applyStatus(f.p, second), true);
    assert.equal(present(f.p, second), true, second);
    assert.equal(present(f.p, first), coexist, first + ' → ' + second);
  }
});

test('跨组掉血与控制独立回溯并在换宠面板复用的异常条显示', () => {
  const f = fixture('pet_jydm', []);
  assert.equal(f.ctx.applyStatus(f.p, 'fear', { turns:2 }), true);
  assert.equal(f.ctx.applyStatus(f.p, 'fear', { turns:6 }), true);
  assert.equal(f.p.statusTurns, 2);
  assert.equal(f.ctx.applyStatus(f.p, 'poison'), true);
  f.ctx.saveSnapshot();
  f.ctx.cleanseAbnormalStatuses(f.p);
  assert.equal(f.p.poisoned, false);
  f.ctx.restoreSnapshot(3);
  assert.match(f.e.sandbox.renderAbnormalBadges(f.p), /恐惧 2回合.*中毒/);
  const hp = f.p.hp;
  f.e.sandbox.applyEndOfTurnEffects(f.p);
  assert.equal(f.p.hp, hp - Math.floor(f.p.maxHp / 8));
  assert.equal(f.p.statusTurns, 2);
});

test('被防控挡住的新异常不会清除同组已有异常', () => {
  const f = fixture('pet_jydm', []);
  assert.equal(f.ctx.applyStatus(f.p, 'poison'), true);
  f.ctx.grantStatusImmunity(f.p, '测试免疫寄生', 2, { statuses: ['leech_seed'] });
  assert.equal(f.ctx.applyStatus(f.p, 'leech_seed'), false);
  assert.equal(f.p.poisoned, true);
});

test('单个免疫徽章体现覆盖范围，明念与多来源各自保留准确回合', () => {
  const f = fixture('pet_jydm', ['sk_jydm_3']);
  f.e.api.gameState.resolvingTurn = true;
  f.e.sandbox.advanceMingnian(f.p, f.a, f.ctx, f.p.skills[0]);
  f.ctx.grantStatusImmunity(f.p, '含 < 的测试防控', 5, {
    statuses: ['burn', 'freeze', 'paralyze', 'poison', 'sleep', 'deep_sleep', 'confuse', 'fear', 'leech_seed'],
    stats: true
  });
  let badges = f.e.sandbox.renderStatusBadges(f.p);
  assert.strictEqual((badges.match(/data-status-group="immune"/g) || []).length, 1);
  assert.match(badges, /免疫全部异常 4回合<\/summary>/);
  assert.match(badges, /明念（4回合） · [^<]*魔攻、速度的负面强化/);
  assert.match(badges, /含 &lt; 的测试防控（5回合） · [^<]*全部负面强化/);
  assert.doesNotMatch(f.e.sandbox.renderStatusBadges(f.a), /明念|测试防控/);
  tick(f, 4);
  badges = f.e.sandbox.renderStatusBadges(f.p);
  assert.match(badges, /免疫异常 1回合<\/summary>/);
  assert.doesNotMatch(badges, /明念|免疫全部异常/);
});

test('绝对回合效果随结算、选招及战斗结束显示，普通持续时长保持原计时', () => {
  const f = fixture('pet_jydm', ['sk_jydm_3']);
  const state = f.e.api.gameState;
  const badges = () => f.e.sandbox.renderStatusBadges(f.p);
  state.turnCount = 7;
  state.resolvingTurn = true;
  Object.assign(f.p, { powerDamageImmuneThroughTurn: 8, dimoFrostRecoveryThrough: 8,
    statLockedThrough: 7, dimoEjectImmuneThrough: 7, externalEffectImmuneTurn: 7,
    immuneBackhandEffects: true, immuneBackhand: true, invincible: true,
    blockPPRecoveryOnTurn: 8, hp: 1, lightWindThroughTurn: 7 });
  f.e.sandbox.advanceMingnian(f.p, f.a, f.ctx, f.p.skills[0]);
  f.p.bloodlineData.markThrough = 7;
  f.ctx.grantStatusImmunity(f.p, '常规防控', 3);
  assert.match(badges(), /免疫威力伤害 2回合/);
  assert.match(badges(), /回复减半 2回合/);
  assert.match(badges(), /明念（1回合）/);
  for (const effect of ['强化锁定', '免疫驱逐', '免疫伤害', '免疫外来效果', '免疫后手效果', '限伤 150']) {
    assert.ok(badges().includes(effect + ' 1回合'), effect);
  }
  assert.match(badges(), /下回合禁止回复 PP/);

  state.resolvingTurn = false;
  const selection = badges();
  assert.match(selection, /免疫威力伤害 1回合/);
  assert.match(selection, /回复减半 1回合/);
  assert.match(selection, /常规防控（3回合）/);
  assert.match(selection, />禁止回复 PP 1回合/);
  assert.doesNotMatch(selection, /明念|强化锁定|免疫驱逐|免疫伤害|免疫外来效果|免疫后手|限伤/);

  state.battleOver = true;
  const final = badges();
  assert.match(final, /免疫威力伤害 2回合/);
  assert.match(final, /强化锁定 1回合/);
  assert.match(final, /明念（1回合）/);
  assert.doesNotMatch(final, /禁止回复 PP/);
});

test('被动异常免疫的条件生效后扩展范围，PP 恢复后立即收窄', () => {
  const f = fixture('pet_bmhs', ['sk_cszn']);
  let badges = f.e.sandbox.renderStatusBadges(f.p);
  assert.match(badges, /免疫部分异常<\/summary>/);
  assert.match(badges, /创世之能（持续生效） · 冰冻、睡眠、恐惧、束缚/);
  f.p.skills[0].pp = 0;
  badges = f.e.sandbox.renderStatusBadges(f.p);
  assert.match(badges, /免疫全部异常<\/summary>/);
  assert.match(badges, /创世之能（0 PP）（条件生效）/);
  assert.strictEqual((badges.match(/data-status-group="immune"/g) || []).length, 1);
  f.p.skills[0].pp = 1;
  assert.doesNotMatch(f.e.sandbox.renderStatusBadges(f.p), /创世之能（0 PP）/);
});

test('状态栏显示有效精力上限、限伤减伤与持续效果', () => {
  const f = fixture('pet_jydm', ['sk_jydm_3']);
  Object.assign(f.p, { hp: 80, maxHp: 100, maxHpBonus: 60, damageCap: 80,
    damageCapThreshold: 90, damageCapTurns: 2, passiveDamageReduction: 20,
    damageReduction: 40, damageReductionTurns: 3, healInvertPct: 0.5, healInvertTurns: 4 });
  f.ctx.addTurnEffect(f.p, '测试持续回精', 2);
  assert.strictEqual(f.e.sandbox.battleMaxHp(f.p), 160);
  assert.strictEqual(f.e.sandbox.hpPercent(f.p), 50);
  let badges = f.e.sandbox.renderStatusBadges(f.p);
  assert.match(badges, /限伤 80 2回合/);
  assert.match(badges, /减伤 40% 3回合/);
  assert.match(badges, /治疗倒置 50% 4回合/);
  assert.match(badges, /测试持续回精 · 2回合/);
  f.e.api.gameState.banEffects = { damageCap: true, dmgReduction: true };
  badges = f.e.sandbox.renderStatusBadges(f.p);
  assert.doesNotMatch(badges, /限伤|减伤 40%/);
  assert.match(badges, /减伤 20%<\/span>/);
});

if (failed) { console.error(`${failed} regression(s) failed`); process.exitCode=1; }
