# 贡献指南

感谢您对 Researchopia 项目的贡献! 本文档说明如何参与项目开发。

> **📚 技术开发指南**: 架构详解、核心代码、调试技巧请参考 [DEVELOPMENT.md](./DEVELOPMENT.md)  
> **🏗️ 系统架构文档**: 数据流、数据库设计、部署架构请参考 [ARCHITECTURE.md](./ARCHITECTURE.md)  
> **🐛 问题排查指南**: 常见问题和解决方案请参考 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## 目录

1. [快速开始](#快速开始)
2. [代码规范](#代码规范)
3. [Git工作流](#git工作流)
4. [测试要求](#测试要求)
5. [Pull Request流程](#pull-request流程)
6. [常见问题](#常见问题)

---

## 快速开始

### 前置要求

- **Node.js**: v18.0.0 或更高版本
- **npm**: v9.0.0 或更高版本
- **Zotero**: v7 或 v8 Beta (仅插件开发需要)
- **Git**: 版本控制

### 克隆仓库并安装依赖

```bash
# 1. Fork 并克隆仓库
git clone https://github.com/occasional16/researchopia.git
cd researchopia

# 2. 安装网站依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填写 Supabase URL 和密钥

# 4. 启动开发服务器
npm run dev
# 访问 http://localhost:3000
```

### Zotero 插件开发 (可选)

```bash
cd zotero-plugin
npm install

# 配置 Zotero 路径
cp .env.template .env
# 编辑 .env: ZOTERO_PLUGIN_ZOTERO_BIN_PATH=C:\Program Files\Zotero\zotero.exe

# 启动热重载开发模式
npm start
```

**详细指南**: 请参考 [DEVELOPMENT.md - Zotero插件开发](./DEVELOPMENT.md#plugin-architecture)

### 浏览器扩展开发 (可选)

扩展使用原生 JavaScript + Manifest V3,无需构建步骤:

```bash
# 1. Chrome 浏览器 → 扩展程序 → 开发者模式 → 加载已解压的扩展程序
# 2. 选择 extension/ 目录

# 打包(发布时)
cd extension
zip -r researchopia-extension.zip .
```

**详细指南**: 请参考 [DEVELOPMENT.md - 浏览器扩展开发](./DEVELOPMENT.md#manifest-v3)

---

## 代码规范

### TypeScript/JavaScript 规范

**基本原则**:
- 使用 TypeScript 类型注解,避免 `any`
- 优先使用 `const`,其次 `let`,避免 `var`
- 使用 ES6+ 语法(箭头函数、解构、模板字符串)
- 函数单一职责,避免超过 50 行
- 有意义的变量命名,避免缩写

**命名约定**:
```typescript
// 变量和函数: camelCase
const userName = 'John';
function getUserProfile() {}

// 类和接口: PascalCase
class UserManager {}
interface PaperData {}

// 常量: UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;

// 私有方法/字段: _前缀
class Example {
  private _privateMethod() {}
}
```

**代码示例**:
```typescript
// ✅ 推荐
interface User {
  id: string;
  email: string;
  name: string;
}

async function fetchUser(userId: string): Promise<User | null> {
  try {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) {
      throw new Error('User not found');
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
}

// ❌ 不推荐
async function getUser(id: any) {
  const res = await fetch('/api/users/' + id);
  return res.json();
}
```

### React 组件规范

**组件结构**:
```tsx
'use client'; // 客户端组件需要声明

import React from 'react';

export interface ButtonProps {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button 
      className={`btn btn-${variant}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
```

**最佳实践**:
- 组件文件名使用 PascalCase: `UserProfile.tsx`
- 导出命名组件,避免默认导出: `export function UserProfile() {}`
- Props 接口与组件同文件: `export interface UserProfileProps {}`
- 使用 TypeScript 类型检查

### CSS/Tailwind 规范

```tsx
// ✅ 推荐: 使用 Tailwind 工具类
<div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-md">

// ✅ 推荐: 复杂样式提取到 CSS 模块
<div className={styles.complexCard}>

// ❌ 不推荐: 内联样式
<div style={{ display: 'flex', padding: '16px' }}>
```

### API 路由规范

```typescript
// src/app/api/papers/[doi]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { doi: string } }
) {
  try {
    // 1. 验证请求
    const token = request.headers.get('authorization');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 业务逻辑
    const paper = await fetchPaper(params.doi);

    // 3. 返回响应
    return NextResponse.json({ data: paper });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
```

### Zotero 插件规范

```typescript
// 使用内置 logger
import { logger } from '../utils/logger';
logger.log('Info message');
logger.error('Error message:', error);

// 避免直接调用 Zotero API,使用封装的管理器
// ❌ 不推荐
const item = Zotero.Items.get(itemID);

// ✅ 推荐
const paper = await addon.managers.paperRegistry.getPaper(doi);
```

### 代码检查

项目使用 ESLint 进行代码检查:

```bash
# 检查代码
npm run lint:check

# 自动修复
npm run lint:fix

# 格式化代码
npm run format
```

**提交前必须**:
- 代码检查无错误
- 格式化已执行
- 类型检查通过

---

## Git工作流

### 分支策略

```
main (生产分支)
  ↑
develop (开发分支)
  ↑
feature/xxx (功能分支)
bugfix/xxx (修复分支)
hotfix/xxx (紧急修复)
```

- `main`: 生产环境,仅通过 PR 合并
- `develop`: 开发环境,集成最新功能
- `feature/*`: 新功能开发
- `bugfix/*`: Bug修复
- `hotfix/*`: 紧急修复,直接合并到 main

### 分支命名规范

```bash
feature/annotation-sharing    # 新功能
bugfix/fix-pdf-render         # Bug修复
hotfix/critical-security-fix  # 紧急修复
docs/update-readme             # 文档更新
refactor/simplify-api          # 重构代码
```

### 提交消息规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型 (type)**:
- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 文档更新
- `style`: 代码格式(不影响功能)
- `refactor`: 重构(不新增功能也不修复Bug)
- `perf`: 性能优化
- `test`: 添加测试
- `chore`: 构建/工具配置

**示例**:
```bash
feat(plugin): add annotation sharing feature

- Implement real-time sync using Supabase
- Add UI for viewing shared annotations
- Update API proxy routes

Closes #123
```

```bash
fix(api): resolve pagination bug in annotations list

Order query before applying range to ensure correct results.

Fixes #456
```

### 开发流程

1. **创建功能分支**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/my-feature
   ```

2. **开发和提交**:
   ```bash
   # 频繁提交,保持小颗粒度
   git add .
   git commit -m "feat: implement user authentication"
   ```

3. **保持同步**:
   ```bash
   # 定期同步 develop 分支
   git fetch origin
   git rebase origin/develop
   ```

4. **推送到远程**:
   ```bash
   git push origin feature/my-feature
   ```

5. **创建 Pull Request**

---

## 测试要求

### 单元测试

**Next.js 组件测试**:
```typescript
// src/components/__tests__/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with label', () => {
    render(<Button label="Click me" />);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button label="Click me" onClick={handleClick} />);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

**运行测试**:
```bash
# 运行所有测试
npm test

# 监听模式
npm test -- --watch

# 覆盖率报告
npm test -- --coverage
```

### 手动测试清单

**提交前必须测试**:
- [ ] 功能在本地开发环境正常工作
- [ ] 界面在主流浏览器正常显示(Chrome, Firefox, Safari)
- [ ] 响应式设计在移动端正常显示
- [ ] 错误情况有合理的提示信息
- [ ] 网络错误处理正确(如API超时)
- [ ] (插件)在 Zotero 7 和 8 Beta 均可正常运行

---

## Pull Request流程

### 创建PR

1. **确保分支最新**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout feature/my-feature
   git rebase develop
   ```

2. **推送到远程**:
   ```bash
   git push origin feature/my-feature
   ```

3. **访问GitHub仓库页面,点击 "Compare & pull request"**

### PR模板

```markdown
## 描述
简要描述本次PR的目的和改动内容。

## 改动类型
- [ ] 新功能 (feature)
- [ ] 修复Bug (bugfix)
- [ ] 重构 (refactor)
- [ ] 文档更新 (docs)
- [ ] 性能优化 (perf)

## 关联Issue
Closes #123

## 测试清单
- [ ] 本地开发环境测试通过
- [ ] 添加/更新了单元测试
- [ ] 所有测试通过 (`npm test`)
- [ ] 代码符合项目规范 (`npm run lint:check`)
- [ ] 代码已格式化 (`npm run format`)

## 截图(如果适用)
(添加UI变更的截图)

## 其他说明
(任何需要审查者注意的点)
```

### Code Review

**审查重点**:
- ✅ 代码质量和可读性
- ✅ 是否遵循项目规范
- ✅ 是否有充分的测试
- ✅ 是否有性能问题
- ✅ 是否有安全隐患

**反馈方式**:
- 使用GitHub的Review功能
- 具体指出问题所在行
- 提供建设性建议
- 保持友好和专业

### 合并标准

**必须满足**:
- [ ] 至少1位维护者审查通过
- [ ] 所有CI检查通过
- [ ] 解决所有冲突
- [ ] 测试覆盖率不降低

**合并方式**:
- 功能分支 → `develop`: **Squash and merge**
- `develop` → `main`: **Merge commit**
- `hotfix` → `main`: **Fast-forward**

---

## 常见问题

### Q: 如何添加新的API端点?

**A**: 在 `src/app/api/` 下创建新文件夹和 `route.ts`,参考 [DEVELOPMENT.md - API路由设计](./DEVELOPMENT.md#api-routes)

### Q: Zotero插件热重载不工作?

**A**: 参考 [TROUBLESHOOTING.md - 插件问题](./TROUBLESHOOTING.md)

### Q: 代码格式化不一致?

**A**: 运行格式化命令:
```bash
npm run format
```

### Q: 如何添加新的依赖包?

**A**:
```bash
# 生产依赖
npm install package-name

# 开发依赖
npm install -D package-name
```

### Q: 如何回滚错误的提交?

**A**:
```bash
# 撤销最后一次提交(保留更改)
git reset HEAD~1

# 撤销最后一次提交(丢弃更改)
git reset --hard HEAD~1

# 撤销已推送的提交(推荐)
git revert <commit-hash>
git push origin feature-branch
```

### Q: 遇到其他问题怎么办?

**A**: 
1. 查看 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. 搜索 [GitHub Issues](https://github.com/occasional16/researchopia/issues)
3. 创建新 Issue 描述问题

---

## 获取帮助

- **问题反馈**: [GitHub Issues](https://github.com/occasional16/researchopia/issues)
- **功能建议**: [GitHub Discussions](https://github.com/occasional16/researchopia/discussions)
- **技术文档**: [DEVELOPMENT.md](./DEVELOPMENT.md)
- **架构文档**: [ARCHITECTURE.md](./ARCHITECTURE.md)

---

**感谢您的贡献! 🎉**

每一个PR、每一次Issue报告、每一条建议都让Researchopia变得更好。
