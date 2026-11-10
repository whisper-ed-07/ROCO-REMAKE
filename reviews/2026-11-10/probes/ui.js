const path = require('path');
const root = process.argv[2] || path.resolve(__dirname, '../../..');
const assert = require('assert');
const fs = require('fs');
const outputDir = process.env.ROCO_REVIEW_OUTPUT || require('path').join(__dirname, '../runs/manual');
fs.mkdirSync(outputDir, { recursive: true });
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
// 1. Invoke the actual skill-swap save event, then reload the pet via production lookup.
{
  const e=environment(), p=e.api.DEFAULT_PETS[0];
  const before=Object.keys(p.bloodline).filter(k=>typeof p.bloodline[k]==='function');
  e.sandbox.openSkillSwap(p); e.q('#swap-detail').querySelector('#swap-save').click();
  const after=e.api.findPet(p.id), bp=new e.api.BattlePet(after);
  assert(before.length>0); assert.equal(typeof bp.bloodline.onTurnStart,'undefined');
  function hpAfterStatus(data) {
    const user=new e.api.BattlePet(data), target=new e.api.BattlePet(e.api.DEFAULT_PETS[1]);
    user.hp=100;
    Object.assign(e.api.gameState,{playerActive:user,playerParty:[user],aiActive:target,aiParty:[target],battleOver:false,weather:null,field:null,pendingFirstMove:'player',messages:[]});
    e.api.executeSkillTurn(user,target,user.skills.find(s=>s.id==='sk_ql_4'),'player');
    return user.hp;
  }
  const defaultHP=hpAfterStatus(p), savedHP=hpAfterStatus(after);
  assert.equal(defaultHP,300); assert.equal(savedHP,100);
  results.push({probe:'skill-swap-erases-bloodline-hooks',pet:p.name,beforeHooks:before,afterBloodline:after.bloodline,initialHP:100,defaultHPAfterStatus:defaultHP,savedHPAfterStatus:savedHP,stored:e.sandbox.localStorage.getItem(e.api.STORAGE_KEY_PETS)});
}
// 2. Drive a switch, click the newly rendered skill button before its 800ms callback.
{
  const e=environment(), st=e.api.gameState;
  function simple(id) {
    const p=new e.api.BattlePet({...e.api.DEFAULT_PETS[0],id,name:id,bloodline:null});
    p.skills=[{id:'probe',name:'probe',element:'normal',category:'status',power:0,pp:20,maxPp:20,accuracy:100,priority:8,onUse(){}}];
    return p;
  }
  const p1=simple('p1'),p2=simple('p2'),a=simple('ai');
  Object.assign(st,{playerParty:[p1,p2],playerActive:p1,aiParty:[a],aiActive:a,battleOver:false,turnCount:0,messages:[],weather:null,field:null});
  e.sandbox.playerSwitch(1);
  const switchTimer=e.timers.find(t=>t.ms===800), button=e.q('#battle-actions').children.find(n=>n.className.startsWith('skill-btn'));
  assert(switchTimer); assert(button); assert.equal(button.disabled,false);
  button.click(); const afterClick={turn:st.turnCount,playerPP:p2.skills[0].pp,aiPP:a.skills[0].pp};
  switchTimer.fn(); const afterTimer={turn:st.turnCount,playerPP:p2.skills[0].pp,aiPP:a.skills[0].pp};
  assert.equal(afterClick.turn,1); assert.equal(afterClick.playerPP,19); assert.equal(afterTimer.turn,2); assert.equal(afterTimer.aiPP,18);
  results.push({probe:'switch-window-allows-two-rounds',afterClick,afterTimer,messages:st.messages.map(m=>m.text)});
}
// 3. Run the exact startup migration code with an existing unrelated same-origin key.
{
  const e=environment(), ls=e.sandbox.localStorage;
  ls.clear(); ls.setItem('pbg_v4_loaded','1');
  ls.setItem('pbg_custom_pets',JSON.stringify([{...e.api.DEFAULT_PETS[0],id:'custom_pet_old',name:'legacy',bloodline:null}]));
  ls.setItem('unrelated_app_setting','keep-me');
  const line=e.html.split(/\r?\n/).find(l=>l.includes("if(!localStorage.getItem('roco_v5'))"));
  vm.runInContext(line,e.sandbox);
  assert.equal(ls.getItem('pbg_custom_pets'),null); assert.equal(ls.getItem('unrelated_app_setting'),null);
  results.push({probe:'startup-clears-old-and-unrelated-storage',petStorage:ls.getItem('pbg_custom_pets'),unrelatedKey:ls.getItem('unrelated_app_setting'),version:ls.getItem('roco_v5')});
}
// 4. Built-in pet/skill edit flows silently fail to create an override on a clean profile.
{
  const e=environment(), p=e.api.DEFAULT_PETS[0], s=e.api.DEFAULT_SKILLS[0];
  petFields(e,p,'edited-pet'); e.sandbox.savePetForm(true,p);
  fields(e,{'#fs-name':'edited-skill','#fs-element':s.element,'#fs-power':s.power,'#fs-pp':s.maxPp,'#fs-accuracy':s.accuracy,'#fs-category':s.category,'#fs-effect':'','#fs-effectChance':0,'#fs-desc':'edited'});
  e.sandbox.saveSkillForm(true,s);
  assert.equal(e.api.findPet(p.id).name,p.name); assert.equal(e.api.findSkill(s.id).name,s.name);
  results.push({probe:'builtin-edits-silently-discarded',petName:e.api.findPet(p.id).name,skillName:e.api.findSkill(s.id).name,petStorage:e.sandbox.localStorage.getItem(e.api.STORAGE_KEY_PETS),skillStorage:e.sandbox.localStorage.getItem(e.api.STORAGE_KEY_SKILLS)});
}
// 5. Existing five-skill pet is saved with only four skills even without skill edits.
{
  const e=environment(), p=e.api.DEFAULT_PETS[0];
  e.sandbox.openSkillSwap(p); e.q('#swap-detail').querySelector('#swap-save').click();
  const stored=e.api.findPet(p.id); assert.equal(stored.skillIds.length,5);
  e.sandbox.showPetForm(stored); const form=e.sandbox.document.body.insertedHtml;
  assert(!form.includes('id="fp-skill-4"'));
  petFields(e,stored); e.sandbox.savePetForm(true,stored);
  const after=e.api.findPet(p.id); assert.equal(after.skillIds.length,4);
  results.push({probe:'pet-edit-removes-fifth-equipped-skill',before:stored.skillIds,after:after.skillIds,ownedAfter:after.ownedSkillIds});
}
fs.writeFileSync(require('path').join(outputDir, 'ui-results.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
// AI policy observation: all four pets x all four opponents choose identically at full HP and 1 HP.
{
  const e=environment(), st=e.api.gameState, rows=[];
  e.sandbox.resolveTurn=()=>{};
  for(const ap of e.api.DEFAULT_PETS) for(const pp of e.api.DEFAULT_PETS) {
    const ai=new e.api.BattlePet(ap), p=new e.api.BattlePet(pp);
    Object.assign(st,{playerActive:p,aiActive:ai,battleOver:false});
    e.sandbox.aiDecideAndResolve(); const high=ai.skills[st.pendingAISkill];
    ai.hp=1; e.sandbox.aiDecideAndResolve(); const low=ai.skills[st.pendingAISkill];
    rows.push({ai:ap.name,opponent:pp.name,fullHP:high.name,hp1:low.name});
  }
  fs.writeFileSync(require('path').join(outputDir, 'ai-observations.json'),JSON.stringify(rows,null,2));
}
