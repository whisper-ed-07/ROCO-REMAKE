const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const output = path.join(root, 'ROCO REMAKE.html');
// 保留现有浏览器全局作用域和初始化顺序。
const sourceFiles = [
  'runtime.js',
  'data/elements.js',
  'pets/dimo.js',
  'pets/clock.js',
  'pets/qingyu.js',
  'pets/qingling.js',
  'data/catalog.js',
  'storage.js',
  'battle/model.js',
  'battle/context.js',
  'battle/effects.js',
  'ui/turn-timer.js',
  'battle/weather.js',
  'battle/status.js',
  'ui/battle-log.js',
  'battle/turn.js',
  'ui/bloodline.js',
  'ui/battle-status.js',
  'ui/navigation.js',
  'ui/team-selection.js',
  'ui/battle.js',
  'ui/editors.js',
  'ui/settings.js',
  'main.js',
];

function readSource(file) {
  return fs.readFileSync(path.join(root, 'src', file), 'utf8');
}

const html = readSource('index.html')
  .replace('{{STYLES}}', () => readSource('styles.css'))
  .replace('{{SCRIPTS}}', () => sourceFiles.map(readSource).join(''));

const upToDate = fs.existsSync(output) && fs.readFileSync(output, 'utf8') === html;

function writeGame() {
  // 在同一文件系统内一次替换，浏览器和测试只会读到完整文件。
  const directory = fs.mkdtempSync(path.join(root, '.roco-build-'));
  const temporary = path.join(directory, 'game.html');
  try {
    fs.writeFileSync(temporary, html);
    fs.renameSync(temporary, output);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.rmdirSync(directory);
  }
}

switch (process.argv[2]) {
  case '--check':
    if (!upToDate) {
      console.error('ROCO REMAKE.html 与源码不同步，请运行 node scripts/build.cjs。');
      process.exitCode = 1;
    }
    break;
  case undefined:
    if (!upToDate) writeGame();
    break;
  default:
    console.error('用法：node scripts/build.cjs [--check]');
    process.exitCode = 1;
}
