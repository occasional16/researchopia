# 研学港 Researchopia - Deploy Hook 快速参考

## 🪝 Deploy Hook URL
✅ 已配置并测试成功：
```
HOOK_URL: https://api.vercel.com/v1/integrations/deploy/prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3/7UrWOe4H6t
状态: 已触发部署 (Job ID: 44iAHPrFNHwyJXQhosgb)
时间: 2025-09-11
```

## 📋 快速部署命令
```bash
# Windows (PowerShell)
Invoke-RestMethod -Uri "https://api.vercel.com/v1/integrations/deploy/prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3/7UrWOe4H6t" -Method Post

# Windows (curl)
curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3/7UrWOe4H6t"

# 或直接在浏览器中访问Hook URL
```

## 🔧 完整设置流程
1. Vercel Dashboard > academic-rating > Settings > Git
2. Deploy Hooks > Create Hook
3. Name: `researchopia-main-deploy`
4. Branch: `main` 
5. Create Hook
6. 复制URL并保存到上方
7. 测试部署

## ✅ 验证部署成功
部署完成后检查：
- 页面标题：研学港 | Researchopia - 研学并进，智慧共享
- Logo文字：Researchopia
- 功能正常：评分、搜索等功能工作正常

## 📞 故障排除
如果部署失败：
1. 检查Hook URL是否完整
2. 确认Branch设置为main
3. 查看Vercel Dashboard的部署日志
4. 确认GitHub仓库代码已推送
