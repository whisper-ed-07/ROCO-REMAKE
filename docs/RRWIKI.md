# RRWIKI 战斗百科维护目录

首批于 2026-11-27 核对，战斗基线为主副本 `d4f5bb1`。第二批以 `25920f9` 核对，游戏内扩充至 28 篇，分为战斗基础、伤害场地与资源及四只内置宠物。表中以条目 ID 对照实现，第三列跟踪需要继续复查的细分机制。核对依据为玩家最新裁定、宠物 TXT、机制 MD、实现和定向复现。发现差异时，按复现记录交主开发窗口处理。 [游戏内目录](../src/data/wiki.js) · [开发手册](../AGENTS.md) · [协作约定](../COLLAB.md) · [裁定登记](../OPEN-QUESTIONS.md) · [2026-11-25 玩家答复](../reviews/2026-11-24-pet-mechanics/玩家答复-2026-11-25.txt)

## 在开发者模式编辑条目

在主菜单选择「开发者·测试模式」，进入 RRWIKI 并打开要改的条目。点击「编辑条目」可改标题、摘要与小节，也可增删小节。小节正文用空行分段。完成后点「保存」，也可以点「取消」返回阅读。

保存会在当前浏览器和游戏路径下覆盖该条目。同一浏览器从同一路径打开游戏时，普通模式也会显示保存后的内容，其他环境可继续使用仓库内置条目。

本地覆盖供试读。正式发布仍按下方核对记录审查并更新内置条目。机制证据与玩家裁定分别记录在维护页与裁定登记中。 [内置条目源码](../src/data/wiki.js) · [裁定登记](../OPEN-QUESTIONS.md)

## 条目编写规范

用玩家在 Chrome 改写的「选招与技能的 PP」和「主动换宠」作样稿。两篇的标题、摘要、正文和换行已收录到内置战斗基础分类。 [样稿](../src/data/wiki.js)

- 摘要开头直接给规则。如果有数值，和适用动作一起写。比如先写换宠速度为 8，再写换宠先手时谁会接到对手出招。
- 小节标题写玩家在对战里会遇到的问题，或直接用技能名。「为什么有时扣了 PP 却没出招」这种问题接着就回答，省略背景铺垫。
- 正文先写条件，再写结果。一个段落讲清一项动作、判定或结算。效果、失败分支和场地例外分行写，回合数、阈值、目标、时点照实保留。
- 用「技能」「PP」「选招」「出招」「先手」「后手」「换上宠物」这类界面有对应的词。已经选定的技能、实际使出的技能、命中的技能分别说明。比较同先手时用真实速度能力值，也就是结算使用的有效速度。
- 简单规则讲一次即可。只有数字能解释算式或避免误判时再举例。样稿用独立的 `//` 行提醒梦境反转，这种写法只用于少数简短例外。
- 直接引用玩家 TXT 时保留原文的用字、标点和段落。证据、代码、复现和待裁定分支放维护页。遇到规则和实现有差异，先把已确认的当前行为讲清，再在维护页写明差异。

## 通用机制

| 条目 | 游戏内条目 ID | 行为与资料入口 |
| --- | --- | --- |
| 回合、行动和连招 | `turn-order`、`battle-flow`、`skill-continuations` | 先手、梦境、20 秒选招、空过、带出招式和清翎打断。末位资源僵局见 Q3。 [回合](../src/battle/turn.js) · [倒计时](../src/ui/turn-timer.js) · [核心回归](../test/core-regressions.js) |
| 主动换宠、驱逐与阵亡替补 | `switch-turn`、`switch-forced` | 主动换宠排序、束缚与换宠锁、驱逐免疫与随机选后备、阵亡补位和入场。替补效果递减见 Q9。 [回合](../src/battle/turn.js) · [换宠回归](../test/switch-turn-regressions.js) · [裁定登记](../OPEN-QUESTIONS.md) |
| PP 与技能可用性 | `pp-commit`、`pp-effects` | 预扣及取消、双损与三损、倍数、免删和禁回、逐格吸取、指定回复来源。强制清空、封存与回溯按专属条目追踪。 [回合](../src/battle/turn.js) · [战斗上下文](../src/battle/context.js) · [PP 日志](../test/developer-pp-log.js) |
| 威力、固伤与治疗 | `damage-and-critical`、`damage-protection`、`healing-and-inversion` | 攻防、暴击、固伤、防御结算次序、单段和回合累计限伤、治疗倍率与倒置。 [威力伤害](../src/battle/status.js) · [伤害与治疗](../src/battle/context.js) · [宠物状态](../src/battle/model.js) |
| 属系克制 | `element-matchups` | 本系加成、三种神系、无系、抵抗、克制与面板实际系。0 倍威力保底见本批边界。 [克制表](../src/data/elements.js) · [威力伤害](../src/battle/status.js) · [迪莫回归](../test/dimo-rulings.js) |
| 强化与命中 | `stat-stages`、`hit-and-dodge` | 七项等级、能力修正、面板命中、半必中、条件闪避。命中和闪避等级倍率见 Q8。 [能力等级](../src/battle/model.js) · [命中判定](../src/battle/turn.js) · [强化回归](../test/stat-stage-regressions.js) |
| 异常、净化与防控 | `status-immunity`、`abnormal-effects` | 互斥、净化、防控以及十项异常的精力、行动或换宠影响。 [异常](../src/battle/status.js) · [回合](../src/battle/turn.js) · [防控回归](../test/status-immunity-regressions.js) |
| 天气与环境 | `weather-and-field` | 暴晒、暴雨、沙暴、冰雹、迷雾、梦境与瞬华，含疾风与清翎的联动。疾风的召唤和独立效果见 Q11。 [场地](../src/battle/weather.js) · [召唤与锁定](../src/battle/context.js) · [场地名称](../src/data/elements.js) |

## 宠物血脉和技能

### 创世神钟

[玩家 TXT](../pets/创世神钟.txt) · [机制 MD](../pets/创世神钟.md) · [实现](../src/pets/clock.js) · [神钟回归](../test/clock-rulings.js)

| 条目 | 游戏内条目 ID | 要追踪的交互 |
| --- | --- | --- |
| 不灭魂体 | `clock-survival` | 固伤反转与逐段回复、威力伤害禁暴及次回合禁回 PP、克制减伤、超出精力的致死段、免删与驱逐失败。 |
| 创世之能 | `clock-creation`、`status-immunity` | 携带与零 PP 的防控范围、速度跟随原宠物、吸取跟随在场对手、同列最低双损、带出和打断、灭世之威提前结束。末段清空见复查。 |
| 逆流而行 | `clock-rewind` | 双方全队快照、当前精力上限、原始历史值计伤、回溯跳过本招 PP、失去属系、下一招终结与 Q10。 |
| 灭世之威 | `clock-creation` | 先后手、抵抗清 PP、创世转威力、空 PP 与低总 PP 的联动，先手固伤基准见本批边界。 |
| 覆体魂衣 | `clock-survival` | 80 点单段限伤、创世零 PP、净化与失强、场地额外回复、倒置与禁回 PP。 |
| 重衍纪元 | `clock-rewind` | 携带减输出、先后手与阵亡、24 回合全队最低 PP 快照、跳过逆流、Q1 与 Q12。 |

### 极影迪莫

[玩家 TXT](../pets/极影迪莫.txt) · [机制 MD](../pets/极影迪莫.md) · [实现](../src/pets/dimo.js) · [迪莫回归](../test/dimo-rulings.js)

| 条目 | 游戏内条目 ID | 要追踪的交互 |
| --- | --- | --- |
| 明念 | `dimo-mark` | 用招计数、降华快捷标记、重标加印、换宠结束标记、上限增益、追伤与专项防控。 |
| 极尽降华 | `dimo-mark` | 免删、删空即时被动、首轮外来全免、指定回 PP、全场变系与回复输出、限伤累计、原神系封技、场地锁。 |
| 化念作刃 | `dimo-screen` | 对手未出招、闪避与先后手、清印回首格、双损及翻倍、跨回合带出、驱逐免疫与固伤。 |
| 极影光幕 | `dimo-screen` | 半必中、一次致死闪避、叠盾与破盾、前后各三回合的连招计数与三损。 |
| 瞬华若霜 | `dimo-fields` | 冰冻成败、印记的多种 PP 分支、先手提速、后手锁梦境、追加冰冻成败与其他联动。 |
| 炽光若焰 | `dimo-fields` | 烧伤成功或失败、同格清空与禁回、瞬华召唤及被抵抗追加。 |

### 清灵

[玩家 TXT](../pets/清灵.txt) · [机制 MD](../pets/清灵.md) · [实现](../src/pets/qingling.js) · [清灵回归](../test/qingling-rulings.js)

| 条目 | 游戏内条目 ID | 要追踪的交互 |
| --- | --- | --- |
| 清念灵体 | `qingling-bloodline` | 队伍存亡计入减伤、同类实际用招的有效先手值入账、先后手删 PP、最高单段及后两回合倒置，变化技只回复威力技能 PP。 |
| 微灵封体 | `qingling-bloodline` | 全队防御封锁与固有效果例外、入场处理、威力免疫边界、六回合发放印记与离场中止。 |
| 万念俱灰 | `qingling-power` | 实际威力与首格边界、固定伤害、先手必暴、后手双方治疗、清 PP 遵守免删。 |
| 封灵千噬 | `qingling-power` | 首段必中与后手效果免疫、连续发动、额外耗 PP 与防控、跟随在场对手、次段物理伤害、末段联动太虚灵威。 |
| 太虚灵威 | `qingling-pressure` | 首次成功前免删、未命中路径、恐惧失败才加换宠锁、微灵高层斩杀。恐惧与主动换宠的界面差异见下方复查。 |
| 万古遗恨 | `qingling-pressure` | 迷雾成功与失败、实时万念威力、记录施放双方输出及下一回合治疗当时的对手。 |

### 清羽

[玩家 TXT](../pets/清羽.txt) · [机制 MD](../pets/清羽.md) · [实现](../src/pets/qingyu.js) · [清羽及交互回归](../test/regression-extras.js)

| 条目 | 游戏内条目 ID | 要追踪的交互 |
| --- | --- | --- |
| 清念、残脉与原初血脉 | `qingyu-forms` | 配招和首格启动形态、切换期、清风之念、低 PP 回满、残脉承伤回复与双向固伤、原初常驻减伤、上下场。 |
| 清翎覆尘 | `qingyu-wing-skills` | 清风层数、首次变系、反弹和净化、续用治疗倒置、疾风和梦境、指定 PP 回复与清念回满。 |
| 轻风散魂 | `qingyu-wing-skills` | 百分比删 PP 与先后手闪避、三段带出、实际翼系减少额外扣费、清风高层转形态、残脉 PP 封存。 |
| 残念余梦 | `qingyu-ice-skills` | 梦境、承伤与负面效果返还、先后手分支、原目标沉睡锁、限伤时四段、形态循环恢复 PP。 |
| 残风临霜 | `qingyu-ice-skills` | 冰冻、驱逐免疫与新目标普通睡眠、失败分段固伤、删 PP 条件、速度与护盾、转残脉。 |
| 清念沉脉 | `qingyu-forms` | 强化清除与治疗、锁定取样对象、清羽离场暂停和对手离场仍采样、结束取值与延后回复、永久削弱当前对手。 |

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

## 第二批核对记录

- 通用结算的定向探针核对了 200 点单段伤害先限为 80、减伤 25% 成 60、扣除 30 护盾后实损 30，以及治疗 100 倒置 30% 后净回复 40。另核对本系与暴击各乘 1.5、沙暴与冰雹掉血及免伤属系、寄生治疗转给当前对手。 [通用结算条目](../src/data/wiki-battle.js) · [伤害判定](../src/battle/status.js) · [承伤与治疗](../src/battle/model.js) · [天气](../src/battle/weather.js)
- 神钟回归和定向探针核对创世时期灭世使用 170 威力、临时物攻 +3 和 200 治疗。迪莫回归核对重标叠印、删空即时降华、原神系封技、三损与后手梦境。瞬华探针复核光系加速、先手治疗和抵抗追加。 [神钟与迪莫条目](../src/data/wiki-clock-dimo.js) · [神钟回归](../test/clock-rulings.js) · [迪莫回归](../test/dimo-rulings.js)
- 清灵回归覆盖微灵累积、按整回合最高单段倒置、封灵带出、万古遗恨换宠取样。清羽在核心和补充回归复核切换窗口、轻风与残念封存、清翎改系和打断、残念沉睡锁、沉脉取样及释放后削弱。万念俱灰后手治疗沿用灵5，当前无 TXT 所写 400 上限。清念翼系即时治疗对手一次，轻风散魂整招进入 100 命中分支，两点见清羽机制边界。 [清灵与清羽条目](../src/data/wiki-qing-pets.js) · [清灵回归](../test/qingling-rulings.js) · [核心回归](../test/core-regressions.js) · [补充回归](../test/regression-extras.js) · [清羽机制](../pets/清羽.md)

| 继续确认的边界 | 可复现的当前表现 |
| --- | --- |
| 克制表倍率为 0 时，普通威力段是否应保底 1 点？ | 用普通系威力招攻击幽灵系，克制表倍率为 0，威力公式仍返回 1。明确的威力免疫走独立入口，返回 0。 [属系表](../src/data/elements.js) · [威力判定](../src/battle/status.js) |
| 灭世之威的先手追加固伤按基础最大精力还是当前有效上限？ | 极影迪莫基础最大精力 548、明念提高上限后为 598。灭世先手固伤的计算值为 164，对应基础最大精力的 30% 向下取整。 [玩家 TXT](../pets/创世神钟.txt) · [技能结算](../src/pets/clock.js) |

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
