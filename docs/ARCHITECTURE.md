# Researchopia 架构说明

**版本**: v1.0  
**日期**: 2025-11-02

---

## 一、整体架构

Researchopia 采用**前后端分离 + 桌面集成**的混合架构，由三个主要部分组成：

```
┌─────────────────────────────────────────────────────────┐
│                  Researchopia 生态系统                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Next.js网站  │  │ Zotero插件   │  │ 浏览器扩展   │ │
│  │              │  │              │  │              │ │
│  │  Web平台     │  │  桌面集成    │  │  Web辅助     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │         │
│         └──────────────────┼──────────────────┘         │
│                            │                            │
│                    ┌───────▼────────┐                   │
│                    │  Supabase后端  │                   │
│                    │                │                   │
│                    │  - Auth        │                   │
│                    │  - PostgreSQL  │                   │
│                    │  - Storage     │                   │
│                    │  - Realtime    │                   │
│                    └────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

---

## 二、技术栈详解

### 2.1 Next.js 网站

**框架**: Next.js 15 (App Router)

**核心技术**:
- **React 18**: 用户界面构建
- **TypeScript**: 类型安全
- **Tailwind CSS**: 样式框架
- **Server Components**: 服务端渲染
- **API Routes**: 后端API代理

**主要功能模块**:
```
src/
├── app/              # App Router 页面
│   ├── page.tsx     # 首页
│   ├── search/      # 搜索页面
│   ├── papers/      # 论文详情
│   ├── profile/     # 用户档案
│   └── api/         # API 代理层
│       ├── auth/    # 认证API
│       ├── papers/  # 论文API
│       └── proxy/   # Supabase代理
├── components/       # React组件
│   ├── ui/          # 基础UI组件
│   ├── papers/      # 论文相关
│   ├── auth/        # 认证相关
│   └── layout/      # 布局组件
├── lib/             # 工具库
│   ├── supabase/    # Supabase客户端
│   ├── utils/       # 通用工具
│   └── hooks/       # React Hooks
└── types/           # TypeScript类型
```

### 2.2 Zotero 插件

**框架**: Zotero Plugin Toolkit

**核心技术**:
- **TypeScript**: 插件开发语言
- **Mozilla XUL/XHTML**: UI框架
- **Zotero API**: Zotero集成
- **Webpack**: 模块打包

**架构模式**: MVC + Service Layer

```
zotero-plugin/src/
├── addon.ts          # 插件入口
├── modules/          # 核心功能模块
│   ├── auth.ts      # 认证管理器
│   ├── ui-manager.ts               # UI管理器
│   ├── readingSessionManager.ts    # 会话管理
│   ├── supabaseManager.ts          # 数据管理
│   ├── paperRegistry.ts            # 论文注册
│   ├── pdfReaderManager.ts         # PDF阅读器
│   └── ui/                         # UI视图
│       ├── readingSessionView.ts   # 会话视图
│       ├── sharedAnnotationsView.ts # 标注视图
│       ├── myAnnotationsView.ts    # 我的标注
│       └── sessionListView.ts      # 会话列表
├── utils/            # 工具函数
│   ├── apiClient.ts # API客户端
│   ├── logger.ts    # 日志工具
│   └── helpers.ts   # 通用工具
└── config/           # 配置文件
    └── env.ts       # 环境配置
```

**关键模块**:

1. **AuthManager**: 用户认证和会话管理
2. **ReadingSessionManager**: 共读会话的创建、加入、同步
3. **SupabaseManager**: 数据库操作封装
4. **UIManager**: UI渲染和交互管理
5. **PDFReaderManager**: PDF阅读器集成

### 2.3 浏览器扩展

**标准**: Manifest V3

**核心技术**:
- **Vanilla JavaScript**: 轻量高效
- **Chrome Extension API**: 浏览器集成
- **Content Scripts**: 页面注入
- **Background Service Worker**: 后台服务

**文件结构**:
```
extension/
├── manifest.json     # 扩展清单
├── background.js     # 后台服务脚本
├── content.js        # 内容脚本(DOI检测)
├── content.css       # 样式(悬浮图标)
├── popup.html/js     # 弹窗界面
├── sidebar.html/js   # 侧边栏
└── icons/            # 图标资源
```

**工作流程**:
```
1. Content Script 检测 DOI
2. 显示悬浮图标
3. 点击打开侧边栏
4. 加载 Researchopia 网站
5. 自动填入 DOI 并搜索
```

---

## 三、数据流架构

### 3.1 认证流程

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Zotero插件  │────▶│  Next.js API │────▶│  Supabase    │
│             │     │  /api/proxy/ │     │  Auth        │
│  - login()  │     │    auth/     │     │              │
│  - token    │◀────│  - validate  │◀────│  - JWT       │
└─────────────┘     │  - refresh   │     │  - RLS       │
                    └──────────────┘     └──────────────┘
```

**安全机制**:
- JWT Token 认证
- 通过 Next.js API 代理
- Supabase RLS 数据权限控制
- Token 自动刷新机制

### 3.2 数据同步流程

**标注同步**:
```
Zotero PDF标注 ──▶ Zotero插件 ──▶ Next.js API ──▶ Supabase
                    │                                  │
                    │       ◀──────────────────────────┘
                    │     (Realtime订阅)
                    │
                    ▼
                UI更新(其他用户)
```

**会话同步**:
- **轮询机制**: 每5秒查询最新标注和成员状态
- **事件驱动**: Zotero标注事件触发同步
- **实时更新**: Supabase Realtime订阅(网站端)

### 3.3 API 代理架构

**为什么需要代理**:
1. **安全性**: 隐藏 Supabase 配置
2. **统一性**: 统一错误处理和日志
3. **可控性**: 添加中间件(缓存、限流)
4. **兼容性**: 版本控制和向后兼容

**代理流程**:
```
Zotero插件
    │
    │ HTTP Request (Authorization: Bearer <token>)
    ▼
Next.js API Route
    │
    ├─ Token验证
    ├─ 参数校验
    ├─ 业务逻辑
    │
    ▼
Supabase Admin Client
    │
    ▼
PostgreSQL + Storage + Realtime
```

**主要API端点**:
- `/api/proxy/auth/*` - 认证相关
- `/api/proxy/papers/*` - 论文管理
- `/api/proxy/reading-session/*` - 会话管理
- `/api/proxy/annotations/*` - 标注管理

---

## 四、数据库设计

### 4.1 核心表结构

**papers (论文表)**:
```sql
CREATE TABLE papers (
  id UUID PRIMARY KEY,
  doi TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  authors TEXT[] NOT NULL,
  abstract TEXT,
  journal TEXT,
  publication_date DATE,
  created_at TIMESTAMP,
  view_count INTEGER DEFAULT 0
);
```

**shared_annotations (共享标注)**:
```sql
CREATE TABLE shared_annotations (
  id UUID PRIMARY KEY,
  doi TEXT NOT NULL,
  user_id UUID REFERENCES auth.users,
  annotation_text TEXT,
  annotation_comment TEXT,
  page_number INTEGER,
  position JSONB,
  annotation_type TEXT,
  annotation_color TEXT,
  created_at TIMESTAMP
);
```

**reading_sessions (共读会话)**:
```sql
CREATE TABLE reading_sessions (
  id UUID PRIMARY KEY,
  paper_doi TEXT NOT NULL,
  session_type TEXT CHECK (session_type IN ('public', 'private')),
  invite_code TEXT UNIQUE,
  creator_id UUID REFERENCES auth.users,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP
);
```

**session_annotations (会话标注)**:
```sql
CREATE TABLE session_annotations (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES reading_sessions,
  user_id UUID REFERENCES auth.users,
  paper_doi TEXT NOT NULL,
  annotation_data JSONB NOT NULL,  -- 包含 zotero_key 用于去重
  page_number INTEGER,
  created_at TIMESTAMP
);
```

**annotation_likes (标注点赞)**:
```sql
CREATE TABLE annotation_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  annotation_id UUID REFERENCES shared_annotations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(annotation_id, user_id)  -- 防止重复点赞
);
```

**annotation_comments (标注评论)**:
```sql
CREATE TABLE annotation_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  annotation_id UUID REFERENCES shared_annotations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**user_follows (用户关注)**:
```sql
CREATE TABLE user_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES auth.users(id),
  following_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(follower_id, following_id),  -- 防止重复关注
  CHECK (follower_id != following_id)  -- 不能关注自己
);
```

### 4.2 数据库索引

为高频查询字段创建索引以提升性能:

```sql
-- 按 DOI 查询论文
CREATE INDEX idx_papers_doi ON papers(doi);

-- 按 DOI 查询标注
CREATE INDEX idx_annotations_doi ON shared_annotations(doi);

-- 按用户查询标注
CREATE INDEX idx_annotations_user ON shared_annotations(user_id);

-- 按标注查询点赞和评论
CREATE INDEX idx_likes_annotation ON annotation_likes(annotation_id);
CREATE INDEX idx_comments_annotation ON annotation_comments(annotation_id);

-- 按会话查询标注
CREATE INDEX idx_session_annotations ON session_annotations(session_id);

-- 按时间排序
CREATE INDEX idx_annotations_created ON shared_annotations(created_at DESC);
```

### 4.3 RLS 安全策略

**安全原则**:
- 用户只能访问自己的私有数据
- 公共数据(如共享标注)对所有认证用户可见
- 会话成员只能访问所属会话的数据
- 防止越权操作(如删除他人标注、修改他人评论)

**shared_annotations 表策略**:
```sql
-- 所有认证用户可以查看公共标注
CREATE POLICY "Authenticated users can view shared annotations"
  ON shared_annotations
  FOR SELECT
  TO authenticated
  USING (true);

-- 用户只能创建自己的标注
CREATE POLICY "Users can create own annotations"
  ON shared_annotations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的标注
CREATE POLICY "Users can update own annotations"
  ON shared_annotations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 用户只能删除自己的标注
CREATE POLICY "Users can delete own annotations"
  ON shared_annotations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

**reading_sessions 表策略**:
```sql
-- 所有人可以查看公共会话
CREATE POLICY "Anyone can view public sessions"
  ON reading_sessions
  FOR SELECT
  USING (session_type = 'public' OR auth.uid() = creator_id);

-- 只有会话创建者可以修改会话
CREATE POLICY "Only creator can modify session"
  ON reading_sessions
  FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- 只有会话创建者可以删除会话
CREATE POLICY "Only creator can delete session"
  ON reading_sessions
  FOR DELETE
  USING (auth.uid() = creator_id);
```

**annotation_likes 表策略**:
```sql
-- 用户可以查看所有点赞
CREATE POLICY "Users can view all likes"
  ON annotation_likes
  FOR SELECT
  TO authenticated
  USING (true);

-- 用户只能创建自己的点赞
CREATE POLICY "Users can create own likes"
  ON annotation_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 用户只能取消自己的点赞
CREATE POLICY "Users can delete own likes"
  ON annotation_likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

**annotation_comments 表策略**:
```sql
-- 用户可以查看所有评论
CREATE POLICY "Users can view all comments"
  ON annotation_comments
  FOR SELECT
  TO authenticated
  USING (true);

-- 用户只能创建自己的评论
CREATE POLICY "Users can create own comments"
  ON annotation_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 用户只能删除自己的评论
CREATE POLICY "Users can delete own comments"
  ON annotation_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

**user_follows 表策略**:
```sql
-- 用户可以查看所有关注关系
CREATE POLICY "Users can view all follows"
  ON user_follows
  FOR SELECT
  TO authenticated
  USING (true);

-- 用户只能创建自己发起的关注
CREATE POLICY "Users can create own follows"
  ON user_follows
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

-- 用户只能取消自己的关注
CREATE POLICY "Users can delete own follows"
  ON user_follows
  FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);
```

### 4.4 数据库触发器

**自动更新时间戳**:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shared_annotations_updated_at
  BEFORE UPDATE ON shared_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**级联删除标注相关数据**:
```sql
-- 当标注被删除时,自动删除相关的点赞和评论
-- (已通过 ON DELETE CASCADE 外键约束实现)
```

---

## 五、部署架构

### 5.1 生产环境

```
┌──────────────────────────────────────────────┐
│  Vercel (Next.js 网站)                        │
│  - Edge Network                               │
│  - Serverless Functions                       │
│  - 自动扩容                                    │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  Supabase (后端服务)                          │
│  - PostgreSQL Database                        │
│  - Authentication                             │
│  - Storage                                    │
│  - Realtime                                   │
└──────────────────────────────────────────────┘
```

**域名**:
- 主站: `https://www.researchopia.com`
- 备用: `https://researchopia.vercel.app`

### 5.2 开发环境

```
本地开发机器
├── localhost:3000  (Next.js Dev Server)
├── Zotero Desktop  (插件热重载)
└── Chrome Browser  (扩展开发模式)
      │
      └──▶ Supabase Cloud (共享开发数据库)
```

---

## 六、性能优化

### 6.1 前端优化
- **代码分割**: 动态导入,按需加载
- **图片优化**: Next.js Image组件,自动优化
- **缓存策略**: SWR Hook,智能缓存
- **SSR/ISR**: 服务端渲染,增量静态再生成

### 6.2 插件优化
- **懒加载**: UI组件按需渲染
- **防抖节流**: 限制API调用频率
- **批量处理**: 合并多个标注请求
- **增量更新**: 只同步变更的标注

### 6.3 数据库优化
- **索引**: doi, user_id, session_id 等字段
- **分页**: 限制单次查询数量
- **连接池**: 复用数据库连接
- **查询优化**: 避免N+1查询

---

## 七、监控和日志

### 7.1 日志系统
- **插件端**: 控制台日志 (Zotero Debug Output)
- **网站端**: Vercel Analytics
- **后端**: Supabase Logs

### 7.2 错误追踪
- 插件编译错误捕获
- API请求失败重试
- 用户操作异常提示

---

## 八、未来规划

### 短期目标
- [ ] 完成代码模块化重构
- [ ] 完善API文档
- [ ] 添加单元测试
- [ ] 性能监控和优化

### 长期目标
- [ ] GraphQL API层
- [ ] 移动端应用
- [ ] AI辅助标注
- [ ] 知识图谱构建

---

**维护者**: Researchopia Team  
**最后更新**: 2025-11-02
