const path = require('path');
const root = process.argv[2] || path.resolve(__dirname, '../../..');
const { loadEngine } = require(path.join(root, 'test/lib/harness.js'));
const html = path.join(root, 'ROCO REMAKE.html');
function fresh() {
  const e = loadEngine(html, {seed: 55});
  const {api:a,sandbox:s} = e;
  s.updateBattleUI = () => {};
  s.renderBattle = () => {};
  s.showScreen = () => {};
  s.renderBattleActions = () => {};
  s.spawnFloatText = () => {};
  s.setTimeout = () => 0;
  return e;
}
function plain(a,name,skill,spd=100) {
  const p = new a.BattlePet({id:name,name,element:'normal',emoji:'X',level:100,
    baseStats:{hp:200,atk:100,def:100,spatk:100,spdef:100,spd},skillIds:[]});
  p.skills=skill ? [skill] : [];
  return p;
}
function skill(id,onUse,priority=8,pp=5) {
  return {id,name:id,element:'normal',category:'status',power:0,accuracy:100,priority,pp,maxPp:5,onUse};
}
function setup(e,p,a,pp=[p],ap=[a]) {
  Object.assign(e.api.gameState,{playerActive:p,aiActive:a,playerParty:pp,aiParty:ap,
    battleOver:false,turnCount:0,pendingPlayerSkill:0,pendingAISkill:0,
    skipPlayerAction:false,weather:null,field:null,messages:[],snapshots:[],ppHistory:[]});
}
function out(name,data){console.log(JSON.stringify({name,...data}));}

// The enemy's first action deletes the last PP of an already queued action.
{
 const e=fresh(), a=e.api; let uses=0;
 const p=plain(a,'slow',skill('queued',()=>{uses++},8,1));
 const q=plain(a,'fast',skill('delete',(u,t,c)=>c.deletePP(t,0,1),15));
 setup(e,p,q); e.sandbox.resolveTurn();
 out('queued_zero_pp',{uses,pp:p.skills[0].pp,log:a.gameState.messages});
}
// A first-move control effect should prevent the queued slower action.
{
 const e=fresh(), a=e.api; let uses=0;
 const p=plain(a,'slow',skill('queued',()=>{uses++}));
 const q=plain(a,'fast',skill('sleep',(u,t,c)=>c.applyStatus(t,'sleep'),15));
 setup(e,p,q);e.sandbox.resolveTurn();
 out('queued_sleep',{uses,status:p.status,pp:p.skills[0].pp,log:a.gameState.messages});
}
// Exhausted skills produce struggle through the legacy damage path.
{
 const e=fresh(), a=e.api;
 const p=new a.BattlePet(a.findPet('pet_bmhs'));p.hp=1;p.skills.forEach(s=>s.pp=0);
 const q=plain(a,'fast-struggle',null,200);
 setup(e,p,q); e.sandbox.resolveTurn();
 out('lethal_survival_vs_faint',{hp:p.hp,battleOver:a.gameState.battleOver,lethal:p.lethalHitThisTurn,log:a.gameState.messages});
}
// An auto-pass timeout remains queued when a fresh battle is confirmed.
{
 const e=fresh(), a=e.api,s=e.sandbox;const queue=[];
 const original = loadEngine(html,{seed:55});
 // Use the original function in its own VM, replacing rendering only after scheduling.
 const b=original.api,z=original.sandbox;z.spawnFloatText=()=>{};z.updateBattleUI=()=>{};z.renderBattle=()=>{};z.showScreen=()=>{};
 z.setTimeout=(fn,ms)=>{queue.push({fn,ms});return queue.length};
 const p=plain(b,'old-sleep',skill('idle',()=>{}));p.status='sleep';p.statusTurns=3;
 const q=plain(b,'old-enemy',skill('idle2',()=>{}));setup(original,p,q);
 z.renderBattleActions();
 const delayed=queue.find(t=>t.ms===800);
 z.renderBattleActions=()=>{};
 b.gameState.selectedTeamIds=['pet_qy'];z.startBattle();b.gameState.opponentTeamIds=['pet_jydm'];z.confirmOpponentAndBattle();
 const before=b.gameState.turnCount;delayed.fn();
 out('old_timeout_new_battle',{before,after:b.gameState.turnCount,log:b.gameState.messages});
}
// Force-element and global buff ownership survive the new-battle reset.
{
 const e=fresh(),a=e.api,s=e.sandbox;
 const p=new a.BattlePet(a.findPet('pet_jydm')),q=plain(a,'enemy',skill('idle',()=>{}));setup(e,p,q);
 a.findSkill('sk_jydm_1').onUse(p,q,a.createBattleContext());
 a.gameState.selectedTeamIds=['pet_qy'];s.startBattle();a.gameState.opponentTeamIds=['pet_jydm'];s.confirmOpponentAndBattle();
 const initial={forceSkillElement:a.gameState.forceSkillElement,turns:a.gameState.forceSkillElementTurns,globalBuff:a.gameState.jianghuaBuff,playerDmgMod:a.gameState.playerActive.dmgMod};
 a.findSkill('sk_jydm_1').onUse(a.gameState.aiActive,a.gameState.playerActive,a.createBattleContext());
 out('global_buff_new_battle',{initial,afterRecast:{playerDmgMod:a.gameState.playerActive.dmgMod,aiDmgMod:a.gameState.aiActive.dmgMod}});
}
// Real Qingyu eject switches the active pointer, but the old actor is still queued.
{
 const e=fresh(),a=e.api;let oldUses=0;
 const p=new a.BattlePet(a.findPet('pet_qy'));
 const q=plain(a,'ejected',skill('queued',()=>{oldUses++}));
 const bench=plain(a,'bench',skill('bench-idle',()=>{}));
 setup(e,p,q,[p],[q,bench]);a.gameState.pendingPlayerSkill=3;e.sandbox.resolveTurn();
 out('ejected_pet_acts',{active:a.gameState.aiActive.name,oldUses,oldStatus:q.status,oldPP:q.skills[0].pp,log:a.gameState.messages});
}
// Both sides are asleep: status advances, but all other turn bookkeeping is skipped.
{
 const e=fresh(),a=e.api;
 const p=plain(a,'sleep1',skill('idle',()=>{})),q=plain(a,'sleep2',skill('idle2',()=>{}));
 for(const pet of [p,q]){pet.status='sleep';pet.statusTurns=3;}
 setup(e,p,q);a.gameState.weather='sandstorm';a.gameState.weatherTurns=3;
 const hp=p.hp;e.sandbox.resolveTurn();
 out('both_controlled',{turnCount:a.gameState.turnCount,statusTurns:p.statusTurns,weatherTurns:a.gameState.weatherTurns,hpBefore:hp,hpAfter:p.hp,log:a.gameState.messages});
}
// Already registered Qingyu M1: post-hit regeneration does not run.
{
 const e=fresh(),a=e.api;
 const p=new a.BattlePet(a.findPet('pet_qy'));p.bloodlineData={mode:'残脉',turnCount:1,qfzn:0,healCount:0};
 const q=plain(a,'enemy',skill('idle',()=>{}));setup(e,p,q);p.hp=p.maxHp-50;
 const before=p.hp;a.createBattleContext().doFixedDamage(p,100);
 out('known_qingyu_m1',{maxHp:p.maxHp,before,after:p.hp,expected:Math.min(p.maxHp,before-100+Math.floor(p.maxHp*.3))});
}
