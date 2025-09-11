@echo off
echo 🎨 研学港 Researchopia 品牌更新部署脚本
echo.

echo 📋 步骤1: 切换到项目目录
cd /d "D:\AI\Rating\academic-rating"
echo 当前目录: %CD%

echo.
echo 📋 步骤2: 提交Researchopia品牌更新
git add -A
git commit -m "🎨 Brand Update: Complete rebrand from ResearchHub to Researchopia

✨ Changes:
- Updated all brand references to Researchopia  
- Updated website metadata and SEO content
- Updated logo components and SVG files
- Updated package.json and documentation
- Maintained Chinese brand name 研学港
- Ready for production deployment

🚀 New branding: 研学港 Researchopia - 研学并进，智慧共享"

echo.
echo 📋 步骤3: 推送到Git仓库
git push origin main
if %ERRORLEVEL% EQU 0 (
    echo ✅ Git推送成功！
) else (
    echo ⚠️ Git推送可能有问题，继续部署...
)

echo.
echo 📋 步骤4: 构建测试
call npm run build
if %ERRORLEVEL% EQU 0 (
    echo ✅ 构建成功！
) else (
    echo ❌ 构建失败！请检查错误
    pause
    exit /b 1
)

echo.
echo 🎯 部署信息:
echo 📊 项目名称: academic-rating
echo 🆔 项目ID: prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3
echo 🌐 目标URL: https://academic-rating.vercel.app/
echo 🎨 新品牌: 研学港 Researchopia

echo.
echo 📋 手动部署步骤:
echo 1. 访问: https://vercel.com/dashboard
echo 2. 找到项目: academic-rating
echo 3. 点击 "Redeploy" 按钮
echo 4. 取消勾选 "Use existing Build Cache"
echo 5. 确认部署并等待完成
echo 6. 验证: https://academic-rating.vercel.app/

echo.
echo 🔍 验证检查清单:
echo - [ ] 网站标题显示 "研学港 Researchopia"
echo - [ ] Logo显示Researchopia文字
echo - [ ] 页面元数据已更新
echo - [ ] 所有功能正常工作

echo.
echo 🎉 脚本执行完成！请在Vercel Dashboard完成最后部署
pause
