# API 接口文档

本文档提供 Researchopia 项目所有 API 端点的详细说明。

> **面向人群**: 开发者、集成方、第三方应用  
> **基础URL**: `https://www.researchopia.com/api`  
> **开发环境**: `http://localhost:3000/api`  
> **API版本**: v2 (当前) | ~~proxy (已废弃)~~  
> **最后更新**: 2025-11-15

---

## ⚠️ 重要更新 (2025-11-15)

### API v1 → v2 迁移完成

**变更说明**:
- ✅ 已删除所有 `/api/proxy/*` 端点 (24个文件, -2316行)
- ✅ 统一使用 `/api/v2/*` 路由规范
- ✅ 所有响应包含 `X-API-Version: v2` header
- ⚠️ **Breaking Change**: 旧 `/api/proxy/*` 调用将返回404错误

**端点映射**:
| 旧端点 (已废弃) | 新端点 (当前) |
|-----------------|--------------|
| `/api/proxy/auth/*` | `/api/v2/auth/*` |
| `/api/proxy/annotations/*` | `/api/v2/annotations/*` |
| `/api/proxy/reading-session/*` | `/api/v2/reading-session/*` |
| `/api/proxy/papers/*` | `/api/v2/papers/*` |

**兼容性**:
- Zotero插件 v0.5.0+ 已更新到v2
- 浏览器扩展 v0.1.1+ 已更新到v2
- 第三方集成请尽快更新

---

## 目录

1. [API版本说明](#api版本说明)
2. [API概述](#api概述)
3. [认证方式](#认证方式)
4. [错误处理](#错误处理)
5. [速率限制](#速率限制)
6. [认证相关API](#认证相关api)
7. [论文相关API](#论文相关api)
8. [标注相关API](#标注相关api)
9. [共读会话API](#共读会话api)
10. [用户相关API](#用户相关api)
11. [工具API](#工具api)
12. [完整端点列表](#完整端点列表)

---

<a name="api版本说明"></a>
## 1. API版本说明

### 当前活跃版本

| 版本 | 路由前缀 | 状态 | 说明 |
|------|----------|------|------|
| **v2** | `/api/v2/*` | ✅ 生产环境 | 统一API规范,推荐使用 |
| ~~proxy~~ | `/api/proxy/*` | ❌ 已废弃 | 2025-11-15删除 |
| v1 | `/api/auth/*`, `/api/papers/*`, etc. | 🟡 待迁移 | 网站专用,逐步迁移到v2 |
| admin | `/api/admin/*` | ✅ 独立维护 | 管理端点,不纳入v2 |

### v2 API特性

- ✅ **统一规范**: 所有端点遵循RESTful设计
- ✅ **类型安全**: 完整TypeScript类型定义
- ✅ **版本标识**: 响应header包含 `X-API-Version: v2`
- ✅ **错误处理**: 统一错误格式和HTTP状态码
- ✅ **认证方式**: Bearer Token (JWT)

### 迁移路线图

**Phase 1** ✅ (2025-11-15 完成):
- 删除 `/api/proxy/*` 端点
- Zotero插件和浏览器扩展切换到v2

**Phase 2** (2025-12-01 计划):
- 迁移 `/api/papers/*` → `/api/v2/papers/*`
- 迁移 `/api/auth/*` → `/api/v2/auth/*`
- 迁移 `/api/users/*` → `/api/v2/users/*`

**Phase 3** (2026-01-01 计划):
- 迁移剩余端点到v2
- 删除所有v1端点
- v2成为唯一API版本

---

<a name="api概述"></a>
## 2. API概述

### 2.1 ~~API版本~~ (已迁移到第1章)

Researchopia 当前使用 **v2 统一API**:

**v2 API** (`/api/v2/*`):
- ✅ 当前生产环境标准
- 面向所有客户端 (网站、Zotero插件、浏览器扩展)
- RESTful风格,Bearer Token认证
- 统一错误处理和响应格式
- 所有响应包含 `X-API-Version: v2` header

**~~代理API~~** (`/api/proxy/*`):
- ❌ 已于2025-11-15废弃删除
- 请迁移到 `/api/v2/*` (见第1章映射表)

### 1.2 数据格式

**请求**:
- Content-Type: `application/json`
- 使用 JSON 格式提交数据

**响应**:
- Content-Type: `application/json`
- 统一响应格式:

```json
{
  "success": true,
  "data": {
    // 响应数据
  },
  "error": null
}
```

错误响应:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

---

<a name="认证方式"></a>
## 3. 认证方式

### 3.1 Bearer Token (推荐)

在请求头中添加:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**获取Token**:
1. 调用 `POST /api/v2/auth/login` 登录
2. 返回 `access_token` 和 `refresh_token`
3. Token 有效期: 7天
4. 使用 `POST /api/v2/auth/refresh` 刷新Token

**示例**:
```bash
# 登录获取Token
curl -X POST "https://www.researchopia.com/api/v2/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"your_password"}'

# 使用Token访问API
curl -X GET "https://www.researchopia.com/api/v2/annotations/list?doi=10.1234/example" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3.2 API Key (公开API,待实现)

在请求头中添加:
```
X-API-Key: YOUR_API_KEY
```

**获取API Key**:
1. 登录 Researchopia 网站
2. 个人资料 → API Keys
3. 生成新的 API Key
4. 妥善保存(仅显示一次)

**示例**:
```bash
curl -X GET "https://www.researchopia.com/api/v1/annotations?doi=10.1234/example" \
  -H "X-API-Key: rsk_1234567890abcdef"
```

### 2.3 Cookie (网站端)

网站使用 Cookie-based 认证:
- 登录后自动设置 `session-token` Cookie
- Next.js 服务端组件和 API 路由自动验证
- 用户无需手动处理

---

<a name="错误处理"></a>
## 3. 错误处理

### 3.1 HTTP状态码

| 状态码 | 含义 | 说明 |
|--------|------|------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未认证或 Token 过期 |
| 403 | Forbidden | 无权限访问 |
| 404 | Not Found | 资源不存在 |
| 429 | Too Many Requests | 超过速率限制 |
| 500 | Internal Server Error | 服务器错误 |

### 3.2 错误码

| 错误码 | 说明 | 解决方法 |
|--------|------|----------|
| `INVALID_CREDENTIALS` | 邮箱或密码错误 | 检查登录信息 |
| `TOKEN_EXPIRED` | Token 已过期 | 使用 refresh_token 刷新 |
| `INVALID_TOKEN` | Token 无效 | 重新登录获取新 Token |
| `MISSING_PARAMETER` | 缺少必需参数 | 检查请求参数 |
| `INVALID_DOI` | DOI 格式错误 | 确认 DOI 格式正确 |
| `RESOURCE_NOT_FOUND` | 资源不存在 | 确认资源ID或DOI |
| `RATE_LIMIT_EXCEEDED` | 超过速率限制 | 稍后重试或升级计划 |
| `PERMISSION_DENIED` | 无权限 | 确认用户权限 |

### 3.3 错误响应示例

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Access token has expired. Please refresh or login again.",
    "details": {
      "expired_at": "2025-01-01T12:00:00Z"
    }
  }
}
```

---

<a name="速率限制"></a>
## 4. 速率限制

### 4.1 限制规则

**公开API** (`/api/v1/...`):
- 免费: 100 请求/小时
- 基础: 1,000 请求/小时
- 专业: 10,000 请求/小时

**插件API** (`/api/proxy/...`):
- 认证用户: 500 请求/小时
- 未认证: 10 请求/小时

### 4.2 响应头

每个响应都包含速率限制信息:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 998
X-RateLimit-Reset: 1704096000
```

### 4.3 超限处理

超过限制后返回 `429 Too Many Requests`:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 3600 seconds.",
    "details": {
      "retry_after": 3600
    }
  }
}
```

---

<a name="认证相关api"></a>
## 5. 认证相关API

### 5.1 用户注册

`POST /api/proxy/auth/register`

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "username": "johndoe"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "johndoe",
      "created_at": "2025-01-01T00:00:00Z"
    },
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 604800
  }
}
```

**错误**:
- `400`: 邮箱格式错误或密码过短
- `409`: 邮箱已被注册

---

### 5.2 用户登录

`POST /api/proxy/auth/login`

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "johndoe"
    },
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 604800
  }
}
```

**错误**:
- `401`: 邮箱或密码错误
- `403`: 账号被禁用

---

### 5.3 刷新Token

`POST /api/proxy/auth/refresh`

**请求体**:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 604800
  }
}
```

**错误**:
- `401`: Refresh token 无效或过期

---

### 5.4 获取当前会话

`GET /api/proxy/auth/session`

**请求头**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "johndoe",
      "avatar_url": "https://example.com/avatar.jpg",
      "bio": "PhD student in Computer Science"
    }
  }
}
```

**错误**:
- `401`: Token 无效或过期

---

### 5.5 用户登出

`POST /api/proxy/auth/logout`

**请求头**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**响应**:
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

<a name="论文相关api"></a>
## 6. 论文相关API

### 6.1 注册论文

`POST /api/proxy/papers/register`

将论文信息注册到 Researchopia 数据库。

**请求体**:
```json
{
  "doi": "10.1234/example",
  "title": "Deep Learning for Natural Language Processing",
  "authors": ["John Smith", "Jane Doe"],
  "abstract": "This paper presents...",
  "publication_date": "2025-01-01",
  "journal": "Nature",
  "volume": "600",
  "issue": "7890",
  "pages": "123-456"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "paper": {
      "id": "uuid",
      "doi": "10.1234/example",
      "title": "Deep Learning for Natural Language Processing",
      "created_at": "2025-01-02T00:00:00Z"
    }
  }
}
```

**错误**:
- `400`: DOI 格式错误
- `409`: 论文已存在

---

### 6.2 检查论文是否存在

`GET /api/proxy/papers/check?doi=10.1234/example`

**响应**:
```json
{
  "success": true,
  "data": {
    "exists": true,
    "paper": {
      "id": "uuid",
      "doi": "10.1234/example",
      "title": "Deep Learning for NLP",
      "annotation_count": 42,
      "view_count": 1523
    }
  }
}
```

如果不存在:
```json
{
  "success": true,
  "data": {
    "exists": false
  }
}
```

---

### 6.3 获取论文详情

`GET /api/papers/[doi]`

**示例**: `/api/papers/10.1234%2Fexample`

**响应**:
```json
{
  "success": true,
  "data": {
    "paper": {
      "id": "uuid",
      "doi": "10.1234/example",
      "title": "Deep Learning for NLP",
      "authors": ["John Smith", "Jane Doe"],
      "abstract": "This paper...",
      "publication_date": "2025-01-01",
      "journal": "Nature",
      "citation_count": 156,
      "view_count": 1523,
      "annotation_count": 42
    }
  }
}
```

**错误**:
- `404`: 论文不存在

---

<a name="标注相关api"></a>
## 7. 标注相关API

### 7.1 获取论文标注列表

`GET /api/proxy/annotations/list?doi=10.1234/example&limit=50&offset=0`

**查询参数**:
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `doi` | string | 是 | 论文DOI |
| `limit` | integer | 否 | 每页数量(默认50) |
| `offset` | integer | 否 | 偏移量(默认0) |

**请求头**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**响应**:
```json
{
  "success": true,
  "data": {
    "annotations": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "user_name": "johndoe",
        "annotation_text": "This is a key finding",
        "annotation_comment": "Very insightful analysis",
        "page_number": 5,
        "annotation_type": "highlight",
        "annotation_color": "#ffeb3b",
        "likes_count": 12,
        "comments_count": 3,
        "created_at": "2025-01-01T12:00:00Z"
      }
    ],
    "total": 42,
    "limit": 50,
    "offset": 0
  }
}
```

**重要**: 
- ✅ 查询时必须先调用 `.order('created_at', {ascending: false})`
- ✅ 然后调用 `.range(offset, offset + limit - 1)`
- ❌ 反之会导致分页错误

---

### 7.2 创建标注

`POST /api/proxy/annotations/create`

**请求头**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**请求体**:
```json
{
  "paper_doi": "10.1234/example",
  "annotation_data": {
    "zotero_key": "ABCD1234",
    "text": "This is an important finding",
    "comment": "My thoughts on this...",
    "type": "highlight",
    "color": "#ffeb3b"
  },
  "page_number": 5
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "annotation": {
      "id": "uuid",
      "user_id": "uuid",
      "paper_doi": "10.1234/example",
      "annotation_data": {
        "zotero_key": "ABCD1234",
        "text": "This is an important finding",
        "comment": "My thoughts on this...",
        "type": "highlight",
        "color": "#ffeb3b"
      },
      "page_number": 5,
      "created_at": "2025-01-02T00:00:00Z"
    }
  }
}
```

**错误**:
- `400`: 缺少必需字段
- `401`: 未认证
- `404`: 论文不存在

---

### 7.3 删除标注

`DELETE /api/proxy/annotations/delete_by_key?zotero_key=ABCD1234`

**查询参数**:
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `zotero_key` | string | 是 | Zotero标注的唯一key |

**请求头**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**响应**:
```json
{
  "success": true,
  "data": {
    "message": "Annotation deleted successfully",
    "deleted_count": 1
  }
}
```

**错误**:
- `401`: 未认证
- `403`: 只能删除自己的标注
- `404`: 标注不存在

---

### 7.4 点赞标注

`POST /api/annotations/[id]/like`

**请求头**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**响应**:
```json
{
  "success": true,
  "data": {
    "liked": true,
    "likes_count": 13
  }
}
```

取消点赞:
```json
{
  "success": true,
  "data": {
    "liked": false,
    "likes_count": 12
  }
}
```

---

### 7.5 评论标注

`POST /api/annotations/[id]/comments`

**请求头**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**请求体**:
```json
{
  "comment_text": "Great observation! I also noticed..."
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "comment": {
      "id": "uuid",
      "annotation_id": "uuid",
      "user_id": "uuid",
      "user_name": "johndoe",
      "comment_text": "Great observation!...",
      "created_at": "2025-01-02T00:00:00Z"
    }
  }
}
```

---

<a name="共读会话api"></a>
## 8. 共读会话API

### 8.1 创建共读会话

`POST /api/proxy/reading-session/create`

**请求头**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**请求体**:
```json
{
  "paper_doi": "10.1234/example",
  "session_type": "private"
}
```

**参数说明**:
- `session_type`: `"public"` 或 `"private"`

**响应**:
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "paper_doi": "10.1234/example",
      "session_type": "private",
      "invite_code": "ABC123",
      "creator_id": "uuid",
      "is_active": true,
      "created_at": "2025-01-02T00:00:00Z"
    }
  }
}
```

---

### 8.2 加入共读会话

`POST /api/proxy/reading-session/join`

**请求头**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**请求体**:
```json
{
  "invite_code": "ABC123"
}
```

或使用会话ID:
```json
{
  "session_id": "uuid"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "paper_doi": "10.1234/example",
      "session_type": "private",
      "creator_id": "uuid",
      "member_count": 3
    },
    "member": {
      "user_id": "uuid",
      "joined_at": "2025-01-02T00:00:00Z"
    }
  }
}
```

**错误**:
- `404`: 会话不存在或邀请码错误
- `409`: 已经是会话成员

---

### 8.3 获取会话成员列表

`GET /api/proxy/reading-session/members?session_id=uuid`

**请求头**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**响应**:
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "user_id": "uuid",
        "username": "johndoe",
        "avatar_url": "https://example.com/avatar.jpg",
        "is_online": true,
        "joined_at": "2025-01-02T00:00:00Z"
      },
      {
        "user_id": "uuid2",
        "username": "janedoe",
        "is_online": false,
        "joined_at": "2025-01-02T01:00:00Z"
      }
    ],
    "total": 2
  }
}
```

---

### 8.4 更新成员状态

`PUT /api/proxy/reading-session/update-member`

**请求头**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**请求体**:
```json
{
  "session_id": "uuid",
  "is_online": true
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "message": "Member status updated"
  }
}
```

---

### 8.5 列出所有会话

`GET /api/proxy/reading-session/list?type=public&limit=20`

**查询参数**:
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `type` | string | 否 | `"public"` 或 `"private"` 或 `"my"` |
| `limit` | integer | 否 | 每页数量(默认20) |

**请求头**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**响应**:
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "uuid",
        "paper_doi": "10.1234/example",
        "paper_title": "Deep Learning for NLP",
        "session_type": "public",
        "creator_username": "johndoe",
        "member_count": 5,
        "is_active": true,
        "created_at": "2025-01-02T00:00:00Z"
      }
    ],
    "total": 15
  }
}
```

---

### 8.6 删除会话

`DELETE /api/proxy/reading-session/delete?session_id=uuid`

**请求头**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**响应**:
```json
{
  "success": true,
  "data": {
    "message": "Session deleted successfully"
  }
}
```

**权限**: 只有会话创建者可以删除

---

<a name="用户相关api"></a>
## 9. 用户相关API

### 9.1 获取用户资料

`GET /api/users/[username]/profile`

**示例**: `/api/users/johndoe/profile`

**响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "display_name": "John Doe",
      "avatar_url": "https://example.com/avatar.jpg",
      "bio": "PhD student in Computer Science",
      "institution": "MIT",
      "orcid": "0000-0001-2345-6789",
      "website": "https://johndoe.com",
      "created_at": "2024-01-01T00:00:00Z",
      "stats": {
        "annotations_count": 156,
        "followers_count": 42,
        "following_count": 38,
        "papers_read": 234
      }
    }
  }
}
```

---

### 9.2 获取用户标注

`GET /api/users/[username]/annotations?limit=50&offset=0`

**响应**:
```json
{
  "success": true,
  "data": {
    "annotations": [
      {
        "id": "uuid",
        "paper_doi": "10.1234/example",
        "paper_title": "Deep Learning for NLP",
        "annotation_text": "Key finding",
        "annotation_comment": "My thoughts...",
        "page_number": 5,
        "likes_count": 12,
        "created_at": "2025-01-01T00:00:00Z"
      }
    ],
    "total": 156
  }
}
```

---

### 9.3 获取用户关注者

`GET /api/users/[username]/followers?limit=50&offset=0`

**响应**:
```json
{
  "success": true,
  "data": {
    "followers": [
      {
        "user_id": "uuid",
        "username": "janedoe",
        "display_name": "Jane Doe",
        "avatar_url": "https://example.com/avatar.jpg",
        "followed_at": "2024-12-01T00:00:00Z"
      }
    ],
    "total": 42
  }
}
```

---

### 9.4 关注/取消关注用户

`POST /api/users/[username]/follow`

**请求头**:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**响应**(关注):
```json
{
  "success": true,
  "data": {
    "following": true
  }
}
```

**响应**(取消关注):
```json
{
  "success": true,
  "data": {
    "following": false
  }
}
```

---

<a name="工具api"></a>
## 10. 工具API

### 10.1 健康检查

`GET /api/health`

**响应**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-01-02T00:00:00Z",
    "version": "1.0.0"
  }
}
```

---

### 10.2 获取站点统计

`GET /api/site/statistics`

**响应**:
```json
{
  "success": true,
  "data": {
    "total_users": 1543,
    "total_papers": 8932,
    "total_annotations": 45621,
    "active_sessions": 23,
    "updated_at": "2025-01-02T00:00:00Z"
  }
}
```

---

### 10.3 搜索论文

`GET /api/papers?q=deep+learning&limit=20&offset=0`

**查询参数**:
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `q` | string | 是 | 搜索关键词 |
| `limit` | integer | 否 | 每页数量(默认20) |
| `offset` | integer | 否 | 偏移量(默认0) |
| `sort` | string | 否 | 排序方式: `relevance`, `date`, `citations` |

**响应**:
```json
{
  "success": true,
  "data": {
    "papers": [
      {
        "id": "uuid",
        "doi": "10.1234/example",
        "title": "Deep Learning for NLP",
        "authors": ["John Smith"],
        "abstract": "This paper...",
        "publication_date": "2025-01-01",
        "citation_count": 156,
        "relevance_score": 0.95
      }
    ],
    "total": 234,
    "query": "deep learning"
  }
}
```

---

## 附录

### A. 完整端点列表

**认证**:
- `POST /api/proxy/auth/register` - 注册
- `POST /api/proxy/auth/login` - 登录
- `POST /api/proxy/auth/refresh` - 刷新Token
- `GET /api/proxy/auth/session` - 获取会话
- `POST /api/proxy/auth/logout` - 登出

**论文**:
- `POST /api/proxy/papers/register` - 注册论文
- `GET /api/proxy/papers/check` - 检查论文是否存在
- `GET /api/papers/[doi]` - 获取论文详情
- `GET /api/papers` - 搜索论文

**标注**:
- `GET /api/proxy/annotations/list` - 获取标注列表
- `POST /api/proxy/annotations/create` - 创建标注
- `DELETE /api/proxy/annotations/delete_by_key` - 删除标注
- `POST /api/annotations/[id]/like` - 点赞标注
- `POST /api/annotations/[id]/comments` - 评论标注

**共读会话**:
- `POST /api/proxy/reading-session/create` - 创建会话
- `POST /api/proxy/reading-session/join` - 加入会话
- `GET /api/proxy/reading-session/members` - 获取成员
- `PUT /api/proxy/reading-session/update-member` - 更新成员状态
- `GET /api/proxy/reading-session/list` - 列出会话
- `DELETE /api/proxy/reading-session/delete` - 删除会话

**用户**:
- `GET /api/users/[username]/profile` - 获取资料
- `GET /api/users/[username]/annotations` - 获取标注
- `GET /api/users/[username]/followers` - 获取关注者
- `POST /api/users/[username]/follow` - 关注/取消关注

**工具**:
- `GET /api/health` - 健康检查
- `GET /api/site/statistics` - 站点统计

### B. 常见使用场景

**场景1: Zotero插件登录并获取标注**
```bash
# 1. 登录
curl -X POST "https://www.researchopia.com/api/proxy/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# 2. 获取标注(使用返回的token)
curl -X GET "https://www.researchopia.com/api/proxy/annotations/list?doi=10.1234/example" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**场景2: 创建共读会话并邀请他人**
```bash
# 1. 创建会话
curl -X POST "https://www.researchopia.com/api/proxy/reading-session/create" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"paper_doi": "10.1234/example", "session_type": "private"}'

# 2. 分享返回的 invite_code 给他人

# 3. 他人加入会话
curl -X POST "https://www.researchopia.com/api/proxy/reading-session/join" \
  -H "Authorization: Bearer THEIR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "ABC123"}'
```

### C. SDK 和库

**官方SDK**(计划中):
- JavaScript/TypeScript
- Python
- R

**社区贡献**:
欢迎为 Researchopia 开发第三方SDK!

---

**版本**: v1.0  
**最后更新**: 2025-01-02  
**维护者**: Researchopia Team  
**问题反馈**: [GitHub Issues](https://github.com/occasional16/researchopia/issues)
