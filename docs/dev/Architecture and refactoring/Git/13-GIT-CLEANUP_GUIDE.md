# 13 Git 历史清理指南

## 场景说明
删除 Git 历史中不应提交的文件（如敏感信息、大文件、临时文件、node_modules 等）。

---

## 🎯 推荐工作流程（本地批量清理 → 一次性推送）

### 为什么推荐这个流程？

| 优势 | 说明 |
|------|------|
| ✅ 减少重复工作 | 每次 filter-repo 后 commit hash 会变，统一处理更高效 |
| ✅ 只触发一次部署 | 最终 push 只触发一次 CI/CD |
| ✅ 本地充分验证 | 没 push 前可随时从备份恢复 |
| ✅ 批量处理 | 多次 filter-repo 可使用 `--force` 连续执行 |

---

## 📋 完整清理步骤

### 阶段一：准备工作

```bash
# 1. 备份整个仓库（最重要！）
cp -r Researchopia Researchopia-backup

# 2. 安装 git-filter-repo（需要 Python）
pip install git-filter-repo

# 3. 进入仓库目录
cd Researchopia

# 4. 确认当前状态
git status
git log --oneline -5
```

### 阶段二：查找需要删除的文件

```bash
# 列出所有历史中存在过的文件
git log --all --full-history --name-only --pretty=format: | Sort-Object -Unique > "Debug\all-history-files.txt"

# 统计文件数量
wc -l all-history-files.txt

# 查看目录分布
gc "Debug\all-history-files.txt" | % { ($_ -split '/')[0] } | group | sort Count -Desc | select Count, Name

# 查找大文件
# 在 Git Bash 中运行（不是 PowerShell）
git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | sort -k3 -n -r | head -20
```

### 阶段三：批量删除（可执行多次）

```bash
# 第一次删除（例如删除 node_modules）
git filter-repo --path zotero-plugin/node_modules/ --invert-paths

# 第二次删除（需要 --force 标志）
git filter-repo --path zotero-plugin-backup/ --path archive/ --invert-paths --force

# 第三次删除（继续添加更多路径）
git filter-repo --path SYNC_SOLUTION.md --path test-xxx.js --invert-paths --force

# 删除匹配模式的文件
git filter-repo --path-glob '*.log' --invert-paths --force
git filter-repo --path-regex '^Debug/.*\.txt$' --invert-paths --force
```

### 阶段四：替换敏感内容（可选）

```bash
# 创建替换规则文件
cat > replacements.txt << EOF
sk-123456==>***REDACTED***
password123==>***PASSWORD***
regex:api_key=\w+==>api_key=***
EOF

# 执行替换
git filter-repo --replace-text replacements.txt --force
```

### 阶段五：验证清理结果

```bash
# 检查文件是否已从历史中删除
git log --all --full-history -- "zotero-plugin/node_modules/"
# 返回空 = 删除成功

# 重新统计历史文件数量
git log --all --full-history --name-only --pretty=format: | sort -u | wc -l

# 查看仓库大小变化
git count-objects -vH
```

### 阶段六：更新 .gitignore 并推送

```bash
# 更新 .gitignore（防止再次提交）
echo "node_modules/" >> .gitignore
echo "zotero-plugin/node_modules/" >> .gitignore
git add .gitignore
git commit -m "chore: update .gitignore after history cleanup"

# 一次性强制推送（覆盖远端历史）
git push origin --force --all
git push origin --force --tags
```

---

## 📖 常用命令速查

### 删除文件/目录

| 场景 | 命令 |
|------|------|
| 删除单个文件 | `git filter-repo --path .env.local --invert-paths` |
| 删除单个目录 | `git filter-repo --path node_modules/ --invert-paths` |
| 删除多个路径 | `git filter-repo --path path1/ --path path2/ --invert-paths` |
| 按模式删除 | `git filter-repo --path-glob '*.bak' --invert-paths` |
| 正则删除 | `git filter-repo --path-regex '^temp_.*' --invert-paths` |
| 二次执行 | 添加 `--force` 标志 |

### 查找历史文件

```bash
# 列出所有历史文件
git log --all --full-history --name-only --pretty=format: | sort -u > all-files.txt

# 搜索包含敏感关键词的 commit
git log -S "API_KEY" --all --oneline

# 查看某文件的历史版本
git log --all --full-history -- "路径/文件名"

# 显示文件的历史内容
git show <commit>:"路径/文件名"
```

---

## ⚠️ 注意事项

### 强制推送的影响

- 🔴 **其他协作者**需要重新 clone 仓库
- 🔴 **GitHub PR/Issue** 链接可能失效
- 🔴 **分支历史**会被完全重写

### 操作安全

```bash
# 操作前必须备份！
cp -r 项目目录 项目目录-backup

# 确保没有未提交的更改
git status
```

### --force 标志

- 第一次执行 `git filter-repo` 不需要 `--force`
- 第二次及以后执行**必须**添加 `--force`
- filter-repo 会检测仓库是否已被修改，需要 `--force` 覆盖保护

---

## 📊 本项目清理建议

基于对 Researchopia 仓库历史的分析：

| 优先级 | 类型 | 路径 | 文件数 |
|--------|------|------|--------|
| P0 | node_modules | `zotero-plugin/node_modules/` | ~15,440 |
| P1 | 备份目录 | `zotero-plugin-backup/` | ~317 |
| P2 | 归档目录 | `archive/` | ~83 |
| P3 | 临时文件 | 根目录 `*.md`, `*.bat`, `*.js` | ~100+ |

### 推荐清理命令

```bash
# 1. 先备份
cp -r Researchopia Researchopia-backup

# 2. 删除 node_modules（最大收益）
git filter-repo --path zotero-plugin/node_modules/ --invert-paths

# 3. 删除备份和归档目录
git filter-repo --path zotero-plugin-backup/ --path archive/ --invert-paths --force

# 4. 验证
git log --all --full-history --name-only --pretty=format: | sort -u | wc -l

# 5. 推送
git push origin --force --all
```

---

## 参考资源

- [git-filter-repo 官方文档](https://github.com/newren/git-filter-repo)
- [GitHub: 删除敏感数据](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)（另一个清理工具）
