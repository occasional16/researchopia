@echo off
echo 🔄 同步最新版本到Vercel线上环境
echo.

echo 📋 步骤1: 切换到项目目录
cd /d "d:\AI\Rating\academic-rating"
echo 当前目录: %CD%

echo.
echo 📋 步骤2: 检查Git状态
git status

echo.
echo 📋 步骤3: 添加所有更改（包括新文件）
git add .

echo.
echo 📋 步骤4: 提交最新更改
git commit -m "同步最新版本到线上 - %date% %time%"

echo.
echo 📋 步骤5: 检查远程仓库
git remote -v

echo.
echo 📋 步骤6: 推送到远程仓库（如果已配置）
git push origin main 2>nul || (
    echo ⚠️  远程仓库未配置或推送失败
    echo 📝 需要手动配置GitHub仓库
)

echo.
echo 📋 步骤7: 测试本地构建
call npm run build
if %ERRORLEVEL% EQU 0 (
    echo ✅ 本地构建成功！
) else (
    echo ❌ 构建失败，请检查错误
)

echo.
echo 🎯 接下来的操作:
echo 1. 如果GitHub已配置且推送成功，Vercel会自动部署
echo 2. 如果没有，请手动在Vercel Dashboard触发部署
echo 3. 或者使用 'vercel --prod' 命令直接部署

echo.
echo 📊 Vercel项目信息:
echo - 项目ID: prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3
echo - 项目名称: academic-rating
echo - Dashboard: https://vercel.com/dashboard

pause
