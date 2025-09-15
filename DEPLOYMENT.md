# 部署指南

本文档详细说明如何将学术评价平台部署到生产环境。

## 前置条件

1. **Supabase 项目**: 在 [Supabase](https://supabase.com) 创建项目
2. **Vercel 账号**: 在 [Vercel](https://vercel.com) 注册账号
3. **GitHub 仓库**: 将代码推送到 GitHub

## 步骤 1: 设置 Supabase

### 1.1 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com)
2. 点击 "New Project"
3. 选择组织并填写项目信息
4. 等待项目创建完成

### 1.2 配置数据库

1. 在 Supabase 控制台，进入 "SQL Editor"
2. 创建新查询并粘贴 `database/schema.sql` 的内容
3. 点击 "Run" 执行 SQL 脚本
4. 可选：运行 `database/seed.sql` 添加示例数据

### 1.3 获取 API 密钥

1. 进入 "Settings" > "API"
2. 复制以下信息：
   - Project URL
   - anon public key
   - service_role key (仅用于服务端)

### 1.4 配置认证

1. 进入 "Authentication" > "Settings"
2. 配置邮箱模板（可选）
3. 设置重定向 URL：
   - 开发环境: `http://localhost:3000`
   - 生产环境: `https://your-domain.com`

## 步骤 2: 部署到 Vercel

### 2.1 连接 GitHub

1. 将代码推送到 GitHub 仓库
2. 访问 [Vercel](https://vercel.com)
3. 点击 "New Project"
4. 选择你的 GitHub 仓库

### 2.2 配置环境变量

在 Vercel 项目设置中添加以下环境变量：

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2.3 部署

1. 点击 "Deploy" 开始部署
2. 等待构建完成
3. 访问生成的 URL 测试应用

## 步骤 3: 配置自定义域名（可选）

### 3.1 在 Vercel 中添加域名

1. 进入项目设置 > "Domains"
2. 添加你的域名
3. 按照提示配置 DNS 记录

### 3.2 更新 Supabase 重定向 URL

1. 在 Supabase 控制台更新认证设置
2. 添加新的重定向 URL: `https://your-domain.com`

## 步骤 4: 生产环境优化

### 4.1 性能优化

- 启用 Vercel Analytics（可选）
- 配置 CDN 缓存策略
- 优化图片和静态资源

### 4.2 监控和日志

- 设置 Vercel 函数日志
- 配置 Supabase 日志监控
- 设置错误追踪（如 Sentry）

### 4.3 安全配置

- 检查 Supabase RLS 策略
- 配置 CORS 设置
- 启用 HTTPS（Vercel 自动配置）

## 步骤 5: 测试部署

### 5.1 功能测试

- [ ] 用户注册和登录
- [ ] 添加论文
- [ ] 评分功能
- [ ] 评论功能
- [ ] 搜索功能

### 5.2 性能测试

- 使用 Lighthouse 检查性能分数
- 测试移动端响应性
- 检查加载速度

## 故障排除

### 常见问题

1. **构建失败**
   - 检查环境变量是否正确设置
   - 确认所有依赖都已安装

2. **数据库连接失败**
   - 验证 Supabase URL 和密钥
   - 检查网络连接

3. **认证问题**
   - 确认重定向 URL 配置正确
   - 检查 Supabase 认证设置

### 日志查看

- Vercel 函数日志: Vercel 控制台 > Functions
- Supabase 日志: Supabase 控制台 > Logs
- 浏览器控制台: F12 开发者工具

## 维护

### 定期任务

- 监控应用性能
- 更新依赖包
- 备份数据库
- 检查安全更新

### 扩展建议

- 添加缓存层（Redis）
- 实现全文搜索（Elasticsearch）
- 添加 API 限流
- 配置 CDN 加速

## 支持

如果遇到问题，请：

1. 查看项目 README.md
2. 检查 GitHub Issues
3. 参考 Next.js 和 Supabase 官方文档
