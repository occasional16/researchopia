# PowerShell脚本测试Cookie传递

Write-Host "测试Cookie传递到API..." -ForegroundColor Green

# 测试Cookie API
Write-Host "`n1. 测试Cookie API (无Cookie):" -ForegroundColor Yellow
try {
    $response1 = Invoke-RestMethod -Uri "http://localhost:3001/api/test-cookie" -Method GET
    Write-Host ($response1 | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "错误: $($_.Exception.Message)" -ForegroundColor Red
}

# 测试Cookie API (带Cookie)
Write-Host "`n2. 测试Cookie API (带Cookie):" -ForegroundColor Yellow
try {
    $headers = @{
        'Cookie' = 'rp_dev_auth=1; rp_dev_user=%7B%22username%22%3A%22testuser%22%2C%22id%22%3A%22test-123%22%2C%22email%22%3A%22test%40researchopia.com%22%7D'
    }
    $response2 = Invoke-RestMethod -Uri "http://localhost:3001/api/test-cookie" -Method GET -Headers $headers
    Write-Host ($response2 | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "错误: $($_.Exception.Message)" -ForegroundColor Red
}

# 测试认证状态API (带Cookie)
Write-Host "`n3. 测试认证状态API (带Cookie):" -ForegroundColor Yellow
try {
    $headers = @{
        'Cookie' = 'rp_dev_auth=1; rp_dev_user=%7B%22username%22%3A%22testuser%22%2C%22id%22%3A%22test-123%22%2C%22email%22%3A%22test%40researchopia.com%22%7D'
    }
    $response3 = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/status" -Method GET -Headers $headers
    Write-Host ($response3 | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "错误: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n测试完成!" -ForegroundColor Green
