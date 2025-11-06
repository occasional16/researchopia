# Zotero 插件代码模块化优化指南

## 📋 目录
1. [概述](#概述)
2. [模块化原则](#模块化原则)
3. [文件大小指标](#文件大小指标)
4. [重构流程](#重构流程)
5. [标准模块结构](#标准模块结构)
6. [已完成重构案例](#已完成重构案例)
7. [待重构功能清单](#待重构功能清单)
8. [代码复用策略](#代码复用策略)

---

## 概述

本指南旨在为 Researchopia Zotero 插件的功能代码提供模块化优化的最佳实践。遵循本指南可以：
- 提高代码可维护性
- 减少重复代码
- 加快开发速度
- 降低 bug 率

---

## 模块化原则

### 1. 单一职责原则 (Single Responsibility Principle)
每个模块/类只负责一个功能领域：
- ✅ **好**: `sessionCard.ts` - 专门处理会话卡片的创建
- ❌ **差**: `readingSessionView.ts` - 包含会话管理、标注、成员、聊天等多个功能

### 2. 高内聚低耦合
- **高内聚**: 相关功能放在同一模块
- **低耦合**: 模块之间通过接口/回调通信

### 3. 代码复用优先
- 识别跨功能的重复代码
- 提取到共享工具模块
- 通过参数化支持不同场景

### 4. 分层架构
```
核心业务逻辑 (Manager)
    ↓
视图控制器 (View)
    ↓
UI 组件 (Components)
    ↓
工具函数 (Utils/Helpers)
```

---

## 文件大小指标

### 推荐文件大小
| 文件类型 | 理想行数 | 警戒行数 | 紧急重构 |
|---------|---------|---------|---------|
| 工具函数 | 100-200 | 300 | 500+ |
| UI 组件 | 150-250 | 400 | 600+ |
| 视图类 | 300-500 | 800 | 1200+ |
| 管理器类 | 400-600 | 1000 | 1500+ |

### 当前状态 (2024-10-30)
| 文件 | 行数 | 状态 | 优先级 |
|-----|------|------|--------|
| readingSessionView.ts | 2653 | ⚠️ 需重构 | P1 |
| sharedAnnotationsView.ts | 1722 | ⚠️ 需重构 | P2 |
| readingSessionManager.ts | ~800 | ✅ 可接受 | P3 |

---

## 重构流程

### 第一阶段：识别功能边界
1. **统计文件行数**
   ```powershell
   (Get-Content 'file.ts').Count
   ```

2. **分析方法数量和大小**
   ```powershell
   # 查找所有方法
   grep -E "^\s*(private|public|protected)\s+(async\s+)?\w+\(" file.ts
   ```

3. **识别功能模块**
   - 标注相关: render/refresh/filter/sort annotations
   - 成员相关: member list/selection/invite
   - 事件相关: event timeline/logging
   - 聊天相关: chat window/messages/polling

### 第二阶段：提取共享工具
1. **创建工具模块** (优先级最高)
   - `annotationUtils.ts`: 标注去重、批量显示、PDF 定位
   - `uiHelpers.ts`: 按钮、输入框、卡片、状态组件
   - `styles.ts`: 颜色、间距、字体、组件样式

2. **识别重复代码**
   ```bash
   # 比较两个文件中的相似方法
   diff -u file1.ts file2.ts | grep "^-\|^+" | less
   ```

3. **统一接口设计**
   ```typescript
   // 好的设计: 通过 options 支持多种场景
   function createButton(text: string, options?: {
     variant?: 'primary' | 'success' | 'danger' | 'warning';
     icon?: string;
     onClick?: () => void;
   })
   ```

### 第三阶段：提取视图组件
1. **创建独立视图类**
   - 每个视图类管理一个 UI 区域
   - 示例: `SessionListView`, `SessionPlazaView`

2. **视图类结构**
   ```typescript
   export class ExampleView {
     constructor(private context: BaseViewContext) {}
     
     public async render(container: HTMLElement): Promise<void> {
       // 渲染逻辑
     }
     
     public destroy(): void {
       // 清理资源
     }
   }
   ```

3. **在主视图中集成**
   ```typescript
   // 主视图简化为协调器
   private exampleView: ExampleView;
   
   constructor(context: BaseViewContext) {
     this.exampleView = new ExampleView(context);
   }
   ```

### 第四阶段：验证和测试
1. **编译检查**
   ```bash
   npm run build
   ```

2. **功能测试**
   - 测试原有功能是否正常
   - 检查是否有遗漏的边界情况

3. **性能检查**
   - 对比重构前后的构建时间
   - 确保没有引入性能回归

---

## 标准模块结构

### 1. 工具函数模块 (utils/helpers)
```typescript
// src/modules/ui/annotationUtils.ts
/**
 * 标注工具函数
 * 提供跨功能的标注处理能力
 */

// 导出类型定义
export type BatchDisplayFilter = 'all' | 'following' | 'clear';

// 导出纯函数
export function deduplicateAnnotations<T>(items: T[]): T[] {
  // 实现
}

// 导出带配置的函数
export function createToolbar(
  doc: Document,
  onAction: (action: string) => void,
  options?: { ... }
): HTMLElement {
  // 实现
}
```

### 2. UI 组件模块
```typescript
// src/modules/ui/sessionCard.ts
import { styles } from './styles';

export interface SessionCardOptions {
  showInviteCode?: boolean;
  showCreator?: boolean;
  onJoin?: (sessionId: string) => void;
}

export function createSessionCard(
  doc: Document,
  session: ReadingSession,
  options: SessionCardOptions = {}
): HTMLElement {
  // 创建卡片
}
```

### 3. 视图类模块
```typescript
// src/modules/ui/sessionAnnotationsView.ts
import type { BaseViewContext } from './types';

export class SessionAnnotationsView {
  private annotations: Annotation[] = [];
  
  constructor(private context: BaseViewContext) {}
  
  public async render(container: HTMLElement): Promise<void> {
    // 渲染标注列表
  }
  
  public async refresh(): Promise<void> {
    // 刷新数据
  }
  
  public destroy(): void {
    // 清理监听器
  }
}
```

### 4. 样式常量模块
```typescript
// src/modules/ui/styles.ts
export const colors = {
  primary: '#0d6efd',
  success: '#198754',
  danger: '#dc3545',
  // ...
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  // ...
};

export const buttonStyles = {
  primary: {
    color: colors.primary,
    hoverBg: colors.primary,
    // ...
  },
  // ...
};
```

---

## 已完成重构案例

### 案例 1: readingSessionView 初步重构
**背景**: 文件 3514 行，包含所有功能

**重构内容**:
1. 提取样式常量 → `styles.ts` (169 行)
2. 提取会话卡片 → `sessionCard.ts` (217 行)
3. 提取 UI 工具 → `uiHelpers.ts` (289 行)
4. 提取会话列表视图 → `sessionListView.ts` (305 行)
5. 提取公共会话广场 → `sessionPlazaView.ts` (176 行)
6. 提取创建表单 → `sessionCreateFormView.ts` (185 行)
7. 提取私有会话加入 → `sessionJoinPrivateView.ts` (107 行)

**成果**:
- 主文件减少到 2653 行 (减少 24.5%)
- 创建 7 个独立模块，共 1448 行
- 删除 8+ 重复方法

**经验教训**:
- ✅ 先提取样式和通用工具，影响范围最小
- ✅ 按功能边界提取视图，逻辑清晰
- ✅ 保持原有功能不变，增量重构

### 案例 2: 标注代码统一
**背景**: readingSessionView 和 sharedAnnotationsView 有大量重复的标注处理代码

**重构内容**:
1. 创建 `annotationUtils.ts` (300 行)
2. 提取 `deduplicateAnnotations`: 去重逻辑完全相同
3. 提取 `createBatchDisplayToolbar`: 批量显示工具栏，通过 options 支持不同场景
4. 提取 `locateAnnotationInPDF`: PDF 定位逻辑
5. 提取 `openPDFReader`: PDF 阅读器打开逻辑

**成果**:
- readingSessionView: 2653 行 (减少 84 行)
- sharedAnnotationsView: 1722 行 (减少 112 行)
- 避免未来修改时的双重维护

**经验教训**:
- ✅ 从完全相同的方法开始 (deduplicateAnnotations)
- ✅ 对不完全相同的方法，用 options 参数化 (createBatchDisplayToolbar)
- ⚠️ 对高度定制化的方法，保留在原文件 (handleLocateAnnotation 使用 PDFReaderManager)

---

## 待重构功能清单

### readingSessionView.ts (2653 行)

#### P1: 标注功能模块 (~600-800 行)
**提取目标**: `sessionAnnotationsView.ts`

包含方法:
- `renderAnnotationsList`: 渲染标注列表
- `refreshAnnotationsList`: 刷新标注
- `renderAnnotationCards`: 渲染标注卡片
- `createAnnotationsToolbar`: 创建工具栏(筛选/排序)
- `applySortFilter`: 应用排序和过滤
- `showMemberSelectionDialog`: 成员选择对话框

预期成果:
- 主文件减少 600+ 行
- 新建 sessionAnnotationsView.ts (~400 行)

#### P2: 成员列表模块 (~200-300 行)
**提取目标**: `sessionMembersView.ts`

包含方法:
- `renderMembersList`: 渲染成员列表
- `refreshMembersList`: 刷新成员
- `createMemberCard`: 创建成员卡片
- `handleMemberAction`: 处理成员操作(提升/踢出)

#### P3: 事件时间线模块 (~200 行)
**提取目标**: `sessionEventsView.ts`

包含方法:
- `renderEventTimeline`: 渲染事件时间线
- `createEventCard`: 创建事件卡片
- `formatEventDescription`: 格式化事件描述
- `getEventConfig`: 获取事件配置(图标/颜色)

#### P4: 聊天窗口模块 (~300-400 行)
**提取目标**: `sessionChatView.ts`

包含方法:
- `renderChatWindow`: 渲染聊天窗口
- `loadChatMessages`: 加载聊天消息
- `createMessageElement`: 创建消息元素
- `handleSendMessage`: 发送消息
- `startChatPolling`: 聊天轮询

**最终目标**:
- readingSessionView.ts: 1200-1500 行 (减少 ~1100 行)
- 新增 4 个视图模块: ~1500 行

---

### sharedAnnotationsView.ts (1722 行)

#### P1: 评论/回复功能 (~400-500 行)
**提取目标**: `annotationCommentsView.ts`

包含方法:
- `showCommentsSection`: 显示评论区
- `renderCommentNode`: 渲染评论节点
- `toggleReplyBox`: 切换回复框
- `toggleEditMode`: 切换编辑模式
- `handleSubmitComment`: 提交评论
- `handleDeleteComment`: 删除评论

#### P2: 点赞/互动功能 (~100-150 行)
**提取目标**: 可合并到 `annotationUtils.ts`

包含方法:
- `handleLikeAnnotation`: 点赞标注
- `updateLikeButton`: 更新点赞按钮状态

**最终目标**:
- sharedAnnotationsView.ts: 1200-1400 行
- 减少 ~300-500 行

---

## 代码复用策略

### 1. 识别重复代码的方法

#### 方法 1: 手动比对
```bash
# 查找两个文件中相似的方法名
grep "private.*function\|private async" file1.ts > methods1.txt
grep "private.*function\|private async" file2.ts > methods2.txt
diff methods1.txt methods2.txt
```

#### 方法 2: 代码搜索
```bash
# 查找包含特定关键字的方法
grep -r "deduplicateAnnotations" src/
grep -r "createBatchDisplay" src/
```

### 2. 评估是否统一

#### 完全相同 → 直接提取
```typescript
// ✅ 两个文件中完全相同,直接提取
private deduplicateAnnotations(annotations: any[]): any[] {
  const seen = new Set<string>();
  const unique: any[] = [];
  for (const annotation of annotations) {
    const key = annotation.id;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(annotation);
    }
  }
  return unique;
}
```

#### 高度相似 → 参数化
```typescript
// ✅ 80% 相同,通过 options 参数化
function createBatchDisplayToolbar(
  doc: Document,
  onFilterChange: (filter: string) => void,
  options?: {
    showFollowingButton?: boolean;
    followingButtonText?: string;  // 自定义按钮文本
  }
): HTMLElement {
  // 实现
}
```

#### 部分相似 → 提取公共部分
```typescript
// ✅ 提取公共逻辑,保留差异化部分
// 公共部分: annotationUtils.ts
export function openPDFReader(item: any, pageNumber?: number): Promise<boolean> {
  // 基础 PDF 打开逻辑
}

// 差异化部分: readingSessionView.ts
private async handleLocateAnnotation(annotation: SessionAnnotation) {
  // 使用 PDFReaderManager 的高级逻辑
  const readerManager = PDFReaderManager.getInstance();
  await readerManager.highlightAnnotation(...);
}
```

#### 完全不同 → 保持独立
```typescript
// ❌ 逻辑完全不同,不强行统一
// 共读会话: 显示选中成员的标注
private async showSelectedMembersAnnotations() { ... }

// 标注共享: 显示关注用户的标注
private async showFollowingUsersAnnotations() { ... }
```

### 3. 重构检查清单

- [ ] 功能是否完全一致?
- [ ] 是否可以通过参数化统一?
- [ ] 统一后是否增加理解难度?
- [ ] 是否有 3+ 处使用该代码?
- [ ] 未来是否需要同步修改?

**原则**: 如果统一后代码更复杂,或只有 2 处使用,可以保持独立。

---

## 最佳实践总结

### 1. 重构时机
- ✅ **新功能开发前**: 先重构相关模块,再开发新功能
- ✅ **修复 Bug 时**: 如果 Bug 涉及大文件,先重构再修复
- ❌ **紧急修复时**: 不在紧急情况下重构,避免引入新问题

### 2. 重构粒度
- **第一次重构**: 提取 30-40% 代码
- **第二次重构**: 再提取 20-30%
- **稳定维护**: 保持 1200-1500 行

### 3. 命名规范
| 类型 | 命名格式 | 示例 |
|-----|---------|------|
| 视图类 | `[Feature]View` | `SessionAnnotationsView` |
| 工具模块 | `[feature]Utils/Helpers` | `annotationUtils.ts` |
| UI 组件 | `[component]` | `sessionCard.ts` |
| 样式模块 | `styles.ts` | 统一样式常量 |

### 4. 导入顺序
```typescript
// 1. 外部依赖
import { logger } from "../../utils/logger";

// 2. 类型定义
import type { BaseViewContext } from "./types";

// 3. 管理器类
import { ReadingSessionManager } from "../readingSessionManager";

// 4. 视图类
import { SessionListView } from "./sessionListView";

// 5. UI 组件
import { createSessionCard } from "./sessionCard";

// 6. 工具函数
import { deduplicateAnnotations } from "./annotationUtils";
import { createButton } from "./uiHelpers";
import { formatDate } from "./helpers";
```

### 5. 测试策略
1. **编译测试**: `npm run build` 必须通过
2. **功能测试**: 每个重构后手动测试原有功能
3. **增量提交**: 每完成一个模块提取,立即提交
4. **文档更新**: 更新代码注释和文档

---

## 附录: 工具脚本

### 统计文件行数
```powershell
# PowerShell
Get-ChildItem -Path "src/modules/ui" -Filter "*.ts" | 
  ForEach-Object { 
    [PSCustomObject]@{
      File = $_.Name
      Lines = (Get-Content $_.FullName).Count
    }
  } | 
  Sort-Object -Property Lines -Descending
```

### 查找大文件
```powershell
Get-ChildItem -Path "src" -Recurse -Filter "*.ts" | 
  Where-Object { (Get-Content $_.FullName).Count -gt 1000 } |
  ForEach-Object {
    Write-Host "$($_.Name): $((Get-Content $_.FullName).Count) lines"
  }
```

### 查找重复代码
```bash
# 查找相似的方法名
find src/ -name "*.ts" -exec grep -H "private.*deduplicate" {} \;
find src/ -name "*.ts" -exec grep -H "private.*createBatch" {} \;
```

---

## 结语

代码模块化是一个持续的过程,不是一次性任务。遵循本指南,可以:
- 逐步改善代码质量
- 降低维护成本
- 加快新功能开发
- 减少 Bug 率

**记住**: 完美是优秀的敌人。先让代码工作,再让代码优雅,最后让代码完美。

---

**文档版本**: v1.0  
**最后更新**: 2024-10-30  
**维护者**: Researchopia Team
