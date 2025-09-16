# 🚀 Vercel 准确部署指南

## 项目信息
- **项目ID**: prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3
- **项目名称**: academic-rating
- **生产URL**: https://academic-rating.vercel.app

## Vercel Dashboard 操作步骤

### 方法1：通过项目页面重新部署
1. 访问：https://vercel.com/dashboard
2. 找到 **academic-rating** 项目卡片
3. 点击项目名称进入项目详情页
4. 在项目详情页面，找到 **"Deployments"** 标签
5. 在 Deployments 列表中，找到最新的部署记录
6. 点击该部署记录右侧的 **"..."** 三点菜单
7. 选择 **"Redeploy"**
8. 在弹出窗口中：
   - **重要**: 取消勾选 "Use existing Build Cache"
   - 点击 **"Redeploy"** 按钮确认

### 方法2：通过Git触发自动部署
1. 在项目详情页面，找到 **"Git"** 或 **"Settings"** 标签
2. 查看连接的Git仓库信息
3. 确认部署分支（通常是 `main` 或 `master`）
4. 如果没有Git仓库，点击 **"Connect Git Repository"**

### 方法3：直接创建新部署
1. 在项目详情页面
2. 找到页面右上角的 **"Visit"** 按钮附近
3. 查找 **"Actions"** 或 **"Deploy"** 按钮
4. 如果有，点击触发新部署

### 方法4：使用Vercel CLI（推荐）
```powershell
# 在项目目录中
cd "d:\AI\Rating\academic-rating"

# 登录Vercel（如果没有登录）
vercel login

# 部署到生产环境
vercel --prod

# 或者强制部署
vercel --prod --force
```

## 检查部署状态

### 部署过程中
1. 在Vercel Dashboard的项目页面
2. 查看 "Deployments" 标签
3. 最新部署会显示 "Building" 或 "Deploying" 状态
4. 等待状态变为 "Ready"

### 部署完成后
1. 访问：https://academic-rating.vercel.app
2. 强制刷新页面（Ctrl+F5）
3. 对比本地版本：http://localhost:3006

## 故障排除

### 如果找不到重新部署选项
1. **检查权限**：确保你是项目所有者
2. **刷新页面**：Vercel Dashboard界面可能需要刷新
3. **切换团队**：检查是否在正确的团队/组织下

### 如果部署失败
1. 查看部署日志中的错误信息
2. 检查 `package.json` 中的 build 脚本
3. 确认所有依赖都已安装

### 如果部署成功但页面不更新
1. 清除浏览器缓存
2. 等待CDN缓存更新（最多5分钟）
3. 使用无痕浏览器窗口访问

## 直接链接
- **项目Dashboard**: https://vercel.com/team_3qZg6D4ijwWXoogKSgIhuLAb/academic-rating
- **生产URL**: https://academic-rating.vercel.app
- **本地对比**: http://localhost:3006

## 紧急备选方案

如果所有方法都失败：
1. **删除项目重新部署**：
   - 在Vercel Dashboard删除当前项目
   - 重新从本地目录导入项目
   
2. **创建新项目**：
   - 使用不同的项目名称
   - 重新配置域名
