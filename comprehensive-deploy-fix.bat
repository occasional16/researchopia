@echo off
echo 🔧 研学港 Researchopia - 完整部署诊断和修复
echo =====================================================
echo.

cd /d "D:\AI\Rating\academic-rating"
echo 📂 当前目录: %CD%
echo.

echo 📋 步骤1: 验证本地代码版本
findstr /c:"Researchopia" "src\app\layout.tsx" > nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ 本地代码已更新为Researchopia版本
) else (
    echo ❌ 本地代码可能有问题
)
echo.

echo 📋 步骤2: 检查Git状态
git status --porcelain
if %ERRORLEVEL% EQU 0 (
    echo ✅ Git仓库状态正常
) else (
    echo ⚠️ Git状态可能有问题
)
echo.

echo 📋 步骤3: 验证远程仓库连接
git remote -v
echo.

echo 📋 步骤4: 检查最新提交
git log --oneline -3
echo.

echo 📋 步骤5: 构建测试
echo 🏗️ 测试本地构建...
call npm run build
if %ERRORLEVEL% EQU 0 (
    echo ✅ 本地构建成功！
) else (
    echo ❌ 构建失败！这可能是部署失败的原因
    pause
    exit /b 1
)
echo.

echo 📋 步骤6: 重新提交并推送
echo 🔄 确保最新代码已推送到GitHub...
git add .
git commit -m "Deploy fix: Ensure Researchopia brand is deployed - %date% %time%" 2>nul || echo "没有新的更改需要提交"
git push origin main
if %ERRORLEVEL% EQU 0 (
    echo ✅ 代码已推送到GitHub
) else (
    echo ⚠️ 推送可能有问题
)
echo.

echo 📋 步骤7: 触发新的部署
echo 🚀 触发Deploy Hook...
powershell -Command "Invoke-RestMethod -Uri 'https://api.vercel.com/v1/integrations/deploy/prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3/7UrWOe4H6t' -Method Post"
if %ERRORLEVEL% EQU 0 (
    echo ✅ 部署已触发！
) else (
    echo ❌ 部署触发失败
)
echo.

echo 🎯 现在请检查:
echo 1. 访问: https://vercel.com/dashboard  
echo 2. 进入项目: academic-rating
echo 3. 查看 Deployments 标签
echo 4. 等待最新部署完成 (2-5分钟)
echo 5. 验证: https://academic-rating.vercel.app/
echo.

echo 🔍 如果仍然不工作:
echo - 检查Vercel项目是否连接到正确的GitHub仓库
echo - 确认Environment Variables是否正确配置
echo - 查看部署日志中的具体错误信息
echo.

pause
