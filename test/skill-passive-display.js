const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { loadEngine, makeEl } = require('./lib/harness');

const game = path.join(__dirname, '..', 'ROCO REMAKE.html');

test('战斗中空 PP 的技能仍标记携带被动，详情可查看免疫条件', () => {
  const { api, sandbox } = loadEngine(game);
  const pet = new api.BattlePet(api.findPet('pet_bmhs'));
  pet.skills[0].pp = 0;
  api.gameState.playerActive = pet;

  const cards = makeEl();
  const doc = sandbox.document;
  doc.querySelector = () => cards;
  doc.getElementById = () => null;
  doc.createElement = () => {
    const el = makeEl();
    el.addEventListener = (type, listener) => { el[type] = listener; };
    return el;
  };
  sandbox.startTurnTimer = () => {};
  sandbox.renderBattleActions();

  const battleCards = cards.children[0].children;
  const [useButton, , infoButton] = battleCards[0].children;
  assert.equal(useButton.disabled, true);
  assert.match(useButton.innerHTML, /skill-passive-tag">携带被动/);
  assert.equal(battleCards[2].children[0].innerHTML.includes('skill-passive-tag'), false);

  infoButton.click();
  const dialog = doc.body.children[0].innerHTML;
  assert.match(dialog, /无需出招即免疫束缚、恐惧、睡眠、冰冻/);
  assert.match(dialog, /当前PP为0时，额外免疫烧伤、中毒、麻痹、混乱/);
  assert.match(dialog, /PP恢复后保留原有四种免疫/);
});

test('换装技能列表显示可用被动和原文中待实装的被动', () => {
  const { api, sandbox } = loadEngine(game);
  const list = makeEl();
  sandbox.document.querySelector = () => list;
  sandbox.openSkillSwap(api.findPet('pet_bmhs'));
  assert.match(list.innerHTML, /skill-swap-item equipped" data-skill-id="sk_cszn"[^]*?skill-passive-tag">携带被动/);
  assert.match(list.innerHTML, /skill-swap-item" data-skill-id="sk_cyjy"[^]*?skill-passive-tag">原文被动/);

  sandbox.openSkillSwap(api.findPet('pet_qy'));
  assert.equal((list.innerHTML.match(/skill-passive-tag">血脉联动/g) || []).length, 2);
  sandbox.openSkillSwap(api.findPet('pet_jydm'));
  assert.match(list.innerHTML, /skill-passive-tag">被动发动/);
  sandbox.openSkillSwap(api.findPet('pet_qingling'));
  assert.match(list.innerHTML, /skill-passive-tag">PP保护/);
});

test('创世之能的免疫随是否携带和当前 PP 更新，状态提示显示来源', () => {
  const { api, sandbox } = loadEngine(game);
  const definition = api.findPet('pet_bmhs');
  const equipped = new api.BattlePet({ ...definition, skillIds: ['sk_cszn'] });
  const unequipped = new api.BattlePet({ ...definition, skillIds: ['sk_fthy'] });

  assert.equal(sandbox.hasStatusImmunity(unequipped, 'freeze'), false);
  assert.equal(sandbox.hasStatusImmunity(equipped, 'freeze'), true);
  assert.equal(sandbox.hasStatusImmunity(equipped, 'burn'), false);
  assert.match(sandbox.renderStatusBadges(equipped), /title="创世之能 · 冰冻、睡眠、恐惧、束缚"/);

  const creation = equipped.skills[0];
  creation.pp = 0;
  assert.equal(sandbox.hasStatusImmunity(equipped, 'burn'), true);
  assert.match(sandbox.renderStatusBadges(equipped), /title="创世之能（0 PP） · [^"]+">免疫异常/);
  creation.pp = 1;
  assert.equal(sandbox.hasStatusImmunity(equipped, 'burn'), false);
  assert.equal(sandbox.hasStatusImmunity(equipped, 'freeze'), true);
  assert.doesNotMatch(sandbox.renderStatusBadges(equipped), /0 PP/);
});

test('同类免疫的提示保留所有生效来源和最长剩余时间', () => {
  const { api, sandbox } = loadEngine(game);
  const pet = new api.BattlePet(api.findPet('pet_jydm'));
  const ctx = api.createBattleContext();
  ctx.grantStatusImmunity(pet, '极尽降华', 6);
  ctx.grantStatusImmunity(pet, '极影光幕', 5);
  const html = sandbox.renderStatusBadges(pet);
  assert.match(html, /title="极尽降华、极影光幕 · [^"]+">免疫异常 6回合/);
  assert.equal((html.match(/class="status-badge immune"/g) || []).length, 1);
});
