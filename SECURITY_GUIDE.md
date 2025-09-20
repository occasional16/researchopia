# 研学港安全指南

## 🔒 安全概述

研学港项目采用了多层安全防护机制，确保用户数据和系统安全。

## 🛡️ 安全特性

### 1. 数据库安全

#### 行级安全（RLS）
- 所有表都启用了行级安全策略
- 用户只能访问和修改自己的数据
- 支持细粒度的权限控制

#### 数据加密
- 敏感数据在传输和存储时都进行加密
- 使用Supabase的内置加密机制
- 支持客户端加密（可选）

#### 访问控制
- 基于角色的访问控制（RBAC）
- 细粒度的权限管理
- 支持公开、共享、私有三级可见性

### 2. API安全

#### 认证授权
- 基于JWT的身份认证
- 支持多种认证方式（邮箱、社交登录）
- 自动token刷新机制

#### 请求验证
- 输入数据验证和清理
- SQL注入防护
- XSS攻击防护
- CSRF保护

#### 速率限制
- API请求频率限制
- 防止暴力攻击
- 自动封禁机制

### 3. 实时通信安全

#### WebSocket安全
- 连接认证和授权
- 消息验证和过滤
- 防止恶意消息攻击

#### 数据同步安全
- 端到端加密（可选）
- 数据完整性验证
- 冲突解决机制

## 🔧 安全配置

### 环境变量

```env
# 数据库安全
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# JWT配置
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# 加密配置
ENCRYPTION_KEY=your_encryption_key

# 安全配置
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 数据库安全设置

```sql
-- 启用所有表的RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
-- ... 其他表

-- 创建安全策略
CREATE POLICY "annotations_select_policy" ON public.annotations
  FOR SELECT USING (
    user_id = auth.uid() OR 
    visibility = 'public' OR 
    (visibility = 'shared' AND id IN (
      SELECT annotation_id FROM public.annotation_shares 
      WHERE shared_with_user_id = auth.uid()
    ))
  );
```

## 🚨 安全检查

### 自动安全检查

```bash
# 运行安全检查
npm run db:security-fix

# 查看安全状态
psql -d your_database -c "SELECT * FROM public.security_monitor;"
```

### 手动安全检查

1. **数据库安全**
   ```sql
   -- 检查RLS状态
   SELECT * FROM public.audit_security_status();
   
   -- 查看安全报告
   SELECT public.security_check_report();
   ```

2. **API安全测试**
   ```bash
   # 测试认证
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/v1/annotations
   
   # 测试权限
   curl -X POST http://localhost:3000/api/v1/annotations -d '{"test": "data"}'
   ```

3. **WebSocket安全测试**
   ```javascript
   // 测试未认证连接
   const ws = new WebSocket('ws://localhost:3001/collaboration');
   
   // 测试认证连接
   const ws = new WebSocket('ws://localhost:3001/collaboration?documentId=123&userId=456');
   ```

## 🔍 安全监控

### 日志监控

1. **API访问日志**
   - 记录所有API请求
   - 监控异常访问模式
   - 自动告警机制

2. **数据库操作日志**
   - 记录敏感数据操作
   - 监控权限违规
   - 审计跟踪

3. **WebSocket连接日志**
   - 记录连接和断开
   - 监控消息频率
   - 检测异常行为

### 性能监控

1. **响应时间监控**
   - API响应时间
   - 数据库查询时间
   - WebSocket延迟

2. **资源使用监控**
   - CPU和内存使用
   - 数据库连接数
   - 网络带宽使用

## 🛠️ 安全最佳实践

### 开发阶段

1. **代码安全**
   - 使用TypeScript进行类型检查
   - 实施代码审查流程
   - 使用ESLint安全规则

2. **依赖管理**
   - 定期更新依赖包
   - 扫描安全漏洞
   - 使用可信的包源

3. **测试安全**
   - 编写安全测试用例
   - 进行渗透测试
   - 模拟攻击场景

### 部署阶段

1. **环境隔离**
   - 开发、测试、生产环境分离
   - 使用不同的数据库实例
   - 限制网络访问

2. **访问控制**
   - 最小权限原则
   - 定期审查权限
   - 使用强密码策略

3. **备份和恢复**
   - 定期数据备份
   - 测试恢复流程
   - 加密备份数据

### 运维阶段

1. **监控和告警**
   - 实时安全监控
   - 异常行为告警
   - 定期安全报告

2. **更新和维护**
   - 及时应用安全补丁
   - 定期安全评估
   - 持续改进安全措施

## 🚨 安全事件响应

### 事件分类

1. **低风险**
   - 异常访问模式
   - 性能异常
   - 配置错误

2. **中风险**
   - 权限违规
   - 数据泄露风险
   - 系统漏洞

3. **高风险**
   - 数据泄露
   - 系统入侵
   - 恶意攻击

### 响应流程

1. **检测和确认**
   - 自动检测异常
   - 人工确认事件
   - 评估影响范围

2. **隔离和修复**
   - 隔离受影响系统
   - 修复安全漏洞
   - 恢复服务

3. **调查和报告**
   - 调查事件原因
   - 记录处理过程
   - 生成安全报告

## 📞 安全联系

- **安全漏洞报告**: security@researchopia.com
- **紧急安全事件**: +86-xxx-xxxx-xxxx
- **安全文档**: 查看 `docs/security/` 目录

## 🔄 安全更新

### 定期更新

- **每月**: 依赖包安全更新
- **每季度**: 安全策略审查
- **每年**: 全面安全评估

### 紧急更新

- **关键漏洞**: 24小时内修复
- **重要漏洞**: 72小时内修复
- **一般漏洞**: 7天内修复

## 📋 安全检查清单

### 部署前检查

- [ ] 所有环境变量已正确配置
- [ ] 数据库RLS策略已启用
- [ ] API认证机制已测试
- [ ] WebSocket安全已配置
- [ ] 日志监控已启用
- [ ] 备份机制已设置

### 运行中检查

- [ ] 安全监控正常运行
- [ ] 日志记录完整
- [ ] 性能指标正常
- [ ] 用户权限正确
- [ ] 数据同步正常

### 定期检查

- [ ] 安全日志审查
- [ ] 权限审计
- [ ] 漏洞扫描
- [ ] 性能评估
- [ ] 备份验证

---

**注意**: 安全是一个持续的过程，需要定期审查和更新。如有任何安全问题，请立即联系安全团队。
