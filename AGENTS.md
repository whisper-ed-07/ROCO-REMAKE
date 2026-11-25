# AGENTS.md — ROCO REMAKE 开发手册

> 本文件是唯一的执行规范。`PLANNING.md` 只保留玩家的战略与历史规划，不再作为 agent 工作依据；冲突时以玩家最新裁定为准。
> 总原则：**不确定就停**——机制歧义、数值缺失、文本自相矛盾 → 先问玩家，未答复不擅自实现。

## 0. 开工协议

1. 读本文件 + 本次任务相关的 `pets/<宠物名>.md`（机制文档）与 `pets/<宠物名>.txt`（原文）。
2. 工作目录：`C:\dsh work space\rocoremake`（当前主副本）。`Documents\ROCO-REMAKE` 与 `C:\Users\wwjgc\Documents\Codex\2026-10-22\rocoremake` 均为旧副本，保留但不再开发，不用旧文件覆盖主副本。
3. 确认基线：`git log --oneline -1` 与 `git status`；有未提交改动先查明来源。
4. 只改任务范围内文件；设计决策问玩家，实现细节自决并在报告里标注。
5. 完成后按 §9 自检，追加 `CHANGELOG.md` 并本地提交。根据玩家授权推送。
6. 自 2026-11-26 起由本对话的 Codex 负责主副本。根目录游戏文件由统一构建生成，改动从源码进入。提交前核对最新提交与工作区状态。协作细则见 `COLLAB.md`。

## 1. 开发与运行

根目录的游戏文件 `ROCO REMAKE.html` 是单文件产物，直接双击运行。版本 `0.0.1-preview` 的 Git 标签记录重构前的 GitHub 备份。

开发时修改 `src/`。使用 Node.js 从仓库目录运行以下命令，生成并校验根目录的同名 HTML。

```powershell
node scripts/build.cjs
node scripts/build.cjs --check
```

构建读取 `src/index.html`、`src/styles.css` 和 `scripts/build.cjs` 中按初始化顺序列出的 JS 源文件。游戏与现有测试共用同一份合并后的经典脚本。构建使用 Node.js 内置模块。自定义宠物、技能、配招和设置沿用本地存储。

- `pets/<宠物名>.md` / `.txt` 保存机制说明和玩家原文，`pets/_source/` 为原文 HTML 存档。
- `CHANGELOG.md` 记录开发历史。
- `test/static-checks.js` 与 `test/lib/harness.js` 从生成的游戏文件加载引擎。
- `work/` 和 `deploy.bat` 留存旧阶段资料。

## 2. 源码入口

| 目录或文件 | 职责 |
|---|---|
| `src/data/` | 属性、克制表、宠物与技能注册顺序 |
| `src/pets/` | 四只内置宠物的技能与血脉。清灵专属的微灵印记和倒置结算在 `qingling.js` |
| `src/storage.js` | 宠物、技能和配招存储，内置数据与自定义配置的合并 |
| `src/battle/` | 战斗实例、结算上下文、状态、天气、回合和换宠。换宠结算完成后同步通知界面 |
| `src/ui/` | 设置、选队、编辑器、血脉、对战、动画与日志 |
| `src/main.js` | 初始化设置并启动游戏 |

## 3. 数据模型

宠物：

```js
{ id, name, element, emoji, level,
  baseStats: { hp, atk, def, spatk, spdef, spd },
  skillIds: [...],
  bloodline: { name, onTurnStart, onSkillUse, onBeforeDamage, onAfterDamageSegment } }
```

技能：

```js
{ id, name, element, power, pp, maxPp, accuracy,
  category: "physical"|"special"|"status",
  priority: 8,            // 先手+x = 8+x，后手-x = 8-x
  desc,                    // 一句话摘要（列表/按钮用）
  detail,                  // 多行完整机制（游戏内 i 弹窗用）
  onUse(user, target, ctx) }
```

- 技能 id 前缀 `sk_`，宠物 id 前缀 `pet_`；自定义数据用 `custom_<类型>_<时间戳>`。
- 扩展字段：`semiSure`（半必中）、`onMiss`、`extraPPCost`、`immuneToPP`、`noPPRecover`、`ppLocked`、`detail`。
- `onUse` 技能完全接管执行：命中、混乱、PP 扣减、迷雾由引擎先处理；伤害必须走 `ctx.doDamage`。

## 4. 引擎约定

- **ctx**：`doDamage / doFixedDamage / doHeal / addShield / applyStatus / fear / modifyStat / deletePP / restorePP / addTurnEffect / setWeather / setField / setDamageCap / setDamageReduction / invertHealing / msg`，以及 `playerActive/aiActive/playerParty/aiParty` getter。
- **PP 恢复统一走 `gainPP(pet, skill, n)`**：只跳过 `noPPRecover / blockPPRecovery`；`immuneToPP` 只防删除，不防回复。新代码不要直接写 `s.pp +=`。
- **删除 PP 走 `ctx.deletePP`**：跳过 `immuneToPP / ppLocked`。
- **回合效果**：`addTurnEffect(target, name, turns, onTick, onExpire)`；onTick 在回合开始执行，`processTurnEffects` 先快照再清空，onTick 内注册的新效果会保留。
- **回合管线**：`turnCount++` → 天气/环境伤害 → 重置回合统计 → `savePPState` → 血脉 onTurnStart → 烧伤/中毒/束缚/寄生 → 回合效果 → 先手判定 → `executeSkillTurn` ×2 → 不灭魂体结算 → UI → 濒死检查 → `tickEnvironments` → 保存本回合输出。
- **伤害**：`doDamage` 支持 `opts.maxDamage / minDamage / guaranteedCrit / atkStageOverride`；`preventCritNext` 优先于必爆。
- **状态回合只推进一次**（只在 `resolveTurn` 内），不要写回 `playerUseSkill`。
- **无技能可用=挣扎**：`makeStruggleSkill()` 生成普通系 40 威力、25% 反伤的动作；换宠回合用 `skipPlayerAction` 抑制。
- **天气/环境**：`tickEnvironments()` 回合末递减，"持续 N 回合"= N 次结算；环境在场时 `setWeather` 失败。

## 5. 机制修复流程（当前主线）

1. 读 `pets/<宠物名>.txt` 原文，与 `pets/<宠物名>.md` 的「实现」逐条比对。
2. 有歧义 → 一次性列给玩家裁定；不要边猜边写。
3. 改源码并重新生成游戏：一个技能或一组同源改动为一个 commit。
4. 同步三处：`skill.desc`（一句）、`skill.detail`（游戏内完整机制）、`pets/<宠物名>.md`（§4 实现、§5 偏差、修订记录）。
5. 跑 §9 自检；在 `CHANGELOG.md` 记录。

**顺序**：清灵（已完成）→ 极影迪莫 → 清羽 → 创世神钟。

跨宠物的待裁定问题集中在 `OPEN-QUESTIONS.md`（Q1-Q7），宠物自身的待确认项写在各自 `pets/<宠物名>.md` 的「待确认」表里。

## 6. UI 约定

- 出战技能最多 4 个（技能池可多于 4 个）；战斗技能栏桌面 2×2、移动 1×4（顺序即首格顺序），极窄屏横向滚动；局外技能更换用 ◀▶ 调整顺序。
- 技能详情：每张技能卡右下角 `i`，内容优先读 `skill.detail`，没有则回退 `desc`。
- 战斗日志：独立滚动区（桌面 16–18vh、移动 15vh），`overscroll-behavior: contain`。
- 启动页：logo 居中，点击淡出进入菜单；`renderIntro()`。
- 文案全中文；消息统一 `ctx.msg` / `addMessage`。

## 7. 文档约定

- `pets/<宠物名>.txt`：玩家原文，逐字保存；玩家修订用 `[日期 玩家修订]` 注记并保留原句。
- `pets/<宠物名>.md`：结构固定为「基础信息 → 血脉（设计/实现/偏差）→ 技能总表 → 逐技能（设计/实现）→ 待确认 → 验证清单 → 修订记录」。
- `CHANGELOG.md`：每次会话追加「做了什么 / 验证了什么 / 遗留」。
- `PLANNING.md`：玩家战略与历史规划，agent 不改；需要变更先问玩家。
- `specs/PET-CREATION-FLOW.md` / `specs/PET_TEMPLATE.md`：新宠物流程与规格模板，保留并随流程变化更新。

## 8. 新增宠物流程（四步，详见 `specs/PET-CREATION-FLOW.md`，模板见 `specs/PET_TEMPLATE.md`）

1. **收原文**：玩家给的文本原样存 `pets/<宠物名>.txt`，不改措辞。
2. **写机制文档**：`pets/<宠物名>.md`，至少包含：id/名称/系别/等级/种族值、血脉（触发点/公式/上限）、技能表（id/系别/威力/PP/先手/命中/分类/标记）、逐技能机制、待确认问题。
3. **实现**：在 `src/pets/` 编写专属机制，在 `src/data/catalog.js` 注册宠物和技能（含 `desc` + `detail` + `onUse`）、血脉写 `bloodline` 钩子；引擎缺能力先问玩家。
4. **自检与提交**：§9 全过；文档与代码同一 commit；报告要点与遗留。

## 9. 完成标准（DoD）

1. **产物和语法**：`node scripts/build.cjs --check` 通过，生成 HTML 中的 `<script>` 能通过 `vm.Script` 校验。
2. **静态检查**：`node test/static-checks.js` 0 错 0 警（0 种族值合法）。
3. **冒烟**：`test/lib/harness.js` 加载引擎无异常。
4. **矩阵**：4 宠两两 16 场，记录胜负/僵局/卡死/异常；卡死与异常必须为 0。
5. **定向探针**：本次改动涉及的效果至少各一条可复现断言。
6. **浏览器**：涉及构建或存档时，用本机 Chromium 运行 `node test/settings-menu.js --file-replacement`，验证同一文件路径覆盖后的存档、开局和开发者日志。
7. **提交**：本地提交、中文、动词开头。报告改动与验证结果。

## 10. 已知坑

- `calcDamage` / `applyLegacyStatusSkill` 是 legacy 路径（自定义技能没有 `onUse` 时走这里）；新技能一律写 `onUse`。
- 引擎有 id/名称耦合：`postDamageProcessing` 认血脉名「不灭魂体」；`resolveTurn` 认 `sk_qy_1` 与「清念灵体」。重构前先全局搜索。
- `addCritBonus` 用 `setTimeout`（真实秒数），与回合制脱钩；新增时效效果用 `addTurnEffect`。
- 技能闭包常捕获施放时的 `target`：对方换宠后，持续效果会打到后台宠物。新代码用 `currentOpp(pet)` 解析当前对手。
- `gameState.messages` 只渲染最后 50 条，数组本身不截断。
- 字体依赖 Google Fonts，离线时回退到本地字体链。
- 文件为 UTF-8 + LF；编辑时保持。
