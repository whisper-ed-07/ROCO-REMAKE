const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { loadEngine, makeEl } = require('./lib/harness');

const game = path.join(__dirname, '..', 'ROCO REMAKE.html');

test('战斗中空 PP 的技能仍标记携带被动，详情可查看免疫条件', () => {
  const { api, sandbox } = loadEngine(game);
  const pet = new api.BattlePet(api.findPet('pet_bmhs'));
  pet.skills[0].pp = 0;
  api.gameState.playerActive = pet;
  api.gameState.screen = 'battle';

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
  const overlay = doc.body.children.find(child => child.id === 'skill-detail-overlay');
  assert.ok(overlay, '点击技能信息打开详情');
  const dialog = overlay.innerHTML;
  assert.match(dialog, /①被动免疫束缚，恐惧，睡眠，冰冻/);
  assert.match(dialog, /④本技能免疫删除与回复，当PP为0时自身免疫异常状态/);
});

test('换装技能列表显示已实装的携带被动', () => {
  const { api, sandbox } = loadEngine(game);
  const list = makeEl();
  sandbox.document.querySelector = () => list;
  sandbox.openSkillSwap(api.findPet('pet_bmhs'));
  assert.match(list.innerHTML, /skill-swap-item equipped" data-skill-id="sk_cszn"[^]*?skill-passive-tag">携带被动/);
  assert.match(list.innerHTML, /skill-swap-item" data-skill-id="sk_cyjy"[^]*?skill-passive-tag">携带被动/);

  sandbox.openSkillSwap(api.findPet('pet_qy'));
  assert.equal((list.innerHTML.match(/skill-passive-tag">血脉联动/g) || []).length, 2);
  sandbox.openSkillSwap(api.findPet('pet_jydm'));
  assert.match(list.innerHTML, /skill-passive-tag">被动发动/);
  sandbox.openSkillSwap(api.findPet('pet_qingling'));
  assert.match(list.innerHTML, /skill-passive-tag">PP保护/);
});

test('清羽两招的血脉联动整段加粗，原初血脉单独起行', () => {
  const { api, sandbox } = loadEngine(game);
  for (const [id, priority, mode] of [['sk_qy_1', 15, '清念'], ['sk_qy_4', 12, '残脉']]) {
    const skill = api.findSkill(id);
    assert.equal(skill.priority, priority);
    sandbox.showSkillDetail({ ...skill, desc: '<自定义说明>' });
    const dialog = sandbox.document.body.children.at(-1).innerHTML;
    assert.match(dialog, /&lt;自定义说明&gt;/);
    const emphasis = dialog.match(/<strong class="skill-bloodline-detail">([^]*?)<\/strong>\n\n①/);
    assert.ok(emphasis, skill.name + '的技能效果正文位于加粗段落之后');
    assert.ok(emphasis[1].includes('首格为' + skill.name));
    assert.ok(emphasis[1].includes('上场进入' + mode + '状态'));
    assert.match(emphasis[1], /\n进入原初血脉状态：缺少清翎覆尘或残风临霜，或首格并非这两招之一时，自上场起永久免疫烧伤、冰冻、麻痹、中毒、睡眠、沉睡、混乱、恐惧、寄生，所受威力伤害和固定伤害降低 20%。进入清念或残脉时，原初血脉的免疫和减伤一并解除。/);
  }
});

test('微灵封体的局外详情注明 PP 保护、回复范围和全队封锁', () => {
  const { api, sandbox } = loadEngine(game);
  sandbox.showSkillDetail(api.findSkill('sk_ql_1'));
  const dialog = sandbox.document.body.children.at(-1).innerHTML;
  assert.match(dialog, /幽灵系 · 变化 · 1PP · 先手\+7 · 必中/);
  assert.match(dialog, /skill-passive-tag">PP保护/);
  assert.match(dialog, /本技能免疫常规 PP 删除/);
  assert.match(dialog, /自身携带的每个技能回复[^]*?这次回复也适用于万念俱灰/);
  assert.match(dialog, /解除当前在场双方已有的限伤、减伤、护盾和反弹/);
  assert.match(dialog, /双方队伍的所有宠物都无法再获得这四类效果/);
  assert.match(dialog, /从发动起至下回合结束，免疫威力伤害/);
  assert.match(dialog, /按施放者当时的已损精力计算[^]*?每次最多 15 点/);
});

test('创世之能的免疫随是否携带和当前 PP 更新，状态提示显示来源', () => {
  const { api, sandbox } = loadEngine(game);
  const definition = api.findPet('pet_bmhs');
  const equipped = new api.BattlePet({ ...definition, skillIds: ['sk_cszn'] });
  const unequipped = new api.BattlePet({ ...definition, skillIds: ['sk_fthy'] });

  assert.equal(sandbox.hasStatusImmunity(unequipped, 'freeze'), false);
  assert.equal(sandbox.hasStatusImmunity(equipped, 'freeze'), true);
  assert.equal(sandbox.hasStatusImmunity(equipped, 'burn'), false);
  assert.match(sandbox.renderStatusBadges(equipped), /创世之能（持续生效） · 冰冻、睡眠、恐惧、束缚/);

  const creation = equipped.skills[0];
  creation.pp = 0;
  assert.equal(sandbox.hasStatusImmunity(equipped, 'burn'), true);
  assert.match(sandbox.renderStatusBadges(equipped), /免疫全部异常<\/summary>.*创世之能（0 PP）（条件生效） · [^<]*寄生/);
  creation.pp = 1;
  assert.equal(sandbox.hasStatusImmunity(equipped, 'burn'), false);
  assert.equal(sandbox.hasStatusImmunity(equipped, 'freeze'), true);
  assert.doesNotMatch(sandbox.renderStatusBadges(equipped), /0 PP/);
});

test('同范围免疫合并剩余时间，展开后保留各来源的回合', () => {
  const { api, sandbox } = loadEngine(game);
  const pet = new api.BattlePet(api.findPet('pet_jydm'));
  const ctx = api.createBattleContext();
  ctx.grantStatusImmunity(pet, '极尽降华', 6);
  ctx.grantStatusImmunity(pet, '极影光幕', 5);
  const html = sandbox.renderStatusBadges(pet);
  assert.match(html, /免疫全部异常 6回合<\/summary>/);
  assert.match(html, /极尽降华（6回合）/);
  assert.match(html, /极影光幕（5回合）/);
  assert.equal((html.match(/class="status-badge immune"/g) || []).length, 1);
});

test('局外技能详情显示明确的作用对象、触发条件和基础威力', () => {
  const { api, sandbox } = loadEngine(game);
  const cases = [
    ['sk_jydm_5', /对方同一格技能的 PP[^]*?本招从发动起 12 个战斗回合无法回复 PP/],
    ['sk_qy_3', /处于残脉且对方有生效的限伤时[^]*?追加固伤分四段/],
    ['sk_qy_5', /锁定清羽和当时在场的对手，对手换下后仍取其 PP[^]*?各自的净变化取绝对值后相加[^]*?下一回合双方行动后回复本招/],
    ['sk_ql_3', /幽灵系 · 魔法[^]*?基础威力 70[^]*?未携带万念俱灰时，其参与计算的威力取 150/],
    ['sk_cszn', /末回合自身精力低于最大精力的 30% 时，回复 70% 已损精力，并清空本招 PP/],
  ];
  for (const [id, expected] of cases) {
    sandbox.showSkillDetail(api.findSkill(id));
    assert.match(sandbox.document.body.children.at(-1).innerHTML, expected, id);
  }
  assert.match(sandbox.skillMetaText({ ...api.findSkill('sk_nlex'), element: null }), /^无属系 · 物理/);
});

test('四只宠物的二十项局内技能正文逐字对应 TXT', () => {
  const { api, sandbox } = loadEngine(game);
  api.gameState.screen = 'battle';
  let checked = 0;
  for (const pet of api.DEFAULT_PETS) {
    const txt = fs.readFileSync(path.join(__dirname, '..', 'pets', pet.name + '.txt'), 'utf8')
      .replace(/\r\n/g, '\n')
      .split(/\n(?:思路：|清灵是“清念”)/, 1)[0];
    const headings = [...txt.matchAll(/^(?:\[图片\])?(\S+) [^\n]*系(?:变化|物理|魔法) \d+PP[^\n]*$/gm)];
    assert.equal(headings.length, pet.skillIds.length, pet.name);
    for (const [index, id] of pet.skillIds.entries()) {
      const skill = api.findSkill(id);
      const heading = headings[index];
      assert.equal(heading[1], skill.name);
      const end = headings[index + 1]?.index ?? txt.length;
      const body = txt.slice(heading.index + heading[0].length, end)
        .replace(/^\[\d{4}-\d{2}-\d{2} 玩家修订。.*原句：.*\]$/gm, '')
        .trim();
      sandbox.showSkillDetail({ ...skill, desc: '覆盖描述' });
      const dialog = sandbox.document.body.children.at(-1).innerHTML;
      assert.doesNotMatch(dialog, /覆盖描述/);
      const original = dialog.match(/<span class="skill-detail-original">([^]*?)<\/span>/);
      assert.equal(original?.[1], sandbox.escapeHtml(body), skill.name);
      if (skill.bloodlineDetail) {
        assert.match(dialog, /<strong class="skill-bloodline-detail">[^]*?进入原初血脉状态：[^]*?<\/strong>/);
      }
      checked++;
    }
  }
  assert.equal(checked, 20);
});
