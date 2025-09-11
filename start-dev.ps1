# 开发服务器启动脚本

Write-Host "🚀 启动学术评价平台开发服务器..." -ForegroundColor Green

# 检查是否在正确的目录
$targetDir = "D:\AI\Rating\academic-rating"
$currentDir = Get-Location

Write-Host "当前目录: $currentDir" -ForegroundColor Yellow
Write-Host "目标目录: $targetDir" -ForegroundColor Yellow

# 切换到项目目录
if ($currentDir.Path -ne $targetDir) {
    Write-Host "正在切换到项目目录..." -ForegroundColor Yellow
    Set-Location $targetDir
}

# 验证package.json存在
if (Test-Path "package.json") {
    Write-Host "✅ 找到 package.json" -ForegroundColor Green
} else {
    Write-Host "❌ 未找到 package.json" -ForegroundColor Red
    Write-Host "当前位置: $(Get-Location)" -ForegroundColor Red
    exit 1
}

# 检查是否有Node进程运行在3000端口
Write-Host "检查端口3000是否被占用..." -ForegroundColor Yellow
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    Write-Host "⚠️  端口3000已被占用，尝试终止..." -ForegroundColor Yellow
    Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
}

Write-Host "🔄 启动开发服务器..." -ForegroundColor Cyan
Write-Host "📍 项目目录: $(Get-Location)" -ForegroundColor Cyan
Write-Host "🌐 访问地址: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

# 启动开发服务器
npm run dev
