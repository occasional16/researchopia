# 交互式API文档实施指南

**目标**: 为Researchopia项目添加Swagger UI交互式API文档  
**适用人群**: AI辅助开发、人工开发  
**预计工作量**: 20-30小时  
**实施前提**: API已稳定(版本>=v1.0.0)、有明确的第三方集成需求

---

## 📋 目录

1. [项目背景](#项目背景)
2. [技术方案选型](#技术方案选型)
3. [实施步骤](#实施步骤)
4. [代码实现细节](#代码实现细节)
5. [测试验证](#测试验证)
6. [维护指南](#维护指南)
7. [常见问题](#常见问题)

---

## 项目背景

### 当前状态
- **静态API文档**: `docs/API.md` (1194行,包含30+端点)
- **用户痛点**: 需要手动打开Postman或写代码测试API
- **目标用户**: 第三方开发者、集成方

### 实施时机
**推荐在以下条件满足时开始**:
- [x] 项目版本 >= v1.0.0 (当前v0.3.3)
- [x] API变更频率 < 1次/月
- [x] 有至少3个第三方集成需求
- [x] 团队有专人负责文档维护

---

## 技术方案选型

### 方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **Swagger UI** | 自动生成、可测试、标准化 | 需大量注释、学习曲线高 | ⭐⭐⭐⭐⭐ |
| **Postman Collection** | 熟悉工具、易分享 | 手动维护、需安装工具 | ⭐⭐⭐⭐ |
| **自建页面** | 完全自定义 | 工作量大、不标准 | ⭐⭐ |

### 选定方案: **Swagger UI + Postman Collection 双轨制**

**理由**:
1. **Swagger UI**: 面向在线用户
   - 浏览器直接测试,无需安装工具
   - 行业标准(OpenAPI规范)
   - 自动生成文档(基于代码注释)

2. **Postman Collection**: 面向高级用户
   - 熟悉的Postman界面
   - 支持自动化测试脚本
   - 可导入本地环境快速调试

**实施优先级**:
- **Phase A (短期,1-2周)**: Postman Collection → 快速交付,工作量小
- **Phase B (中期,3-6周)**: Swagger UI → 长期维护,自动生成

---

## 实施步骤

### ⚡ Phase A: Postman Collection (短期方案, 1-2周)

#### A.1 创建Postman Collection (3-5小时)

**步骤1**: 安装Postman
- 下载地址: https://www.postman.com/downloads/
- 或使用Web版: https://web.postman.com/

**步骤2**: 创建新Collection
1. 打开Postman
2. 点击"New" → "Collection"
3. 命名为 `Researchopia API`
4. 设置变量:
   - `baseUrl`: `https://www.researchopia.com` (Production)
   - `devUrl`: `http://localhost:3000` (Development)
   - `token`: `{{token}}` (登录后自动填充)

**步骤3**: 按模块添加请求

##### Authentication模块
```
📁 Researchopia API
  📁 Authentication
    POST Login
      URL: {{baseUrl}}/api/auth/login
      Body (raw, JSON):
      {
        "email": "user@example.com",
        "password": "password123"
      }
      
      Tests脚本(自动提取Token):
      pm.test("Login successful", function() {
        pm.response.to.have.status(200);
        const response = pm.response.json();
        pm.environment.set("token", response.token);
      });
    
    POST Register
      URL: {{baseUrl}}/api/auth/register
      Body (raw, JSON):
      {
        "email": "newuser@example.com",
        "password": "password123",
        "username": "newuser"
      }
```

##### Papers模块
```
  📁 Papers
    GET Get Paper by DOI
      URL: {{baseUrl}}/api/papers/10.1234%2Fexample
      
    POST Search Papers
      URL: {{baseUrl}}/api/papers/search
      Body (raw, JSON):
      {
        "query": "machine learning",
        "limit": 10
      }
```

##### Annotations模块
```
  📁 Annotations
    POST Create Annotation (需要认证)
      URL: {{baseUrl}}/api/proxy/annotations/create
      Headers:
        Authorization: Bearer {{token}}
      Body (raw, JSON):
      {
        "paper_doi": "10.1234/example",
        "annotation_data": {
          "text": "This is important",
          "comment": "Great insight",
          "position": { "pageIndex": 1, "rects": [] }
        }
      }
    
    GET List Annotations
      URL: {{baseUrl}}/api/proxy/annotations/list?doi=10.1234%2Fexample&page=1
      Headers:
        Authorization: Bearer {{token}}
```

##### Reading Sessions模块
```
  📁 Reading Sessions
    POST Create Session
      URL: {{baseUrl}}/api/reading-session/create
      Headers:
        Authorization: Bearer {{token}}
      Body (raw, JSON):
      {
        "session_name": "Test Session",
        "paper_doi": "10.1234/example"
      }
    
    POST Join Session
      URL: {{baseUrl}}/api/reading-session/join
      Headers:
        Authorization: Bearer {{token}}
      Body (raw, JSON):
      {
        "session_id": "uuid-here"
      }
```

**步骤4**: 导出Collection
1. 右键Collection → "Export"
2. 选择 "Collection v2.1"
3. 保存为 `docs/postman/Researchopia.postman_collection.json`

**步骤5**: 创建Environment
1. 点击"Environments" → "Create Environment"
2. 添加变量:
   - `baseUrl`: `https://www.researchopia.com`
   - `token`: (初始为空)
3. 导出为 `docs/postman/Researchopia.postman_environment.json`

#### A.2 创建使用文档 (1小时)

**文件位置**: `docs/postman/README.md`

```markdown
# Researchopia API Postman Collection

本目录包含Researchopia API的Postman Collection,方便快速测试API。

## 快速开始

### 方法1: 在线导入 (推荐)

[![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/:collection_id)

> **注意**: collection_id需要先发布Collection到Postman云端

### 方法2: 本地导入

1. 下载文件:
   - [Researchopia.postman_collection.json](./Researchopia.postman_collection.json)
   - [Researchopia.postman_environment.json](./Researchopia.postman_environment.json)

2. 打开Postman → 点击"Import" → 拖拽两个文件进去

3. 选择 `Researchopia Environment`

4. 开始测试!

## 使用流程

### 1. 登录获取Token
1. 展开 `Authentication` 文件夹
2. 双击 `Login` 请求
3. 修改Body中的 `email` 和 `password`
4. 点击"Send"
5. Token会自动保存到环境变量

### 2. 测试需要认证的API
1. 选择任意需要认证的请求(如 `Create Annotation`)
2. Token会自动从环境变量中读取
3. 直接点击"Send"即可

### 3. 切换环境
修改环境变量中的 `baseUrl`:
- 生产环境: `https://www.researchopia.com`
- 开发环境: `http://localhost:3000`

## 文件说明

| 文件 | 说明 |
|------|------|
| `Researchopia.postman_collection.json` | API请求集合 |
| `Researchopia.postman_environment.json` | 环境变量(baseUrl、token) |
| `README.md` | 本文档 |

## 常见问题

### Q: 如何更新Token?
A: 重新运行 `Authentication/Login` 请求,Token会自动更新

### Q: 如何测试分页?
A: 在 `List Annotations` 请求的URL中修改 `page` 参数

### Q: 如何测试错误情况?
A: 故意输入错误参数(如无效Token、不存在的DOI)

## 自动化测试

Collection包含自动化测试脚本,可使用Newman运行:

\`\`\`bash
npm install -g newman
newman run Researchopia.postman_collection.json -e Researchopia.postman_environment.json
\`\`\`

## 相关资源

- **API文档**: [docs/API.md](../API.md)
- **交互式文档**: https://www.researchopia.com/api-docs (Swagger UI)
- **问题反馈**: https://github.com/occasional16/researchopia/issues
```

#### A.3 添加到主README (5分钟)

在 `README.md` 的"文档"章节添加:

```markdown
### API测试工具
- [Postman Collection](./docs/postman/) - 导入Postman快速测试
- [交互式API文档](https://www.researchopia.com/api-docs) - Swagger UI (即将推出)
```

---

### 🚀 Phase B: Swagger UI (长期方案, 3-6周)

#### Phase 1: 环境准备 (1-2小时)

#### 1.1 安装依赖
```bash
cd /path/to/researchopia
npm install --save swagger-jsdoc swagger-ui-react
npm install --save-dev @types/swagger-jsdoc
```

#### 1.2 创建目录结构
```bash
mkdir -p src/lib/swagger
mkdir -p src/app/api-docs
mkdir -p docs/openapi
```

**目录说明**:
- `src/lib/swagger/`: Swagger配置和工具函数
- `src/app/api-docs/`: Swagger UI页面
- `docs/openapi/`: 备份的OpenAPI规范文件

---

### Phase 2: Swagger配置 (2-3小时)

#### 2.1 创建Swagger配置文件
**文件位置**: `src/lib/swagger/config.ts`

```typescript
import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Researchopia API',
      version: '1.0.0', // 跟随项目版本
      description: 'Academic research platform API - 学术研究协作平台API接口',
      contact: {
        name: 'Researchopia Team',
        url: 'https://www.researchopia.com',
        email: 'support@researchopia.com',
      },
      license: {
        name: 'AGPL-3.0',
        url: 'https://www.gnu.org/licenses/agpl-3.0.html',
      },
    },
    servers: [
      {
        url: 'https://www.researchopia.com',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from /api/auth/login',
        },
      },
      schemas: {
        // 常用数据模型
        Paper: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            doi: { type: 'string', example: '10.1234/example' },
            title: { type: 'string' },
            abstract: { type: 'string' },
            authors: { type: 'array', items: { type: 'string' } },
            published_date: { type: 'string', format: 'date' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Annotation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            paper_doi: { type: 'string' },
            user_id: { type: 'string', format: 'uuid' },
            annotation_data: { type: 'object' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            code: { type: 'string' },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: '认证相关API' },
      { name: 'Papers', description: '论文相关API' },
      { name: 'Annotations', description: '标注相关API' },
      { name: 'ReadingSessions', description: '共读会话API' },
      { name: 'Users', description: '用户相关API' },
    ],
  },
  // 扫描所有API路由文件
  apis: [
    './src/app/api/**/*.ts',
    './src/app/api/**/*.tsx',
  ],
};

export const swaggerSpec = swaggerJSDoc(options);
```

#### 2.2 创建Swagger UI页面
**文件位置**: `src/app/api-docs/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export default function ApiDocsPage() {
  const [spec, setSpec] = useState(null);

  useEffect(() => {
    // 从API端点获取Swagger规范
    fetch('/api/swagger')
      .then((res) => res.json())
      .then((data) => setSpec(data));
  }, []);

  if (!spec) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading API Documentation...</h2>
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-8 bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold mb-2">Researchopia API Documentation</h1>
        <p className="text-gray-600 mb-4">
          交互式API文档 - 直接在浏览器中测试API端点
        </p>
        <div className="flex gap-4">
          <a
            href="https://github.com/occasional16/researchopia"
            className="text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a
            href="/guide"
            className="text-blue-600 hover:underline"
          >
            用户指南
          </a>
          <a
            href="https://github.com/occasional16/researchopia/issues"
            className="text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            问题反馈
          </a>
        </div>
      </div>

      {/* Swagger UI */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <SwaggerUI 
          spec={spec}
          docExpansion="list"
          defaultModelsExpandDepth={1}
          displayRequestDuration={true}
        />
      </div>

      {/* 页脚说明 */}
      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-bold mb-2">💡 使用提示</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>点击端点查看详细信息</li>
          <li>点击"Try it out"按钮测试API</li>
          <li>需要认证的端点,先调用 /api/auth/login 获取Token</li>
          <li>点击右上角"Authorize"按钮输入Token</li>
        </ul>
      </div>
    </div>
  );
}
```

#### 2.3 创建Swagger规范API端点
**文件位置**: `src/app/api/swagger/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { swaggerSpec } from '@/lib/swagger/config';

export async function GET() {
  return NextResponse.json(swaggerSpec);
}
```

---

### Phase 3: API注释添加 (15-20小时)

#### 3.1 认证API注释示例
**文件位置**: `src/app/api/auth/login/route.ts`

```typescript
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 用户登录
 *     description: 使用邮箱和密码登录,返回JWT Token
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *                 description: 用户邮箱
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123
 *                 minLength: 8
 *                 description: 用户密码(至少8位)
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                   description: JWT认证Token
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                     username:
 *                       type: string
 *       401:
 *         description: 认证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: Invalid credentials
 *               code: AUTH_INVALID
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function POST(request: Request) {
  // 现有代码保持不变
  try {
    const { email, password } = await request.json();
    // ... 登录逻辑
  } catch (error) {
    // ... 错误处理
  }
}
```

#### 3.2 论文API注释示例
**文件位置**: `src/app/api/papers/[doi]/route.ts`

```typescript
/**
 * @swagger
 * /api/papers/{doi}:
 *   get:
 *     summary: 根据DOI获取论文详情
 *     description: 返回论文的完整信息,包括标题、摘要、作者等
 *     tags:
 *       - Papers
 *     parameters:
 *       - in: path
 *         name: doi
 *         required: true
 *         schema:
 *           type: string
 *         description: 论文DOI (需要URL编码)
 *         example: 10.1234%2Fexample
 *     responses:
 *       200:
 *         description: 成功返回论文信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Paper'
 *       404:
 *         description: 论文不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: Paper not found
 *               code: PAPER_NOT_FOUND
 */
export async function GET(
  request: Request,
  { params }: { params: { doi: string } }
) {
  // 现有代码...
}
```

#### 3.3 需要认证的API注释
**文件位置**: `src/app/api/proxy/annotations/create/route.ts`

```typescript
/**
 * @swagger
 * /api/proxy/annotations/create:
 *   post:
 *     summary: 创建新标注
 *     description: 为论文添加新的标注(需要认证)
 *     tags:
 *       - Annotations
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paper_doi
 *               - annotation_data
 *             properties:
 *               paper_doi:
 *                 type: string
 *                 example: 10.1234/example
 *               annotation_data:
 *                 type: object
 *                 properties:
 *                   text:
 *                     type: string
 *                     description: 标注的文本内容
 *                   comment:
 *                     type: string
 *                     description: 标注评论
 *                   position:
 *                     type: object
 *                     description: PDF中的位置信息
 *     responses:
 *       201:
 *         description: 标注创建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Annotation'
 *       401:
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: Unauthorized
 *               code: AUTH_REQUIRED
 */
export async function POST(request: Request) {
  // 现有代码...
}
```

#### 3.4 批量添加注释策略

**优先级排序**:
1. **P0 - 核心API** (先实施):
   - 认证: `/api/auth/login`, `/api/auth/register`
   - 论文: `/api/papers/*`
   - 标注: `/api/proxy/annotations/*`

2. **P1 - 重要API** (次要):
   - 用户: `/api/users/*`
   - 会话: `/api/reading-session/*`

3. **P2 - 辅助API** (最后):
   - 工具: `/api/doi/*`
   - 统计: `/api/stats/*`

**工作量估算**:
- 每个端点注释: 30-45分钟
- 共30+端点 → 总计15-20小时

---

### Phase 4: 样式优化 (2-3小时)

#### 4.1 自定义Swagger UI样式
**文件位置**: `src/app/api-docs/swagger-custom.css`

```css
/* Swagger UI 自定义样式 */

/* 主题色 */
.swagger-ui .topbar {
  display: none; /* 隐藏默认顶栏 */
}

.swagger-ui .scheme-container {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 0.5rem;
}

/* 按钮样式 */
.swagger-ui .btn.execute {
  background-color: #3b82f6 !important;
  border-color: #3b82f6 !important;
}

.swagger-ui .btn.execute:hover {
  background-color: #2563eb !important;
}

/* 响应代码颜色 */
.swagger-ui .responses-inner h4,
.swagger-ui .responses-inner h5 {
  font-size: 14px;
  font-weight: 600;
}

.swagger-ui .response-col_status {
  font-weight: bold;
}

/* 认证锁图标 */
.swagger-ui .authorization__btn.locked {
  color: #22c55e;
}

/* 请求体编辑器 */
.swagger-ui .body-param__text {
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
}
```

在 `src/app/api-docs/page.tsx` 中引入:
```typescript
import './swagger-custom.css';
```

---

## 测试验证

### 测试清单

#### 1. 功能测试
- [ ] 访问 `http://localhost:3000/api-docs` 页面加载正常
- [ ] 所有API端点显示在文档中
- [ ] 点击"Try it out"可以发送请求
- [ ] 认证Token输入框正常工作
- [ ] 请求/响应示例显示正确

#### 2. 认证流程测试
```bash
# 1. 调用登录API
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# 2. 复制返回的Token
# 3. 在Swagger UI点击右上角"Authorize"按钮
# 4. 输入 Token
# 5. 测试需要认证的API(如创建标注)
```

#### 3. 边界情况测试
- [ ] 无效参数返回400错误
- [ ] 未认证访问返回401错误
- [ ] 不存在资源返回404错误
- [ ] 服务器错误返回500错误

#### 4. 性能测试
- [ ] 首次加载时间 < 3秒
- [ ] API文档JSON大小 < 1MB
- [ ] 浏览器控制台无错误

---

## 维护指南

### 日常维护

#### 1. 新增API时
**步骤**:
1. 编写API路由代码
2. 添加Swagger注释(参考Phase 3示例)
3. 本地测试 `http://localhost:3000/api-docs`
4. 提交代码

**模板**:
```typescript
/**
 * @swagger
 * /api/your-endpoint:
 *   method:
 *     summary: 简短描述
 *     description: 详细描述
 *     tags: [CategoryName]
 *     parameters: []
 *     requestBody: {}
 *     responses:
 *       200:
 *         description: 成功响应
 */
```

#### 2. 修改API时
**步骤**:
1. 更新API路由代码
2. **同步更新Swagger注释**
3. 检查是否有Breaking Changes
4. 更新版本号(如果是Breaking Change)

#### 3. 废弃API时
**在注释中标记废弃**:
```typescript
/**
 * @swagger
 * /api/old-endpoint:
 *   get:
 *     deprecated: true
 *     summary: 已废弃 - 请使用 /api/new-endpoint
 *     description: 此端点将在v2.0.0移除
 */
```

### 版本管理

#### 版本号规则
遵循语义化版本(Semantic Versioning):
- **主版本号**: API Breaking Changes
- **次版本号**: 新增API端点
- **修订号**: Bug修复、文档更新

**示例**:
```typescript
// swagger config.ts
info: {
  version: '1.2.3',
  // 1: 主版本(Breaking Changes)
  // 2: 次版本(新增端点)
  // 3: 修订号(Bug修复)
}
```

### 自动化脚本

#### 验证Swagger注释完整性
**文件位置**: `scripts/validate-swagger.js`

```javascript
const fs = require('fs');
const path = require('path');
const { swaggerSpec } = require('../src/lib/swagger/config');

// 检查所有API是否有文档
const apiFiles = [];
const findApiFiles = (dir) => {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findApiFiles(filePath);
    } else if (file === 'route.ts') {
      apiFiles.push(filePath);
    }
  });
};

findApiFiles('./src/app/api');

const documentedPaths = Object.keys(swaggerSpec.paths);
console.log(`📄 发现 ${apiFiles.length} 个API文件`);
console.log(`✅ 已文档化 ${documentedPaths.length} 个端点`);

// 检查缺失文档的API
const missingDocs = apiFiles.filter((file) => {
  const apiPath = file
    .replace('./src/app', '')
    .replace('/route.ts', '')
    .replace(/\[([^\]]+)\]/g, '{$1}');
  
  return !documentedPaths.some((path) => path.includes(apiPath));
});

if (missingDocs.length > 0) {
  console.warn('⚠️  以下API缺少Swagger文档:');
  missingDocs.forEach((file) => console.warn(`   - ${file}`));
  process.exit(1);
}

console.log('✅ 所有API都有文档!');
```

**在package.json添加脚本**:
```json
{
  "scripts": {
    "docs:validate": "node scripts/validate-swagger.js",
    "docs:export": "node scripts/export-openapi.js"
  }
}
```

---

## 常见问题

### Q1: Swagger UI加载缓慢?
**A**: 优化策略:
1. 使用CDN引入 `swagger-ui-react`:
```typescript
import('https://cdn.jsdelivr.net/npm/swagger-ui-react/swagger-ui.css');
```
2. 懒加载Swagger UI:
```typescript
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });
```

### Q2: 如何支持文件上传?
**A**: 在Swagger注释中:
```yaml
requestBody:
  content:
    multipart/form-data:
      schema:
        type: object
        properties:
          file:
            type: string
            format: binary
```

### Q3: 如何测试需要Cookie的API?
**A**: 在Swagger配置中添加:
```typescript
components: {
  securitySchemes: {
    CookieAuth: {
      type: 'apiKey',
      in: 'cookie',
      name: 'session_token',
    },
  },
}
```

### Q4: 如何导出OpenAPI规范文件?
**A**: 创建导出脚本:
```javascript
// scripts/export-openapi.js
const fs = require('fs');
const { swaggerSpec } = require('../src/lib/swagger/config');

fs.writeFileSync(
  './docs/openapi/openapi-spec.json',
  JSON.stringify(swaggerSpec, null, 2)
);
console.log('✅ OpenAPI规范已导出到 docs/openapi/openapi-spec.json');
```

### Q5: 如何添加示例请求?
**A**: 使用 `x-codeSamples`:
```yaml
x-codeSamples:
  - lang: 'JavaScript'
    source: |
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'pass' })
      });
  - lang: 'cURL'
    source: |
      curl -X POST https://www.researchopia.com/api/auth/login \\
        -H "Content-Type: application/json" \\
        -d '{"email":"user@example.com","password":"pass"}'
```

---

## 实施检查清单

### Phase A: Postman Collection (短期)

#### 开始前
- [ ] 安装Postman(桌面版或Web版)
- [ ] 了解项目API结构(参考 `docs/API.md`)

#### 实施中
- [ ] A.1: 创建Postman Collection
  - [ ] 添加Authentication模块(Login、Register)
  - [ ] 添加Papers模块(Get Paper、Search Papers)
  - [ ] 添加Annotations模块(Create、List、Like、Comment)
  - [ ] 添加Reading Sessions模块(Create、Join、Leave)
  - [ ] 添加Users模块(Get Profile、Update Profile)
  - [ ] 配置自动化测试脚本(提取Token)
- [ ] A.2: 导出Collection和Environment文件
- [ ] A.3: 创建 `docs/postman/README.md` 使用文档
- [ ] A.4: 测试所有请求(生产环境和开发环境)

#### 上线后
- [ ] 在主README添加Postman Collection链接
- [ ] (可选)发布到Postman公共workspace
- [ ] 通知团队和用户新增测试工具

**预计完成时间**: 1-2周  
**工作量**: 5-8小时

---

### Phase B: Swagger UI (长期)

#### 开始前
- [ ] 确认项目版本 >= v1.0.0
- [ ] 确认API已稳定(变更频率<1次/月)
- [ ] 确认有第三方集成需求
- [ ] 确认团队有专人负责维护
- [ ] **Phase A的Postman Collection已完成**(可作为参考)

#### 实施中
- [ ] Phase 1: 安装依赖和创建目录
- [ ] Phase 2: 配置Swagger和创建UI页面
- [ ] Phase 3: 为30+API端点添加注释
  - [ ] 核心API(P0): 认证、论文、标注
  - [ ] 重要API(P1): 用户、会话
  - [ ] 辅助API(P2): 工具、统计
- [ ] Phase 4: 优化样式和用户体验
- [ ] 功能测试通过
- [ ] 性能测试通过

#### 上线后
- [ ] 在主README更新API文档链接(Postman + Swagger)
- [ ] 更新 `docs/API.md` 添加交互式文档说明
- [ ] 通知用户和开发者新文档地址
- [ ] 设置文档自动化验证(CI/CD)

**预计完成时间**: 3-6周  
**工作量**: 20-30小时

---

### 双轨制整合

#### 最终状态
```
用户访问文档 → 三种选择:
├─ 静态文档: docs/API.md (快速查阅)
├─ Postman Collection: docs/postman/ (本地测试)
└─ Swagger UI: www.researchopia.com/api-docs (在线测试)
```

#### 维护策略
1. **新增API**: 
   - 更新 `docs/API.md`
   - 添加Postman请求
   - 添加Swagger注释

2. **修改API**:
   - 同步更新三处文档
   - 检查Breaking Changes

3. **废弃API**:
   - 三处文档标记 `deprecated`
   - 提前3个月通知用户

---

## 相关资源

### Postman相关
- **Postman官网**: https://www.postman.com/
- **Collection格式**: https://schema.postman.com/
- **Newman CLI**: https://www.npmjs.com/package/newman
- **Postman Learning Center**: https://learning.postman.com/

### Swagger相关
- **OpenAPI规范**: https://swagger.io/specification/
- **Swagger UI文档**: https://swagger.io/tools/swagger-ui/
- **Next.js集成示例**: https://github.com/vercel/next.js/tree/canary/examples/api-routes-rest

### 本项目文档
- **静态API文档**: `docs/API.md`
- **贡献指南**: `docs/CONTRIBUTING.md`
- **开发指南**: `docs/DEVELOPMENT.md`

---

## 附录: 实施时间线建议

```
2025-01 (现在)
  └─ 📝 完成此实施指南

2025-02 ~ 2025-03 (Phase A: Postman)
  ├─ Week 1-2: 创建Postman Collection (5-8小时)
  │   └─ 添加所有API请求、配置环境变量
  ├─ Week 3: 测试和优化 (2-3小时)
  │   └─ 编写自动化测试脚本、验证所有请求
  └─ Week 4: 文档和发布 (1-2小时)
      └─ 创建README、添加到主文档、通知用户

2025-06 ~ 2025-08 (Phase B: Swagger UI)
  ├─ Week 1: 环境准备 (1-2小时)
  │   └─ 安装依赖、创建目录结构
  ├─ Week 2-3: Swagger配置 (2-3小时)
  │   └─ 创建config、UI页面、API端点
  ├─ Week 4-7: API注释添加 (15-20小时)
  │   ├─ Week 4: P0核心API(认证、论文、标注)
  │   ├─ Week 5-6: P1重要API(用户、会话)
  │   └─ Week 7: P2辅助API(工具、统计)
  ├─ Week 8: 样式优化和测试 (2-3小时)
  │   └─ 自定义CSS、功能测试、性能测试
  └─ Week 9: 上线和维护 (1-2小时)
      └─ 更新文档、通知用户、设置CI/CD
```

---

**创建日期**: 2025-01-02  
**实施时间线**:
- **Phase A (Postman)**: 2025年2-3月 (当前即可开始)
- **Phase B (Swagger)**: 2025年6-8月 (项目版本>=v1.0.0后)

**维护者**: Researchopia Team

**祝实施顺利! 🚀📚✨**
