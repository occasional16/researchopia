# 🚀 5分钟快速配置Supabase数据库

## 📋 配置前准备

您的网站当前使用Mock数据模式，数据仅存储在浏览器本地。要实现：
- ✅ **在线数据存储** - 数据永久保存在云端
- ✅ **实时同步** - 所有用户看到相同的论文和评论
- ✅ **多设备访问** - 在任何设备上访问您的数据

需要配置Supabase数据库。

## 🎯 快速配置步骤

### 步骤1：创建Supabase项目 (2分钟)

1. 访问 [supabase.com](https://supabase.com)
2. 点击 "Start your project" 注册账号
3. 点击 "New project"
4. 填写项目信息：
   - **Name**: `academic-rating`
   - **Database Password**: 设置强密码（请记住）
   - **Region**: 选择 `Southeast Asia (Singapore)`
5. 点击 "Create new project"，等待项目创建完成

### 步骤2：获取配置信息 (1分钟)

1. 项目创建完成后，点击左侧 "Settings"
2. 点击 "API"
3. 复制以下两个值：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 步骤3：执行数据库架构 (1分钟)

1. 在Supabase仪表板，点击左侧 "SQL Editor"
2. 点击 "New query"
3. 复制项目中 `supabase-schema.sql` 文件的全部内容
4. 粘贴到SQL编辑器中，点击 "Run"
5. 看到 "Success. No rows returned" 表示成功

### 步骤4：配置Vercel环境变量 (1分钟)

1. 访问 [vercel.com/dashboard](https://vercel.com/dashboard)
2. 选择您的 `academic-rating` 项目
3. 点击 "Settings" → "Environment Variables"
4. 添加两个变量：
   - **Name**: `NEXT_PUBLIC_SUPABASE_URL`，**Value**: 您的Project URL
   - **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`，**Value**: 您的anon public key
5. 点击 "Save"

### 步骤5：重新部署 (自动)

配置完环境变量后，Vercel会自动重新部署您的网站。

## ✅ 验证配置成功

1. 等待部署完成（约1-2分钟）
2. 访问您的网站：https://academic-rating.vercel.app
3. 页面顶部应该显示 "✅ 数据库连接正常"
4. 注册新用户，添加论文，发表评论
5. 在Supabase仪表板的 "Table Editor" 中查看数据

## 🎉 配置完成！

现在您的网站具备：
- ✅ **真实数据库存储** - 数据永久保存
- ✅ **用户认证系统** - 安全的用户管理
- ✅ **实时数据同步** - 所有用户看到相同数据
- ✅ **自动备份** - Supabase自动备份数据
- ✅ **行级安全** - 数据访问权限控制

## 📊 Supabase免费计划限制

- **数据库存储**: 500MB
- **文件存储**: 1GB
- **带宽**: 5GB/月
- **API请求**: 50,000次/月

对于初期使用完全足够！

## 🆘 遇到问题？

如果配置过程中遇到任何问题，请提供：
1. 错误信息截图
2. 您的Supabase项目URL
3. 具体的操作步骤

我将立即为您解决！

---

**🎊 恭喜！您的学术评价平台现在拥有了企业级的数据库支持！**
