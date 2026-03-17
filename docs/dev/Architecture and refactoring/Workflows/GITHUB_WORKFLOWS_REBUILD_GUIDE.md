# GitHub Workflows 重建指南

本文档指导 AI 按需重建 `.github/` 下的 GitHub Actions 和模板文件。

> **背景**: 原有 `.github/` 内容已删除（过时且从未使用）。仅保留 `copilot-instructions.md`。

---

## 一、需要重建的文件清单

按优先级排列：

| 优先级 | 文件 | 用途 | 何时重建 |
|--------|------|------|---------|
| P0 | `workflows/release-zotero.yml` | Zotero 插件自动发布 | 首次正式发布时 |
| P1 | `workflows/ci.yml` | 代码质量检查 | 团队协作或 PR 流程启用时 |
| P2 | `workflows/release-extension.yml` | 浏览器扩展发布辅助 | 扩展上架 Chrome Web Store 后 |
| P3 | `ISSUE_TEMPLATE/` | Issue 模板 | 项目开源接受外部贡献时 |
| P3 | `PULL_REQUEST_TEMPLATE.md` | PR 模板 | 同上 |
| P3 | `CODEOWNERS` | 代码审查分配 | 多人协作时 |
| P3 | `dependabot.yml` | 依赖自动更新 | 项目稳定后 |

---

## 二、Workflow 详细规格

### 2.1 Zotero 插件发布 (P0)

**文件**: `.github/workflows/release-zotero.yml`

**触发条件**:
```yaml
on:
  push:
    tags:
      - 'zotero-plugin/v*'  # 如 zotero-plugin/v0.8.4
```

**执行步骤**:
1. `actions/checkout@v4` — 拉取代码
2. `actions/setup-node@v4` (Node.js 20) — 安装 Node.js
3. 根目录 `npm ci` — 安装根依赖（包含 packages/shared）
4. `cd zotero-plugin && npm ci` — 安装插件依赖
5. `cd zotero-plugin && npm run build` — 构建 XPI 和 update.json
6. 从 tag 中提取版本号（去掉 `zotero-plugin/v` 前缀）
7. `softprops/action-gh-release@v2` — 创建 GitHub Release

**Release 配置**:
- Tag: 使用推送的 tag（`zotero-plugin/v0.8.4`）
- Name: `Zotero Plugin v{VERSION}`
- 上传文件:
  - `zotero-plugin/build/researchopia-zotero-latest.xpi`
  - `zotero-plugin/build/update.json`
  - `zotero-plugin/build/update-beta.json`

**环境变量** (需在 GitHub Settings → Secrets 中配置):
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase 项目 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase 匿名密钥

**注意事项**:
- `zotero-plugin.config.ts` 中 `xpiDownloadLink` 的 tag 格式为 `v{{version}}`
  - 如果 tag 改为 `zotero-plugin/v0.8.4`，**必须同步修改** `xpiDownloadLink` 为:
    ```
    https://github.com/occasional16/researchopia/releases/download/zotero-plugin/v{{version}}/{{xpiName}}.xpi
    ```
  - 同时修改 `updateURL` 中的 `release` tag 为新的固定 tag 名（或保持使用独立的 `release` tag 来存放 update.json）
- `update.json` 的部署策略: 
  - 方案 A: 每次发布都上传到当前 Release，Zotero 通过最新 Release 的 update.json 检查更新
  - 方案 B: 维护一个固定的 `release` tag 的 Release，每次发布时更新该 Release 的 update.json（当前方案）
  - **推荐方案 B**，需要在 workflow 中额外上传 update.json 到 `release` tag 的 Release

### 2.2 CI 质量检查 (P1)

**文件**: `.github/workflows/ci.yml`

**触发条件**:
```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

**执行步骤**:
1. Checkout + Setup Node.js 20
2. `npm ci` — 安装依赖
3. `npm run lint` — ESLint 检查
4. `npm run build` — Next.js 构建验证
5. `npm run test:ci` — 运行测试和覆盖率
6. `cd zotero-plugin && npm ci && npm run build` — Zotero 插件构建验证
7. `cd zotero-plugin && npm test` — 插件测试

**可选**: 根据变更文件过滤步骤（只改了 docs 不需要跑全部测试）

### 2.3 浏览器扩展发布 (P2)

**文件**: `.github/workflows/release-extension.yml`

**触发条件**:
```yaml
on:
  push:
    tags:
      - 'extension/v*'  # 如 extension/v0.2.1
```

**执行步骤**:
1. Checkout + Setup Node.js 20
2. `cd extension && npm ci` — 安装依赖
3. 构建（如果有构建步骤）
4. 打包为 ZIP: `zip -r extension.zip extension/ -x "node_modules/*" "*.git*"`
5. 创建 GitHub Release，上传 ZIP

---

## 三、配置文件规格

### 3.1 Issue 模板 (P3)

**目录**: `.github/ISSUE_TEMPLATE/`

需要 3 个模板:
- `bug_report.md` — Bug 报告（描述、复现步骤、预期行为、环境信息）
- `feature_request.md` — 功能建议（描述、问题背景、期望效果）
- `config.yml` — 模板选择器配置

### 3.2 PR 模板 (P3)

**文件**: `.github/PULL_REQUEST_TEMPLATE.md`

包含: 变更描述、变更类型勾选、关联 Issue

### 3.3 Dependabot (P3)

**文件**: `.github/dependabot.yml`

配置:
- 生态系统: npm
- 频率: 每周一次
- 最大 PR 数: 10
- 目录: `/`（根目录）和 `/zotero-plugin`

---

## 四、GitHub Secrets 清单

在 GitHub → Settings → Secrets and variables → Actions 中配置:

| Secret 名称 | 用途 | 何时需要 |
|-------------|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | Zotero 插件构建 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | Zotero 插件构建 |

> 注意: `GITHUB_TOKEN` 由 GitHub 自动提供，无需手动配置。

---

## 五、重建时的关键注意事项

1. **Tag 格式与 xpiDownloadLink 必须匹配**: 修改 tag 命名规范时，务必同步修改 `zotero-plugin/zotero-plugin.config.ts` 中的 `xpiDownloadLink` 和 `updateURL`
2. **update.json 部署**: 当前 `updateURL` 指向 `release` tag 下的 update.json，新 workflow 需要确保 update.json 也被上传到正确位置
3. **环境变量**: Zotero 插件构建需要 Supabase 环境变量，否则会构建出不含 Supabase 配置的 XPI
4. **Node.js 版本**: 统一使用 Node.js 20
5. **npm ci vs npm install**: CI 中使用 `npm ci`（严格按 lock 文件安装，更快更可靠）

---

**最后更新**: 2026-03-17
