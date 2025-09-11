@echo off
echo 🔧 研学港 Researchopia - Git设置和部署脚本
echo =====================================================
echo.

cd /d "D:\AI\Rating\academic-rating"
echo 📂 当前目录: %CD%
echo.

echo 📋 步骤1: 检查Git状态
git status
echo.

echo 📋 步骤2: 添加所有文件到Git
git add .
echo.

echo 📋 步骤3: 提交Researchopia品牌更新
git commit -m "🎨 Complete Researchopia rebrand

✨ Brand Changes:
- Updated all references from ResearchHub to Researchopia
- Updated website metadata, titles, and SEO content  
- Updated logo components and SVG files
- Updated package.json project name
- Updated documentation and deployment scripts
- Maintained Chinese brand name: 研学港
- Maintained brand slogan: 研学并进，智慧共享

🚀 Ready for production deployment"

echo.
echo 🎯 Git设置完成！现在需要连接到GitHub：
echo.
echo 📋 手动步骤（必需）:
echo 1. 访问 https://github.com/new
echo 2. 创建新仓库，名称建议: researchopia 或 academic-rating
echo 3. 选择 Public 或 Private
echo 4. 不要初始化 README/gitignore/license（已存在）
echo 5. 点击 "Create repository"
echo 6. 复制仓库URL（如: https://github.com/yourusername/researchopia.git）
echo.
echo 📋 然后运行以下命令（替换YOUR_REPO_URL）:
echo git remote add origin YOUR_REPO_URL
echo git branch -M main
echo git push -u origin main
echo.
echo 📋 Vercel重新连接步骤:
echo 1. 访问 https://vercel.com/dashboard
echo 2. 找到 academic-rating 项目
echo 3. 进入 Settings ^> Git
echo 4. 重新连接到新的GitHub仓库
echo 5. 触发新的部署
echo.
echo 🎉 完成后您的网站将显示最新的Researchopia品牌！
pause
