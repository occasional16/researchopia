# 版本管理指南

项目包含三个独立发布的组件，每个组件有自己的版本号和发布流程。

---

## 版本号格式

采用语义化版本 `MAJOR.MINOR.PATCH`：

- **PATCH**（如 0.8.3 → 0.8.4）：修复 Bug
- **MINOR**（如 0.8.4 → 0.9.0）：新增功能
- **MAJOR**（如 0.9.0 → 1.0.0）：重大/不兼容变更

---

## 组件版本位置

| 组件 | 版本文件 | 发布方式 |
|------|---------|---------|
| 网站 | `package.json` | Cloudflare 自动部署 + GitHub Release |
| Zotero 插件 | `zotero-plugin/package.json` | GitHub Actions 自动发布 |
| 浏览器扩展 | `extension/package.json` + `extension/manifest.json` | GitHub Actions + Chrome Web Store |

---

## 前置准备（首次发布前完成一次）

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中添加：

| Secret 名称 | 说明 |
|-------------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密钥 |

> `GITHUB_TOKEN` 由 GitHub 自动提供，无需手动配置。

---

## 发布 Zotero 插件

推送 `zotero-plugin/v*` 格式的 tag 后，GitHub Actions 会自动构建 XPI 并创建 Release。

```bash
# ① 确保在 main 分支且代码已测试通过
git checkout main
git pull

# ② 进入插件目录，更新版本号
cd zotero-plugin
npm version patch --no-git-tag-version
#   patch = 修 bug, minor = 新功能, major = 重大变更
#   此命令会自动修改 package.json 和 package-lock.json

# ③ 回到根目录
cd ..

# ④ 推送前本地检查（与 CI 一致，全部通过后再继续）
npm run lint
npm run build
npm run test
cd zotero-plugin && npm run build && npm test && cd ..

# ⑤ 提交并推送
git add -A
git commit -m "release: zotero-plugin v0.8.4"
git tag zotero-plugin/v0.8.4
git push origin main --tags
```

**推送 tag 后，CI 自动完成：**
1. 安装依赖并构建 XPI
2. 创建 GitHub Release（标题：`Zotero Plugin v0.8.4`），上传 XPI
3. 更新固定的 `release` tag 下的 `update.json`，使 Zotero 自动更新机制生效

**验证发布成功：**
- 在 GitHub → Actions 页面查看 workflow 运行状态
- 在 GitHub → Releases 页面确认 XPI 已上传
- 测试自动更新：`https://github.com/occasional16/researchopia/releases/download/release/update.json`

---

## 发布浏览器扩展

推送 `extension/v*` 格式的 tag 后，GitHub Actions 会自动打包 ZIP 并创建 Release。

```bash
# ① 进入扩展目录，更新版本号
cd extension
npm version patch --no-git-tag-version

# ② 手动将 manifest.json 的 "version" 改为相同版本号
#    （npm version 只更新 package.json，manifest.json 需要手动同步）

# ③ 回到根目录
cd ..

# ④ 推送前本地检查（全部通过后再继续）
npm run lint
cd extension && npm run build && cd ..

# ⑤ 提交并推送
git add -A
git commit -m "release: browser-extension v0.2.1"
git tag extension/v0.2.1
git push origin main --tags
```

**推送 tag 后，CI 自动完成：**
1. 打包 extension/ 为 ZIP
2. 创建 GitHub Release，上传 ZIP

**手动步骤（CI 之后）：**
- 从 GitHub Release 下载 ZIP，上传到 Chrome Web Store 开发者控制台

---

## 发布网站

推送 `website/v*` 格式的 tag 后，GitHub Actions 会自动创建 Release。网站由 Cloudflare 检测到 push 后自动部署。

```bash
# ① 在根目录更新版本号
npm version minor --no-git-tag-version

# ② 推送前本地检查（全部通过后再继续）
npm run lint
npm run build
npm run test

# ③ 提交并推送
git add -A
git commit -m "release: website v0.6.0"
git tag website/v0.6.0
git push origin main --tags
```

**推送 tag 后，CI 自动完成：**
1. 创建 GitHub Release（标题：`Website v0.6.0`）
2. Cloudflare 检测到 push 自动部署

---

## Git Tag 命名规范

| 组件 | 格式 | 示例 | 触发 CI |
|------|------|------|--------|
| 网站 | `website/v{VERSION}` | `website/v0.6.0` | 是（创建 Release + Cloudflare 自动部署） |
| Zotero 插件 | `zotero-plugin/v{VERSION}` | `zotero-plugin/v0.8.4` | 是 |
| 浏览器扩展 | `extension/v{VERSION}` | `extension/v0.2.1` | 是 |

---

## CI 自动检查

每次 push 到 main 分支或创建 PR 时，`ci.yml` 会自动运行：

- **quality-check**（始终运行）：ESLint 代码检查、Next.js 构建验证、单元测试
- **zotero-plugin**（按需运行）：仅当 `zotero-plugin/` 或 `packages/shared/` 有变更时运行
- **browser-extension**（按需运行）：仅当 `extension/` 有变更时运行

在 GitHub → Actions 页面可以查看运行状态。

---

## Commit 规范

```
release: zotero-plugin v0.8.4     # 版本发布
feat: 新增 PDF 标注导出功能        # 新功能
fix: 修复侧边栏无法展开的问题      # Bug 修复
chore: 更新依赖                    # 杂项
docs: 补充 API 文档                # 文档
```

---

## 常见问题

**版本号写错了怎么办？**

```bash
# 还没 push 的情况下：
cd zotero-plugin
npm version 0.8.3 --no-git-tag-version   # 改回正确版本
cd ..
git add -A
git commit --amend
```

**tag 推送后发现构建失败怎么办？**

```bash
# 删除远程和本地 tag
git push origin --delete zotero-plugin/v0.8.4
git tag -d zotero-plugin/v0.8.4

# 修复问题后重新推送
git add -A
git commit --amend
git tag zotero-plugin/v0.8.4
git push origin main --tags
```

**为什么用 `--no-git-tag-version`？**

因为 `npm version` 默认会自动创建 git commit 和 tag。我们的项目是 monorepo，需要手动控制 commit 信息和 tag 格式，所以加这个参数禁用自动行为。

**查看当前各组件版本：**

```bash
node -p "require('./package.json').version"
node -p "require('./zotero-plugin/package.json').version"
node -p "require('./extension/package.json').version"
```

---

## 相关文档

- [CHANGELOG.md](CHANGELOG.md)
- [GitHub Releases](https://github.com/occasional16/researchopia/releases)
- [Workflows 重建指南](dev/Architecture%20and%20refactoring/Workflows/GITHUB_WORKFLOWS_REBUILD_GUIDE.md)

---

**最后更新**: 2026-03-17
