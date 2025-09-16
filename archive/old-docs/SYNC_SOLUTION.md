# 研学港同步问题解决方案

## 问题描述
- 本地页面（http://localhost:3010）显示最新的"研学港 Researchopia"品牌
- 在线页面（https://academic-rating.vercel.app/）仍显示旧版本"学术评价平台"

## 解决步骤

### 1. 手动Git同步
```bash
# 进入项目目录
cd d:\AI\Rating\academic-rating

# 添加所有更改
git add .

# 提交更改
git commit -m "同步研学港品牌更新到在线版本"

# 推送到远程仓库
git push origin main
```

### 2. 触发Vercel部署
```powershell
# 触发部署钩子
Invoke-RestMethod -Uri "https://api.vercel.com/v1/integrations/deploy/prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3/7UrWOe4H6t" -Method Post
```

### 3. 验证部署
等待2-3分钟后访问：
- https://academic-rating.vercel.app/

## 自动化脚本
我已创建了以下脚本供您使用：
- `sync-now.ps1` - PowerShell自动同步脚本
- `sync-now.bat` - 批处理自动同步脚本

## 预防措施
1. 确保每次本地更改后都推送到GitHub
2. 监控Vercel部署状态
3. 设置自动部署钩子

## 检查清单
- [x] 本地服务器运行正常（端口3010）
- [x] 本地代码包含最新品牌更新
- [x] 识别在线版本未同步问题
- [ ] 执行Git推送同步
- [ ] 触发Vercel部署
- [ ] 验证在线版本更新
