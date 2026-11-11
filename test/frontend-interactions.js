const assert = require('assert');
const path = require('path');
const { loadEngine } = require('./lib/harness');
const { sandbox: s, api } = loadEngine(path.join(__dirname, '..', 'ROCO REMAKE.html'));
const document = s.document;
class Element {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.listeners = {}; this.style = { values: {}, writes: [], setProperty(k, v) { this.values[k] = v; this.writes.push([k, v]); }, removeProperty(k) { delete this.values[k]; this.writes.push([k, null]); }, getPropertyValue(k) { return this.values[k] || ''; }, getPropertyPriority() { return ''; } }; this.classList = { add: c => { if (!this.classList.contains(c)) this.className = (this.className + ' ' + c).trim(); }, remove: (...cs) => { this.className = this.className.split(/\s+/).filter(x => !cs.includes(x)).join(' '); }, contains: c => this.className.split(/\s+/).includes(c), toggle: (c, force) => { const on = force === undefined ? !this.classList.contains(c) : force; if (on) this.classList.add(c); else this.classList.remove(c); return on; } }; this.dataset = {}; this.disabled = false; }
  set className(v) { this.attrs.class = v; } get className() { return this.attrs.class || ''; }
  set id(v) { this.attrs.id = v; } get id() { return this.attrs.id; }
  setAttribute(k,v) { this.attrs[k] = String(v); } getAttribute(k) { return this.attrs[k] ?? null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
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
      if (/\bdisabled\b/.test(token)) el.disabled = true;
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
const body = new Element('body'), actions = new Element(); actions.id = 'battle-actions'; body.appendChild(actions);
document.body = body; document.createElement = tag => new Element(tag); document.querySelector = sel => body.querySelector(sel); document.getElementById = id => body.querySelector('#' + id); document.querySelectorAll = sel => body.querySelectorAll(sel);
const docListeners = {}; document.addEventListener = (t, f) => (docListeners[t] ||= []).push(f); document.removeEventListener = (t, f) => { docListeners[t] = (docListeners[t] || []).filter(x => x !== f); };
const keys = (key, extra = {}) => { const event = { key, preventDefault() { this.prevented = true; }, stopPropagation() {}, ...extra }; for (const fn of [...(docListeners.keydown || [])]) fn(event); return event; };
let slots = [], switches = 0, struggles = 0;
s.playerUseSkill = i => slots.push(i); s.showSwitchPanel = () => switches++; s.aiDecideAndResolve = () => struggles++; s.startTurnTimer = () => {}; s.stopTurnTimer = () => {};
const skills = api.DEFAULT_SKILLS.slice(0, 4).map((skill, i) => ({ ...skill, pp: i === 0 ? 0 : skill.maxPp }));
api.gameState.playerActive = { skills, isFainted: () => false }; api.gameState.switchPending = false;
s.renderBattleActions();
let cards = actions.querySelectorAll('.skill-card'); assert.equal(cards.length, 4);
let buttons = cards.map(c => c.querySelector('.skill-btn')); let infos = cards.map(c => c.querySelector('.skill-info'));
assert(buttons[0].disabled); buttons[0].click(); assert.deepEqual(slots, []); assert(!infos[0].disabled); infos[0].focus(); infos[0].click(); assert.deepEqual(slots, []);
let overlay = document.getElementById('skill-detail-overlay'); assert(overlay); assert.equal(overlay.querySelector('[role=dialog]')?.getAttribute('aria-modal'), 'true');
assert.equal(document.activeElement, overlay.querySelector('#skill-detail-close')); const bodyText = overlay.querySelector('.skill-detail-body'); assert(keys('Tab').prevented); assert.equal(document.activeElement, bodyText); assert(keys('Tab', { shiftKey: true }).prevented); assert.equal(document.activeElement, overlay.querySelector('#skill-detail-close')); keys('Escape'); overlay.dispatch('transitionend', { propertyName: 'opacity' }); assert(!document.getElementById('skill-detail-overlay')); assert.equal(document.activeElement, infos[0]);
infos[0].click(); overlay = document.getElementById('skill-detail-overlay'); overlay.querySelector('#skill-detail-close').click(); overlay.dispatch('transitionend', { propertyName: 'opacity' }); assert.equal(document.activeElement, infos[0]);
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
  assert.strictEqual(fresh, pets[0]);
  assert.equal(fresh.getAttribute('aria-pressed'), before === 'true' ? 'false' : 'true');
  assert.equal(fresh.classList.contains('selected'), before !== 'true');
  assert.equal(app.querySelector('.selected-count strong').textContent, 1);
  assert.equal(app.querySelector(render === 'renderTeamSelect' ? '#btn-ready' : '#opp-ready').disabled, false);
  assert.equal(document.activeElement, fresh);
  fresh.click(); assert.equal(fresh.getAttribute('aria-pressed'), 'false');
  assert.equal(app.querySelector('.selected-count strong').textContent, 0);
  assert.equal(app.querySelector(render === 'renderTeamSelect' ? '#btn-ready' : '#opp-ready').disabled, true);
  const ids = render === 'renderTeamSelect' ? api.gameState.selectedTeamIds : api.gameState.opponentTeamIds;
  ids.push('1', '2', '3', '4', '5', '6'); fresh.click(); assert.equal(ids.length, 6); assert.equal(fresh.getAttribute('aria-pressed'), 'false'); ids.length = 0;
  app.remove();
}

const detail = new Element(); detail.id = 'swap-detail'; body.appendChild(detail);
const pet = api.DEFAULT_PETS[0]; s.openSkillSwap(pet);
let toggle = detail.querySelector('.swap-toggle'); const initial = toggle.getAttribute('aria-pressed');
toggle.click(); toggle = detail.querySelector('.swap-toggle');
assert.equal(toggle.getAttribute('aria-pressed'), initial === 'true' ? 'false' : 'true');
assert.equal(document.activeElement, toggle);
toggle.click(); toggle = detail.querySelector('.swap-toggle'); assert.equal(toggle.getAttribute('aria-pressed'), initial);

// 关闭期间焦点仍被约束；快速重开和同页刷新不会被旧回调删除或抢焦点。
s.window = { getComputedStyle: node => ({ opacity: node.className.includes('modal-overlay') ? '0.42' : '0.56', transform: 'matrix(1, 0, 0, 1, 0, 4)', getPropertyValue: () => '' }) };
infos[0].click(); const oldDetail = document.getElementById('skill-detail-overlay'), oldModal = oldDetail.querySelector('.modal'); keys('Escape'); keys('Escape');
assert(oldDetail.style.writes.some(([k, v]) => k === 'opacity' && v === '0.42'));
assert(oldModal.style.writes.some(([k, v]) => k === 'opacity' && v === '0.56'));
assert(oldModal.style.writes.some(([k, v]) => k === 'transform' && v === 'matrix(1, 0, 0, 1, 0, 4)'));
assert.equal(oldDetail.style.getPropertyValue('animation'), 'none'); assert.equal(oldModal.style.getPropertyValue('animation'), 'none');
assert.equal(oldDetail.style.getPropertyValue('opacity'), ''); assert.equal(oldModal.style.getPropertyValue('transform'), '');
assert(oldDetail.classList.contains('closing')); assert.equal((docListeners.keydown || []).length, 1);
infos[0].click(); const newDetail = document.getElementById('skill-detail-overlay'); assert.notStrictEqual(oldDetail, newDetail);
assert.equal(oldDetail.style.getPropertyValue('animation'), ''); assert.equal(oldModal.style.getPropertyValue('animation'), ''); assert.equal(newDetail.style.getPropertyValue('animation'), '');
oldDetail.dispatch('transitionend', { propertyName: 'opacity' }); assert.strictEqual(document.getElementById('skill-detail-overlay'), newDetail);
assert.equal(document.activeElement, newDetail.querySelector('#skill-detail-close'));
newDetail.dispatch('click'); newDetail.dispatch('transitionend', { target: new Element(), propertyName: 'opacity' }); assert(document.getElementById('skill-detail-overlay'));
newDetail.dispatch('transitionend', { propertyName: 'opacity' }); assert(!document.getElementById('skill-detail-overlay'));
assert.equal((docListeners.keydown || []).length, 0);
const host = new Element(); body.appendChild(host); host.innerHTML = '<button id="old-trigger"></button>';
const detachedTrigger = host.querySelector('#old-trigger'); detachedTrigger.focus(); s.showSkillDetail(skills[0], detachedTrigger);
const detachedDetail = document.getElementById('skill-detail-overlay'); host.innerHTML = '<button id="new-trigger"></button>';
assert.equal(detachedTrigger.isConnected, false); const replacement = host.querySelector('#new-trigger'); replacement.focus();
detachedDetail.querySelector('#skill-detail-close').click(); detachedDetail.dispatch('transitionend', { propertyName: 'opacity' });
assert.equal(document.activeElement, replacement); host.remove();
delete s.window;

// 同步页面挂载和同页刷新；启动层只因自身 opacity 结束或减少动态效果而移除。
const app = new Element(); app.id = 'app'; body.appendChild(app);
api.gameState.screen = 'menu'; s.showScreen('team');
let screen = app.querySelector('.screen'); assert(screen); assert(screen.classList.contains('page-enter'));
assert.equal(document.activeElement, app.querySelector('.screen-title'));
s.showScreen('team'); screen = app.querySelector('.screen'); assert(!screen.classList.contains('page-enter'));
s.showPetForm(); let form = document.getElementById('modal-overlay'); assert(form); const oldSave = form.querySelector('#form-save');
form.querySelector('#form-cancel').click(); assert(form.classList.contains('closing')); assert(oldSave.disabled);
s.showPetForm(); const newForm = document.getElementById('modal-overlay'); assert.notStrictEqual(newForm, form);
form.dispatch('transitionend', { propertyName: 'opacity' }); assert.strictEqual(document.getElementById('modal-overlay'), newForm);
s.showScreen('team'); assert(!document.getElementById('modal-overlay'));
s.showScreen('menu'); assert(app.querySelector('#btn-battle'));
// 逃跑取消可重开；旧关闭回调只处理旧节点。无结束事件时兜底计时负责清理。
const originalSetTimeout = s.setTimeout, originalClearTimeout = s.clearTimeout; let tasks = [];
s.setTimeout = fn => { const task = { fn, cancelled: false }; tasks.push(task); return task; };
s.clearTimeout = task => { if (task) task.cancelled = true; };
s.showFleeConfirm(); const oldFlee = document.getElementById('flee-overlay'); oldFlee.querySelector('#flee-cancel').click();
assert(oldFlee.querySelector('#flee-confirm').disabled); s.showFleeConfirm(); const newFlee = document.getElementById('flee-overlay'); assert.notStrictEqual(oldFlee, newFlee);
for (const task of tasks) if (!task.cancelled) task.fn(); assert.strictEqual(document.getElementById('flee-overlay'), newFlee);
newFlee.querySelector('#flee-cancel').click(); for (const task of tasks) if (!task.cancelled) task.fn(); assert(!document.getElementById('flee-overlay'));
s.setTimeout = originalSetTimeout; s.clearTimeout = originalClearTimeout;
s.showScreen('intro'); let intro = document.getElementById('intro-screen'); assert(intro);
intro.click(); assert(app.querySelector('#btn-battle')); assert(intro.parentNode);
intro.dispatch('transitionend', { target: new Element(), propertyName: 'opacity' }); assert(intro.parentNode);
intro.dispatch('transitionend', { propertyName: 'transform' }); assert(intro.parentNode);
intro.dispatch('transitionend', { propertyName: 'opacity' }); assert(!document.getElementById('intro-screen'));
assert.equal(document.activeElement, app.querySelector('#btn-battle'));
let change; s.window = { matchMedia: () => ({ matches: false, addEventListener: (t, fn) => { change = fn; }, removeEventListener() {} }) };
s.showScreen('intro'); intro = document.getElementById('intro-screen'); intro.click(); change({ matches: true });
assert(!document.getElementById('intro-screen')); assert.equal(document.activeElement, app.querySelector('#btn-battle'));
s.window.matchMedia = () => ({ matches: true }); s.showScreen('intro'); intro = document.getElementById('intro-screen'); intro.click();
assert(!document.getElementById('intro-screen'));
app.remove();
console.log('frontend interactions passed');
