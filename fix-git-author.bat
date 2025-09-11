@echo off
echo 🔧 修复Git作者信息并重新提交
echo ========================================
echo.

cd /d "D:\AI\Rating\academic-rating"
echo 📂 当前目录: %CD%
echo.

echo 📋 步骤1: 设置Git作者信息
echo 💡 请输入您的姓名（或使用 Researchopia Team）:
set /p git_name="姓名 (直接回车使用 'Researchopia Team'): "
if "%git_name%"=="" set git_name=Researchopia Team

echo 💡 请输入您的邮箱（或使用示例邮箱）:
set /p git_email="邮箱 (直接回车使用 'dev@researchopia.com'): "
if "%git_email%"=="" set git_email=dev@researchopia.com

echo.
echo 设置Git配置...
git config --global user.name "%git_name%"
git config --global user.email "%git_email%"
echo ✅ Git作者信息已设置: %git_name% <%git_email%>
echo.

echo 📋 步骤2: 检查当前提交状态
git log --oneline -1
echo.

echo 📋 步骤3: 修复最后一次提交的作者信息
git commit --amend --author="%git_name% <%git_email%>" --no-edit
echo ✅ 提交作者信息已修复
echo.

echo 📋 步骤4: 强制推送到远程仓库
git push --force-with-lease origin main
if %ERRORLEVEL% EQU 0 (
    echo ✅ 推送成功！
) else (
    echo ❌ 推送失败，请检查网络连接
)
echo.

echo 🎯 现在可以在Vercel中部署了:
echo 1. 访问: https://vercel.com/dashboard
echo 2. 找到项目: academic-rating 或创建新项目连接到researchopia仓库
echo 3. 点击 Deployments ^> Create Deployment ^> main
echo 4. 点击 Create Deployment
echo.
echo ✅ Git作者信息问题已解决！
pause
