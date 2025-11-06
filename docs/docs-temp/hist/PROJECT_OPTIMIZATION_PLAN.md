# Researchopia 项目优化方案

**版本**: v1.0  
**日期**: 2025-11-02  
**目标**: 规范化项目结构，提升代码质量，便于AI长期开发和维护

---

## 一、总体策略

### 优化原则
1. **渐进式改进**: 分阶段进行，避免大规模重构带来的风险
2. **优先级驱动**: 先解决影响最大、风险最小的问题
3. **持续验证**: 每个阶段完成后进行测试验证
4. **文档先行**: 先完善文档，再进行代码重构

### 三阶段计划
- **Phase 1**: 基础设施巩固 (1-2周)
- **Phase 2**: 代码模块化重构 (2-3周)  
- **Phase 3**: 功能完善优化 (1-2周)

---

## 二、Phase 1: 基础设施巩固 (优先级: P0) - ✅ 已完成

### 1.1 文档整理 (3天) - ✅ 已完成

#### 任务清单
- [✅] 更新根目录 `README.md`
  - 项目简介和核心功能
  - 快速开始指南
  - 项目结构说明 (移至DEVELOPMENT.md)
  - 文档导航链接

- [✅] 创建 `docs/ARCHITECTURE.md`
  - 整体架构图
  - 技术栈说明
  - 各模块职责
  - 数据库设计(7表+RLS+触发器)

- [✅] 创建 `docs/CONTRIBUTING.md`
  - 开发环境配置
  - 代码规范
  - 提交流程

- [✅] 整合现有文档
  - 创建8层文档体系 (6136+行)
  - 创建docs/README.md作为统一导航
  - 更新所有GitHub URLs
  - 实现版本管理系统

#### 文档模板

**README.md 结构**:
```markdown
# Researchopia - 研学港

## 项目简介
学术研究协作平台，包含网站、Zotero插件和浏览器扩展

## 快速开始
### 网站开发
npm install && npm run dev

### Zotero插件开发  
cd zotero-plugin && npm start

### 浏览器扩展
加载 extension/ 到Chrome

## 文档
- [架构说明](./docs/ARCHITECTURE.md)
- [开发指南](./docs/CONTRIBUTING.md)
- [API文档](./docs/API.md)
```

### 1.2 API代理改造收尾 (5天) - ✅ 已完成

#### 最终状态
✅ 已完成: Auth, PaperRegistry, ReadingSession, Annotations, 所有标注相关API  
✅ 清理完成: `env.ts`中Supabase配置已标记为弃用并留空
✅ 验证通过: 插件端无直接Supabase调用 (grep搜索确认)

#### 任务清单
- [✅] 已完成的API保持稳定
- [✅] 清理 `env.ts` 中的直接Supabase配置
  - 添加@deprecated注释
  - supabaseUrl和supabaseAnonKey留空
  - 添加弃用警告日志
- [✅] 编写 API 文档 (`docs/API.md`) 
  - 1194行文档
  - 30+端点完整说明
  - 包含认证、请求/响应格式、错误处理
- [✅] 添加错误处理和重试机制
  - apiClient.ts实现统一重试逻辑
  - 最多2次重试
  - 5秒超时
  - 完整错误类型定义
- [⏳] 编写单元测试(核心API) - 推迟到Phase 3

#### 验收标准 - ✅ 全部通过
- [✅] 所有插件API调用走Next.js代理
- [✅] 无直接Supabase客户端调用
- [✅] 编译无错误
- [✅] 功能测试通过
- [✅] Vercel部署成功

---

## 三、Phase 2: 代码模块化重构 (优先级: P1) - 🚧 进行中

### 3.1 提取共享工具模块 (3天) - 🚧 Day 1进行中

**目标**: 创建可复用的工具模块，减少代码重复

#### 当前状态
- annotationUtils.ts: 305行
- styles.ts: 171行  
- helpers.ts: 295行
- uiHelpers.ts: 280行

#### 任务清单

**Day 1**: 扩展现有工具 - 🚧 进行中
- [🚧] `annotationUtils.ts`: 添加更多标注处理函数
- [🚧] `styles.ts`: 统一样式常量
- [🚧] `helpers.ts`: 通用工具函数

**Day 2**: 创建UI组件库
- [ ] `uiHelpers.ts`: 统一的UI组件创建
  - createButton() - 按钮
  - createCard() - 卡片
  - createInput() - 输入框
  - createDialog() - 对话框

**Day 3**: 测试和文档
- [ ] 编译测试
- [ ] 功能测试
- [ ] 编写使用文档

### 3.2 重构 readingSessionView.ts (7天)

**当前状态**: 2653行，包含多个功能模块  
**目标**: 减少到 1200-1500行

#### 重构计划

**Day 1-2**: 提取标注模块
```typescript
// 创建 sessionAnnotationsView.ts (~400行)
export class SessionAnnotationsView {
  async render(container: HTMLElement): Promise<void>
  async refresh(): Promise<void>
  private renderAnnotationCards(): void
  private createToolbar(): HTMLElement
}
```

**Day 3-4**: 提取成员模块
```typescript
// 创建 sessionMembersView.ts (~300行)
export class SessionMembersView {
  async render(container: HTMLElement): Promise<void>
  async refresh(): Promise<void>
  private createMemberCard(): HTMLElement
}
```

**Day 5**: 提取事件模块
```typescript
// 创建 sessionEventsView.ts (~200行)
export class SessionEventsView {
  async render(container: HTMLElement): Promise<void>
  private createEventCard(): HTMLElement
}
```

**Day 6-7**: 提取聊天模块
```typescript
// 创建 sessionChatView.ts (~400行)
export class SessionChatView {
  async render(container: HTMLElement): Promise<void>
  async sendMessage(text: string): Promise<void>
  private loadMessages(): Promise<void>
}
```

#### 重构流程模板
```
每个模块:
1. 创建新文件和类结构
2. 复制相关方法
3. 更新导入和引用
4. 编译测试
5. 功能测试
6. Git commit
```

### 3.3 重构 sharedAnnotationsView.ts (5天)

**当前状态**: 1722行  
**目标**: 减少到 1200-1400行

#### 重构计划

**Day 1-3**: 提取评论模块
```typescript
// 创建 annotationCommentsView.ts (~500行)
export class AnnotationCommentsView {
  async render(container: HTMLElement): Promise<void>
  async addComment(text: string): Promise<void>
  async deleteComment(id: string): Promise<void>
}
```

**Day 4-5**: 优化主文件
- 将点赞功能迁移到 `annotationUtils.ts`
- 清理重复代码
- 测试和验证

---

## 四、Phase 3: 功能完善优化 (优先级: P2)

### 4.1 修复已知问题 (3天)

#### 问题清单
- [ ] 标注实时同步: 移除重复监听器 (已修复，需测试)
- [ ] 聊天消息显示: 调查并修复
- [ ] 事件时间轴: 添加标注事件日志

### 4.2 性能优化 (2天)
- [ ] 减少不必要的API调用
- [ ] 优化标注列表渲染(虚拟滚动?)
- [ ] 添加缓存机制

### 4.3 用户体验提升 (3天)
- [ ] 添加加载状态提示
- [ ] 改进错误提示
- [ ] 添加操作确认对话框

---

## 五、开发规范

### Git 工作流
```bash
# 主分支
main - 稳定版本
dev  - 开发分支

# 功能分支
feature/xxx  - 新功能
refactor/xxx - 重构
fix/xxx      - 修复
```

### 提交规范
```
feat: 新功能
fix: 修复bug
refactor: 重构
docs: 文档更新
test: 测试
chore: 构建/工具
```

### 测试清单
每次重构后:
- [ ] `npm run build` 编译成功
- [ ] 插件加载成功
- [ ] 核心功能测试通过
- [ ] 无控制台错误

---

## 六、里程碑和时间线

### ✅ Week 1: 基础巩固 (已完成)
- [✅] Day 1-3: 文档整理
  - 创建8层文档体系 (6136+行)
  - 版本管理系统实现
  - GitHub URLs更新
- [✅] Day 4-5: API代理收尾
  - 清理env.ts
  - 验证无直接Supabase调用
  - 网站评论刷新优化(方案A: 3-5分钟更新)

### 🚧 Week 2-3: 核心重构 (待开始)
- Week 2: 提取工具 + 重构 readingSessionView (前半)
- Week 3: 完成 readingSessionView + 重构 sharedAnnotationsView

### Week 4: 收尾优化
- Day 1-3: 修复已知问题
- Day 4-5: 性能和体验优化

---

## 七、风险控制

### 备份策略
- 每个重构前创建 Git tag
- 保留原代码至少1个版本

### 回滚方案
- 功能开关: `useNewModules` 配置
- 快速回滚: `git revert`

### 质量保证
- 代码审查
- 功能测试
- 性能监控

---

## 八、立即行动清单

### 今天可以做
1. [ ] 创建 `docs/` 文件夹
2. [ ] 备份当前 README.md
3. [ ] 按模板重写 README.md 前3节
4. [ ] 创建 CONTRIBUTING.md 框架

### 明天可以做
1. [ ] 完成所有文档初版
2. [ ] 整理 env.ts 配置
3. [ ] 列出缺失的API端点
4. [ ] 绘制架构图

---

## 九、成功标准

### Phase 1 完成标准 - ✅ 全部达成
- [✅] 文档完整且最新 (8个核心文档, 6136+行)
- [✅] API全部走代理 (插件端无直接Supabase调用)
- [✅] 编译和测试通过 (本地+Vercel构建成功)

### Phase 2 完成标准
- ✅ readingSessionView.ts < 1500行
- ✅ sharedAnnotationsView.ts < 1400行
- ✅ 新增4个视图模块
- ✅ 功能无退化

### Phase 3 完成标准
- ✅ 已知问题全部修复
- ✅ 性能提升可测量
- ✅ 用户体验改善

---

## 十、参考资源

### 相关文档
- `CODE_MODULARIZATION_GUIDE.md` - 模块化详细指南
- `API_PROXY_MIGRATION_PROGRESS.md` - API改造进度

### 工具和命令
```bash
# 统计文件行数
(Get-Content file.ts).Count

# 查找大文件
Get-ChildItem -Recurse -Filter "*.ts" | Where-Object { 
  (Get-Content $_.FullName).Count -gt 1000 
}

# 编译检查
npm run build

---

**注意**: 本文档为指导性文件，实际执行时应根据项目进展灵活调整。优先保证功能稳定，再追求代码优化。建议按 **文档 → API → 模块化** 的顺序进行,每个阶段都有明确的交付物和验收标准。最重要的是:**不要试图一次性完成所有重构,而是分阶段、增量式地改进。**

**维护者**: Researchopia Team  
**最后更新**: 2025-11-02
