# COLLAB.md — 多 agent 协作白名单

> 玩家于 2026-11-26 指定本对话的 Codex 负责主副本。
> 本文件是文件级白名单与写入协议；与 AGENTS.md 冲突时以 AGENTS.md 为准。

## 1. 角色

| 角色 | 职责 |
|---|---|
| Codex | 主副本的引擎、界面、机制文档与验证 |
| 玩家 | 机制与设计歧义的唯一裁定者 |

## 2. 白名单（默认可写）

| 路径 | 写入门槛 |
|---|---|
| `src/` / `scripts/build.cjs` | 开发源码与构建入口，按任务范围修改 |
| `ROCO REMAKE.html` | 位于原路径，由 `node scripts/build.cjs` 生成并随源码提交 |
| `pets/<宠物名>.md` / `.txt` | 只改自己当前负责的宠物；原文 txt 不改措辞 |
| `CHANGELOG.md` | 只追加，不改他人条目 |
| `test/` | 可新增脚本；不改 harness 的对外接口 |
| `specs/` | 流程/模板变更需玩家确认 |
| `reviews/` | 既有审查与复现记录 |

## 3. 只读（改动需玩家确认）

- `AGENTS.md`
- `PLANNING.md`
- `OPEN-QUESTIONS.md`
- `COLLAB.md`

## 4. 禁止

- 覆盖、重置、回滚他人未提交的改动。
- `git add -A`、`git add .`、`git reset --hard`、`git checkout --`。
- 直接编辑 `ROCO REMAKE.html` 的生成内容。
- 把他人目录（如 `reviews/`）混入自己的提交。

## 5. 写入流程

1. `git log --oneline -1` + `git status` 确认基线。
2. 修改任务范围内的源码，运行 `node scripts/build.cjs` 生成游戏并自检。
3. 精确 `git add <文件1> <文件2>`。
4. 提交信息以 `[Codex]` 开头，后接中文动词。
5. `CHANGELOG.md` 追加一条：做了什么 / 验证了什么 / 遗留。

## 6. 冲突处理

- 发现同一文件有他人未提交改动：停手，在 `CHANGELOG.md` 或会话里说明，等对方提交后再继续。
- 发现 `git status` 出现来源不明的修改：先查明，不提交、不覆盖。
- 机制歧义：记入对应 `pets/<名>.md` 的「待确认」，问玩家，不擅自实现。

## 7. 白名单之外的目录

`work/`（历史草稿）、`pets/_source/`（原文存档）只读；`deploy.bat` 不再维护。
