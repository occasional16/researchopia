@echo off
REM Researchopia Zotero Plugin Build Script (Windows)

echo 🏗️  Building Researchopia Zotero Plugin (DOI Enhanced)
echo ==================================================

REM 设置变量
set PLUGIN_NAME=researchopia-zotero-plugin-doi-enhanced
set VERSION=v1.0.0
set BUILD_DIR=build
set XPI_NAME=%PLUGIN_NAME%-%VERSION%.xpi

REM 清理之前的构建
echo 🧹 Cleaning previous builds...
if exist %BUILD_DIR% rmdir /s /q %BUILD_DIR%
if exist *.xpi del *.xpi

REM 创建构建目录
mkdir %BUILD_DIR%

REM 复制插件文件
echo 📦 Copying plugin files...
copy manifest.json %BUILD_DIR%\
copy bootstrap.js %BUILD_DIR%\
copy researchopia.js %BUILD_DIR%\
copy config.js %BUILD_DIR%\
copy annotation-sharing.js %BUILD_DIR%\
copy doi-handler.js %BUILD_DIR%\
copy doi-annotation-sharing.js %BUILD_DIR%\
copy style.css %BUILD_DIR%\
copy prefs.js %BUILD_DIR%\
copy test.js %BUILD_DIR%\
copy DOI_PLUGIN_README.md %BUILD_DIR%\README.md

REM 复制目录
echo 📁 Copying directories...
xcopy /e /i defaults %BUILD_DIR%\defaults
xcopy /e /i icons %BUILD_DIR%\icons
xcopy /e /i locale %BUILD_DIR%\locale
xcopy /e /i panel %BUILD_DIR%\panel

REM 创建XPI文件 (先创建ZIP再重命名)
echo 🗜️  Creating XPI package...
set TEMP_ZIP=%PLUGIN_NAME%-%VERSION%.zip
powershell -command "Compress-Archive -Path '%BUILD_DIR%\*' -DestinationPath '%TEMP_ZIP%'"
if exist "%TEMP_ZIP%" (
    ren "%TEMP_ZIP%" "%XPI_NAME%"
)

REM 验证XPI文件
if exist "%XPI_NAME%" (
    echo ✅ Successfully created: %XPI_NAME%
    for %%A in ("%XPI_NAME%") do echo 📊 File size: %%~zA bytes
    echo.
    echo 🎯 Installation instructions:
    echo 1. Open Zotero
    echo 2. Go to Tools → Add-ons
    echo 3. Click the gear icon → Install Add-on From File
    echo 4. Select: %XPI_NAME%
    echo 5. Restart Zotero
    echo.
    echo 🔗 API Configuration:
    echo - Ensure Next.js dev server is running on http://localhost:3003
    echo - Ensure WebSocket server is running on ws://localhost:8080
    echo - Test API at: http://localhost:3003/test/doi-api
) else (
    echo ❌ Failed to create XPI file
    pause
    exit /b 1
)

REM 清理构建目录
echo 🧹 Cleaning up build directory...
rmdir /s /q %BUILD_DIR%

echo.
echo 🎉 Build completed successfully!
echo 📁 Output: %XPI_NAME%
pause