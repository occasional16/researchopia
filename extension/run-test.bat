@echo off
echo 🚀 研学港扩展调试测试启动
echo ================================

echo.
echo 📦 检查扩展文件...
if not exist "manifest.json" (
    echo ❌ manifest.json 未找到
    pause
    exit /b 1
)

if not exist "content-debug.js" (
    echo ❌ content-debug.js 未找到
    pause
    exit /b 1
)

echo ✅ 扩展文件检查完成

echo.
echo 🌐 启动测试页面...
echo 请在浏览器中执行以下步骤:
echo.
echo 1. 打开 Chrome 浏览器
echo 2. 访问 chrome://extensions/
echo 3. 启用"开发者模式"
echo 4. 点击"加载已解压的扩展程序"
echo 5. 选择当前文件夹: %cd%
echo 6. 打开测试页面: file://%cd%\test-page.html
echo.

echo 💡 调试提示:
echo - 按 F12 打开开发者工具查看控制台输出
echo - 查找以 🚀、✅、❌ 开头的研学港扩展日志
echo - 浮动图标应该出现在页面右侧
echo - 点击浮动图标应该打开侧边栏
echo.

echo 📋 测试页面路径:
echo file://%cd%\test-page.html
echo.

:: 尝试在默认浏览器中打开测试页面
start "" "test-page.html"

echo.
echo 🎯 测试就绪! 按任意键退出...
pause > nul