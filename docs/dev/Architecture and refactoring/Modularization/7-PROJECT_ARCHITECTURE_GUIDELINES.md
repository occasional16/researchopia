# 7. Researchopia项目架构指南与质量保障

**文档版本**: v1.0  
**创建日期**: 2025-01-23  
**适用范围**: 全项目 (网站 + Zotero插件 + 浏览器扩展)

---

## 📋 目录

1. [项目整体评估](#1-项目整体评估)
2. [当前架构分析](#2-当前架构分析)
3. [潜在风险识别](#3-潜在风险识别)
4. [核心设计原则](#4-核心设计原则)
5. [模块化规范](#5-模块化规范)
6. [代码质量标准](#6-代码质量标准)
7. [AI开发最佳实践](#7-ai开发最佳实践)
8. [持续改进机制](#8-持续改进机制)

---

## 1. 项目整体评估

### 1.1 项目组成

| 组件 | 版本 | 技术栈 | 文件数 | 代码健康度 |
|------|------|--------|--------|-----------|
| **网站** | 0.3.0 | Next.js 16 + React + Supabase | ~278 | 🟢 良好 |
| **Zotero插件** | 0.5.0 | TypeScript + Zotero API | 168 | 🟢 优秀 (8.5/10) |
| **浏览器扩展** | 0.1.1 | Vanilla JS + Manifest V3 | 12 | 🟡 待改进 |

### 1.2 整体健康度: 7.8/10

**优势**:
- ✅ Zotero插件已完成深度重构 (Phase 1-12)
- ✅ 网站采用现代化技术栈 (Next.js 16)
- ✅ 统一版本管理系统
- ✅ 详细的文档体系 (9个开发文档)

**劣势**:
- ⚠️ 浏览器扩展缺少TypeScript支持
- ⚠️ 12个未完成TODO项 (7个功能性 + 5个技术债)
- ⚠️ 网站代码缺少系统性模块化审计
- ⚠️ 三端代码共享机制不明确

---

## 2. 当前架构分析

### 2.1 Zotero插件 (最成熟) 🟢

**架构评分**: 8.5/10

**模块化成果** (Phase 1-12):
- 12个核心文件完成优化 (-3948行, -43.7%)
- 46+个独立模块 (+8431行结构化代码)
- 71%文件 < 300行 (行业领先)
- 0编译错误 ✅

**目录结构** (优秀):
```
zotero-plugin/src/
├── modules/            # 业务模块 (168个文件)
│   ├── auth.ts         # 认证管理
│   ├── supabase.ts     # 数据库层
│   ├── ui/             # UI视图层 (46个组件/工具)
│   ├── pdf/            # PDF管理 (V2架构)
│   └── utils/          # 通用工具
├── config/             # 配置管理
├── adapters/           # 适配器层
└── hooks.ts            # 生命周期钩子
```

**设计亮点**:
- ✅ 单一职责原则严格执行
- ✅ 工具模块高度可复用 (3处成功案例)
- ✅ PDF模块V2架构 (443行协调器 + 5个专业子模块)
- ✅ 明确的deprecated标记和迁移指南

**改进空间**:
- ⚠️ 12个残留TODO需清理
- ⚠️ 单元测试覆盖率 ~0%
- ⚠️ 部分工具函数缺少JSDoc

---

### 2.2 网站 (健康但需审计) 🟡

**架构评分**: 7.5/10

**目录结构** (标准Next.js):
```
src/
├── app/                # App Router页面
│   ├── (auth)/         # 认证相关页面
│   ├── academic-navigation/
│   ├── admin/
│   ├── api/            # API路由
│   └── ...             # 其他页面
├── components/         # React组件
├── lib/                # 核心逻辑库
│   ├── supabase/       # Supabase客户端
│   ├── websocket-server.ts
│   └── ...
├── hooks/              # 自定义Hooks
├── utils/              # 工具函数
└── types/              # TypeScript类型定义
```

**优势**:
- ✅ 使用App Router (Next.js 14+标准)
- ✅ TypeScript全覆盖
- ✅ 组件化开发
- ✅ Supabase SSR集成

**风险点**:
- ⚠️ **未进行模块化审计** - 可能存在隐藏的大文件
- ⚠️ **组件复用率未知** - 可能有重复组件
- ⚠️ **API路由缺少统一错误处理**
- ⚠️ **WebSocket服务器职责不明确** (349行)

**推荐行动**:
1. 执行类似Zotero插件的模块化审计
2. 建立组件库 (Storybook)
3. 统一API响应格式和错误码

---

### 2.3 浏览器扩展 (最需改进) 🔴

**架构评分**: 5.0/10

**文件结构** (简单但脆弱):
```
extension/
├── manifest.json       # MV3配置
├── background.js       # 后台脚本
├── content.js          # 内容脚本
├── popup.html/js       # 弹窗界面
├── sidebar.html/js     # 侧边栏
├── welcome.html/js     # 欢迎页
├── icons/              # 图标资源
└── _locales/           # 国际化
```

**严重问题**:
- 🔴 **无TypeScript支持** - 类型安全缺失
- 🔴 **无构建系统** - 直接编辑源文件
- 🔴 **代码混合** - HTML内联JS,维护困难
- 🔴 **无模块化** - 全局变量污染风险
- 🔴 **无单元测试**

**紧急建议**:
1. 引入构建工具 (Vite/Webpack)
2. 迁移至TypeScript
3. 拆分模块 (DOI检测、API通信、UI渲染)
4. 建立开发/生产构建流程

---

## 3. 潜在风险识别

### 3.1 代码质量风险

| 风险 | 影响组件 | 严重度 | 当前状态 |
|------|---------|--------|---------|
| **大文件重现** | 网站、扩展 | 🔴 高 | 未审计 |
| **TODO堆积** | Zotero插件 | 🟡 中 | 12项待处理 |
| **测试缺失** | 全部 | 🔴 高 | ~0%覆盖率 |
| **类型安全** | 浏览器扩展 | 🔴 高 | 无TS支持 |
| **重复代码** | 网站、扩展 | 🟡 中 | 未检测 |

### 3.2 架构演进风险

**风险1: 三端代码割裂**
- **现象**: 相似逻辑在三个项目中重复实现
- **示例**: DOI解析、API调用、用户认证
- **解决**: 建立共享包 (@researchopia/shared)

**风险2: AI开发导致的技术债**
- **现象**: 快速迭代忽略重构,代码膨胀
- **示例**: Phase 1-12发现的sessionAnnotationsView (3131行)
- **解决**: 每月强制重构审查

**风险3: 文档与代码脱节**
- **现象**: 快速变更未更新文档
- **示例**: API变更未同步到API.md
- **解决**: CI检查文档完整性

### 3.3 依赖管理风险

**版本碎片化**:
- Next.js: 16.0.1 (最新)
- Supabase: 2.57.2 (网站) vs 2.58.0 (插件)
- React Query: 5.90.5 (频繁更新)

**建议**: 
- 使用Renovate Bot自动更新依赖
- 锁定主版本号 (^16.0.0 而非 ^16)
- 每季度统一升级周期

---

## 4. 核心设计原则

### 4.1 SOLID原则强制执行

**S - 单一职责** (Single Responsibility)
```typescript
// ❌ 错误: 一个文件做太多事
class UserManager {
  authenticate() {}
  sendEmail() {}
  generateReport() {}
  updateDatabase() {}
}

// ✅ 正确: 职责分离
class AuthService { authenticate() {} }
class EmailService { sendEmail() {} }
class ReportGenerator { generateReport() {} }
class UserRepository { updateDatabase() {} }
```

**强制标准**:
- 每个文件 < 300行 (警告) / 600行 (错误)
- 每个函数 < 50行
- 每个类最多5个公开方法

---

### 4.2 DRY原则 (Don't Repeat Yourself)

**代码复用层次**:
1. **工具函数** (utils/) - 纯函数,无副作用
2. **组件** (components/) - UI复用
3. **Hooks** (hooks/) - 逻辑复用
4. **服务** (services/) - API/业务逻辑复用
5. **共享包** (@researchopia/shared) - 跨项目复用

**检测方法**:
```bash
# 使用jscpd检测重复代码
npx jscpd src/ --min-lines 10 --min-tokens 50
```

**阈值**:
- 重复率 < 5% (优秀)
- 重复率 < 10% (可接受)
- 重复率 > 15% (需重构)

---

### 4.3 KISS原则 (Keep It Simple, Stupid)

**简单性检查清单**:
- [ ] 函数名能自解释功能
- [ ] 无嵌套超过3层的条件语句
- [ ] 无超过5个参数的函数
- [ ] 无魔法数字 (硬编码常量)
- [ ] 无过度设计的抽象

**示例**:
```typescript
// ❌ 过度复杂
function processData<T extends BaseType>(
  data: T[],
  options: ProcessOptions<T>,
  callback?: (item: T, index: number, array: T[]) => void,
  errorHandler?: ErrorHandler<T>
): Promise<ProcessResult<T>>

// ✅ 简单直接
function processUsers(users: User[]): ProcessedUser[]
```

---

## 5. 模块化规范

### 5.1 文件组织标准

**目录结构模板**:
```
src/
├── features/           # 按功能划分 (推荐)
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── index.ts    # 统一导出
│   ├── annotations/
│   └── ...
├── shared/             # 跨功能共享
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   └── types/
└── core/               # 核心基础设施
    ├── api/
    ├── config/
    └── constants/
```

**命名约定**:
- 组件: PascalCase (UserProfile.tsx)
- 工具函数: camelCase (formatDate.ts)
- 常量: UPPER_SNAKE_CASE (API_BASE_URL.ts)
- 类型: PascalCase + Type后缀 (UserType.ts)

---

### 5.2 导出策略

**桶文件模式** (Barrel Exports):
```typescript
// features/auth/index.ts
export { LoginForm } from './components/LoginForm';
export { useAuth } from './hooks/useAuth';
export { authService } from './services/authService';
export type { User, AuthState } from './types';

// 外部使用
import { LoginForm, useAuth, authService } from '@/features/auth';
```

**禁止**:
- 深层嵌套导入: `import X from '../../../utils/helpers/string/format'`
- 循环依赖

**推荐**:
- 路径别名: `@/features`, `@/shared`, `@/core`
- 最多2层相对路径: `../utils/format`

---

### 5.3 模块边界

**依赖方向规则**:
```
core/          ← shared/      ← features/
(基础设施)      (共享资源)      (业务功能)

✅ features/ 可以导入 shared/ 和 core/
✅ shared/ 可以导入 core/
❌ core/ 不能导入 shared/ 或 features/
❌ features/auth/ 不能导入 features/annotations/
```

**跨功能通信**:
- 使用事件总线 (EventEmitter)
- 使用状态管理 (Zustand/Redux)
- 使用发布-订阅模式

---

## 6. 代码质量标准

### 6.1 强制检查 (CI/CD)

**Linting规则** (.eslintrc):
```json
{
  "rules": {
    "max-lines": ["error", 600],
    "max-lines-per-function": ["warn", 50],
    "complexity": ["error", 15],
    "max-depth": ["error", 3],
    "max-params": ["warn", 5]
  }
}
```

**Git Hooks** (Husky):
```json
{
  "pre-commit": "lint-staged",
  "pre-push": "npm run test && npm run lint:check"
}
```

**Code Review检查清单**:
- [ ] 无硬编码API密钥/敏感信息
- [ ] 有单元测试 (新增代码覆盖率 > 80%)
- [ ] 有JSDoc注释 (公开API)
- [ ] 无console.log (使用logger工具)
- [ ] 无any类型 (TypeScript)

---

### 6.2 性能标准

**文件大小**:
- 单个JS bundle < 200KB (gzip)
- 单个CSS文件 < 50KB
- 图片 < 200KB (使用WebP)

**运行时性能**:
- 首次内容绘制 (FCP) < 1.5s
- 最大内容绘制 (LCP) < 2.5s
- 累积布局偏移 (CLS) < 0.1
- 首次输入延迟 (FID) < 100ms

**内存管理**:
- 避免内存泄漏 (事件监听器清理)
- 大列表虚拟化 (react-window)
- 图片懒加载

---

### 6.3 安全标准

**XSS防护**:
- 使用dangerouslySetInnerHTML时必须消毒 (DOMPurify)
- 用户输入验证 (Zod/Yup)

**API安全**:
- 所有API使用HTTPS
- JWT Token过期时间 < 24h
- Rate Limiting (每IP 100请求/分钟)

**依赖安全**:
```bash
# 定期审计
npm audit
npm audit fix

# 自动化检查
npx snyk test
```

---

## 7. AI开发最佳实践

### 7.1 AI辅助开发流程

**阶段1: 需求分析**
- 🤖 AI生成用户故事
- 👤 人工审核和细化
- 🤖 AI生成技术方案草稿
- 👤 架构师审核方案

**阶段2: 实现**
- 🤖 AI生成代码骨架
- 👤 人工填充业务逻辑
- 🤖 AI重构优化
- 👤 Code Review

**阶段3: 测试**
- 🤖 AI生成测试用例
- 👤 补充边界测试
- 🤖 AI分析覆盖率
- 👤 手动E2E测试

---

### 7.2 防止AI代码膨胀

**问题**: AI倾向生成冗长、重复的代码

**解决方案**:

**1. 提示词工程**
```
❌ "帮我写一个用户管理系统"
✅ "创建一个UserService类,包含CRUD方法,每个方法<20行,使用Repository模式"
```

**2. 模板约束**
```typescript
// 提供给AI的模板
/**
 * @maxLines 200
 * @pattern Repository
 * @dependencies UserRepository, Logger
 */
export class UserService {
  // AI在此填充
}
```

**3. 自动重构触发**
```bash
# 文件超过300行时触发
if [ $(wc -l < file.ts) -gt 300 ]; then
  echo "⚠️ 文件过大,触发自动重构"
  ai-refactor file.ts --target-lines 200
fi
```

---

### 7.3 AI生成代码审查规范

**必查项**:
1. **类型安全**: 无any,无类型断言滥用
2. **错误处理**: 所有Promise有catch
3. **资源清理**: 所有监听器/订阅/定时器有清理
4. **命名规范**: 符合项目约定
5. **注释质量**: 解释why而非what

**AI代码标记**:
```typescript
// @ai-generated 2025-01-23
// @reviewed-by: human-developer
// @review-notes: 已验证边界条件
function processData(data: unknown[]) {
  // ...
}
```

---

### 7.4 渐进式重构策略

**每月重构日** (Monthly Refactoring Day):
- 第一个周五下午
- 团队集体review代码质量
- 选择1-2个模块进行重构

**重构优先级矩阵**:
```
高影响 | 🔴 立即重构    | 🟡 下月计划
低影响 | 🟢 低优先级    | ⚪ 可忽略
       |________________
         高复杂度  低复杂度
```

**重构检查清单**:
- [ ] 文件大小减少 > 20%
- [ ] 圈复杂度降低 > 30%
- [ ] 测试覆盖率提升 > 10%
- [ ] 无新增TODO
- [ ] 有Git原子提交

---

## 8. 持续改进机制

### 8.1 定期审计

**每周自动审计**:
```bash
# 周一凌晨自动运行
npm run audit:size       # 文件大小
npm run audit:complexity # 圈复杂度
npm run audit:duplicates # 重复代码
npm run audit:todos      # TODO统计
npm run audit:deps       # 依赖版本
```

**每月人工审计**:
- 架构评审会议 (2小时)
- 技术债务排查
- 性能瓶颈分析
- 安全漏洞扫描

---

### 8.2 指标追踪

**代码健康度仪表板**:
```yaml
metrics:
  - name: 平均文件大小
    current: 280行
    target: <300行
    trend: ↓ -15行/月
  
  - name: 测试覆盖率
    current: 0%
    target: >60%
    trend: → 0%/月 (需启动)
  
  - name: 重复代码率
    current: 未知
    target: <5%
    trend: 未测量
  
  - name: TODO数量
    current: 12项
    target: <5项
    trend: ↓ -2项/月
```

---

### 8.3 知识共享

**文档更新策略**:
- 每次重构后更新相关文档
- API变更必须同步更新API.md
- 新模式必须添加到架构文档

**团队学习**:
- 每两周技术分享会
- 重构案例分享 (Phase 1-12案例)
- 最佳实践提炼

---

## 📊 附录A: 当前技术债务清单

### Zotero插件

| TODO | 位置 | 优先级 | 预计工时 |
|------|------|--------|---------|
| 移植SharedAnnotationsView | sessionAnnotationsView.ts:231 | P1 | 4h |
| 实现关注功能 | SharedSortFilter.ts:78 | P2 | 8h |
| 数据同步逻辑 | LoggedInEventsHandler.ts:100 | P1 | 6h |
| 获取当前用户 | paperEvaluation.ts:54 | P0 | 1h |
| 推荐算法 | paperEvaluation.ts:85 | P3 | 16h |
| 加载评估数据 | paperEvaluation.ts:125 | P1 | 3h |
| 保存评估数据 | paperEvaluation.ts:145 | P1 | 3h |
| 元素高亮显示 | onboarding.ts:317 | P2 | 4h |
| 预览对话框 | diagnostics.ts:416 | P3 | 6h |
| 测试API连接 | configValidator.ts:262 | P1 | 2h |

**总计**: 10项, 53小时工作量

### 网站

| TODO | 位置 | 优先级 | 预计工时 |
|------|------|--------|---------|
| 实现hit rate tracking | emailValidationMonitor.ts:223 | P3 | 2h |

### 浏览器扩展

| TODO | 描述 | 优先级 | 预计工时 |
|------|------|--------|---------|
| TypeScript迁移 | 全部文件 | P0 | 16h |
| 构建系统 | 添加Vite | P0 | 8h |
| 模块化拆分 | 12个文件 | P1 | 12h |

---

## 📊 附录B: 推荐工具链

### 代码质量
- **ESLint**: 代码规范检查
- **Prettier**: 代码格式化
- **SonarQube**: 代码质量分析
- **jscpd**: 重复代码检测

### 测试
- **Jest**: 单元测试
- **React Testing Library**: 组件测试
- **Playwright**: E2E测试
- **MSW**: API Mock

### 性能
- **Lighthouse CI**: 性能监控
- **Bundle Analyzer**: 包大小分析
- **React DevTools Profiler**: React性能分析

### 文档
- **TypeDoc**: API文档生成
- **Storybook**: 组件文档
- **Docusaurus**: 项目文档站

### CI/CD
- **GitHub Actions**: 自动化流程
- **Renovate Bot**: 依赖更新
- **Husky**: Git Hooks
- **Lint-staged**: 增量检查

---

## 🎯 立即行动计划 (Q1 2025)

### Week 1-2: 基础设施
- [ ] 浏览器扩展TypeScript迁移
- [ ] 建立Monorepo (@researchopia/shared)
- [ ] 配置统一ESLint规则

### Week 3-4: 质量保障
- [ ] Zotero插件单元测试 (目标30%覆盖率)
- [ ] 网站代码审计
- [ ] 重复代码检测和清理

### Week 5-6: 技术债清理
- [ ] 清理Zotero插件10个TODO
- [ ] 网站API统一错误处理
- [ ] 浏览器扩展模块化

### Week 7-8: 自动化
- [ ] CI/CD完善 (自动测试、审计)
- [ ] 代码健康度仪表板
- [ ] 文档自动生成

---

**总结**: 当前项目整体健康,Zotero插件为最佳实践标杆。关键是将成功经验推广到网站和浏览器扩展,建立持续改进机制,防止技术债累积。
