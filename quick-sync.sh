#!/bin/bash
echo "研学港 Researchopia 快速同步脚本"
echo "=================================="

# 检查当前目录
if [ ! -f "package.json" ]; then
    echo "错误：请在项目根目录运行此脚本"
    exit 1
fi

# Git操作
echo "1. 添加所有更改..."
git add .

echo "2. 提交更改..."
git commit -m "🚀 同步研学港品牌到生产环境 $(date '+%Y-%m-%d %H:%M:%S')"

echo "3. 推送到GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ 推送成功！"
    echo "Vercel将自动部署，请等待2-3分钟"
    echo "然后访问: https://academic-rating.vercel.app/"
else
    echo "❌ 推送失败，请检查网络连接"
    exit 1
fi

echo "同步完成！"
