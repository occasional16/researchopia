@echo off
echo ================================
echo Git网络连接诊断与修复工具
echo ================================
echo.

echo 1. 测试基础网络连接...
ping github.com -n 3
echo.

echo 2. 检查DNS解析...
nslookup github.com
echo.

echo 3. 测试HTTPS连接...
curl -I https://github.com 2>nul
if %errorlevel% equ 0 (
    echo    ✅ HTTPS连接正常
) else (
    echo    ❌ HTTPS连接失败
)
echo.

echo 4. 尝试不同的Git配置...
echo    设置更长的超时时间...
git config --global http.timeout 300
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999

echo    设置SSL验证...
git config --global http.sslVerify true
git config --global http.sslCAInfo ""

echo    设置HTTP版本...
git config --global http.version HTTP/1.1
echo.

echo 5. 清除Git凭据缓存...
git config --global --unset-all credential.helper
git config --global credential.helper manager-core
echo.

echo 6. 尝试推送...
git push origin main --force --verbose
echo.

if %errorlevel% neq 0 (
    echo ================================
    echo 推送失败，尝试备选方案:
    echo 1. 使用SSH协议 ^(需要SSH密钥^)
    echo 2. 使用代理服务器
    echo 3. 更换网络环境
    echo 4. 使用GitHub Desktop
    echo ================================
)

pause
