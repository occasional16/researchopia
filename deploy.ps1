# 研学港 ResearchHub 部署脚本
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "研学港 ResearchHub 部署脚本" -ForegroundColor Cyan  
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "步骤 1: 切换到项目目录" -ForegroundColor Yellow
Set-Location "d:\AI\Rating\academic-rating"
Write-Host "当前目录: $(Get-Location)" -ForegroundColor Green
Write-Host ""

Write-Host "步骤 2: 检查Git状态" -ForegroundColor Yellow
git status
Write-Host ""

Write-Host "步骤 3: 添加所有更改的文件" -ForegroundColor Yellow
git add .
Write-Host "Git add 完成" -ForegroundColor Green
Write-Host ""

Write-Host "步骤 4: 提交更改" -ForegroundColor Yellow
$commitMessage = @"
🎨 完善品牌Logo系统和用户体验

- 新增BrandLogo和LoadingLogo可重用组件
- 优化首页Hero区域Logo展示，添加动画效果
- 更新导航栏Logo，增加悬停交互效果  
- 改进404和Loading页面的品牌一致性
- 创建完整的品牌使用指南和部署文档
- 修复客户端组件事件处理器问题
"@

git commit -m $commitMessage
Write-Host "Git commit 完成" -ForegroundColor Green
Write-Host ""

Write-Host "步骤 5: 推送到GitHub (这将触发Vercel自动部署)" -ForegroundColor Yellow
git push origin main
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "部署完成!" -ForegroundColor Green
Write-Host "请等待2-3分钟，然后访问:" -ForegroundColor Yellow
Write-Host "https://academic-rating.vercel.app/" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Cyan

Read-Host "按Enter键退出"
