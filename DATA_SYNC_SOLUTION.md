# 🔄 数据同步问题解决方案

## 🎯 问题诊断

### 根本原因
1. **本地环境**: Supabase连接失败 → 使用本地Mock数据（localStorage中有测试数据）
2. **线上环境**: Supabase连接失败 → 使用Mock数据（但数据库是空的）

### 数据差异
- **本地**: 有完整的论文、评分、评论数据
- **线上**: Mock数据库为空，没有任何内容

## 🔧 解决方案

### 方案1: 修复Supabase连接（推荐）

#### 步骤1: 重新生成Supabase密钥
1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 找到项目: `obcblvdtqhwrihoddlez`
3. 进入 Settings → API
4. 重新生成 `anon` 和 `service_role` 密钥

#### 步骤2: 更新环境变量
在Vercel和本地同时更新：
```env
NEXT_PUBLIC_SUPABASE_URL=https://obcblvdtqhwrihoddlez.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=新的anon密钥
SUPABASE_SERVICE_ROLE_KEY=新的service_role密钥
```

#### 步骤3: 初始化数据库
在Supabase SQL编辑器中运行：
```sql
-- 运行 database/schema.sql 创建表结构
-- 运行 database/seed.sql 添加示例数据
```

### 方案2: 同步Mock数据到线上（临时）

#### 步骤1: 导出本地数据
```javascript
// 在本地浏览器控制台运行
const mockData = {
  papers: JSON.parse(localStorage.getItem('academic_rating_mock_papers') || '[]'),
  ratings: JSON.parse(localStorage.getItem('academic_rating_mock_ratings') || '[]'),
  comments: JSON.parse(localStorage.getItem('academic_rating_mock_comments') || '[]'),
  users: JSON.parse(localStorage.getItem('academic_rating_mock_users') || '[]')
}
console.log('Mock数据:', JSON.stringify(mockData, null, 2))
```

#### 步骤2: 创建初始化脚本
```javascript
// 在线上环境运行此脚本来初始化数据
function initializeProductionData() {
  const sampleData = {
    // 从本地导出的数据
  }
  
  Object.entries(sampleData).forEach(([key, data]) => {
    localStorage.setItem(`academic_rating_mock_${key}`, JSON.stringify(data))
  })
}
```

### 方案3: 创建演示数据（快速）

## 🚀 立即执行计划

### 选择方案1（推荐）- 修复Supabase

1. **检查Supabase项目状态**
2. **重新生成API密钥**
3. **更新环境变量**
4. **初始化数据库结构**
5. **添加示例数据**

### 临时方案2 - 初始化演示数据

1. **创建演示数据脚本**
2. **在线上执行初始化**
3. **验证数据显示**

## 📋 执行检查清单

- [ ] Supabase项目状态检查
- [ ] API密钥更新
- [ ] 环境变量配置
- [ ] 数据库初始化
- [ ] 示例数据添加
- [ ] 功能验证测试

## 🎯 期望结果

修复后应该实现：
- ✅ 线上和本地数据一致
- ✅ 所有功能正常工作
- ✅ 用户可以看到示例内容
- ✅ 评分和评论功能完整

---

**目标**: 确保线上环境有完整的数据展示！
