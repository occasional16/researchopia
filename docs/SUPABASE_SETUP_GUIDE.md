# 🚀 Supabase数据库配置指南

## 步骤1：创建Supabase项目

1. 访问 [Supabase官网](https://supabase.com)
2. 点击 "Start your project" 注册账号
3. 创建新项目：
   - Project name: `academic-rating`
   - Database password: 设置一个强密码（请记住）
   - Region: 选择 `Southeast Asia (Singapore)` 或最近的区域

## 步骤2：获取项目配置信息

1. 进入项目仪表板
2. 点击左侧 "Settings" → "API"
3. 复制以下信息：
   - **Project URL**: `https://your-project-id.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## 步骤3：执行数据库架构

1. 在Supabase仪表板中，点击左侧 "SQL Editor"
2. 点击 "New query"
3. 复制 `supabase-schema.sql` 文件的全部内容
4. 粘贴到SQL编辑器中
5. 点击 "Run" 执行

## 步骤4：配置环境变量

### 本地开发环境：
1. 复制 `.env.example` 为 `.env.local`
2. 填入您的Supabase配置：
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### Vercel生产环境：
1. 访问 [Vercel仪表板](https://vercel.com/dashboard)
2. 选择您的 `academic-rating` 项目
3. 点击 "Settings" → "Environment Variables"
4. 添加以下变量：
   - `NEXT_PUBLIC_SUPABASE_URL`: 您的项目URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 您的anon key

## 步骤5：验证配置

配置完成后，网站将自动从Mock模式切换到Supabase模式。

### 验证方法：
1. 重新部署网站
2. 注册新用户账号
3. 添加论文、评分、评论
4. 在Supabase仪表板的 "Table Editor" 中查看数据

## 🎯 重要提示

- **免费计划限制**: 500MB存储，50MB文件存储，2GB带宽/月
- **数据安全**: 已配置行级安全策略(RLS)
- **实时同步**: 数据将在所有用户间实时同步
- **备份**: Supabase自动备份，无需担心数据丢失

## 🆘 如需帮助

如果在配置过程中遇到问题，请提供：
1. 错误信息截图
2. Supabase项目URL
3. 具体的操作步骤

我将立即为您解决问题！
