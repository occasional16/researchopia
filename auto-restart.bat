@echo off
echo 🔄 自动重启服务器脚本
echo ============================

:START
echo.
echo ⏰ %date% %time%
echo 🚀 启动开发服务器...

cd /d "D:\AI\Rating\academic-rating"
npm run dev

echo.
echo ⚠️  服务器已停止
echo 💭 3秒后自动重启...
timeout /t 3 /nobreak >nul

goto START
