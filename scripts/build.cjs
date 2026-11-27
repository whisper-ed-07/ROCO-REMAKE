const fs = require('node:fs');
const path = require('node:path');
const { readPetText } = require('./pet-text.cjs');

const root = path.join(__dirname, '..');
const entryName = 'ROCO REMAKE.html';
const petTextFile = 'data/pet-text.generated.js';
const styleFiles = [
  'styles/01-foundation-menu-team.css',
  'styles/02-battle.css',
  'styles/03-management-dialogs.css',
  'styles/04-layout-theme.css',
  'styles/05-theme-menu-management.css',
  'styles/06-battle-forms-responsive.css',
  'styles/07-motion-battle-controls.css',
  'styles/08-compact-layout-settings.css',
  'styles/09-wiki.css',
];
// 保留现有浏览器全局作用域和初始化顺序。
const sourceFiles = [
  'runtime.js',
  'data/elements.js',
  'pets/dimo.js',
  'pets/clock.js',
  'pets/qingyu.js',
  'pets/qingling.js',
  'data/catalog.js',
  'data/wiki.js',
  'storage.js',
  'battle/presentation.js',
  'battle/model.js',
  'battle/context.js',
  'battle/effects.js',
  'ui/turn-timer.js',
  'battle/weather.js',
  'battle/status.js',
  'ui/battle-log.js',
  'battle/ai.js',
  'battle/turn.js',
  'ui/bloodline.js',
  'ui/battle-status.js',
  'ui/navigation.js',
  'ui/wiki.js',
  'ui/team-selection.js',
  'ui/battle.js',
  'ui/editors.js',
  'ui/settings.js',
  'main.js',
];

function readSource(file) {
  return fs.readFileSync(path.join(root, 'src', file), 'utf8');
}

function renderPage(styles, scripts) {
  return template
    .replace('{{STYLE_TAGS}}', () => styles)
    .replace('{{SCRIPT_TAGS}}', () => scripts);
}

function isCurrent(file, contents) {
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8') === contents;
}

function writeIfChanged(file, contents) {
  if (isCurrent(file, contents)) return;
  const parent = path.dirname(file);
  fs.mkdirSync(parent, { recursive: true });
  // 同一文件系统内替换，浏览器和测试只会读到完整文件。
  const directory = fs.mkdtempSync(path.join(parent, '.roco-build-'));
  const temporary = path.join(directory, 'artifact');
  try {
    fs.writeFileSync(temporary, contents, 'utf8');
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.rmdirSync(directory);
  }
}

const template = readSource('index.html');
const styles = styleFiles.map(readSource);
const scripts = sourceFiles.map(readSource);
// 转义 "<"，让同一份原文也能安全地用于单文件导出。
const { skillText, bloodlineText } = readPetText(root);
const petText = '// 由 node scripts/build.cjs 根据 pets/*.txt 生成。\n' +
  Object.entries({ ORIGINAL_SKILL_TEXT: skillText, BLOODLINE_ORIGINALS: bloodlineText })
    .map(([name, value]) => 'const ' + name + ' = ' + JSON.stringify(value, null, 2).replaceAll('<', '\\u003c') + ';\n')
    .join('');

const entry = '<!-- 由 node scripts/build.cjs 生成。 -->\n' + renderPage(
  styleFiles.map(file => '<link rel="stylesheet" href="src/' + file + '">').join('\n'),
  [petTextFile, ...sourceFiles].map(file => '<script src="src/' + file + '"></script>').join('\n')
);
const artifacts = [
  [path.join(root, 'src', petTextFile), petText],
  [path.join(root, entryName), entry],
];

switch (process.argv[2]) {
  case '--check': {
    const stale = artifacts.filter(([file, contents]) => !isCurrent(file, contents));
    if (stale.length) {
      console.error('构建文件与源码不同步，请运行 node scripts/build.cjs。');
      for (const [file] of stale) console.error(path.relative(root, file));
      process.exitCode = 1;
    }
    break;
  }
  case '--standalone':
    writeIfChanged(path.join(root, 'dist', entryName), renderPage(
      '<style>\n' + styles.join('') + '</style>',
      '<script>\n' + petText + scripts.join('\n') + '</script>'
    ));
    break;
  case undefined:
    for (const [file, contents] of artifacts) writeIfChanged(file, contents);
    break;
  default:
    console.error('用法：node scripts/build.cjs [--check | --standalone]');
    process.exitCode = 1;
}
