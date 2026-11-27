// Node 22+ 与本机 Chromium。可用 ROCO_CHROMIUM 指定可执行文件。
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { pathToFileURL } = require('node:url');

const browser = [
  process.env.ROCO_CHROMIUM,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome'
].find(candidate => candidate && fs.existsSync(candidate));

async function until(read, description) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await read();
    if (result) return result;
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
  function send(method, params = {}) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      function receive(event) {
        const response = JSON.parse(event.data);
        if (response.id !== id) return;
        clearTimeout(timer);
        socket.removeEventListener('message', receive);
        if (response.error) reject(new Error(response.error.message));
        else resolve(response.result);
      }
      const timer = setTimeout(() => {
        socket.removeEventListener('message', receive);
        reject(new Error('Chromium 命令超时：' + method));
      }, 6000);
      socket.addEventListener('message', receive);
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  return {
    send,
    requestBrowserClose() {
      if (socket.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify({ id: ++sequence, method: 'Browser.close' }));
      return true;
    },
    close: () => socket.close()
  };
}

async function stopBrowser(child, connection) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', () => resolve(true)));
  if (connection?.requestBrowserClose() && await Promise.race([exited, delay(5000, false, { ref: false })])) return;
  if (connection) console.warn('Chromium 未正常退出，尝试结束测试浏览器');
  child.kill();
  if (!await Promise.race([exited, delay(5000, false, { ref: false })])) {
    throw new Error('无法结束测试 Chromium，进程 ID ' + child.pid);
  }
}

async function testWiki({ send }) {
  const root = path.join(__dirname, '..');
  const directory = process.argv.includes('--standalone') ? path.join(root, 'dist') : root;
  const url = pathToFileURL(path.join(directory, 'ROCO REMAKE.html')).href;
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true });
    const error = response.exceptionDetails;
    if (error) throw new Error(error.exception?.description || error.text);
    return response.result.value;
  };
  const inspect = (callback, value) => evaluate(`(${callback})(${JSON.stringify(value)})`);
  const size = (width, height, mobile = false) => send('Emulation.setDeviceMetricsOverride', {
    width, height, mobile, deviceScaleFactor: 1
  });
  const selectorFor = id => `[data-wiki-article="${id}"]`;

  async function click(selector) {
    const position = await until(() => inspect(selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      const box = node.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      return node.contains(document.elementFromPoint(x, y)) ? { x, y } : null;
    }, selector), '控件可点击 ' + selector);
    await send('Input.dispatchMouseEvent', { ...position, type: 'mousePressed', button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { ...position, type: 'mouseReleased', button: 'left', clickCount: 1 });
  }

  function waitForArticle(id) {
    return until(() => inspect(selector => {
      const button = document.querySelector(selector);
      return button?.getAttribute('aria-current') === 'true' &&
        document.querySelector('#wiki-article h1')?.textContent === button.textContent;
    }, selectorFor(id)), '目录选中并显示 ' + id);
  }

  async function selectArticle(id) {
    await click(selectorFor(id));
    await waitForArticle(id);
  }

  async function selectCategory(id, firstArticle) {
    const visible = await inspect(id => {
      const category = document.querySelector('#wiki-category');
      category.value = id;
      category.dispatchEvent(new Event('change', { bubbles: true }));
      return [...document.querySelectorAll('[data-wiki-group]:not([hidden])')].map(list => list.dataset.wikiGroup);
    }, id);
    assert.deepEqual(visible, [id], '目录只显示当前分类');
    await waitForArticle(firstArticle);
  }

  async function enterMenu() {
    await until(() => inspect(url => location.href === url && !!document.querySelector('#intro-screen'), url), 'file 游戏启动');
    await click('#intro-screen');
    await until(() => evaluate('!document.querySelector("#intro-screen")'), '启动页淡出');
    assert.equal(await evaluate('document.querySelector("#btn-wiki .menu-action-title")?.textContent'), 'RRWIKI');
  }

  async function open() {
    await send('Page.navigate', { url });
    await enterMenu();
    await click('#btn-wiki');
  }

  async function checkArticle(id, heading, text, focus = false) {
    await waitForArticle(id);
    const article = await inspect(() => {
      const current = [...document.querySelectorAll('.wiki-contents [aria-current="true"]')];
      const heading = document.querySelector('#wiki-article h1');
      const body = document.querySelector('main.wiki-screen #wiki-article');
      return {
        current: current.map(node => node.dataset.wikiArticle),
        heading: heading?.innerText,
        text: body?.innerText,
        focused: heading === document.activeElement
      };
    });
    assert.deepEqual(article.current, [id], '目录标记当前条目');
    assert.match(article.heading, heading);
    assert.match(article.text, text);
    if (focus) assert.ok(article.focused, '切换后焦点移到条目标题');
  }

  function readArticle() {
    return inspect(() => {
      const article = document.querySelector('#wiki-article');
      return {
        title: article.querySelector('h1').textContent,
        summary: article.querySelector('.wiki-summary').textContent,
        sections: [...article.querySelectorAll('section')].map(section => ({
          title: section.querySelector('h2').textContent,
          paragraphs: [...section.querySelectorAll('p')].map(paragraph => paragraph.textContent)
        }))
      };
    });
  }

  async function fill(selector, text) {
    await inspect(selector => {
      const control = document.querySelector(selector);
      control.focus();
      control.select();
    }, selector);
    await send('Input.insertText', { text });
    assert.equal(await inspect(selector => document.querySelector(selector).value, selector), text, '填写 ' + selector);
  }

  async function checkLayout(mobile) {
    const layout = await inspect(() => {
      const { clientWidth, scrollWidth } = document.documentElement;
      const contents = document.querySelector('.wiki-contents').getBoundingClientRect();
      const article = document.querySelector('#wiki-article').getBoundingClientRect();
      const settings = document.querySelector('#settings-btn').getBoundingClientRect();
      const settingsCoversArticle = settings.left < article.right && settings.right > article.left &&
        settings.top < article.bottom && settings.bottom > article.top;
      const outside = [...document.querySelectorAll('.wiki-screen button, #wiki-category, #wiki-article h1, #wiki-article p')].some(node => {
        const { left, width, right } = node.getBoundingClientRect();
        return width > 0 && (left < 0 || right > clientWidth);
      });
      return { clientWidth, scrollWidth, outside, settingsCoversArticle, sideBySide: article.left >= contents.right, stacked: article.top >= contents.bottom };
    });
    assert.equal(layout.scrollWidth, layout.clientWidth, '页面没有横向溢出');
    assert.equal(layout.outside, false, '控件与正文位于视口宽度内');
    assert.ok(mobile ? layout.stacked : layout.sideBySide, mobile ? '窄屏纵向排列' : '桌面双栏');
    if (mobile) assert.equal(layout.settingsCoversArticle, false, '窄屏设置按钮不会遮挡正文');
  }

  async function checkScroll() {
    await evaluate('window.scrollTo({ top: 0, behavior: "instant" })');
    const x = await evaluate('Math.floor(window.innerWidth / 2)');
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y: 270, deltaX: 0, deltaY: 1000 });
    await until(() => evaluate('document.scrollingElement.scrollTop > 0'), 'RRWIKI 页面可滚动');
  }

  async function checkEditing() {
    const targetId = 'switch-turn';
    const edit = '#wiki-edit';
    const submit = '#wiki-editor #form-save';
    const summary = '#wiki-edit-summary';
    const errorText = () => evaluate('document.querySelector("#wiki-edit-error")?.textContent.trim()');
    const checkClosed = () => until(() => evaluate('!document.querySelector("#modal-overlay")'), '条目编辑器关闭');
    const hasEdit = () => evaluate('!!document.querySelector("#wiki-edit")');
    async function readOtherArticles() {
      const { ids, selected } = await inspect(() => ({
        ids: [...document.querySelectorAll('.wiki-contents [data-wiki-article]')].map(button => button.dataset.wikiArticle),
        selected: document.querySelector('.wiki-contents [aria-current="true"]').dataset.wikiArticle
      }));
      const articles = {};
      for (const id of ids.filter(id => id !== targetId)) {
        await inspect(selector => document.querySelector(selector).click(), selectorFor(id));
        await waitForArticle(id);
        articles[id] = await readArticle();
      }
      await inspect(selector => document.querySelector(selector).click(), selectorFor(selected));
      await waitForArticle(selected);
      return articles;
    }
    async function checkSavedArticle(expected) {
      assert.deepEqual(await readArticle(), expected, '显示完整的编辑结果');
      const current = await inspect(() => {
        const item = document.querySelector('.wiki-contents [aria-current="true"]');
        return { id: item?.dataset.wikiArticle, title: item?.textContent };
      });
      assert.deepEqual(current, { id: targetId, title: expected.title }, '目录更新标题并保留选中条目');
      assert.equal(await evaluate('!!document.querySelector(".wiki-screen [data-wiki-test-text]")'), false, '编辑内容按纯文本显示');
    }

    await size(1280, 800);
    await open();
    assert.equal(await hasEdit(), false, '普通模式只读');
    const untouched = await readOtherArticles();
    await selectArticle(targetId);
    const original = await readArticle();
    await click('#wiki-back');
    await click('#mode-developer');
    await click('#btn-wiki');
    await selectArticle(targetId);
    await click(edit);
    await fill('#wiki-edit-title', '取消后应保留原文');
    await click('#wiki-editor #form-cancel');
    await checkClosed();
    assert.deepEqual(await readArticle(), original, '取消编辑保留已发布内容');

    const literal = '<em data-wiki-test-text>保留字面文本</em>';
    const edited = {
      title: '主动换宠 ' + literal,
      summary: '换宠说明 ' + literal,
      sections: [
        { title: '换宠结算 ' + literal, paragraphs: ['新正文 ' + literal, '独立的第二段'] },
        ...original.sections.slice(1)
      ]
    };
    await click(edit);
    await fill('#wiki-edit-title', edited.title);
    await fill(summary, '   ');
    await click(submit);
    assert.ok(await errorText(), '忽略空白后校验失败并显示错误');
    assert.equal(await evaluate('document.activeElement.id'), 'wiki-edit-summary', '校验失败聚焦空字段');
    assert.deepEqual(await readArticle(), original, '校验失败保留显示内容');
    await fill(summary, edited.summary);
    await fill('[data-wiki-section-title]', edited.sections[0].title);
    await fill('[data-wiki-section-body]', edited.sections[0].paragraphs.join('\n\n'));
    await click(submit);
    await checkClosed();
    await checkSavedArticle(edited);
    assert.equal(await evaluate('document.activeElement.id'), 'wiki-edit', '保存后焦点返回编辑按钮');
    assert.ok(await evaluate('document.querySelector("#wiki-save-status")?.textContent.trim()'), '保存后显示反馈');

    const added = { title: '新增小节', paragraphs: ['额外的换宠说明'] };
    await click(edit);
    await click('#wiki-add-section');
    const lastSection = '#wiki-editor .wiki-edit-section:last-of-type';
    assert.equal(await evaluate('document.querySelectorAll("#wiki-editor .wiki-edit-section").length'), edited.sections.length + 1);
    await fill(lastSection + ' [data-wiki-section-title]', added.title);
    await fill(lastSection + ' [data-wiki-section-body]', added.paragraphs[0]);
    await inspect(() => {
      const setItem = Storage.prototype.setItem;
      window.restoreWikiStorage = () => {
        Storage.prototype.setItem = setItem;
        delete window.restoreWikiStorage;
      };
      Storage.prototype.setItem = function (key, value) {
        if (key === 'pbg_wiki_article_override:switch-turn') throw new DOMException('测试写入被拒', 'QuotaExceededError');
        return setItem.call(this, key, value);
      };
    });
    try {
      await click(submit);
      assert.match(await errorText(), /无法保存/, '存储拒绝时明确报告失败');
      assert.equal(await inspect(selector => document.querySelector(selector).value, lastSection + ' [data-wiki-section-title]'), added.title, '存储失败保留编辑草稿');
      await checkSavedArticle(edited);
    } finally {
      await evaluate('window.restoreWikiStorage()');
    }
    await click(submit);
    await checkClosed();
    const withAdded = { ...edited, sections: [...edited.sections, added] };
    await checkSavedArticle(withAdded);

    await click('#wiki-back');
    await click('#mode-solo');
    await click('#btn-wiki');
    assert.equal(await hasEdit(), false, '切回单机后只读');
    await selectArticle(targetId);
    await checkSavedArticle(withAdded);

    await send('Page.reload');
    await enterMenu();
    await click('#btn-wiki');
    await waitForArticle('pp-commit');
    assert.deepEqual(await readOtherArticles(), untouched, '同一路径重载后其他条目仍保留原文');
    await selectArticle(targetId);
    await checkSavedArticle(withAdded);
    assert.equal(await hasEdit(), false, '同一路径重载后在单机模式阅读已保存内容');

    await size(320, 640, true);
    await click('#wiki-back');
    await click('#mode-developer');
    await click('#btn-wiki');
    await waitForArticle('pp-commit');
    await click(edit);
    const formLayout = await inspect(() => {
      const form = document.querySelector('#wiki-editor');
      const { clientWidth, clientHeight } = document.documentElement;
      const fields = form.querySelector('.wiki-editor-fields');
      const controls = [form, ...form.querySelectorAll('fieldset, input, textarea, button')];
      return {
        fits: controls.every(control => {
          const { left, right, width } = control.getBoundingClientRect();
          return width > 0 && left >= 0 && right <= clientWidth;
        }),
        noHorizontalScroll: form.scrollWidth === form.clientWidth && fields.scrollWidth === fields.clientWidth,
        actionsVisible: ['#form-cancel', '#form-save'].every(selector => {
          const button = form.querySelector(selector);
          const { left, top, bottom, width, height } = button.getBoundingClientRect();
          const hit = document.elementFromPoint(left + width / 2, top + height / 2);
          return height > 0 && top >= 0 && bottom <= clientHeight && button.contains(hit);
        })
      };
    });
    assert.deepEqual(formLayout, { fits: true, noHorizontalScroll: true, actionsVisible: true },
      '窄屏表单无需横向滚动，打开后可直接点按取消和保存');
    await click('#wiki-editor #form-cancel');
    await checkClosed();
    assert.deepEqual(await readArticle(), untouched['pp-commit'], '窄屏可取消并返回原条目');
    await selectArticle(targetId);
    await click(edit);
    await click(lastSection + ' [data-wiki-remove-section]');
    await click(submit);
    await checkClosed();
    await checkSavedArticle(edited);
  }

  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

  await size(1280, 800);
  await open();
  await checkArticle('pp-commit', /PP/, /PP/);
  await selectArticle('switch-turn');
  await checkArticle('switch-turn', /换宠/, /先手值[^。]*8|8[^。]*先手值/, true);
  await click('#settings-btn');
  await click('#settings-back');
  await checkArticle('switch-turn', /换宠/, /先手值[^。]*8|8[^。]*先手值/);
  await selectArticle('turn-order');
  await checkArticle('turn-order', /回合|行动/, /梦境/, true);
  await selectArticle('stat-stages');
  await checkArticle('stat-stages', /强化/, /速度/, true);
  await inspect(selector => document.querySelector(selector).focus(), selectorFor('status-immunity'));
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await checkArticle('status-immunity', /异常|防控/, /寄生/, true);
  await checkLayout(false);
  for (const [id, first, title, body] of [
    ['battle', 'hit-and-dodge', /命中/, /半必中/],
    ['clock', 'clock-survival', /不灭魂体/, /覆体魂衣/],
    ['dimo', 'dimo-mark', /明念/, /极尽降华/],
    ['qingling', 'qingling-bloodline', /清念灵体/, /微灵封体/],
    ['qingyu', 'qingyu-forms', /清念沉脉/, /原初血脉/]
  ]) {
    await selectCategory(id, first);
    await checkArticle(first, title, body);
  }
  await selectCategory('basics', 'pp-commit');
  await size(1280, 360);
  await checkScroll();
  await click('#wiki-back');
  assert.equal(await evaluate('!!document.querySelector("#btn-battle") && !document.querySelector(".wiki-screen")'), true);
  await click('#btn-wiki');
  await checkArticle('pp-commit', /PP/, /PP/);

  await size(320, 640, true);
  await open();
  await selectArticle('status-immunity');
  await checkArticle('status-immunity', /异常|防控/, /寄生/, true);
  await evaluate('window.scrollTo({ top: 0, behavior: "instant" })');
  await checkLayout(true);
  await selectCategory('qingyu', 'qingyu-forms');
  await selectArticle('qingyu-ice-skills');
  await checkArticle('qingyu-ice-skills', /残念余梦/, /残风临霜/, true);
  await click('#settings-btn');
  await click('#settings-back');
  await checkArticle('qingyu-ice-skills', /残念余梦/, /残风临霜/);
  assert.equal(await evaluate('document.querySelector("#wiki-category").value'), 'qingyu', '设置往返保留分类');
  await checkScroll();
  await click('.wiki-to-contents');
  assert.equal(await evaluate('document.activeElement.dataset.wikiArticle'), 'qingyu-ice-skills', '从正文返回目录时聚焦当前条目');
  await click('#wiki-back');
  await click('#btn-wiki');
  await checkArticle('pp-commit', /PP/, /PP/);
  await checkEditing();
}

async function main() {
  assert.ok(browser, '找不到 Chromium，请设置 ROCO_CHROMIUM');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'roco-wiki-'));
  let child, connection, launchError;
  try {
    child = spawn(browser, [
      '--headless', '--disable-gpu', '--disable-background-networking', '--no-first-run',
      '--remote-debugging-port=0', '--user-data-dir=' + directory, 'about:blank'
    ], { stdio: 'ignore', windowsHide: true });
    child.on('error', error => { launchError = error; });
    const portFile = path.join(directory, 'DevToolsActivePort');
    const port = await until(() => {
      if (launchError) throw launchError;
      if (child.exitCode !== null) throw new Error('Chromium 提前退出：' + child.exitCode);
      return fs.existsSync(portFile) && fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0];
    }, 'Chromium 调试端口');
    const pages = await fetch('http://127.0.0.1:' + port + '/json/list').then(response => response.json());
    connection = await connect(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
    await testWiki(connection);
  } finally {
    try {
      await stopBrowser(child, connection);
    } finally {
      connection?.close();
    }
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
  console.log('RRWIKI file navigation, desktop/mobile layout and developer editing passed');
}

main().catch(error => {
  console.error(error.stack);
  process.exitCode = 1;
});
