// Fixed-seed, 1v1 round-robin smoke matrix. Run: node test/battle-matrix.js
const path = require('path');
const vm = require('vm');
const { loadEngine } = require('./lib/harness');
const html = path.join(__dirname, '..', 'ROCO REMAKE.html');
const ids = loadEngine(html).api.DEFAULT_PETS.map(p => p.id);
const results = [];
function choose(pet, cursor) {
  for (let n = 0; n < pet.skills.length; n++) {
    const slot = (cursor + n) % pet.skills.length;
    if (pet.skills[slot].pp > 0) return [slot, (slot + 1) % pet.skills.length];
  }
  return [-1, cursor];
}
for (let pi = 0; pi < ids.length; pi++) for (let ai = 0; ai < ids.length; ai++) {
  const seed = 20261110 + pi * 100 + ai;
  const row = {player:ids[pi], ai:ids[ai], seed, outcome:'round-limit', turns:0};
  try {
    const e = loadEngine(html, {seed});
    const {api, sandbox, clock} = e, gs = api.gameState;
    // UI auto-skip submits another turn asynchronously. The matrix owns submission;
    // other engine timers still run against the harness's virtual clock.
    for (const name of ['renderBattle','renderBattleActions','updateBattleUI','spawnFloatText','showScreen','startTurnTimer']) sandbox[name] = () => {};
    const p = new api.BattlePet(api.findPet(ids[pi]));
    const a = new api.BattlePet(api.findPet(ids[ai]));
    if (p.skills.length !== 4 || a.skills.length !== 4) throw new Error('expected four equipped skills per pet');
    Object.assign(gs, {playerParty:[p], aiParty:[a], playerActive:p, aiActive:a, messages:[], turnCount:0, snapshots:[], ppHistory:[], battleOver:false, waitingForSwitch:false, pendingPlayerSkill:null, pendingAISkill:null, isPlayerTurn:true, screen:'battle', skipPlayerAction:false});
    sandbox.__matrixClock = clock;
    let pc = 0, ac = 0;
    for (let i = 0; i < 150 && !gs.battleOver; i++) {
      [gs.pendingPlayerSkill, pc] = choose(gs.playerActive, pc);
      [gs.pendingAISkill, ac] = choose(gs.aiActive, ac);
      const before = gs.turnCount;
      vm.runInContext('resolveTurn()', sandbox, {timeout:3000});
      if (!gs.battleOver && gs.turnCount === before) { row.outcome='stalled'; break; }
      if (gs.turnCount > before + 1) throw new Error('one submission advanced multiple rounds');
      const after = gs.turnCount;
      vm.runInContext('__matrixClock.advance(1000)', sandbox, {timeout:3000});
      if (gs.turnCount !== after) throw new Error('timer unexpectedly submitted a round');
      for (const pet of [gs.playerActive, gs.aiActive]) {
        if (!Number.isFinite(pet.hp)) throw new Error(`${pet.id}: invalid HP`);
        for (const s of pet.skills) if (!Number.isFinite(s.pp) || s.pp < 0 || s.pp > s.maxPp) throw new Error(`${pet.id}/${s.id}: invalid PP ${s.pp}`);
      }
    }
    row.turns = gs.turnCount;
    if (gs.battleOver) row.outcome = p.isFainted() && a.isFainted() ? 'both-fainted' : p.isFainted() ? 'ai-win' : a.isFainted() ? 'player-win' : 'ended';
    row.hp = [p.hp, a.hp];
  } catch (err) { row.outcome='exception'; row.error=err.message; }
  results.push(row);
}
const summary = {battles:results.length, finished:results.filter(r=>!['round-limit','stalled','exception'].includes(r.outcome)).length, roundLimit:results.filter(r=>r.outcome==='round-limit').length, stalled:results.filter(r=>r.outcome==='stalled').length, exceptions:results.filter(r=>r.outcome==='exception').length};
console.log(JSON.stringify({policy:'1v1, 4 equipped slots, both sides round-robin available skills, virtual clock 1s per submitted round, maximum 150 rounds',summary,results},null,2));
if (summary.stalled || summary.exceptions) process.exitCode=1;
