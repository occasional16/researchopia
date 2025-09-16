@echo off
echo 🔄 同步本地最新版本到Vercel
echo.

echo 📋 当前时间: %date% %time%
echo 📂 项目目录: d:\AI\Rating\academic-rating
echo.

echo 📋 步骤1: 切换到项目目录
cd /d "d:\AI\Rating\academic-rating"

echo.
echo 📋 步骤2: 检查项目状态
echo 📁 当前目录: %CD%
if exist ".vercel\project.json" (
    echo ✅ Vercel项目已配置
) else (
    echo ❌ Vercel项目未配置
)

echo.
echo 📋 步骤3: 提交所有最新更改
git add .
git status --porcelain
git commit -m "同步最新功能到生产环境 - %date% %time%" 2>nul || echo "没有新的更改需要提交"

echo.
echo 📋 步骤4: 检查构建
echo 🏗️ 测试项目构建...
call npm run build
if %ERRORLEVEL% EQU 0 (
    echo ✅ 构建成功！
) else (
    echo ❌ 构建失败！请检查错误
    pause
    exit /b 1
)

echo.
echo 📋 步骤5: 部署到Vercel
echo 🚀 开始部署...

echo.
echo 💡 部署选项:
echo 1. 使用 npm run build 成功，代码已准备就绪
echo 2. Vercel项目ID: prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3
echo 3. 项目名称: academic-rating
echo.

echo 🌐 目标URL: https://academic-rating.vercel.app/
echo 📊 请访问 Vercel Dashboard 手动触发部署
echo 🔗 Vercel Dashboard: https://vercel.com/dashboard

echo.
echo 📋 手动部署步骤:
echo 1. 访问 https://vercel.com/dashboard
echo 2. 找到 "academic-rating" 项目
echo 3. 点击项目名称进入详情页
echo 4. 点击 "Redeploy" 按钮
echo 5. 取消勾选 "Use existing Build Cache"
echo 6. 点击 "Redeploy" 确认
echo 7. 等待部署完成 (通常2-5分钟)
echo 8. 访问 https://academic-rating.vercel.app/ 验证

echo.
echo 🎯 验证清单:
echo - [ ] 页面布局与本地一致
echo - [ ] 功能按钮正常工作
echo - [ ] 数据正确显示
echo - [ ] 响应式设计正常

echo.
echo 🎉 同步脚本执行完成！
echo 📱 现在请手动在Vercel Dashboard完成部署
pause
