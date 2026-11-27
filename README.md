# ROCO REMAKE

当前版本为 `V0.0.1-Alpha`。

ROCO REMAKE 是一款浏览器宠物回合制对战游戏。当前有清羽、清灵、极影迪莫和创世神钟四只内置宠物、20 个内置技能，以及游戏内的宠物和技能编辑器。

## 开始游戏

1. 下载或克隆整个项目，双击 [ROCO REMAKE.html](ROCO%20REMAKE.html)。入口依赖同级 `src/`，无需启动服务器。
2. 进入「单机模式」，分别选择我方和对手的队伍，确认「Little Roco V0-Preview」后开战。每队最多 6 只宠物，每只宠物最多装备 4 招。
3. 战斗中点击技能旁的「i」查看详情。内置技能显示玩家的 TXT 正文，悬停或聚焦血脉标签可查看血脉说明。
4. 每回合有 20 秒选招或换宠。超时从当前可以使用的技能中等概率选一招，打开换宠面板也计时。所有招都不可用时可以换宠或空过。

「开发者·测试模式」可查看和复制完整战斗日志，包括 PP 的每格变化、来源及拦截原因。联机入口尚未开放。自定义宠物、技能、配招和设置由浏览器保存，继续游玩请使用同一浏览器配置和同一游戏文件路径。

## 开发

| 路径 | 内容 |
| --- | --- |
| [入口模板](src/index.html)、[启动](src/main.js) | HTML 结构、设置初始化 |
| [战斗](src/battle/) | 回合、换宠、伤害、PP、状态、场地和 AI |
| [宠物](src/pets/)、[数据](src/data/) | 技能与血脉、注册表、克制及生成后的原文 |
| [界面](src/ui/)、[样式](src/styles/) | 菜单、战斗、日志、编辑器及有序 CSS |
| [存档](src/storage.js)、[测试](test/) | 浏览器配置持久化与回归验证 |

使用 Node.js 22 或更新版本。改入口、加载顺序或宠物 TXT 后，重新生成入口和原文数据。需要分享一个便携文件时，使用最后一条命令，文件生成在 `dist/ROCO REMAKE.html`。

```powershell
node scripts/build.cjs
node scripts/build.cjs --check
node scripts/build.cjs --standalone
```

```powershell
node test/static-checks.js
node test/battle-matrix.js
node test/settings-menu.js --file-replacement
```

浏览器测试使用本机 Chrome、Edge 或 Chromium，可用 `ROCO_CHROMIUM` 指定路径。机制见[清羽](pets/清羽.md)、[清灵](pets/清灵.md)、[极影迪莫](pets/极影迪莫.md)和[创世神钟](pets/创世神钟.md)。开发约定、版本变化和待处理事项分别见[开发手册](AGENTS.md)、[变更记录](CHANGELOG.md)和[未决问题](OPEN-QUESTIONS.md)。
