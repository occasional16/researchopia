# 访问统计系统

## 🎯 概述

新的访问统计系统解决了主页"总访问量"固定在1000和"今日访问"一直为0的问题，实现了真实的访问量统计和动态更新。

## 🔧 问题分析

### 原有问题
1. **表结构不匹配**：API查询`page_visits`表，但实际创建的是`site_visits`表
2. **总访问量固定**：使用硬编码估算逻辑，导致数值相对固定
3. **今日访问为0**：查询失败导致今日访问量无法正确计算

### 解决方案
1. **统一表结构**：创建正确的`page_visits`表
2. **实时计数器**：使用`realtime_counters`表存储实时数据
3. **智能估算**：改进后备估算逻辑
4. **自动触发器**：数据插入时自动更新统计

## 📊 数据库架构

### 核心表结构

#### 1. page_visits（页面访问记录）
```sql
CREATE TABLE public.page_visits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE NOT NULL,
  visit_count INTEGER DEFAULT 1 NOT NULL,
  ip_address INET,
  user_agent TEXT,
  user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. realtime_counters（实时计数器）
```sql
CREATE TABLE public.realtime_counters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  counter_name TEXT UNIQUE NOT NULL,
  counter_value BIGINT DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 3. visit_statistics（访问统计汇总）
```sql
CREATE TABLE public.visit_statistics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  total_visits INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🚀 API端点

### 1. 访问跟踪 `/api/visits/track`
- **方法**: POST
- **功能**: 记录页面访问，更新实时计数器
- **特性**: 
  - 自动获取IP地址和User-Agent
  - 更新总访问量和今日访问量
  - 支持失败重试机制

### 2. 统计查询 `/api/site/statistics`
- **方法**: GET
- **功能**: 获取网站统计数据
- **数据源优先级**:
  1. 实时计数器（realtime_counters）
  2. 统计汇总表（visit_statistics）
  3. 智能估算（后备方案）

### 3. 重置今日计数 `/api/visits/reset-today`
- **方法**: POST
- **功能**: 重置今日访问计数器（定时任务用）
- **安全**: 需要Bearer token验证

### 4. 管理接口 `/api/admin/visits`
- **方法**: GET/POST
- **功能**: 管理员查看和管理访问统计
- **操作**: 查看详情、设置计数器值、重置计数器

## 🔄 工作流程

### 访问记录流程
1. 用户访问页面
2. 前端调用`/api/visits/track`
3. 插入访问记录到`page_visits`表
4. 触发器自动更新`visit_statistics`
5. 更新`realtime_counters`实时计数器

### 统计查询流程
1. 前端请求`/api/site/statistics`
2. 优先查询`realtime_counters`
3. 如无数据，查询`visit_statistics`
4. 最后使用智能估算作为后备
5. 返回统计数据给前端

## 🛠️ 部署步骤

### 1. 执行数据库脚本
```bash
# 在Supabase SQL编辑器中执行
psql -f database/create-visits-table.sql
```

### 2. 设置环境变量
```env
# .env.local
CRON_SECRET=your-secret-token-for-cron-jobs
```

### 3. 配置定时任务（可选）
```bash
# 每天凌晨重置今日访问计数器
0 0 * * * curl -X POST -H "Authorization: Bearer your-secret-token" https://your-domain.com/api/visits/reset-today
```

## 📈 特性优势

### 1. 真实数据
- ✅ 基于实际访问记录
- ✅ IP地址去重机制
- ✅ 用户代理信息记录

### 2. 高性能
- ✅ 实时计数器快速查询
- ✅ 数据库索引优化
- ✅ 缓存机制支持

### 3. 可扩展
- ✅ 支持多种统计维度
- ✅ 管理员界面管理
- ✅ API接口完整

### 4. 容错性
- ✅ 多层后备方案
- ✅ 智能估算算法
- ✅ 错误处理机制

## 🔍 调试信息

### 开发环境
- 主页底部显示调试面板
- 控制台输出访问统计日志
- 详细的错误信息提示

### 生产环境
- 静默记录访问数据
- 错误日志记录
- 性能监控支持

## 📝 维护说明

### 日常维护
1. **监控计数器**：定期检查实时计数器是否正常更新
2. **清理数据**：定期清理过期的访问记录
3. **性能优化**：监控查询性能，必要时添加索引

### 故障排除
1. **访问量不更新**：检查`/api/visits/track`是否正常工作
2. **今日访问为0**：检查`realtime_counters`表中的`today_visits`记录
3. **统计数据异常**：查看数据库日志，检查触发器是否正常执行

## 🎉 效果展示

修复后的效果：
- ✅ **总访问量**：基于真实数据，动态增长
- ✅ **今日访问**：实时更新，每次访问+1
- ✅ **数据一致性**：多个数据源保证准确性
- ✅ **管理便捷**：管理员可以查看和管理统计数据

这个新系统彻底解决了访问统计的问题，提供了真实、准确、实时的访问量数据！
