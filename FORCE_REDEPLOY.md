# 紧急重新部署指南

## 问题描述
在线版本(https://academic-rating.vercel.app/)与本地版本内容不一致，在线版本多了"添加论文"等元素。

## 解决方案

### 方法1：Vercel Dashboard 强制重新部署
1. 访问 https://vercel.com/dashboard
2. 找到 `academic-rating` 项目
3. 进入 Deployments 页面
4. 点击最新部署的三点菜单
5. 选择 "Redeploy" 
6. **重要：选择 "Use existing Build Cache: NO"**
7. 确认重新部署

### 方法2：从本地强制推送
```bash
cd "d:\AI\Rating\academic-rating"
git add .
git commit -m "Force sync with local version"
git push origin main --force
```

### 方法3：清除Vercel项目缓存
1. 在Vercel Dashboard中找到项目
2. 进入 Settings → General
3. 找到 "Build & Development Settings"
4. 修改 Build Command 临时加上缓存清除标志
5. 触发新的部署

### 方法4：检查环境变量
确保生产环境的环境变量与本地一致：
- 在Vercel Dashboard → Settings → Environment Variables
- 确认所有必要的环境变量都已设置

## 验证步骤
1. 部署完成后访问 https://academic-rating.vercel.app/
2. 检查主页是否与 http://localhost:3000 一致
3. 确认没有多余的"添加论文"按钮
4. 测试基本功能：搜索、浏览论文、用户认证

## 注意事项
- 如果问题持续存在，可能需要检查是否有多个Vercel项目指向同一域名
- 确保部署的是正确的Git分支（通常是main）
- 如果有多个部署URL，确认使用的是正确的生产URL
