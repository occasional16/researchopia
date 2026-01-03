# Kill Dev Instance Script
# Purpose: Stop zotero-plugin serve processes and Dev Zotero instance

Write-Host "🔍 Searching for dev processes..." -ForegroundColor Cyan

# Step 1: Find cmd.exe running npm start
$cmdProcesses = Get-WmiObject Win32_Process | Where-Object {
    $_.Name -eq "cmd.exe" -and $_.CommandLine -like "*npm*start*"
}

# Step 2: Find Dev Zotero instance (--purgecaches flag)
$devZoteroProcesses = Get-WmiObject Win32_Process | Where-Object {
    $_.Name -eq "zotero.exe" -and $_.CommandLine -like "*--purgecaches*"
}

$killList = @()
$killList += $cmdProcesses
$killList += $devZoteroProcesses

if ($killList.Count -gt 0) {
    Write-Host "Found $($killList.Count) process(es) to kill:" -ForegroundColor Yellow
    foreach ($proc in $killList) {
        Write-Host "  PID $($proc.ProcessId): $($proc.Name)" -ForegroundColor Gray
    }
    
    foreach ($proc in $killList) {
        Write-Host "🔴 Killing PID $($proc.ProcessId)..." -ForegroundColor Red
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host "✅ Dev processes stopped" -ForegroundColor Green
    Write-Host "⏳ Waiting for cleanup..." -ForegroundColor Cyan
    Start-Sleep 2
} else {
    Write-Host "⚠️  No dev processes found" -ForegroundColor Yellow
}

Write-Host "✅ Done!" -ForegroundColor Green
