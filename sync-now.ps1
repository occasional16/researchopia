Write-Host "开始同步本地和在线版本..." -ForegroundColor Green

# 切换到项目目录
Set-Location -Path "d:\AI\Rating\academic-rating"
Write-Host "当前目录: $(Get-Location)" -ForegroundColor Yellow

# 检查Git状态
Write-Host "检查Git状态..." -ForegroundColor Blue
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "发现未提交的更改:" -ForegroundColor Yellow
    Write-Host $gitStatus
    
    # 添加所有更改
    Write-Host "添加文件到Git..." -ForegroundColor Blue
    git add .
    
    # 提交更改
    Write-Host "提交更改..." -ForegroundColor Blue
    git commit -m "同步最新的研学港品牌更新到在线版本 - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    
    # 推送到远程仓库
    Write-Host "推送到GitHub..." -ForegroundColor Blue
    git push origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 代码推送成功！" -ForegroundColor Green
    } else {
        Write-Host "✗ 代码推送失败！" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✓ 工作区干净，无需提交" -ForegroundColor Green
}

# 触发Vercel部署
Write-Host "触发Vercel部署..." -ForegroundColor Blue
try {
    $deployResult = Invoke-RestMethod -Uri "https://api.vercel.com/v1/integrations/deploy/prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3/7UrWOe4H6t" -Method Post
    Write-Host "✓ Vercel部署触发成功！" -ForegroundColor Green
} catch {
    Write-Host "部署触发可能失败，但这不影响自动部署: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 同步完成 ===" -ForegroundColor Green
Write-Host "本地版本已推送到GitHub"
Write-Host "Vercel将自动部署最新版本（通常需要2-3分钟）"
Write-Host ""
Write-Host "请访问以下地址查看更新："
Write-Host "- 本地版本: http://localhost:3010" -ForegroundColor Cyan
Write-Host "- 在线版本: https://academic-rating.vercel.app/" -ForegroundColor Cyan
Write-Host ""

# 等待用户确认
Read-Host "按Enter键退出"
