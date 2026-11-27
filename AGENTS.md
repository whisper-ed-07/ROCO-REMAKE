# ROCO REMAKE 开发手册

主副本为 `C:/dsh work space/rocoremake`。执行项目命令时指定该工作目录。开工先查看 `git status --short --branch` 和 `git log -1 --oneline`，机制任务再读对应的 `pets/<宠物名>.txt`、`.md` 和[裁定登记](OPEN-QUESTIONS.md)。旧副本留档。并行工作按[协作约定](COLLAB.md)分工。

## 代码与构建

- [README](README.md) 列出源码分区和运行方法。开发修改 `src/`。根目录 `ROCO REMAKE.html` 是生成的 HTML 入口，按构建清单加载独立的经典脚本与 CSS。维持 `file:` 双击启动、脚本依赖顺序和存档路径。
- `node scripts/build.cjs` 生成入口与 `src/data/pet-text.generated.js`。`--check` 检查两者是否最新，`--standalone` 单独导出 `dist/ROCO REMAKE.html`。
- 内置宠物和技能写在 `src/pets/`，由 `src/data/catalog.js` 注册。ID 使用 `pet_` 和 `sk_` 前缀。开局从技能配置创建独立 PP。技能池可超过四招，每只宠物最多装备四招。
- 内置技能详情优先用构建提取的玩家 TXT 正文。`desc` 作摘要，`detail` 提供备用说明。机制变动同步宠物 MD。保留玩家 TXT 的原句、标点和段落，仅按玩家授权更新原文。新增宠物见[流程](specs/PET-CREATION-FLOW.md)和[模板](specs/PET_TEMPLATE.md)。

## 战斗规则入口

- 选招预扣 PP，后续删 PP 至零不取消已付费动作。执行时仍核对在场者、控制和技能封禁。主动换宠是基础先手值 8 的动作，成功先换时对手攻击新上场宠物。无可用招时可空过，正式对战无固定回合上限。
- 回合流程见 `src/battle/turn.js`。记录动作及先手值后处理回合开始效果，再按先手值和有效速度决定双方行动顺序。基础先手值为 8 加面板偏移，梦境反转比较方向。行动后处理延迟效果、致死保护、阵亡换入和场地递减。
- 技能的伤害、治疗、删 PP、防控和状态经战斗上下文处理。常规删 PP 用 `ctx.deletePP`，回复用 `gainPP`，历史回溯和强制清空有独立入口。PP 变化应保留技能、来源和实际改变量。
- 通用防控由 `src/battle/status.js` 按来源管理，覆盖寄生、沉睡等异常。只免疫指定异常的被动保持各自范围。强化仅有物攻、物防、魔攻、魔防、速度、命中、闪避。后两项的等级尚未接入概率。
- 行动、伤害和换宠先完成结算，再通过 `src/battle/presentation.js` 通知界面。动画回调仅负责呈现。持续效果如应跟随当前对手，结算时重新取在场目标。

## 验证与交付

1. 机制歧义、缺数值或规则冲突集中请玩家裁定。可先处理已确定的部分。登记尚未确认的口径和已知偏差。
2. 核对原文、机制 MD、代码与定向断言。检查 `node scripts/build.cjs --check` 和 `node test/static-checks.js`，战斗改动再运行 `node test/battle-matrix.js`。达到测试回合上限与引擎卡死分别记录。
3. 构建、路径或存档改动运行 `node test/settings-menu.js --file-replacement`。涉及分享版时加 `--standalone`，并先导出该版本。
4. 在[变更记录](CHANGELOG.md)写明改动、验证和遗留，确认暂存范围后本地提交。推送须经玩家授权。文档更改使用 UTF-8，检查本地链接及 `git diff --check`。
