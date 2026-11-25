// Run with node reviews/2026-11-25-random-team-battles/run.js.
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..', '..');
const { loadEngine } = require(path.join(root, 'test/lib/harness.js'));
const html = path.join(root, 'ROCO REMAKE.html');
const defaultPets = loadEngine(html).api.DEFAULT_PETS;
const stages = ['atk', 'def', 'spatk', 'spdef', 'spd', 'accuracy', 'evasion'];
const preventSelection = new Set(['sleep', 'deep_sleep', 'freeze', 'fear']);
const maxTurns = Number(process.argv[5] ?? 150);

function rng(seed) {
  return (max) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 2 ** 32 * max);
  };
}

function draw(items, count, random) {
  const pool = [...items];
  return Array.from({ length: count }, () => pool.splice(random(pool.length), 1)[0]);
}

function checkState(gs) {
  for (const [side, party, active] of [
    ['玩家', gs.playerParty, gs.playerActive], ['对手', gs.aiParty, gs.aiActive],
  ]) {
    assert.ok(party.includes(active), side + '出战宠物不在本队');
    if (!gs.battleOver) assert.ok(!active.isFainted(), side + '阵亡宠物仍留在场上');
    for (const pet of party) {
      const cap = pet.maxHp + (pet.maxHpBonus || 0);
      assert.ok(Number.isFinite(pet.hp) && pet.hp >= 0 && pet.hp <= cap,
        pet.id + ' 精力 ' + pet.hp + '/' + cap);
      assert.ok(Number.isFinite(pet.shield) && pet.shield >= 0, pet.id + ' 护盾无效');
      for (const stat of stages) {
        const value = pet[stat + 'Stage'];
        assert.ok(Number.isInteger(value) && value >= -6 && value <= 6,
          pet.id + ' 强化 ' + stat + '=' + value);
      }
      for (const skill of pet.skills) {
        assert.ok(Number.isInteger(skill.pp) && skill.pp >= 0 && skill.pp <= skill.maxPp,
          pet.id + ' ' + skill.id + ' PP ' + skill.pp + '/' + skill.maxPp);
      }
    }
  }
  if (gs.battleOver) assert.ok(
    [gs.playerParty, gs.aiParty].some(party => party.every(pet => pet.isFainted())),
    '双方仍有可出战宠物却判定结束');
}

function run(seed, randomOpponent) {
  const random = rng(seed), e = loadEngine(html, { seed: seed ^ 0x1c6f29ab });
  const { api, sandbox: engine, clock } = e;
  const gs = api.gameState;
  for (const name of ['renderBattle', 'renderBattleActions', 'updateBattleUI',
    'spawnFloatText', 'showScreen', 'startTurnTimer']) engine[name] = () => {};
  const loadouts = Object.fromEntries(defaultPets.map(pet =>
    [pet.id, { skillIds: draw(pet.skillIds, random(10) === 0 ? 3 : 4, random) }]));
  const ids = defaultPets.map(pet => pet.id);
  const teams = [draw(ids, 2 + random(3), random), draw(ids, 2 + random(3), random)];
  engine.savePetLoadouts(loadouts);
  gs.selectedTeamIds = teams[0];
  engine.startBattle();
  gs.opponentTeamIds = teams[1];
  engine.confirmOpponentAndBattle();
  gs.screen = 'battle';
  for (const pet of gs.playerParty.concat(gs.aiParty)) {
    assert.deepEqual(Array.from(pet.skills, skill => skill.id), loadouts[pet.id].skillIds);
  }
  const chooseSkill = (list) => list.length ? list[random(list.length)] : undefined;
  const available = (pet) => pet.skills.filter(engine.canSelectSkill);
  if (randomOpponent) engine.aiDecideAndResolve = () => {
    const skill = chooseSkill(available(gs.aiActive));
    gs.pendingAISkill = gs.aiActive.skills.indexOf(skill);
    engine.resolveTurn();
  };
  let picked, switched = 0, forced = 0;
  const lastRounds = [];
  const used = {};
  const actualUse = engine.recordRoundSkillUse;
  engine.recordRoundSkillUse = (action, target) => {
    const result = actualUse(action, target);
    used[action.skill.id] = (used[action.skill.id] || 0) + 1;
    return result;
  };
  const originalSwitch = engine.executeSwitchAction;
  engine.executeSwitchAction = (action, side) => {
    const incoming = originalSwitch(action, side);
    if (incoming) switched++;
    return incoming;
  };
  const originalForce = engine.forceSwitchPet;
  engine.forceSwitchPet = (pet) => {
    const incoming = originalForce(pet);
    if (incoming) forced++;
    return incoming;
  };
  const resolved = engine.resolveTurn;
  engine.resolveTurn = () => {
    const previous = gs.turnCount;
    const oldActive = [gs.playerActive, gs.aiActive];
    const enemySelection = gs.aiActive.skills[gs.pendingAISkill];
    const logStart = gs.messages.length;
    try {
      resolved();
      assert.equal(gs.turnCount, previous + 1, '一次行动应推进一回合');
      checkState(gs);
    } finally {
      lastRounds.push({
        turn: previous + 1,
        active: oldActive.map(pet => pet.id),
        moves: [picked, enemySelection?.id ?? 'pass'],
        log: gs.messages.slice(logStart).map(entry => entry.text ?? entry).slice(-20),
      });
      if (lastRounds.length > 8) lastRounds.shift();
    }
  };

  let outcome = 'round-limit';
  let issue = null;
  try {
    for (let turn = 0; turn < maxTurns && !gs.battleOver; turn++) {
      const availableSkills = available(gs.playerActive);
      const cannotChoose = availableSkills.length && preventSelection.has(gs.playerActive.status);
      const reserves = gs.playerParty.filter(pet => pet !== gs.playerActive && !pet.isFainted());
      const attemptSwitch = !cannotChoose && reserves.length && !gs.playerActive.bindTurns &&
        !engine.hasSwitchLock(gs.playerActive) && random(100) < (availableSkills.length ? 17 : 45);
      const previous = gs.turnCount;
      if (attemptSwitch) {
        const incoming = reserves[random(reserves.length)];
        picked = 'switch:' + incoming.id;
        engine.playerSwitch(gs.playerParty.indexOf(incoming));
      } else {
        const skill = cannotChoose ? undefined : chooseSkill(availableSkills);
        picked = skill?.id ?? 'pass';
        if (skill) api.playerUseSkill(gs.playerActive.skills.indexOf(skill));
        else engine.submitPlayerAction(null);
      }
      assert.equal(gs.turnCount, previous + 1, '选招或换宠未能推进一回合');
      clock.advance(1000);
      assert.equal(gs.turnCount, previous + 1, '计时器额外推进回合');
    }
    if (gs.battleOver) outcome = 'finished';
  } catch (error) {
    outcome = 'issue';
    issue = error.message;
  }
  const roster = [gs.playerParty, gs.aiParty].map(party => party.map(pet => ({
    id: pet.id, hp: pet.hp, status: pet.status, pp: pet.skills.map(skill => skill.pp)
  })));
  return { seed, mode: randomOpponent ? 'random' : 'ai', teams, loadouts,
    outcome, issue, turn: gs.turnCount, switched, forced, used, roster, lastRounds };
}

const first = Number(process.argv[2] ?? 2026112500);
const count = Number(process.argv[3] ?? 256);
const modes = process.argv[4] ? [process.argv[4]] : ['ai', 'random'];
assert.ok(modes.every(mode => ['ai', 'random'].includes(mode)), '对手策略为 ai 或 random');
assert.ok(Number.isSafeInteger(first) && Number.isInteger(count) && count > 0 &&
  Number.isInteger(maxTurns) && maxTurns > 0, '种子、场数和测试回合上限必须是整数');
const rows = modes.flatMap(mode => Array.from({ length: count }, (_, index) => run(first + index, mode === 'random')));
if (count === 1) console.log(JSON.stringify(rows, null, 2));
else {
  const result = Object.fromEntries(modes.map(mode => {
    const byMode = rows.filter(row => row.mode === mode);
    const atLimit = byMode.filter(row => row.outcome === 'round-limit');
    const issues = byMode.filter(row => row.issue);
    return [mode, {
      battles: byMode.length, finished: byMode.filter(row => row.outcome === 'finished').length,
      issues: issues.length, roundLimit: atLimit.length,
      turns: byMode.reduce((total, row) => total + row.turn, 0),
      switched: byMode.reduce((total, row) => total + row.switched, 0),
      forced: byMode.reduce((total, row) => total + row.forced, 0),
      skills: [...new Set(byMode.flatMap(row => Object.keys(row.used)))].sort(),
      problemSamples: issues.slice(0, 10).map(row => ({ seed: row.seed, issue: row.issue, turn: row.turn })),
      limitSeeds: atLimit.slice(0, 12).map(row => row.seed),
    }];
  }));
  console.log(JSON.stringify(result, null, 2));
}

if (rows.some(row => row.issue)) process.exitCode = 1;
