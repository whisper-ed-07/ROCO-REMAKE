const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const output = path.join(root, 'ROCO REMAKE.html');
const sourceFiles = ['game.js'];

function readSource(file) {
  return fs.readFileSync(path.join(root, 'src', file), 'utf8');
}

const html = readSource('index.html')
  .replace('{{STYLES}}', () => readSource('styles.css'))
  .replace('{{SCRIPTS}}', () => sourceFiles.map(readSource).join(''));

switch (process.argv[2]) {
  case '--check':
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== html) {
      console.error('ROCO REMAKE.html 与源码不同步，请运行 node scripts/build.cjs。');
      process.exitCode = 1;
    }
    break;
  case undefined:
    fs.writeFileSync(output, html);
    break;
  default:
    console.error('用法：node scripts/build.cjs [--check]');
    process.exitCode = 1;
}
