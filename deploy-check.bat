@echo off
echo 🚀 学术评价平台 - 一键部署脚本
echo.

echo 📋 步骤1: 停止开发服务器...
taskkill /F /IM node.exe >nul 2>&1

echo 📋 步骤2: 切换到项目目录...
cd /d "d:\AI\Rating\academic-rating"

echo 📋 步骤3: 安装依赖...
call npm install

echo 📋 步骤4: 运行构建测试...
call npm run build

if %ERRORLEVEL% EQU 0 (
    echo ✅ 构建成功！
    echo.
    echo 🎯 下一步行动:
    echo 1. 在GitHub创建仓库并推送代码
    echo 2. 在Vercel.com导入项目
    echo 3. 配置环境变量（复制.env.local内容）
    echo 4. 部署到生产环境
    echo.
    echo 💡 或者运行: deploy-to-vercel.bat
    echo.
) else (
    echo ❌ 构建失败！请检查错误信息
    echo.
)

echo 📋 步骤5: 重新启动开发服务器...
start "学术评价平台" cmd /k "npm run dev"

echo.
echo 🎉 脚本执行完成！
echo 🌐 本地访问: http://localhost:3000 或 http://localhost:3001
pause
