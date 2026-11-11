const assert = require('assert');
const path = require('path');
const { loadEngine } = require('./lib/harness');
const { sandbox: s, api } = loadEngine(path.join(__dirname, '..', 'ROCO REMAKE.html'));
const document = s.document;
class Element {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.listeners = {}; this.style = { values: {}, writes: [], setProperty(k, v) { this.values[k] = v; this.writes.push([k, v]); }, removeProperty(k) { delete this.values[k]; this.writes.push([k, null]); }, getPropertyValue(k) { return this.values[k] || ''; }, getPropertyPriority() { return ''; } }; this.classList = { add: c => { if (!this.classList.contains(c)) this.className = (this.className + ' ' + c).trim(); }, remove: (...cs) => { this.className = this.className.split(/\s+/).filter(x => !cs.includes(x)).join(' '); }, contains: c => this.className.split(/\s+/).includes(c), toggle: (c, force) => { const on = force === undefined ? !this.classList.contains(c) : force; if (on) this.classList.add(c); else this.classList.remove(c); return on; } }; this.dataset = {}; this.disabled = false; this.scrollTop = 0; this.scrollLeft = 0; this.scrollHeight = 1000; this.clientHeight = 100; }
  set textContent(v) { for (const child of this.children) child.parentNode = null; this.children = []; this._text = String(v); } get textContent() { return this._text || ''; }
  set className(v) { this.attrs.class = v; } get className() { return this.attrs.class || ''; }
  set id(v) { this.attrs.id = v; } get id() { return this.attrs.id; }
  setAttribute(k,v) { this.attrs[k] = String(v); } getAttribute(k) { return this.attrs[k] ?? null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  insertBefore(c, before) { c.parentNode = this; this.children.splice(this.children.indexOf(before), 0, c); return c; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); this.parentNode = null; }
  get isConnected() { let node = this; while (node.parentNode) node = node.parentNode; return node === body; }
  insertAdjacentHTML(where, html) { const wrapper = new Element(); wrapper.innerHTML = html; for (const child of [...wrapper.children]) this.appendChild(child); }
  set innerHTML(html) {
    for (const child of this.children) child.parentNode = null;
    this.children = []; this._html = html; const stack = [this];
    for (const m of html.matchAll(/<\/?[a-zA-Z][^>]*>/g)) {
      const token = m[0]; if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
      const tag = /^<([\w-]+)/.exec(token)[1]; const el = new Element(tag);
      for (const a of token.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) { if (a.index === 1) continue; el.setAttribute(a[1], a[2] || ''); }
      if (/\bdisabled\b/.test(token)) el.disabled = true; const width = /width:([0-9.]+%)/.exec(el.getAttribute('style') || ''); if (width) el.style.width = width[1];
      stack[stack.length - 1].appendChild(el);
      if (!/^(input|br|img|hr)$/i.test(tag) && !token.endsWith('/>')) stack.push(el);
    }
  }
  get innerHTML() { return this._html || ''; }
  matches(sel) { const attr = /^\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]$/.exec(sel); if (attr) return attr[2] === undefined ? this.getAttribute(attr[1]) !== null : this.getAttribute(attr[1]) === attr[2]; if (sel[0] === '#') return this.id === sel.slice(1); if (sel[0] === '.') return this.className.split(/\s+/).includes(sel.slice(1)); return this.tagName.toLowerCase() === sel; }
  querySelectorAll(sel) { if (sel === 'button:not([disabled]), [tabindex="0"]') return this.querySelectorAll('[tabindex="0"]').concat(this.querySelectorAll('button').filter(x => !x.disabled)); const out = []; const walk = n => { for (const c of n.children) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
  querySelector(sel) { const parts = sel.split(/\s+/); if (parts.length > 1) { const parent = this.querySelector(parts.shift()); return parent ? parent.querySelector(parts.join(' ')) : null; } return this.querySelectorAll(sel)[0] || null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); }
  dispatch(type, extra = {}) { const ev = { target: this, key: '', stopPropagation() { this.stopped = true; }, preventDefault() {}, ...extra }; for (const fn of this.listeners[type] || []) fn(ev); if (!ev.stopped && this.parentNode) this.parentNode.dispatchBubble(type, ev); }
  dispatchBubble(type, ev) { for (const fn of this.listeners[type] || []) fn(ev); if (!ev.stopped && this.parentNode) this.parentNode.dispatchBubble(type, ev); }
  click() { if (!this.disabled) this.dispatch('click'); }
  focus() { document.activeElement = this; }
}

const body = new Element('body'), app = new Element(); app.id = 'app'; body.appendChild(app);
document.body = body; document.createElement = tag => new Element(tag); document.querySelector = sel => body.querySelector(sel); document.getElementById = id => body.querySelector('#' + id); document.querySelectorAll = sel => body.querySelectorAll(sel);
document.addEventListener = () => {}; document.removeEventListener = () => {};
let timers = []; s.setTimeout = (fn, ms) => { const t = { fn, ms, cancelled: false }; timers.push(t); return t; }; s.clearTimeout = t => { if (t) t.cancelled = true; };
s.startTurnTimer = () => {}; s.stopTurnTimer = () => {};
const gs = api.gameState, first = new api.BattlePet(api.DEFAULT_PETS[0]), enemy = new api.BattlePet(api.DEFAULT_PETS[1]);
gs.screen = 'battle'; gs.battleId = 1; gs.playerActive = first; gs.aiActive = enemy; gs.messages = []; gs.playerParty = [first]; gs.aiParty = [enemy]; gs.battleOver = false; gs.switchPending = false;
first.hp = Math.floor(first.maxHp * .7); enemy.hp = Math.floor(enemy.maxHp * .6);
s.renderBattle(app);
const get = id => document.querySelector('#' + id), ghost = side => get(side + '-hp-bar').parentNode.querySelector('.hp-bar-ghost');
const pct = p => Math.max(0, Math.min(100, p.hp / p.maxHp * 100)) + '%';
assert.equal(get('player-hp-bar').style.width, pct(first)); assert.equal(ghost('player').style.width, pct(first));
assert.equal(get('ai-hp-bar').style.width, pct(enemy)); assert.equal(ghost('ai').style.width, pct(enemy));
assert(!get('player-sprite').classList.contains('pet-enter')); assert(!get('ai-sprite').classList.contains('pet-enter'));
first.hp -= 40; enemy.hp -= 20; s.updateBattleUI();
assert.equal(get('player-hp-bar').style.width, pct(first)); assert.equal(ghost('player').style.width, pct(first));
assert.equal(get('ai-hp-bar').style.width, pct(enemy)); assert.equal(ghost('ai').style.width, pct(enemy));
const pGhost = ghost('player'), status = get('player-status'); const markup = status.visualMarkup; s.updateBattleUI();
assert.strictEqual(ghost('player'), pGhost); assert.equal(status.visualMarkup, markup);
first.hp += 10; s.updateBattleUI(); assert.equal(ghost('player').style.width, pct(first));
first.shield = 50; s.updateBattleUI(); let fill = get('player-shield').querySelector('.shield-bar-inner'); assert(fill); s.updateBattleUI(); assert.strictEqual(get('player-shield').querySelector('.shield-bar-inner'), fill);
first.shield = 0; s.updateBattleUI(); assert.equal(fill.style.width, '0%'); first.shield = 10; s.updateBattleUI(); assert(get('player-shield').querySelector('.shield-bar-inner'));
// 驱逐可只替换 active 后刷新 UI：同盾值但不同 maxHp 必须使用新对象比例。
first.shield = 100; s.updateBattleUI(); const expelled = new api.BattlePet(api.DEFAULT_PETS[2]); expelled.shield = 100;
gs.playerActive = expelled; s.spawnFloatText(expelled, 12, 'dmg');
assert.equal(get('player-sprite').textContent, expelled.emoji); assert.equal(get('player-sprite').visualPet, expelled);
assert.equal(get('player-sprite').children.length, 1); assert.equal(get('player-info').querySelector('.pet-info-name').textContent, expelled.name);
assert.equal(get('player-info').querySelector('.pet-info-lv').textContent, 'Lv.' + expelled.level);
assert(get('player-info').querySelector('.pet-info-element').innerHTML.includes(api.ELEMENTS[expelled.element].name));
assert(!get('ai-sprite').classList.contains('pet-enter')); s.updateBattleUI();
assert.equal(get('player-hp-bar').style.width, pct(expelled)); assert.equal(ghost('player').style.width, pct(expelled));
fill = get('player-shield').querySelector('.shield-bar-inner'); assert.equal(fill.style.width, Math.min(100, 100 / expelled.maxHp * 100) + '%');
expelled.maxHp += 100; s.updateBattleUI(); assert.equal(fill.style.width, Math.min(100, 100 / expelled.maxHp * 100) + '%');
const sameTemplate = new api.BattlePet(api.DEFAULT_PETS[2]); sameTemplate.hp = Math.floor(sameTemplate.maxHp * .35); sameTemplate.shield = 100;
gs.playerActive = sameTemplate; s.updateBattleUI(); assert.strictEqual(get('player-sprite').visualPet, sameTemplate);
assert(get('player-sprite').classList.contains('pet-enter')); assert(!get('ai-sprite').classList.contains('pet-enter'));
assert.equal(get('player-hp-bar').style.width, pct(sameTemplate)); assert.equal(ghost('player').style.width, pct(sameTemplate));
assert.equal(get('player-shield').querySelector('.shield-bar-inner').style.width, 100 / sameTemplate.maxHp * 100 + '%');
gs.playerActive = first; s.updateBattleUI();

const playerSprite = get('player-sprite'), aiSprite = get('ai-sprite'), bench = new api.BattlePet(api.DEFAULT_PETS[0]);
s.spawnFloatText(bench, 12, 'dmg'); assert.equal(playerSprite.children.length, 0); assert.equal(aiSprite.children.length, 0);
s.spawnFloatText(first, 12, 'dmg'); assert(playerSprite.classList.contains('hit')); assert.equal(playerSprite.children.length, 1); assert.equal(aiSprite.children.length, 0);
s.spawnFloatText(enemy, 8, 'heal'); assert.equal(aiSprite.children.length, 1); assert(!aiSprite.classList.contains('hit'));
get('battle-messages').scrollTop = 120; document.querySelector('.battle-skill-list').scrollLeft = 75;
const oldAiBar = get('ai-hp-bar'), oldAiGhost = ghost('ai'); oldAiBar.currentWidth = 45; oldAiGhost.currentWidth = 55;
oldAiBar.parentNode.getBoundingClientRect = () => ({ width: 100 });
s.window = { getComputedStyle: node => ({ width: String(node.currentWidth), getPropertyValue: () => '' }) };
const replacement = new api.BattlePet(api.DEFAULT_PETS[0]); replacement.hp = Math.floor(replacement.maxHp * .4); gs.playerActive = replacement;
s.renderBattle(app); assert(app.innerHTML.includes('id="ai-hp-bar" style="width:45%"')); assert([...app.innerHTML.matchAll(/hp-bar-ghost" style="width:([0-9.]+)%"/g)].some(m => Math.abs(Number(m[1]) - 55) < 1e-9)); delete s.window; assert.equal(get('battle-messages').scrollTop, 120); assert.equal(document.querySelector('.battle-skill-list').scrollLeft, 75);
assert(get('player-sprite').classList.contains('pet-enter')); assert(!get('ai-sprite').classList.contains('pet-enter'));
assert.equal(get('player-hp-bar').style.width, pct(replacement)); assert.equal(ghost('player').style.width, pct(replacement));
assert.equal(playerSprite.children.length, 0); assert.equal(aiSprite.children.length, 0);
for (const t of timers) if (!t.cancelled) t.fn(); assert(!get('player-sprite').classList.contains('pet-enter'));
const previousSprite = get('player-sprite'); s.spawnFloatText(replacement, 1, 'dmg'); gs.battleId = 2; gs.playerActive = first; s.renderBattle(app);
assert.equal(previousSprite.children.length, 0); assert.equal(get('player-hp-bar').style.width, pct(first));
assert(!get('player-sprite').classList.contains('pet-enter')); assert.equal(document.querySelector('.battle-skill-list').scrollLeft, 0);
const listeners = new Set(); let removed = false; s.window = { matchMedia: () => ({ matches: false, addEventListener: (t, fn) => { listeners.add(fn); }, removeEventListener: (t, fn) => { listeners.delete(fn); removed = true; } }) };
s.spawnFloatText(first, 4, 'dmg'); assert(get('player-sprite').classList.contains('hit')); for (const listener of [...listeners]) listener({ matches: true }); assert(removed); assert(!get('player-sprite').classList.contains('hit')); assert.equal(get('player-sprite').children.length, 0); assert.equal(listeners.size, 0);
s.window.matchMedia = () => ({ matches: true }); s.spawnFloatText(first, 3, 'dmg'); assert.equal(get('player-sprite').children.length, 0);
console.log('motion regressions passed');
