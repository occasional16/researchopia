# Vercel 环境变量配置清单

## ✅ 必需的环境变量 (Required)

### 1. Supabase 配置
```
NEXT_PUBLIC_SUPABASE_URL=https://obcblvdtqhwrihoddlez.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ5ODIzNSwiZXhwIjoyMDczMDc0MjM1fQ.ywlXk4IOZ-eyGhJXmVve-zSNHo5fUnOK0fwJf32EjCE
```

⚠️ **安全提示**: `SUPABASE_SERVICE_ROLE_KEY` 具有完全管理权限,仅用于服务器端,永远不要暴露到客户端!

### 2. reCAPTCHA 配置
```
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6Lcco9MrAAAAAKtxnQLg6qoy9Ndj0Jb_a7j1bk6E
RECAPTCHA_SECRET_KEY=6Lcco9MrAAAAAE_RcXECKqmAg2dj2SWza7_aGWp1
```

⚠️ **域名配置**: 请在 [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin) 中添加:
- `www.researchopia.com`
- `researchopia.vercel.app` (如果需要)
- `localhost` (开发环境)

---

## 🔧 在 Vercel 添加环境变量的步骤

1. **访问 Vercel Dashboard**: https://vercel.com/
2. **选择项目**: researchopia
3. **进入设置**: 点击顶部 **Settings** 标签
4. **环境变量**: 左侧菜单选择 **Environment Variables**
5. **添加变量**: 
   - 点击 **Add New** 按钮
   - 输入 **Name** 和 **Value**
   - ✅ 勾选 **Production**, **Preview**, **Development**
   - 点击 **Save**
6. **重复**: 为上述所有变量重复步骤 5
7. **重新部署**: 
   - 点击 **Deployments** 标签
   - 找到最新部署,点击 **⋯** → **Redeploy**

---

## ✅ 当前环境变量检查清单

| 变量名 | 本地(.env.local) | Vercel | 说明 |
|--------|-----------------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ 已配置 | ❓ 请检查 | Supabase项目URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ 已配置 | ❓ 请检查 | Supabase公开匿名密钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ 已配置 | ❌ **缺失** | Supabase管理员密钥 |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | ✅ 已配置 | ✅ 已添加 | reCAPTCHA站点密钥 |
| `RECAPTCHA_SECRET_KEY` | ✅ 已配置 | ✅ 已添加 | reCAPTCHA服务器密钥 |

---

## 📝 可选的环境变量 (Optional)

### 邮箱验证 API
```
EMAIL_VALIDATION_API_KEY=your_api_key_here
```

### Altmetric API
```
ALTMETRIC_API_KEY=your_altmetric_key
ALTMETRIC_CACHE_MINUTES=60
```

### SMTP 配置 (SendGrid)
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
SMTP_FROM_EMAIL=noreply@researchopia.com
SMTP_FROM_NAME=Researchopia
```

---

## 🐛 常见问题排查

### 问题 1: "服务器配置错误"
**原因**: 缺少 `SUPABASE_SERVICE_ROLE_KEY`  
**解决**: 在 Vercel 添加该环境变量

### 问题 2: "reCAPTCHA验证失败"
**原因**: reCAPTCHA密钥未配置域名白名单  
**解决**: 在 Google reCAPTCHA Admin 添加 `www.researchopia.com`

### 问题 3: 本地可以,生产环境不行
**原因**: Vercel不会读取 `.env.local` 文件  
**解决**: 必须在 Vercel Dashboard 手动配置所有环境变量

---

## 🚀 快速修复命令

添加完环境变量后,在本地运行以下命令触发重新部署:

```bash
git commit --allow-empty -m "trigger: 重新部署以应用环境变量"
git push origin main
```

或者直接在 Vercel Dashboard 点击 **Redeploy** 按钮。
