# Researchopia - Zotero插件

Researchopia是一个创新的Zotero插件，旨在实现用户间对Zotero标注（annotations）的共享，支持实时协作和社交功能。类似于"微信读书"的社交阅读体验，但专为学术研究而设计。

## 🌟 核心功能

### � 智能标注共享
- **批量上传**: 一键分享您对论文的所有标注和笔记
- **实时同步**: 查看其他研究者对同一论文的标注
- **DOI支持**: 仅支持有DOI的论文，确保标注的准确关联
- **多格式支持**: 支持高亮、笔记、图片等多种标注类型

### 🎯 智能质量评分系统
- **内容质量**: 基于标注长度、结构和学术关键词评分
- **社交参与**: 考虑点赞数、评论数等社交指标
- **作者声誉**: 基于用户历史贡献质量评估
- **时效性**: 新标注获得时效性加分
- **相关性**: 根据标注类型和位置评估相关性

### � 丰富的社交功能
- **点赞系统**: 为优质标注点赞，提升其可见性
- **评论互动**: 对标注进行深入讨论和交流
- **关注作者**: 关注活跃的研究者，获取其最新标注
- **用户档案**: 查看用户统计信息和贡献历史

### 🔍 多维度展示
- **Item Pane集成**: 在Zotero右侧面板查看共享标注
- **阅读器集成**: 在PDF阅读器中实时显示相关标注
- **智能过滤**: 按页面、作者、质量等维度筛选标注
- **搜索功能**: 快速查找特定内容的标注

## 🚀 快速开始

### 安装插件

1. **下载插件**: 从[Releases页面](https://github.com/your-repo/researchopia/releases)下载最新版本的`.xpi`文件
2. **安装到Zotero**:
   - 打开Zotero 8 beta
   - 进入 `工具` → `插件`
   - 点击齿轮图标 → `Install Add-on From File...`
   - 选择下载的`.xpi`文件
3. **重启Zotero**: 安装完成后重启Zotero

### 首次使用

1. **打开偏好设置**: `编辑` → `偏好设置` → `Researchopia`
2. **创建账户**: 点击"注册"按钮，输入邮箱和密码
3. **登录**: 使用创建的账户登录
4. **开始使用**: 选择一篇有DOI的论文，在右侧面板查看"Shared Annotations"

### 基本操作

#### 📤 分享标注
1. 在Zotero中打开一篇有DOI的论文
2. 添加您的标注和笔记
3. 在右侧"Shared Annotations"面板点击"Share My Annotations"
4. 您的标注将上传到云端，供其他用户查看

#### 👀 查看共享标注
1. 选择任意有DOI的论文
2. 在右侧面板查看其他用户的标注
3. 使用搜索和过滤功能找到相关内容
4. 点击标注可以点赞或评论

#### 📖 阅读器中查看标注
1. 在Zotero中打开PDF阅读器
2. 右上角会出现标注面板
3. 点击切换按钮展开/收起面板
4. 标注按页面分组显示，点击可跳转到对应位置

## 🛠️ 开发环境设置

### 前置要求

- **Node.js** (推荐 v18+)
- **npm** 或 yarn
- **Zotero 8 beta版本**
- **Supabase账户** (用于后端服务)

### 开发安装

```bash
# 克隆仓库
git clone https://github.com/your-repo/researchopia.git
cd researchopia

# 安装依赖
npm install

# 配置Supabase (见下方说明)
# 编辑 src/config/supabase.ts

# 开发模式 (热重载)
npm start

# 构建生产版本
npm run build
```

### Supabase配置

1. **创建项目**: 在[Supabase](https://supabase.com)创建新项目
2. **获取密钥**: 在项目设置中获取URL和anon key
3. **更新配置**: 编辑 `src/config/supabase.ts`:

```typescript
export const SUPABASE_CONFIG = {
  url: "https://your-project.supabase.co",
  anonKey: "your-anon-key",
};
```

4. **导入数据库架构**: 在Supabase SQL编辑器中运行 `supabase-schema.sql`

4. 在Supabase中创建以下数据表：

```sql
-- 共享标注表
CREATE TABLE shared_annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doi TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  annotation_text TEXT,
  annotation_comment TEXT,
  page_number INTEGER,
  position JSONB,
  annotation_type TEXT,
  annotation_color TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 点赞表
CREATE TABLE annotation_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  annotation_id UUID REFERENCES shared_annotations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(annotation_id, user_id)
);

-- 评论表
CREATE TABLE annotation_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  annotation_id UUID REFERENCES shared_annotations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 关注表
CREATE TABLE user_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES auth.users(id),
  following_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);
```

### 开发和测试

#### 构建插件

```bash
npm run build
```

#### 启动热重载开发模式

```bash
npm start
```

这将：
1. 构建插件
2. 启动Zotero
3. 自动加载插件
4. 监听文件变化并自动重新加载

#### 代码检查和格式化

```bash
# 检查代码风格
npm run lint:check

# 自动修复代码风格
npm run lint:fix
```

## 使用说明

### 1. 登录账户

1. 打开Zotero偏好设置
2. 找到"Researchopia"选项卡
3. 输入邮箱和密码登录，或注册新账户

### 2. 共享标注

1. 选择一个有DOI的论文条目
2. 在右侧Item Pane中找到"Shared Annotations"部分
3. 点击"Share My Annotations"按钮上传你的标注

### 3. 查看共享标注

1. 选择任何有DOI的论文条目
2. 在"Shared Annotations"部分查看所有用户的共享标注
3. 可以点赞、评论或分享标注

## 项目结构

```
src/
├── config/          # 配置文件
├── modules/         # 核心模块
│   ├── auth.ts      # 用户认证
│   ├── annotations.ts # 标注管理
│   ├── ui.ts        # 用户界面
│   └── preferenceScript.ts # 偏好设置
├── utils/           # 工具函数
└── addon.ts         # 主插件类

addon/
├── content/         # 静态资源
├── locale/          # 本地化文件
├── bootstrap.js     # 插件启动脚本
├── manifest.json    # 插件清单
└── prefs.js         # 默认偏好设置
```

## 贡献指南

1. Fork本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 许可证

本项目采用AGPL-3.0许可证。详见[LICENSE](LICENSE)文件。

## 支持

如有问题或建议，请在GitHub上创建issue。
