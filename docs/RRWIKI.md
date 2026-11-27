# RRWIKI 战斗百科维护目录

首批于 2026-11-27 核对，战斗基线为主副本 `d4f5bb1`。游戏内首批共五篇，表中使用其条目 ID 对照实现。核对依据为玩家最新裁定、宠物 TXT、机制 MD、实现和定向复现。待核对条目已有资料入口，发布前逐项对照。发现差异时，按复现记录交主开发窗口处理。 [游戏内条目](../src/data/wiki.js) · [开发手册](../AGENTS.md) · [协作约定](../COLLAB.md) · [裁定登记](../OPEN-QUESTIONS.md) · [2026-11-25 玩家答复](../reviews/2026-11-24-pet-mechanics/玩家答复-2026-11-25.txt)

## 通用机制

| 条目 | 核对进度 | 需要覆盖的行为与资料入口 |
| --- | --- | --- |
| 回合与行动顺序 | `turn-order` 已核对普通场地与梦境的排序，其余待核对 | 记录行动、开场结算、先手值与有效速度、完全同值时的优先方、梦境、被动行动、回合结束与胜负。全空 PP 的空过已有断言，末位资源僵局见 Q3。 [回合](../src/battle/turn.js) · [补充回归](../test/regression-extras.js) |
| 主动换宠、驱逐与阵亡替补 | `switch-turn` 已核对主动换宠，驱逐与替补细节待核对 | 主动换宠如何排队和选目标、束缚与换宠锁、驱逐免疫与随机选后备、替补入场计时与入场血脉。 [回合](../src/battle/turn.js) · [换宠回归](../test/switch-turn-regressions.js) · [Q9](../OPEN-QUESTIONS.md) |
| PP 与技能可用性 | `pp-commit` 已核对预扣及取消，其余待核对 | 常规和额外扣费、双损与三损、免删和禁回、逐格吸取、指定回复来源、强制清空、封存与回溯、封技和实际用招统计。 [回合](../src/battle/turn.js) · [战斗上下文](../src/battle/context.js) · [PP 日志](../test/developer-pp-log.js) |
| 威力、固伤与治疗 | 待核对 | 物理与魔法计算、暴击、输出加成、威力免疫、护盾与减伤、单段与累计限伤、治疗倒置及其结算顺序、回溯与致死保护。 [威力伤害](../src/battle/status.js) · [伤害与治疗](../src/battle/context.js) · [宠物状态](../src/battle/model.js) |
| 属系克制 | 待核对 | 本系加成、三种神系、无系、相克与抵抗、免疫造成的威力数值、原系与实际系、四只宠物的系别及技能变系。 [克制表](../src/data/elements.js) · [威力伤害](../src/battle/status.js) · [迪莫回归](../test/dimo-rulings.js) |
| 强化与命中 | `stat-stages` 已核对等级与能力修正，免疫、倒置与命中类型仍待逐项核对 | 七项等级、增减与范围、负面强化免疫、强制清除和倒置、速度修正、必中与半必中。命中和闪避倍率尚待 Q8。 [能力等级](../src/battle/model.js) · [命中判定](../src/battle/turn.js) · [强化回归](../test/stat-stage-regressions.js) |
| 异常、净化与防控 | `status-immunity` 已核对互斥、寄生及防控来源，各状态效果待逐项核对 | 烧伤、冰冻、麻痹、睡眠、沉睡、恐惧、混乱、中毒、寄生、束缚。逐项补齐掉血或行动影响、回合数、唤醒、换宠、回溯和防控边界。 [异常](../src/battle/status.js) · [回合](../src/battle/turn.js) · [防控回归](../test/status-immunity-regressions.js) |
| 天气与环境 | 待核对 | 暴晒、暴雨、沙暴、冰雹、迷雾、疾风，以及梦境、瞬华。分别核对召唤和覆盖、锁定、持续期、掉血、伤害、行动顺序、治疗及技能联动。疾风见 Q11。 [场地](../src/battle/weather.js) · [召唤与锁定](../src/battle/context.js) · [场地名称](../src/data/elements.js) |

## 宠物血脉和技能

### 创世神钟

[玩家 TXT](../pets/创世神钟.txt) · [机制 MD](../pets/创世神钟.md) · [实现](../src/pets/clock.js) · [神钟回归](../test/clock-rulings.js)

| 条目 | 核对进度 | 要追踪的交互 |
| --- | --- | --- |
| 不灭魂体 | 待核对 | 固伤反转与逐段回复、威力伤害禁暴及次回合禁回 PP、克制减伤、超出精力的致死段、免删与驱逐失败。 |
| 创世之能 | 防控分支已核对，其余待核对 | 携带与零 PP 的防控范围、速度跟随原宠物、吸取跟随在场对手、同列最低双损、带出和打断、灭世之威提前结束。末段清空见复查。 |
| 逆流而行 | 待核对 | 双方全队快照、当前精力上限、原始历史值计伤、回溯跳过本招 PP、失去属系、下一招终结与 Q10。 |
| 灭世之威 | 待核对 | 先后手、抵抗清 PP、创世转威力、空 PP 与低总 PP 的联动。 |
| 覆体魂衣 | 防控到期与携带被动共存已核对，其余待核对 | 80 点单段限伤、创世零 PP、净化与失强、场地额外回复、倒置与禁回 PP。 |
| 重衍纪元 | 待核对 | 携带减输出、先后手与阵亡、24 回合全队最低 PP 快照、跳过逆流、Q1 与 Q12。 |

### 极影迪莫

[玩家 TXT](../pets/极影迪莫.txt) · [机制 MD](../pets/极影迪莫.md) · [实现](../src/pets/dimo.js) · [迪莫回归](../test/dimo-rulings.js)

| 条目 | 核对进度 | 要追踪的交互 |
| --- | --- | --- |
| 明念 | 与光幕防控各自到期已核对，其余待核对 | 用招计数、降华快捷标记、重标加印、换宠结束标记、上限增益、追伤与专项防控。 |
| 极尽降华 | 与光幕防控各自到期已核对，其余待核对 | 免删、删空即时被动、首轮外来全免、指定回 PP、全场变系与回复输出、限伤累计、原神系封技、场地锁。 |
| 化念作刃 | 连续发动被清翎打断后的防控已核对，其余待核对 | 对手未出招、闪避与先后手、清印回首格、双损及翻倍、跨回合带出、驱逐免疫与固伤。 |
| 极影光幕 | 防控刷新、保留与加速到期已核对，其余待核对 | 半必中、一次致死闪避、叠盾与破盾、前后各三回合的连招计数与三损。 |
| 瞬华若霜 | 待核对 | 冰冻成败、印记的多种 PP 分支、先手提速、后手锁梦境、追加冰冻成败与其他联动。 |
| 炽光若焰 | 待核对 | 烧伤成功或失败、同格清空与禁回、瞬华召唤及被抵抗追加。 |

### 清灵

[玩家 TXT](../pets/清灵.txt) · [机制 MD](../pets/清灵.md) · [实现](../src/pets/qingling.js) · [清灵回归](../test/qingling-rulings.js)

| 条目 | 核对进度 | 要追踪的交互 |
| --- | --- | --- |
| 清念灵体 | 待核对 | 队伍存亡计入减伤、同类实际用招的有效先手值入账、先后手删 PP、最高单段及后两回合倒置，变化技只回复威力技能 PP。 |
| 微灵封体 | 永久防控与短防控共存已核对，其余待核对 | 全队防御封锁与固有效果例外、入场处理、威力免疫边界、六回合发放印记与离场中止。 |
| 万念俱灰 | 其防控到期保留微灵封体已核对，其余待核对 | 实际威力与首格边界、固定伤害、先手必暴、后手双方治疗、清 PP 遵守免删。 |
| 封灵千噬 | 待核对 | 首段必中与后手效果免疫、连续发动、额外耗 PP 与防控、跟随在场对手、次段物理伤害、末段联动太虚灵威。 |
| 太虚灵威 | 恐惧与主动换宠的界面差异已复现，其余待核对 | 首次成功前免删、未命中路径、恐惧失败才加换宠锁、微灵高层斩杀。 |
| 万古遗恨 | 待核对 | 迷雾成功与失败、实时万念威力、记录施放双方输出及下一回合治疗当时的对手。 |

### 清羽

[玩家 TXT](../pets/清羽.txt) · [机制 MD](../pets/清羽.md) · [实现](../src/pets/qingyu.js) · [清羽及交互回归](../test/regression-extras.js)

| 条目 | 核对进度 | 要追踪的交互 |
| --- | --- | --- |
| 清念、残脉与原初血脉 | 防控、寄生净化与残脉叠时已核对，其余待核对 | 配招和首格启动形态、切换期、清风之念、低 PP 回满、残脉承伤回复与双向固伤、原初常驻减伤、上下场。 |
| 清翎覆尘 | 打断边界与防控共存已核对，其余待核对 | 清风层数、首次变系、反弹和净化、续用治疗倒置、疾风和梦境、指定 PP 回复与清念回满。 |
| 轻风散魂 | 待核对 | 百分比删 PP 与先后手闪避、三段带出、实际翼系减少额外扣费、清风高层转形态、残脉 PP 封存。 |
| 残念余梦 | 沉睡锁边界有定向回归，其余待核对 | 梦境、承伤与负面效果返还、先后手分支、原目标沉睡锁、限伤时四段、形态循环恢复 PP。 |
| 残风临霜 | 与防控的冰冻分支已核对，其余待核对 | 冰冻、驱逐免疫与新目标普通睡眠、失败分段固伤、删 PP 条件、速度与护盾、转残脉。 |
| 清念沉脉 | 待核对 | 强化清除与治疗、锁定取样对象、清羽离场暂停和对手离场仍采样、结束取值与延后回复、永久削弱当前对手。 |

### 跨宠物交互

| 交互 | 核对进度 | 证据入口 |
| --- | --- | --- |
| 清翎覆尘与轻风散魂、封灵千噬、化念作刃、创世之能、极影光幕、清念沉脉和微灵封体 | 核对了按实际用招带出的段数、打断对象、仍按自身计时的效果。光幕加速到期复测通过。 | [玩家最新裁定](../OPEN-QUESTIONS.md) · [清羽](../pets/清羽.md) · [核心回归](../test/core-regressions.js) · [防控回归](../test/status-immunity-regressions.js) |
| 残风临霜遇到迪莫防控、残脉反弹或神钟致死保护 | 已核对光幕防控覆盖冰冻及反弹回施；驱逐、保命和新入场者的其他组合待核对。 | [防控回归](../test/status-immunity-regressions.js) · [换宠回归](../test/switch-turn-regressions.js) · [清羽补充回归](../test/regression-extras.js) |
| 清灵的免疫和封锁遇到神钟回溯、清羽原初减伤 | 待核对威力免疫与逆流终结、已有临时防御与固有能力是否保留，以及前后手保护下的目标改写。 | [交互复查](../reviews/2026-11-25-mechanic-interactions/README.md) · [清灵回归](../test/qingling-rulings.js) |
| 降华与属系改写、场地、沉脉 | 待核对原系封技、光系覆盖、清翎主系转换、命中和未命中时的永久削弱、场地召唤计数。 | [极影迪莫](../pets/极影迪莫.md) · [清羽](../pets/清羽.md) · [迪莫回归](../test/dimo-rulings.js) |
| 跨回合目标追踪 | 待核对万古的输出记录及治疗目标、沉脉锁定 PP 对象及削弱目标、创世换宠后速度与吸取对象、明念离场终止。 | [回合](../src/battle/turn.js) · [核心回归](../test/core-regressions.js) · [清灵回归](../test/qingling-rulings.js) |
| 清羽和清灵的治疗倒置遇到降华回复加成、神钟固伤反转或互相倒置 | 待核对来源适用范围、实际生效比例、最高单段、净治疗、血脉被动与来源重叠。 | [战斗上下文](../src/battle/context.js) · [宠物状态](../src/battle/model.js) · [PP 日志回归](../test/developer-pp-log.js) |

## 首批核对记录

### 选招预扣 PP

- 开发手册及既有变更明确预扣。玩家选招时扣，AI 在该回合行动开始前预扣。PP 大于 0 且该招未被封禁就可提交。若应扣超过剩余值，扣到 0，已付费的行动仍可执行。 [开发手册](../AGENTS.md) · [战斗回合](../src/battle/turn.js) · [变更记录](../CHANGELOG.md)
- 真正出手前仍核对使用者与目标在场、存活、控制和技能封禁。先手将后手技能剩余 PP 删至零，后手仍可出原招。先手睡眠或驱逐取消后手行动，已付费用保留。一次未命中的行动也只支付一次。 [核心回归](../test/core-regressions.js) · [测试模式 PP 日志](../test/developer-pp-log.js)
- 核对用例覆盖开场前双方实扣、已经排定的旧动作没有重新收费、应扣与实扣不同、倍率在提交时决定，以及用完最后 1 PP 仍留下待执行的技能。 [核心回归](../test/core-regressions.js) · [测试模式 PP 日志](../test/developer-pp-log.js)

### 主动换宠基础先手值 8

- 主动换宠占用本回合行动，换宠方保留技能 PP，对手选招按普通规则扣费。换宠固定 8，对手技能带入有效先手值。同值比较换下前宠物的有效速度。梦境反转比较方向。 [开发手册](../AGENTS.md) · [回合排序与换宠执行](../src/battle/turn.js)
- 普通场地中，先手值 9 的对手技能先打旧宠，先手值 7 的对手技能打新宠。换宠若先完成，进场效果先结算。两者同为 8 时，旧宠速度较高可先换，较低时由旧宠先挨打。梦境探针中，换宠 8 先于技能 9 结算。 [换宠回归](../test/switch-turn-regressions.js)
- 先行动的对手击倒旧宠时，主动换宠取消，由阵亡流程安排替补。若先手施加换宠锁，则已提交的换宠也会被拦截。引擎按束缚和换宠锁判断主动换宠，控制异常与界面的差异见下文。 [换宠回归](../test/switch-turn-regressions.js) · [操作栏](../src/ui/battle.js)

### 异常、防控与寄生

- 共3 要求按官方共存规则处理。Q6 已登记游戏采用的两组互斥和独立束缚。烧伤、冰冻、麻痹、睡眠、沉睡、恐惧、混乱为一组，中毒与寄生为另一组。成功新施加的同组异常覆盖旧种类，跨组可共存，束缚可同时存在。重新施加同一种已存在的异常保持原计时，技能仍按施加成功处理。免疫先于互斥判定，被免疫的尝试保留原异常。 [玩家答复](../reviews/2026-11-24-pet-mechanics/玩家答复-2026-11-25.txt) · [Q6](../OPEN-QUESTIONS.md) · [异常回归](../test/status-immunity-regressions.js)
- 通用净化可移除已生效寄生，通用防控可阻止新寄生。只免疫列出的特定异常时，寄生仍可生效。依据技能或血脉的具体范围判断束缚。神钟携带创世之能时只防束缚、恐惧、睡眠和冰冻，该招 PP 为 0 即扩展至包括寄生在内的所有异常，PP 恢复立即收窄。 [状态管理](../src/battle/status.js) · [创世神钟](../pets/创世神钟.md) · [防控回归](../test/status-immunity-regressions.js)
- 极影光幕与降华、明念各自管理防控。微灵封体的永久防控保留至万念的短期防控结束后。清翎打断化念时，极影光幕的防控和速度仍按时到期。睡眠可被威力招命中唤醒，沉睡继续，残念余梦追踪原目标同一次沉睡，换下仍锁，解除该次沉睡或阵亡才解锁。 [防控回归](../test/status-immunity-regressions.js) · [补充回归](../test/regression-extras.js) · [Q7](../OPEN-QUESTIONS.md)

### 实际先手值与梦境

- 基础先手值为 8 加面板偏移。回合排序将迷雾的幽灵系加速、梦境中的清翎覆尘条款和沉脉永久削弱用于实际值。迪8 确认梦境反转排序方向，代码也反转了同先手时的速度比较。 [玩家答复](../reviews/2026-11-24-pet-mechanics/玩家答复-2026-11-25.txt) · [回合排序](../src/battle/turn.js) · [清翎覆尘机制](../pets/清羽.md)
- 用现有 Node 引擎夹具创建会记录实际发动顺序的两招。双方先手值同为 8、有效速度同为 200 时，普通场地和梦境均由玩家先动。速度为玩家 200 对对手 220 时，普通场地对手先动，梦境玩家先动。速度保持该差距、先手值变为玩家 9 对对手 7 时，普通场地玩家先动，梦境对手先动。六种结果均有「先行动」日志。 [引擎夹具](../test/lib/harness.js) · [同先手速度回归](../test/stat-stage-regressions.js) · [换宠排序回归](../test/switch-turn-regressions.js)

### 七项强化与当前命中判定

- 七项强化从零开始，每项范围为 −6 至 +6，物攻、物防、魔攻、魔防和速度的等级用于能力值修正。速度为 200 时，用战斗上下文提升速度 1 级，实际速度为 300。回归覆盖命中、闪避的增减、回溯、负面强化免疫及清念沉脉统计。 [能力值](../src/battle/model.js) · [强化回归](../test/stat-stage-regressions.js)
- Q8 仍缺概率公式。用现有 Node 引擎夹具施放普通 70% 命中技能，把双方等级分别设为命中 +6 对闪避 −6、命中 −6 对闪避 +6。两组固定抽样 0.69 时均命中，0.71 时均未命中。当前普通概率分支使用技能面板，技能特判另有入口。 [裁定登记](../OPEN-QUESTIONS.md) · [引擎夹具](../test/lib/harness.js) · [命中判定](../src/battle/turn.js)

### 验证命令

| 命令 | 结果 |
| --- | --- |
| `node test/core-regressions.js` | 42 项通过，覆盖预扣、控制阻断、连续技能和清翎打断。 |
| `node test/switch-turn-regressions.js` | 9 项通过，覆盖先手值 7／8／9、有效速度平局规则、梦境、主动换宠取消和驱逐。 |
| `node test/status-immunity-regressions.js` | 23 项通过，覆盖寄生净化、免疫、互斥、显示及各来源到期。 |
| `node test/developer-pp-log.js` | 10 项通过，覆盖冰冻前预扣和 PP 实付来源。 |
| `node test/regression-extras.js` | 29 项通过，覆盖全空 PP、睡眠与沉睡、残念换宠锁、双损和三损等交互。 |
| `node test/stat-stage-regressions.js` | 6 项通过，覆盖七项等级和同先手时的有效速度。 |
| `node reviews/2026-11-25-random-team-battles/probes.js` | 复现 Q9，回合末替补的限伤、减伤和治疗倒置各从 3 变 2。光幕加速回到 1。创世之能归档用例后两回合均空过，需用下文步骤带出末段。 |
| `node reviews/2026-11-25-mechanic-interactions/probes.js` | 复现恐惧界面与引擎换宠权限不一致、逆流历史精力差值偏差，以及双方末位 PP 全空后空过到 40 回合仍继续。 |

## 复查差异与交接

### 交主开发窗口

| 差异 | 设计依据 | 当前表现及复现 |
| --- | --- | --- |
| 控制异常隐藏主动换宠 | 太虚灵威原文把换宠限制放在恐惧失败分支。按原文与引擎，恐惧成功本身应允许主动换宠。主动换宠引擎以束缚、换宠锁为阻断条件。 [玩家 TXT](../pets/清灵.txt) · [换宠结算](../src/battle/turn.js) | 有可用招时界面隐藏换宠并在 800 毫秒后空过，技能 PP 为 0 则展示换宠。直接走引擎的主动换宠入口，两种 PP 均可换下。恐惧、睡眠、沉睡、冰冻都复现同样分支。 [操作栏](../src/ui/battle.js) · [长局探针](../reviews/2026-11-25-mechanic-interactions/probes.js) |
| 创世之能末段无条件清空本招 | 原文将回复精力和清空本招一起放在精力低于 30% 的条件内。 [玩家 TXT](../pets/创世神钟.txt) | 用随机归档探针导出的 `battle` 建立神钟（创世之能、覆体魂衣）对清羽（残念余梦），对手始终空过。按技能格提交 `round(0)`、`round(1)`、`round(1)`。神钟连续三个回合精力为 524、446、380／524，创世 PP 为 2、2、0。结算仅用 30% 限制回复精力。把后两轮改为空过，PP 保持 2，续段未发动。 [探针夹具](../reviews/2026-11-25-random-team-battles/probes.js) · [末段结算](../src/battle/effects.js) |
| 逆流而行用未截断精力计算固伤 | 原文写「（回溯前后双方精力差值）」。 [玩家 TXT](../pets/创世神钟.txt) | 迪莫带明念记录 598 精力快照，标记结束后当前上限和实际精力均为 548。回溯前后实际精力均为 548，回溯函数仍返回差值 50。 [长局探针](../reviews/2026-11-25-mechanic-interactions/probes.js) · [回溯实现](../src/battle/context.js) |

#### 控制异常换宠复现

从主副本根目录在 PowerShell 执行以下探针。我方前排是携带瞬华若霜的极影迪莫，后备为携带残风临霜的清羽，对手为携带太虚灵威的清灵。探针记录界面是否排定自动空过、换宠按钮是否可用，以及直接提交换宠是否成功。 [战斗夹具](../reviews/2026-11-25-random-team-battles/probes.js) · [DOM 夹具](../test/lib/harness.js)

```powershell
@'
const assert = require('node:assert/strict');
const { battle } = require('./reviews/2026-11-25-random-team-battles/probes.js');
const { makeEl } = require('./test/lib/harness');
for (const status of ['fear', 'sleep', 'deep_sleep', 'freeze']) {
  for (const pp of [1, 0]) {
    const { api, engine, state, renderActions } = battle(
      [['pet_jydm', ['sk_jydm_4']], ['pet_qy', ['sk_qy_4']]],
      [['pet_qingling', ['sk_ql_4']]]
    );
    const player = state.playerActive;
    assert(api.createBattleContext().applyStatus(player, status, { turns: 2 }));
    player.skills[0].pp = pp;
    const view = makeEl();
    const query = engine.document.querySelector;
    engine.document.querySelector = selector => selector === '#battle-actions' ? view : query(selector);
    renderActions();
    const autoPass = view.innerHTML.includes('\u81ea\u52a8\u8df3\u8fc7');
    const utility = view.children.find(node => node.className === 'battle-utility-list');
    const switchButton = (utility?.children || []).some(button =>
      button.textContent.includes('\u6362\u5ba0') && !button.disabled);
    engine.aiDecideAndResolve = () => {
      state.pendingAISkill = -1;
      engine.resolveTurn();
    };
    engine.playerSwitch(1);
    const engineSwitched = state.playerActive === state.playerParty[1];
    assert.deepEqual([autoPass, switchButton, engineSwitched], [pp > 0, pp === 0, true]);
    console.log(status, pp, autoPass, switchButton, engineSwitched);
  }
}
'@ | node
```

| 异常 | 1 PP 的输出 | 0 PP 的输出 |
| --- | --- | --- |
| 恐惧 | `fear 1 true false true` | `fear 0 false true true` |
| 睡眠 | `sleep 1 true false true` | `sleep 0 false true true` |
| 沉睡 | `deep_sleep 1 true false true` | `deep_sleep 0 false true true` |
| 冰冻 | `freeze 1 true false true` | `freeze 0 false true true` |

### 交玩家裁定或复测

| 编号 | 回报给主开发窗口的问题与当前证据 |
| --- | --- |
| Q1 | 何时恢复重衍纪元的先手未受伤全队回 2 PP 分支？恢复时「未受伤」是否包含该回合施放前的天气、异常和被动伤害？当前仍是先手回溯后存活、后手回溯后阵亡。 [玩家 TXT](../pets/创世神钟.txt) · [神钟技能](../src/pets/clock.js) |
| Q2 | 现行明念与降华是否在多宠／Little Roco 对战中仍形成无法消耗的回复循环？先记录镜像的回合数和 PP 变化，再决定是否提数值裁定。固定单招镜像归档探针在第 60 回合仍未结束。 [长局探针](../reviews/2026-11-25-mechanic-interactions/probes.js) · [单机 AI](../src/battle/ai.js) |
| Q3 | 双方只剩末位且均无 PP、无可回 PP 或致死的后续效果时，是继续、平局还是按指定条件结束？双方空过 40 回合后局面未变。另有定向断言覆盖 150 回合仍未自动判负。 [长局探针](../reviews/2026-11-25-mechanic-interactions/probes.js) · [补充回归](../test/regression-extras.js) |
| Q8 | 命中与闪避从 −6 到 +6 各级的倍率是什么，双方等级如何合并，普通面板 100% 如何受修正？当前有等级变化，技能命中判定使用技能面板和技能特判。 [强化回归](../test/stat-stage-regressions.js) · [命中判定](../src/battle/turn.js) |
| Q9 | 回合末入场的替补是否消耗自身原有的一回合限伤、减伤或治疗倒置？主动换宠是否同样消耗，或按入场后实际在场的结算窗口决定？已有三类效果各 3 回合的替补在回合末上场后同时变成 2。 [替补探针](../reviews/2026-11-25-random-team-battles/probes.js) · [场地与效果计时](../src/battle/weather.js) |
| Q10 | 逆流终结以实际出招、威力招通过命中判定、还是造成正数威力伤害为门槛？当前基础威力大于零且通过命中判定便可触发，即使威力伤害被免疫。 [结算](../src/battle/turn.js) · [交互复查](../reviews/2026-11-25-mechanic-interactions/README.md) |
| Q11 | 哪些技能召唤疾风？默认几回合，除了改变清翎覆尘的倒置比例和持续期，还触发哪些效果？相关回归通过手动设定疾风来覆盖分支。 [清羽机制](../pets/清羽.md) · [补充回归](../test/regression-extras.js) |
| Q12 | 最近 24 回合全队 PP 总量最低的快照并列时，取哪一个回合？当前取时间最早的一份。 [PP 回溯](../src/battle/context.js) |
| 控制与主动换宠 | 恐惧按太虚灵威原文和现有换宠结算应放行。睡眠、沉睡、冰冻是否也应允许主动换宠？若某项应禁换，是否同时覆盖仍有可用招和全空 PP 两种情况？ [上文复现](#控制异常换宠复现) |

待核对范围从通用目录和四宠列表继续推进。将新增复现与裁定填回对应条目，再更新游戏内说明。 [裁定登记](../OPEN-QUESTIONS.md)
