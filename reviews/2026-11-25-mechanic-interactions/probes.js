const { battle } = require('../2026-11-25-random-team-battles/probes');
const { run } = require('../2026-11-25-random-team-battles/run');

function activeState(state) {
  return [state.playerActive, state.aiActive].map(pet => ({
    name: pet.name, hp: pet.hp, maxHp: pet.maxHp + (pet.maxHpBonus || 0),
    pp: pet.skills.map(skill => skill.pp),
  }));
}

function noPPRemaining() {
  const { state, round, engine } = battle([['pet_jydm', ['sk_jydm_3']]], [['pet_qingling', ['sk_ql_4']]]);
  state.playerActive.skills[0].pp = 0;
  state.aiActive.skills[0].pp = 0;
  const before = activeState(state);
  const playerHasSkill = state.playerActive.skills.some(engine.canSelectSkill);
  const opponentHasSkill = state.aiActive.skills.some(engine.canSelectSkill);
  for (let turn = 0; turn < 40; turn++) round();
  return { before, after: activeState(state), playerHasSkill, opponentHasSkill, ended: state.battleOver };
}

function solitaryClock() {
  const { state, engine, api, round } = battle(
    [['pet_bmhs', ['sk_nlex', 'sk_cszn']]], [['pet_qingling', ['sk_ql_2']]]
  );
  const hits = [];
  for (let i = 0; i < 3; i++) {
    round();
    const ctx = api.createBattleContext();
    ctx.doFixedDamage(state.playerActive, 9999, state.aiActive);
    engine.checkFaints();
    hits.push({ hp: state.playerActive.hp, pp: state.playerActive.skills.map(skill => skill.pp) });
  }
  return { hits, ended: state.battleOver };
}

function clockVersusQingling() {
  const { state, round } = battle(
    [['pet_bmhs', ['sk_nlex', 'sk_mszw', 'sk_fthy', 'sk_cszn']]], [['pet_qingling', ['sk_ql_1', 'sk_ql_2']]]
  );
  const before = activeState(state);
  for (let i = 0; i < 12; i++) round(0, 0);
  return { before, after: activeState(state), ended: state.battleOver };
}

function sameSkillMatchup(id, skillIds, skillIndex, rounds) {
  const { state, round, engine } = battle([[id, skillIds]], [[id, skillIds]]);
  const choose = pet => engine.canSelectSkill(pet.skills[skillIndex]) ? skillIndex : -1;
  const before = activeState(state);
  for (let i = 0; i < rounds && !state.battleOver; i++) round(choose(state.playerActive), choose(state.aiActive));
  return { before, after: activeState(state), turns: state.turnCount, ended: state.battleOver,
    casts: [state.playerActive, state.aiActive].map(pet => pet.skills[skillIndex].useCount || 0),
    channelSettled: state.messages.some(message => message.text.includes('清念沉脉结束，')) };
}

function rewindBeyondMaxHP() {
  const { state, engine, api } = battle([['pet_jydm', ['sk_jydm_3']]], [['pet_qingling', ['sk_ql_4']]]);
  const dimo = state.playerActive;
  Object.assign(engine.mingnianData(dimo), { markTarget: state.aiActive, markThrough: 4 });
  engine.syncMingnianMaxHP(dimo);
  dimo.hp = dimo.maxHp + dimo.maxHpBonus;
  const savedHp = dimo.hp;
  const ctx = api.createBattleContext();
  ctx.saveSnapshot();
  state.turnCount = 3;
  engine.endMingnian(dimo);
  const before = dimo.hp;
  const reportedChange = ctx.restoreSnapshot(3);
  return { savedHp, before, after: dimo.hp, reportedChange };
}

function fearSwitchMismatch() {
  const { api, state, engine, renderActions } = battle(
    [['pet_jydm', ['sk_jydm_4']], ['pet_qy', ['sk_qy_4']]], [['pet_qingling', ['sk_ql_4']]]
  );
  const before = state.playerActive;
  api.createBattleContext().applyStatus(before, 'fear', { turns: 2 });
  const view = engine.document.querySelector('#battle-actions');
  const query = engine.document.querySelector;
  engine.document.querySelector = selector => selector === '#battle-actions' ? view : query(selector);
  renderActions();
  const autoPass = view.innerHTML.includes('自动跳过');
  engine.aiDecideAndResolve = () => { state.pendingAISkill = -1; engine.resolveTurn(); };
  engine.playerSwitch(1);
  return { autoPass, canSelectSwitchInView: !autoPass, engineSwitched: state.playerActive === state.playerParty[1] };
}

function dimoRotate() {
  const loadout = ['sk_jydm_1', 'sk_jydm_2', 'sk_jydm_3', 'sk_jydm_4'];
  const { state, round, engine } = battle([['pet_jydm', loadout]], [['pet_jydm', loadout]], 20261211);
  const cursor = [0, 0];
  function choose(pet, side) {
    for (let i = 0; i < pet.skills.length; i++) {
      const idx = (cursor[side] + i) % pet.skills.length;
      if (!engine.canSelectSkill(pet.skills[idx])) continue;
      cursor[side] = (idx + 1) % pet.skills.length;
      return idx;
    }
    return -1;
  }
  let firstZeroCap;
  const firstZeroWindowDamage = [];
  for (let i = 0; i < 200 && !state.battleOver; i++) {
    round(choose(state.playerActive, 0), choose(state.aiActive, 1));
    const bd = state.playerActive.bloodlineData;
    if (firstZeroCap === undefined && bd.jianghuaCap <= 0) firstZeroCap = { turn: state.turnCount, casts: bd.jianghuaCasts, cap: bd.jianghuaCap };
    if (firstZeroCap && state.turnCount > firstZeroCap.turn && state.turnCount <= firstZeroCap.turn + 5) {
      firstZeroWindowDamage.push([state.playerActive.lastTakenTotal, state.aiActive.lastTakenTotal]);
    }
  }
  return { after: activeState(state), turns: state.turnCount, ended: state.battleOver, firstZeroCap, firstZeroWindowDamage,
    casts: [state.playerActive, state.aiActive].map(pet => pet.skills.map(skill => skill.useCount || 0)) };
}

function seedObservation(seed, skill) {
  const row = run(seed, false, 500);
  return { seed, turns: row.turn, outcome: row.outcome, castsOfInterest: row.used[skill],
    recentMoves: row.lastRounds.map(round => round.moves), roster: row.roster, active: row.active };
}

console.log(JSON.stringify({
  allPPEmpty: noPPRemaining(),
  solitaryClock: solitaryClock(),
  rewindBeyondMaxHP: rewindBeyondMaxHP(),
  fearSwitchMismatch: fearSwitchMismatch(),
  dimoRotate: dimoRotate(),
  clockVersusQingling: clockVersusQingling(),
  qingyuMirror: sameSkillMatchup('pet_qy', ['sk_qy_1', 'sk_qy_4', 'sk_qy_5'], 2, 40),
  dimoMirror: sameSkillMatchup('pet_jydm', ['sk_jydm_3'], 0, 60),
  fearLock: seedObservation(2026112540, 'sk_ql_4'),
  aiNoSwitch: seedObservation(2026112521, 'sk_qy_5'),
}, null, 2));
