# 17. 统一评价系统重构方案

> **目标**: 统一论文评价和网页评价的组件架构，实现代码复用和一致的用户体验

---

## 1. 现状分析

### 1.1 当前4个评价入口

| # | 入口 | 评价对象 | 技术栈 | 认证方式 |
|---|------|---------|--------|----------|
| 1 | 网站论文详情页 | 论文 | React + AuthContext | Cookie |
| 2 | Zotero插件侧边栏 | 论文 | 原生HTML + API | Bearer Token |
| 3 | 网站网页详情页 | 网页 | React (待开发) | Cookie |
| 4 | 浏览器扩展侧边栏 | 网页 | 原生HTML + API | Bearer Token |

### 1.2 核心问题

1. **组件不统一**: 论文评分用 `RatingForm.tsx`，扩展用原生 JS
2. **字段命名混乱**: `innovation_score` vs `quality_score` vs `qualityRating`
3. **API 认证不一致**: 部分 API 仅支持 Cookie，部分同时支持 Bearer
4. **评论功能差距**: 论文支持嵌套回复+点赞，网页仅单层评论

---

## 2. 目标架构

### 2.1 分层设计

```
┌─────────────────────────────────────────────────────────┐
│                     展示层 (UI)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ 网站 React   │  │ Zotero HTML  │  │ 扩展 HTML    │   │
│  │ 组件         │  │ + JS         │  │ + JS         │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
├─────────────────────────────────────────────────────────┤
│                   API 层 (Next.js)                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │ /api/ratings/* - 统一评分 API                    │    │
│  │ /api/comments/* - 统一评论 API                   │    │
│  │ 支持: Cookie + Bearer Token 双认证               │    │
│  └─────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│                  数据层 (Supabase)                       │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │ ratings      │  │ comments     │                     │
│  │ (通用评分表)  │  │ (通用评论表)  │                     │
│  └──────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

### 2.2 核心原则

1. **API 统一**: 所有评价操作通过 `/api/ratings` 和 `/api/comments`
2. **双认证支持**: 每个 API 同时支持 Cookie 和 Bearer Token
3. **类型区分**: 通过 `target_type` 字段区分论文/网页
4. **渐进式改造**: 保持向后兼容，逐步迁移

---

## 3. 数据模型设计

### 3.1 统一评分表 (ratings)

```sql
-- 方案A: 新建统一表 (推荐)
CREATE TABLE unified_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(20) NOT NULL,     -- 'paper' | 'webpage'
  target_id UUID NOT NULL,              -- paper.id 或 webpage.id
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- 通用评分维度 (1-5)
  dimension_1 SMALLINT CHECK (dimension_1 BETWEEN 1 AND 5),  -- 论文:创新性 | 网页:内容质量
  dimension_2 SMALLINT CHECK (dimension_2 BETWEEN 1 AND 5),  -- 论文:方法论 | 网页:实用性
  dimension_3 SMALLINT CHECK (dimension_3 BETWEEN 1 AND 5),  -- 论文:实用性 | 网页:准确性
  overall_score SMALLINT NOT NULL CHECK (overall_score BETWEEN 1 AND 5),
  
  is_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(target_type, target_id, user_id)
);
```

### 3.2 统一评论表 (comments)

```sql
-- 方案A: 新建统一表 (推荐)
CREATE TABLE unified_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(20) NOT NULL,     -- 'paper' | 'webpage'
  target_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  parent_id UUID REFERENCES unified_comments(id),
  
  content TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  likes_count INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 迁移策略

- **阶段1**: 创建新表 + 新 API (向后兼容旧表)
- **阶段2**: 迁移旧数据到新表
- **阶段3**: 切换客户端到新 API
- **阶段4**: 删除旧表和旧 API

---

## 4. API 设计

### 4.1 统一评分 API

```
POST   /api/v2/ratings           创建/更新评分
GET    /api/v2/ratings           获取评分列表
DELETE /api/v2/ratings/:id       删除评分

Query Params:
  target_type: 'paper' | 'webpage'
  target_id: UUID

Request Body (POST):
{
  "target_type": "webpage",
  "target_id": "uuid",
  "scores": {
    "dimension_1": 4,
    "dimension_2": 5,
    "dimension_3": 4,
    "overall": 5
  },
  "is_anonymous": false
}
```

### 4.2 统一评论 API

```
POST   /api/v2/comments          创建评论
GET    /api/v2/comments          获取评论列表 (支持嵌套)
PATCH  /api/v2/comments/:id      编辑评论
DELETE /api/v2/comments/:id      删除评论
POST   /api/v2/comments/:id/like 点赞

Query Params:
  target_type: 'paper' | 'webpage'
  target_id: UUID
  nested: true | false
```

### 4.3 认证中间件

```typescript
// src/lib/api-auth.ts
export async function getAuthUser(request: NextRequest) {
  // 1. 尝试 Bearer Token
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (token) {
    const supabase = createClientWithToken(token)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) return { supabase, user }
  }
  
  // 2. 尝试 Cookie
  const cookieStore = await cookies()
  const supabase = createServerClient(...)
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}
```

---

## 5. 组件设计

### 5.1 React 组件结构

```
src/components/evaluation/
├── shared/                      # 通用基础组件
│   ├── StarInput.tsx            # 星级输入 (可复用)
│   ├── StarDisplay.tsx          # 星级展示
│   ├── AnonymousToggle.tsx      # 匿名开关
│   └── CommentEditor.tsx        # 评论编辑器
│
├── rating/                      # 评分组件
│   ├── RatingForm.tsx           # 通用评分表单
│   ├── RatingStats.tsx          # 评分统计展示
│   └── adapters/
│       ├── PaperRatingAdapter.tsx   # 论文适配器
│       └── WebpageRatingAdapter.tsx # 网页适配器
│
└── comments/                    # 评论组件
    ├── CommentForm.tsx          # 评论表单
    ├── CommentList.tsx          # 评论列表
    ├── CommentItem.tsx          # 单条评论
    └── NestedComments.tsx       # 嵌套评论树
```

### 5.2 组件 Props 接口

```typescript
// 通用评分表单接口
interface RatingFormProps {
  targetType: 'paper' | 'webpage'
  targetId: string
  dimensions: DimensionConfig[]  // 评分维度配置
  onSubmit?: (rating: Rating) => void
}

interface DimensionConfig {
  key: string       // dimension_1, dimension_2, ...
  label: string     // "创新性", "内容质量"
  description: string
}

// 论文评分维度
const PAPER_DIMENSIONS: DimensionConfig[] = [
  { key: 'dimension_1', label: '创新性', description: '研究思路和方法的创新程度' },
  { key: 'dimension_2', label: '方法论', description: '研究方法的科学性和严谨性' },
  { key: 'dimension_3', label: '实用性', description: '研究成果的应用价值' },
]

// 网页评分维度
const WEBPAGE_DIMENSIONS: DimensionConfig[] = [
  { key: 'dimension_1', label: '内容质量', description: '内容的深度和完整性' },
  { key: 'dimension_2', label: '实用性', description: '内容的实际应用价值' },
  { key: 'dimension_3', label: '准确性', description: '信息的准确性和可靠性' },
]
```

### 5.3 非 React 环境适配 (扩展/插件)

```javascript
// extension/lib/rating-api.js
// 提供统一的 API 调用封装，供原生 JS 使用

export class RatingAPI {
  constructor(serverUrl, accessToken) {
    this.serverUrl = serverUrl
    this.accessToken = accessToken
  }

  async submitRating(targetType, targetId, scores) {
    return fetch(`${this.serverUrl}/api/v2/ratings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: JSON.stringify({ target_type: targetType, target_id: targetId, scores })
    })
  }
}
```

---

## 6. 实施计划

### Phase 0: 浏览器扩展 TypeScript 迁移 (可选优化)
- [x] 配置扩展构建环境 (esbuild/tsconfig)
- [x] 将 `sidebar.js` 等迁移到 TypeScript，并模块化重构
- [x] 测试扩展功能正常

### Phase 1: API 层重构 ✅ 已完成
- [x] 创建统一认证中间件 `getAuthUser()` → `src/lib/api-auth.ts`
- [x] 实现 `/api/v2/ratings` API → `src/app/api/v2/ratings/route.ts`
- [x] 实现 `/api/v2/comments` API → `src/app/api/v2/comments/route.ts`
- [x] 旧 API 保留供标注评论使用 (暂不删除)

### Phase 2: 数据层重构 ✅ 已完成
- [x] **决策**: 暂不创建统一表，通过 API 层抽象现有 `ratings`/`webpage_ratings` 表
- [x] 添加 `show_username` 列到 `webpage_ratings` 表

### Phase 3: React 组件重构 ✅ 已完成 (详见 17.2)
- [x] 创建 `src/components/evaluation/shared/` 通用组件
  - `StarRating.tsx` - 可复用星级输入/展示组件
  - `EvaluationForm.tsx` - 统一评分表单(支持 paper/webpage)
  - `CommentForm.tsx` - 统一评论表单
  - `CommentList.tsx` - 统一评论列表(支持嵌套回复)
  - `RatingDisplay.tsx` - 统一评分统计展示(3种视图模式)
  - `index.ts` - 组件导出
- [x] 重构论文详情页使用新组件
- [x] 创建网页详情页使用新组件
- [x] 删除旧组件: `components/rating/`, `components/comments/`, `components/webpage-rating/`

### Phase 4: 扩展/插件适配 ⏳ 部分完成
- [x] 更新浏览器扩展使用新 API (sidebar.js 已适配 v2 API)
- [ ] 更新 Zotero 插件使用新 API (低优先级，当前实现独立)
- [x] 统一错误处理和用户提示

---

## 7. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 数据迁移失败 | 用户数据丢失 | 备份+回滚脚本+灰度发布 |
| API 不兼容 | 旧客户端崩溃 | 版本化 API (`/v2/`) + 渐进迁移 |
| 组件复杂度增加 | 维护成本上升 | 清晰的接口定义+完善的 TypeScript 类型 |

---

## 8. 验收标准

- [x] 4 个评价入口功能正常 (网站论文/网页详情页已完成，扩展已适配)
- [x] v2 API 工作正常
- [x] 旧 API 保留向后兼容 (标注评论使用)
- [x] 组件代码复用率 > 70% (evaluation/shared 被两处使用)
- [x] 无用户反馈功能异常

---

**文档版本**: v0.3  
**最后更新**: 2026-01-14  
**负责人**: Researchopia Team

### 更新日志
- v0.3 (2026-01-14): 完成 Phase 3 (组件重构)，标记 17.2 全部完成，清理旧组件
- v0.2 (2026-01-09): 完成 Phase 1 (API)、Phase 3 (组件)、Phase 4 (扩展)
- v0.1 (2026-01-08): 初始设计方案
