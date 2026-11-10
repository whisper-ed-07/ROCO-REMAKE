const path = require('path');
const root = process.argv[2] || path.resolve(__dirname, '../../..');
const fs=require('fs'), crypto=require('crypto');
const {loadEngine}=require(path.join(root, 'test/lib/harness.js'));
const html=path.join(root, 'ROCO REMAKE.html');
const output={baseline:'7cb4308',sha256:crypto.createHash('sha256').update(fs.readFileSync(html)).digest('hex'),checks:{}};
const qskills=['sk_qy_1','sk_qy_3','sk_qy_4','sk_qy_5'];
const jskills=['sk_jydm_2','sk_jydm_3','sk_jydm_4','sk_jydm_5'];
function setup(left='pet_qy',ls=qskills,right='pet_jydm',rs=jskills){const e=loadEngine(html,{seed:5}),a=e.api;const u=new a.BattlePet({...a.findPet(left),skillIds:ls}),t=new a.BattlePet({...a.findPet(right),skillIds:rs});Object.assign(a.gameState,{playerActive:u,aiActive:t,playerParty:[u],aiParty:[t],pendingFirstMove:'player',turnCount:1,messages:[],battleOver:false});u.bloodlineData={mode:'清念',turnCount:0,qfzn:0,healCount:0,marks:0,marked:false,markTurns:0,used:{}};t.bloodlineData={mode:'清念',turnCount:0,qfzn:0,healCount:0,marks:0,marked:false,markTurns:0,used:{}};return {...e,a,u,t,c:a.createBattleContext()};}
{
 const {u,t,c,sandbox}=setup();u.skills.find(s=>s.id==='sk_qy_5').onUse(u,t,c);const n=u.turnEffects.find(e=>e.name==='清念沉脉').turnsLeft;for(let i=0;i<n;i++)sandbox.processTurnEffects(u);const after={dmgMod:t.dmgMod,prioPenalty:t.prioPenalty,targetSkillUses:{...t.skillUseCounts}};for(let i=0;i<4;i++)sandbox.processTurnEffects(t);output.checks.R11={noTargetSkillEverUsed:after,afterFourMoreTurns:{dmgMod:t.dmgMod,prioPenalty:t.prioPenalty},permanencePass:t.dmgMod===.7,triggerGatePass:after.dmgMod===1};
}
{
 const {a,u,t,c}=setup();const sk=u.skills.find(s=>s.id==='sk_qy_3');a.executeSkillTurn(u,t,sk,'player');const afterUse={pp:sk.pp,saved:u.bloodlineData.qy3SavedPP,mode:u.bloodlineData.mode};u.skills.find(s=>s.id==='sk_qy_5').onUse(u,t,c);output.checks.R12={afterUse,afterQingnianToSameQingnian:{pp:sk.pp,saved:u.bloodlineData.qy3SavedPP??null,mode:u.bloodlineData.mode},postUseRecordPass:afterUse.saved===5,fullCycleRequiredPass:u.bloodlineData.qy3SavedPP!==undefined};
}
{
 const {u,c}=setup('pet_jydm',jskills,'pet_qy',qskills);u.skills.forEach(s=>s.pp--);u.bloodline.onTurnStart(u,c);const ppMissingMarked=u.bloodlineData.marked;u.skills.forEach(s=>u.skillUseCounts[s.id]=1);u.bloodline.onTurnStart(u,c);const first={marks:u.bloodlineData.marks,counts:{...u.skillUseCounts}};u.bloodline.onTurnStart(u,c);output.checks.R13={equipped:u.skills.map(s=>s.id),ppMissingAloneMarked:ppMissingMarked,afterAllUsed:first,afterNoFurtherUse:{marks:u.bloodlineData.marks,counts:{...u.skillUseCounts}},ppMissingPass:!ppMissingMarked,repeatRequiresNewUsePass:u.bloodlineData.marks===first.marks};
}
{
 const {u,t,c}=setup('pet_jydm',jskills,'pet_qy',qskills);t.statusImmunities.push('burn');const before=t.skills[3].pp;u.skills.find(s=>s.id==='sk_jydm_5').onUse(u,t,c);output.checks.R14={slot:4,targetSkill:t.skills[3].id,before,after:t.skills[3].pp,pass:t.skills[3].pp===0};
}
{
 const {u,t,c}=setup();u.bloodlineData.mode='残脉';u.hp=400;c.doFixedDamage(u,50,t);const afterHit=u.hp;u.bloodline.onTurnStart(u,c);const afterStart=u.hp;u.hp=250;c.doFixedDamage(u,50,t);output.checks.R16={maxHp:u.maxHp,after50DamageFrom400:afterHit,afterNoDamageTurnStart:afterStart,after50DamageFrom250:u.hp,pass:afterHit===531&&afterStart===531&&u.hp===200};
}
console.log(JSON.stringify(output,null,2));
