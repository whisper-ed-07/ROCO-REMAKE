// test/static-checks.js — 第 1 层:静态结构检查(不需要战斗驱动)
// 用法:node test/static-checks.js
// 覆盖:技能结构 / 宠物结构与引用完整性 / 属性克制表 / 引擎硬编码 id 耦合
const path = require('path');
const { loadEngine } = require('./lib/harness');

const HTML = path.join(__dirname, '..', 'ROCO REMAKE.html');
let pass = 0;
const errors = [], warns = [];
const ok = (m) => { pass++; };
const bad = (m) => errors.push(m);
const warn = (m) => warns.push(m);

let loaded;
try {
  loaded = loadEngine(HTML);
} catch (e) {
  console.log('[加载] 引擎加载失败: ' + e.message);
  process.exit(1);
}
const api = loaded.api;
console.log('[加载] 引擎加载 OK(node + vm + DOM stub)');

const pets = api.DEFAULT_PETS || [];
const skills = api.DEFAULT_SKILLS || [];
const ELEMENTS = api.ELEMENTS || {};
const TYPE_CHART = api.TYPE_CHART || {};
const elemKeys = Object.keys(ELEMENTS).filter(k => k !== '_emoji' && k !== '_icon');
const allSkillIds = new Set(skills.map(s => s.id));
const allPetIds = new Set(pets.map(p => p.id));
const VALID_CAT = ['physical', 'special', 'status'];

// ---------- [1] 技能结构 ----------
console.log('\n[1] 技能结构检查(' + skills.length + ' 个技能)');
const skSeen = new Set();
skills.forEach(s => {
  const id = s.id || '(无 id)';
  if (skSeen.has(s.id)) bad('技能 id 重复: ' + id);
  skSeen.add(s.id);
  if (!s.id || !/^sk_/.test(s.id)) warn('技能 id 命名不规范(应为 sk_ 前缀): ' + id);
  ['name', 'element', 'category', 'maxPp', 'accuracy'].forEach(f => {
    if (s[f] === undefined || s[f] === null) bad(id + ' 缺少字段 ' + f);
  });
  if (s.element !== undefined && elemKeys.indexOf(s.element) < 0) bad(id + ' 系别不在 ELEMENTS 中: ' + s.element);
  if (!VALID_CAT.includes(s.category)) bad(id + ' 分类非法: ' + s.category);
  if (typeof s.power !== 'number' || s.power < 0) bad(id + ' 威力非法: ' + s.power);
  if (s.category === 'status' && s.power > 0) warn(id + ' 是变化技但有威力 ' + s.power);
  if (s.category && s.category !== 'status' && !(s.power > 0)) warn(id + ' 是攻击技但威力为 ' + s.power);
  if (typeof s.maxPp !== 'number' || s.maxPp < 1 || s.maxPp > 99) bad(id + ' maxPp 非法: ' + s.maxPp);
  if (typeof s.pp === 'number' && typeof s.maxPp === 'number' && s.pp !== s.maxPp) warn(id + ' pp(' + s.pp + ') != maxPp(' + s.maxPp + ')');
  if (typeof s.accuracy !== 'number' || s.accuracy < 30 || s.accuracy > 100) warn(id + ' 命中率可疑: ' + s.accuracy);
  if (s.priority !== undefined && (typeof s.priority !== 'number' || s.priority < 1 || s.priority > 20)) warn(id + ' 先手值可疑: ' + s.priority);
  if (s.onUse !== undefined && typeof s.onUse !== 'function') bad(id + ' onUse 不是函数');
  ok();
});
console.log('  检查项通过 ' + pass + ',错误 ' + errors.length + ',警告 ' + warns.length);

// ---------- [2] 宠物结构与引用完整性 ----------
console.log('\n[2] 宠物结构与引用完整性(' + pets.length + ' 只)');
const base0 = errors.length, warn0 = warns.length;
const petSeen = new Set();
pets.forEach(p => {
  const id = p.id || '(无 id)';
  if (petSeen.has(p.id)) bad('宠物 id 重复: ' + id);
  petSeen.add(p.id);
  if (!p.id || !/^pet_/.test(p.id)) warn('宠物 id 命名不规范(应为 pet_ 前缀): ' + id);
  ['name', 'element', 'level', 'baseStats', 'skillIds'].forEach(f => {
    if (p[f] === undefined || p[f] === null) bad(id + ' 缺少字段 ' + f);
  });
  if (p.element !== undefined && elemKeys.indexOf(p.element) < 0) bad(id + ' 系别不在 ELEMENTS 中: ' + p.element);
  const bs = p.baseStats || {};
  ['hp', 'atk', 'def', 'spatk', 'spdef', 'spd'].forEach(k => {
    // 0 是合法种族值（部分宠物的物攻/魔攻为 0），只拒绝负数与非数字
    if (typeof bs[k] !== 'number' || bs[k] < 0 || Number.isNaN(bs[k])) bad(id + ' 种族值 ' + k + ' 非法: ' + bs[k]);
  });
  const sids = p.skillIds || [];
  if (sids.length === 0) bad(id + ' 没有任何技能');
  sids.forEach(sid => {
    if (!allSkillIds.has(sid)) bad(id + ' 引用了不存在的技能: ' + sid);
  });
  const own = sids.map(sid => skills.find(s => s.id === sid)).filter(Boolean);
  if (own.length && !own.some(s => s.element === p.element)) warn(id + ' 没有任何本系技能(吃不到 1.5 倍本系加成)');
  if (!p.emoji) warn(id + ' 缺少 emoji');
  if (p.bloodline) {
    if (!p.bloodline.name) bad(id + ' 血脉缺少 name');
    ['onTurnStart', 'onSkillUse', 'onBeforeDamage', 'onAfterDamageSegment'].forEach(h => {
      if (p.bloodline[h] !== undefined && typeof p.bloodline[h] !== 'function') bad(id + ' 血脉钩子 ' + h + ' 不是函数');
    });
  }
});
console.log('  检查项通过 ' + (pass - 0) + ',错误 ' + errors.length + ',警告 ' + warns.length);

// ---------- [3] 属性克制表 ----------
console.log('\n[3] 属性克制表(' + elemKeys.length + ' 系)');
elemKeys.forEach(e => { if (!TYPE_CHART[e]) bad('TYPE_CHART 缺少系别: ' + e); });
Object.keys(TYPE_CHART).forEach(a => {
  if (a === '_emoji' || a === '_icon') return; // UI 元数据键，不算属性
  if (elemKeys.indexOf(a) < 0) bad('TYPE_CHART 含有未定义的系别: ' + a);
  Object.keys(TYPE_CHART[a] || {}).forEach(d => {
    const v = TYPE_CHART[a][d];
    if (elemKeys.indexOf(d) < 0) bad('克制表引用了不存在的系别: ' + a + ' -> ' + d);
    if ([0, 0.5, 1, 2, 4].indexOf(v) < 0) warn('克制表 ' + a + ' -> ' + d + ' 数值异常: ' + v);
  });
});
let defined = 0, total = 0;
elemKeys.forEach(a => elemKeys.forEach(d => { total++; if (TYPE_CHART[a] && TYPE_CHART[a][d] !== undefined) defined++; }));
console.log('  已显式定义 ' + defined + '/' + total + ' 组,其余默认 1 倍');

// ---------- [4] 引擎硬编码 id 耦合(见 AGENTS.md §12) ----------
console.log('\n[4] 引擎硬编码引用检查');
const src = loaded.code;
function literals(re) {
  const out = new Set();
  (src.match(re) || []).forEach(m => out.add(m.replace(/["']/g, '')));
  return out;
}
const hardSkills = literals(/["']sk_[a-z0-9_]+["']/g);
const hardPets = literals(/["']pet_[a-z0-9_]+["']/g);
hardSkills.forEach(id => { if (!allSkillIds.has(id)) bad('引擎引用了不存在的技能 id: ' + id); });
hardPets.forEach(id => { if (!allPetIds.has(id)) bad('引擎引用了不存在的宠物 id: ' + id); });
console.log('  硬编码技能引用 ' + hardSkills.size + ' 个,宠物引用 ' + hardPets.size + ' 个');

const bloodlineNames = pets.filter(p => p.bloodline && p.bloodline.name).map(p => p.bloodline.name);
const namedInEngine = bloodlineNames.filter(n => src.indexOf('"' + n + '"') >= 0 || src.indexOf("'" + n + "'") >= 0);
console.log('  按名称耦合的血脉: ' + (namedInEngine.length ? namedInEngine.join(', ') : '(无)'));
['不灭魂体', '清念灵体'].forEach(n => {
  if (bloodlineNames.indexOf(n) < 0 && src.indexOf(n) >= 0) {
    warn('引擎按名称引用了血脉「' + n + '」,但没有任何内置宠物使用它(死代码 / 待接入)');
  }
});

// ---------- [5] 统计 ----------
console.log('\n[5] 统计');
console.log('  宠物 ' + pets.length + ' 只: ' + pets.map(p => p.id + '(' + (p.element || '?') + ')').join(', '));
console.log('  技能 ' + skills.length + ' 个,系别 ' + elemKeys.length + ' 种');
const withOnUse = skills.filter(s => typeof s.onUse === 'function').length;
console.log('  含 onUse ' + withOnUse + ' 个(扩展路径),legacy 路径 ' + (skills.length - withOnUse) + ' 个');

console.log('\n========== 静态检查汇总 ==========');
if (warns.length) {
  console.log('警告 ' + warns.length + ' 条:');
  warns.forEach(w => console.log('  [warn] ' + w));
}
if (errors.length) {
  console.log('错误 ' + errors.length + ' 条:');
  errors.forEach(e => console.log('  [FAIL] ' + e));
  console.log('\n结论:存在错误');
  process.exit(1);
}
console.log('错误 0 条,警告 ' + warns.length + ' 条');
console.log('结论:静态检查通过');
