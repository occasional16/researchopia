# PowerShell 自动重启脚本
Write-Host "🔄 开发服务器自动重启脚本" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

# 设置工作目录
Set-Location "D:\AI\Rating\academic-rating"

while ($true) {
    Write-Host ""
    Write-Host "⏰ $(Get-Date)" -ForegroundColor Yellow
    Write-Host "🚀 启动开发服务器..." -ForegroundColor Green
    
    # 启动开发服务器
    try {
        npm run dev
    } catch {
        Write-Host "❌ 服务器启动失败: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "⚠️  服务器已停止" -ForegroundColor Yellow
    Write-Host "💭 3秒后自动重启..." -ForegroundColor Cyan
    Start-Sleep -Seconds 3
}
