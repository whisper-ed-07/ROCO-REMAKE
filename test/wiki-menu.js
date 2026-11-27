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
      node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      const box = node.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      return node.contains(document.elementFromPoint(x, y)) ? { x, y } : null;
    }, selector), '控件可点击 ' + selector);
    await send('Input.dispatchMouseEvent', { ...position, type: 'mousePressed', button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { ...position, type: 'mouseReleased', button: 'left', clickCount: 1 });
  }

  async function open() {
    await send('Page.navigate', { url });
    await until(() => inspect(url => location.href === url && !!document.querySelector('#intro-screen'), url), 'file 游戏启动');
    await click('#intro-screen');
    await until(() => evaluate('!document.querySelector("#intro-screen")'), '启动页淡出');
    assert.equal(await evaluate('document.querySelector("#btn-wiki .menu-action-title")?.textContent'), 'RRWIKI');
    await click('#btn-wiki');
  }

  async function checkArticle(id, heading, text, focus = false) {
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

  async function checkLayout(mobile) {
    const layout = await inspect(() => {
      const { clientWidth, scrollWidth } = document.documentElement;
      const contents = document.querySelector('.wiki-contents').getBoundingClientRect();
      const article = document.querySelector('#wiki-article').getBoundingClientRect();
      const settings = document.querySelector('#settings-btn').getBoundingClientRect();
      const settingsCoversArticle = settings.left < article.right && settings.right > article.left &&
        settings.top < article.bottom && settings.bottom > article.top;
      const outside = [...document.querySelectorAll('.wiki-screen button, #wiki-article h1, #wiki-article p')].some(node => {
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

  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

  await size(1280, 800);
  await open();
  await checkArticle('pp-commit', /PP/, /PP/);
  await click(selectorFor('switch-turn'));
  await checkArticle('switch-turn', /换宠/, /先手值[^。]*8|8[^。]*先手值/, true);
  await click('#settings-btn');
  await click('#settings-back');
  await checkArticle('switch-turn', /换宠/, /先手值[^。]*8|8[^。]*先手值/);
  await click(selectorFor('turn-order'));
  await checkArticle('turn-order', /回合|行动/, /梦境/, true);
  await click(selectorFor('stat-stages'));
  await checkArticle('stat-stages', /强化/, /速度/, true);
  await inspect(selector => document.querySelector(selector).focus(), selectorFor('status-immunity'));
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await checkArticle('status-immunity', /异常|防控/, /寄生/, true);
  await checkLayout(false);
  await size(1280, 360);
  await checkScroll();
  await click('#wiki-back');
  assert.equal(await evaluate('!!document.querySelector("#btn-battle") && !document.querySelector(".wiki-screen")'), true);
  await click('#btn-wiki');
  await checkArticle('pp-commit', /PP/, /PP/);

  await size(320, 640, true);
  await open();
  await click(selectorFor('status-immunity'));
  await checkArticle('status-immunity', /异常|防控/, /寄生/, true);
  await evaluate('window.scrollTo({ top: 0, behavior: "instant" })');
  await checkLayout(true);
  await click('#settings-btn');
  await click('#settings-back');
  await checkArticle('status-immunity', /异常|防控/, /寄生/);
  await checkScroll();
  await click('.wiki-to-contents');
  assert.equal(await evaluate('document.activeElement.dataset.wikiArticle'), 'status-immunity', '从正文返回目录时聚焦当前条目');
  await click('#wiki-back');
  await click('#btn-wiki');
  await checkArticle('pp-commit', /PP/, /PP/);
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
  console.log('RRWIKI file navigation and desktop/mobile layout passed');
}

main().catch(error => {
  console.error(error.stack);
  process.exitCode = 1;
});
