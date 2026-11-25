const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..', '..');
const { loadEngine } = require(path.join(root, 'test/lib/harness.js'));

function battle(player, opponent, seed = 231) {
  const { api, sandbox: engine } = loadEngine(path.join(root, 'ROCO REMAKE.html'), {seed});
  const renderActions = engine.renderBattleActions;
  const state = api.gameState;
  for (const name of ['renderBattle', 'renderBattleActions', 'updateBattleUI',
    'spawnFloatText', 'showScreen', 'startTurnTimer']) engine[name] = () => {};
  engine.savePetLoadouts(Object.fromEntries([...player, ...opponent].map(([id, skillIds]) => [id, {skillIds}])));
  state.selectedTeamIds = player.map(([id]) => id);
  engine.startBattle();
  state.opponentTeamIds = opponent.map(([id]) => id);
  engine.confirmOpponentAndBattle();
  function round(used = -1, enemy = -1) {
    const start = state.turnCount;
    engine.aiDecideAndResolve = () => {
      state.pendingAISkill = enemy;
      engine.resolveTurn();
    };
    if (used === -1) engine.submitPlayerAction(null);
    else api.playerUseSkill(used);
    assert.equal(state.turnCount, start + 1);
  }
  return { api, engine, state, round, renderActions };
}

function creationLastTick() {
  const { state, round } = battle(
    [['pet_bmhs', ['sk_cszn', 'sk_fthy']]],
    [['pet_qy', ['sk_qy_3']]]
  );
  const clock = state.playerActive;
  const sample = () => ({turn: state.turnCount, hp: clock.hp, maxHp: clock.maxHp, pp: clock.skills[0].pp});
  const history = [];
  round(0);
  history.push(sample());
  round();
  history.push(sample());
  round();
  history.push(sample());
  return { reproduced: history[2].hp === clock.maxHp && history[2].pp === 0, history };
}

function turnEffectPurge() {
  const { state, round } = battle(
    [['pet_qy', ['sk_qy_1', 'sk_qy_4']]],
    [['pet_jydm', ['sk_jydm_3']]]
  );
  const dimo = state.aiActive;
  for (let i = 0; i < 4; i++) round();
  round(-1, 0);
  const atCast = dimo.spdMod;
  round();
  round();
  const stacksBeforeTurn8 = state.playerActive.bloodlineData.qfzn;
  round(0);
  const remainingEffects = dimo.turnEffects.map(effect => effect.name);
  const afterPurge = dimo.spdMod;
  const confirmedPurge = state.messages.some(message => (message.text ?? message).includes('清除对方回合效果'));
  for (let i = 0; i < 5; i++) round();
  return { reproduced: confirmedPurge && atCast > 1 && remainingEffects.length === 0 && dimo.spdMod === atCast,
    stacksBeforeTurn8, atCast, remainingEffects, afterPurge, atTurn13: dimo.spdMod, confirmedPurge };
}

function replacementEffectTiming() {
  const { api, state, round } = battle(
    [['pet_qingling', ['sk_ql_3']]],
    [['pet_jydm', ['sk_jydm_3']], ['pet_bmhs', ['sk_fthy']]]
  );
  const [outgoing, reserve] = state.aiParty;
  const ctx = api.createBattleContext();
  outgoing.hp = 1;
  ctx.setDamageCap(reserve, 50, 80, 3);
  ctx.setDamageReduction(reserve, 25, 3);
  ctx.invertHealing(reserve, 0.5, 3);
  round(0);
  const durations = [reserve.damageCapTurns, reserve.damageReductionTurns, reserve.healInvertTurns];
  const replaced = state.aiActive === reserve && outgoing.isFainted();
  return { reproduced: replaced && durations.every(value => value === 2), replaced, durations };
}

if (require.main === module) {
  console.log(JSON.stringify({ creationLastTick: creationLastTick(),
    turnEffectPurge: turnEffectPurge(), replacementEffectTiming: replacementEffectTiming() }, null, 2));
}
module.exports = { battle };
