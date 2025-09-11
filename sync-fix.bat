@echo off
echo ================================
echo 研学港 同步修复脚本
echo ================================
echo.

echo 1. 检查本地状态...
git status
echo.

echo 2. 查看未推送提交...
git log --oneline origin/main..HEAD
echo.

echo 3. 尝试推送到GitHub...
git push origin main --force-with-lease
echo.

echo 4. 验证推送结果...
git log --oneline -3
echo.

echo ================================
echo 如果推送成功，请：
echo 1. 等待3-5分钟让Vercel自动部署
echo 2. 访问 https://academic-rating.vercel.app/
echo 3. 清除浏览器缓存(Ctrl+F5)
echo 4. 检查是否显示"研学港 Researchopia"
echo ================================
pause
