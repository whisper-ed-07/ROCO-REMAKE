const assert = require('assert');
const path = require('path');
const { loadEngine } = require('./lib/harness');
const { sandbox: s, api } = loadEngine(path.join(__dirname, '..', 'ROCO REMAKE.html'));
const document = s.document;
class Element {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.listeners = {}; this.style = { setProperty() {} }; this.classList = { add() {}, remove() {}, toggle() {} }; this.disabled = false; }
  set className(v) { this.attrs.class = v; } get className() { return this.attrs.class || ''; }
  set id(v) { this.attrs.id = v; } get id() { return this.attrs.id; }
  setAttribute(k,v) { this.attrs[k] = String(v); } getAttribute(k) { return this.attrs[k] ?? null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); }
  set innerHTML(html) {
    this.children = []; this._html = html; const stack = [this];
    for (const m of html.matchAll(/<\/?[a-zA-Z][^>]*>/g)) {
      const token = m[0]; if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
      const tag = /^<([\w-]+)/.exec(token)[1]; const el = new Element(tag);
      for (const a of token.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) { if (a.index === 1) continue; el.setAttribute(a[1], a[2] || ''); }
      if (/\bdisabled\b/.test(token)) el.disabled = true;
      stack[stack.length - 1].appendChild(el);
      if (!/^(input|br|img|hr)$/i.test(tag) && !token.endsWith('/>')) stack.push(el);
    }
  }
  get innerHTML() { return this._html || ''; }
  matches(sel) { const attr = /^\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]$/.exec(sel); if (attr) return attr[2] === undefined ? this.getAttribute(attr[1]) !== null : this.getAttribute(attr[1]) === attr[2]; if (sel[0] === '#') return this.id === sel.slice(1); if (sel[0] === '.') return this.className.split(/\s+/).includes(sel.slice(1)); return this.tagName.toLowerCase() === sel; }
  querySelectorAll(sel) { const out = []; const walk = n => { for (const c of n.children) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
  querySelector(sel) { const parts = sel.split(/\s+/); if (parts.length > 1) { const parent = this.querySelector(parts.shift()); return parent ? parent.querySelector(parts.join(' ')) : null; } return this.querySelectorAll(sel)[0] || null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); }
  dispatch(type, extra = {}) { const ev = { target: this, key: '', stopPropagation() { this.stopped = true; }, preventDefault() {}, ...extra }; for (const fn of this.listeners[type] || []) fn(ev); if (!ev.stopped && this.parentNode) this.parentNode.dispatchBubble(type, ev); }
  dispatchBubble(type, ev) { for (const fn of this.listeners[type] || []) fn(ev); if (!ev.stopped && this.parentNode) this.parentNode.dispatchBubble(type, ev); }
  click() { if (!this.disabled) this.dispatch('click'); }
  focus() { document.activeElement = this; }
}
const body = new Element('body'), actions = new Element(); actions.id = 'battle-actions'; body.appendChild(actions);
document.body = body; document.createElement = tag => new Element(tag); document.querySelector = sel => body.querySelector(sel); document.getElementById = id => body.querySelector('#' + id); document.querySelectorAll = sel => body.querySelectorAll(sel);
const docListeners = {}; document.addEventListener = (t, f) => (docListeners[t] ||= []).push(f); document.removeEventListener = (t, f) => { docListeners[t] = (docListeners[t] || []).filter(x => x !== f); };
const keys = key => { for (const fn of [...(docListeners.keydown || [])]) fn({ key, preventDefault() {}, stopPropagation() {} }); };
let slots = [], switches = 0, struggles = 0;
s.playerUseSkill = i => slots.push(i); s.showSwitchPanel = () => switches++; s.aiDecideAndResolve = () => struggles++; s.startTurnTimer = () => {}; s.stopTurnTimer = () => {};
const skills = api.DEFAULT_SKILLS.slice(0, 4).map((skill, i) => ({ ...skill, pp: i === 0 ? 0 : skill.maxPp }));
api.gameState.playerActive = { skills, isFainted: () => false }; api.gameState.switchPending = false;
s.renderBattleActions();
let cards = actions.querySelectorAll('.skill-card'); assert.equal(cards.length, 4);
let buttons = cards.map(c => c.querySelector('.skill-btn')); let infos = cards.map(c => c.querySelector('.skill-info'));
assert(buttons[0].disabled); buttons[0].click(); assert.deepEqual(slots, []); assert(!infos[0].disabled); infos[0].focus(); infos[0].click(); assert.deepEqual(slots, []);
let overlay = document.getElementById('skill-detail-overlay'); assert(overlay); assert.equal(overlay.querySelector('[role=dialog]')?.getAttribute('aria-modal'), 'true');
assert.equal(document.activeElement, overlay.querySelector('#skill-detail-close')); keys('Escape'); assert(!document.getElementById('skill-detail-overlay')); assert.equal(document.activeElement, infos[0]);
infos[0].click(); overlay = document.getElementById('skill-detail-overlay'); overlay.querySelector('#skill-detail-close').click(); assert.equal(document.activeElement, infos[0]);
buttons.slice(1).forEach(b => b.click()); assert.deepEqual(slots, [1,2,3]);
skills[0].pp = skills[0].maxPp; s.renderBattleActions(); actions.querySelectorAll('.skill-card')[0].querySelector('.skill-btn').click(); assert.deepEqual(slots, [1,2,3,0]);
actions.querySelector('.battle-utility-list').querySelector('.action-btn').click(); assert.equal(switches, 1);
skills.forEach(x => x.pp = 0); s.renderBattleActions(); actions.querySelector('.struggle-btn').click(); assert.equal(struggles, 1);


// 选宠使用原生按钮，键盘激活由浏览器提供。
for (const render of ['renderTeamSelect', 'renderOpponentSelect']) {
  const app = new Element(); app.id = 'app'; body.appendChild(app); s[render](app);
  const pets = app.querySelectorAll('.pet-card'); assert(pets.length);
  for (const pet of pets) { assert.equal(pet.tagName, 'BUTTON'); assert(['true', 'false'].includes(pet.getAttribute('aria-pressed'))); }
  const attr = render === 'renderTeamSelect' ? 'data-pet-id' : 'data-opp-id';
  const id = pets[0].getAttribute(attr), before = pets[0].getAttribute('aria-pressed');
  pets[0].click(); const fresh = app.querySelector('[' + attr + '="' + id + '"]');
  assert.equal(fresh.getAttribute('aria-pressed'), before === 'true' ? 'false' : 'true');
  assert.equal(document.activeElement, fresh); app.remove();
}

const detail = new Element(); detail.id = 'swap-detail'; body.appendChild(detail);
const pet = api.DEFAULT_PETS[0]; s.openSkillSwap(pet);
let toggle = detail.querySelector('.swap-toggle'); const initial = toggle.getAttribute('aria-pressed');
toggle.click(); toggle = detail.querySelector('.swap-toggle');
assert.equal(toggle.getAttribute('aria-pressed'), initial === 'true' ? 'false' : 'true');
assert.equal(document.activeElement, toggle);
toggle.click(); toggle = detail.querySelector('.swap-toggle'); assert.equal(toggle.getAttribute('aria-pressed'), initial);
console.log('frontend interactions passed');
