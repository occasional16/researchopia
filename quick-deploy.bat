@echo off
echo 🚀 学术评价平台 - 快速部署脚本
echo.

echo 📋 步骤1: 检查项目目录...
cd /d "d:\AI\Rating\academic-rating"
echo 当前目录: %CD%

echo.
echo 📋 步骤2: 提交最新代码...
git add .
git commit -m "准备部署到生产环境 - %date% %time%"

echo.
echo 📋 步骤3: 检查Vercel配置...
if exist ".vercel\project.json" (
    echo ✅ Vercel项目已配置
    type .vercel\project.json
) else (
    echo ❌ Vercel项目未配置
)

echo.
echo 📋 步骤4: 运行构建测试...
call npm run build
if %ERRORLEVEL% EQU 0 (
    echo ✅ 构建成功！
) else (
    echo ❌ 构建失败！
    pause
    exit /b 1
)

echo.
echo 📋 步骤5: 部署信息...
echo 🌐 访问 https://vercel.com/dashboard 查看部署状态
echo 💡 项目ID: prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3
echo 📱 项目名称: academic-rating

echo.
echo 🎯 手动部署步骤:
echo 1. 访问 Vercel Dashboard
echo 2. 找到 academic-rating 项目
echo 3. 点击 "Deploy" 按钮
echo 4. 等待部署完成

echo.
echo 🎉 脚本执行完成！
echo 📊 请查看Vercel Dashboard进行部署
pause
