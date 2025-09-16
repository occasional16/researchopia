@echo off
echo 🔄 研学港 Researchopia - Vercel项目重新连接方案
echo =====================================================
echo.

echo 📋 问题分析:
echo - 现有Vercel项目ID: prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3
echo - 项目名称: academic-rating
echo - 新GitHub仓库: https://github.com/occasional15/researchopia
echo - 问题: Vercel项目与新仓库未正确连接
echo.

echo 🎯 解决方案A: 重新连接现有项目
echo 1. 访问: https://vercel.com/dashboard
echo 2. 找到项目: academic-rating
echo 3. 点击项目名称进入详情页
echo 4. 点击 Settings 标签
echo 5. 点击左侧 "Git" 选项
echo 6. 点击 "Disconnect" 断开当前连接
echo 7. 点击 "Connect Git Repository"
echo 8. 选择 GitHub
echo 9. 搜索并选择 "occasional15/researchopia"
echo 10. 确认连接
echo.

echo 🎯 解决方案B: 创建新的Vercel项目
echo 1. 访问: https://vercel.com/new
echo 2. 选择 "Import Git Repository"
echo 3. 选择 GitHub
echo 4. 找到并选择 "occasional15/researchopia"
echo 5. 项目名称: researchopia
echo 6. Framework Preset: Next.js
echo 7. 配置环境变量 (从旧项目复制):
echo    - NEXT_PUBLIC_SUPABASE_URL
echo    - NEXT_PUBLIC_SUPABASE_ANON_KEY
echo    - SUPABASE_SERVICE_ROLE_KEY
echo 8. 点击 Deploy
echo.

echo 💡 推荐使用方案A，保持现有项目不变
echo 🌐 部署完成后访问: https://academic-rating.vercel.app/ 
echo.

pause
