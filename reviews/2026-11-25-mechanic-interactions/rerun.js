const { run } = require('../2026-11-25-random-team-battles/run');

const strategies = [false, true];
const seedRanges = [2026112500, 238140000];
const runsPerStrategy = 256;
const initialLimit = 150;
const extendedLimit = 500;

function getLivingRoster(row) {
  return row.roster.map(party => party.filter(pet => pet.hp > 0));
}

function allPPSpent(party) {
  return party.every(pet => pet.pp.every(pp => pp === 0));
}

const results = [];
for (const first of seedRanges) {
  for (const randomOpponent of strategies) {
    const kind = randomOpponent ? 'random' : 'ai';
    const battles = Array.from({length: runsPerStrategy}, (_, i) => run(first + i, randomOpponent, initialLimit));
    const unfinished = battles.filter(row => row.outcome === 'round-limit');
    const continued = unfinished.map(row => run(row.seed, randomOpponent, extendedLimit));
    const stillUnfinished = continued.filter(row => row.outcome === 'round-limit');
    const noPP = stillUnfinished.filter(row => getLivingRoster(row).every(allPPSpent));
    const emptyAiWithReserve = stillUnfinished.filter(row => {
      const ai = getLivingRoster(row)[1];
      const active = ai.find(pet => pet.id === row.active[1]);
      return active && allPPSpent([active]) && ai.some(pet => pet !== active && !allPPSpent([pet]));
    });
    const issues = battles.concat(continued).filter(row => row.outcome === 'issue');
    results.push({
      first, kind, battles: battles.length, finishedAt150: battles.filter(row => row.outcome === 'finished').length,
      reached150: unfinished.length, finishedAfterExtending: continued.filter(row => row.outcome === 'finished').length,
      reached500: stillUnfinished.length, noPPAt500: noPP.length, noPPSamples: noPP.slice(0, 5).map(row => row.seed),
      emptyAiWithReserveAt500: emptyAiWithReserve.length, benchSamples: emptyAiWithReserve.slice(0, 5).map(row => row.seed),
      skills: new Set(battles.flatMap(row => Object.keys(row.used))).size,
      issues: issues.map(({ seed, turn, issue }) => ({ seed, turn, issue })),
    });
  }
}
console.log(JSON.stringify(results,null,2));
if (results.some(row => row.issues.length)) process.exitCode = 1;
