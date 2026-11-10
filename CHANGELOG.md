# CHANGELOG

> 每个会话结束追加:做了什么 / 验证了什么 / 留了什么坑。按 commit 对应。

## 2026-11-08 — 清羽：按原文重做

- 残脉①：改为「0.3×上回合最高两段伤害 + 50×空PP数」；对方有减伤/限伤时改为治疗对方（0.3×上回合受伤总值+30+50×本回合技能次数），低血且残风PP≠4 时倒置。
- 轻风散魂：补闪避（本回合后手 + 下回合非必中）、先手回 2PP、后手按清翎已损删 PP。
- 残念余梦：返还上次伤害、退回负面状态、先手删 3PP、后手沉睡/锁换宠、失败删 PP。
- 残风临霜：冰冻失败按 useCount>6 删 PP、空 PP≥2 驱逐、护盾公式、减速 30%。
- 清念沉脉：清强化/治疗/回 PP，结束压制对方 4 回合（威力 −30%、变化技先手 −1）。
- 引擎：新增承伤分段、技能使用计数、下回合非必中闪避、变化技先手惩罚。
- 五个技能补充 detail；机制文档重写。
- 验证：静态检查 0/0；矩阵结果见下。

## 2026-11-08 — 极影迪莫：按原文重做

- 极尽降华：全场及场下所有技能视为光系（6 回合，对方被标记时 12 回合）；双方全部宠物回复/输出 +100%，到期统一移除；PP 被删空时回合末被动发动。
- 明念：免疫范围改为 6 种控制（睡眠/冰冻/恐惧/麻痹/混乱/束缚），负面强化只免魔攻/速度；每回合全体技能 +1PP 经 gainPP。
- 化念作刃：先手伤害按物攻 +2 结算；后手只删对方先手技能 3PP。
- 极影光幕：PP 消耗惩罚改为 6 回合窗口，到期清除。
- 瞬华若霜：m>3 冰冻成功后自身前两格永久免疫删 PP。
- 炽光若焰：烧伤失败后本技能 12 回合内无法回复 PP。
- 五个技能补充 detail（游戏内 i 弹窗），与实现逐条一致；机制文档重写。
- 未实现：神系封印（游戏暂无神系）、降华上场免删/限伤衰减、光幕护盾破除加成；见 pets/极影迪莫.md §5。
- 验证：静态检查 0/0；矩阵 13 胜出 / 3 僵局 / 0 卡死 / 0 异常。

## 2026-11-08 — 极影迪莫：先修两处原文硬数据

- `sk_jydm_1` 极尽降华系别 `light` → `normal`（原文「普通系变化」）。
- 明念标记期间改为每回合恢复**全体技能 1PP**（经 `gainPP`，尊重 PP 恢复封锁），原实现只回上次威力技能。
- 机制文档同步；其余机制差异待玩家裁定后处理。

## 2026-11-08 — 战斗日志 UI（阶段 2/3：标签、过滤、折叠、复制）

- 文本装饰：`命中要害` → 暴击标签、`效果拔群` → 克制、`效果不佳` → 抵抗、`没有效果` → 免疫；伤害/治疗数字加粗并用等宽数字。
- 工具条：全部 / 行动 / 系统 三种过滤 + 复制日志（优先 Clipboard API，失败回退 execCommand）。
- 回合折叠：点击回合分隔条折叠该回合消息，caret 切换 ▾/▸；回合条自身始终可见。
- 过滤与折叠状态存于 `gameState.logFilter / logCollapsed`，重绘后保持。
- 修复：折叠时回合条被误加 `.collapsed` 导致整条消失，改为 `.turn-collapsed`。
- 验证：截图确认标签渲染、过滤（visibleAfterFilter=15）、折叠（collapsed=13 且回合条可见）；静态检查 0/0，矩阵 0 卡死 0 异常。

## 2026-11-08 — 战斗日志 UI（阶段 1：结构 + 敌我区分）

- 消息从字符串升级为对象 `{ text, type, side, turn }`；`addMessage` 保留旧调用方式，自动分类为 action / damage / heal / status / system / turn。
- `ctx.msg` 统一走 `addMessage`；技能执行期间由 `runSkillTurn` 设置 `currentActingSide`，技能与血脉产生的日志自动带「我 / 敌」。
- 渲染：回合分隔条居中、阵营徽标（我方金、敌方红）、左侧色条、类型配色（伤害珊瑚红 / 治疗翠绿 / 状态紫 / 系统灰蓝）；文本统一转义。
- 滚动：重绘时保持用户位置，上翻不再被拉回底部；右下角出现「回到最新」；日志上限 200 条。
- 空状态：开战写入「战斗开始」，不再空白；移除顶栏重复的回合指示，避免与天气条重叠。
- 验证：静态检查 0 错 0 警；16 场矩阵 14 胜出 / 2 僵局 / 0 卡死 / 0 异常；截图确认「我 / 敌」与滚动保持（before=200 after=200）。

## 2026-11-08 — 修复新战斗残留上一局天气

- 症状：打开游戏直接进清灵内战，未出招就显示"迷雾天气"。
- 根因：`confirmOpponentAndBattle` 只重置了队伍与消息，没有清空 `gameState.weather / weatherTurns / field / fieldTurns / banEffects / pending*`；上一局的天气与环境被带进新局。
- 修复：新战斗开始时统一重置天气、环境、全局封锁、待结算指令与回合计时；`skipPlayerAction` / `isPlayerTurn` 复位。
- 验证：模拟残留 `mist+dream` 后开新局，读回 `weather=null field=null turns=0`，顶部不再显示天气。

## 2026-11-08 — 恢复新宠物流程与规格模板

- 从删除前的提交恢复 `specs/PET-CREATION-FLOW.md` 与 `specs/PET_TEMPLATE.md`（玩家要求保留）。
- 两份文件顶部补充落地路径与当前文档结构的说明（指向 `AGENTS.md` §7/§9）。
- `AGENTS.md` 的文件布局、§7 文档约定、§8 流程小节恢复对这两份文件的引用。

## 2026-11-08 — 精简文档体系，重写 AGENTS

- `AGENTS.md` 按当前实现重写：真实路径 `C:\dsh work space\rocoremake`、3492 行、代码地图行号、引擎约定（gainPP / ppLocked / 回合管线）、机制修复进度、UI 约定、DoD、已知坑。
- 删除 `specs/`：`PET-CREATION-FLOW.md`、`PET_TEMPLATE.md`、`README.md` 的内容并入 AGENTS §7-§8，不再单独维护。
- `handoff/` 归档到 `work/handoff-archive/`（旧双窗交接机制已不使用）。
- 保留 `PLANNING.md`（玩家战略，agent 不改）与 `OPEN-QUESTIONS.md`（跨宠物待裁定），同步修正 PLANNING 中指向已删除文件的引用。
- 最终文档结构：AGENTS（唯一规范）+ PLANNING（战略）+ OPEN-QUESTIONS（待裁定）+ CHANGELOG（记录）+ `pets/`（每宠 md+txt）。

## 2026-11-08 — 战斗日志独立滚动条

- 日志面板固定高度（移动端 20vh、桌面跟随左栏），`overflow-y: scroll` 常驻滚动条，`overscroll-behavior: contain` 防止滚动带动整页。
- 滚动条独立样式：9px 宽、金色滑块、深色轨道，与全局 4px 细滚动条区分。
- `scrollbar-gutter: stable` 避免滚动条出现时文字跳动。

## 2026-11-08 — 清灵机制按原文重做

- 依据 cv15766200 原文 + 玩家 2026-11-08 裁定，重写 `sk_ql_1` ~ `sk_ql_5` 与血脉实现细节：
  - 微灵封体：净化含寄生/束缚、回血计入 maxHpBonus、印记按施放者已损；全局屏蔽维持。
  - 万念俱灰：威力基数改用技能自身 maxPp；后手回血取消 400 上限；`noPPRecover` 由 `gainPP` 统一拦截。
  - 封灵千噬：改为连续 3 回合，每回合结算伤害 + 每回合效果；末回合太虚联动改为「随机清空对方一个技能 PP + 清空太虚剩余 PP」。
  - 太虚灵威：新增 `ppLocked`（首次主动使用前不可被删 PP，用后解锁）。
  - 万古遗恨：改用回合总输出差绝对值结算治疗。
- 引擎：新增 `gainPP()`、`outputThisTurn/lastTurnOutput`、`doFixedDamage(source)`、`ppLocked` 支持。
- UI：技能栏改为横向一排（1→5 顺序，超宽可滚动）；局外技能排序箭头改为 ◀▶；优先度角标简化为 +N/−N。
- 文档：`pets/清灵.md` 全量重写并与实现逐条对齐；`pets/清灵.txt` 封灵千噬④按玩家修订并保留原句。
- 测试：静态检查 0 错 0 警；5 项定向探针通过（印记、回血、三回合、PP 锁定、输出差）。

## 2026-11-02 — 宠物文档集中到 pets/

- 新建 `pets/`：每宠一份 `<宠物名>.md`（机制文档）与 `<宠物名>.txt`（原文），同级放置；原文 HTML 存档移到 `pets/_source/`。
- `specs/` 只保留 `PET_TEMPLATE.md`、`PET-CREATION-FLOW.md`、`README.md`。
- 同步更新 `specs/README.md`、`PET-CREATION-FLOW.md`、`PLANNING.md`、`AGENTS.md` 的路径引用；四份 md/txt 的互相引用已校验存在。
- 历史 CHANGELOG 条目保留旧路径，不追溯修改。

## 2026-11-02 — 游戏内技能详情

- 战斗技能按钮右下角新增「i」：点击弹出完整技能机制（系别/分类/PP/先手/命中/威力 + 正文）。
- 局外技能更换列表同样加「i」入口，且不与「点击装备」冲突。
- 正文优先读 `skill.detail`（多行完整机制），缺失时回退 `skill.desc`；后续每改完一个技能就补 `detail`，保证「代码 = 文档 = 游戏内」三处一致。
- 本次仅搭 UI，未改任何技能机制。

## 2026-11-02 — 种族值替换为原文数据

- 清羽：`atk/spatk` 60 → **0**（原文物攻/魔攻种族值为 0，Lv100 能力值仍为 160）。
- 创世神钟：175/150/140/150/140/135 → **132/164/172/109/168/139**（原文 精力132·物攻164·物抗172·魔攻109·魔抗168·速度139）。
- 清灵、极影迪莫原数据已与原文一致，未改。
- `abilityToBase` 下限 1 → 0，避免编辑界面对 0 种族值向上夹成 1。
- 验证：Lv100 能力值 = 2×种族值 + 160，HP = 2×种族值 + 260（清灵 hp558 / 创世神钟 hp524）。

## 2026-11-02 — 抓取 B 站专栏原文入库

- 从 B 站专栏抓取 4 篇宠物原文（清灵 cv15766200 / 极影迪莫 cv15127825 / 清羽 cv15901261 / 创世神钟 cv15270027），作者 whisper_ed。
- 原文按「逐字」写入 `specs/raw/<宠物名>.txt`（仅 HTML→换行的排版还原），原始 HTML 存档于 `specs/raw/_source/`。
- `specs/README.md` 与四份机制 md 的原文状态更新为「已入库」。
- 原文与当前实现存在多处硬冲突（种族值、技能系别、机制时序），已在报告中列出，尚未改代码。

## 2026-11-02 — 规格文件改用中文名

- `specs/pet_*.md` → `specs/<宠物名>.md`；`specs/raw/pet_*.txt` → `specs/raw/<宠物名>.txt`。
- 同步更新 `specs/README.md`、`specs/PET-CREATION-FLOW.md`、`PLANNING.md` 的路径与命名约定；本文件旧条目保留原名（历史事实）。
- 文件名用中文，正文首行仍写 `id`（如 `pet_qingling`），检索与追溯不受影响。

## 2026-11-02 — 宠物文档体系（4 份原文 txt + 4 份机制 md）

- 新建 `specs/raw/pet_{qingling,jydm,qy,bmhs}.txt`：玩家原文占位骨架，含基础信息、血脉/技能文案、待补清单；明确标注「当前内容为代码 desc，不是原文」。
- 重写 `specs/pet_qingling.md`（保留旧规格 A1-A11 附录），新增 `pet_jydm.md` / `pet_qy.md` / `pet_bmhs.md`。
- 四份统一结构：基础信息 → 血脉（设计/实现/偏差）→ 技能总表 → 逐技能（设计·实现·偏差）→ 偏差汇总 → 验证清单 → 修订记录。
- 新建 `specs/README.md`：文件约定、覆盖表、修复机制时的操作顺序。
- 全篇标注「记录当前实现，非正确规格」；共登记 34 条偏差（清灵 6 / 极影迪莫 11 / 清羽 10 / 创世神钟 7），供后续逐条修复。
- 本次不改代码。

## 2026-11-01 — 启动页（logo 居中 → 点击进入）

- 新增 `renderIntro()` 启动屏：logo 居中、呼吸光晕、「点击进入」提示;点击/回车/空格进入主菜单。
- 过渡:启动层 `opacity + scale(1.05) + blur` 620ms 淡出,主菜单同时渲染,三个按钮按 100/180/260ms 依次上浮入场,形成交叉淡化;760ms 后移除启动层。
- 启动层挂在 `body`(而非 `#app`),避免 `showScreen` 清空 `#app` 时被立即销毁;期间设置按钮自动隐藏。
- 主菜单与启动页共用 `logoMarkSvg(suffix)`,渐变 id 加后缀避免两份 SVG 冲突。
- 验证:headless 截图确认启动页居中、点击后菜单入场;语法与静态检查通过。

## 2026-11-01 — 技能更换限定本宠 + 字体回退修正

- **局外技能更换只列本宠技能**:新增 `getOwnedSkillIds(pet)`(优先 `ownedSkillIds` → 内置 `DEFAULT_PETS.skillIds` → 当前 `skillIds`),技能池不再取 `getAllSkills()`;旧配置里混入的他人技能在打开时剔除。
- **顺带修掉两个既有缺陷**:点击装备/卸下无效(每次重渲染都从 `pet.skillIds` 重建,草稿丢失) → 引入 `swapDraft`;上下移按钮被重复绑定两次 → 合并为一处。
- **保存**:写入 `skillIds` 与 `ownedSkillIds`(锁定技能池),禁止保存 0 技能;新建/编辑自定义宠物时同样记录技能池。
- **字体未同步**:`--font-game-en` 末尾带有 generic `sans-serif`,generic 会截断回退链,导致继承 body 的元素(主菜单按钮等)永远轮不到 `--font-game-cn`;改为只写字体名。
- **验证**:`node test/static-checks.js` 0 错 0 警;语法检查通过;headless 复核按钮 `font-family` 已含所选中文体;技能列表 Q=5(仅 `sk_ql_*`)/ J=5(仅 `sk_jydm_*`),点击后"已装备 5→4→5→4"。

## 2026-10-26 — 引擎缺陷修复 + 前端视觉升级

**背景**:三份副本均无 `.git`,且 2026-10-22 由 Reasonix 复制入库;本会话在工作区副本 `C:\dsh work space\rocoremake` 重建 git 基线(`3c84b49`)。

### 修复(根因归类:引擎缺陷)

| # | 症状 | 根因 | 处理 |
|---|---|---|---|
| 1 | 双方 PP 耗尽后整局无法推进,只能逃跑 | `resolveTurn` 在双方无技能时直接 `endTurnCleanup()` | 新增 `makeStruggleSkill()` 兜底;战斗面板增加「挣扎」按钮(见 OPEN-QUESTIONS Q5) |
| 2 | 2 回合睡眠一次行动就醒 | `playerUseSkill` 与 `resolveTurn` 各扣一次 `statusTurns` | 状态推进收敛到 `resolveTurn` 单点 |
| 3 | 玩家被恐惧时 AI 整回合不出手 | fear 分支 `endTurnCleanup()` 且不调 AI | 删除该分支,统一走回合管线 |
| 4 | AI 的灭世之威永远走"先手"分支 | 用 `gameState.isPlayerTurn` 判先后手 | 改用 `pendingFirstMove` |
| 5 | 残念余梦一放,整局不能换宠 | `switchLocked` 只置位无解除 | 注册「残念锁足」,对方醒来即解锁(Q7) |
| 6 | onTick 内注册的回合效果消失 | `filter` 期间 push 到旧数组后被覆盖 | `processTurnEffects` 改为快照遍历 |
| 7 | 必爆技能穿透"禁止暴击";微灵封体封不住血脉减伤 | `guaranteedCrit` 未判 `preventCritNext`;`onBeforeDamage` 未判 `banEffects` | 两处均补齐约束 |
| 8 | 万念俱灰绕过统一的伤害出口 | 直接 `calcDamage` + `takeDamage` | 改走 `ctx.doDamage` 并新增 `maxDamage/minDamage` 选项 |
| 9 | 恐惧可覆盖烧伤/中毒 | `applyStatus/applyEffect` 对 fear 开了例外 | 主异常互斥包含 fear(Q6) |
| 10 | 天气少结算一回合 | `processWeather` 先减后判 | 新增 `tickEnvironments()`,回合末统一递减 |
| 11 | 未命中只扣 1 PP,与 `skillPPCostMult/extraPPCost` 不一致 | 三处 `skill.pp--` | 统一按完整 `ppCost` 结算 |
| 12 | 换宠回合新宠额外"挣扎" | 无技能兜底无法区分"换宠占用行动" | 新增 `gameState.skipPlayerAction` |

### 前端(视觉升级)

- 设计令牌重做:墨蓝底 + 香槟金 + 珊瑚红,统一圆角/阴影/描边层级。
- 主菜单:标题锁定版式、金色主 CTA、细金分隔线。
- 战斗:血条分段刻度、护盾条、状态徽章、六维胶囊、回合分隔日志行、技能按钮左侧系别色条与系别色悬浮描边。
- 技能图标**只使用所属系别图标**;曾短暂接入 `SKILL_ICONS` 按技能区分,经玩家指出后已回退并删除该表(技能栏同系技能图标一致)。
- 补齐迷雾天气的顶部图标(原先 `mist` 不在映射表,不显示)。
- 移动端紧凑化(520×960 内技能面板完整可见)、窄屏 `minmax(0,1fr)` 防溢出、`prefers-reduced-motion` 支持。

### 验证

- `node test/static-checks.js`:**0 错 0 警**(静态检查通过)。
- `vm.Script` 语法检查:通过。
- 16 场 1v1 回归矩阵(固定种子 20261026):14 场分出胜负、2 场 400 回合僵局、**0 场卡死**、0 运行时错误。
- 定点探针:挣扎推进 / 睡眠两回合 / 灭世之威后手删 PP / 换宠不挣扎 / 换宠锁解锁 / 恐惧不覆盖烧伤 / 迷雾计时 / onTick 续期,全部符合预期。
- Chrome headless 截图核验:520×960、1440×900 两套布局。

### 遗留

- 技能闭包普遍捕获施放时的 `target`,对方换宠后持续效果仍打在后台宠物身上(系统性问题,留待机制全面修复)。
- `immuneToPP/blockPPRecovery/noPPRecover` 仍被 20+ 处直接 `s.pp = ...` 绕过。
- 死字段:`superEffReduction` `fixedDmgHealPct` `rewindPPToMin` `sureDodge` `noPP` `qlSealMark`。
- AI 仍只看"威力 × 克制",变化技宠永远不出变化技。
- `window.onerror` 覆写 body、首启 `localStorage.clear()` 仍在,发行前需处理。
