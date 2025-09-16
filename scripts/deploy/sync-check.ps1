# 研学港同步检查脚本
Write-Host "🔍 研学港同步状态检查" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""

# 1. 测试网络连接
Write-Host "1. 网络连接测试..." -ForegroundColor Yellow
try {
    $ping = Test-Connection -ComputerName "github.com" -Count 2 -Quiet
    if ($ping) {
        Write-Host "   ✅ GitHub连接正常" -ForegroundColor Green
    } else {
        Write-Host "   ❌ GitHub连接失败" -ForegroundColor Red
    }
} catch {
    Write-Host "   ⚠️  网络测试异常: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 2. 检查Git状态
Write-Host "`n2. Git状态检查..." -ForegroundColor Yellow
try {
    $gitStatus = git status --porcelain 2>$null
    $gitAhead = git rev-list --count origin/main..HEAD 2>$null
    
    Write-Host "   未提交文件: $($gitStatus.Count) 个" -ForegroundColor $(if ($gitStatus.Count -eq 0) {"Green"} else {"Yellow"})
    Write-Host "   领先远程: $gitAhead 个提交" -ForegroundColor $(if ($gitAhead -eq "0") {"Green"} else {"Red"})
} catch {
    Write-Host "   ❌ Git检查失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. 尝试推送
Write-Host "`n3. 推送状态..." -ForegroundColor Yellow
Write-Host "   💭 如果有未推送提交，执行: git push origin main --force" -ForegroundColor Cyan

Write-Host "`n🎯 下一步操作建议:" -ForegroundColor Magenta
Write-Host "   1. 确保网络连接正常" -ForegroundColor White
Write-Host "   2. 运行: git push origin main --force" -ForegroundColor White  
Write-Host "   3. 等待 3-5 分钟" -ForegroundColor White
Write-Host "   4. 访问: https://academic-rating.vercel.app/" -ForegroundColor White
Write-Host "   5. 清除浏览器缓存 (Ctrl+F5)" -ForegroundColor White
