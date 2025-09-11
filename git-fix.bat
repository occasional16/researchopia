@echo off
echo === Git 修复和部署脚本 ===

cd "d:\AI\Rating\academic-rating"

echo 1. 检查当前Git状态...
git status

echo 2. 检查分支信息...
git branch -a

echo 3. 检查远程仓库...
git remote -v

echo 4. 如果没有分支，创建main分支...
git checkout -b main 2>nul

echo 5. 添加所有文件...
git add .

echo 6. 创建提交...
git commit -m "Fix: Force sync local version to production"

echo 7. 尝试推送到main分支...
git push origin main

if %ERRORLEVEL% neq 0 (
    echo 推送失败，尝试推送到master分支...
    git push origin master
    
    if %ERRORLEVEL% neq 0 (
        echo Git推送仍然失败，尝试直接Vercel部署...
        vercel --prod 2>nul
        
        if %ERRORLEVEL% neq 0 (
            echo 请手动访问Vercel Dashboard进行部署
            echo URL: https://vercel.com/dashboard
        )
    )
)

echo.
echo === 修复本地页面显示问题 ===
echo 如果本地页面显示不正常，请执行：
echo 1. 按Ctrl+C停止开发服务器
echo 2. 删除.next文件夹
echo 3. 运行 npm run dev

pause
