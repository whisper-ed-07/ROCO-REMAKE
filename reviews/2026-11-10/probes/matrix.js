const fs = require('fs');
const outputDir = process.env.ROCO_REVIEW_OUTPUT || require('path').join(__dirname, '../runs/manual');
fs.mkdirSync(outputDir, { recursive: true });
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');
const root = process.argv[2] || path.resolve(__dirname, '../../..');
const html = path.join(root, 'ROCO REMAKE.html');
const { loadEngine } = require(path.join(root, 'test/lib/harness.js'));
const ids = loadEngine(html).api.DEFAULT_PETS.map(p => p.id);
const results = [];
for (let pi = 0; pi < ids.length; pi++) for (let ai = 0; ai < ids.length; ai++) {
  const seed = 20261110 + pi * 100 + ai;
  const { api, sandbox, code } = loadEngine(html, { seed });
  new vm.Script(code);
  // Do not run UI-driven auto turns; drive each submitted turn explicitly.
  // No callback exceptions are swallowed after loading.
  const timers = [];
  sandbox.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  vm.runInContext('updateBattleUI=function(){};renderBattleActions=function(){};renderBattle=function(){};renderResult=function(){};startTurnTimer=function(){};', sandbox);
  const gs = api.gameState;
  const p = new api.BattlePet(api.DEFAULT_PETS[pi]);
  const a = new api.BattlePet(api.DEFAULT_PETS[ai]);
  Object.assign(gs, { playerParty: [p], aiParty: [a], playerActive: p, aiActive: a,
    messages: [], turnCount: 0, snapshots: [], ppHistory: [], battleOver: false,
    waitingForSwitch: false, pendingPlayerSkill: null, pendingAISkill: null,
    isPlayerTurn: true, screen: 'battle', skipPlayerAction: false });
  const row = { player: ids[pi], ai: ids[ai], seed, commands: 0, turns: 0,
    nonAdvancingCommands: 0, invariantViolations: [], outcome: 'unresolved', error: null };
  let cursor = 0;
  try {
    for (let c = 0; c < 300 && !gs.battleOver; c++) {
      let chosen = -1;
      for (let n = 0; n < p.skills.length; n++) {
        const i = (cursor + n) % p.skills.length;
        if (p.skills[i].pp > 0) { chosen = i; cursor = (i + 1) % p.skills.length; break; }
      }
      gs.pendingPlayerSkill = chosen;
      const before = gs.turnCount;
      vm.runInContext('aiDecideAndResolve()', sandbox, { timeout: 3000 });
      row.commands++;
      if (gs.turnCount === before) row.nonAdvancingCommands++;
      for (const pet of [p, a]) {
        for (const key of ['hp', 'maxHp', 'atk', 'def', 'spatk', 'spdef', 'spd']) {
          if (!Number.isFinite(pet[key])) throw new Error(`${pet.id}.${key}=${pet[key]}`);
        }
        const effectiveMaxHp = pet.maxHp + (pet.maxHpBonus || 0);
        if (pet.hp < 0 || pet.hp > effectiveMaxHp) {
          const issue = `${pet.id}: hp=${pet.hp}, effectiveMaxHp=${effectiveMaxHp}`;
          if (!row.invariantViolations.includes(issue)) row.invariantViolations.push(issue);
        }
        for (const skill of pet.skills) {
          if (!Number.isFinite(skill.pp) || skill.pp < 0 || skill.pp > skill.maxPp) {
            const issue = `${pet.id}/${skill.id}: pp=${skill.pp}, maxPp=${skill.maxPp}`;
            if (!row.invariantViolations.includes(issue)) row.invariantViolations.push(issue);
          }
        }
      }
    }
    if (gs.battleOver) row.outcome = p.hp <= 0 && a.hp <= 0 ? 'both-fainted' : p.hp <= 0 ? 'ai-win' : a.hp <= 0 ? 'player-win' : 'ended';
  } catch (e) { row.outcome = 'exception'; row.error = e.stack; }
  row.turns = gs.turnCount;
  row.hp = [p.hp, a.hp];
  row.tail = gs.messages.slice(-5).map(m => typeof m === 'string' ? m : m.text);
  results.push(row);
}
const report = { source: html, sha256: crypto.createHash('sha256').update(fs.readFileSync(html)).digest('hex'),
  policy: '1v1, player round-robin among available skills, actual greedy AI, 300 submitted commands maximum; no browser/UI timers executed',
  summary: { battles: results.length, finished: results.filter(r => !['unresolved', 'exception'].includes(r.outcome)).length,
    unresolved: results.filter(r => r.outcome === 'unresolved').length, exceptions: results.filter(r => r.error).length,
    withNonAdvancingCommands: results.filter(r => r.nonAdvancingCommands).length,
    withInvariantViolations: results.filter(r => r.invariantViolations.length).length }, results };
fs.writeFileSync(require('path').join(outputDir, 'matrix-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary, null, 2));
for (const r of results) console.log(JSON.stringify({ player:r.player, ai:r.ai, outcome:r.outcome, commands:r.commands, turns:r.turns, violations:r.invariantViolations, error:r.error }));
