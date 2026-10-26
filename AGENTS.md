# AGENTS.md — ROCO REMAKE 开发手册

> 任何 agent(Codex / Reasonix / 其他)开工前必读本文件。
> 全局规划见 `PLANNING.md`;宠物流程见 `specs/PET-CREATION-FLOW.md`;冲突时以玩家最新裁定为准。
> 总原则:**不确定就停**——机制歧义 / 数值缺失 / 自相矛盾 → ask 玩家,未获答复不擅自实现。

## 0. 开工协议(每个新窗口第一步)

1. 读本文件 + `PLANNING.md`(规划与裁定)+ 本次任务相关 `specs/*.md`。
2. 确认工作目录 `~/Documents/ROCO-REMAKE`(旧 Codex 会话路径 `Codex/2026-07-23/111` 已废弃)。
3. 确认基线:`git log --oneline -1` 与 `git status`(应干净);不一致先查明再动手。
4. 范围外的东西不要动;设计决策 ask 玩家,实现细节自决并标注;低风险项可"默认值 + 标注"。
5. 完成后按 §10 DoD 自检 → 本地提交(不推送)→ 报告 → 会话交接写入 `CHANGELOG.md`。

## 1. 项目速览

- 单文件 HTML 游戏 `ROCO REMAKE.html`(约 2900 行,全部 JS 在一个 `<script>` 内,CSS 在前)。
- 基于《洛克王国》页游战斗玩法;**引擎规则遵循原作,宠物与技能设定全部玩家原创**。
- 目标:网页部署 + 桌面壳双平台;远期联机 PvP(权威服务器共用本引擎)。
- 文件布局:
  - `ROCO REMAKE.html` — 唯一运行文件(直接编辑这里)
  - `AGENTS.md` — 本手册;`PLANNING.md` — 全局规划(变更须玩家确认)
  - `specs/` — `PET_TEMPLATE.md` 规格模板、`PET-CREATION-FLOW.md` 添加流程、`pet_*.md` 宠物规格
  - `work/` — 历史草稿,**不维护,不要编辑**
  - `deploy.bat` — 部署脚本
- 版本控制:git,main 分支;**本地提交不推送**;一个 bug/主题一个 commit;specs 变更单独 commit;提交信息中文、动词开头(修复/实现/新增/PLANNING:)。

## 2. 代码地图(2026-10-26 校对;行号随版本漂移,以 grep 定位为准)

| 区域 | 位置(约) | 说明 |
|---|---|---|
| `<script>` 开始/结束 | 835 / 3295 | 引擎全部代码 |
| `ELEMENTS` | 864 | 19 系属性表,含 `_icon`/`_emoji`/name/color/bg;加新属性三处都要补 |
| `TYPE_CHART` / `setEff(atk,def,val)` | 915 | 克制表;未声明 = 1 |
| `DEFAULT_SKILLS` | 977 | 内置技能数组 |
| `DEFAULT_PETS` | 1646 | 内置宠物数组 |
| localStorage 键 | 1961 | `pbg_custom_pets` / `pbg_custom_skills` |
| `class BattlePet` | 1978 | 战斗实例 |
| `gameState` | 2103 | 全局状态(含 `skipPlayerAction`) |
| `createBattleContext()` | 2115 | ctx API(技能/血脉唯一交互入口) |
| `processBloodlines` / `processTurnEffects` | 2268 / 2277 | 回合开始处理 / 回合效果计时 |
| `postDamageProcessing` / `forceSwitchPet` | 2301 / 2315 | 致死结算 / 强制换宠 |
| `TURN_TIME_LIMIT=20` / `startTurnTimer` | 2331 | 回合计时,超时自动用第一个有 PP 的技能 |
| `tickEnvironments` / `processField` / `processWeather` | 2376 / 2371 / 2387 | 天气环境计时 / 环境 / 天气伤害 |
| `calcDamage` / `applyEffect` | 2420 / 2441 | legacy 伤害 / 异常状态 |
| `playerUseSkill` / `aiDecideAndResolve` | 2478 / 2495 | 指令入口 / AI 选招 |
| `makeStruggleSkill` | 2523 | 无技能可用时的兜底动作(不占 PP,25% 反伤) |
| `resolveTurn` | 2528 | 回合主管线(顺序见 §8) |
| `executeSkillTurn` | 2669 | 单技能执行(命中/混乱/PP/onUse/反弹) |
| `applyLegacyStatusSkill` | 2822 | 无 onUse 的变化技(技能名硬编码) |
| `playerSwitch` / `checkFaints` / `endBattle` | 2844 / 2857 / 2865 | 换宠 / 濒死 / 终局 |
| `updateBattleUI` 及渲染函数 | 2868 | UI 刷新 |
| 宠物/技能管理 UI | 3144 起 | 编辑器表单;自定义数据只走 localStorage |

## 3. 数据模型

### 宠物(`DEFAULT_PETS` 条目)

```js
{ id: "pet_xxx", name, element, emoji, level,
  baseStats: { hp, atk, def, spatk, spdef, spd },  // 种族值
  skillIds: ["sk_xxx", ...],                        // 技能 id
  bloodline: { name, onTurnStart(pet, ctx), onSkillUse(pet, target, ctx, skill) } }
```

- 内置 id 前缀 `pet_`;自定义宠物 id 为 `custom_pet_<时间戳>`(存 localStorage)。
- 血脉钩子共 4 个(均可选):`onTurnStart`(每回合开始)、`onSkillUse`(每次出招结算后)、`onBeforeDamage(pet, dmg, kind, attacker, ctx)`(承伤前,可返回新 dmg)、`onAfterDamageSegment(pet, segIdx, ctx)`(承伤后)。

### 技能(`DEFAULT_SKILLS` 条目)

```js
{ id: "sk_xxx", name, element, power, pp, maxPp, accuracy,
  category: "physical"|"special"|"status",
  priority: 8,            // 默认 8;先手+x = 8+x,后手-x = 8-x
  desc, onUse(user, target, ctx) /* 可选 */ }
```

- 内置 id 前缀 `sk_`;自定义技能 `custom_skill_<时间戳>`,**没有 onUse**,走 legacy 路径(见 §12)。
- **有 `onUse` 的技能完全接管执行**:引擎已先行处理命中判定、混乱、PP 扣减、迷雾混乱、闪避标记;`onUse` 内必须用 `ctx.doDamage` 造成伤害;结束后引擎再处理反弹/瞬华/血脉 onSkillUse。
- 常用扩展字段:`semiSure`(半必中)、`onMiss`、`extraPPCost`、`immuneToPP`。

## 4. BattlePet 运行时字段(写技能/血脉时可用)

- 基础:`maxHp hp atk def spatk spdef spd`;`*Stage` 六维强化(-6..6)+ `accuracyStage`;`status statusTurns confuseTurns bindTurns leechSeed shield turnEffects marks`。
- 修饰:`healMod dmgMod spdMod`、`damageCap/damageCapThreshold/damageCapTurns`(限伤)、`damageReduction/damageReductionTurns`、`statusImmunities[]`(免疫异常)、`statImmunity`、`outputReduction`、`healInvertPct/healInvertTurns`(倒置治疗)、`critRateBonus`、`skillPPCostMult`、`priorityOverride`、`dodgeNextNonSure`、`immuneBackhand`、`reflectBackhand`、`invincible`、`immuneEject`、`blockPPRecovery`、`maxHpBonus`、`mingNianDmg`、`lastUsedSkillId lastPowerSkillId lastDealtDamage currentDealt lethalHitThisTurn preDeathHP preventCritNext`。
- 方法:`getStat(stat)`(含阶段、麻痹速度减半、spdMod)、`isFainted()`、`canAct()`、`takeDamage(dmg)`(内部处理限伤/减免/护盾/致死标记/飘字)、`heal(amount)`(内部处理 healMod/倒置/healReducePct/maxHpBonus)。

## 5. gameState 字段

`screen playerParty[] aiParty[] playerActive aiActive messages[] isPlayerTurn battleOver waitingForSwitch pendingPlayerSkill pendingAISkill turnTimer turnTimeLeft selectedTeamIds opponentTeamIds turnCount weather weatherTurns field fieldTurns banEffects snapshots ppHistory pendingFirstMove`

- 天气:`sunny rainy sandstorm hailstorm mist`;环境:`dream`(梦境)、`shunhua`(瞬华);`pendingFirstMove` 为 `"player"` 或 `"ai"`(技能内判断先/后手用它,见现有技能写法)。

## 6. ctx API(`createBattleContext()` 返回值)

**伤害**:`doDamage(att, def, power, cat, el, opts)` → `{damage, effectiveness, isCrit}`;opts 支持 `atkStageOverride`、`guaranteedCrit`。`doFixedDamage(target, amount)`(最低 1,走防御方 onBeforeDamage)。
**治疗**:`doHeal(target, amount)`(走 target.heal)。
**护盾**:`addShield(target, amount)`(被 `banEffects.shield` 禁止时无效)。
**异常**:`applyStatus(target, status)`(burn/freeze/paralyze/poison/sleep/confuse/fear/bind;主异常互斥,confuse/fear/bind 独立);`fear(target)`。
**强化**:`modifyStat(target, stat, stages)`(statLocked 时无效;statImmunity 挡负向)。
**PP**:`deletePP(target, slot, amount)`(slot=-1 全员;跳过 immuneToPP)、`restorePP(target, slot, amount)`(blockPPRecovery 时无效)。
**标记**:`addMark/getMark(target, name)`。
**延时**:`addTurnEffect(target, name, turns, onTick, onExpire)` — 回合制推荐方式;onTick 每回合开始调用,`turnsLeft<=0` 先 onExpire 再移除。
**快照**:`saveSnapshot getSnapshotHPDiff savePPState rewindPPToMin`。
**天气/环境**:`setWeather(type, turns)`(环境在场时失败)、`setField(type, turns)`。
**其它**:`setDamageCap setDamageReduction setCritPrevention addCritBonus invertHealing msg(text)`;getter:`playerActive aiActive playerParty aiParty`。
> 现有技能大量直接引用全局 `gameState`,可继续沿用;新增机制优先走 ctx。

## 7. 核心机制速查(引擎现状;未来以 specs/GLOBAL-BATTLE-RULES.md 为准)

- **伤害公式**:`floor(((2*level/5+2)*power*(atk/def))/50+2)` → ×随机(0.85~1.15)→ 本系 ×1.5 → 克制(TYPE_CHART)→ 天气 → 暴击 ×1.5(基础 6.25%+critRateBonus)→ 烧伤物理 ×0.5 → dmgMod → outputReduction;最低 1。
- **先手**:`priority` 默认 8;平先手比 `getStat("spd")`;梦境反转(低先手先动、同值慢速先动);瞬华环境光系速度 ×1.15;迷雾天气幽灵系 +1;`priorityOverride` 覆盖。
- **天气**:sunny 火×1.5/水×0.5;rainy 水×1.5/火×0.5;sandstorm 每回合非土/机械/岩系扣 maxHp/16;hailstorm 非冰系扣 maxHp/16;mist 幽灵先手+1 且行动前后 80% 混乱(免疫 confuse/statImmunity 免)。
- **环境**:dream 梦境(清翎覆尘先手值反转为 1);shunhua 瞬华(先手出招回 100、被抵抗追加 30% 固伤、光系速度 +15%)。环境在场时 `setWeather` 失败。
- **异常**:burn 每回合 maxHp/16 且物理 ×0.5;poison 每回合 maxHp/8;paralyze 25% 不能动且速度 ×0.5;sleep 1-3 回合;freeze 20% 解冻;fear 1-2 回合不能动;confuse 2-4 回合、50% 自伤;bind 2-5 回合、禁止换宠;leech_seed 每回合吸 maxHp/8。
- **PP**:出招即扣(命中判定前),`ppCost = max(1, round(skillPPCostMult + extraPPCost))`;`immuneToPP` 免删免恢复;`blockPPRecovery` 封锁恢复。
- **换宠**:bindTurns>0 或 switchLocked 禁止;濒死自动换下一只,全灭 `endBattle`。
- **回合计时**:20 秒超时自动用第一个有 PP 的技能,全空则空过回合。

## 8. 回合管线顺序(`resolveTurn`)

`turnCount++` → `processWeather` → `processField` → 重置 `lastDealtDamage/currentDealt/invincible` → `savePPState` → `processBloodlines`(双方 onTurnStart)→ `applyEndOfTurnEffects`(双方烧伤/中毒/束缚/寄生)→ `processTurnEffects`(双方 onTick/到期 onExpire)→ 先手判定写入 `pendingFirstMove` → `executeSkillTurn` ×2(按先手序,一方倒下则跳过)→ `postDamageProcessing`(不灭魂体保留 1HP + 强制换宠)→ `updateBattleUI` → `checkFaints` → 清空 pending → `endTurnCleanup`。

## 9. 现有内容清单(4 只内置宠物)

| id | 名称 | 系别 | 血脉 |
|---|---|---|---|
| `pet_qingling` | 清灵 | ghost | 清念灵体 |
| `pet_jydm` | 极影迪莫 | light | 明念 |
| `pet_qy` | 清羽 | flying | 见代码 bloodline.name |
| `pet_bmhs` | 见代码 name | 见代码 | 见代码 bloodline.name |

技能 id 前缀:`sk_ql_*`(清灵)、`sk_jydm_*`(极影迪莫)、`sk_qy_*`(清羽)、`sk_cszn / sk_cyjy / sk_fthy / sk_mszw / sk_nlex`(其余)。新增宠物以 `specs/pet_*.md` 规格为准。

## 10. 验证清单(DoD,全过才算完成)

1. **语法检查**(只读管线):`sed -n '/^<script>$/,/^<\/script>$/p' "ROCO REMAKE.html" | sed '1d;$d' | node --check -`
2. **规格核对**:与 `specs/pet_*.md` 逐条一致(id、数值、效果)。
3. **冒烟测试**:node + vm + DOM stub 加载引擎,确认可脱离浏览器执行、无运行时错。
4. **矩阵回归**:4 只内置宠物两两对战 16 场,无崩溃、无 NaN、无死循环。
5. **git 提交**:本地提交,不推送;报告要点 + 遗留问题。
- 目标:以上固化为 `test/run-tests.js`(见 PLANNING §5),固化前按本清单手工执行。

## 11. 流程与规则

- **新宠物**:严格执行 `specs/PET-CREATION-FLOW.md` 四步(文本 → 规格 → 实现 → 自检);规格套 `PET_TEMPLATE.md`,忠实原文不增删,歧义标 `[疑问]` 并 ask 玩家。
- **报 bug**:规格对照 → 定位 → 最小改动修复 → 自检(§10)→ 本地提交 → 报告;机制性歧义 ask 玩家。
- **文案**:游戏内全部中文;消息统一 `ctx.msg(...)` 或 `addMessage(...)`。
- **提问**:设计决策(数值/机制)必须 ask;实现细节可自决并在报告标注;低风险项可"默认值 + 标注"。

## 12. 已知坑与注意事项

- `calcDamage` / `applyLegacyStatusSkill` 是 **legacy 路径**(无 onUse 的技能走它);新技能一律写 `onUse` + ctx。
- `applyLegacyStatusSkill` 按**技能名硬编码**(祈雨/水流环/光合作用/龙之舞/极光幕/烟雾/冰冻之风/寄生种子),不要靠名称匹配新增逻辑。
- 引擎存在 id 耦合:`postDamageProcessing` 硬编码血脉名"不灭魂体";`resolveTurn` 硬编码 `sk_qy_1` 与"清念灵体"。重构前注意全局搜索这些 id。
- `addCritBonus` 用了 `setTimeout`(真实秒数),与回合制脱钩;新增时效效果一律用 `addTurnEffect`。
- 字体走 Google Fonts `@import`,离线/桌面端需留意字体回退(`--font-game-*` 有本地回退链)。
- `gameState.messages` 渲染只取最后 50 条,数组本身不截断。
- 编辑此文件时保持 LF/CRLF 一致(git 有 autocrlf 警告,提交后以 git 为准)。

## 13. 回合与兜底约定(2026-10 修复后新增)

- **状态回合只推进一次**:睡眠/冰冻/恐惧的 `statusTurns` 递减只在 `resolveTurn` 内做,`playerUseSkill` 不再处理,避免一回合扣两次。
- **无技能可用 = 挣扎**:双方 PP 全空时由 `makeStruggleSkill()` 生成临时动作(普通系物理 40 威力、25% 反伤、不占 PP 槽);`skipPlayerAction` 用于换宠回合抑制玩家挣扎。
- **天气/环境在回合末计时**:`tickEnvironments()` 统一递减,`processWeather` 只负责每回合伤害;"持续 N 回合"= 恰好 N 次结算。
- **回合效果可自我续期**:`processTurnEffects` 先快照再清空,onTick 内 `addTurnEffect` 注册的新效果会保留到下一回合。
- **伤害上下限**:`ctx.doDamage` 支持 `opts.maxDamage` / `opts.minDamage`(在血脉钩子之后、保底 1 之前);`preventCritNext` 优先于 `guaranteedCrit`。
- **主异常互斥包含恐惧**:fear 存在 `pet.status` 槽,不能覆盖烧伤/中毒等主异常(与 §7 "fear 独立"的旧表述冲突,见 OPEN-QUESTIONS Q6)。
