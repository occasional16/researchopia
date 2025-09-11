@echo off
echo === 环境变量配置检查脚本 ===

cd "d:\AI\Rating\academic-rating"

echo 1. 检查本地环境变量...
if exist .env.local (
    echo 本地环境变量文件存在
    findstr "NEXT_PUBLIC_SUPABASE_URL" .env.local
    findstr "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local
) else (
    echo 警告: .env.local 文件不存在
)

echo.
echo 2. 验证Vercel环境变量设置...
echo 请手动检查Vercel Dashboard中的环境变量：
echo https://vercel.com/dashboard/academic-rating/settings/environment-variables
echo.
echo 必需的环境变量：
echo - NEXT_PUBLIC_SUPABASE_URL
echo - NEXT_PUBLIC_SUPABASE_ANON_KEY  
echo - SUPABASE_SERVICE_ROLE_KEY
echo.

echo 3. 测试生产环境连接...
echo 访问生产环境测试数据库连接：
echo https://academic-rating.vercel.app
echo.

pause
