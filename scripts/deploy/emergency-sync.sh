#!/bin/bash

echo "=== 紧急同步本地版本到Vercel ==="

# 确保在正确的目录
cd "d:\AI\Rating\academic-rating"

echo "1. 检查当前Git状态..."
git status

echo "2. 添加所有文件到Git..."
git add .

echo "3. 提交当前版本..."
git commit -m "Emergency sync: Force local version to production - $(date)"

echo "4. 推送到远程仓库..."
git push origin main

echo "5. 触发Vercel重新部署..."
# 如果安装了vercel CLI
if command -v vercel &> /dev/null; then
    vercel --prod --force
else
    echo "请手动访问Vercel Dashboard触发重新部署"
    echo "URL: https://vercel.com/dashboard"
fi

echo "=== 同步完成 ==="
echo "请等待1-2分钟后访问: https://academic-rating.vercel.app/"
