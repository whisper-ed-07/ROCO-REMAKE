# CHANGELOG

> 每个会话结束追加:做了什么 / 验证了什么 / 留了什么坑。按 commit 对应。

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
- **接入已定义但未使用的 `SKILL_ICONS`**:20 个技能各有独立图标(原先全部回退到系别图标)。
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
