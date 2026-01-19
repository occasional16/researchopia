# Supabase Team Collaboration Guide

> AI + MCP 开发模式下的数据库版本控制与团队协作最佳实践

## 核心问题

直接通过 MCP 操作数据库的风险：
- ❌ 无版本控制 - 变更不可追溯
- ❌ 团队无法同步 - 其他人不知道你改了什么
- ❌ 无法回滚 - 出问题难以恢复
- ❌ 生产部署困难 - 手动操作易出错

## 解决方案：Migration 文件 + Git

```
AI 生成 SQL → 保存到 migration 文件 → Git 提交 → 团队同步 → 应用到各环境
```

## 目录结构

```
supabase/
├── migrations/           # 数据库迁移文件（按时间顺序）
│   ├── 20260107000000_create_papers_table.sql
│   ├── 20260107000001_add_ratings_table.sql
│   └── 20260107000002_add_webpages_feature.sql
├── seed.sql              # 初始数据（可选）
└── config.toml           # Supabase 配置
```

## 工作流程

### 1️⃣ AI 开发时：生成 + 保存

**Prompt 示例**：
```
请为网页评价功能创建数据库表，并将 SQL 保存到 
supabase/migrations/20260107120000_create_webpages_tables.sql
```

AI 会：
1. 通过 MCP 执行 SQL（开发环境验证）
2. 同时保存到 migration 文件（版本控制）

### 2️⃣ 提交到 Git

```bash
git add supabase/migrations/
git commit -m "feat(db): add webpages feature tables"
git push
```

### 3️⃣ 团队成员同步

```bash
git pull
# 应用新的 migration（通过 Supabase CLI 或 AI）
```

**Prompt 示例**：
```
请检查 supabase/migrations/ 目录，应用所有未执行的迁移到我的开发数据库
```

### 4️⃣ 生产环境部署

```bash
# 方法 A：Supabase CLI（推荐）
supabase db push

# 方法 B：通过 AI + MCP
# "请将 supabase/migrations/ 中的 SQL 应用到生产数据库"
```

## Migration 文件命名规范

```
{timestamp}_{description}.sql

示例：
20260107120000_create_webpages_tables.sql
20260107130000_add_webpage_ratings_index.sql
20260107140000_fix_rls_policy.sql
```

**时间戳格式**：`YYYYMMDDHHmmss`（保证顺序）

## Migration 文件模板

```sql
-- Migration: create_webpages_tables
-- Description: Add tables for webpage rating feature
-- Author: [your-name]
-- Date: 2026-01-07

-- ============================================
-- UP Migration (Apply)
-- ============================================

CREATE TABLE IF NOT EXISTS webpages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    url_hash TEXT NOT NULL,
    -- ... more fields
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_webpages_url_hash ON webpages(url_hash);

-- Add RLS policies
ALTER TABLE webpages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webpages_select_policy" ON webpages
    FOR SELECT USING (true);

-- ============================================
-- DOWN Migration (Rollback) - 注释保留，需要时取消注释
-- ============================================
-- DROP POLICY IF EXISTS "webpages_select_policy" ON webpages;
-- DROP TABLE IF EXISTS webpages;
```

## AI Prompt 最佳实践

### ✅ 推荐的 Prompt

```
1. 为 [功能] 设计数据库表结构
2. 生成完整的 migration SQL（包含表、索引、RLS）
3. 保存到 supabase/migrations/[timestamp]_[name].sql
4. 在开发数据库执行验证
```

### ❌ 避免的做法

```
"直接在数据库创建一个表"  ← 没有保存 migration
"帮我改一下这个表结构"    ← 没有生成变更记录
```

## 团队协作检查清单

| 阶段 | 检查项 |
|------|--------|
| **开发前** | ☐ `git pull` 同步最新代码和 migrations |
| **开发中** | ☐ 所有 DDL 操作保存到 migration 文件 |
| **提交前** | ☐ migration 文件包含完整注释 |
| **PR 审核** | ☐ 检查 SQL 是否安全、是否有回滚方案 |
| **部署后** | ☐ 验证 migration 在生产环境执行成功 |

## 冲突处理

### 场景：两人同时修改数据库

```
成员 A: 20260107120000_add_feature_a.sql
成员 B: 20260107120000_add_feature_b.sql  ← 时间戳冲突！
```

**解决方法**：
1. PR 审核时发现冲突
2. 后提交者修改时间戳（+1秒）
3. 确保 migration 顺序正确

## 环境管理

| 环境 | 用途 | Migration 策略 |
|------|------|----------------|
| **本地开发** | 个人测试 | 可重置，随意操作 |
| **开发分支** | Supabase Branch | 每个 PR 独立环境 |
| **Staging** | 预发布测试 | 只应用 main 分支 migrations |
| **Production** | 生产环境 | 严格按 migration 顺序执行 |

## 快速命令参考

```bash
# 创建新 migration 文件
supabase migration new <name>

# 查看 migration 状态
supabase migration list

# 应用 migrations（本地）
supabase db reset

# 推送到远程（生产）
supabase db push

# 从远程拉取 schema（反向工程）
supabase db pull
```

## 现有项目迁移

如果项目已有数据库但没有 migration 文件：

```bash
# 1. 导出当前 schema
supabase db pull

# 2. 生成基础 migration
supabase migration new init_schema

# 3. 将导出的 SQL 放入 migration 文件

# 4. 提交到 Git
git add supabase/
git commit -m "chore(db): add initial migration files"
```

---

**维护者**: Researchopia Team  
**最后更新**: 2026-01-07
