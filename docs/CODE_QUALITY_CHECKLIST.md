# 代码质量检查清单

**用途**: AI生成代码后自检 + 开发者代码审查  
**更新日期**: 2025-11-13

---

## 📏 文件大小检查

**自动化脚本**: `npm run check:size`

### 限制标准
```typescript
const FILE_SIZE_LIMITS = {
  WARNING: 300,  // 触发警告
  ERROR: 600,    // 禁止提交
  FUNCTION: 50,  // 单函数最大行数
};
```

### 检查清单
- [ ] 文件 < 300行 (警告) / < 600行 (错误)
- [ ] 函数 < 50行
- [ ] 类 < 300行
- [ ] 单一职责 (一个文件只做一件事)

**如果超标**:
```
方案1: 提取工具函数到 utils/
方案2: 提取UI组件到 components/
方案3: 拆分为协调器 + 多个子模块
```

---

## 🔤 命名规范检查

### TypeScript/JavaScript
```typescript
// ✅ 正确
const userName = 'John';              // 变量: camelCase
function getUserProfile() {}          // 函数: camelCase
class UserManager {}                  // 类: PascalCase
interface PaperData {}                // 接口: PascalCase
const MAX_RETRY_COUNT = 3;            // 常量: UPPER_SNAKE_CASE
private _privateMethod() {}           // 私有: _前缀

// ❌ 错误
const user_name = 'John';             // 不要用snake_case
function get_user() {}                // 不要用snake_case
const maxretrycount = 3;              // 常量要大写
let a, b, temp;                       // 不要用无意义的名字
```

### 检查清单
- [ ] 变量/函数: camelCase
- [ ] 类/接口: PascalCase
- [ ] 常量: UPPER_SNAKE_CASE
- [ ] 有意义的命名 (避免a、b、temp)
- [ ] 布尔值以 is/has/should 开头
- [ ] 私有方法/字段使用 _ 前缀

---

## 🧩 代码复用检查

**自动化脚本**: `npm run check:duplicates`

### 检查清单
- [ ] 无重复代码 (>20行)
- [ ] 已搜索现有工具/组件
- [ ] 新工具函数放在 utils/
- [ ] UI组件放在 components/
- [ ] 类型定义放在 types/

### 复用优先级
```
1. 搜索项目现有代码
   - zotero-plugin/src/modules/ui/utils/
   - src/lib/
   - src/utils/

2. 提取通用逻辑
   - >20行重复 → 提取函数
   - >50行重复 → 提取模块
   - >100行重复 → 创建共享库

3. 创建新工具
   - 纯函数优先
   - 单元测试覆盖
   - JSDoc文档注释
```

---

## 📝 类型安全检查

**自动化脚本**: `npm run check:types`

### TypeScript检查清单
- [ ] 无 `any` 类型 (除特殊情况需注释说明)
- [ ] 接口定义完整
- [ ] 导入导出类型清晰
- [ ] 函数参数/返回值有类型
- [ ] 避免类型断言 (as)

### 特殊情况说明
```typescript
// ✅ 允许: 第三方库类型缺失
const zotero = Zotero as any; // @ts-expect-error Zotero API未提供类型定义

// ✅ 允许: 动态对象
const config: Record<string, any> = {}; // 配置对象结构未知

// ❌ 禁止: 偷懒不写类型
function doSomething(data: any) {} // 应该定义具体类型
```

---

## 📖 文档注释检查

### JSDoc规范
```typescript
/**
 * 创建共读会话
 * @param paperDoi - 论文DOI标识符
 * @param sessionType - 会话类型 (public/private)
 * @returns Promise<会话对象>
 * @throws {APIError} 当API调用失败时
 * @example
 * ```typescript
 * const session = await createSession('10.1234/example', 'public');
 * ```
 */
async function createSession(
  paperDoi: string,
  sessionType: 'public' | 'private'
): Promise<Session> {
  // 实现
}
```

### 检查清单
- [ ] 复杂函数有JSDoc注释
- [ ] 公共API有完整文档
- [ ] 接口/类型有说明
- [ ] 关键逻辑有行内注释
- [ ] 临时方案有TODO/FIXME注释

### 注释模板
```typescript
// TODO: [功能描述] - [负责人] - [截止日期]
// TODO: 实现关注功能需要后端支持 - @occasional16 - 2025-12-01

// FIXME: [问题描述] - [影响范围]
// FIXME: 分页逻辑在data为null时报错 - 影响标注列表页

// HACK: [临时方案说明] - [根本原因]
// HACK: 使用setTimeout绕过Zotero API异步问题 - 等待官方修复

// NOTE: [重要提示]
// NOTE: 必须在调用前初始化SupabaseManager
```

---

## 🧪 可测试性检查

### 检查清单
- [ ] 纯函数优先 (无副作用)
- [ ] 依赖注入 (避免硬编码)
- [ ] 关键逻辑可单元测试
- [ ] 避免全局状态
- [ ] Mock友好 (可注入依赖)

### 可测试 vs 不可测试
```typescript
// ❌ 不可测试: 硬编码依赖
class UserManager {
  async getUser(id: string) {
    const response = await fetch(`https://api.example.com/users/${id}`);
    return response.json();
  }
}

// ✅ 可测试: 依赖注入
class UserManager {
  constructor(private apiClient: APIClient) {}
  
  async getUser(id: string) {
    return this.apiClient.get(`/users/${id}`);
  }
}

// 测试时可注入Mock
const mockClient = { get: jest.fn() };
const manager = new UserManager(mockClient);
```

---

## ✅ 代码风格检查

**自动化脚本**: 
- `npm run lint:check`
- `npm run format`

### ESLint规则
- [ ] 无未使用的变量/导入
- [ ] 无console.log (改用logger)
- [ ] 使用 === 而非 ==
- [ ] 避免嵌套三元运算符
- [ ] 避免过长的参数列表 (>5个)

### Prettier格式化
- [ ] 缩进: 2空格
- [ ] 单引号
- [ ] 行尾无分号 (TypeScript)
- [ ] 行尾有分号 (JavaScript)
- [ ] 最大行长: 100字符

---

## 🚀 性能检查

### Zotero插件
- [ ] 避免主线程阻塞 (使用setTimeout)
- [ ] 批量操作合并请求
- [ ] 防抖/节流高频事件
- [ ] 懒加载非关键模块

### Next.js网站
- [ ] 使用Server Components (默认)
- [ ] 动态导入大型组件
- [ ] 图片使用next/image
- [ ] API响应启用缓存

### 浏览器扩展
- [ ] 内容脚本轻量化
- [ ] 避免频繁DOM操作
- [ ] 使用chrome.storage缓存

---

## 🔒 安全检查

### 检查清单
- [ ] 无硬编码密钥/Token
- [ ] 使用环境变量 (.env)
- [ ] API调用有认证校验
- [ ] 输入有验证/转义
- [ ] 敏感信息不记录日志

### 环境变量规范
```typescript
// ❌ 错误: 硬编码密钥
const apiKey = 'sk_1234567890abcdef';

// ✅ 正确: 使用环境变量
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ✅ 正确: 运行时检查
if (!apiKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}
```

---

## 📊 提交前总检查

### 运行命令
```bash
# 一键检查所有项
npm run check:all

# 单项检查
npm run check:size        # 文件大小
npm run check:types       # 类型检查
npm run check:duplicates  # 代码重复
npm run lint:check        # 代码风格
npm test                  # 单元测试
```

### 最终清单
- [ ] 所有自动化检查通过
- [ ] 手动审查关键逻辑
- [ ] 功能测试通过
- [ ] 文档已更新
- [ ] Git提交信息清晰

---

## 🔄 重构建议

### 何时重构 (立即执行)
```
🔴 P0 - 紧急:
- 文件 > 600行
- 函数 > 100行
- 圈复杂度 > 15

🟡 P1 - 重要:
- 文件 > 300行
- 重复代码 > 20行
- 嵌套深度 > 4层

🟢 P2 - 改进:
- 命名不清晰
- 缺少注释
- 性能可优化
```

### 重构流程
```
1. 识别问题 → 运行 check:all
2. 制定计划 → 设计模块结构
3. 增量重构 → 逐步拆分
4. 运行测试 → 确保功能不变
5. 更新文档 → 同步说明文档
```

---

## 📚 参考资源

- [项目开发指南](../.github/copilot-instructions.md)
- [代码质量评估](./docs-dev/7.1-PROJECT_CODE_QUALITY_ASSESSMENT.md)
- [贡献指南](./CONTRIBUTING.md)
- [开发指南](./DEVELOPMENT.md)

---

**维护者**: Researchopia Team  
**最后更新**: 2025-11-13
