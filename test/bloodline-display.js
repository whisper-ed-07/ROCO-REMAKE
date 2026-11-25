const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadEngine } = require('./lib/harness');

const root = path.join(__dirname, '..');
const { sandbox: s, api, clock } = loadEngine(path.join(root, 'ROCO REMAKE.html'));
const originals = vm.runInContext('BLOODLINE_ORIGINALS', s);
const cases = [
  ['pet_qingling', '清灵', '血脉：清念灵体', '微灵封体 幽灵系变化'],
  ['pet_jydm', '极影迪莫', '[图片]血脉：明念', '[图片]专属技能简析'],
  ['pet_qy', '清羽', '血脉：清念/残脉', '清翎覆尘 翼系变化'],
  ['pet_bmhs', '创世神钟', '血脉：不灭魂体', '创世之能 普通系变化'],
];
function originalBody(name, heading, next) {
  const lines = fs.readFileSync(path.join(root, 'pets', name + '.txt'), 'utf8').split(/\r?\n/);
  const start = lines.indexOf(heading);
  let end = lines.findIndex((line, i) => i > start && line.startsWith(next));
  assert(start >= 0 && end > start, `${name} 血脉边界不存在`);
  while (end > start + 1 && lines[end - 1] === '') end--;
  return lines.slice(start + 1, end).join('\n');
}
for (const [id, name, heading, next] of cases) {
  assert.strictEqual(originals[id], originalBody(name, heading, next), `${name} 血脉正文应与原文逐字一致`);
}


// 最小 DOM：事件、节点生命周期与文本均由测试控制，时钟来自引擎 harness。
const document = s.document;
class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.listeners = {};
    this.dataset = {}; this.style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
    this.classList = {
      add: c => { if (!this.classList.contains(c)) this.className = (this.className + ' ' + c).trim(); },
      remove: (...cs) => { this.className = this.className.split(/\s+/).filter(c => !cs.includes(c)).join(' '); },
      contains: c => this.className.split(/\s+/).includes(c),
      toggle: (c, force) => { const on = force === undefined ? !this.classList.contains(c) : force; if (on) this.classList.add(c); else this.classList.remove(c); return on; },
    };
  }
  set className(v) { this.attrs.class = v; } get className() { return this.attrs.class || ''; }
  set id(v) { this.attrs.id = v; } get id() { return this.attrs.id || ''; }
  set textContent(v) { this._text = String(v); this.children.forEach(c => { c.parentNode = null; }); this.children = []; }
  get textContent() { return (this._text || '') + this.children.map(c => c.textContent).join(''); }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return this.attrs[k] ?? null; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { c.remove(); c.parentNode = this; this.children.push(c); return c; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; }
  contains(other) { return this === other || this.children.some(c => c.contains(other)); }
  get isConnected() { let node = this; while (node.parentNode) node = node.parentNode; return node === document.body; }
  matches(sel) { if (sel === ':focus-visible') return this.keyboardFocus === true; if (sel[0] === '.') return this.classList.contains(sel.slice(1)); if (sel[0] === '#') return this.id === sel.slice(1); return this.tagName.toLowerCase() === sel; }
  querySelectorAll(sel) { const result = []; for (const c of this.children) { if (c.matches(sel)) result.push(c); result.push(...c.querySelectorAll(sel)); } return result; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); }
  dispatch(type, extra = {}) {
    const event = { type, target: this, currentTarget: this, pointerType: 'mouse', relatedTarget: null,
      preventDefault() {}, stopPropagation() { this.stopped = true; }, ...extra };
    for (const fn of [...(this.listeners[type] || [])]) fn(event);
    return event;
  }
  click() { this.dispatch('click'); }
  getBoundingClientRect() { return { left: 20, right: 160, top: 50, bottom: 90, width: 140, height: 40 }; }
  get offsetWidth() { return Math.min(460, parseFloat(this.style.maxWidth) || 460); }
  get offsetHeight() { return Math.min(280, parseFloat(this.style.maxHeight) || 280); }
  focus() { document.activeElement = this; }
}
const listeners = {};
document.body = new Element('body');
document.createElement = tag => new Element(tag);
document.querySelector = sel => document.body.querySelector(sel);
document.querySelectorAll = sel => document.body.querySelectorAll(sel);
document.getElementById = id => document.body.querySelector('#' + id);
document.addEventListener = (type, fn) => (listeners[type] ||= []).push(fn);
document.removeEventListener = (type, fn) => { listeners[type] = (listeners[type] || []).filter(f => f !== fn); };
function key(key) { for (const fn of [...(listeners.keydown || [])]) fn({ key, preventDefault() {}, stopPropagation() {} }); }
Object.defineProperty(Element.prototype, 'innerHTML', {
  set(value) { assert.strictEqual(value, '', '夹具仅支持清空内容'); this.children.forEach(c => { c.parentNode = null; }); this.children = []; this._text = ''; },
  get() { return ''; },
});
document.documentElement = { clientWidth: 1024 };
s.innerWidth = 1024; s.innerHeight = 768;
s.addEventListener = () => {}; s.removeEventListener = () => {};
api.gameState.screen = 'battle';
const slot = new Element(); document.body.appendChild(slot);
const pet = id => api.DEFAULT_PETS.find(p => p.id === id);
const preview = () => document.body.querySelector('.bloodline-preview');
const trigger = () => slot.querySelector('.battle-bloodline-trigger');
s.syncBattleBloodline(slot, pet('pet_qingling'));
let button = trigger(); assert(button, '内置血脉应有入口');
button.dispatch('pointerenter', { pointerType: 'mouse' });
clock.advance(279); assert.strictEqual(preview(), null, '悬停不足 280ms 不显示');
clock.advance(1); assert(preview(), '悬停 280ms 显示');
assert.strictEqual(preview().querySelector('.bloodline-preview-body').textContent, originals.pet_qingling);
button.dispatch('pointerleave');
preview().dispatch('pointerenter');
clock.advance(160); assert(preview(), '移到正文上仍可阅读');
preview().dispatch('pointerleave');
clock.advance(160); assert.strictEqual(preview(), null, '移开后关闭');
button.dispatch('pointerenter', { pointerType: 'touch' }); clock.advance(280); assert.strictEqual(preview(), null, '触摸进入不应触发鼠标悬停');
button.dispatch('click', { pointerType: 'touch' }); assert(preview(), '触摸点击打开');
key('Escape'); assert.strictEqual(preview(), null, 'Escape 关闭');
button.dispatch('pointerenter', { pointerType: 'mouse' }); clock.advance(280); assert(preview());
s.syncBattleBloodline(slot, pet('pet_qy')); assert.strictEqual(preview(), null, '换宠同步应关闭旧预览');
button = trigger(); button.dispatch('click'); assert.strictEqual(preview().querySelector('.bloodline-preview-body').textContent, originals.pet_qy);
assert.match(preview().querySelector('.bloodline-preview-ruling').textContent, /至少消耗 1 层清风之念/);
s.closeBloodlinePreview(); assert.strictEqual(preview(), null);

document.documentElement.clientWidth = 390;
s.innerWidth = 390;
s.innerHeight = 480;
button.getBoundingClientRect = () => ({ left: 270, top: 402, bottom: 438 });
button.keyboardFocus = true;
button.focus();
button.dispatch('focus');
assert(preview(), '键盘聚焦可以查看血脉');
assert.strictEqual(preview().style.maxWidth, '366px');
assert.strictEqual(preview().style.left, '12px', '靠右且空间不足时收在视口内');
assert(parseFloat(preview().style.top) + preview().offsetHeight < 402, '底部无空间时向上展开');
button.dispatch('click');
key('Escape');
assert.strictEqual(preview(), null);
assert.strictEqual(document.activeElement, button, '退出正文后回到血脉按钮');

// 实际战斗实例：首格决定初态，形态刷新不能重建入口或关闭正文。
const modeSlot = new Element(); document.body.appendChild(modeSlot);
const makeQingyu = ids => new api.BattlePet({ ...pet('pet_qy'), skillIds: ids });
const modeButton = () => modeSlot.querySelector('.battle-bloodline-trigger');
const ctx = { msg() {}, playerActive: null, aiActive: null };
for (const [first, expected] of [['sk_qy_1', '清念'], ['sk_qy_4', '残脉']]) {
  const other = first === 'sk_qy_1' ? 'sk_qy_4' : 'sk_qy_1';
  const fighter = makeQingyu([first, other]);
  fighter.bloodline.onEnter(fighter, ctx);
  s.syncBattleBloodline(modeSlot, fighter);
  const chip = modeButton();
  assert.strictEqual(chip.dataset.mode, expected, '双核心上场应显示实际初态');
  assert.strictEqual(chip.getAttribute('aria-label'), '血脉 清念/残脉，当前' + expected);
  assert.strictEqual(chip.querySelectorAll('.qingyu-bloodline-form').map(n => n.dataset.form).join('/'), '清念/残脉');
  chip.click();
  const opened = preview();
  assert(opened);
  fighter.bloodlineData.turnCount = 4;
  fighter.bloodline.onTurnStart(fighter, { ...ctx, doHeal() {} });
  assert.strictEqual(fighter.bloodlineData.switchTurn, true);
  s.syncBattleBloodline(modeSlot, fighter);
  assert.strictEqual(chip.dataset.mode, expected, '切换期开始后仍显示当前形态');
  const next = expected === '清念' ? '残脉' : '清念';
  s.enterQingyuMode(fighter, next);
  s.syncBattleBloodline(modeSlot, fighter);
  assert.strictEqual(modeButton(), chip, '形态变化应保留同一按钮');
  assert.strictEqual(preview(), opened, '形态变化应保留已打开的正文');
  assert.strictEqual(chip.dataset.mode, next);
  assert.strictEqual(chip.getAttribute('aria-label'), '血脉 清念/残脉，当前' + next);
  s.closeBloodlinePreview();
}
const incomplete = makeQingyu(['sk_qy_4']);
incomplete.bloodline.onEnter(incomplete, ctx);
s.syncBattleBloodline(modeSlot, incomplete);
const neutralChip = modeButton();
assert.strictEqual(neutralChip.dataset.mode, '', '缺少核心技能时上场保持中性');
incomplete.bloodline.onTurnStart(incomplete, ctx);
assert.strictEqual(incomplete.bloodlineData.mode, null, '原初血脉没有清念或残脉形态');
s.syncBattleBloodline(modeSlot, incomplete);
assert.strictEqual(neutralChip.dataset.mode, '', '回合开场仍处于原初血脉');
assert.strictEqual(neutralChip.getAttribute('aria-label'), '血脉 清念/残脉');
s.enterQingyuMode(incomplete, '残脉');
s.syncBattleBloodline(modeSlot, incomplete);
assert.strictEqual(modeButton(), neutralChip);
assert.strictEqual(neutralChip.dataset.mode, '残脉', '明确入态后显示形态');

for (const id of ['result-overlay', 'result-emoji', 'result-text']) {
  const node = new Element();
  node.id = id;
  document.body.appendChild(node);
}
button.dispatch('pointerenter');
clock.advance(200);
s.endBattle(true);
clock.advance(80);
assert(document.getElementById('result-overlay').classList.contains('show'));
assert.strictEqual(preview(), null, '胜负弹层出现时取消等待中的悬停预览');
console.log('血脉正文与交互检查通过');
