@echo off
echo 🪝 研学港 Researchopia - Deploy Hook 部署方案
echo =====================================================
echo.

echo 📋 Deploy Hook 设置步骤:
echo.
echo 1. 访问 Vercel Dashboard:
echo    https://vercel.com/dashboard
echo.
echo 2. 找到项目: academic-rating
echo    项目ID: prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3
echo.
echo 3. 进入 Settings ^> Git
echo.
echo 4. 滚动到 "Deploy Hooks" 部分
echo    点击 "Create Hook"
echo.
echo 5. 填写信息:
echo    Name: researchopia-main-deploy
echo    Branch: main
echo    点击 "Create Hook"
echo.
echo 6. 复制生成的Hook URL
echo    格式: https://api.vercel.com/v1/integrations/deploy/xxx/xxx
echo.

echo 📋 测试Deploy Hook:
echo.
set /p hook_url="请粘贴Deploy Hook URL: "
if "%hook_url%"=="" (
    echo ❌ URL不能为空
    pause
    exit /b 1
)

echo.
echo 🚀 触发部署...
curl -X POST "%hook_url%"
if %ERRORLEVEL% EQU 0 (
    echo ✅ 部署已触发！
    echo 📊 请在Vercel Dashboard查看部署状态
    echo 🌐 预计2-5分钟后访问: https://academic-rating.vercel.app/
) else (
    echo ❌ 触发失败，请检查URL是否正确
)

echo.
echo 🔍 验证清单:
echo - [ ] 页面标题显示 "研学港 Researchopia"  
echo - [ ] Logo显示 "Researchopia" 文字
echo - [ ] 网站功能正常工作
echo.

echo 💡 成功后可以保存这个URL用于后续快速部署
pause
