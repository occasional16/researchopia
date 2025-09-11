@echo off
echo ================================
echo Git连接问题修复脚本
echo ================================
echo.

echo 1. 检查网络连接...
ping github.com -n 3
echo.

echo 2. 检查DNS解析...
nslookup github.com
echo.

echo 3. 尝试使用不同的协议推送...
echo 方法1: 使用SSH协议（如果已配置SSH密钥）
echo git remote set-url origin git@github.com:occasional15/researchopia.git
echo git push origin main --force
echo.

echo 方法2: 使用HTTPS with token（推荐）
echo 请确保已设置Personal Access Token
echo git config --global credential.helper store
echo git push origin main --force
echo.

echo 方法3: 临时使用代理（如果有）
echo git config --global http.proxy http://proxy-server:port
echo git config --global https.proxy https://proxy-server:port
echo.

echo 4. 重置网络配置...
echo 清除Git凭据缓存
git config --global --unset credential.helper
git config --global credential.helper manager-core
echo.

echo ================================
echo 手动执行建议:
echo 1. 检查防火墙/杀毒软件是否阻止Git
echo 2. 尝试使用VPN或更换网络环境
echo 3. 使用GitHub Desktop作为备选
echo 4. 检查系统时间是否正确
echo ================================
pause
