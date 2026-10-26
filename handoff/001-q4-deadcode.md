# HANDOFF 任务交接包 001-q4-deadcode

## 基本信息

- 任务编号:`001-q4-deadcode`
- 创建日期:2026-09-10
- 方案状态:已通过规划窗验证(静态检查 `node test/static-checks.js` 首跑发现)
- 关联文档:`AGENTS.md` §12、`OPEN-QUESTIONS.md` Q4

## 任务目标

删除 `executeSkillTurn` 中针对**已不存在技能** `sk_fire_2` / `sk_drag_4` 的硬编码特判(死代码)。

## 具体改动

1. 在 `ROCO REMAKE.html` 中搜索 `sk_fire_2` 与 `sk_drag_4`。
2. 在 `executeSkillTurn` 函数内找到以下两行(legacy 分支,`calcDamage` 调用之后):

```js
    if (skill.id === "sk_fire_2") { user.takeDamage(Math.floor(result.damage / 3)); addMessage(user.name + " 受到了反伤！"); }
    if (skill.id === "sk_drag_4") { applyEffect(user, "confuse"); addMessage(user.name + " 陷入了混乱！"); }
```

3. **只删除这两行**,不修改任何其他代码。
4. 背景:这两个技能已不在 `DEFAULT_SKILLS` 中;残留特判是死代码,且将来若新建技能复用同名 id 会意外触发。本次只做删除,不做数据驱动改造(见 OPEN-QUESTIONS Q4 建议项,另行决定)。

## 验收标准(DoD,全过才算完成)

- [ ] 1. `node test/static-checks.js` 运行后**错误 0 条**(执行前会报 `sk_fire_2`、`sk_drag_4` 两条 FAIL,执行后应消失)
- [ ] 2. JS 语法检查通过(提取 `<script>` 内容后 `node --check`)
- [ ] 3. 全局搜索确认 `sk_fire_2` 与 `sk_drag_4` 已无任何引用(不含 specs/ 与 handoff/ 中的文字)

## 约束

- 只删本包列出的两行,范围外不要动
- 提交信息格式:`[001-q4-deadcode] 删除 sk_fire_2/sk_drag_4 死代码特判`
- 本地提交,不推送
- 不确定就停,标 `[疑问]` 回交规划窗

## 执行回执(执行窗完成后填写)

- 实际改动:`ROCO REMAKE.html` `executeSkillTurn` 内删除 `sk_fire_2`(反伤自身)、`sk_drag_4`(自身混乱)两行 legacy 特判(`calcDamage` 调用之后),共 -2 行,未改动任何其他代码(`git diff --stat`: 1 file changed, 2 deletions(-))。
- 自检结果(逐条对照验收标准):
  - [x] 1. `node test/static-checks.js`:执行前报 2 条 FAIL(`sk_fire_2`/`sk_drag_4`),执行后 **错误 0 条、警告 0 条,结论"静态检查通过"**(检查项通过 20)。
  - [x] 2. JS 语法检查通过:`<script>` 区(524-2911 行)经只读管线 `tail -n +525 "ROCO REMAKE.html" | head -n 2385 | node --check -` 无报错。
  - [x] 3. 全局搜索确认:`ROCO REMAKE.html` 与 `test/` 中 `sk_fire_2`/`sk_drag_4` **零引用**。剩余提及均为非代码引用,不构成残留:`OPEN-QUESTIONS.md`(Q4 问题描述文字)、`specs/`、`handoff/`(本包文字)、`work/*.html`(未被 git 跟踪的历史草稿,`.gitignore` 忽略、不维护)。
- 遗留问题 / 疑问:无。Q4 建议的数据驱动改造(战斗事件走数据而非硬编码 id)未做,按包约束留待另行决定。
- 提交 hash:`2f6faa3`（`[001-q4-deadcode] 删除 sk_fire_2/sk_drag_4 死代码特判`，含本回执；其后另有一次仅更新本字段的元数据提交）
