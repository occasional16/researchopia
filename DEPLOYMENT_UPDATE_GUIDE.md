# 研学港(Researchopia) 环境变量更新指南

## 需要更新的环境变量

### 在 Vercel 控制台中更新以下环境变量:

1. **NEXT_PUBLIC_APP_URL**
   - 旧值: `https://academic-rating.vercel.app`
   - 新值: `https://researchopia.vercel.app`

2. **NEXT_PUBLIC_SITE_URL** (如果存在)
   - 旧值: `https://academic-rating.vercel.app`
   - 新值: `https://researchopia.vercel.app`

## Vercel 项目配置更新步骤

### 1. 访问 Vercel 控制台
https://vercel.com/dashboard

### 2. 找到项目并更新设置
- 项目: `academic-rating` → 重命名为 `researchopia`
- Settings → General → Project Name
- Settings → Domains → 更新自定义域名 (如果有)

### 3. 重新连接 Git 仓库
- Settings → Git → 断开连接旧路径
- 重新连接到新的仓库路径: `D:\AI\Researchopia`

### 4. 更新环境变量
- Settings → Environment Variables
- 更新所有包含旧URL的环境变量

### 5. 触发重新部署
- Deployments → 点击 "Redeploy"
- 或推送新的代码提交自动触发部署

## Supabase 配置检查

### 1. 检查 Authentication 设置
- 访问 Supabase 控制台
- Authentication → Settings → Site URL
- 确保包含新的域名: `https://researchopia.vercel.app`

### 2. 更新 CORS 设置 (如果需要)
- 在允许的域名列表中添加新域名
- 移除旧域名 (部署成功后)

## GitHub 仓库更新

### 1. 更新仓库描述
- 访问 GitHub 仓库设置
- 更新描述: "研学港 - 新一代学术评价与研学社区平台"

### 2. 更新 Topics
```
academic, research, evaluation, community, nextjs, supabase, typescript
```

### 3. 更新 README 和文档链接
- 确保所有链接指向新的域名
- 更新项目名称和描述

## 验证清单

部署完成后请验证:

- [ ] 新域名可以正常访问
- [ ] 用户注册/登录功能正常
- [ ] 论文搜索和评价功能正常
- [ ] API 接口响应正常
- [ ] 浏览器扩展连接正常
- [ ] 所有外部链接正确

## 回滚计划

如果出现问题，可以快速回滚:

1. 在 Vercel 中恢复旧的项目名称
2. 恢复环境变量设置
3. 重新连接到备份文件夹路径
4. 从备份恢复文件: `D:\AI\Rating_BACKUP_*`

---

*请在执行每个步骤后进行验证，确保系统正常运行*