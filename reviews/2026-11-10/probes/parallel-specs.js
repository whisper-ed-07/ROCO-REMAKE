// Read-only probes for the supplied parallel-development snapshot only.
const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert/strict');
const path = require('path');
const root = process.argv[2] || path.resolve(__dirname, '../../..');
const { loadEngine } = require(path.join(root, 'test/lib/harness.js'));
const snapshotPath = process.argv[3] || path.join(root, 'ROCO REMAKE.html');
const expectedSHA256 = '8366efddcd9098bd18123b098e4706cf9684d8aff00f434d6437d24a57216761';
const actualSHA256 = crypto.createHash('sha256').update(fs.readFileSync(snapshotPath)).digest('hex');
assert.equal(actualSHA256, expectedSHA256, 'The supplied snapshot must remain unchanged.');
function setup() {
  const e = loadEngine(snapshotPath, { seed: 5 });
  const a = e.api;
  const u = new a.BattlePet(a.findPet('pet_bmhs'));
  const t = new a.BattlePet(a.findPet('pet_qy'));
  u.bloodlineData = {};
  t.bloodlineData = { mode: '清念' };
  // Keep the target alive so the delayed-effect trigger can be observed independently.
  t.invincible = true;
  Object.assign(a.gameState, {
    playerActive: u, aiActive: t, playerParty: [u], aiParty: [t],
    pendingFirstMove: 'player', turnCount: 1, messages: [], battleOver: false
  });
  return { ...e, a, u, t, c: a.createBattleContext() };
}
const results = { snapshotPath, sha256: actualSHA256, probes: {} };
{
  const { a, u, c } = setup();
  // Match the engine's convention: snapshots are captured after each completed turn.
  for (let n = 1; n <= 4; n++) {
    a.gameState.turnCount = n;
    u.hp = 100 + n;
    c.saveSnapshot();
  }
  a.gameState.turnCount = 5;
  u.hp = 200;
  c.restoreSnapshot(3);
  results.probes.restoreSnapshot = {
    currentTurn: 5,
    savedTurns: a.gameState.snapshots.map(s => s.turn),
    actualRestoredHP: u.hp,
    expectedTurn: 2,
    expectedHP: 102,
    reproduced: u.hp === 101
  };
  assert.equal(u.hp, 101, 'Expected the reviewed off-by-one behavior to remain reproducible.');
}
{
  const { a, u, t } = setup();
  const sk = u.skills.find(s => s.id === 'sk_nlex');
  // Direct skill execution isolates the existing double count from rewind side effects.
  a.executeSkillTurn(u, t, sk, 'player');
  const first = { pp: sk.pp, count: u.skillUseCounts.sk_nlex, pending: u.pendingNilex || null };
  a.executeSkillTurn(u, t, sk, 'player');
  const second = {
    pp: sk.pp, count: u.skillUseCounts.sk_nlex,
    pending: u.pendingNilex ? { ...u.pendingNilex } : null
  };
  u.hp = 200;
  a.executeSkillTurn(u, t, u.skills.find(s => s.id === 'sk_mszw'), 'player');
  const nextPower = {
    hpBefore: 200, hpAfter: u.hp, pending: u.pendingNilex || null,
    messages: a.gameState.messages.slice(-5).map(m => m.text)
  };
  results.probes.pendingNilex = {
    first, second, nextPower,
    expectedUseCountOnSecond: 2,
    expectedDelayedEffect: '全体技能回复3PP并回复30%精力',
    reproduced: second.pending.cnt === 3 && u.pendingNilex === null && u.hp === 200
  };
  assert.equal(first.count, 2);
  assert.equal(second.pending.cnt, 3);
  assert.equal(u.pendingNilex, null);
  assert.equal(u.hp, 200);
}
console.log(JSON.stringify(results, null, 2));
