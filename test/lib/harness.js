// test/lib/harness.js — 在 Node 中加载游戏引擎(vm + DOM stub)
// 已验证:可脱离浏览器执行 ROCO REMAKE.html 内的全部引擎代码
// 用法:const { loadEngine } = require('./lib/harness');
//       const { api } = loadEngine(path.join(__dirname, '..', 'ROCO REMAKE.html'));
const fs = require('fs');
const vm = require('vm');

function makeEl() {
  const el = {
    style: {}, dataset: {}, children: [],
    innerHTML: '', textContent: '', value: '', className: '', id: '',
    disabled: false, scrollTop: 0, scrollHeight: 0,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(c) { this.children.push(c); if (c) c.parentNode = this; return c; },
    insertBefore(c) { this.children.push(c); return c; },
    removeChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {},
    setAttribute() {}, getAttribute() { return null; },
    insertAdjacentHTML() {}, focus() {}, blur() {}, click() {},
    querySelector() { return makeEl(); },
    querySelectorAll() { return []; },
  };
  el.parentNode = el;
  return el;
}

function makeRng(seed) {
  let s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const EXPORTS = `
;globalThis.__api = {
  getAllPets, getAllSkills, findSkill, findPet, BattlePet, gameState, createBattleContext,
  executeSkillTurn, playerUseSkill, DEFAULT_PETS, DEFAULT_SKILLS, ELEMENTS, TYPE_CHART,
  getEffectiveness, calcAllStats, STORAGE_KEY_PETS, STORAGE_KEY_SKILLS
};`;

function loadEngine(htmlPath, opts) {
  opts = opts || {};
  const storage = {};
  const myMath = Object.create(Math);
  myMath.random = opts.seed === undefined ? Math.random : makeRng(opts.seed);

  const sandbox = {
    console, Math: myMath, JSON, Date, Object, Array, String, Number, Boolean, Error, RegExp,
    Map, Set, Promise, parseInt, parseFloat, isNaN, isFinite, Infinity, NaN,
    setTimeout: (fn) => { try { if (typeof fn === 'function') fn(); } catch (e) { /* 忽略动画回调 */ } return 0; },
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => 0,
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
      key: (i) => Object.keys(storage)[i] || null,
      get length() { return Object.keys(storage).length; },
    },
    document: {
      querySelector: () => makeEl(),
      querySelectorAll: () => [],
      getElementById: () => makeEl(),
      createElement: () => makeEl(),
      body: makeEl(), head: makeEl(), documentElement: makeEl(),
      addEventListener() {}, removeEventListener() {},
    },
    navigator: { userAgent: 'node-harness' },
    location: { href: 'file:///harness', protocol: 'file:' },
    alert: () => {}, confirm: () => true, prompt: () => null,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  vm.createContext(sandbox);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const si = html.indexOf('<script>');
  const sj = html.lastIndexOf('</script>');
  if (si < 0 || sj < 0) throw new Error('未找到 <script> 块:' + htmlPath);
  sandbox.__html = html;
  sandbox.__code = html.slice(si + '<script>'.length, sj);
  vm.runInContext(sandbox.__code, sandbox, { filename: 'engine.js' });
  vm.runInContext(EXPORTS, sandbox, { filename: 'harness-exports.js' });

  return { api: sandbox.__api, sandbox, myMath, code: sandbox.__code, html };
}

module.exports = { loadEngine, makeEl, makeRng };
