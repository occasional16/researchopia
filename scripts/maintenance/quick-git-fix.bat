@echo off
echo === 快速Git修复脚本 ===

cd "d:\AI\Rating\academic-rating"

echo 步骤1: 检查Git仓库状态
git rev-parse --git-dir > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 初始化Git仓库...
    git init
)

echo 步骤2: 检查是否有提交记录
git log --oneline -1 > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo 没有提交记录，创建初始提交...
    git add .
    git commit -m "Initial commit"
)

echo 步骤3: 确保在main分支
git branch | find "main" > nul
if %ERRORLEVEL% neq 0 (
    echo 创建并切换到main分支...
    git checkout -b main
)

echo 步骤4: 添加所有更改
git add .

echo 步骤5: 提交更改
git commit -m "Sync local version to production"

echo 步骤6: 检查远程仓库
git remote -v | find "origin" > nul
if %ERRORLEVEL% neq 0 (
    echo 警告: 没有配置远程仓库origin
    echo 请手动配置: git remote add origin YOUR_REPO_URL
    echo 或直接使用Vercel CLI部署: vercel --prod
    pause
    exit
)

echo 步骤7: 推送到远程仓库
git push origin main

if %ERRORLEVEL% eq 0 (
    echo 成功推送到Git仓库!
) else (
    echo Git推送失败，尝试其他方法...
    echo 方法1: 尝试推送到master分支
    git push origin master
    
    if %ERRORLEVEL% neq 0 (
        echo 方法2: 使用Vercel CLI直接部署
        vercel --prod
        
        if %ERRORLEVEL% neq 0 (
            echo 请手动在Vercel Dashboard重新部署:
            echo https://vercel.com/dashboard
        )
    )
)

echo.
echo === 完成 ===
echo 本地服务器运行在: http://localhost:3006
echo 请等待几分钟后检查生产环境: https://academic-rating.vercel.app
pause
