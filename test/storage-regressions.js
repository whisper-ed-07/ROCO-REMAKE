const assert = require('node:assert/strict');
const path = require('node:path');
const { loadEngine, makeEl } = require('./lib/harness');

const htmlPath = process.argv[2] || path.join(__dirname, '..', 'ROCO REMAKE.html');
const PETS = 'pbg_custom_pets';
const SKILLS = 'pbg_custom_skills';
const LOADOUTS = 'pbg_pet_loadouts';

function element() {
  const node = makeEl();
  const events = new Map();
  const children = new Map();
  let html = '';
  Object.defineProperty(node, 'innerHTML', {
    get: () => html,
    set(value) {
      html = value;
      children.clear();
    }
  });
  node.addEventListener = (name, fn) => {
    if (!events.has(name)) events.set(name, []);
    events.get(name).push(fn);
  };
  node.click = () => {
    assert.ok(events.get('click')?.length, '应注册点击事件');
    for (const fn of events.get('click')) fn({ target: node, stopPropagation() {} });
  };
  node.querySelector = selector => {
    if (!children.has(selector)) children.set(selector, element());
    return children.get(selector);
  };
  return node;
}

function openEngine(saved = {}) {
  const { api, sandbox } = loadEngine(htmlPath);
  const root = element();
  const body = element();
  body.insertAdjacentHTML = (where, markup) => { body.innerHTML = markup; };
  const alerts = [];
  Object.assign(sandbox.document, {
    body,
    querySelector: root.querySelector,
    createElement: element
  });
  sandbox.alert = message => alerts.push(message);
  const storage = sandbox.localStorage;
  for (const [key, value] of Object.entries(saved)) storage.setItem(key, value);
  const detail = root.querySelector('#swap-detail');
  detail.querySelectorAll = selector => {
    assert.equal(selector, '.swap-move');
    return Array.from(detail.innerHTML.matchAll(/<button class="swap-move" data-move="(\w+)" data-skill="([^"]+)"( disabled)?>/g), match => {
      const button = detail.querySelector(match[1] + ':' + match[2]);
      button.disabled = Boolean(match[3]);
      button.getAttribute = attr => attr === 'data-move' ? match[1] : match[2];
      return button;
    });
  };
  function fill(fields) {
    for (const [selector, value] of Object.entries(fields)) root.querySelector(selector).value = String(value);
  }
  return { api, sandbox, root, body, detail, fill, storage, alerts };
}

function snapshot(storage) {
  return Object.fromEntries(Array.from({ length: storage.length }, (_, i) => {
    const key = storage.key(i);
    return [key, storage.getItem(key)];
  }));
}

function battleSkills(e, pet) {
  return Array.from(new e.api.BattlePet(pet).skills, s => s.id);
}

function assertHooks(e, pet, original) {
  assert.equal(pet.bloodline, original.bloodline);
  const inBattle = new e.api.BattlePet(pet);
  for (const [key, value] of Object.entries(original.bloodline)) {
    if (typeof value === 'function') assert.equal(inBattle.bloodline[key], value);
  }
}

function equipTest() {
  const e = openEngine();
  const p = e.api.DEFAULT_PETS[0];
  const ids = Array.from(p.skillIds);
  e.sandbox.showPetForm(p);
  assert.match(e.body.innerHTML, /编辑宠物/);
  e.fill({
    '#fp-name': '已改名', '#fp-emoji': '🧪', '#fp-element': p.element, '#fp-level': 88,
    '#fp-hp': 550, '#fp-atk': 432, '#fp-def': 415, '#fp-spatk': 400, '#fp-spdef': 380, '#fp-spd': 343,
    '#fp-skill-0': ids[0], '#fp-skill-1': ids[1], '#fp-skill-2': ids[2], '#fp-skill-3': ids[3]
  });
  e.root.querySelector('#form-save').click();
  const edited = e.api.findPet(p.id);
  const stats = JSON.parse(JSON.stringify(edited.baseStats));
  assert.equal(edited.name, '已改名');
  assert.equal(edited.emoji, '🧪');
  assert.equal(edited.level, 88);
  assert.equal(stats.hp, 175);
  assertHooks(e, edited, p);

  e.sandbox.openSkillSwap(edited);
  function clickSkill(id) { e.detail.querySelector('[data-skill-id="' + id + '"]').click(); }
  assert.equal(Array.from(e.detail.innerHTML.matchAll(/data-skill-id="/g)).length, 5);
  clickSkill(ids[4]);
  assert.deepEqual(e.alerts, []);
  const notice = e.body.children.find(child => child.id === 'skill-limit-overlay');
  assert.ok(notice);
  assert.match(notice.innerHTML, /最多选择 4 个技能出战！/);
  assert.deepEqual(Array.from(e.sandbox.swapDraft.ids), ids.slice(0, 4));
  assert.equal(e.root.querySelector('#app').inert, true);
  e.sandbox.preferences.motion = 'reduce';
  notice.querySelector('#skill-limit-confirm').click();
  assert.equal(e.root.querySelector('#app').inert, false);
  clickSkill(ids[0]);
  clickSkill(ids[4]);
  e.detail.querySelector('left:' + ids[4]).click();
  const movedRow = e.detail.innerHTML.split('data-skill-id="' + ids[4] + '">')[1];
  assert.match(movedRow, /^<span class="skill-slot skill-order" aria-hidden="true">3<\/span>/);
  e.detail.querySelector('#swap-save').click();

  const reload = openEngine(snapshot(e.storage));
  const reloaded = reload.api.findPet(p.id);
  assert.equal(reloaded.name, '已改名');
  assert.equal(reloaded.emoji, '🧪');
  assert.equal(reloaded.level, 88);
  assert.deepEqual({ ...reloaded.baseStats }, stats);
  assert.deepEqual(Array.from(reloaded.ownedSkillIds), ids);
  assert.deepEqual(battleSkills(reload, reloaded), [ids[1], ids[2], ids[4], ids[3]]);
  assertHooks(reload, reloaded, reload.api.DEFAULT_PETS[0]);
}

function legacyTest() {
  const base = openEngine();
  const p = base.api.DEFAULT_PETS[0];
  const ids = Array.from(p.skillIds);
  const legacyOrder = [ids[4], ids[2], ids[1], ids[0]];
  const record = {
    id: p.id, name: '旧名', emoji: '🧭', level: 76,
    stats: { hp: 0, atk: 120 },
    skillIds: legacyOrder, ownedSkillIds: legacyOrder,
    bloodline: { name: '旧档血脉' }
  };
  const another = { id: 'custom_pet_keep', name: '自定义', skillIds: [ids[0]] };
  const legacy = JSON.stringify([record, another]);
  const e = openEngine({ [PETS]: legacy, unrelated: '保持' });
  const migrated = e.api.findPet(p.id);
  assert.equal(migrated.name, '旧名');
  assert.equal(migrated.emoji, '🧭');
  assert.equal(migrated.level, 76);
  assert.equal(migrated.baseStats.hp, 0);
  assert.equal(migrated.baseStats.atk, 120);
  assert.equal(migrated.baseStats.def, p.baseStats.def);
  assert.deepEqual(battleSkills(e, migrated), legacyOrder);
  assert.deepEqual(Array.from(migrated.ownedSkillIds), ids);
  assert.equal(e.api.getAllPets().filter(pet => pet.id === p.id).length, 1);
  assert.equal(e.api.findPet(another.id).name, another.name);
  assertHooks(e, migrated, e.api.DEFAULT_PETS[0]);

  e.sandbox.openSkillSwap(migrated);
  e.detail.querySelector('#swap-save').click();
  assert.equal(e.storage.getItem(PETS), legacy);
  assert.equal(e.storage.getItem('unrelated'), '保持');

  const newerOrder = [ids[1], ids[4], ids[3], ids[2]];
  const loadout = { [p.id]: { name: '新名', level: 90, baseStats: { hp: 99 }, skillIds: newerOrder } };
  const newer = openEngine({ [PETS]: legacy, [LOADOUTS]: JSON.stringify(loadout) });
  const loaded = newer.api.findPet(p.id);
  assert.equal(loaded.name, '新名');
  assert.equal(loaded.emoji, '🧭');
  assert.equal(loaded.level, 90);
  assert.equal(loaded.baseStats.hp, 99);
  assert.equal(loaded.baseStats.atk, 120);
  assert.deepEqual(battleSkills(newer, loaded), newerOrder);
  assert.equal(newer.storage.getItem(PETS), legacy);
  assertHooks(newer, loaded, newer.api.DEFAULT_PETS[0]);

  record.skillIds = ['missing', ids[3], ids[3], ids[4], ids[1], ids[0], ids[2]];
  const invalid = openEngine({ [PETS]: JSON.stringify([record]) });
  assert.deepEqual(battleSkills(invalid, invalid.api.findPet(p.id)), [ids[3], ids[4], ids[1], ids[0]]);
}

function skillTest() {
  const e = openEngine();
  const original = e.api.DEFAULT_SKILLS.find(s => typeof s.onMiss === 'function');
  function saveSkill(skill, name, desc) {
    e.sandbox.showSkillForm(skill);
    assert.match(e.body.innerHTML, /内置技能仅可编辑名称和描述/);
    const fieldset = e.body.innerHTML.match(/<fieldset disabled[^>]*>(.*?)<\/fieldset>/);
    assert.ok(fieldset);
    for (const field of ['element', 'category', 'power', 'pp', 'accuracy', 'effect', 'effectChance']) {
      assert.match(fieldset[1], new RegExp('id="fs-' + field + '"'));
    }
    assert.doesNotMatch(fieldset[1], /id="fs-(name|desc)"/);
    e.fill({
      '#fs-name': name, '#fs-desc': desc, '#fs-element': 'fire', '#fs-category': 'status',
      '#fs-power': 250, '#fs-pp': 40, '#fs-accuracy': 30, '#fs-effect': 'burn', '#fs-effectChance': 100
    });
    e.root.querySelector('#form-save').click();
  }
  saveSkill(original, '改名技能', '旧摘要');
  assert.equal(e.api.findSkill(original.id).name, '改名技能');
  // 同一个技能二次保存触发更新，旧档多余字段无法覆盖内置定义。
  const record = { ...JSON.parse(e.storage.getItem(SKILLS))[0], power: 999, onUse: '无效', onMiss: '无效' };
  e.storage.setItem(SKILLS, JSON.stringify([record]));
  // DOM 会移除上一个弹窗，故在独立加载器中验证重新打开时仅显示最新值。
  const firstReload = openEngine(snapshot(e.storage));
  firstReload.sandbox.showSkillForm(firstReload.api.findSkill(original.id));
  assert.match(firstReload.body.innerHTML, /value="改名技能"/);
  firstReload.fill({ '#fs-name': '改名&A', '#fs-desc': '新的描述' });
  firstReload.root.querySelector('#form-save').click();

  const reload = openEngine(snapshot(firstReload.storage));
  const after = reload.api.findSkill(original.id);
  const def = reload.api.DEFAULT_SKILLS.find(s => s.id === original.id);
  assert.equal(after.name, '改名&A');
  assert.equal(after.desc, '新的描述');
  assert.equal(reload.api.getAllSkills().filter(s => s.id === original.id).length, 1);
  assert.equal(JSON.parse(reload.storage.getItem(SKILLS)).filter(s => s.id === original.id).length, 1);
  for (const key of ['onUse', 'onMiss', 'element', 'power', 'category', 'pp', 'maxPp', 'accuracy', 'effect', 'detail']) {
    assert.equal(after[key], def[key], key);
  }
  reload.sandbox.showSkillDetail(after);
  assert.match(reload.body.children.at(-1).innerHTML, /改名&amp;A/);
  assert.match(reload.body.children.at(-1).innerHTML, /新的描述/);
}

const tests = [
  ['S03 编辑内置宠物、换装及重载保留数据', equipTest],
  ['S04 保留原档并迁移旧装备和字段，新档优先', legacyTest],
  ['S05 技能保存更新名称和描述，保留内置战斗参数和函数', skillTest]
];
let failed = 0;
for (const [name, run] of tests) {
  try {
    run();
    console.log('PASS ' + name);
  } catch (err) {
    failed++;
    console.error('FAIL ' + name + '\n' + err.stack);
  }
}
process.exitCode = failed ? 1 : 0;
