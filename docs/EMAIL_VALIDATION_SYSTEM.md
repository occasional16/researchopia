# 邮箱验证体系文档

## 概述

本文档描述了Researchopia项目中实施的完整邮箱验证体系，旨在解决Supabase邮件退回率过高的问题，建立可靠的用户注册和邮件发送系统。

## 系统架构

### 三层验证体系

#### 第一层：前端预验证 + CAPTCHA
- **教育邮箱域名验证**：验证邮箱是否属于教育机构
- **Google reCAPTCHA v3**：防止机器人注册
- **实时邮箱格式验证**：基础格式检查和建议

#### 第二层：邮箱真实性验证API
- **第三方邮箱验证服务**：使用Abstract API等服务验证邮箱真实性
- **可投递性检查**：验证邮箱是否能接收邮件
- **一次性邮箱检测**：阻止临时邮箱注册

#### 第三层：自定义SMTP + 监控
- **自定义SMTP服务**：使用SendGrid等专业邮件服务
- **邮件发送监控**：实时监控发送状态和退回率
- **智能重试机制**：自动重试失败的邮件发送

## 核心组件

### 1. 前端组件

#### ReCaptchaProvider (`src/components/auth/ReCaptchaProvider.tsx`)
- 提供Google reCAPTCHA v3集成
- 自动加载reCAPTCHA脚本
- 支持多种验证场景

#### SignUpForm (`src/components/auth/SignUpForm.tsx`)
- 集成三层验证体系
- 实时邮箱验证反馈
- 安全验证状态显示

### 2. 后端服务

#### 邮箱验证服务 (`src/lib/emailValidationServices.ts`)
- 抽象化的邮箱验证接口
- 支持多种验证服务提供商
- 自动降级和错误处理

#### 自定义邮件服务 (`src/lib/emailService.ts`)
- SMTP邮件发送
- 邮件模板管理
- 发送状态监控

#### 监控系统 (`src/lib/emailMonitor.ts`)
- 邮件发送日志记录
- 退回率监控和告警
- 黑名单管理

### 3. API端点

#### 验证相关
- `POST /api/auth/verify-recaptcha` - reCAPTCHA验证
- `POST /api/auth/validate-email` - 邮箱真实性验证
- `POST /api/auth/send-verification` - 发送验证邮件

#### 监控相关
- `GET /api/admin/email-stats` - 邮件发送统计
- `GET /api/admin/email-validation-stats` - 邮箱验证统计
- `GET /api/health-check` - 系统健康检查

#### 测试相关
- `GET/POST /api/test/email-validation` - 邮箱验证测试工具

## 配置说明

### 环境变量

```bash
# Google reCAPTCHA v3
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_site_key
RECAPTCHA_SECRET_KEY=your_secret_key

# 邮箱验证API
EMAIL_VALIDATION_API_KEY=your_api_key

# 自定义SMTP
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_api_key
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Your App Name
```

### 推荐的第三方服务

#### 邮箱验证服务
1. **Abstract API** (推荐)
   - 网址：https://www.abstractapi.com/email-validation-api
   - 特点：准确率高，支持批量验证
   - 价格：免费额度 + 按需付费

2. **EmailJS**
   - 网址：https://www.emailjs.com/
   - 特点：简单易用，实时验证
   - 价格：免费额度较少

#### SMTP服务
1. **SendGrid** (推荐)
   - 网址：https://sendgrid.com/
   - 特点：高可靠性，详细统计
   - 价格：免费100封/天

2. **AWS SES**
   - 网址：https://aws.amazon.com/ses/
   - 特点：成本低，与AWS生态集成
   - 价格：$0.10/1000封邮件

## 使用指南

### 开发环境设置

1. **安装依赖**
```bash
npm install react-google-recaptcha-v3 nodemailer @types/nodemailer axios
```

2. **配置环境变量**
```bash
cp .env.example .env.local
# 编辑 .env.local 填入真实的API密钥
```

3. **测试配置**
```bash
curl http://localhost:3000/api/test/email-validation
```

### 生产环境部署

1. **申请API密钥**
   - Google reCAPTCHA: https://www.google.com/recaptcha/admin
   - Abstract API: https://www.abstractapi.com/
   - SendGrid: https://sendgrid.com/

2. **配置环境变量**
   - 在Vercel/Netlify等平台配置环境变量
   - 确保所有密钥都已正确设置

3. **监控设置**
   - 设置邮件退回率告警
   - 定期检查系统健康状态

## 监控和维护

### 关键指标

1. **邮箱验证成功率**：应保持在95%以上
2. **邮件发送成功率**：应保持在98%以上
3. **邮件退回率**：应控制在5%以下
4. **reCAPTCHA通过率**：应保持在90%以上

### 告警机制

- 退回率超过5%时自动告警
- 验证服务不可用时告警
- SMTP服务异常时告警

### 维护任务

- 每周检查邮件发送统计
- 每月更新黑名单
- 定期测试备用服务

## 故障排除

### 常见问题

1. **reCAPTCHA验证失败**
   - 检查站点密钥配置
   - 确认域名白名单设置

2. **邮箱验证API超时**
   - 检查API密钥有效性
   - 确认网络连接正常

3. **SMTP发送失败**
   - 验证SMTP配置
   - 检查发送频率限制

### 调试工具

- 使用 `/api/test/email-validation` 测试各组件
- 查看 `/api/health-check` 系统状态
- 检查浏览器控制台错误信息

## 性能优化

### 缓存策略
- 邮箱验证结果缓存24小时
- reCAPTCHA token缓存5分钟
- 黑名单缓存1小时

### 限流机制
- 每IP每小时最多10次邮箱验证
- 每用户每分钟最多1次注册尝试
- SMTP发送限制：每秒最多10封

## 安全考虑

### 数据保护
- 邮箱地址加密存储
- 验证日志定期清理
- API密钥安全管理

### 防滥用措施
- IP限流和黑名单
- 异常行为检测
- 自动封禁机制

## 未来改进

### 计划功能
- 机器学习反垃圾邮件
- 多语言邮件模板
- 高级统计分析
- Webhook集成

### 技术升级
- 支持更多验证服务
- 实现邮件队列系统
- 添加A/B测试功能
