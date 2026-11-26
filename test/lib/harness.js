// test/lib/harness.js — 在 Node 中加载游戏引擎(vm + DOM stub)
// 从游戏入口加载有序的经典脚本。
// 用法:const { loadEngine } = require('./lib/harness');
//       const { api } = loadEngine(path.join(__dirname, '..', 'ROCO REMAKE.html'));
const vm = require('vm');
const { readGame } = require('./game-assets');

function makeEl() {
  const el = {
    style: { setProperty(k, v) { this[k] = v; }, getPropertyValue(k) { return this[k] || ''; }, removeProperty(k) { delete this[k]; } },
    dataset: {}, children: [],
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

// 可推进的虚拟时钟：默认不立即执行回调，测试用 clock.advance(ms) 推进
function createClock() {
  let now = 0, seq = 0;
  const timers = [];
  const schedule = (fn, ms, interval) => {
    const t = { id: ++seq, at: now + Math.max(0, ms || 0), fn, interval: interval || null };
    timers.push(t);
    return t.id;
  };
  const clear = (id) => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); };
  const advance = (ms) => {
    const target = now + Math.max(0, ms || 0);
    for (;;) {
      let due = null;
      for (const t of timers) if (t.at <= target && (!due || t.at < due.at)) due = t;
      if (!due) break;
      now = due.at;
      if (due.interval) due.at = now + due.interval; else timers.splice(timers.indexOf(due), 1);
      due.fn(); // 不吞异常，测试能发现回调里的错误
    }
    now = target;
  };
  return {
    advance, now: () => now, pending: () => timers.length,
    setTimeout: (fn, ms) => schedule(fn, ms, null),
    setInterval: (fn, ms) => schedule(fn, ms, Math.max(1, ms || 1)),
    clearTimeout: clear,
  };
}

function loadEngine(htmlPath, opts) {
  opts = opts || {};
  const storage = {};
  const clock = createClock();
  const myMath = Object.create(Math);
  myMath.random = opts.seed === undefined ? Math.random : makeRng(opts.seed);

  const sandbox = {
    console, Math: myMath, JSON, Date, Object, Array, String, Number, Boolean, Error, RegExp,
    Map, Set, Promise, parseInt, parseFloat, isNaN, isFinite, Infinity, NaN,
    setTimeout: (fn, ms) => clock.setTimeout(fn, ms),
    clearTimeout: (id) => clock.clearTimeout(id),
    setInterval: (fn, ms) => clock.setInterval(fn, ms),
    clearInterval: (id) => clock.clearTimeout(id),
    requestAnimationFrame: (fn) => clock.setTimeout(fn, 16),
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
  const { html, scripts } = readGame(htmlPath);
  if (!scripts.length) throw new Error('未找到游戏脚本：' + htmlPath);
  sandbox.__html = html;
  sandbox.__code = scripts.map(({ content }) => content).join('\n');
  for (const { filename, content } of scripts) {
    new vm.Script(content, { filename }).runInContext(sandbox);
  }
  vm.runInContext(EXPORTS, sandbox, { filename: 'harness-exports.js' });

  return { api: sandbox.__api, sandbox, myMath, clock, code: sandbox.__code, html };
}

module.exports = { loadEngine, makeEl, makeRng };
