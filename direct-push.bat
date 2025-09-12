@echo off
echo =====================
echo Git SSH 推送助手
echo =====================
echo.

echo 当前目录: %cd%
echo.

echo 1. 检查Git状态
git status
echo.

echo 2. 检查远程配置
git remote -v
echo.

echo 3. 如果需要，添加SSH主机验证
ssh-keyscan -H github.com >> %USERPROFILE%\.ssh\known_hosts 2>nul
echo.

echo 4. 开始推送 (如果出现SSH验证提示，请输入 yes)
git push origin main --force
echo.

echo 推送完成!
pause
