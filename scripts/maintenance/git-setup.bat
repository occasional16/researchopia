@echo off
echo ========================================
echo Git远程仓库配置脚本
echo ========================================
echo.

cd /d "d:\AI\Rating\academic-rating"

echo 当前项目目录: %CD%
echo.

echo 步骤 1: 检查当前Git状态
git status
echo.

echo 步骤 2: 检查远程仓库配置
git remote -v
echo.

echo 步骤 3: 检查分支信息
git branch -a
echo.

echo ========================================
echo 诊断完成！
echo.
echo 如果没有看到远程仓库(origin)，请按照以下步骤操作：
echo.
echo 1. 在GitHub创建新仓库: https://github.com/new
echo 2. 仓库名建议: academic-rating 或 research-hub
echo 3. 复制仓库URL (https://github.com/用户名/仓库名.git)
echo 4. 运行命令: git remote add origin [仓库URL]
echo 5. 推送代码: git push -u origin main
echo.
echo ========================================

pause
