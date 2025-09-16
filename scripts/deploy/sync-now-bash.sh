#!/bin/bash
echo "开始同步本地和在线版本..."

# 切换到项目目录 (bash/Unix风格)
cd "/d/AI/Rating/academic-rating" || {
    echo "错误: 无法切换到项目目录"
    echo "请确认路径是否正确: /d/AI/Rating/academic-rating"
    exit 1
}

echo "当前目录: $(pwd)"

# 添加所有更改
echo "添加文件到Git..."
git add .

# 提交更改
echo "提交更改..."
git commit -m "同步最新的研学港品牌更新到在线版本"

# 推送到远程仓库
echo "推送到GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Git推送成功!"
    
    # 触发Vercel部署 (使用curl，因为bash没有Invoke-RestMethod)
    echo "触发Vercel部署..."
    curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3/7UrWOe4H6t"
    
    echo ""
    echo "部署完成！请等待2-3分钟后访问："
    echo "https://academic-rating.vercel.app/"
else
    echo "❌ Git推送失败!"
    exit 1
fi

echo ""
echo "按Enter键退出..."
read
