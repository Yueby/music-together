---
name: git-branch-pr-flow
description: "Git 一条龙工作流：创建分支、commit、push、创建 PR、merge、删除分支、同步本地 main。当用户要求提交代码、创建 PR、一条龙、或完整的 Git 提交流程时使用。"
---

# Git 分支 PR 一条龙

从当前变更出发，一步到位完成：分支 → commit → push → PR → merge → 清理。

## 工作流

### 1. 预检

```bash
git status
git diff --stat
git log --oneline -5
```

- 确认当前在 `main` 分支
- 如果不在 main，先 `git checkout main && git pull`
- 审查所有变更，理解变更范围

### 2. 创建分支

分支命名规范：`<type>/<short-description>`

| type | 场景 |
|------|------|
| feat | 新功能 |
| fix | 修复 |
| refactor | 重构 |
| docs | 文档 |
| chore | 杂项 |

```bash
git checkout -b <type>/<short-description>
```

### 3. Stage & Commit

```bash
git add -A
# 排除不应提交的文件（如有）
git reset HEAD .cursor/plans/ 2>$null
```

Commit message 规范：
- 标题行：`<type>: <简要描述>`
- 如果变更复杂，用正文按模块分段说明
- **PowerShell 环境**：用 `-F` 读取文件方式传递多行 message，避免 heredoc 兼容问题

```bash
# 写入临时 message 文件
# Write tool → .git/COMMIT_MSG
git commit -F .git/COMMIT_MSG
```

单行 message 可直接用 `-m`：

```bash
git commit -m "<type>: <描述>"
```

### 4. Push

```bash
git push -u origin HEAD
```

### 5. 创建 PR

```bash
gh pr create --title "<commit 标题>" --body "<变更摘要>"
```

PR body 包含：
- **Summary**：核心变更要点（bullet list）
- **Changes**：文件统计、关键新增/修改

### 6. Merge & 清理

```bash
gh pr merge <pr-number> --merge --delete-branch
```

等待命令完成后，同步本地：

```bash
git checkout main && git pull
```

清理临时文件：

```bash
# 删除 commit message 临时文件（如果使用了 -F 方式）
Remove-Item .git/COMMIT_MSG -ErrorAction SilentlyContinue
```

确认本地只剩干净的 `main` 分支。

## 注意事项

- 不要提交 `.cursor/plans/`、`.env` 等敏感/IDE 文件
- 如果 `git commit` 在 PowerShell 下 spawn 失败，改用 `-F` 文件方式
- merge 后确认 GitHub Actions 等 CI 是否被触发
- 如果用户只想提交不想 merge，在创建 PR 后停止并告知用户 PR 地址
