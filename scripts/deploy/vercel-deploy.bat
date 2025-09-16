@echo off
echo === Vercel CLI 部署脚本 ===

cd "d:\AI\Rating\academic-rating"

echo 1. 检查Vercel CLI...
where vercel >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo 安装Vercel CLI...
    npm install -g vercel
)

echo 2. 登录Vercel...
vercel login

echo 3. 部署到生产环境...
vercel --prod

if %ERRORLEVEL% eq 0 (
    echo 部署成功！
    echo 请访问: https://academic-rating.vercel.app
) else (
    echo 部署失败，请尝试手动方式：
    echo 1. 访问 https://vercel.com/dashboard
    echo 2. 找到 academic-rating 项目
    echo 3. 进入项目详情页
    echo 4. 在 Deployments 中找到最新部署
    echo 5. 点击 ... 菜单选择 Redeploy
)

pause
