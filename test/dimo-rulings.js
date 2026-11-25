const assert = require('node:assert/strict');
const path = require('node:path');
const { loadEngine, makeEl } = require('./lib/harness');
const e = loadEngine(path.join(__dirname, '..', 'ROCO REMAKE.html'));
const { api, sandbox: vm, myMath } = e;
myMath.random = () => 0.5;
let checks = 0;
const check = (label, run) => { run(); checks++; console.log('PASS ' + label); };
const init = ids => {
  const p = new api.BattlePet({...api.findPet('pet_jydm'), skillIds:ids});
  const a = new api.BattlePet({...api.findPet('pet_qy'), skillIds:['sk_qy_3']});
  const b = new api.BattlePet({...api.findPet('pet_qy'), skillIds:['sk_qy_4']});
  Object.assign(api.gameState, { playerActive:p, aiActive:a, playerParty:[p], aiParty:[a,b], turnCount:10, messages:[], resolvingTurn:false, weather:null,field:null, pendingFirstMove:'player', banEffects:null, fieldLockedThrough:-1, jianghuaOwners:new Set(), pendingJianghuaByPet:new Map() });
  for (const pet of [p,a,b]) pet.hp = pet.maxHp = 10000;
  return {p,a,b,ctx:api.createBattleContext(),g:api.gameState};
};
check('明念在出招结束时标记，重标刷新到5，离场保留印记', ()=>{
  const {p,a,ctx,g}=init(['sk_jydm_2','sk_jydm_3']);
  p.bloodline.onActionEnd(p,a,ctx,p.skills[0]);
  assert.equal(p.bloodlineData.markTarget,undefined);
  p.bloodline.onActionEnd(p,a,ctx,p.skills[1]);
  assert.equal(p.bloodlineData.markTarget,a); assert.equal(p.bloodlineData.marks,0);
  g.turnCount+=3;
  p.bloodline.onActionEnd(p,a,ctx,p.skills[0]); p.bloodline.onActionEnd(p,a,ctx,p.skills[1]);
  assert.equal(p.bloodlineData.markThrough,g.turnCount+4); assert.equal(p.bloodlineData.marks,1);
  p.hp-=200; ctx.doHeal(p,100); assert.equal(p.maxHp-85,p.hp);
  vm.leaveBattlefield(a);
  assert.equal(p.bloodlineData.markTarget,undefined); assert.equal(p.bloodlineData.marks,1); assert.equal(p.healMod,1);
});
check('极尽降华保护3回合，真正删空、仍在场才被动', ()=>{
  const {p,a,ctx,g}=init(['sk_jydm_1','sk_jydm_3']);
  g.turnCount=0; p.bloodline.onEnter(p);
  g.turnCount=3; assert.equal(ctx.deletePP(p,0,1).length,0);
  g.turnCount=4; assert.equal(ctx.deletePP(p,0,1).length,1);
  vm.resolveJianghuaDeletions();
  assert.equal(p.bloodlineData.markTarget,a);
  assert.equal(p.skills[0].pp,0);
  p.skills[0].pp=1;ctx.deletePP(p,0,1);vm.leaveBattlefield(p);vm.resolveJianghuaDeletions();
  assert.equal(p.bloodlineData.jianghuaCasts,1);
});
check('降华区分6和12回合、外免与累计限伤', ()=>{
  const {p,a,b,ctx,g}=init(['sk_jydm_1','sk_jydm_3']);
  p.skills[0].pp=0;
  p.bloodline.onActionEnd(p,a,ctx,p.skills[1]);
  p.skills[0].onUse(p,a,ctx);
  ctx.skillAction={user:a,target:p,backhand:true};
  assert.equal(ctx.applyStatus(p,'freeze'),false);
  assert.equal(p.bloodlineData.jianghuaCap,300);
  g.turnCount=11;
  assert.equal(p.takeDamage(160,a),160); assert.equal(p.takeDamage(160,a),140); assert.equal(p.takeDamage(20,a),0);
  assert.equal(p.bloodlineData.marks,1);
  g.turnCount=16;
  assert.equal(vm.getEffectiveSkillElement(a,'ice'),'light'); assert.equal(vm.getEffectiveSkillElement(b,'ice'),'ice');
});
check('光幕三损跨越释放回合且不会因同回合重复凑数', ()=>{
  const {p,a,ctx,g}=init(['sk_jydm_3']);
  const opp=a.skills[0];
  vm.recordDimoSkillRound(a,opp);
  vm.recordDimoSkillRound(a,opp);
  g.turnCount++;
  p.skills[0].onUse(p,a,ctx);
  vm.recordDimoSkillRound(a,opp);
  assert.equal(a.ppCostEffects,undefined);
  g.turnCount++;
  vm.recordDimoSkillRound(a,opp);
  assert.equal(a.ppCostEffects.get('光幕三损:0').extra,2);
});
check('瞬华后手冻不住仍锁梦并回复普通技能PP', ()=>{
  const {p,a,ctx,g}=init(['sk_jydm_4','sk_jydm_1','sk_jydm_3']);
  g.pendingFirstMove='ai';
  p.bloodlineData={marks:4};
  p.skills[1].pp=0;p.skills[2].pp=0;
  ctx.grantStatusImmunity(a,'test',Infinity,{statuses:['freeze']});
  p.skills[0].onUse(p,a,ctx);
  assert.equal(g.field,'dream'); assert.equal(g.fieldLockedThrough,g.turnCount+2);
  assert.equal(a.status,null); assert.equal(p.skills[1].pp,0); assert.equal(p.skills[2].pp,5);
});

check('化念先手仅闪避成功时用临时物攻+2，无动作正常结算', ()=>{
  const {p,a,ctx,g}=init(['sk_jydm_2']);
  const saved = ctx.doDamage, calls=[];
  ctx.doDamage = function(...args) { calls.push(args[5]?.atkStageOverride); return saved.apply(this,args); };
  g.resolvingTurn=true;
  ctx.skillAction={user:p,target:a,backhand:false};
  ctx.sourceSkill=p.skills[0]; ctx.sourceSkillOwner=p;
  p.atkStage=-1;
  p.skills[0].onUse(p,a,ctx);
  assert.equal(calls.length,0);
  assert.equal(vm.resolveDimoFirstAttack(p,{accuracy:80}),true);
  assert.deepEqual(calls,[2]); assert.equal(p.atkStage,-1);
  ctx.skillAction={user:p,target:a,backhand:false};
  p.skills[0].onUse(p,a,ctx);
  assert.equal(vm.resolveDimoFirstAttack(p),null);
  assert.deepEqual(calls,[2,undefined]);
});
check('天气和环境共同计数，第三次确切惩罚999且不改变场地', ()=>{
  const {p,a,ctx,g}=init(['sk_jydm_1']);
  p.skills[0].onUse(p,a,ctx);
  const before=a.hp;
  ctx.sourceSkillOwner=a;
  assert.equal(ctx.setWeather('mist',3),false);
  assert.equal(ctx.setField('dream',3),false);
  assert.equal(a.hp,before);
  assert.equal(ctx.setWeather('rainy',3),false);
  assert.equal(a.hp,before-Math.floor(999 * (100-a.getDamageReduction())/100));
  assert.equal(g.weather,null); assert.equal(g.field,null);
});

check('三神系使用页游官方进攻和防守倍率，逆流正常结算为神水', () => {
  const ordinary = Object.keys(api.ELEMENTS).filter(key => !key.startsWith('_') && !key.startsWith('divine_'));
  const gods = ['divine_water', 'divine_fire', 'divine_grass'];
  const resistances = {
    divine_fire: ['grass', 'ice', 'bug', 'steel'],
    divine_grass: ['water', 'electric', 'grass', 'earth'],
    divine_water: ['fire', 'ice', 'steel'],
  };
  assert.equal(ordinary.length, 18);
  for (const [index, attacker] of gods.entries()) {
    assert.equal(vm.getEffectiveness(attacker, attacker), 1);
    assert.equal(vm.getEffectiveness(attacker, gods[(index + 1) % gods.length]), 2);
    assert.equal(vm.getEffectiveness(attacker, gods[(index + 2) % gods.length]), 0.5);
    for (const element of ordinary) {
      assert.equal(vm.getEffectiveness(attacker, element), 2, attacker + ' → ' + element);
      const expected = resistances[attacker].includes(element) ? 0.5 : 1;
      assert.equal(vm.getEffectiveness(element, attacker), expected, element + ' → ' + attacker);
    }
    assert.equal(vm.getEffectiveness(attacker, null), 1);
  }
  const {a,ctx} = init([]);
  const clock = new api.BattlePet({...api.findPet('pet_bmhs'), skillIds: ['sk_nlex']});
  const skill = clock.skills[0];
  const hit = ctx.doDamage;
  let multiplier;
  ctx.doDamage = function(...args) {
    const result = hit.apply(this, args);
    multiplier = result.effectiveness;
    return result;
  };
  assert.equal(skill.element, 'divine_water');
  skill.onUse(clock,a,ctx);
  assert.equal(multiplier, 2);
});

check('降华按原系封伤害来源一回合，和限伤合计计印', () => {
  const {p,ctx,g} = init(['sk_jydm_1']);
  const clock = new api.BattlePet({...api.findPet('pet_bmhs'), skillIds: ['sk_nlex','sk_mszw']});
  Object.assign(g, { aiActive: clock, aiParty: [clock] });
  const skill = clock.skills[0];
  p.skills[0].onUse(p,clock,ctx);
  const attack = api.createBattleContext();
  attack.sourceSkill = skill;
  attack.sourceSkillOwner = clock;
  assert.equal(vm.getEffectiveSkillElement(clock, skill.element), 'light');
  attack.doFixedDamage(p, 600, clock);
  assert.equal(vm.canSelectSkill(skill), true, '发动回合完全免伤');
  g.turnCount++;
  attack.doFixedDamage(p, 600, clock);
  assert.equal(p.bloodlineData.marks, 1, '一次限伤加一次封技');
  assert.equal(vm.canSelectSkill(skill), false);
  assert.equal(vm.canSelectSkill(clock.skills[1]), true, '只封伤害来源');
  const before = skill.pp;
  assert.equal(vm.reserveSkillAction(clock, skill, g.turnCount + 1), null);
  assert.equal(skill.pp, before, '封技不能选招或扣费');
  g.turnCount++;
  assert.equal(vm.isSkillSealed(skill, g.turnCount), true);
  assert.equal(vm.canSelectSkill(skill), true, '满一回合后可为下回合选招');
  assert.equal(vm.isSkillSealed(skill, g.turnCount + 1), false);
});

check('全额护盾及普通原系招不触发神系封技，同轮同招只记一次', () => {
  const {p,ctx,g} = init(['sk_jydm_1']);
  const clock = new api.BattlePet({...api.findPet('pet_bmhs'), skillIds: ['sk_nlex','sk_mszw']});
  Object.assign(g, { aiActive: clock, aiParty: [clock] });
  const [divine, ordinary] = clock.skills;
  p.skills[0].onUse(p,clock,ctx);
  g.turnCount++;
  p.shield = 10;
  const attack = api.createBattleContext();
  attack.sourceSkillOwner = clock;
  attack.sourceSkill = divine;
  assert.equal(attack.doDamage(clock,p,1,'physical',divine.element).effectiveness, 1, '已变为光，常规伤害未克制');
  assert.equal(vm.canSelectSkill(divine), true, '护盾吸收的伤害不封技');
  p.shield = 0;
  attack.sourceSkill = ordinary;
  attack.doFixedDamage(p, 10, clock);
  assert.equal(vm.canSelectSkill(ordinary), true);
  attack.sourceSkill = divine;
  attack.doFixedDamage(p, 10, clock);
  attack.doFixedDamage(p, 10, clock);
  assert.equal(p.bloodlineData.jianghuaRestrictions, 1);
  assert.equal(vm.canSelectSkill(divine), false);
});

check('玩家技能栏和本地 AI 都跳过封技，全部封禁时可以空过', () => {
  const {p,g}=init(['sk_jydm_1']);
  const clock = new api.BattlePet({...api.findPet('pet_bmhs'), skillIds: ['sk_nlex']});
  Object.assign(g, { playerActive: clock, playerParty: [clock], aiActive: p, aiParty: [p],
    isPlayerTurn: true, battleOver: false, waitingForSwitch: false });
  const [divine] = clock.skills;
  divine.jianghuaSealedTurns = new Set([g.turnCount + 1]);
  const actions = makeEl();
  const select = vm.document.querySelector;
  const realResolve = vm.resolveTurn;
  try {
    vm.document.querySelector = selector => selector === '#battle-actions' ? actions : makeEl();
    vm.renderBattleActions();
    const button = actions.children[0].children[0].children[0];
    assert.equal(button.disabled, true);
    assert.match(button.innerHTML, /封技/);
    assert.equal(actions.children[1].children[0].id, 'battle-pass');
    const pp = divine.pp;
    api.playerUseSkill(0);
    assert.equal(divine.pp, pp);

    Object.assign(g, { playerActive: p, playerParty: [p], aiActive: clock, aiParty: [clock] });
    vm.resolveTurn = () => {};
    vm.aiDecideAndResolve();
    assert.equal(g.pendingAISkill, -1);
    assert.equal(divine.pp, pp);
  } finally {
    vm.document.querySelector = select;
    vm.resolveTurn = realResolve;
    vm.stopTurnTimer();
  }
});

console.log(checks + ' checks passed');
