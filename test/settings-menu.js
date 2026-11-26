// Node 22+ 与本机 Chromium。可用 ROCO_CHROMIUM 指定可执行文件。
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { readGame } = require('./lib/game-assets');

const root = path.join(__dirname, '..');
const filename = 'ROCO REMAKE.html';
const browser = [
  process.env.ROCO_CHROMIUM,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome'
].find(candidate => candidate && fs.existsSync(candidate));

async function until(read, description) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await read();
    if (value) return value;
    await delay(50);
  }
  throw new Error('等待超时：' + description);
}

async function connect(endpoint) {
  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const { id, result, error } = JSON.parse(event.data);
    const callback = pending.get(id);
    if (callback) {
      pending.delete(id);
      callback(error, result);
    }
  });
  return {
    close: () => socket.close(),
    send(method, params = {}) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error('Chromium 命令超时：' + method));
        }, 6000);
        pending.set(id, (error, result) => {
          clearTimeout(timeout);
          if (error) reject(new Error(error.message));
          else resolve(result);
        });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
  };
}

// 断言在真实游戏 DOM 上执行，操作使用游戏绑定的原生控件事件。
function pageSetup() {
  const get = selector => {
    const node = document.querySelector(selector);
    if (!node) throw new Error('找不到 ' + selector);
    return node;
  };
  const eq = (actual, expected, message) => {
    if (actual !== expected) throw new Error(message + '：实际 ' + actual + '，预期 ' + expected);
  };
  const click = selector => get(selector).click();
  const root = name => document.documentElement.getAttribute('data-' + name);
  const choice = (name, value) => '[data-setting="' + name + '"][data-value="' + value + '"]';
  const selected = (name, value) => eq(get(choice(name, value)).getAttribute('aria-pressed'), 'true', name + ' 当前选项');
  const font = (selector, value) => {
    const control = get(selector);
    control.value = value;
    control.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const layout = () => {
    const viewport = document.documentElement.clientWidth;
    eq(document.documentElement.scrollWidth, viewport, '页面横向尺寸');
    for (const node of document.querySelectorAll('.settings-scroll, #app button, #app select')) {
      const box = node.getBoundingClientRect();
      eq(box.left >= -1 && box.right <= viewport + 1, true, '控件位于视口内 ' + (node.id || node.className));
    }
  };
  const enterBattle = () => {
    const solo = get('#mode-solo').getAttribute('aria-pressed') === 'true';
    click('#btn-battle');
    eq(document.querySelector('#opponent-ai-select'), null, '我方选宠不显示对手 AI');
    click('[data-pet-id]');
    click('#btn-ready');
    const picker = document.querySelector('#opponent-ai-select');
    if (solo) {
      eq(picker?.tagName, 'SELECT', '单机显示对手 AI 下拉框');
      eq(picker.labels[0]?.textContent, '对手 AI', '选择框标注对手 AI');
      eq(picker.value, 'little-roco-v0-preview', '默认选中 Little Roco');
      eq(picker.selectedOptions[0]?.textContent, 'Little Roco V0-Preview', '对手 AI 名称');
      picker.dispatchEvent(new Event('change', { bubbles: true }));
      layout();
    } else {
      eq(picker, null, '开发者模式不显示对手 AI 选项');
    }
    click('[data-opp-id]');
    click('#opp-ready');
    eq(gameState.opponentAIId, picker?.value ?? null, '本局使用选中的对手 AI');
  };
  const logMetrics = () => {
    const log = get('#battle-messages');
    return [log.getBoundingClientRect().height, parseFloat(getComputedStyle(log).fontSize)];
  };
  Object.assign(window, { get, eq, click, root, choice, selected, font, layout, enterBattle, logMetrics });
}

async function test(browserConnection, origin) {
  const { send } = browserConnection;
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true });
    const error = response.exceptionDetails;
    if (error) throw new Error(error.exception?.description || error.text);
    return response.result.value;
  };
  const inspect = callback => evaluate('(' + callback.toString() + ')()');
  const media = (color, motion = 'no-preference') => send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: color },
      { name: 'prefers-reduced-motion', value: motion }
    ]
  });
  const size = width => send('Emulation.setDeviceMetricsOverride', {
    width, height: 800, deviceScaleFactor: 1, mobile: false
  });
  const open = async (suffix, selector) => {
    const url = origin + suffix;
    await send('Page.navigate', { url });
    await until(() => evaluate('location.href === ' + JSON.stringify(url) +
      ' && !!document.querySelector(' + JSON.stringify(selector) + ')'), suffix + ' ' + selector);
    await inspect(pageSetup);
  };

  await size(1280);
  await media('light');
  await open('/seed', 'body');
  await inspect(() => {
    localStorage.setItem('roco_theme', 'light');
    localStorage.setItem('roco_font_cn', 'maShan');
    localStorage.setItem('roco_font_en', 'orbitron');
    localStorage.setItem('pbg_pet_loadouts', '{}');
    localStorage.setItem('pbg_custom_pets', '[ ]');
    localStorage.setItem('pbg_custom_skills', '[  ]');
    localStorage.setItem('test-unrelated', 'preserved');
  });
  await open('/game?legacy', '#intro-screen');
  await inspect(() => {
    eq(root('theme'), 'light', '旧主题在启动时生效');
    click('#intro-screen');
    eq(get('.menu-title-cn').style.fontFamily.includes('Ma Shan Zheng') ||
      getComputedStyle(get('.menu-title-cn')).fontFamily.includes('Ma Shan Zheng'), true, '旧中文字体应用到标题');
    click('#mode-online');
    eq(get('#btn-battle').disabled, true, '联机不可进入对战');
    eq(/未开放/.test(get('#app').textContent), true, '联机占位说明');
    click('#btn-battle');
    get('#mode-solo');
    click('#mode-solo');
    eq(get('#btn-battle').disabled, false, '切回单机可进入对战');
    click('#btn-battle');
    const pet = get('[data-pet-id]');
    const selector = '[data-pet-id="' + pet.getAttribute('data-pet-id') + '"]';
    pet.click();
    click('#settings-btn');
    layout();
    selected('theme', 'light');
    eq(get('#font-cn').value, 'maShan', '旧中文字体');
    eq(get('#font-en').value, 'orbitron', '旧英文字体');
    click('#settings-back');
    eq(get(selector).getAttribute('aria-pressed'), 'true', '返回时保留我方宠物选择');
    click('#btn-ready');
    const opponent = get('[data-opp-id]');
    const opponentSelector = '[data-opp-id="' + opponent.getAttribute('data-opp-id') + '"]';
    opponent.click();
    click('#settings-btn');
    click('#settings-back');
    eq(get(opponentSelector).getAttribute('aria-pressed'), 'true', '返回时保留对手宠物选择');
    click('#opp-back');
    click('#team-back');
    click('#btn-pets');
    click('#tab-skills');
    click('#settings-btn');
    click('#settings-back');
    eq(get('#tab-skills').classList.contains('active'), true, '返回时保留技能管理标签');
    click('#mgmt-back');
    click('#settings-btn');
    click(choice('theme', 'dark'));
    eq(root('theme'), 'dark', '手动主题立即生效');
    click(choice('theme', 'system'));
    eq(root('theme'), 'light', '跟随当前系统主题');

    const duration = () => parseFloat(getComputedStyle(get('.settings-screen')).animationDuration);
    const normal = duration();
    eq(normal > 0.1, true, '未减少动态时保留正常入场动画');
    eq(prefersReducedMotion(), false, '系统正常动态效果');
    click(choice('motion', 'reduce'));
    eq(prefersReducedMotion(), true, '手动减少动态效果');
    eq(duration() < normal / 100, true, '手动减少立即缩短实际 CSS 动画');
    click(choice('motion', 'system'));
    eq(prefersReducedMotion(), false, '跟随系统恢复正常动态效果');
    eq(duration(), normal, '跟随系统恢复实际 CSS 动画时长');
  });

  await media('dark', 'reduce');
  await until(() => inspect(() => root('theme') === 'dark'), '系统主题变化');
  await size(360);
  await inspect(() => {
    eq(matchMedia('(prefers-reduced-motion: reduce)').matches, true, '系统减少动态效果');
    eq(prefersReducedMotion(), true, '系统减少动态偏好生效');
    layout();
    click(choice('motion', 'reduce'));
    click(choice('logSize', 'expanded'));
    click(choice('logText', 'large'));
    click(choice('floatNumbers', 'off'));
    font('#font-cn', 'notoSans');
    selected('theme', 'system');
    font('#font-en', 'teko');
    selected('theme', 'system');
    eq(get(choice('theme', 'dark')).getAttribute('aria-pressed'), 'false', '系统暗色不高亮手动暗色');
    eq(root('motion'), 'reduce', '减少动态设定立即生效');
    eq(root('log-size'), 'expanded', '日志高度设定立即生效');
    eq(root('log-text'), 'large', '日志字号设定立即生效');
    const expected = {
      roco_theme: 'system', roco_motion: 'reduce', roco_log_size: 'expanded',
      roco_log_text: 'large', roco_float_numbers: 'off', roco_font_cn: 'notoSans', roco_font_en: 'teko'
    };
    for (const [key, value] of Object.entries(expected)) eq(localStorage.getItem(key), value, key);
    click('#settings-back');
    click('#mode-online');
    layout();
  });

  // 同一来源重新加载，确认应用读取持久化偏好，且模式重新从单机开始。
  await media('light');
  await open('/game?reload', '#intro-screen');
  await inspect(() => {
    eq(root('theme'), 'light', '重载使用当前系统主题');
    click('#intro-screen');
    eq(get('#btn-battle').disabled, false, '重载默认单机');
    layout();
    click('#settings-btn');
    for (const [key, value] of Object.entries({
      theme: 'system', motion: 'reduce', logSize: 'expanded', logText: 'large', floatNumbers: 'off'
    })) selected(key, value);
    eq(get('#font-cn').value, 'notoSans', '重载保留中文字体');
    eq(get('#font-en').value, 'teko', '重载保留英文字体');
    click('#settings-reset');
    for (const [key, value] of Object.entries({
      theme: 'dark', motion: 'system', logSize: 'standard', logText: 'standard', floatNumbers: 'on'
    })) selected(key, value);
    eq(get('#font-cn').value, 'default', '重置恢复默认中文字体');
    eq(get('#font-en').value, 'cinzel', '重置恢复默认英文字体');
    eq(localStorage.getItem('pbg_pet_loadouts'), '{}', '重置保留宠物配置');
    eq(localStorage.getItem('pbg_custom_pets'), '[ ]', '重置保留旧自定义宠物存档');
    eq(localStorage.getItem('pbg_custom_skills'), '[  ]', '重置保留旧自定义技能存档');
    eq(localStorage.getItem('test-unrelated'), 'preserved', '重置保留其他本地数据');
    for (const key of [
      'roco_theme', 'roco_motion', 'roco_log_size', 'roco_log_text',
      'roco_float_numbers', 'roco_font_cn', 'roco_font_en'
    ]) localStorage.setItem(key, 'invalid-test-value');
  });

  await open('/game?invalid', '#intro-screen');
  await inspect(() => click('#intro-screen'));
  await until(() => inspect(() => !document.querySelector('#intro-screen')), '启动页淡出');
  await inspect(() => {
    click('#settings-btn');
    for (const [key, value] of Object.entries({
      theme: 'dark', motion: 'system', logSize: 'standard', logText: 'standard', floatNumbers: 'on'
    })) selected(key, value);
    eq(get('#font-cn').value, 'default', '非法中文字体回退');
    eq(get('#font-en').value, 'cinzel', '非法英文字体回退');
    eq(root('theme'), 'dark', '非法主题回退');
  });

  await size(1280);
  const standard = await inspect(() => {
    click('#settings-back');
    enterBattle();
    spawnFloatText(gameState.playerActive, 42, 'dmg');
    eq(get('#player-sprite .float-text').textContent, '-42', '默认显示伤害飘字');
    return logMetrics();
  });
  const adjusted = await inspect(() => {
    showFleeConfirm();
    click('#flee-confirm');
    click('#settings-btn');
    click(choice('logSize', 'expanded'));
    click(choice('logText', 'large'));
    click(choice('floatNumbers', 'off'));
    click('#settings-back');
    enterBattle();
    spawnFloatText(gameState.playerActive, 42, 'dmg');
    eq(document.querySelector('.float-text'), null, '关闭后不生成飘字');
    return logMetrics();
  });
  assert.ok(adjusted[0] > standard[0], '扩大日志使实际区域变高');
  assert.ok(adjusted[1] > standard[1], '大号日志使实际文字变大');

  await size(320);
  await media('light', 'reduce');
  await open('/game?developer-log', '#intro-screen');
  await inspect(() => {
    click('#intro-screen');
    click('#mode-developer');
    layout();
    eq(get('#mode-developer').getAttribute('aria-pressed'), 'true', '已选开发者测试模式');
    eq(get('#mode-solo').getAttribute('aria-pressed'), 'false', '单机模式取消选中');
    eq(get('#btn-battle .menu-action-title').textContent, '开始测试', '测试入口');
    enterBattle();
    const viewport = document.documentElement.clientWidth;
    const logBounds = get('#battle-messages').getBoundingClientRect();
    eq(logBounds.left >= 0 && logBounds.right <= viewport, true, '窄屏日志位于视口内');
    stopTurnTimer();
    eq(gameState.battleMode, 'developer', '测试模式进入实际对战');
    eq(gameState.messages[0].text, '━━━ 战斗开始 ━━━', '保留开局');
    click('.skill-btn');
    stopTurnTimer();
    eq(gameState.turnCount, 1, '正常选招并结算对手');
    eq(gameState.messages.some(({ text }) => /^【PP】我方场上.*选招扣费/.test(text)), true, '实战逐格 PP 日志已记入');
    gameState.logFilter = 'system';
    gameState.logCollapsed[1] = true;
    for (let i = 0; i < 1205; i++) addMessage('回归记录 ' + i, i % 2 ? 'action' : 'system');
    addMessage('未分类的日志同样显示', 'collapsed');
    const repeated = '命中要害 <b>原文</b>  双空格\n换行';
    addMessage(repeated, 'damage', 'player');
    addMessage(repeated, 'damage', 'player');
    window.checkDeveloperLog = () => {
      const text = Array.from(document.querySelectorAll('#battle-messages .msg-text'), node => node.textContent);
      eq(JSON.stringify(text), JSON.stringify(gameState.messages.map(message => message.text)), '完整日志与记录逐条一致');
      eq(get('#developer-log-count').textContent, '完整日志 · ' + text.length + ' 条', '显示总条数');
      eq(document.querySelector('.log-tab, .turn-caret, .msg.collapsed'), null, '测试日志全展开');
    };
  });
  await until(() => inspect(() => document.querySelectorAll('#battle-messages .msg').length === gameState.messages.length), '新增记录自动刷新');
  await inspect(() => {
    checkDeveloperLog();
    const log = get('#battle-messages');
    eq(log.tabIndex, 0, '完整日志可以键盘聚焦');
    const first = get('#battle-messages .msg');
    get('#battle-messages .msg.turn').click();
    log.scrollTop = 0;
    log.dispatchEvent(new Event('scroll'));
    eq(get('#log-jump').hidden, false, '查看开头时显示回到最新');
    addMessage('增量追加', 'system');
    renderBattleLog();
    eq(get('#battle-messages .msg'), first, '只追加新日志');
    eq(log.scrollTop, 0, '追加日志时保留阅读位置');
    renderBattle(get('#app'));
    stopTurnTimer();
    eq(get('#battle-messages'), log, '重绘战斗界面仍保留日志节点');
    eq(log.scrollTop, 0, '重绘后保留阅读位置');
    click('#log-jump');
    eq(log.scrollHeight - log.scrollTop - log.clientHeight < 2, true, '可回到最新一条');
    let copied;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText(text) { copied = text; return Promise.resolve(); }
    }});
    click('#log-copy');
    eq(copied, gameState.messages.map(message => message.text).join('\n'), '复制全部原始消息');
    delete navigator.clipboard;
    gameState.aiActive.hp = 0;
    checkFaints();
    eq(get('#result-overlay').classList.contains('show'), true, '胜负弹窗打开');
    click('#result-close');
    checkDeveloperLog();
    eq(get('#battle-messages .msg:last-child .msg-text').textContent, '战斗结束，我方胜利。', '结算记录可回看');
    click('#flee-btn');
    enterBattle();
    checkDeveloperLog();
    eq(get('#battle-messages').textContent.includes('回归记录'), false, '新局清除上一局记录');
    click('#flee-btn');
    click('#flee-confirm');
    click('#result-close');
    checkDeveloperLog();
    eq(get('#battle-messages .msg:last-child .msg-text').textContent, '我方逃跑，测试结束。', '逃跑后可以查看最后一条');
    click('#flee-btn');
    click('#mode-solo');
    enterBattle();
    stopTurnTimer();
    eq(gameState.battleMode, 'solo', '可返回单机对战');
    eq(document.querySelectorAll('.log-tab').length, 3, '单机保留筛选');
    click('[data-filter="all"]');
    for (let i = 0; i < 230; i++) addMessage('单机记录 ' + i);
    renderBattleLog();
    eq(document.querySelectorAll('#battle-messages .msg').length, 200, '单机仍只显示最近两百条');

    const baseline = { element: 'normal', pp: 5, maxPp: 5, priority: 8, accuracy: 100 };
    const attacker = { ...baseline, id: 'browser-ai-attack', name: '测试攻击', power: 120, category: 'physical' };
    const heal = { ...baseline, id: 'browser-ai-heal', name: '光合作用', power: 0, category: 'status' };
    gameState.aiActive.skills = [attacker, heal];
    gameState.aiActive.hp = 70;
    gameState.playerActive.skills = [
      { ...baseline, id: 'browser-ai-player', name: '测试出招', pp: 9, maxPp: 9, power: 0, category: 'status', onUse() {} },
    ];
    renderBattleActions();
    click('.skill-btn');
    stopTurnTimer();
    eq(attacker.pp, 5, '单机对手低精力时保留攻击 PP');
    eq(heal.pp, 4, '单机真实回合选中治疗招式');
    eq(gameState.aiActive.hp > 70, true, '单机对手实际回复精力');

    // 逐招走已生成的技能按钮，验证浏览器解码与换行显示。
    const player = gameState.playerActive;
    for (const pet of DEFAULT_PETS) {
      for (const id of pet.skillIds) {
        gameState.playerActive = new BattlePet({ ...pet, skillIds: [id] });
        renderBattleActions();
        click('.skill-info');
        eq(get('.skill-detail-original').textContent, ORIGINAL_SKILL_TEXT[id], id + ' 的原文');
        click('#skill-detail-close');
      }
    }
    gameState.playerActive = player;
    renderBattleActions();
    stopTurnTimer();
  });

  await inspect(() => localStorage.setItem('roco_theme', 'light'));
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: '(' + function () {
      function denyStorage() {
        throw new DOMException('Test storage denial', 'SecurityError');
      }
      Storage.prototype.getItem = denyStorage;
      Storage.prototype.setItem = denyStorage;
    }.toString() + ')();'
  });
  await open('/game?storage-denied', '#intro-screen');
  await inspect(() => {
    eq(root('theme'), 'dark', '存储拒绝读取时启动使用默认偏好');
    click('#intro-screen');
  });
  await until(() => inspect(() => !document.querySelector('#intro-screen')), '存储受限时启动页淡出');
  await inspect(() => {
    click('#settings-btn');
    click(choice('theme', 'light'));
    selected('theme', 'light');
    eq(root('theme'), 'light', '存储拒绝写入时仍能切换主题');
    eq(/仅在本次打开期间生效/.test(get('.settings-feedback').textContent), true, '明确告知偏好仅本次有效');
    click('#settings-back');
    eq(get('#btn-battle').disabled, false, '存储受限时仍可进入单机');
  });
}

// 使用同一文件 URL 和隔离浏览器配置，模拟旧版本存档后替换游戏文件。
async function testFileReplacement(connection, gameFile, game) {
  const { send } = connection;
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const inspect = callback => evaluate('(' + callback.toString() + ')()');
  const url = pathToFileURL(gameFile).href;
  const open = async () => {
    await send('Page.navigate', { url });
    await until(() => evaluate('location.href === ' + JSON.stringify(url) + ' && !!document.querySelector("#intro-screen")'), 'file 游戏启动');
    await inspect(pageSetup);
  };
  await open();
  await inspect(() => {
    // 通过旧版公开的存储接口写入完整、非空的数据。
    const skill = { id: 'custom_skill_file_test', name: '存档招式', element: DEFAULT_SKILLS[0].element,
      power: 50, pp: 10, maxPp: 10, accuracy: 100, category: 'physical', priority: 8, desc: '存档测试' };
    const pet = { id: 'custom_pet_file_test', name: '存档宠物', emoji: '🐾', element: DEFAULT_PETS[0].element,
      level: 100, baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, spd: 100 },
      skillIds: [skill.id], ownedSkillIds: [skill.id] };
    saveCustomSkills([skill]);
    saveCustomPets([pet]);
    const builtin = DEFAULT_PETS[0];
    savePetLoadouts({ [builtin.id]: { name: '存档配置', skillIds: builtin.skillIds.slice(0, 2).reverse() } });
    localStorage.setItem('roco_theme', 'light');
    localStorage.setItem('roco_log_size', 'expanded');
    eq(findPet(pet.id).name, pet.name, '旧版自定义宠物已保存');
  });
  // 离开后在同一路径覆盖文件，避免更换 URL 或 Chromium profile。
  await send('Page.navigate', { url: 'about:blank' });
  await until(() => evaluate('location.href === "about:blank"'), '离开旧文件');
  for (const [relativePath, { content }] of game.assets) {
    const destination = path.join(path.dirname(gameFile), relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content);
  }
  fs.writeFileSync(gameFile, game.html);
  await open();
  const title = game.html.match(/<title>([^<]+)<\/title>/)[1];
  assert.equal(await evaluate('document.title'), title, '同一路径已加载当前构建');
  await inspect(() => {
    eq(getComputedStyle(get('#intro-screen')).position, 'fixed', '文件替换后加载样式');
    eq(root('theme'), 'light', '文件替换后读取主题');
    eq(root('log-size'), 'expanded', '文件替换后读取日志设置');
    eq(findSkill('custom_skill_file_test').name, '存档招式', '自定义技能');
    eq(findPet('custom_pet_file_test').skillIds[0], 'custom_skill_file_test', '自定义宠物与技能');
    const builtin = DEFAULT_PETS[0], loaded = findPet(builtin.id);
    eq(loaded.name, '存档配置', '内置宠物配置');
    eq(JSON.stringify(loaded.skillIds), JSON.stringify(builtin.skillIds.slice(0, 2).reverse()), '技能顺序');
    click('#intro-screen');
    click('#mode-developer');
    click('#btn-battle');
    click('[data-pet-id="custom_pet_file_test"]');
    click('#btn-ready');
    click('[data-opp-id]');
    click('#opp-ready');
    stopTurnTimer();
    eq(gameState.playerActive.name, '存档宠物', '存档宠物实际出战');
    eq(gameState.playerActive.skills[0].name, '存档招式', '存档技能实际出战');
    click('.skill-btn');
    stopTurnTimer();
    eq(gameState.turnCount, 1, '开发者对战完成一回合');
    eq(gameState.messages.some(({ text }) => /^【PP】我方场上.*选招扣费/.test(text)), true, '开发者 PP 日志');
  });
}

async function main() {
  assert.ok(browser, '找不到 Chromium，请设置 ROCO_CHROMIUM');
  const fileMode = process.argv.includes('--file-replacement');
  const standalone = process.argv.includes('--standalone');
  const game = readGame(standalone ? path.join(root, 'dist', filename) : path.join(root, filename));
  if (standalone) assert.equal(game.assets.size, 0, '单文件版无需额外的样式或脚本文件');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'roco-settings-'));
  const gameFile = path.join(directory, filename);
  const server = http.createServer((request, response) => {
    const route = request.url.split('?')[0];
    const asset = game.assets.get(route.slice(1));
    const content = asset?.content ?? (route === '/game' ? game.html : '<!doctype html><title>ROCO 测试</title><body></body>');
    response.setHeader('Content-Type', (asset?.contentType ?? 'text/html') + '; charset=utf-8');
    // 保持测试只访问本机。字体仍可验证实际 CSS 字体链。
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
    response.end(content);
  });
  let processHandle;
  let connection;
  try {
    if (fileMode) fs.writeFileSync(gameFile, execFileSync('git', ['show', '0.0.1-preview:ROCO REMAKE.html'], { cwd: root }));
    await new Promise((resolve, reject) => {
      server.on('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    processHandle = spawn(browser, [
      '--headless', '--disable-gpu', '--disable-background-networking', '--no-first-run',
      '--remote-debugging-port=0', '--user-data-dir=' + directory, 'about:blank'
    ], { stdio: 'ignore', windowsHide: true });
    let launchError;
    processHandle.on('error', error => { launchError = error; });
    const portFile = path.join(directory, 'DevToolsActivePort');
    const port = await until(() => {
      if (launchError) throw launchError;
      if (processHandle.exitCode !== null) throw new Error('Chromium 提前退出：' + processHandle.exitCode);
      return fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0];
    }, 'Chromium 调试端口');
    const pages = await fetch('http://127.0.0.1:' + port + '/json/list').then(response => response.json());
    connection = await connect(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
    if (fileMode) {
      await testFileReplacement(connection, gameFile, game);
      console.log('file replacement and persisted battle passed');
    } else {
      await test(connection, 'http://127.0.0.1:' + server.address().port);
      console.log('settings and menu interactions passed');
    }
  } finally {
    connection?.close();
    if (processHandle?.pid && processHandle.exitCode === null) {
      const exited = new Promise(resolve => processHandle.once('exit', resolve));
      processHandle.kill();
      await exited;
    }
    server.closeAllConnections();
    server.close();
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

main().catch(error => {
  console.error(error.stack);
  process.exitCode = 1;
});
