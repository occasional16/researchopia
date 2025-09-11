# 学术评价平台

一个专业的学术论文评价和讨论平台，类似于豆瓣电影但专注于学术领域。用户可以添加论文、进行多维度评分、发表评论和进行学术讨论。

## 功能特性

- 📚 **智能论文管理**: 通过DOI自动获取论文信息，支持手动添加
- ⭐ **多维度评分**: 创新性、方法论、实用性、总体评价四个维度
- 💬 **学术讨论**: 发表和管理学术评论，促进学术交流
- 👤 **教育邮箱认证**: 仅支持教育机构邮箱注册，确保用户质量
- 🔍 **智能搜索**: 支持标题、作者、关键词和DOI多种搜索方式
- 👁️ **访客友好**: 未登录用户可浏览内容，仅评价和评论需要登录
- 🛡️ **管理员系统**: 完整的后台管理功能，支持用户和内容管理
- 📊 **实时统计**: 系统数据统计和活动监控

## 技术栈

- **前端**: Next.js 15, React, TypeScript, Tailwind CSS
- **后端**: Supabase (PostgreSQL + Auth + Real-time)
- **部署**: Vercel (推荐)

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd academic-rating
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.local.example` 到 `.env.local` 并填入你的 Supabase 配置：

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. 设置 Supabase 数据库

1. 在 [Supabase](https://supabase.com) 创建新项目
2. 在 SQL 编辑器中运行 `database/schema.sql` 创建表结构
3. 可选：运行 `database/seed.sql` 添加示例数据
4. 设置管理员账号：参考 `ADMIN_SETUP.md` 指南

### 5. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 项目结构

```
src/
├── app/                    # Next.js App Router 页面
│   ├── papers/            # 论文相关页面
│   └── globals.css        # 全局样式
├── components/            # React 组件
│   ├── auth/             # 认证相关组件
│   ├── comments/         # 评论组件
│   ├── layout/           # 布局组件
│   ├── papers/           # 论文组件
│   └── rating/           # 评分组件
├── contexts/             # React Context
├── lib/                  # 工具库
│   ├── database.ts       # 数据库操作
│   └── supabase.ts       # Supabase 配置
database/                 # 数据库脚本
├── schema.sql           # 数据库结构
└── seed.sql             # 示例数据
```

## 数据库设计

### 主要表结构

- `users`: 用户信息
- `papers`: 论文信息
- `ratings`: 用户评分
- `comments`: 用户评论

详细的数据库结构请查看 `database/schema.sql`。

## 开发指南

### 添加新功能

1. 在相应的组件目录下创建新组件
2. 如需数据库操作，在 `lib/database.ts` 中添加相关函数
3. 创建对应的页面路由

### 样式规范

- 使用 Tailwind CSS 进行样式开发
- 保持组件的响应式设计
- 遵循现有的设计系统

## 部署

### Vercel 部署（推荐）

1. 将代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. 配置环境变量
4. 部署完成

### 其他平台

项目是标准的 Next.js 应用，可以部署到任何支持 Node.js 的平台。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
