@echo off
echo 开始同步本地和在线版本...

REM 切换到项目目录
cd /d "d:\AI\Rating\academic-rating"

REM 添加所有更改
echo 添加文件到Git...
git add .

REM 提交更改
echo 提交更改...
git commit -m "同步最新的研学港品牌更新到在线版本"

REM 推送到远程仓库
echo 推送到GitHub...
git push origin main

REM 触发Vercel部署
echo 触发Vercel部署...
powershell -Command "Invoke-RestMethod -Uri 'https://api.vercel.com/v1/integrations/deploy/prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3/7UrWOe4H6t' -Method Post"

echo.
echo 部署完成！请等待2-3分钟后访问：
echo https://academic-rating.vercel.app/
echo.
pause
