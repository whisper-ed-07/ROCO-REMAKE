// Independent correct-behavior regressions. Run: node test/core-regressions.js
const assert = require('assert');
const path = require('path');
const { loadEngine } = require('./lib/harness');
const html = path.join(__dirname, '..', 'ROCO REMAKE.html');
let failed = 0;
function test(name, fn) { try { fn(); console.log('PASS ' + name); } catch (err) { failed++; console.error('FAIL ' + name + ': ' + err.message); } }
function env() {
  const e = loadEngine(html, { seed: 55 });
  for (const k of ['renderBattle','renderBattleActions','updateBattleUI','spawnFloatText','showScreen']) e.sandbox[k] = () => {};
  return e;
}
function skill(id, fn = () => {}, priority = 8, pp = 5) { return { id, name:id, element:'normal', category:'status', power:0, accuracy:100, priority, pp, maxPp:5, onUse:fn }; }
function pet(e, id, s = skill('idle'), spd = 100) {
  const p = new e.api.BattlePet({id,name:id,element:'normal',emoji:'X',level:100,baseStats:{hp:200,atk:100,def:100,spatk:100,spdef:100,spd},skillIds:[]});
  p.skills = s ? [s] : []; return p;
}
function setup(e,p,a) { Object.assign(e.api.gameState,{playerActive:p,aiActive:a,playerParty:[p],aiParty:[a],battleOver:false,turnCount:0,pendingPlayerSkill:0,pendingAISkill:0,skipPlayerAction:false,messages:[],snapshots:[],ppHistory:[]}); }
function turn(e, p = 0, a = 0) { e.api.gameState.pendingPlayerSkill=p; e.api.gameState.pendingAISkill=a; e.sandbox.resolveTurn(); }
function built(e,id,ids) { return new e.api.BattlePet({...e.api.findPet(id),skillIds:ids}); }
const qids = ['sk_qy_3','sk_qy_4','sk_qy_5','sk_qy_2'];
const jids = ['sk_jydm_2','sk_jydm_3','sk_jydm_4','sk_jydm_5'];

test('E01 普通回合天气、环境和降华只递减一次', () => {
  const e=env(), p=pet(e,'p'), a=pet(e,'a'); setup(e,p,a);
  Object.assign(e.api.gameState,{weather:'sandstorm',weatherTurns:6,field:'dream',fieldTurns:6,forceSkillElement:'light',forceSkillElementTurns:6}); turn(e);
  assert.deepStrictEqual([e.api.gameState.weatherTurns,e.api.gameState.fieldTurns,e.api.gameState.forceSkillElementTurns],[5,5,5]);
});
test('E02 双方睡一回合后醒来并继续出招', () => {
  const e=env(), p=pet(e,'p'), a=pet(e,'a'); setup(e,p,a);
  for (const x of [p,a]) { x.status='sleep'; x.statusTurns=1; }
  turn(e); assert.strictEqual(p.status,null); assert.strictEqual(a.status,null);
  turn(e); assert.ok(e.api.gameState.turnCount>=2); assert.strictEqual(p.skills[0].pp,4); assert.strictEqual(a.skills[0].pp,4);
});
test('E03 跨回合致死保护复位', () => {
  const e=env(), p=built(e,'pet_bmhs',[]), a=pet(e,'attacker',skill('first-lethal',(u,t,c)=>{if(e.api.gameState.turnCount===1)c.doFixedDamage(t,10,u);}),200); p.hp=1; p.skills=[skill('idle')]; setup(e,p,a);
  turn(e); assert.strictEqual(p.hp,1); p.status='poison'; turn(e); assert.ok(p.hp>0); assert.strictEqual(e.api.gameState.battleOver,false);
});
test('先手施加睡眠使后手本回合不能行动', () => {
  const e=env(); let actions=0; const p=pet(e,'p',skill('sleep',(u,t,c)=>c.applyStatus(t,'sleep'),15)); const a=pet(e,'a',skill('queued',()=>actions++)); setup(e,p,a); turn(e); assert.strictEqual(actions,0); assert.strictEqual(a.skills[0].pp,4);
});
test('先手施加麻痹后仍需判定后手本回合行动', () => {
  const e=env(); let actions=0; const p=pet(e,'p',skill('paralyze',(u,t,c)=>c.applyStatus(t,'paralyze'),15)), a=pet(e,'a',skill('queued',()=>actions++)); setup(e,p,a); e.myMath.random=()=>0.1; turn(e); assert.strictEqual(actions,0); assert.strictEqual(a.skills[0].pp,4);
});
test('麻痹同回合多次检查只抽样一次，下一回合重新抽样', () => {
  const e=env(), p=pet(e,'p'), a=pet(e,'a'); setup(e,p,a); p.status='paralyze'; let n=0; e.myMath.random=()=>{n++; return n===1 ? 0.1 : 0.9;};
  assert.strictEqual(p.canAct(),false); assert.strictEqual(p.canAct(),false); assert.strictEqual(n,1); e.api.gameState.turnCount++; assert.strictEqual(p.canAct(),true); assert.strictEqual(p.canAct(),true); assert.strictEqual(n,2);
});
test('R04 选招后被删至零 PP 仍执行原技能', () => {
  const e=env(); let count=0; const p=pet(e,'p',skill('queued',()=>count++,8,1)), a=pet(e,'a',skill('cut',(u,t,c)=>c.deletePP(t,0,1),15)); setup(e,p,a); turn(e); assert.strictEqual(count,1); assert.strictEqual(p.skills[0].pp,0);
});
test('玩家选招立即扣 PP，AI 选招及先手行动时双方均已扣费', () => {
  const e=env(); let observedSelection, observedFast, actions=0;
  const p=pet(e,'p',skill('queued',()=>actions++,8,2));
  const a=pet(e,'a',skill('fast',(u,t,c)=>{ observedFast=[t.skills[0].pp,u.skills[0].pp]; c.deletePP(t,0,1); },15,2));
  Object.defineProperty(a.skills[0],'power',{get(){ observedSelection=p.skills[0].pp; return 0; }});
  setup(e,p,a); e.api.gameState.isPlayerTurn=true; e.api.playerUseSkill(0);
  assert.strictEqual(observedSelection,1); assert.deepStrictEqual(observedFast,[1,1]);
  assert.strictEqual(actions,1); assert.strictEqual(p.skills[0].pp,0); assert.strictEqual(a.skills[0].pp,1);
});
test('未命中只扣一次已预留 PP，按选招时倍率收费', () => {
  const e=env(); let actions=0; const s=skill('miss',()=>actions++,15,5); s.accuracy=1;
  const p=pet(e,'p',s), a=pet(e,'a'); setup(e,p,a); p.skillPPCostMult=2; e.myMath.random=()=>0.5;
  e.api.gameState.isPlayerTurn=true; e.api.playerUseSkill(0);
  assert.strictEqual(actions,0); assert.strictEqual(s.pp,3);
});
test('先手控制已选招的后手时 PP 只扣一次', () => {
  const e=env(); let actions=0; const p=pet(e,'p',skill('sleep',(u,t,c)=>c.applyStatus(t,'sleep'),15));
  const a=pet(e,'a',skill('queued',()=>actions++,8,2)); setup(e,p,a); e.api.gameState.isPlayerTurn=true;
  e.api.playerUseSkill(0); assert.strictEqual(actions,0); assert.strictEqual(a.skills[0].pp,1);
});
test('R05 驱逐后离场宠物不能行动', () => {
  const e=env(); let count=0; const p=built(e,'pet_qy',['sk_qy_1','sk_qy_2','sk_qy_3','sk_qy_4']), a=pet(e,'a',skill('queued',()=>count++)), b=pet(e,'bench'); setup(e,p,a); e.api.gameState.aiParty.push(b); turn(e,3); assert.strictEqual(e.api.gameState.aiActive,b); assert.strictEqual(count,0);
});
test('R06 单次致死保护先于判负', () => {
  const e=env(), p=built(e,'pet_bmhs',[]), a=pet(e,'attacker',skill('first-lethal',(u,t,c)=>{if(e.api.gameState.turnCount===1)c.doFixedDamage(t,10,u);}),200); p.hp=1; p.skills=[skill('idle')]; setup(e,p,a); turn(e); assert.strictEqual(p.hp,1); assert.strictEqual(e.api.gameState.battleOver,false);
});
test('R07 新局清除降华全局状态', () => {
  const e=env(), p=built(e,'pet_jydm',jids), a=pet(e,'a'); setup(e,p,a); e.api.findSkill('sk_jydm_1').onUse(p,a,e.api.createBattleContext()); e.api.gameState.selectedTeamIds=['pet_qy']; e.sandbox.startBattle(); e.api.gameState.opponentTeamIds=['pet_jydm']; e.sandbox.confirmOpponentAndBattle(); assert.strictEqual(e.api.gameState.forceSkillElement,null); assert.strictEqual(e.api.gameState.jianghuaBuff,null); assert.strictEqual(e.api.gameState.pendingJianghuaByPet?.size || 0,0);
});
test('R08 旧局自动跳过回调不能推进新局', () => {
  const e=loadEngine(html,{seed:55}), p=pet(e,'p'), a=pet(e,'a'); setup(e,p,a); p.status='sleep'; p.statusTurns=3; e.sandbox.renderBattleActions(); for(const k of ['renderBattleActions','renderBattle','updateBattleUI','spawnFloatText','showScreen']) e.sandbox[k]=()=>{}; e.api.gameState.selectedTeamIds=['pet_qy']; e.sandbox.startBattle(); e.api.gameState.opponentTeamIds=['pet_jydm']; e.sandbox.confirmOpponentAndBattle(); e.clock.advance(800); assert.strictEqual(e.api.gameState.turnCount,0);
});
test('残念记录本次扣 PP 后的数值', () => {
  const e=env(), p=built(e,'pet_qy',qids), a=pet(e,'a'); setup(e,p,a); p.bloodlineData={mode:'清念',turnCount:0,qfzn:0,healCount:0}; turn(e); assert.strictEqual(p.bloodlineData.qy3SavedPP,5); assert.strictEqual(p.skills[0].pp,0);
});
test('残念只在清念→残脉→清念完整循环恢复一次', () => {
  const e=env(), p=built(e,'pet_qy',qids), a=pet(e,'a'); setup(e,p,a); p.bloodlineData={mode:'清念',turnCount:0,qfzn:0,healCount:0}; const ctx=e.api.createBattleContext(); e.api.executeSkillTurn(p,a,p.skills[0],'player'); const saved=p.bloodlineData.qy3SavedPP; assert.strictEqual(saved,5);
  p.skills[2].onUse(p,a,ctx); assert.strictEqual(p.bloodlineData.qy3SavedPP,saved); p.skills[0].pp=0;
  p.skills[1].onUse(p,a,ctx); assert.strictEqual(p.bloodlineData.mode,'残脉'); p.skills[2].onUse(p,a,ctx); assert.strictEqual(p.skills[0].pp,saved); p.skills[0].pp=0; p.skills[2].onUse(p,a,ctx); assert.notStrictEqual(p.skills[0].pp,saved);
});
test('明念四招事件消费后无新动作不重复叠印且保留累计次数', () => {
  const e=env(), p=built(e,'pet_jydm',jids), a=pet(e,'a'); setup(e,p,a); const ctx=e.api.createBattleContext(); p.bloodlineData={marks:0,marked:false,markTurns:0,used:{},jianghuaTurns:0}; for (const s of p.skills) { s.onUse=()=>{}; e.api.executeSkillTurn(p,a,s,'player'); }
  assert.strictEqual(p.bloodlineData.markTarget,a); p.bloodline.onTurnStart(p,ctx); assert.strictEqual(p.bloodlineData.marks,0); for (const s of p.skills) assert.strictEqual(p.skillUseCounts[s.id],1);
});
test('清念沉脉敌方未出招时不自动削弱', () => {
  const e=env(), p=built(e,'pet_qy',qids), a=pet(e,'a'); setup(e,p,a); p.bloodlineData={mode:'清念',turnCount:0,qfzn:0,healCount:0}; p.skills[2].onUse(p,a,e.api.createBattleContext()); const effect=p.turnEffects.find(x=>x.name==='清念沉脉'); const count=effect.turnsLeft; for(let i=0;i<count;i++) e.sandbox.processTurnEffects(p); assert.strictEqual(a.dmgMod,1); assert.ok(!a.prioPenalty);
});

test('沉脉时长计入本次普通扣PP与清空本技能PP，不计其他技能损失', () => {
  function duration(otherPp) {
    const e=env(), p=built(e,'pet_qy',qids), a=pet(e,'a'); setup(e,p,a);
    p.bloodlineData={mode:'清念',turnCount:0,qfzn:0,healCount:0}; p.skills[0].pp=otherPp; p.skills[2].pp=4; p.skillPPCostMult=2;
    e.api.executeSkillTurn(p,a,p.skills[2],'player');
    return p.turnEffects.find(x=>x.name==='清念沉脉').turnsLeft;
  }
  // 出招扣2，技能内先回复3后剩5，再清空5：1+2+5=8。
  assert.strictEqual(duration(0),8); assert.strictEqual(duration(6),8);
});
test('明念第二轮须四招均有新使用才再次加印', () => {
  const e=env(), p=built(e,'pet_jydm',jids), a=pet(e,'a'); setup(e,p,a);
  p.bloodlineData={marks:0,marked:false,markTurns:0,used:{},jianghuaTurns:0}; const ctx=e.api.createBattleContext();
  for(const s of p.skills) { s.onUse=()=>{}; e.api.executeSkillTurn(p,a,s,'player'); }
  assert.strictEqual(p.bloodlineData.markTarget,a); assert.strictEqual(p.bloodlineData.marks,0);
  e.api.executeSkillTurn(p,a,p.skills[0],'player'); p.bloodline.onTurnStart(p,ctx); assert.strictEqual(p.bloodlineData.marks,0);
  for(const s of p.skills.slice(1)) e.api.executeSkillTurn(p,a,s,'player');
  p.bloodline.onTurnStart(p,ctx); assert.strictEqual(p.bloodlineData.marks,1);
  for(const s of p.skills) assert.strictEqual(p.skillUseCounts[s.id],2);
});
test('降华开始前旧出招不触发快捷印，窗口中新出招可以触发', () => {
  const e=env(), p=built(e,'pet_jydm',jids), a=pet(e,'a'); setup(e,p,a);
  p.bloodlineData={marks:0,marked:false,markTurns:0,used:{},jianghuaTurns:0}; const ctx=e.api.createBattleContext();
  p.skills[0].onUse=()=>{}; e.api.executeSkillTurn(p,a,p.skills[0],'player');
  // 直接调用 onUse 开窗，未经过执行入口登记新事件，隔离检查窗口前的旧记录。
  e.api.findSkill('sk_jydm_1').onUse(p,a,ctx); p.bloodline.onTurnStart(p,ctx); assert.strictEqual(p.bloodlineData.marks,0);
  e.api.executeSkillTurn(p,a,p.skills[0],'player'); p.bloodline.onTurnStart(p,ctx);
  assert.strictEqual(p.bloodlineData.markTarget,a); assert.strictEqual(p.bloodlineData.marks,0); assert.strictEqual(p.skillUseCounts[p.skills[0].id],2);
});
test('创世神钟受威力伤害后封锁攻击者下一回合血脉与回合效果的PP回复', () => {
  const e=env(), p=pet(e,'attacker'), a=built(e,'pet_bmhs',[]); setup(e,p,a);
  p.skills[0].pp=2; const seen=[]; const ctx=e.api.createBattleContext();
  p.bloodline={onTurnStart(u) { seen.push(['bloodline',e.sandbox.gainPP(u,u.skills[0],1),u.skills[0].pp]); }};
  ctx.addTurnEffect(p,'测试回复',1,u=>seen.push(['effect',e.sandbox.gainPP(u,u.skills[0],1),u.skills[0].pp]));
  ctx.doDamage(p,a,40,'physical','normal'); assert.strictEqual(p.blockPPRecoveryOnTurn,1);
  assert.equal(e.sandbox.isPPRecoveryBlocked(p),false, '命中当回合仍可回复');
  p.skills[0].onUse = (u,t,c) => seen.push(['action',e.sandbox.gainPP(u,u.skills[0],1),u.skills[0].pp]);
  turn(e); assert.deepStrictEqual(seen,[['bloodline',0,1],['effect',0,1],['action',0,1]]);
  e.api.gameState.turnCount++;
  assert.equal(e.sandbox.gainPP(p,p.skills[0],1),1);
});

// 让持续期在第二个提交回合开场结束：第一回合在窗口前，第二至第五回合为窗口。
function qingnianFixture(enemySkills) {
  const e=env(), order=[];
  const p=pet(e,'owner',skill('owner-idle',()=>order.push('owner'),8,30),200), a=pet(e,'enemy',null,80);
  p.skills[0].maxPp=30; p.skills.push({...e.api.findSkill('sk_qy_5')}); a.skills=enemySkills; setup(e,p,a);
  p.maxHp=p.hp=100000; a.maxHp=a.hp=100000; e.myMath.random=()=>0.5;
  p.skills[1].onUse(p,a,e.api.createBattleContext());
  p.turnEffects.find(x=>x.name==='清念沉脉').turnsLeft=2;
  return {e,p,a,order};
}
function powerSkill(id, damageLog, fixedLog) {
  return {id,name:id,element:'normal',category:'physical',power:100,accuracy:100,priority:8,pp:30,maxPp:30,
    onUse(u,t,c) { damageLog.push(c.doDamage(u,t,100,'physical','normal').damage); if(fixedLog) { const before=t.hp; c.doFixedDamage(t,30,u); fixedLog.push(before-t.hp); } }};
}
test('沉脉窗口前后真实出招：威力30%→50%封顶、未使用招无影响、固伤不变', () => {
  const hits=[], fixed=[], other=[]; const a0=powerSkill('power-a',hits,fixed), a1=powerSkill('power-b',other);
  const {e}=qingnianFixture([a0,a1]);
  // 窗口前、窗口第1/2/3回合：同一招重复；第4回合使用另一招；之后再用第一招。
  turn(e,0,0); turn(e,0,0); turn(e,0,0); turn(e,0,0);
  assert.strictEqual(a0.qingnianPowerLoss,0.5); assert.ok(!a1.qingnianPowerLoss);
  turn(e,0,1); turn(e,0,0);
  assert.strictEqual(a1.qingnianPowerLoss,0.3); assert.strictEqual(a0.qingnianPowerLoss,0.5);
  assert.ok(Math.abs(hits[1]/hits[0]-0.7)<0.04,`first=${hits[0]} reduced=${hits[1]}`);
  for(const x of hits.slice(2)) assert.ok(Math.abs(x/hits[0]-0.5)<0.04,`first=${hits[0]} reduced=${x}`);
  assert.ok(Math.abs(other[0]/hits[0]-0.7)<0.04); assert.deepStrictEqual(fixed,[30,30,30,30,30]);
});
test('沉脉变化招每次使用永久减自身先手，窗口结束后不再增加', () => {
  const orders=[]; const st=skill('status',(u,t)=>orders.push('enemy'),9,30); st.maxPp=30;
  const unused=skill('unused',()=>{},9,30); unused.maxPp=30;
  const {e,p,order}=qingnianFixture([st,unused]); p.skills[0].onUse=()=>orders.push('owner');
  function step() { orders.length=0; turn(e,0,0); return orders.join(','); }
  assert.strictEqual(step(),'enemy,owner'); // 窗口前
  assert.strictEqual(step(),'enemy,owner'); // 窗口第1回合：当次顺序已确定
  assert.strictEqual(st.qingnianPriorityLoss,1);
  assert.strictEqual(step(),'owner,enemy'); assert.strictEqual(st.qingnianPriorityLoss,2);
  step(); step(); assert.strictEqual(st.qingnianPriorityLoss,4); assert.ok(!unused.qingnianPriorityLoss);
  assert.strictEqual(step(),'owner,enemy'); assert.strictEqual(st.qingnianPriorityLoss,4);
});
test('新战斗实例不继承旧实例的沉脉技能削弱', () => {
  const source=env(), old=built(source,'pet_jydm',jids);
  old.skills[0].category='physical'; old.skills[0].power=100; old.skills[0].onUse=()=>{};
  old.skills[1].category='status'; old.skills[1].onUse=()=>{};
  const {e}=qingnianFixture(old.skills); turn(e,0,0); turn(e,0,0); turn(e,0,1);
  assert.strictEqual(old.skills[0].qingnianPowerLoss,0.3); assert.strictEqual(old.skills[1].qingnianPriorityLoss,1);
  const next=built(e,'pet_jydm',jids); assert.ok(!next.skills[0].qingnianPowerLoss); assert.ok(!next.skills[1].qingnianPriorityLoss);
});

test('沉脉削弱适用于传统威力技能的真实伤害', () => {
  const legacy={id:'legacy',name:'legacy',element:'normal',category:'physical',power:100,accuracy:100,priority:8,pp:30,maxPp:30};
  const {e,p}=qingnianFixture([legacy]);
  function hit() { const before=p.hp; turn(e,0,0); return before-p.hp; }
  const baseline=hit(), reduced=hit(), capped=hit();
  assert.ok(Math.abs(reduced/baseline-0.7)<0.04,`baseline=${baseline} reduced=${reduced}`);
  assert.ok(Math.abs(capped/baseline-0.5)<0.04,`baseline=${baseline} reduced=${capped}`);
});
test('沉脉对未命中出招生效，但零PP或受控取消的行动不触发', () => {
  const e=env(), p=pet(e,'p'), a=pet(e,'a'); setup(e,p,a); e.myMath.random=()=>0.5;
  const s=powerSkill('miss',[]); s.accuracy=1; p.skills=[s]; p.qingnianWindowEnd=3;
  e.api.executeSkillTurn(p,a,s,'player'); assert.strictEqual(s.qingnianPowerLoss,0.3);
  s.pp=0; e.api.executeSkillTurn(p,a,s,'player'); assert.strictEqual(s.qingnianPowerLoss,0.3);
  s.pp=2; p.status='sleep'; e.api.executeSkillTurn(p,a,s,'player'); assert.strictEqual(s.qingnianPowerLoss,0.3);
});
test('原文明确为被动使用的极尽降华也触发沉脉', () => {
  const e=env(), p=pet(e,'p'), a=built(e,'pet_jydm',['sk_jydm_1','sk_jydm_2','sk_jydm_3','sk_jydm_4']); setup(e,p,a);
  a.qingnianWindowEnd=4; for(const x of [p,a]) { x.status='sleep'; x.statusTurns=1; }
  e.api.createBattleContext().deletePP(a,0,1); assert.strictEqual(e.api.gameState.pendingJianghuaByPet.get(a),a.skills[0]);
  turn(e); assert.strictEqual(a.skills[0].qingnianPriorityLoss,1); assert.strictEqual(e.api.gameState.pendingJianghuaByPet?.size || 0,0);
});

function microSealFixture() {
  const e = env();
  const p = built(e, 'pet_qingling', ['sk_ql_1']);
  p.skills.push(skill('idle'));
  const hits = [];
  const attack = {
    ...skill('power', (user, target, ctx) => {
      hits.push({ target, damage: ctx.doDamage(user, target, 40, 'special', 'fire').damage });
    }, 5),
    category: 'special',
    element: 'fire',
    power: 40
  };
  const a = pet(e, 'enemy', attack);
  setup(e, p, a);
  return { e, p, a, attack, hits };
}

test('微灵封体威力免疫覆盖发动后和整个下回合，包括回合末被动', () => {
  const { e, p, a, attack, hits } = microSealFixture();
  const ctx = e.api.createBattleContext();
  assert.ok(e.sandbox.calcDamage(a, p, attack).damage > 0, '发动前可受威力伤害');
  turn(e);
  assert.equal(hits[0].damage, 0, '发动当回合拦截后手威力伤害');
  assert.equal(e.sandbox.calcDamage(a, p, attack).damage, 0, '传统威力伤害入口也受保护');

  const before = p.hp;
  ctx.doFixedDamage(p, 20, a);
  assert.equal(before - p.hp, 20, '固定伤害照常结算');

  const openingHits = [], lateHits = [];
  ctx.addTurnEffect(a, '开场威力测试', 1, () => {
    openingHits.push(ctx.doDamage(a, p, 40, 'special', 'fire').damage);
  });
  a.skills.push(skill('sk_jydm_1', (u, t, c) => {
    lateHits.push(c.doDamage(u, t, 40, 'special', 'fire').damage);
  }));
  e.api.gameState.pendingJianghuaByPet = new Map([[a, a.skills.at(-1)]]);
  turn(e, 1);
  assert.deepEqual(openingHits, [0], '下一回合开场');
  assert.equal(hits[1].damage, 0, '下一回合行动');
  assert.deepEqual(lateHits, [0], '下一回合末的被动仍在免疫期限内');
  assert.ok(e.sandbox.calcDamage(a, p, attack).damage > 0, '下回合结算结束即到期');
  turn(e, 1);
  assert.ok(hits[2].damage > 0, '第三回合恢复承受威力伤害');
});

test('微灵封体续用刷新期限，换下后按全局回合到期', () => {
  const { e, p, a, attack, hits } = microSealFixture();
  const state = e.api.gameState, bench = pet(e, 'bench');
  state.playerParty.push(bench);
  turn(e);
  turn(e);
  assert.equal(e.sandbox.calcDamage(a, p, attack).damage, 0, '旧免疫到期时保留续用后的免疫');
  state.pendingPlayerAction = { kind: 'switch', user: p, incoming: bench };
  turn(e);
  assert.equal(hits[2].target, bench);
  assert.ok(hits[2].damage > 0, '免疫不转给换上来的宠物');
  assert.ok(e.sandbox.calcDamage(a, p, attack).damage > 0, '场下的清灵也在回合末到期');
});

test('清除回合效果时移除微灵封体的限时威力免疫', () => {
  const { e, p, a, attack } = microSealFixture();
  turn(e);
  e.sandbox.clearTurnEffects(p);
  assert.ok(e.sandbox.calcDamage(a, p, attack).damage > 0);
  assert.equal(e.sandbox.hasStatusImmunity(p, 'freeze'), true, '永久防控仍有效');
});
if(failed) { console.error(`${failed} regression(s) failed`); process.exitCode=1; }
