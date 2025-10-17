# MVP开发任务清单 - 个人学术主页与社交系统

> **版本**: v0.2.0  
> **目标**: 1周内完成可上线的MVP  
> **开始日期**: 2025-01-17

---

## 📊 总体进度

- [ ] Phase 1: 个人主页基础 (0/8)
- [ ] Phase 2: 关注系统 (0/8)
- [ ] Phase 3: 基础动态流 (0/6)
- [ ] Phase 4: Zotero插件集成 (0/4)

**总进度**: 0/26 任务完成

---

## 🎯 Phase 1: 个人主页基础 (Day 1-2)

### 1.1 数据库迁移

#### Task 1.1.1: 扩展users表结构
**优先级**: P0 (最高)  
**预计时间**: 30分钟

```sql
-- 文件: supabase/migrations/20250117_extend_users_table.sql

-- 学术身份字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS real_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS institution TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS research_fields TEXT[] DEFAULT '{}';

-- 学术标识
ALTER TABLE users ADD COLUMN IF NOT EXISTS orcid TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_scholar_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS researchgate_id TEXT;

-- 个人信息
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;

-- 隐私设置
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'public';
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_institution BOOLEAN DEFAULT true;

-- 统计字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_institution ON users(institution);
CREATE INDEX IF NOT EXISTS idx_users_research_fields ON users USING GIN(research_fields);

-- 添加约束
ALTER TABLE users ADD CONSTRAINT check_profile_visibility 
  CHECK (profile_visibility IN ('public', 'followers', 'private'));
```

**验收标准**:
- [x] SQL脚本无错误执行
- [x] 所有字段正确添加
- [x] 索引创建成功
- [x] 约束生效

---

#### Task 1.1.2: 创建用户统计视图
**优先级**: P0  
**预计时间**: 20分钟

```sql
-- 文件: supabase/migrations/20250117_create_user_stats_view.sql

CREATE OR REPLACE VIEW user_stats AS
SELECT 
  u.id,
  u.username,
  u.email,
  u.real_name,
  u.institution,
  u.followers_count,
  u.following_count,
  COUNT(DISTINCT p.id) as papers_count,
  COUNT(DISTINCT a.id) as annotations_count,
  COUNT(DISTINCT c.id) as comments_count,
  COUNT(DISTINCT r.id) as ratings_count,
  COUNT(DISTINCT pf.id) as favorites_count
FROM users u
LEFT JOIN papers p ON p.created_by = u.id
LEFT JOIN annotations a ON a.user_id = u.id AND a.visibility = 'public'
LEFT JOIN comments c ON c.user_id = u.id
LEFT JOIN ratings r ON r.user_id = u.id
LEFT JOIN paper_favorites pf ON pf.user_id = u.id
GROUP BY u.id, u.username, u.email, u.real_name, u.institution, 
         u.followers_count, u.following_count;

-- 授权
GRANT SELECT ON user_stats TO anon, authenticated;
```

**验收标准**:
- [x] 视图创建成功
- [x] 统计数据准确
- [x] 权限设置正确

---

### 1.2 后端API开发

#### Task 1.2.1: 个人资料API - 获取
**优先级**: P0  
**预计时间**: 45分钟  
**文件**: `src/app/api/users/[username]/profile/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 获取用户基本信息
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 获取统计信息
    const { data: stats, error: statsError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('username', username)
      .single()

    // 检查隐私设置
    const authHeader = request.headers.get('authorization')
    let currentUserId: string | null = null
    
    if (authHeader) {
      const token = authHeader.split(' ')[1]
      const { data: { user: currentUser } } = await supabase.auth.getUser(token)
      currentUserId = currentUser?.id || null
    }

    // 根据隐私设置过滤数据
    const isOwner = currentUserId === user.id
    const isPublic = user.profile_visibility === 'public'
    
    if (!isPublic && !isOwner) {
      // 检查是否是关注者
      if (user.profile_visibility === 'followers' && currentUserId) {
        const { data: followData } = await supabase
          .from('user_follows')
          .select('id')
          .eq('follower_id', currentUserId)
          .eq('following_id', user.id)
          .single()
        
        if (!followData) {
          return NextResponse.json(
            { error: 'Profile is private' },
            { status: 403 }
          )
        }
      } else {
        return NextResponse.json(
          { error: 'Profile is private' },
          { status: 403 }
        )
      }
    }

    // 过滤敏感信息
    const profile = {
      ...user,
      email: user.show_email || isOwner ? user.email : null,
      institution: user.show_institution || isOwner ? user.institution : null,
      stats: stats || {
        papers_count: 0,
        annotations_count: 0,
        comments_count: 0,
        ratings_count: 0,
        favorites_count: 0
      }
    }

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**验收标准**:
- [x] 正确返回用户资料
- [x] 统计信息准确
- [x] 隐私设置生效
- [x] 错误处理完善

---

#### Task 1.2.2: 个人资料API - 更新
**优先级**: P0  
**预计时间**: 45分钟  
**文件**: `src/app/api/users/[username]/profile/route.ts` (继续)

```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 验证用户身份
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 获取目标用户
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 验证是否是本人
    if (currentUser.id !== targetUser.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // 解析请求体
    const body = await request.json()
    const {
      real_name,
      institution,
      department,
      position,
      research_fields,
      orcid,
      google_scholar_id,
      researchgate_id,
      bio,
      website,
      location,
      profile_visibility,
      show_email,
      show_institution
    } = body

    // 更新用户资料
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        real_name,
        institution,
        department,
        position,
        research_fields,
        orcid,
        google_scholar_id,
        researchgate_id,
        bio,
        website,
        location,
        profile_visibility,
        show_email,
        show_institution,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentUser.id)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      profile: updatedUser 
    })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**验收标准**:
- [x] 只有本人可以更新
- [x] 所有字段正确更新
- [x] 验证逻辑完善
- [x] 错误处理完善

---

### 1.3 前端页面开发

#### Task 1.3.1: 个人主页展示页面
**优先级**: P0  
**预计时间**: 2小时  
**文件**: `src/app/profile/[username]/page.tsx`

**功能要求**:
- 展示用户头像、姓名、职位、机构
- 展示研究领域标签
- 展示统计数据 (关注者、论文、标注等)
- 展示个人简介
- 展示学术标识 (ORCID等)
- 标签页切换 (概览、论文、标注、评论、收藏、动态)
- 关注按钮 (如果不是本人)
- 编辑按钮 (如果是本人)

**验收标准**:
- [x] 页面布局美观
- [x] 数据正确展示
- [x] 响应式设计
- [x] 加载状态处理
- [x] 错误状态处理

---

#### Task 1.3.2: 个人资料编辑页面
**优先级**: P0  
**预计时间**: 2小时  
**文件**: `src/app/profile/edit/page.tsx`

**功能要求**:
- 表单包含所有可编辑字段
- 研究领域多选标签输入
- 隐私设置开关
- 表单验证 (必填项、格式验证)
- 保存按钮和取消按钮
- 保存成功提示

**验收标准**:
- [x] 表单功能完整
- [x] 验证逻辑正确
- [x] 保存成功
- [x] 用户体验良好

---

### 1.4 组件开发

#### Task 1.4.1: ProfileHeader组件
**优先级**: P0  
**预计时间**: 1小时  
**文件**: `src/components/profile/ProfileHeader.tsx`

**组件结构**:
```typescript
interface ProfileHeaderProps {
  user: UserProfile
  isOwner: boolean
  isFollowing?: boolean
  onFollow?: () => void
  onUnfollow?: () => void
  onEdit?: () => void
}
```

**验收标准**:
- [x] 头像、姓名、职位正确显示
- [x] 关注按钮功能正常
- [x] 编辑按钮正确显示

---

#### Task 1.4.2: ProfileStats组件
**优先级**: P0  
**预计时间**: 30分钟  
**文件**: `src/components/profile/ProfileStats.tsx`

**验收标准**:
- [x] 统计数据正确显示
- [x] 数字格式化 (1.2k, 1.2M)
- [x] 可点击跳转

---

#### Task 1.4.3: ProfileTabs组件
**优先级**: P0  
**预计时间**: 1小时  
**文件**: `src/components/profile/ProfileTabs.tsx`

**验收标准**:
- [x] 标签页切换正常
- [x] 内容正确加载
- [x] URL同步

---

### 1.5 Zotero插件集成

#### Task 1.5.1: 添加"查看主页"按钮
**优先级**: P1  
**预计时间**: 30分钟  
**文件**: `zotero-plugin/src/modules/ui/components.ts`

**功能要求**:
- 在用户登录后显示"查看主页"按钮
- 点击后在浏览器中打开个人主页
- 使用用户的username构建URL

**验收标准**:
- [x] 按钮正确显示
- [x] 点击跳转正确
- [x] 未登录时不显示

---

## 🎯 Phase 2: 关注系统 (Day 3-4)

### 2.1 数据库扩展

#### Task 2.1.1: 扩展user_follows表
**优先级**: P0  
**预计时间**: 15分钟

```sql
-- 文件: supabase/migrations/20250119_extend_user_follows.sql

ALTER TABLE user_follows ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT true;
ALTER TABLE user_follows ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 添加唯一约束 (如果不存在)
ALTER TABLE user_follows ADD CONSTRAINT unique_follow_relation 
  UNIQUE (follower_id, following_id);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
```

---

#### Task 2.1.2: 创建关注计数触发器
**优先级**: P0  
**预计时间**: 30分钟

```sql
-- 文件: supabase/migrations/20250119_follow_count_triggers.sql

CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users SET following_count = following_count + 1 
    WHERE id = NEW.follower_id;
    UPDATE users SET followers_count = followers_count + 1 
    WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users SET following_count = GREATEST(following_count - 1, 0)
    WHERE id = OLD.follower_id;
    UPDATE users SET followers_count = GREATEST(followers_count - 1, 0)
    WHERE id = OLD.following_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_follow_counts ON user_follows;
CREATE TRIGGER trigger_update_follow_counts
AFTER INSERT OR DELETE ON user_follows
FOR EACH ROW EXECUTE FUNCTION update_follow_counts();
```

**验收标准**:
- [x] 关注时计数增加
- [x] 取消关注时计数减少
- [x] 计数不会为负数

---

### 2.2 后端API开发

#### Task 2.2.1: 关注/取消关注API
**优先级**: P0  
**预计时间**: 1小时  
**文件**: `src/app/api/users/[userId]/follow/route.ts`

**功能要求**:
- POST: 关注用户
- DELETE: 取消关注
- 验证用户身份
- 防止自己关注自己
- 防止重复关注

**验收标准**:
- [x] 关注功能正常
- [x] 取消关注功能正常
- [x] 验证逻辑完善
- [x] 错误处理完善

---

#### Task 2.2.2: 关注者/关注中列表API
**优先级**: P0  
**预计时间**: 1小时  
**文件**: `src/app/api/users/[userId]/followers/route.ts`  
**文件**: `src/app/api/users/[userId]/following/route.ts`

**功能要求**:
- 分页支持
- 返回用户基本信息
- 显示互相关注状态
- 支持搜索和筛选

**验收标准**:
- [x] 列表正确返回
- [x] 分页功能正常
- [x] 互关状态正确

---

### 2.3 前端组件开发

#### Task 2.3.1: FollowButton组件
**优先级**: P0  
**预计时间**: 1小时  
**文件**: `src/components/social/FollowButton.tsx`

**功能要求**:
- 显示关注/已关注状态
- 点击切换状态
- 加载状态显示
- 未登录提示

**验收标准**:
- [x] 状态切换正常
- [x] UI反馈及时
- [x] 错误处理完善

---

#### Task 2.3.2: FollowList组件
**优先级**: P0  
**预计时间**: 1.5小时  
**文件**: `src/components/social/FollowList.tsx`

**功能要求**:
- 用户列表展示
- 关注按钮集成
- 分页加载
- 空状态处理

**验收标准**:
- [x] 列表正确显示
- [x] 分页功能正常
- [x] 交互流畅

---

### 2.4 Zotero插件集成

#### Task 2.4.1: 标注卡片添加关注按钮
**优先级**: P1  
**预计时间**: 1小时  
**文件**: `zotero-plugin/src/modules/ui/sharedAnnotationsView.ts`

**功能要求**:
- 在每个标注卡片显示作者信息
- 添加关注按钮
- 显示关注状态
- 点击关注/取消关注

**验收标准**:
- [x] 按钮正确显示
- [x] 关注功能正常
- [x] 状态同步

---

## 🎯 Phase 3: 基础动态流 (Day 5-7)

### 3.1 数据库设计

#### Task 3.1.1: 创建activities表
**优先级**: P0  
**预计时间**: 30分钟

```sql
-- 文件: supabase/migrations/20250121_create_activities_table.sql

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
CREATE INDEX idx_activities_visibility ON activities(visibility);

ALTER TABLE activities ADD CONSTRAINT check_activity_visibility 
  CHECK (visibility IN ('public', 'followers', 'private'));
```

---

#### Task 3.1.2: 创建动态生成触发器
**优先级**: P0  
**预计时间**: 1小时

```sql
-- 文件: supabase/migrations/20250121_activity_triggers.sql

CREATE OR REPLACE FUNCTION create_activity_on_action()
RETURNS TRIGGER AS $$
BEGIN
  -- 标注分享
  IF TG_TABLE_NAME = 'annotations' AND TG_OP = 'INSERT' AND NEW.visibility = 'public' THEN
    INSERT INTO activities (user_id, type, content, target_type, target_id, metadata)
    VALUES (NEW.user_id, 'annotation_shared', NEW.content, 'annotation', NEW.id, 
            jsonb_build_object('document_id', NEW.document_id));
  
  -- 论文评分
  ELSIF TG_TABLE_NAME = 'ratings' AND TG_OP = 'INSERT' THEN
    INSERT INTO activities (user_id, type, content, target_type, target_id, metadata)
    VALUES (NEW.user_id, 'paper_rated', '', 'paper', NEW.paper_id,
            jsonb_build_object('overall_score', NEW.overall_score));
  
  -- 关注用户
  ELSIF TG_TABLE_NAME = 'user_follows' AND TG_OP = 'INSERT' THEN
    INSERT INTO activities (user_id, type, content, target_type, target_id)
    VALUES (NEW.follower_id, 'user_followed', '', 'user', NEW.following_id);
  
  -- 论文评论
  ELSIF TG_TABLE_NAME = 'comments' AND TG_OP = 'INSERT' AND NEW.parent_id IS NULL THEN
    INSERT INTO activities (user_id, type, content, target_type, target_id, metadata)
    VALUES (NEW.user_id, 'paper_commented', NEW.content, 'paper', NEW.paper_id,
            jsonb_build_object('comment_id', NEW.id));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为各表创建触发器
CREATE TRIGGER trigger_activity_on_annotation
AFTER INSERT ON annotations
FOR EACH ROW EXECUTE FUNCTION create_activity_on_action();

CREATE TRIGGER trigger_activity_on_rating
AFTER INSERT ON ratings
FOR EACH ROW EXECUTE FUNCTION create_activity_on_action();

CREATE TRIGGER trigger_activity_on_follow
AFTER INSERT ON user_follows
FOR EACH ROW EXECUTE FUNCTION create_activity_on_action();

CREATE TRIGGER trigger_activity_on_comment
AFTER INSERT ON comments
FOR EACH ROW EXECUTE FUNCTION create_activity_on_action();
```

**验收标准**:
- [x] 各类操作自动生成动态
- [x] 动态数据完整
- [x] 性能影响可接受

---

### 3.2 后端API开发

#### Task 3.2.1: 动态流API
**优先级**: P0  
**预计时间**: 2小时  
**文件**: `src/app/api/feed/route.ts`

**功能要求**:
- 获取关注用户的动态
- 分页支持
- 按时间倒序
- 包含用户信息和目标内容

**验收标准**:
- [x] 动态正确返回
- [x] 分页功能正常
- [x] 性能可接受

---

### 3.3 前端页面开发

#### Task 3.3.1: 动态流页面
**优先级**: P0  
**预计时间**: 2小时  
**文件**: `src/app/feed/page.tsx`

**功能要求**:
- 动态列表展示
- 下拉刷新
- 上拉加载更多
- 空状态处理

**验收标准**:
- [x] 页面功能完整
- [x] 交互流畅
- [x] 用户体验良好

---

#### Task 3.3.2: ActivityCard组件
**优先级**: P0  
**预计时间**: 2小时  
**文件**: `src/components/feed/ActivityCard.tsx`

**功能要求**:
- 根据动态类型显示不同内容
- 显示用户头像和姓名
- 显示时间
- 支持点击跳转

**验收标准**:
- [x] 各类动态正确显示
- [x] 跳转功能正常
- [x] UI美观

---

## 📝 开发规范

### 代码规范
- 使用TypeScript严格模式
- 遵循ESLint规则
- 组件使用函数式组件
- 使用Tailwind CSS

### 提交规范
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式
- refactor: 重构
- test: 测试
- chore: 构建/工具

### 测试要求
- 每个API端点需要测试
- 关键组件需要单元测试
- 完成后进行集成测试

---

## 🚀 部署检查清单

- [ ] 数据库迁移已执行
- [ ] 环境变量已配置
- [ ] API端点已测试
- [ ] 前端页面已测试
- [ ] Zotero插件已测试
- [ ] 性能测试通过
- [ ] 安全检查通过
- [ ] 文档已更新

---

**准备好了吗？让我们开始开发！** 🎉

