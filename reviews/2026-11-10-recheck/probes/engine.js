const path = require('path');
const root = process.argv[2] || path.resolve(__dirname, '../../..');
const {loadEngine}=require(path.join(root, 'test/lib/harness.js'));
function env(){const e=loadEngine(path.join(root, 'ROCO REMAKE.html'),{seed:55});for(const k of ['renderBattle','renderBattleActions','updateBattleUI','spawnFloatText','showScreen'])e.sandbox[k]=()=>{};return e;}
function sk(id,f=()=>{},priority=8,pp=5){return{id,name:id,element:'normal',category:'status',power:0,accuracy:100,priority,pp,maxPp:5,onUse:f};}
function pet(e,id,s=sk('idle'),spd=100){let p=new e.api.BattlePet({id,name:id,element:'normal',emoji:'X',level:100,baseStats:{hp:200,atk:100,def:100,spatk:100,spdef:100,spd},skillIds:[]});p.skills=s?[s]:[];return p;}
function setup(e,p,a){Object.assign(e.api.gameState,{playerActive:p,aiActive:a,playerParty:[p],aiParty:[a],battleOver:false,turnCount:0,pendingPlayerSkill:0,pendingAISkill:0,skipPlayerAction:false,messages:[],snapshots:[],ppHistory:[]});}
function run(e){e.api.gameState.pendingPlayerSkill=0;e.api.gameState.pendingAISkill=0;e.sandbox.resolveTurn();}
function out(name,result){console.log(JSON.stringify({name,...result}));}
{
const e=env(),p=pet(e,'p'),a=pet(e,'a');setup(e,p,a);Object.assign(e.api.gameState,{weather:'sandstorm',weatherTurns:6,field:'dream',fieldTurns:6,forceSkillElement:'light',forceSkillElementTurns:6});run(e);out('REGRESSION_double_tick',{turn:e.api.gameState.turnCount,weather:e.api.gameState.weatherTurns,field:e.api.gameState.fieldTurns,element:e.api.gameState.forceSkillElementTurns,expectedEach:5});
}
{
const e=env(),p=pet(e,'p'),a=pet(e,'a');setup(e,p,a);for(const x of [p,a]){x.status='sleep';x.statusTurns=1;}for(let i=0;i<4;i++)run(e);out('REGRESSION_cache_deadlock',{turn:e.api.gameState.turnCount,pStatus:p.status,aStatus:a.status,pCanAct:p.canAct(),aCanAct:a.canAct(),pPP:p.skills[0].pp,aPP:a.skills[0].pp});
}
{
const e=env(),p=new e.api.BattlePet(e.api.findPet('pet_bmhs')),a=pet(e,'struggle',null,200);p.hp=1;p.skills=[sk('idle')];setup(e,p,a);run(e);out('PASS_R06_single_lethal',{hp:p.hp,over:e.api.gameState.battleOver,handled:p.lethalHandled});p.status='poison';run(e);out('REGRESSION_lethal_reset',{hp:p.hp,over:e.api.gameState.battleOver,handled:p.lethalHandled,log:e.api.gameState.messages.slice(-8)});
}
{
const e=env();let count=0;const p=pet(e,'p',sk('queued',()=>count++,8,1)),a=pet(e,'a',sk('cut',(u,t,c)=>c.deletePP(t,0,1),15));setup(e,p,a);run(e);out('PASS_R04_zero_pp',{count,pp:p.skills[0].pp});
}
{
const e=env();let count=0;const p=new e.api.BattlePet(e.api.findPet('pet_qy')),a=pet(e,'a',sk('queued',()=>count++)),b=pet(e,'bench');setup(e,p,a);e.api.gameState.aiParty.push(b);e.api.gameState.pendingPlayerSkill=3;e.sandbox.resolveTurn();out('PASS_R05_eject',{active:e.api.gameState.aiActive.name,count});
}
{
const e=env(),p=new e.api.BattlePet(e.api.findPet('pet_jydm')),a=pet(e,'a');setup(e,p,a);e.api.findSkill('sk_jydm_1').onUse(p,a,e.api.createBattleContext());e.api.gameState.selectedTeamIds=['pet_qy'];e.sandbox.startBattle();e.api.gameState.opponentTeamIds=['pet_jydm'];e.sandbox.confirmOpponentAndBattle();out('PASS_R07_reset',{element:e.api.gameState.forceSkillElement,buff:e.api.gameState.jianghuaBuff,pending:e.api.gameState.pendingJianghua});
}
{
const e=loadEngine(path.join(root, 'ROCO REMAKE.html'),{seed:55}),p=pet(e,'p'),a=pet(e,'a');setup(e,p,a);p.status='sleep';p.statusTurns=3;e.sandbox.renderBattleActions();for(const k of ['renderBattleActions','renderBattle','updateBattleUI','spawnFloatText','showScreen'])e.sandbox[k]=()=>{};e.api.gameState.selectedTeamIds=['pet_qy'];e.sandbox.startBattle();e.api.gameState.opponentTeamIds=['pet_jydm'];e.sandbox.confirmOpponentAndBattle();e.clock.advance(800);out('PASS_R08_timeout',{turn:e.api.gameState.turnCount});
}
{
const e=env(),p=new e.api.BattlePet(e.api.findPet('pet_qy')),a=pet(e,'a');setup(e,p,a);p.bloodlineData={mode:'残脉',turnCount:1,qfzn:0,healCount:0};p.hp=p.maxHp-50;e.api.createBattleContext().doFixedDamage(p,100);out('PASS_R16_heal',{hp:p.hp,max:p.maxHp});
}
