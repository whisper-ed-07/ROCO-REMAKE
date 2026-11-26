# ROCO REMAKE

ROCO REMAKE 是一款浏览器宠物回合制对战游戏。你可以为清羽、清灵、极影迪莫和创世神钟搭配技能，选择对手阵容，与电脑对战。每只宠物有独立的血脉和技能机制。

## 开始游戏

1. 下载或克隆项目，在浏览器打开根目录的游戏文件。 [ROCO REMAKE.html](ROCO%20REMAKE.html)
2. 点击启动画面进入菜单，选择「单机模式」并点击「开始对战」。
3. 依次选择我方和对手的宠物。每只宠物最多携带四个出战技能。
4. 在对手阵容页选择「对手 AI」，确认后开战。默认策略「Little Roco V0-Preview」会根据精力、PP、属性克制和场上状态选招。

在对战中点击技能旁的「i」，可以查看内置宠物的技能 TXT 原文。

在「开发者·测试模式」中选择「开始测试」，可以查看完整战斗日志，包括每格技能的扣费、删 PP、回复和来源。

浏览器会保存自定义宠物、技能、配招和游戏设置。继续游玩时，请用同一浏览器配置和原文件路径打开。

## 开发与测试

在项目根目录使用 Node.js 22 或更新版本运行以下命令。构建脚本使用 Node.js 内置模块，将 `src/` 生成根目录的单文件游戏。

```sh
node scripts/build.cjs
node scripts/build.cjs --check
```

静态检查、对战矩阵和浏览器交互测试可分别运行。

```sh
node test/static-checks.js
node test/battle-matrix.js
node test/settings-menu.js
```

浏览器测试使用本机 Chrome、Edge 或 Chromium。可通过 `ROCO_CHROMIUM` 指定可执行文件。以下命令使用 Git 标签 `0.0.1-preview` 里的重构前版本，在独立浏览器配置中验证同一路径换上新构建后能否继续使用存档。

```sh
node test/settings-menu.js --file-replacement
```

## 项目结构

| 路径 | 内容 |
| --- | --- |
| [`src/data/`](src/data/) | 属性克制和宠物、技能注册 |
| [`src/pets/`](src/pets/) | 四只内置宠物的血脉与技能 |
| [`src/battle/`](src/battle/) | 回合、伤害、PP 和状态结算 |
| [`src/ui/`](src/ui/) | 选队、对战界面、日志、设置和编辑器 |
| [`src/storage.js`](src/storage.js) | 自定义宠物、技能和配招存储 |
| [`pets/`](pets/) | 宠物原文和机制文档 |
| [`test/`](test/) | 机制回归、对战矩阵和浏览器测试 |

版本与机制变更见 [CHANGELOG.md](CHANGELOG.md)。
