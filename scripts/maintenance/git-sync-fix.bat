@echo off
echo ===============================
echo Git 同步修复脚本
echo ===============================
echo.

echo 当前目录: %cd%
echo.

echo 1. 检查Git状态
git status
echo.

echo 2. 添加所有更改
git add .
echo.

echo 3. 提交更改
git commit -m "修复PWA manifest和控制台错误 - 更新品牌信息"
echo.

echo 4. 推送到GitHub
git push origin main --force-with-lease
echo.

echo 5. 验证同步状态
git log --oneline -3
echo.

echo ===============================
echo Git同步完成!
echo ===============================
pause
