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
  const f = fixture('pet_jydm', ['sk_jydm_3']);
  f.e.api.executeSkillTurn(f.p, f.a, f.p.skills[0], 'player');
  tick(f, 2);
  f.e.api.executeSkillTurn(f.p, f.a, f.p.skills[0], 'player');
  tick(f, 3);
  assert.match(f.e.sandbox.renderStatusBadges(f.p), /免疫异常 2回合/);
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
  const f=fixture('pet_jydm',['sk_jydm_3']); f.p.bloodlineData={marks:0,marked:true,markTurns:2,used:{},jianghuaTurns:0};
  f.p.bloodline.onTurnStart(f.p,f.ctx); use(f,'sk_jydm_3'); f.p.bloodline.onTurnStart(f.p,f.ctx); blocked(f);
  f.p.bloodlineData.marked=true; f.p.bloodlineData.markTurns=10; f.p.bloodline.onTurnStart(f.p,f.ctx); tick(f,5); blocked(f);
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
test('清翎清除对方有限防控，保留永久防控', () => {
  function clear(id, ids, permanent) {
    const f=fixture(id,ids); f.a.bloodlineData={mode:'清念',qfzn:3,turnCount:0};
    if (permanent) use(f,'sk_ql_1'); use(f,'sk_jydm_3'); blocked(f);
    use(f,'sk_qy_1',f.a,f.p); if (permanent) blocked(f); else permitted(f);
  }
  clear('pet_jydm',['sk_jydm_3'],false); clear('pet_qingling',['sk_ql_1'],true);
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
if (failed) { console.error(`${failed} regression(s) failed`); process.exitCode=1; }
