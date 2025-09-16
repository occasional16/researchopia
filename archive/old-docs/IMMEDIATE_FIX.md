# 🚨 紧急修复指南

## 问题总结
1. ✅ **Git推送失败**：`error: src refspec main does not match any`
2. ✅ **本地页面异常**：现在运行在端口3006
3. ✅ **线上版本未更新**：需要重新部署

## 立即解决方案

### 第1步：修复Git问题
在PowerShell中依次执行：
```powershell
cd "d:\AI\Rating\academic-rating"

# 检查Git状态
git status

# 如果没有初始化，执行初始化
git init

# 创建main分支
git checkout -b main

# 添加所有文件
git add .

# 创建提交
git commit -m "Initial commit: Academic Rating Platform"

# 如果有远程仓库，推送
git push -u origin main
```

### 第2步：直接Vercel部署（推荐）
```powershell
cd "d:\AI\Rating\academic-rating"
vercel --prod
```

### 第3步：手动Vercel Dashboard部署（最可靠）
1. 访问：https://vercel.com/dashboard
2. 找到 `academic-rating` 项目
3. 点击项目进入详情页面
4. 转到 "Deployments" 标签
5. 点击右上角 "Create Deployment"
6. 选择分支（通常是main或master）
7. 点击 "Deploy"

### 第4步：更新本地访问地址
本地服务器现在运行在：**http://localhost:3006**

使用对比工具：
1. 访问 http://localhost:3006/version-compare.html
2. 修改本地地址为 `localhost:3006`

## 快速验证
- 本地版本：http://localhost:3006
- 生产版本：https://academic-rating.vercel.app
- 对比工具：http://localhost:3006/version-compare.html

## 如果所有方法都失败
1. **删除Vercel项目重新创建**：
   - 在Vercel Dashboard删除当前项目
   - 重新从GitHub导入项目
   
2. **创建新的Git仓库**：
   - 在GitHub创建新仓库
   - 重新连接到Vercel

## 执行脚本
我已创建了 `quick-git-fix.bat` 脚本，直接双击运行即可。

## 状态检查
- [ ] Git仓库修复完成
- [ ] 代码推送成功
- [ ] Vercel重新部署
- [ ] 生产环境更新确认
