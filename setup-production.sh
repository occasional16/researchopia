#!/bin/bash

# 生产环境配置脚本
echo "🚀 开始配置生产环境..."

# 1. 检查环境变量
echo "📋 检查必需的环境变量..."
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "❌ 缺少 NEXT_PUBLIC_SUPABASE_URL"
    exit 1
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "❌ 缺少 NEXT_PUBLIC_SUPABASE_ANON_KEY"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ 缺少 SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

echo "✅ 环境变量检查完成"

# 2. 测试数据库连接
echo "🔗 测试数据库连接..."
node test-supabase.js

# 3. 运行构建测试
echo "🏗️ 测试项目构建..."
npm run build

echo "🎉 生产环境配置完成！"
