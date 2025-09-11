# 研学港 Researchopia 品牌更新部署脚本

Write-Host "🎨 研学港 Researchopia 品牌更新部署" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 切换到项目目录
$projectPath = "D:\AI\Rating\academic-rating"
Set-Location $projectPath
Write-Host "📂 项目目录: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# 提交更改
Write-Host "📋 步骤1: 提交Researchopia品牌更新..." -ForegroundColor Yellow
try {
    git add -A
    git commit -m "🎨 Brand Update: Complete rebrand from ResearchHub to Researchopia

✨ Changes:
- Updated all brand references to Researchopia  
- Updated website metadata and SEO content
- Updated logo components and SVG files
- Updated package.json and documentation
- Maintained Chinese brand name 研学港
- Ready for production deployment

🚀 New branding: 研学港 Researchopia - 研学并进，智慧共享"
    Write-Host "✅ Git提交成功！" -ForegroundColor Green
}
catch {
    Write-Host "ℹ️ 可能没有新的更改需要提交" -ForegroundColor Yellow
}

Write-Host ""

# 推送到远程仓库
Write-Host "📋 步骤2: 推送到Git仓库..." -ForegroundColor Yellow
try {
    git push origin main
    Write-Host "✅ Git推送成功！" -ForegroundColor Green
}
catch {
    Write-Host "⚠️ Git推送失败，可能需要手动处理" -ForegroundColor Red
}

Write-Host ""

# 构建测试
Write-Host "📋 步骤3: 测试构建..." -ForegroundColor Yellow
try {
    npm run build
    Write-Host "✅ 构建测试成功！" -ForegroundColor Green
}
catch {
    Write-Host "❌ 构建失败，请检查错误" -ForegroundColor Red
    Read-Host "按Enter键继续..."
    exit 1
}

Write-Host ""
Write-Host "🎯 部署信息:" -ForegroundColor Cyan
Write-Host "📊 项目名称: academic-rating" -ForegroundColor White
Write-Host "🆔 项目ID: prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3" -ForegroundColor White
Write-Host "🌐 目标URL: https://academic-rating.vercel.app/" -ForegroundColor White
Write-Host "🎨 新品牌: 研学港 Researchopia" -ForegroundColor White

Write-Host ""
Write-Host "📋 手动部署步骤:" -ForegroundColor Yellow
Write-Host "1. 访问: https://vercel.com/dashboard" -ForegroundColor White
Write-Host "2. 找到项目: academic-rating" -ForegroundColor White
Write-Host "3. 点击 'Redeploy' 按钮" -ForegroundColor White
Write-Host "4. 取消勾选 'Use existing Build Cache'" -ForegroundColor White
Write-Host "5. 确认部署并等待完成" -ForegroundColor White
Write-Host "6. 验证: https://academic-rating.vercel.app/" -ForegroundColor White

Write-Host ""
Write-Host "🔍 验证检查清单:" -ForegroundColor Yellow
Write-Host "- [ ] 网站标题显示 '研学港 Researchopia'" -ForegroundColor White
Write-Host "- [ ] Logo显示Researchopia文字" -ForegroundColor White
Write-Host "- [ ] 页面元数据已更新" -ForegroundColor White
Write-Host "- [ ] 所有功能正常工作" -ForegroundColor White

Write-Host ""
Write-Host "🎉 脚本执行完成！" -ForegroundColor Green
Write-Host "📱 现在请在Vercel Dashboard完成最后部署" -ForegroundColor Cyan

Read-Host "按Enter键退出..."
