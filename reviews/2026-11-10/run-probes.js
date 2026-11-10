// Review evidence only: these probes demonstrate existing faults.
// A passing diagnostic is NOT a passing gameplay regression test.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const root = process.argv[2] || path.resolve(__dirname, '../..');
const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'ROCO REMAKE.html'))).digest('hex');
const evidence = path.join(__dirname, 'runs', sourceHash.slice(0, 12));
fs.mkdirSync(evidence, { recursive: true });
const steps = [
  ['static', path.join(root, 'test/static-checks.js')],
  ...['engine', 'specs', 'ui', 'matrix'].map(name => [name, path.join(__dirname, 'probes', name + '.js')])
];
const summary = {
  reviewedSource: 'ROCO REMAKE.html',
  sourceSha256: sourceHash,
  note: 'These are fault-reproduction probes, not assertions of correct game behavior.',
  steps: []
};
for (const [name, script] of steps) {
  try {
    const stdout = execFileSync(process.execPath, [script, root], { cwd: root, encoding: 'utf8', timeout: 30000, env: { ...process.env, ROCO_REVIEW_OUTPUT: evidence } });
    fs.writeFileSync(path.join(evidence, name + '-stdout.txt'), stdout);
    summary.steps.push({ name, executed: true });
    console.log(name + ': diagnostic executed');
  } catch (error) {
    fs.writeFileSync(path.join(evidence, name + '-stdout.txt'), String(error.stdout || '') + String(error.stderr || '') + '\n' + error.message);
    summary.steps.push({ name, executed: false, error: error.message });
    process.exitCode = 1;
    console.log(name + ': diagnostic execution failed');
  }
}
fs.writeFileSync(path.join(evidence, 'verification-summary.json'), JSON.stringify(summary, null, 2) + '\n');
