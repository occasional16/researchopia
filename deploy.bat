@echo off
echo ========================================
@echo off
echo.
echo 研学港 Researchopia 部署脚本
echo ========================================
echo.

echo 步骤 1: 切换到项目目录
cd /d "d:\AI\Rating\academic-rating"
echo 当前目录: %CD%
echo.

echo 步骤 2: 检查Git状态
git status
echo.

echo 步骤 3: 添加所有更改的文件
git add .
echo Git add 完成
echo.

echo 步骤 4: 提交更改
git commit -m "🎨 完善品牌Logo系统和用户体验 - 新增BrandLogo和LoadingLogo可重用组件 - 优化首页Hero区域Logo展示，添加动画效果 - 更新导航栏Logo，增加悬停交互效果 - 改进404和Loading页面的品牌一致性 - 创建完整的品牌使用指南和部署文档 - 修复客户端组件事件处理器问题"
echo Git commit 完成
echo.

echo 步骤 5: 推送到GitHub (这将触发Vercel自动部署)
git push origin main
echo.

echo ========================================
echo 部署完成! 
echo 请等待2-3分钟，然后访问:
echo https://academic-rating.vercel.app/
echo ========================================
pause
