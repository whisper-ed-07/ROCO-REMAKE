const path = require('path');
const root = process.argv[2] || path.resolve(__dirname, '../../..');
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const {loadEngine, makeEl} = require(path.join(root, 'test/lib/harness.js'));
const HTML = path.join(root, 'ROCO REMAKE.html');
const results = [];
function environment() {
  const e = loadEngine(HTML, {seed:42});
  const nodes = new Map();
  function el() {
    const n = makeEl(), subs = new Map(); n.events = {};
    n.addEventListener = (type, fn) => { (n.events[type] ||= []).push(fn); };
    n.click = () => { if (!n.disabled) for (const fn of n.events.click || []) fn({stopPropagation(){}, target:n}); };
    n.querySelector = sel => { if (!subs.has(sel)) subs.set(sel, el()); return subs.get(sel); };
    let markup = ''; Object.defineProperty(n, 'innerHTML', {get(){return markup}, set(v){markup=v; n.children=[];}});
    n.insertAdjacentHTML = (pos, html) => { n.insertedHtml = html; };
    return n;
  }
  const q = sel => { if (!nodes.has(sel)) nodes.set(sel, el()); return nodes.get(sel); };
  e.sandbox.document = {...e.sandbox.document, querySelector:q, getElementById: id=>q('#'+id), createElement:el, body:el()};
  const timers = []; e.sandbox.setTimeout = (fn, ms) => { timers.push({fn,ms}); return timers.length; };
  e.nodes=nodes; e.q=q; e.timers=timers; return e;
}
function fields(e, data) { for (const [k,v] of Object.entries(data)) e.q(k).value=String(v); }
function petFields(e, p, name=p.name) {
  fields(e, {'#fp-name':name,'#fp-emoji':p.emoji,'#fp-element':p.element,'#fp-level':p.level});
  for (const k of ['hp','atk','def','spatk','spdef','spd']) e.q('#fp-'+k).value=String(k==='hp'?e.sandbox.calcHpAbility(p.baseStats[k],p.level):e.sandbox.calcAbility(p.baseStats[k],p.level));
  for(let i=0;i<4;i++)e.q('#fp-skill-'+i).value=p.skillIds[i]||'';
}

function saveSwap(e,p) {e.sandbox.openSkillSwap(p);e.q('#swap-detail').querySelector('#swap-save').click();}
// Fresh saves retain executable bloodlines and enforce four equipped skills / five owned skills.
{
 const e=environment(),p=e.api.DEFAULT_PETS[0];saveSwap(e,p);const out=e.api.findPet(p.id),bp=new e.api.BattlePet(out);
 assert.equal(typeof out.bloodline.onTurnStart,'function');assert.equal(typeof out.bloodline.onSkillUse,'function');
 assert.equal(out.skillIds.length,4);assert.equal(out.ownedSkillIds.length,5);assert.equal(bp.skills.length,4);
 results.push({check:'R02/new-four-slot-rule',pass:true,hooks:Object.keys(out.bloodline),equipped:out.skillIds,owned:out.ownedSkillIds});
}
// Pet editing persists, but the next real skill-save event wipes its metadata.
{
 const e=environment(),p=e.api.DEFAULT_PETS[0];petFields(e,p,'new-name');e.q('#fp-level').value='88';e.sandbox.savePetForm(true,p);
 const edited=e.api.findPet(p.id);assert.equal(edited.name,'new-name');assert.equal(edited.level,88);assert.equal(typeof edited.bloodline.onSkillUse,'function');
 saveSwap(e,edited);const after=e.api.findPet(p.id);
 results.push({check:'R09-edit-persisted-then-loadout-save-resets',residual:true,immediatelyAfterEdit:{name:edited.name,level:edited.level},afterSkillSave:{name:after.name,level:after.level}});
}
// Legacy valid four-slot config should survive upgrade; source record remains but is ignored.
{
 const e=environment(),p=e.api.DEFAULT_PETS[0],old={...p,name:'legacy-name',skillIds:[p.skillIds[4],p.skillIds[2],p.skillIds[1],p.skillIds[0]],ownedSkillIds:p.skillIds};
 e.sandbox.saveCustomPets([old]);const current=e.api.findPet(p.id);

 results.push({check:'legacy-custom-pet-built-in-override-not-migrated',residual:true,oldSkills:old.skillIds,currentBattleSkills:new e.api.BattlePet(current).skills.map(s=>s.id),recordStillExists:e.sandbox.loadCustomPets().length===1});
}
// Built-in skill edit still fails silently.
{
 const e=environment(),s=e.api.DEFAULT_SKILLS[0];fields(e,{'#fs-name':'edited-skill','#fs-element':s.element,'#fs-power':s.power,'#fs-pp':s.maxPp,'#fs-accuracy':s.accuracy,'#fs-category':s.category,'#fs-effect':'','#fs-effectChance':0,'#fs-desc':'edited'});
 e.sandbox.saveSkillForm(true,s);
 results.push({check:'builtin-skill-edit-still-no-op',residual:true,nameAfter:e.api.findSkill(s.id).name,customStorage:e.sandbox.localStorage.getItem(e.api.STORAGE_KEY_SKILLS)});
}
// Exact startup version snippets preserve old and unrelated keys.
{
 const e=environment(),ls=e.sandbox.localStorage;ls.clear();ls.setItem('pbg_custom_pets','["sentinel"]');ls.setItem('pbg_custom_skills','["sentinel"]');ls.setItem('unrelated','sentinel');
 for(const l of e.html.split(/\r?\n/).filter(l=>l.includes("if(!localStorage.getItem('roco_v5'))")||l.startsWith('if (!localStorage.getItem("pbg_v4_loaded"))')))vm.runInContext(l,e.sandbox);
 assert.equal(ls.getItem('pbg_custom_pets'),'["sentinel"]');assert.equal(ls.getItem('pbg_custom_skills'),'["sentinel"]');assert.equal(ls.getItem('unrelated'),'sentinel');results.push({check:'R01-version-snippets-preserve-storage',pass:true});
}
function battle(e) {
 function simple(id){const p=new e.api.BattlePet({...e.api.DEFAULT_PETS[0],id,name:id,bloodline:null});p.skills=[{id:'probe',name:'probe',element:'normal',category:'status',power:0,pp:20,maxPp:20,accuracy:100,priority:8,onUse(){}}];return p;}
 const p1=simple('p1'),p2=simple('p2'),a=simple('ai');Object.assign(e.api.gameState,{playerParty:[p1,p2],playerActive:p1,aiParty:[a],aiActive:a,battleOver:false,turnCount:0,messages:[],weather:null,field:null,battleId:1});return {p1,p2,a};
}
{
 const e=environment();battle(e);e.sandbox.playerSwitch(1);const timer=e.timers.find(t=>t.ms===800);assert(timer);assert.equal(e.q('#battle-actions').children.length,0);assert(e.q('#battle-actions').innerHTML.includes('换宠中'));
 assert.equal(e.api.gameState.turnCount,0);timer.fn();assert.equal(e.api.gameState.turnCount,1);assert.equal(e.api.gameState.switchPending,false);results.push({check:'R03-switch-lock-and-one-round',pass:true});
}
for(const kind of ['switch','auto-skip']) {
 const e=environment(),{p1}=battle(e);if(kind==='switch')e.sandbox.playerSwitch(1);else{p1.status='sleep';p1.statusTurns=3;e.sandbox.renderBattleActions();}
 const timer=e.timers.find(t=>t.ms===800);assert(timer);e.api.gameState.opponentTeamIds=[e.api.DEFAULT_PETS[1].id];p1.status=null;e.sandbox.confirmOpponentAndBattle();const id=e.api.gameState.battleId;timer.fn();assert.equal(e.api.gameState.turnCount,0);assert.equal(e.api.gameState.battleId,id);results.push({check:'R08-old-'+kind+'-callback-after-new-game',pass:true});
}
console.log(JSON.stringify(results,null,2));
