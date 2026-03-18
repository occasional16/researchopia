# package.json & package-lock.json 定期维护指南

> 适用于 Researchopia 三子项目 Monorepo 结构：根目录（Next.js 网站）、`zotero-plugin/`、`extension/`

---

## 目录

- [为什么需要定期维护](#为什么需要定期维护)
- [维护频率建议](#维护频率建议)
- [月度常规维护流程](#月度常规维护流程)
- [季度深度维护流程](#季度深度维护流程)
- [package.json 清理检查项](#packagejson-清理检查项)
- [package-lock.json 专项维护](#package-lockjson-专项维护)
- [常见问题与处理](#常见问题与处理)

---

## 为什么需要定期维护

| 问题 | 后果 |
| --- | --- |
| 依赖有已知安全漏洞 | 被攻击风险，npm audit 报告告警 |
| 依赖版本过旧 | 功能缺失、与新 Node/浏览器不兼容 |
| package-lock.json 膨胀 | 重复依赖占空间，安装慢 |
| 存在未使用的依赖 | 包体积大、构建慢、维护负担 |
| 版本范围过宽/过窄 | SemVer 范围不合理导致意外升级或锁死 |

---

## 维护频率建议

| 频率 | 操作 |
| --- | --- |
| **每月** | 安全审计 + 小版本更新 + 去重 |
| **每季度** | 大版本更新评估 + 未使用依赖清理 + lock 文件重建 |
| **代码提交前** | `npm audit` 确认无高危漏洞 |

---

## 月度常规维护流程

### 前置条件

```bash
# 确保在干净工作区中操作（先提交或暂存当前改动）
git status
# 如有未提交改动，先暂存
git stash
```

### 步骤 1：安全审计

```bash
# 根目录
npm audit

# Zotero 插件
cd zotero-plugin && npm audit && cd ..

# 浏览器扩展
cd extension && npm audit && cd ..
```

- **如有高危（high/critical）漏洞**，立即修复：
  ```bash
  npm audit fix
  ```
- 如果 `audit fix` 无法自动修复，查看详情并手动处理：
  ```bash
  npm audit fix --dry-run  # 先预览
  npm audit fix --force    # 仅在确认安全时使用（可能升大版本）
  ```

### 步骤 2：检查过时依赖

```bash
# 根目录
npm outdated

# Zotero 插件
cd zotero-plugin && npm outdated && cd ..

# 浏览器扩展
cd extension && npm outdated && cd ..
```

输出说明：
- **Current**: 当前安装版本
- **Wanted**: package.json SemVer 范围内最新
- **Latest**: npm 仓库最新版本
- **红色行**: Current ≠ Wanted，可安全更新
- **黄色行**: Wanted ≠ Latest，需手动升大版本

### 步骤 3：更新小版本（安全更新）

```bash
# 根目录（会自动处理 workspaces）
npm update

# Zotero 插件
cd zotero-plugin && npm update && cd ..

# 浏览器扩展
cd extension && npm update && cd ..
```

> `npm update` 只会在 package.json 声明的 SemVer 范围内更新，安全可靠。

### 步骤 4：去除重复依赖

```bash
npm dedupe
```

> `dedupe` 会扁平化依赖树，合并相同包的不同副本，减少 `node_modules` 和 `package-lock.json` 体积。

### 步骤 5：验证构建

```bash
# 网站
npm run lint
npm run build
npm run test

# Zotero 插件
cd zotero-plugin
npm run build
npm run test
cd ..

# 浏览器扩展
cd extension && npm run build && cd ..
```

### 步骤 6：提交改动

```bash
git add package.json package-lock.json zotero-plugin/package.json zotero-plugin/package-lock.json extension/package.json extension/package-lock.json
git commit -m "chore: monthly dependency update and security audit"
```

---

## 季度深度维护流程

在月度流程的基础上，增加以下步骤：

### 步骤 A：评估大版本更新

```bash
npm outdated
```

对 Wanted ≠ Latest 的包，逐个评估：

1. 查看该包的 CHANGELOG/Migration Guide
2. 判断 Breaking Changes 是否影响本项目
3. 如需升级，手动修改 package.json 中版本范围后 `npm install`

**重点关注这些核心依赖的大版本**：
- `next` — Next.js 框架
- `react` / `react-dom` — React 核心
- `@supabase/supabase-js` / `@supabase/ssr` — Supabase SDK
- `zotero-plugin-scaffold` / `zotero-plugin-toolkit` — Zotero 构建工具
- `typescript` / `eslint` — 开发工具链
- `vitest` — 测试框架

### 步骤 B：清理未使用依赖

使用 `depcheck` 扫描未使用的包：

```bash
# 安装（全局临时使用）
npx depcheck

# Zotero 插件
cd zotero-plugin && npx depcheck && cd ..

# 浏览器扩展
cd extension && npx depcheck && cd ..
```

> **注意**：`depcheck` 可能误报动态引用的包（如 `@mdx-js/loader`、PostCSS 插件等）。对每个报告的包，手动确认是否真的未被使用，再卸载。

```bash
# 确认未使用后卸载
npm uninstall <package-name>
```

### 步骤 C：重建 package-lock.json（可选）

当 lock 文件出现怪异行为（幽灵依赖、重复过多、合并冲突严重）时：

```bash
# 1. 删除 lock 文件和 node_modules
Remove-Item -Recurse -Force node_modules, package-lock.json
Remove-Item -Recurse -Force zotero-plugin/node_modules, zotero-plugin/package-lock.json -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force extension/node_modules, extension/package-lock.json -ErrorAction SilentlyContinue

# 2. 清除 npm 缓存（极少需要）
npm cache clean --force

# 3. 重新安装
npm install

# Zotero 插件
cd zotero-plugin && npm install && cd ..

# 浏览器扩展
cd extension && npm install && cd ..

# 4. 去重
npm dedupe
```

> **警告**：重建 lock 文件会改变所有包的具体版本。重建后务必完整测试所有子项目。

### 步骤 D：完整验证与提交

```bash
# 完整构建测试（同月度步骤 5）
npm run lint && npm run build && npm run test
cd zotero-plugin && npm run build && npm run test && cd ..
cd extension && npm run build && cd ..

# 提交
git add -A
git commit -m "chore: quarterly deep dependency maintenance"
```

---

## package.json 清理检查项

每季度逐项检查：

### 1. scripts 审查

- [ ] 每个 script 是否还在使用？删除废弃脚本
- [ ] 脚本名是否清晰？避免含义模糊的命名
- [ ] 跨平台兼容性？避免 bash 专属语法（本项目 Windows 开发）

### 2. 依赖分类检查

- [ ] `dependencies` 中是否有仅开发时用的包？→ 移到 `devDependencies`
- [ ] `devDependencies` 中是否有运行时需要的包？→ 移到 `dependencies`
- [ ] 是否有 `@types/*` 包放在了 `dependencies`？→ 移到 `devDependencies`

### 3. 版本范围规范

| 写法 | 含义 | 建议场景 |
| --- | --- | --- |
| `^1.2.3` | 允许 minor + patch 更新 | **默认推荐**，大多数包 |
| `~1.2.3` | 仅允许 patch 更新 | 对稳定性敏感的核心包 |
| `1.2.3` (锁定) | 完全锁死版本 | 极少使用，仅已知不兼容时 |
| `*` 或 `latest` | 任意版本 | **禁止使用** |

### 4. 元信息检查

- [ ] `version` 字段与最新 Git Tag 一致
- [ ] `description` 准确描述项目
- [ ] `license` 正确（AGPL-3.0-or-later）
- [ ] `repository` URL 正确

---

## package-lock.json 专项维护

### 理解 lock 文件

- **作用**：锁定依赖树所有包的精确版本，保证不同环境安装一致
- **体积大是正常的**：本项目 ~20K 行，因 Next.js + Supabase + 测试框架等依赖链深
- **不要手动编辑**：所有变更通过 npm 命令生成

### 常用瘦身命令

```bash
# 去重（最常用，安全无副作用）
npm dedupe

# 清理无用包（移除 node_modules 中未被引用的包）
npm prune

# 查看依赖树深度
npm ls --all --depth=0  # 仅顶层
npm ls --all --depth=1  # 展开一层
```

### Git 合并冲突处理

package-lock.json 合并冲突时，**不要手动解决**：

```bash
# 直接接受任一版本，然后重新生成
git checkout --theirs package-lock.json  # 或 --ours
npm install
```

---

## 常见问题与处理

### Q: `npm audit` 报了漏洞但 `audit fix` 修不了？

通常是传递依赖（你的依赖的依赖）有漏洞。处理方式：

1. 检查是否为 devDependency 的漏洞（仅开发时存在，风险较低）
2. 在 package.json 中添加 `overrides` 强制指定安全版本：
   ```json
   {
     "overrides": {
       "vulnerable-package": ">=2.0.1"
     }
   }
   ```
3. 等上游包更新后再移除 overrides

### Q: `npm install` 后 lock 文件变化很大？

可能原因：
- npm 版本不同（团队统一 npm 版本）
- 依赖的 SemVer 范围内有新版发布
- 解决方案：统一使用 `npm ci`（CI 环境）或确保团队 npm 版本一致

### Q: 想试装一个包但不想影响项目？

```bash
# 用 npx 临时运行，不写入 package.json
npx <package-name>

# 或在临时目录尝试
mkdir /tmp/test && cd /tmp/test && npm init -y && npm install <package>
```

### Q: 某个包更新后项目构建失败？

```bash
# 回滚到上次正常的 lock 文件
git checkout HEAD -- package-lock.json
npm ci  # 严格按 lock 文件安装
```

---

## 快速参考卡片

```
┌─────────────────────────────────────────────────┐
│             月度维护速查 (5 分钟)                  │
├─────────────────────────────────────────────────┤
│  1. npm audit                  # 安全检查        │
│  2. npm outdated               # 查看过时包      │
│  3. npm update                 # 安全范围内更新   │
│  4. npm dedupe                 # 去重            │
│  5. npm run build && npm test  # 验证            │
│  6. git commit                 # 提交            │
└─────────────────────────────────────────────────┘
```
