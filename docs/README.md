# 文档索引和规范 | Documentation Index & Specifications

**Researchopia 项目文档导航与编写规范**

欢迎来到 Researchopia 项目文档中心! 本页面是**唯一的"文档的文档"**,提供:
- 📖 快速导航: 帮助不同角色快速找到所需文档
- 📝 编写规范: 指导文档创建和维护的最佳实践
- 🔗 交叉引用: 说明各文档之间的关系和联系

> **💡 提示**: 所有文档都在 `/docs` 目录下,按 **8层架构** 分类组织,请根据您的角色和需求快速定位。

---

## 📖 快速导航

### 我是新用户,想了解如何使用 Researchopia
👉 [用户指南 (USER-GUIDE.md)](./USER-GUIDE.md)
- 网站使用说明
- Zotero插件安装和使用
- 浏览器扩展使用教程
- 常见问题FAQ

---

### 我想为项目贡献代码
👉 [贡献指南 (CONTRIBUTING.md)](./CONTRIBUTING.md)
- 如何搭建开发环境
- 代码规范和Git工作流
- Pull Request流程

---

### 我需要技术实现细节
👉 [开发文档 (DEVELOPMENT.md)](./DEVELOPMENT.md)
- Next.js网站开发指南
- Zotero插件架构详解
- 浏览器扩展开发教程

---

### 我想了解系统架构和数据库设计
👉 [架构文档 (ARCHITECTURE.md)](./ARCHITECTURE.md)
- 系统架构图
- 数据流和技术栈
- 数据库表结构、索引、RLS策略

---

### 我需要调用API或集成到第三方应用
👉 [API文档 (API.md)](./API.md)
- 所有API端点列表
- 请求/响应示例
- 认证方式和错误处理

---

### 我遇到了问题,需要排查
👉 [问题排查指南 (TROUBLESHOOTING.md)](./TROUBLESHOOTING.md)
- 网站、插件、扩展的常见问题
- 调试技巧和日志查看
- 数据库和性能问题

---

## 📚 完整文档列表

### 入口层
| 文档 | 描述 | 适合人群 |
|------|------|----------|
| [README.md](../README.md) | 项目概述,快速开始 | 所有人 |

### 架构层
| 文档 | 描述 | 适合人群 |
|------|------|----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 系统架构、数据流、数据库设计 | 开发者、架构师 |

### 开发层
| 文档 | 描述 | 适合人群 |
|------|------|----------|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 技术详解、核心代码、最佳实践 | 开发者 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 贡献流程、代码规范、Git工作流 | 贡献者 |

### 使用层
| 文档 | 描述 | 适合人群 |
|------|------|----------|
| [USER-GUIDE.md](./USER-GUIDE.md) | 用户使用指南、FAQ、最佳实践 | 终端用户 |

### API层
| 文档 | 描述 | 适合人群 |
|------|------|----------|
| [API.md](./API.md) | API接口文档、请求示例、错误码 | 集成开发者 |

### 排查层
| 文档 | 描述 | 适合人群 |
|------|------|----------|
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | 常见问题、调试技巧、性能优化 | 所有开发者 |

### 导航层
| 文档 | 描述 | 适合人群 |
|------|------|----------|
| **[README.md](./README.md)** | **本文档**,文档导航+编写规范 | 所有人 |

### 项目管理层
| 文档 | 描述 | 适合人群 |
|------|------|----------|
| [PROJECT_OPTIMIZATION_PLAN.md](../Debug/docs/PROJECT_OPTIMIZATION_PLAN.md) | 3阶段优化计划、路线图 | 项目管理者 |

---

## 🔍 按场景查找

### 场景导航

**...搭建开发环境**
1. [CONTRIBUTING.md - 快速开始](./CONTRIBUTING.md#快速开始)
2. [DEVELOPMENT.md - 环境配置](./DEVELOPMENT.md#nextjs-app-router)

**...了解数据库结构**
1. [ARCHITECTURE.md - 数据库设计](./ARCHITECTURE.md#四数据库设计)
2. [API.md - 数据模型](./API.md#论文相关api)

**...调试Zotero插件**
1. [DEVELOPMENT.md - 热重载开发](./DEVELOPMENT.md#hot-reload)
2. [TROUBLESHOOTING.md - 插件问题](./TROUBLESHOOTING.md#zotero-插件问题)

**...使用浏览器扩展**
1. [USER-GUIDE.md - 浏览器扩展](./USER-GUIDE.md#第三部分浏览器扩展)
2. [TROUBLESHOOTING.md - 扩展问题](./TROUBLESHOOTING.md#浏览器扩展问题)

**...调用API**
1. [API.md - 认证方式](./API.md#认证方式)
2. [API.md - 端点列表](./API.md#完整端点列表)

**...提交PR**
1. [CONTRIBUTING.md - Pull Request流程](./CONTRIBUTING.md#pull-request流程)
2. [CONTRIBUTING.md - 代码规范](./CONTRIBUTING.md#代码规范)

**...修复Bug**
1. [TROUBLESHOOTING.md - 问题排查](./TROUBLESHOOTING.md)
2. [CONTRIBUTING.md - Git工作流](./CONTRIBUTING.md#git工作流)

**...了解项目架构**
1. [ARCHITECTURE.md - 系统架构](./ARCHITECTURE.md#二系统架构)
2. [ARCHITECTURE.md - 技术栈](./ARCHITECTURE.md#一技术栈)

---

## 📝 文档编写规范

如果您需要**修改或新增文档**,请遵循以下规范:

### 文档系统设计理念

本项目采用**8层文档架构**,确保信息清晰、易于维护:

```
├── 入口层: README.md (项目概览、快速开始)
├── 架构层: ARCHITECTURE.md (系统设计、数据流、数据库)
├── 开发层: DEVELOPMENT.md + CONTRIBUTING.md (技术实现+贡献流程)
├── 使用层: USER-GUIDE.md (终端用户指南)
├── API层: API.md (接口文档、请求示例)
├── 排查层: TROUBLESHOOTING.md (常见问题、调试技巧)
├── 数据库层: (已合并到ARCHITECTURE.md,避免重复)
└── 项目管理层: PROJECT_OPTIMIZATION_PLAN.md (演进规划)
```

### 核心原则

#### 1. 单一职责 (Single Responsibility)
每个文档专注一个主题,避免内容重复:

| ❌ 错误做法 | ✅ 正确做法 |
|-------------|-------------|
| 在DEVELOPMENT.md重复数据库表结构 | 链接到 [ARCHITECTURE.md - 数据库设计](./ARCHITECTURE.md#四数据库设计) |
| USER-GUIDE.md中详细解释API认证 | 链接到 [API.md - 认证方式](./API.md#认证方式) |
| TROUBLESHOOTING.md中重写开发流程 | 链接到 [CONTRIBUTING.md - Git工作流](./CONTRIBUTING.md#git工作流) |

**决策案例**: 
- **DATABASE.md 不创建**: ARCHITECTURE.md已包含完整数据库设计(7个表、索引、RLS策略、触发器),独立文档会造成维护负担

#### 2. 相对链接 (Relative Links)
使用Markdown相对路径引用其他文档:

```markdown
详见 [架构文档 - 数据库设计](./ARCHITECTURE.md#四数据库设计)
关于贡献流程,请参考 [CONTRIBUTING.md](./CONTRIBUTING.md)
项目概述请查看 [主README](../README.md)
```

#### 3. 清晰结构 (Clear Structure)
使用层级标题,便于生成目录和快速定位:

```markdown
# 一级标题:文档名
## 二级标题:主要章节
### 三级标题:子章节
#### 四级标题:详细说明(慎用)
```

**技巧**: 在长文档开头添加 `## 目录` 章节,列出所有二级标题的锚点链接。

#### 4. 可执行代码 (Executable Code)
代码示例必须可直接运行,标注正确的语言类型:

````markdown
```typescript
// TypeScript示例
const config = { apiUrl: 'https://api.example.com' };
```

```bash
# Bash脚本
npm install
npm run dev
```

```sql
-- SQL查询
SELECT * FROM papers WHERE doi = 'xxx';
```
````

#### 5. AI友好 (AI-Friendly)
为GitHub Copilot等AI工具提供完整上下文:

**精确位置引用**:
```markdown
在 `src/app/api/proxy/annotations/list/route.ts` 的第47行...
```

**术语统一**:
- ✅ 使用: "reading session"、"shared annotation"、"Zotero item"
- ❌ 避免: "阅读会话"、"共享批注"(在同一文档中混用中英文术语)

**完整上下文**:
```markdown
## 标注分页API

**功能**: 获取论文的共享标注列表,支持分页

**文件位置**: `src/app/api/proxy/annotations/list/route.ts`

**关键代码**:
- 第47行: 使用 `.order('created_at', {ascending: false})`
- 第48行: 然后调用 `.range(from, to)`
- **注意**: 必须先排序再分页,否则会返回错误的数据

**相关文档**: 
- 数据库设计请参考 [ARCHITECTURE.md](./ARCHITECTURE.md#四数据库设计)
- API认证请参考 [API.md](./API.md#认证方式)
```

### 文档维护流程

#### 新增文档前:评估必要性

1. **检查现有文档**: 确认该主题是否已在其他文档中覆盖
   - 搜索 `/docs` 目录: `grep -r "关键词" docs/`
   - 查看本文档的"完整文档列表"章节

2. **评估合并可能性**: 是否可以作为现有文档的新章节?
   - 如果内容<500行,建议合并到现有文档
   - 如果与现有文档高度相关,优先考虑合并

3. **确定文档层级**: 新文档属于8层架构的哪一层?
   ```
   入口层 → 架构层 → 开发层 → 使用层 → API层 → 排查层 → 导航层 → 项目管理层
   ```

4. **创建文档并更新索引**:
   ```markdown
   # 在 docs/README.md 的"完整文档列表"添加:
   | [新文档.md](./新文档.md) | 文档描述 | 适合人群 |
   ```

#### 修改文档时:保持一致性

1. **更新交叉引用**: 如果修改了章节标题或结构
   ```bash
   # 搜索所有引用该文档的链接
   grep -r "旧章节名" docs/
   ```

2. **同步更新索引**: 修改 `docs/README.md` 中的描述

3. **检查代码示例**: 确保代码示例可运行,版本号最新

4. **提交PR说明**: 在PR描述中说明修改动机和影响范围
   ```markdown
   ## 修改说明
   - 更新了DEVELOPMENT.md的Zotero插件热重载章节
   - 添加了Windows系统下的路径配置说明
   - 影响文档: CONTRIBUTING.md(链接更新)
   ```

#### 删除文档时:谨慎操作

⚠️ **删除文档需要项目负责人审批**,避免丢失重要历史信息。

1. **评估影响**: 搜索所有指向该文档的链接
   ```bash
   grep -r "待删除文档.md" .
   ```

2. **迁移内容**: 将有价值的内容合并到其他文档

3. **更新所有链接**: 替换或移除所有指向该文档的引用

4. **存档(可选)**: 将删除的文档移动到 `/Debug/docs/archived/`
   ```bash
   mv docs/待删除文档.md Debug/docs/archived/
   ```

5. **更新本索引**: 从"完整文档列表"中移除该文档

### 重要决策记录 (ADR - Architecture Decision Records)

#### 决策1: 为什么不创建 `DATABASE.md`?

**决策**: ✖️ 不创建独立的DATABASE.md

**理由**:
1. `ARCHITECTURE.md` 已包含完整数据库设计:
   - 7个核心表(papers, shared_annotations, reading_sessions等)
   - CREATE TABLE语句
   - 索引设计(doi, user_id, created_at等)
   - RLS策略(行级安全)
   - 触发器(update_updated_at_column)

2. 独立DATABASE.md会造成:
   - ❌ 内容重复 → 维护成本倍增
   - ❌ 信息分散 → 阅读体验割裂
   - ❌ 更新不同步风险

**替代方案**: 在其他文档中链接到 [ARCHITECTURE.md - 数据库设计](./ARCHITECTURE.md#四数据库设计)

#### 决策2: 为什么合并 `BROWSER-EXTENSION-AND-ZOTERO-PLUGIN.md`?

**决策**: ✅ 拆分并删除原文档

**原因**: 原文档883行,混合两个组件的技术细节,难以维护

**新方案**:
- Zotero插件技术详解 → 合并到 `DEVELOPMENT.md` (第二部分)
- 浏览器扩展技术详解 → 合并到 `DEVELOPMENT.md` (第三部分)
- 用户使用指南 → 合并到 `USER-GUIDE.md`

**效果**: 单一职责更清晰,交叉引用更方便

#### 决策3: 为什么 `docs/README.md` 作为文档索引?

**决策**: ✅ `docs/README.md` 作为文档中心,标题为"文档索引和规范"

**理由**:
1. **GitHub惯例**: 目录下的README.md会自动显示,用户体验好
2. **英文兼容**: 文件名保持README.md,方便国际化
3. **双重职责**: 既是快速导航,也是编写规范手册

**文档层级**:
- 根目录 `/README.md`: 项目主入口(概览、快速开始)
- 文档目录 `/docs/README.md`: 文档中心(索引+规范)

#### 决策4: 为什么采用8层文档架构?

**决策**: ✅ 使用分层架构而非扁平结构

**架构设计**:
```
入口层(README) → 架构层(ARCHITECTURE) → 开发层(DEVELOPMENT+CONTRIBUTING)
     ↓                                          ↓
  使用层(USER-GUIDE) ← API层(API) ← 排查层(TROUBLESHOOTING)
     ↓
  导航层(本文档) ← 项目管理层(PROJECT_OPTIMIZATION_PLAN)
```

**优势**:
- ✅ **用户友好**: 不同角色快速定位所需文档
- ✅ **易于维护**: 每层职责单一,修改影响范围小
- ✅ **可扩展性**: 新增文档时明确归属层级
- ✅ **AI友好**: 清晰的层级关系便于AI理解上下文

### AI辅助开发说明

本文档系统专为AI工具(GitHub Copilot、Claude Code、Cursor等)优化:

| AI工具特性 | 文档优化策略 | 示例 |
|------------|--------------|------|
| **上下文窗口有限** | 每个文档自包含核心概念 | DEVELOPMENT.md完整介绍Next.js、Zotero、扩展三组件,无需跨文档查询 |
| **结构化解析能力强** | 使用表格、列表、代码块 | 代码示例用 ````markdown 标记语言类型 |
| **关键词匹配** | 统一术语、精确位置 | 统一使用"reading session",避免"阅读会话" |
| **链接跟踪** | 相对路径、锚点链接 | `[数据库设计](./ARCHITECTURE.md#四数据库设计)` |

**为AI提供完整上下文的模板**:
```markdown
## 功能名称

**文件位置**: `src/app/api/具体文件.ts`

**功能说明**: 简洁描述功能

**核心代码** (第XX-YY行):
```typescript
// 关键代码片段
```

**相关文档**: [链接到相关章节](./OTHER.md#章节)

**已知问题**: [链接到TROUBLESHOOTING](./TROUBLESHOOTING.md#具体问题)
```

### 参考资源

| 资源 | 链接 | 用途 |
|------|------|------|
| Markdown规范 | [GitHub Flavored Markdown](https://github.github.com/gfm/) | 语法参考 |
| 贡献流程 | [CONTRIBUTING.md](./CONTRIBUTING.md#pull-request流程) | Git工作流 |
| 代码规范 | [CONTRIBUTING.md - 代码规范](./CONTRIBUTING.md#代码规范) | 命名、格式 |
| Markdown Lint | [markdownlint规则](https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md) | 检查工具 |

---

## 🔗 外部资源

| 资源类型 | 链接 | 说明 |
|----------|------|------|
| 官方网站 | [www.researchopia.com](https://www.researchopia.com) | 在线平台 |
| GitHub仓库 | [github.com/occasional16/researchopia](https://github.com/occasional16/researchopia) | 源代码 |
| 问题反馈 | [GitHub Issues](https://github.com/occasional16/researchopia/issues) | Bug报告、功能建议 |
| 社区讨论 | [GitHub Discussions](https://github.com/occasional16/researchopia/discussions) | 技术交流、问答 |

---

## 📊 文档统计与健康度

### 核心文档

| 文档 | 行数 | 状态 | 最后更新 |
|------|------|------|----------|
| README.md | 209 | ✅ 完整 | 2025-01-02 |
| ARCHITECTURE.md | 598 | ✅ 完整(含数据库) | 2025-01-02 |
| DEVELOPMENT.md | 1496 | ✅ 完整(三组件) | 2025-01-02 |
| CONTRIBUTING.md | 553 | ✅ 精简 | 2025-01-02 |
| USER-GUIDE.md | 929 | ✅ 完整 | 2025-01-02 |
| API.md | 1194 | ✅ 完整(30+端点) | 2025-01-02 |
| TROUBLESHOOTING.md | 1157 | ✅ 完整(23问题) | 2025-01-02 |
| docs/README.md | 本文档(索引+规范) | ✅ 持续更新 | 2025-01-02 |

**总计**: 8个核心文档,约 **6136行** 技术内容

### 覆盖度评估

| 维度 | 覆盖率 | 说明 |
|------|--------|------|
| 开发者 | ✅ 100% | DEVELOPMENT.md、ARCHITECTURE.md完整覆盖 |
| 贡献者 | ✅ 100% | CONTRIBUTING.md精简流程,交叉引用技术文档 |
| 终端用户 | ✅ 100% | USER-GUIDE.md三组件全覆盖,FAQ详尽 |
| API集成 | ✅ 100% | API.md包含30+端点、认证、错误处理 |
| 问题排查 | ✅ 95% | TROUBLESHOOTING.md覆盖23个常见问题 |

### 健康度指标

| 指标 | 评分 | 备注 |
|------|------|------|
| 完整性 | ⭐⭐⭐⭐⭐ | 所有核心文档已创建 |
| 一致性 | ⭐⭐⭐⭐⭐ | 统一术语、相对链接、代码规范 |
| 可维护性 | ⭐⭐⭐⭐⭐ | 单一职责、避免重复、清晰分层 |
| AI友好度 | ⭐⭐⭐⭐⭐ | 完整上下文、精确位置、术语统一 |
| 用户友好 | ⭐⭐⭐⭐⭐ | 快速导航、场景式索引、清晰结构 |

---

## ❓ 找不到您需要的内容?

**快速帮助**:
1. **搜索关键词**: 使用GitHub搜索功能 `Ctrl+K` / `Cmd+K` → 输入关键词
2. **查看相关文档**: 每个文档开头都有"相关文档"链接
3. **提交问题**: [GitHub Issues](https://github.com/occasional16/researchopia/issues) 询问,我们会在24小时内回复
4. **社区求助**: [GitHub Discussions](https://github.com/occasional16/researchopia/discussions) 与其他开发者交流

**常见搜索示例**:
- 搜索"数据库表结构" → 跳转到 `ARCHITECTURE.md`
- 搜索"热重载开发" → 跳转到 `DEVELOPMENT.md`
- 搜索"认证失败" → 跳转到 `TROUBLESHOOTING.md`
- 搜索"API认证" → 跳转到 `API.md`

---

## 📅 文档更新日志

### v1.0 (2025-01-02)
- ✅ 创建8层文档架构
- ✅ 完成7个核心文档(README、ARCHITECTURE、DEVELOPMENT、CONTRIBUTING、USER-GUIDE、API、TROUBLESHOOTING)
- ✅ 创建本导航文档,整合 `DOCUMENTATION_SYSTEM_DESIGN.md` 的职责
- ✅ 决策:不创建DATABASE.md,避免重复
- ✅ 决策:拆分BROWSER-EXTENSION-AND-ZOTERO-PLUGIN.md

---

## 🚀 持续改进计划

### Phase 3: 持续优化 (进行中)

**优先级 P1 - 内容丰富**:
- [ ] 添加截图和示意图
  - ARCHITECTURE.md: 系统架构图、数据流图
  - USER-GUIDE.md: 各功能使用截图
  - TROUBLESHOOTING.md: 错误信息示例
  
- [ ] 添加更多代码示例
  - DEVELOPMENT.md: 常见功能实现模式
  - API.md: 完整请求/响应示例

**优先级 P2 - 多语言支持**:
- [ ] 创建英文版核心文档
  - README-en.md (已存在)
  - ARCHITECTURE-en.md
  - API-en.md (面向国际开发者)

**优先级 P3 - 自动化工具**:
- [ ] 文档健康度检查脚本
  ```bash
  # 检查死链接
  npm run docs:check-links
  
  # 检查代码示例可运行性
  npm run docs:verify-code
  ```

- [ ] 自动生成API文档(基于代码注释)

**优先级 P4 - 交互式文档**:
- [ ] 集成API测试工具(Swagger/Postman)
- [ ] 创建交互式教程(React组件演示)

---

**维护者**: Researchopia Team  
**最后更新**: 2025-11-10  
**文档版本**: v0.1  
**下次审查**: 2025-12-02

**祝您阅读愉快! 📖✨**
