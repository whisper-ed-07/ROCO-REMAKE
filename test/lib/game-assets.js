const fs = require('node:fs');
const path = require('node:path');

// 同时读取构建入口的经典脚本、样式和历史单文件快照。
function readGame(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const assets = new Map();

  function readAsset(relativePath, contentType) {
    if (!/^(?:[\w-]+\/)*[\w.-]+$/.test(relativePath) || /^\.{1,2}$/.test(relativePath)) {
      throw new Error('无效的游戏资源路径：' + relativePath);
    }
    const filename = path.join(path.dirname(htmlPath), relativePath);
    const content = fs.readFileSync(filename, 'utf8');
    assets.set(relativePath, { content, contentType });
    return { filename, content };
  }

  const scripts = Array.from(html.matchAll(/<script(?:\s+src="([^"]+)")?\s*>([\s\S]*?)<\/script>/gi),
    ([, src, content]) => src ? readAsset(src, 'text/javascript') : { filename: htmlPath, content });
  for (const [, href] of html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/gi)) {
    readAsset(href, 'text/css');
  }
  return { html, scripts, assets };
}

module.exports = { readGame };
