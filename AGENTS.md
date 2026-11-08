# AGENTS.md — ROCO REMAKE 开发手册

> 本文件是唯一的执行规范。`PLANNING.md` 只保留玩家的战略与历史规划，不再作为 agent 工作依据；冲突时以玩家最新裁定为准。
> 总原则：**不确定就停**——机制歧义、数值缺失、文本自相矛盾 → 先问玩家，未答复不擅自实现。

## 0. 开工协议

1. 读本文件 + 本次任务相关的 `pets/<宠物名>.md`（机制文档）与 `pets/<宠物名>.txt`（原文）。
2. 工作目录：`C:\dsh work space\rocoremake`（当前主副本）。`Documents\ROCO-REMAKE` 是旧副本，内容可能落后，不要在那里改。
3. 确认基线：`git log --oneline -1` 与 `git status`；有未提交改动先查明来源。
4. 只改任务范围内文件；设计决策问玩家，实现细节自决并在报告里标注。
5. 完成后按 §9 自检 → 本地提交（不推送）→ 写 `CHANGELOG.md` → 报告。

## 1. 项目现状（2026-11-08）

- 单文件 HTML 游戏：`ROCO REMAKE.html`，3492 行，全部 JS 在一个 `<script>`（第 922 行起）内，CSS 在前。
- 原生 JS + CSS，无构建链；自定义宠物/技能存 localStorage（`pbg_custom_pets` / `pbg_custom_skills`）。
- 内置 4 只宠物、20 个技能；全部技能走 `onUse` 扩展路径。
- 机制修复进度：**清灵已完成**（按 B 站原文重做，剩 1 条待确认）；极影迪莫、清羽、创世神钟**待做**。
- 文件布局：
  - `ROCO REMAKE.html` — 唯一运行文件
  - `pets/<宠物名>.md` / `.txt` — 机制文档 / 原文；`pets/_source/` 原文 HTML 存档
  - `CHANGELOG.md` — 每次会话的记录
  - `test/static-checks.js` + `test/lib/harness.js` — 静态检查与 Node 引擎加载
  - `deploy.bat` — 旧部署脚本（当前无 git remote，仅留档）
  - `work/` — 历史草稿，不维护

## 2. 代码地图（行号会漂移，优先 grep 关键字）

| 区域 | 行 | 说明 |
|---|---|---|
| `<script>` | 922 | 引擎与 UI 全部代码 |
| `ELEMENTS` | 951 | 19 系属性表；加属性要补 `_icon`/`_emoji`/name/color/bg |
| `DEFAULT_SKILLS` | 1054 | 内置技能数组 |
| `DEFAULT_PETS` | 1761 | 内置宠物数组 |
| `class BattlePet` | 2093 | 战斗实例 |
| `gameState` | 2220 | 全局状态 |
| `createBattleContext()` | 2232 | ctx API |
| `gainPP()` | 2387 | 统一的 PP 恢复入口 |
| `tickEnvironments()` | 2505 | 天气/环境回合末计时 |
| `resolveTurn` | 2657 | 回合主管线 |
| `executeSkillTurn` | 2799 | 单技能执行 |
| `renderBattleActions` | 3209 | 战斗技能栏 |
| `showSkillDetail` | 3234 | 技能详情弹窗（游戏内机制说明） |
| `openSkillSwap` | 3274 | 局外技能更换/排序 |

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
- **PP 恢复统一走 `gainPP(pet, skill, n)`**：自动跳过 `immuneToPP / noPPRecover / blockPPRecovery`。新代码不要直接写 `s.pp +=`。
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
3. 改代码：一个技能/一组同源改动为一个 commit。
4. 同步三处：`skill.desc`（一句）、`skill.detail`（游戏内完整机制）、`pets/<宠物名>.md`（§4 实现、§5 偏差、修订记录）。
5. 跑 §9 自检；在 `CHANGELOG.md` 记录。

**顺序**：清灵（已完成）→ 极影迪莫 → 清羽 → 创世神钟。

跨宠物的待裁定问题集中在 `OPEN-QUESTIONS.md`（Q1-Q7），宠物自身的待确认项写在各自 `pets/<宠物名>.md` 的「待确认」表里。

## 6. UI 约定

- 战斗技能栏横排 1→5（顺序即首格顺序），超宽横向滚动；局外技能更换用 ◀▶ 调整顺序。
- 技能详情：每张技能卡右下角 `i`，内容优先读 `skill.detail`，没有则回退 `desc`。
- 战斗日志：独立滚动区（桌面 34vh、移动 20vh），`overscroll-behavior: contain`。
- 启动页：logo 居中，点击淡出进入菜单；`renderIntro()`。
- 文案全中文；消息统一 `ctx.msg` / `addMessage`。

## 7. 文档约定

- `pets/<宠物名>.txt`：玩家原文，逐字保存；玩家修订用 `[日期 玩家修订]` 注记并保留原句。
- `pets/<宠物名>.md`：结构固定为「基础信息 → 血脉（设计/实现/偏差）→ 技能总表 → 逐技能（设计/实现）→ 待确认 → 验证清单 → 修订记录」。
- `CHANGELOG.md`：每次会话追加「做了什么 / 验证了什么 / 遗留」。
- `PLANNING.md`：玩家战略与历史规划，agent 不改；需要变更先问玩家。
- 已删除 `specs/` 下的模板/流程/说明，内容并入本文件。

## 8. 新增宠物流程（四步）

1. **收原文**：玩家给的文本原样存 `pets/<宠物名>.txt`，不改措辞。
2. **写机制文档**：`pets/<宠物名>.md`，至少包含：id/名称/系别/等级/种族值、血脉（触发点/公式/上限）、技能表（id/系别/威力/PP/先手/命中/分类/标记）、逐技能机制、待确认问题。
3. **实现**：`DEFAULT_PETS` 注册宠物、`DEFAULT_SKILLS` 注册技能（含 `desc` + `detail` + `onUse`）、血脉写 `bloodline` 钩子；引擎缺能力先问玩家。
4. **自检与提交**：§9 全过；文档与代码同一 commit；报告要点与遗留。

## 9. 完成标准（DoD）

1. **语法**：提取 `<script>` 内容用 `vm.Script` 或 `node --check` 通过。
2. **静态检查**：`node test/static-checks.js` 0 错 0 警（0 种族值合法）。
3. **冒烟**：`test/lib/harness.js` 加载引擎无异常。
4. **矩阵**：4 宠两两 16 场，记录胜负/僵局/卡死/异常；卡死与异常必须为 0。
5. **定向探针**：本次改动涉及的效果至少各一条可复现断言。
6. **提交**：本地提交、中文、动词开头；报告改动与验证结果。

## 10. 已知坑

- `calcDamage` / `applyLegacyStatusSkill` 是 legacy 路径（自定义技能没有 `onUse` 时走这里）；新技能一律写 `onUse`。
- 引擎有 id/名称耦合：`postDamageProcessing` 认血脉名「不灭魂体」；`resolveTurn` 认 `sk_qy_1` 与「清念灵体」。重构前先全局搜索。
- `addCritBonus` 用 `setTimeout`（真实秒数），与回合制脱钩；新增时效效果用 `addTurnEffect`。
- 技能闭包常捕获施放时的 `target`：对方换宠后，持续效果会打到后台宠物。新代码用 `currentOpp(pet)` 解析当前对手。
- `gameState.messages` 只渲染最后 50 条，数组本身不截断。
- 字体依赖 Google Fonts，离线时回退到本地字体链。
- 文件为 UTF-8 + LF；编辑时保持。
