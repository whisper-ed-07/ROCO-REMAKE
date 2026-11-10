const path = require('path');
const root = process.argv[2] || path.resolve(__dirname, '../../..');
const {loadEngine}=require(path.join(root, 'test/lib/harness.js'));
const HTML=path.join(root, 'ROCO REMAKE.html');
function setup(left='pet_qy',right='pet_jydm'){
 const e=loadEngine(HTML,{seed:5}), a=e.api;
 const u=new a.BattlePet(a.findPet(left)), t=new a.BattlePet(a.findPet(right));
 Object.assign(a.gameState,{playerActive:u,aiActive:t,playerParty:[u],aiParty:[t],pendingFirstMove:'player',turnCount:1,messages:[],battleOver:false});
 u.bloodlineData={mode:'清念',turnCount:0,qfzn:0,healCount:0,marks:0,used:{}};
 t.bloodlineData={mode:'清念',turnCount:0,qfzn:0,healCount:0,marks:0,used:{}};
 return {...e,a,u,t,c:a.createBattleContext()};
}
const out={};
{
 const {u,t,c,sandbox}=setup();
 u.skills.find(s=>s.id==='sk_qy_5').onUse(u,t,c);
 const duration=u.turnEffects.find(e=>e.name==='清念沉脉').turnsLeft;
 for(let i=0;i<duration;i++) sandbox.processTurnEffects(u);
 const active={dmgMod:t.dmgMod,prioPenalty:t.prioPenalty};
 for(let i=0;i<4;i++) sandbox.processTurnEffects(t);
 out.qy5={duration,atWindowStart:active,afterWindow:{dmgMod:t.dmgMod,prioPenalty:t.prioPenalty}};
}
{
 const {u,t,c}=setup(); const sk=u.skills.find(s=>s.id==='sk_qy_3'); sk.pp=3;
 sk.onUse(u,t,c);
 const afterClear=sk.pp;
 u.bloodlineData.switchTurn=true;
 u.bloodline.onSkillUse(u,t,c,{id:'probe_ice',element:'ice',pp:9,maxPp:9});
 const afterCanmai=sk.pp;
 u.bloodlineData.switchTurn=true;
 u.bloodline.onSkillUse(u,t,c,{id:'probe_flying',element:'flying',pp:9,maxPp:9});
 out.qy3={ppBeforeClear:3,afterClear,afterCanmai,afterQingnian:sk.pp,mode:u.bloodlineData.mode};
}
{
 const {u,t,c}=setup('pet_jydm','pet_qy');
 for(let i=0;i<4;i++)u.skills[i].pp--;
 u.bloodline.onTurnStart(u,c);
 out.mingnian={actualSkillUseCounts:u.skillUseCounts,fifthSkillPP:u.skills[4].pp,fifthSkillMaxPP:u.skills[4].maxPp,marked:u.bloodlineData.marked,marks:u.bloodlineData.marks};
}
{
 const {u,t,c}=setup('pet_jydm','pet_qy');
 t.statusImmunities.push('burn');
 const slot=4,before=t.skills[slot].pp;
 u.skills[slot].onUse(u,t,c);
 out.chiguang={userSkill:u.skills[slot].name,userPP:u.skills[slot].pp,targetSameSlotSkill:t.skills[slot].name,targetPPBefore:before,targetPPAfter:t.skills[slot].pp};
}
{
 const {u,t,c,a}=setup('pet_bmhs','pet_qy');
 u.hp=200; u.status='burn'; t.hp=350;
 c.saveSnapshot();
 a.gameState.turnCount=4; u.hp=150; u.status='poison'; t.hp=300;
 const before={hp:u.hp,status:u.status};
 u.skills.find(s=>s.id==='sk_nlex').onUse(u,t,c);
 out.nlex={snapshotTurns:a.gameState.snapshots.map(s=>s.turn),oldState:{hp:200,status:'burn'},before,after:{hp:u.hp,status:u.status}};
}
{
 const {u,t,c}=setup(); u.bloodlineData.mode='残脉'; u.hp=400;
 c.doFixedDamage(u,50,t); const afterHit=u.hp;
 u.bloodline.onTurnStart(u,c);
 out.canmaiHeal={maxHp:u.maxHp,beforeHit:400,damage:50,afterHit,afterTurnStart:u.hp};
}
console.log(JSON.stringify(out,null,2));
