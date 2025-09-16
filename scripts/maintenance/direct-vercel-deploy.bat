@echo off
echo 🚀 研学港 Researchopia - 直接Vercel部署脚本
echo =====================================================
echo.

cd /d "D:\AI\Rating\academic-rating"
echo 📂 当前目录: %CD%
echo.

echo 📋 步骤1: 检查Vercel CLI
where vercel >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Vercel CLI未安装，正在安装...
    npm install -g vercel@latest
) else (
    echo ✅ Vercel CLI已安装
)
echo.

echo 📋 步骤2: 检查登录状态
vercel whoami
if %ERRORLEVEL% NEQ 0 (
    echo 📱 需要登录Vercel...
    vercel login
)
echo.

echo 📋 步骤3: 构建项目
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 构建失败！请检查错误
    pause
    exit /b 1
)
echo.

echo 📋 步骤4: 部署到生产环境
echo 🌟 部署包含完整Researchopia品牌的版本...
vercel --prod --force
echo.

echo 📋 步骤5: 验证部署
echo 🌐 访问以下URL验证部署:
echo https://academic-rating.vercel.app/
echo.
echo 🔍 验证检查清单:
echo - [ ] 页面标题显示 "研学港 Researchopia"
echo - [ ] Logo显示 "Researchopia" 文字
echo - [ ] 网站功能正常工作
echo - [ ] 移动端响应式正常
echo.

echo 🎉 部署完成！
pause
