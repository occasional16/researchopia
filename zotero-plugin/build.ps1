# Build script to create XPI package for Zotero plugin
# Usage: .\build.ps1

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$orig = Get-Location
Set-Location $here

Write-Host "Building Academic Rating Zotero Plugin..." -ForegroundColor Green

# Clean up any existing build
if (Test-Path "academic-rating-zotero.zip") {
    Remove-Item "academic-rating-zotero.zip"
    Write-Host "Removed existing ZIP file" -ForegroundColor Yellow
}
if (Test-Path "academic-rating-zotero.xpi") {
    Remove-Item "academic-rating-zotero.xpi"
    Write-Host "Removed existing XPI file" -ForegroundColor Yellow
}

# Create ZIP file first (XPI is just a renamed ZIP)
$exclude = @(
    "build.ps1",
    "README.md",
    ".git*",
    "*.xpi",
    "*.zip",
    "academic-rating-zotero.xpi",
    "academic-rating-zotero.zip",
    "prefs.js" # exclude legacy root prefs
)
$files = Get-ChildItem -Path $here -Recurse | Where-Object {
    $item = $_
    $shouldExclude = $false
    foreach ($pattern in $exclude) {
        if ($item.Name -like $pattern -or $item.FullName -like (Join-Path $here $pattern)) {
            $shouldExclude = $true
            break
        }
    }
    # Only include files under the plugin directory
    $underHere = $item.FullName.StartsWith($here)
    return $underHere -and -not $shouldExclude -and -not $item.PSIsContainer
}

Write-Host "Including files:" -ForegroundColor Cyan
$files | ForEach-Object { Write-Host "  $($_.FullName.Substring((Get-Location).Path.Length + 1))" }

# Use PowerShell's Compress-Archive to create ZIP
Compress-Archive -Path $files.FullName -DestinationPath "academic-rating-zotero.zip" -Force

# Rename ZIP to XPI
Move-Item "academic-rating-zotero.zip" "academic-rating-zotero.xpi" -Force

Write-Host ""
Write-Host "✅ Built: academic-rating-zotero.xpi" -ForegroundColor Green
Write-Host "📦 Size: $((Get-Item 'academic-rating-zotero.xpi').Length) bytes" -ForegroundColor Cyan
Write-Host ""
Write-Host "To install:" -ForegroundColor Yellow
Write-Host "1. Open Zotero 8 beta" -ForegroundColor White
Write-Host "2. Tools → Plugins → Install Plugin From File..." -ForegroundColor White
Write-Host "3. Select academic-rating-zotero.xpi" -ForegroundColor White

# restore cwd
Set-Location $orig