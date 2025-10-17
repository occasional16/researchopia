# 研学港 - 个人学术主页与学术社交系统设计文档

> **文档版本**: v0.2.0  
> **创建日期**: 2025-01-17  
> **目标**: 打造开放的学术交流共享平台，构建学术社交生态系统

---

## 📋 目录

1. [项目现状分析](#1-项目现状分析)
2. [设计理念与目标](#2-设计理念与目标)
3. [核心功能设计](#3-核心功能设计)
4. [技术架构设计](#4-技术架构设计)
5. [数据库设计](#5-数据库设计)
6. [MVP开发计划](#6-mvp开发计划)
7. [长期发展路线](#7-长期发展路线)

---

## 1. 项目现状分析

### 1.1 已有基础设施

#### ✅ 技术栈
- **前端**: Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **后端**: Supabase (PostgreSQL) + RESTful API
- **部署**: Vercel
- **插件**: Zotero插件 + 浏览器扩展

#### ✅ 核心功能
- 用户认证系统 (注册/登录/密码管理)
- 论文搜索与评分系统
- 标注分享与协作 (Zotero集成)
- 评论系统 (支持嵌套回复)
- 基础个人中心页面

#### ✅ 数据库表结构
- `users` - 用户基本信息
- `papers` - 论文数据
- `annotations` - 标注数据
- `comments` - 评论数据
- `ratings` - 评分数据
- `user_follows` - 关注关系
- `paper_favorites` - 论文收藏
- `annotation_likes` - 标注点赞

### 1.2 现有问题与机会

#### 🔴 待完善功能
1. **个人主页缺失**: 无法展示用户学术档案和成果
2. **社交功能薄弱**: 关注系统未实现，缺少互动机制
3. **学术身份不明确**: 缺少研究领域、机构、学术成就展示
4. **内容发现困难**: 缺少推荐算法和个性化内容流
5. **社区氛围不足**: 缺少动态、话题、讨论区等社区功能

#### 🟢 核心优势
1. **Zotero深度集成**: 直接连接研究者的文献库
2. **标注为中心**: 独特的标注分享机制
3. **技术架构完善**: 现代化技术栈，易于扩展
4. **开源开放**: AGPL-3.0协议，社区驱动

---

## 2. 设计理念与目标

### 2.1 核心理念

> **"以学术内容为核心，以真实互动为纽带，构建开放的学术共享社区"**

#### 设计原则
1. **学术优先**: 内容质量 > 社交娱乐
2. **真实身份**: 鼓励实名，建立学术信誉
3. **开放共享**: 知识自由流动，反对学术孤岛
4. **隐私保护**: 用户可控的隐私设置
5. **简洁高效**: 避免过度社交化，专注学术价值

### 2.2 对标分析

| 平台 | 核心特色 | 可借鉴点 | 差异化方向 |
|------|---------|---------|-----------|
| **ResearchGate** | 学术社交网络 | 个人主页、研究成果展示、Q&A | 更轻量、更开放、标注中心 |
| **Google Scholar** | 学术档案 | 引用统计、h-index、合作者网络 | 增加互动性、社区讨论 |
| **知乎** | 问答社区 | 话题系统、内容推荐、专栏 | 聚焦学术领域、专业性 |
| **豆瓣** | 兴趣社交 | 小组、书影音评价、个人主页 | 学术内容、专业评价体系 |
| **Twitter学术圈** | 实时动态 | 简短分享、话题标签、转发 | 深度内容、长期价值 |

### 2.3 目标用户画像

#### 主要用户群体
1. **研究生/博士生** (40%): 文献阅读、论文写作、学术交流
2. **青年学者** (30%): 成果展示、合作寻找、学术影响力
3. **资深教授** (15%): 知识分享、学术指导、领域影响
4. **科研工作者** (15%): 技术交流、问题求助、资源共享

#### 核心需求
- 📚 **文献管理**: 高效的文献阅读和标注工具
- 🎓 **学术展示**: 展示研究成果和学术身份
- 🤝 **学术社交**: 找到同领域研究者，建立合作
- 💡 **知识获取**: 发现优质内容，学习前沿知识
- 🔍 **问题解决**: 提问、讨论、获得专业建议

---

## 3. 核心功能设计

### 3.1 个人学术主页 (Academic Profile)

#### 3.1.1 基本信息区
```typescript
interface UserProfile {
  // 基础信息
  id: string
  username: string
  email: string
  avatar_url?: string
  
  // 学术身份
  real_name?: string              // 真实姓名
  institution?: string            // 所属机构
  department?: string             // 院系/部门
  position?: string               // 职位/职称
  research_fields: string[]       // 研究领域
  
  // 学术标识
  orcid?: string                  // ORCID ID
  google_scholar_id?: string      // Google Scholar ID
  researchgate_id?: string        // ResearchGate ID
  
  // 个人简介
  bio?: string                    // 个人简介
  website?: string                // 个人网站
  location?: string               // 所在地
  
  // 社交统计
  followers_count: number         // 关注者数
  following_count: number         // 关注数
  papers_count: number            // 论文数
  annotations_count: number       // 标注数
  
  // 隐私设置
  profile_visibility: 'public' | 'followers' | 'private'
  show_email: boolean
  show_institution: boolean
  
  created_at: string
  updated_at: string
}
```

#### 3.1.2 主页布局设计

```
┌─────────────────────────────────────────────────────────┐
│  [头像]  用户名 @username                    [关注] [私信] │
│         职位 @ 机构                                      │
│         📍 地区 | 🔗 个人网站 | 🎓 ORCID                 │
│         研究领域: #机器学习 #自然语言处理                  │
│                                                         │
│  📊 123 关注者 | 456 关注中 | 78 论文 | 234 标注        │
│  ─────────────────────────────────────────────────────  │
│  [概览] [论文] [标注] [评论] [收藏] [动态]               │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  📝 个人简介                                            │
│  这里是用户的个人简介内容...                              │
│                                                         │
│  🏆 学术成就                                            │
│  • h-index: 15                                         │
│  • 总引用: 1,234                                        │
│  • 优质标注: 56                                         │
│                                                         │
│  📚 最新论文 (3)                          [查看全部 →]   │
│  ┌─────────────────────────────────────┐               │
│  │ 论文标题...                          │               │
│  │ 作者 | 期刊 | 2024                   │               │
│  └─────────────────────────────────────┘               │
│                                                         │
│  💡 热门标注 (5)                          [查看全部 →]   │
│  ┌─────────────────────────────────────┐               │
│  │ "这个方法的创新点在于..."            │               │
│  │ 👍 45  💬 12  | 论文: XXX            │               │
│  └─────────────────────────────────────┘               │
│                                                         │
│  🔥 最近活动                                            │
│  • 评论了论文《XXX》                                     │
│  • 分享了标注 "关于XXX的思考"                            │
│  • 关注了 @researcher_name                             │
└─────────────────────────────────────────────────────────┘
```

#### 3.1.3 功能模块

**A. 概览标签页**
- 个人简介和学术身份
- 学术成就统计
- 最新论文/标注/评论
- 最近活动时间线

**B. 论文标签页**
- 用户发布/收藏的论文列表
- 按时间/引用/评分排序
- 筛选器: 作为作者/作为读者
- 论文统计图表

**C. 标注标签页**
- 用户的所有公开标注
- 按论文/时间/热度分组
- 标注质量评分展示
- 支持搜索和筛选

**D. 评论标签页**
- 论文评论历史
- 标注评论历史
- 按时间倒序排列
- 显示评论所属内容

**E. 收藏标签页**
- 收藏的论文
- 收藏的标注
- 收藏夹分类管理

**F. 动态标签页**
- 用户的学术动态流
- 发布、评论、点赞、关注等活动
- 时间线展示

### 3.2 学术社交系统

#### 3.2.1 关注系统 (Follow System)

```typescript
interface FollowRelation {
  id: string
  follower_id: string      // 关注者
  following_id: string     // 被关注者
  created_at: string
  
  // 扩展字段
  notification_enabled: boolean  // 是否接收动态通知
  tags?: string[]                // 给关注者打标签
}

// API设计
POST   /api/users/:userId/follow        // 关注用户
DELETE /api/users/:userId/unfollow      // 取消关注
GET    /api/users/:userId/followers     // 获取关注者列表
GET    /api/users/:userId/following     // 获取关注列表
GET    /api/users/:userId/is-following  // 检查是否关注
```

**关注功能特性**:
- ✅ 单向关注 (类似Twitter)
- ✅ 关注者/关注中列表
- ✅ 互相关注标识
- ✅ 关注动态推送
- ✅ 关注者分组管理 (未来)

#### 3.2.2 动态系统 (Activity Feed)

```typescript
interface Activity {
  id: string
  user_id: string
  type: ActivityType
  content: string
  metadata: Record<string, any>
  visibility: 'public' | 'followers' | 'private'
  created_at: string
}

type ActivityType = 
  | 'paper_published'      // 发布论文
  | 'annotation_shared'    // 分享标注
  | 'paper_commented'      // 评论论文
  | 'paper_rated'          // 评分论文
  | 'user_followed'        // 关注用户
  | 'paper_favorited'      // 收藏论文
  | 'annotation_liked'     // 点赞标注
```

**动态流设计**:
```
┌─────────────────────────────────────────┐
│  🏠 首页动态                             │
│  ─────────────────────────────────────  │
│  [关注] [推荐] [热门]                    │
│  ─────────────────────────────────────  │
│                                         │
│  👤 张三 @zhangsan · 2小时前             │
│  📝 分享了标注                           │
│  "这篇论文提出的方法很有启发性..."        │
│  📄 论文: Deep Learning for NLP         │
│  👍 12  💬 3  🔖 5                      │
│  ─────────────────────────────────────  │
│                                         │
│  👤 李四 @lisi · 5小时前                 │
│  ⭐ 评价了论文                           │
│  创新性: ⭐⭐⭐⭐⭐                        │
│  方法论: ⭐⭐⭐⭐                          │
│  📄 论文: Transformer Architecture      │
│  👍 8  💬 2                             │
│  ─────────────────────────────────────  │
│                                         │
│  👤 王五 @wangwu · 1天前                 │
│  👥 关注了 @expert_researcher           │
│  ─────────────────────────────────────  │
└─────────────────────────────────────────┘
```

#### 3.2.3 推荐系统 (Recommendation)

**推荐维度**:
1. **用户推荐**
   - 相同研究领域
   - 相同机构
   - 共同关注
   - 互动频繁

2. **内容推荐**
   - 关注用户的动态
   - 研究领域相关论文
   - 热门标注和讨论
   - 个性化推荐

**推荐算法** (简化版):
```typescript
function calculateUserSimilarity(user1: User, user2: User): number {
  let score = 0
  
  // 研究领域重合度 (40%)
  const fieldOverlap = intersection(user1.research_fields, user2.research_fields).length
  score += (fieldOverlap / user1.research_fields.length) * 0.4
  
  // 共同关注 (30%)
  const commonFollowing = getCommonFollowing(user1.id, user2.id).length
  score += Math.min(commonFollowing / 10, 1) * 0.3
  
  // 互动频率 (20%)
  const interactions = getInteractionCount(user1.id, user2.id)
  score += Math.min(interactions / 20, 1) * 0.2
  
  // 机构相同 (10%)
  if (user1.institution === user2.institution) {
    score += 0.1
  }
  
  return score
}
```

#### 3.2.4 消息通知系统

```typescript
interface Notification {
  id: string
  user_id: string          // 接收者
  type: NotificationType
  actor_id?: string        // 触发者
  target_type: string      // 目标类型 (paper/annotation/comment)
  target_id: string        // 目标ID
  content: string
  is_read: boolean
  created_at: string
}

type NotificationType =
  | 'new_follower'         // 新关注者
  | 'annotation_liked'     // 标注被点赞
  | 'annotation_commented' // 标注被评论
  | 'comment_replied'      // 评论被回复
  | 'paper_commented'      // 论文被评论
  | 'mention'              // 被@提及
  | 'system'               // 系统通知
```

**通知中心设计**:
```
┌─────────────────────────────────────────┐
│  🔔 通知 (5条未读)                       │
│  ─────────────────────────────────────  │
│  [全部] [互动] [关注] [系统]             │
│  ─────────────────────────────────────  │
│                                         │
│  🔵 👤 张三 关注了你                     │
│     2小时前                              │
│  ─────────────────────────────────────  │
│                                         │
│  🔵 👍 李四 点赞了你的标注                │
│     "关于深度学习的思考..."              │
│     5小时前                              │
│  ─────────────────────────────────────  │
│                                         │
│  ⚪ 💬 王五 回复了你的评论                │
│     "我认为这个方法..."                  │
│     1天前                                │
│  ─────────────────────────────────────  │
│                                         │
│  ⚪ 📢 系统通知                           │
│     您的论文《XXX》获得了10个评分         │
│     2天前                                │
└─────────────────────────────────────────┘
```

### 3.3 Zotero插件社交功能增强

#### 3.3.1 插件内个人主页预览

在Zotero插件中添加"个人主页"按钮，点击后在侧边栏显示简化版个人主页:

```
┌─────────────────────────────────┐
│  个人主页                        │
│  ─────────────────────────────  │
│  [头像] 用户名                   │
│  职位 @ 机构                     │
│                                 │
│  📊 统计                         │
│  • 123 关注者                    │
│  • 78 论文                       │
│  • 234 标注                      │
│                                 │
│  [在网页中查看完整主页]          │
│  ─────────────────────────────  │
│  最新标注 (3)                    │
│  • "关于XXX的思考..."            │
│  • "这个方法很有意思..."          │
│  • "值得深入研究..."             │
│                                 │
│  [管理我的主页]                  │
└─────────────────────────────────┘
```

#### 3.3.2 关注功能集成

在共享标注列表中，每个标注卡片添加"关注作者"按钮:

```typescript
// 在 sharedAnnotationsView.ts 中添加
async function followAuthor(userId: string): Promise<void> {
  const currentUser = AuthManager.getCurrentUser()
  if (!currentUser) {
    showLoginPrompt()
    return
  }
  
  const supabase = SupabaseManager.getInstance()
  const result = await supabase.followUser(currentUser.id, userId)
  
  if (result.success) {
    showMessage('已关注该用户')
    updateFollowButton(userId, true)
  }
}
```

#### 3.3.3 动态通知

在Zotero插件中添加通知图标，显示未读通知数量:

```
┌─────────────────────────────────┐
│  Researchopia                   │
│  ─────────────────────────────  │
│  [🔔 5]  [👤]  [⚙️]              │
│                                 │
│  当前论文: Deep Learning...      │
│  ─────────────────────────────  │
│  [快捷搜索] [管理标注]           │
│  [共享标注] [论文评价]           │
└─────────────────────────────────┘
```

---

## 4. 技术架构设计

### 4.1 前端架构

```
src/
├── app/
│   ├── profile/
│   │   ├── [username]/
│   │   │   ├── page.tsx              # 用户主页
│   │   │   ├── papers/page.tsx       # 论文列表
│   │   │   ├── annotations/page.tsx  # 标注列表
│   │   │   └── activity/page.tsx     # 动态列表
│   │   └── edit/page.tsx             # 编辑个人资料
│   ├── feed/
│   │   └── page.tsx                  # 动态流页面
│   ├── notifications/
│   │   └── page.tsx                  # 通知中心
│   └── discover/
│       └── page.tsx                  # 发现页面
├── components/
│   ├── profile/
│   │   ├── ProfileHeader.tsx         # 主页头部
│   │   ├── ProfileStats.tsx          # 统计信息
│   │   ├── ProfileTabs.tsx           # 标签页
│   │   ├── FollowButton.tsx          # 关注按钮
│   │   └── ProfileEdit.tsx           # 编辑表单
│   ├── feed/
│   │   ├── ActivityCard.tsx          # 动态卡片
│   │   ├── FeedFilter.tsx            # 动态筛选
│   │   └── FeedList.tsx              # 动态列表
│   ├── social/
│   │   ├── FollowList.tsx            # 关注列表
│   │   ├── UserCard.tsx              # 用户卡片
│   │   └── RecommendUsers.tsx        # 推荐用户
│   └── notifications/
│       ├── NotificationList.tsx      # 通知列表
│       ├── NotificationItem.tsx      # 通知项
│       └── NotificationBadge.tsx     # 通知徽章
└── lib/
    ├── profile.ts                    # 个人资料API
    ├── follow.ts                     # 关注API
    ├── activity.ts                   # 动态API
    └── notifications.ts              # 通知API
```

### 4.2 API设计

```typescript
// 个人资料 API
GET    /api/users/:username/profile      // 获取用户资料
PUT    /api/users/:username/profile      // 更新用户资料
GET    /api/users/:username/stats        // 获取统计信息

// 关注 API
POST   /api/users/:userId/follow         // 关注用户
DELETE /api/users/:userId/unfollow       // 取消关注
GET    /api/users/:userId/followers      // 获取关注者
GET    /api/users/:userId/following      // 获取关注中
GET    /api/users/:userId/is-following   // 检查关注状态

// 动态 API
GET    /api/feed                         // 获取动态流
GET    /api/feed/following               // 关注用户动态
GET    /api/feed/recommended             // 推荐动态
POST   /api/activities                   // 创建动态
GET    /api/users/:userId/activities     // 用户动态

// 通知 API
GET    /api/notifications                // 获取通知列表
PUT    /api/notifications/:id/read       // 标记已读
PUT    /api/notifications/read-all       // 全部标记已读
GET    /api/notifications/unread-count   // 未读数量

// 推荐 API
GET    /api/recommendations/users        // 推荐用户
GET    /api/recommendations/papers       // 推荐论文
GET    /api/recommendations/annotations  // 推荐标注
```

---

## 5. 数据库设计

### 5.1 新增表结构

```sql
-- 扩展用户表
ALTER TABLE users ADD COLUMN IF NOT EXISTS real_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS institution TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS research_fields TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS orcid TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_scholar_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS researchgate_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'public';
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_institution BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- 动态表
CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  target_type TEXT,
  target_id UUID,
  visibility TEXT DEFAULT 'public',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX idx_activities_type ON activities(type);

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT,
  target_id UUID,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- 扩展关注表 (已存在，添加字段)
ALTER TABLE user_follows ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT true;
ALTER TABLE user_follows ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 用户统计视图
CREATE OR REPLACE VIEW user_stats AS
SELECT 
  u.id,
  u.username,
  COUNT(DISTINCT p.id) as papers_count,
  COUNT(DISTINCT a.id) as annotations_count,
  COUNT(DISTINCT c.id) as comments_count,
  COUNT(DISTINCT r.id) as ratings_count,
  u.followers_count,
  u.following_count
FROM users u
LEFT JOIN papers p ON p.created_by = u.id
LEFT JOIN annotations a ON a.user_id = u.id AND a.visibility = 'public'
LEFT JOIN comments c ON c.user_id = u.id
LEFT JOIN ratings r ON r.user_id = u.id
GROUP BY u.id, u.username, u.followers_count, u.following_count;
```

### 5.2 触发器设计

```sql
-- 自动更新关注计数
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 增加关注者的following_count
    UPDATE users SET following_count = following_count + 1 
    WHERE id = NEW.follower_id;
    -- 增加被关注者的followers_count
    UPDATE users SET followers_count = followers_count + 1 
    WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- 减少关注者的following_count
    UPDATE users SET following_count = following_count - 1 
    WHERE id = OLD.follower_id;
    -- 减少被关注者的followers_count
    UPDATE users SET followers_count = followers_count - 1 
    WHERE id = OLD.following_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_follow_counts
AFTER INSERT OR DELETE ON user_follows
FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- 自动创建动态
CREATE OR REPLACE FUNCTION create_activity_on_action()
RETURNS TRIGGER AS $$
BEGIN
  -- 根据不同的表和操作创建相应的动态
  IF TG_TABLE_NAME = 'annotations' AND TG_OP = 'INSERT' AND NEW.visibility = 'public' THEN
    INSERT INTO activities (user_id, type, content, target_type, target_id, metadata)
    VALUES (NEW.user_id, 'annotation_shared', NEW.content, 'annotation', NEW.id, 
            jsonb_build_object('document_id', NEW.document_id));
  ELSIF TG_TABLE_NAME = 'ratings' AND TG_OP = 'INSERT' THEN
    INSERT INTO activities (user_id, type, content, target_type, target_id, metadata)
    VALUES (NEW.user_id, 'paper_rated', '', 'paper', NEW.paper_id,
            jsonb_build_object('overall_score', NEW.overall_score));
  ELSIF TG_TABLE_NAME = 'user_follows' AND TG_OP = 'INSERT' THEN
    INSERT INTO activities (user_id, type, content, target_type, target_id)
    VALUES (NEW.follower_id, 'user_followed', '', 'user', NEW.following_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 自动创建通知
CREATE OR REPLACE FUNCTION create_notification_on_action()
RETURNS TRIGGER AS $$
BEGIN
  -- 新关注者通知
  IF TG_TABLE_NAME = 'user_follows' AND TG_OP = 'INSERT' THEN
    INSERT INTO notifications (user_id, type, actor_id, content)
    VALUES (NEW.following_id, 'new_follower', NEW.follower_id, '关注了你');
  
  -- 标注被点赞通知
  ELSIF TG_TABLE_NAME = 'annotation_likes' AND TG_OP = 'INSERT' THEN
    INSERT INTO notifications (user_id, type, actor_id, target_type, target_id, content)
    SELECT a.user_id, 'annotation_liked', NEW.user_id, 'annotation', NEW.annotation_id, '点赞了你的标注'
    FROM annotations a WHERE a.id = NEW.annotation_id AND a.user_id != NEW.user_id;
  
  -- 评论被回复通知
  ELSIF TG_TABLE_NAME = 'comments' AND TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, actor_id, target_type, target_id, content)
    SELECT c.user_id, 'comment_replied', NEW.user_id, 'comment', NEW.id, '回复了你的评论'
    FROM comments c WHERE c.id = NEW.parent_id AND c.user_id != NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 6. MVP开发计划

### 6.1 开发阶段划分

#### 🎯 Phase 1: 个人主页基础 (优先级: 最高)
**目标**: 让用户能够展示学术身份和成果  
**时间**: 2-3天

**任务清单**:
- [ ] 数据库迁移: 扩展users表字段
- [ ] 后端API: 个人资料CRUD接口
- [ ] 前端页面: 个人主页展示页面
- [ ] 前端页面: 个人资料编辑页面
- [ ] 组件开发: ProfileHeader, ProfileStats, ProfileTabs
- [ ] Zotero插件: 添加"查看主页"按钮
- [ ] 测试: 个人资料完整性测试

**验收标准**:
- ✅ 用户可以编辑完整的学术资料
- ✅ 个人主页正确展示所有信息
- ✅ 统计数据准确 (论文数、标注数等)
- ✅ Zotero插件可以跳转到网页主页

#### 🎯 Phase 2: 关注系统 (优先级: 高)
**目标**: 实现用户之间的关注关系  
**时间**: 2-3天

**任务清单**:
- [ ] 后端API: 关注/取消关注接口
- [ ] 后端API: 关注者/关注中列表接口
- [ ] 前端组件: FollowButton组件
- [ ] 前端组件: FollowList组件
- [ ] 前端页面: 关注者/关注中列表页
- [ ] 数据库触发器: 自动更新关注计数
- [ ] Zotero插件: 标注卡片添加关注按钮
- [ ] 测试: 关注关系完整性测试

**验收标准**:
- ✅ 用户可以关注/取消关注其他用户
- ✅ 关注计数实时更新
- ✅ 关注者/关注中列表正确显示
- ✅ Zotero插件中可以关注标注作者

#### 🎯 Phase 3: 动态系统 (优先级: 高)
**目标**: 展示用户和关注者的学术动态  
**时间**: 3-4天

**任务清单**:
- [ ] 数据库: 创建activities表
- [ ] 数据库触发器: 自动创建动态记录
- [ ] 后端API: 动态流接口 (关注/推荐/热门)
- [ ] 前端页面: 动态流页面
- [ ] 前端组件: ActivityCard组件
- [ ] 前端组件: FeedFilter组件
- [ ] 个人主页: 添加动态标签页
- [ ] 测试: 动态生成和展示测试

**验收标准**:
- ✅ 用户操作自动生成动态
- ✅ 动态流正确展示关注用户动态
- ✅ 支持按类型筛选动态
- ✅ 个人主页显示用户动态历史

#### 🎯 Phase 4: 通知系统 (优先级: 中)
**目标**: 及时通知用户互动信息  
**时间**: 2-3天

**任务清单**:
- [ ] 数据库: 创建notifications表
- [ ] 数据库触发器: 自动创建通知
- [ ] 后端API: 通知列表和已读接口
- [ ] 前端页面: 通知中心页面
- [ ] 前端组件: NotificationBadge组件
- [ ] 导航栏: 添加通知图标和未读数
- [ ] Zotero插件: 添加通知图标
- [ ] 测试: 通知触发和展示测试

**验收标准**:
- ✅ 关注、点赞、评论自动生成通知
- ✅ 通知中心正确展示所有通知
- ✅ 未读通知数量实时更新
- ✅ Zotero插件显示未读通知数

#### 🎯 Phase 5: 推荐系统 (优先级: 中)
**目标**: 帮助用户发现相关内容和用户  
**时间**: 3-4天

**任务清单**:
- [ ] 后端算法: 用户相似度计算
- [ ] 后端API: 推荐用户接口
- [ ] 后端API: 推荐内容接口
- [ ] 前端页面: 发现页面
- [ ] 前端组件: RecommendUsers组件
- [ ] 侧边栏: 添加推荐用户卡片
- [ ] 测试: 推荐准确性测试

**验收标准**:
- ✅ 推荐用户基于研究领域和互动
- ✅ 发现页面展示推荐内容
- ✅ 侧边栏显示推荐用户
- ✅ 推荐结果相关性高

### 6.2 快速上线MVP (1周版本)

**核心功能** (必须):
1. ✅ 个人主页展示 (Phase 1)
2. ✅ 个人资料编辑 (Phase 1)
3. ✅ 关注/取消关注 (Phase 2)
4. ✅ 关注者/关注中列表 (Phase 2)
5. ✅ 基础动态流 (Phase 3 - 简化版)

**简化策略**:
- 动态流只显示关注用户动态，暂不实现推荐算法
- 通知系统延后，先用邮件通知
- 推荐系统延后，先手动推荐
- Zotero插件只添加基础关注功能

**开发顺序** (7天):
- Day 1-2: Phase 1 (个人主页)
- Day 3-4: Phase 2 (关注系统)
- Day 5-7: Phase 3 简化版 (基础动态流)

---

## 7. 长期发展路线

### 7.1 功能扩展 (3-6个月)

#### Q1: 社区功能完善
- 🔹 话题系统 (#标签)
- 🔹 小组/研究组功能
- 🔹 学术问答 (Q&A)
- 🔹 专栏/博客功能
- 🔹 私信系统
- 🔹 学术活动/会议

#### Q2: 内容增强
- 🔹 论文解读/笔记
- 🔹 文献综述工具
- 🔹 研究项目展示
- 🔹 数据集分享
- 🔹 代码仓库集成
- 🔹 多媒体内容支持

#### Q3: 智能化功能
- 🔹 AI推荐优化
- 🔹 智能标注建议
- 🔹 论文相似度分析
- 🔹 研究趋势分析
- 🔹 合作者推荐
- 🔹 自动摘要生成

#### Q4: 生态建设
- 🔹 开放API平台
- 🔹 第三方插件市场
- 🔹 机构版功能
- 🔹 付费会员体系
- 🔹 学术认证系统
- 🔹 移动端APP

### 7.2 商业化探索

#### 免费功能 (核心)
- ✅ 基础个人主页
- ✅ 标注分享
- ✅ 关注和动态
- ✅ 论文搜索和评价
- ✅ 基础推荐

#### 高级功能 (会员)
- 💎 高级统计分析
- 💎 无限制标注存储
- 💎 优先推荐权重
- 💎 自定义主页样式
- 💎 数据导出功能
- 💎 去广告

#### 机构版功能
- 🏢 团队协作空间
- 🏢 机构主页
- 🏢 成员管理
- 🏢 数据统计报表
- 🏢 API调用额度
- 🏢 技术支持

---

## 8. 实施建议

### 8.1 开发优先级

**立即开始** (本周):
1. Phase 1: 个人主页基础
2. Phase 2: 关注系统

**近期完成** (2周内):
3. Phase 3: 动态系统 (简化版)
4. Zotero插件集成

**中期规划** (1个月内):
5. Phase 4: 通知系统
6. Phase 5: 推荐系统

### 8.2 技术债务管理

**需要重构**:
- 统一API响应格式
- 优化数据库查询性能
- 添加缓存层 (Redis)
- 完善错误处理

**需要补充**:
- 单元测试覆盖
- E2E测试
- 性能监控
- 日志系统

### 8.3 用户反馈机制

**Beta测试**:
1. 邀请10-20名活跃用户
2. 收集功能使用反馈
3. 快速迭代优化
4. 逐步开放注册

**数据指标**:
- DAU/MAU (日活/月活)
- 关注转化率
- 动态互动率
- 功能使用率
- 用户留存率

---

## 9. 总结

### 9.1 核心价值

**研学港的独特定位**:
1. **标注为中心**: 不同于ResearchGate的论文中心，我们以标注和思考为核心
2. **Zotero深度集成**: 无缝连接研究者的日常工作流
3. **开放共享**: AGPL协议，社区驱动，反对学术孤岛
4. **轻量高效**: 避免过度社交化，专注学术价值

### 9.2 成功关键

1. **快速MVP**: 1周内上线基础功能，快速验证
2. **用户反馈**: 持续收集反馈，快速迭代
3. **社区运营**: 培养种子用户，建立社区文化
4. **技术优化**: 保证系统稳定性和性能
5. **内容质量**: 鼓励高质量内容，建立评价机制

### 9.3 风险与应对

**风险**:
- 用户增长缓慢 → 加强推广，优化新手引导
- 内容质量参差 → 建立审核机制，鼓励优质内容
- 技术性能问题 → 及时优化，增加服务器资源
- 竞品压力 → 强化差异化优势，深耕垂直领域

---

**文档结束** | 让我们开始构建开放的学术交流平台！🚀

