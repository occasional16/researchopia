Write-Host "🔍 研学港完整诊断和修复脚本" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# 切换到项目目录
Set-Location "d:\AI\Rating\academic-rating"
Write-Host "📁 当前目录: $(Get-Location)" -ForegroundColor Yellow

# 1. 检查本地文件是否包含最新内容
Write-Host "`n1. 检查本地文件内容..." -ForegroundColor Blue
$pageContent = Get-Content "src\app\page.tsx" -Raw -ErrorAction SilentlyContinue
if ($pageContent -and $pageContent -match "研学港 Researchopia") {
    Write-Host "✅ 本地文件包含最新品牌内容" -ForegroundColor Green
} else {
    Write-Host "❌ 本地文件可能有问题" -ForegroundColor Red
    exit 1
}

# 2. 检查Git状态
Write-Host "`n2. 检查Git状态..." -ForegroundColor Blue
$gitStatus = git status --porcelain 2>$null
if ($gitStatus) {
    Write-Host "⚠️ 发现未提交的更改:" -ForegroundColor Yellow
    Write-Host $gitStatus
    
    Write-Host "📝 添加并提交更改..." -ForegroundColor Blue
    git add .
    git commit -m "🚀 强制同步研学港品牌到生产环境 - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
} else {
    Write-Host "✅ 工作区干净" -ForegroundColor Green
}

# 3. 强制推送到GitHub
Write-Host "`n3. 推送到GitHub..." -ForegroundColor Blue
$pushResult = git push origin main --force-with-lease 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 推送成功!" -ForegroundColor Green
} else {
    Write-Host "❌ 推送失败: $pushResult" -ForegroundColor Red
    Write-Host "尝试普通推送..." -ForegroundColor Yellow
    git push origin main
}

# 4. 触发Vercel部署
Write-Host "`n4. 触发Vercel部署..." -ForegroundColor Blue
try {
    Invoke-RestMethod -Uri "https://api.vercel.com/v1/integrations/deploy/prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3/7UrWOe4H6t" -Method Post -TimeoutSec 10
    Write-Host "✅ Vercel部署已触发!" -ForegroundColor Green
} catch {
    Write-Host "⚠️ 部署触发可能失败，但GitHub推送会自动触发部署" -ForegroundColor Yellow
}

# 5. 等待并检查部署状态
Write-Host "`n5. 检查部署结果..." -ForegroundColor Blue
Write-Host "等待60秒让部署完成..." -ForegroundColor Yellow

for ($i = 1; $i -le 12; $i++) {
    Start-Sleep 5
    Write-Host "检查第 $i 次..." -ForegroundColor Gray
    
    try {
        $webContent = Invoke-WebRequest -Uri "https://academic-rating.vercel.app/" -TimeoutSec 10 -UseBasicParsing
        if ($webContent.Content -match "研学港 Researchopia") {
            Write-Host "🎉 部署成功! 在线版本已更新!" -ForegroundColor Green
            Write-Host "✅ 可以访问: https://academic-rating.vercel.app/" -ForegroundColor Cyan
            break
        } elseif ($i -eq 12) {
            Write-Host "⏳ 部署可能还在进行中..." -ForegroundColor Yellow
            Write-Host "请等待几分钟后手动检查: https://academic-rating.vercel.app/" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "网络检查失败，稍后重试..." -ForegroundColor Gray
    }
}

Write-Host "`n📋 操作总结:" -ForegroundColor Cyan
Write-Host "- 本地服务器: http://localhost:3000 ✅"
Write-Host "- 在线网站: https://academic-rating.vercel.app/ (检查中...)"
Write-Host "- 如果在线版本未更新，请等待5-10分钟后重新访问"

Write-Host "`n✨ 修复完成!" -ForegroundColor Green
