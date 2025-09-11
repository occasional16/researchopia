# Git修复和部署脚本

## 问题诊断
错误 "src refspec main does not match any" 通常表示：
1. 没有 main 分支
2. 没有提交记录
3. 远程仓库配置问题

## 解决方案

### 方法1：重新初始化Git仓库
```powershell
cd "d:\AI\Rating\academic-rating"

# 检查当前状态
git status
git branch -a

# 如果没有分支，创建并切换到main分支
git checkout -b main

# 添加所有文件
git add .

# 创建初始提交
git commit -m "Initial commit: Academic Rating Platform"

# 检查是否有远程仓库
git remote -v

# 如果没有远程仓库，需要添加
# git remote add origin https://github.com/your-username/academic-rating.git

# 推送到远程
git push -u origin main
```

### 方法2：如果分支名不是main
```powershell
# 查看当前分支
git branch

# 如果是master分支，推送master
git push origin master

# 或者重命名分支为main
git branch -m master main
git push -u origin main
```

### 方法3：强制推送（小心使用）
```powershell
git push origin main --force
```

### 方法4：直接使用Vercel CLI部署
```powershell
# 如果Git有问题，直接用Vercel部署
vercel --prod
```

## 检查本地页面问题

如果本地页面显示不正常，可能需要：

```powershell
# 停止当前开发服务器
# 按 Ctrl+C 停止

# 清除缓存并重新启动
rm -rf .next
npm install
npm run dev
```

## 执行步骤

1. 打开PowerShell
2. 执行上述命令
3. 检查输出结果
4. 根据结果选择对应的解决方案
