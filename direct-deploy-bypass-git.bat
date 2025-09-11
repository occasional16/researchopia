@echo off
echo 🚀 研学港 Researchopia - 直接Vercel部署 (绕过Git)
echo =====================================================
echo.

cd /d "D:\AI\Rating\academic-rating"
echo 📂 当前目录: %CD%
echo.

echo 📋 步骤1: 安装/更新 Vercel CLI
npm install -g vercel@latest
echo.

echo 📋 步骤2: 登录 Vercel (如果需要)
echo 💡 如果提示登录，请按照指示操作
vercel whoami
if %ERRORLEVEL% NEQ 0 (
    echo 🔑 需要登录Vercel...
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

echo 📋 步骤4: 直接部署到生产环境
echo 🎨 部署包含完整Researchopia品牌的版本...
echo.
echo 💡 部署时选择:
echo - Link to existing project? 选择 N (No)
echo - Project name: researchopia
echo - Directory: ./ (当前目录)
echo - Override settings? 选择 N (No)
echo.
vercel --prod
echo.

echo 📋 步骤5: 验证部署
echo 🌐 部署完成后，Vercel会提供新的URL
echo 📊 访问新的URL验证Researchopia品牌是否正确显示
echo.

echo 🔍 验证清单:
echo - [ ] 页面标题显示 "研学港 Researchopia"
echo - [ ] Logo显示 "Researchopia" 文字  
echo - [ ] 所有功能正常工作
echo.

echo 🎉 如果一切正常，可以将新URL设置为主URL
pause
