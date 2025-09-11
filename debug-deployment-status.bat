@echo off
echo 🔍 Vercel部署状态检查工具
echo ========================================
echo.

echo 📋 当前状态分析:
echo ✅ Deploy Hook已触发 (Job ID: 44iAHPrFNHwyJXQhosgb)
echo ❌ 网站内容未更新 (仍显示旧版本)
echo.

echo 🎯 可能的原因:
echo 1. 部署失败但没有显示错误
echo 2. Vercel缓存问题
echo 3. Git仓库连接问题
echo 4. 环境变量或构建问题
echo.

echo 📋 检查步骤:
echo.
echo 1. 访问 Vercel Dashboard:
echo    https://vercel.com/dashboard
echo.
echo 2. 进入项目: academic-rating
echo    项目ID: prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3
echo.
echo 3. 点击 "Deployments" 标签
echo.
echo 4. 查找最新的部署记录:
echo    - 时间: 2025-09-11 (昨天)
echo    - 状态: 应该显示 Ready/Error/Building
echo    - 触发方式: Deploy Hook
echo.
echo 5. 点击具体部署记录查看:
echo    - 构建日志 (Build Logs)
echo    - 函数日志 (Function Logs)  
echo    - 部署详情 (Details)
echo.

echo 💡 如果找不到Job ID 44iAHPrFNHwyJXQhosgb:
echo - 检查 "Functions" 或 "Activity" 标签
echo - 查看是否有任何错误消息
echo - 确认Deploy Hook是否正确配置
echo.

echo 🔧 故障排除方案:
echo A. 如果部署失败 → 查看错误日志
echo B. 如果部署成功但网站未更新 → 清除缓存
echo C. 如果找不到部署记录 → 重新触发部署
echo.

echo 📱 快速重新部署命令:
echo Invoke-RestMethod -Uri "https://api.vercel.com/v1/integrations/deploy/prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3/7UrWOe4H6t" -Method Post
echo.

pause
