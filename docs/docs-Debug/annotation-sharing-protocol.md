# 跨平台标注分享协议 (Cross-Platform Annotation Sharing Protocol)

## 概述1

基于对Zotero Reader标注系统的深入研究，设计一套标准化的跨平台标注分享协议，支持Zotero、Mendeley、Adobe Reader等主流阅读平台的标注格式互操作。

## 标准化数据模型

### 核心标注接口
```typescript
interface UniversalAnnotation {
  // 必需字段
  id: string;                    // 全局唯一标识符
  type: AnnotationType;          // 标注类型
  documentId: string;            // 文档标识符
  position: PositionInfo;        // 位置信息
  createdAt: string;             // ISO 8601 时间戳
  modifiedAt: string;            // ISO 8601 时间戳
  
  // 可选字段
  content?: {
    text?: string;               // 选中的文本内容
    comment?: string;            // 用户评论
    color?: string;              // 十六进制颜色值
  };
  
  // 元数据
  metadata: {
    platform: PlatformType;      // 来源平台
    version: string;             // 协议版本
    author: AuthorInfo;          // 作者信息
    tags?: string[];             // 标签
    visibility: VisibilityLevel; // 可见性级别
  };
  
  // 扩展字段
  extensions?: Record<string, unknown>;
}

type AnnotationType = 
  | 'highlight'     // 高亮
  | 'underline'     // 下划线
  | 'strikeout'     // 删除线
  | 'note'          // 便笺
  | 'text'          // 文本框
  | 'ink'           // 手绘
  | 'image'         // 图片标注
  | 'shape';        // 几何图形

type PlatformType = 
  | 'zotero'
  | 'mendeley'
  | 'adobe-reader'
  | 'researchopia'
  | 'hypothesis'
  | 'web-annotate';

type VisibilityLevel = 'private' | 'shared' | 'public';
```

### 位置信息标准
```typescript
interface PositionInfo {
  // 文档类型标识
  documentType: 'pdf' | 'epub' | 'html' | 'text';
  
  // PDF位置信息（基于Zotero格式）
  pdf?: {
    pageIndex: number;           // 页面索引（从0开始）
    rects?: number[][];          // 矩形坐标数组 [x1, y1, x2, y2]
    paths?: number[][];          // 路径坐标（用于手绘）
    rotation?: number;           // 页面旋转角度
  };
  
  // EPUB位置信息（基于CFI标准）
  epub?: {
    cfi: string;                 // Canonical Fragment Identifier
    spineIndex?: number;         // 章节索引
  };
  
  // HTML/Web位置信息
  web?: {
    selector: WebSelector;       // W3C标准选择器
    url: string;                 // 页面URL
    title?: string;              // 页面标题
  };
  
  // 通用文本位置
  text?: {
    startOffset: number;         // 起始偏移
    endOffset: number;           // 结束偏移
    context?: string;            // 上下文文本
  };
}

interface WebSelector {
  type: 'TextQuoteSelector' | 'TextPositionSelector' | 'CssSelector' | 'XPathSelector';
  exact?: string;               // 精确文本
  prefix?: string;              // 前缀文本
  suffix?: string;              // 后缀文本
  start?: number;               // 起始位置
  end?: number;                 // 结束位置
  value?: string;               // 选择器值
}
```

### 作者信息和权限
```typescript
interface AuthorInfo {
  id: string;                    // 用户唯一标识
  name: string;                  // 显示名称
  email?: string;                // 邮箱地址
  platform: PlatformType;       // 所属平台
  isAuthoritative: boolean;      // 是否为权威作者
}

interface SharingPermissions {
  canEdit: boolean;              // 是否可编辑
  canDelete: boolean;            // 是否可删除
  canShare: boolean;             // 是否可分享
  canComment: boolean;           // 是否可评论
  expirationDate?: string;       // 过期时间
}
```

## 平台格式转换规则

### Zotero格式转换
```typescript
class ZoteroConverter {
  static toUniversal(zoteroAnnotation: ZoteroAnnotation): UniversalAnnotation {
    return {
      id: zoteroAnnotation.id,
      type: zoteroAnnotation.type as AnnotationType,
      documentId: zoteroAnnotation.documentId || '',
      position: this.convertZoteroPosition(zoteroAnnotation.position),
      createdAt: zoteroAnnotation.dateCreated,
      modifiedAt: zoteroAnnotation.dateModified,
      content: {
        text: zoteroAnnotation.text,
        comment: zoteroAnnotation.comment,
        color: zoteroAnnotation.color
      },
      metadata: {
        platform: 'zotero',
        version: '1.0',
        author: {
          id: zoteroAnnotation.authorName || 'anonymous',
          name: zoteroAnnotation.authorName || 'Anonymous',
          platform: 'zotero',
          isAuthoritative: zoteroAnnotation.isAuthorNameAuthoritative || false
        },
        tags: zoteroAnnotation.tags || [],
        visibility: 'private'
      }
    };
  }
  
  static fromUniversal(universal: UniversalAnnotation): ZoteroAnnotation {
    return {
      id: universal.id,
      type: universal.type,
      color: universal.content?.color || '#ffd400',
      sortIndex: this.generateSortIndex(),
      position: this.convertUniversalPosition(universal.position),
      text: universal.content?.text || '',
      comment: universal.content?.comment || '',
      tags: universal.metadata.tags || [],
      dateCreated: universal.createdAt,
      dateModified: universal.modifiedAt,
      authorName: universal.metadata.author.name,
      isAuthorNameAuthoritative: universal.metadata.author.isAuthoritative,
      pageLabel: '',
      readOnly: false
    };
  }
}
```

### Mendeley格式转换
```typescript
class MendeleyConverter {
  static toUniversal(mendeleyAnnotation: MendeleyAnnotation): UniversalAnnotation {
    return {
      id: mendeleyAnnotation.uuid,
      type: this.mapMendeleyType(mendeleyAnnotation.type),
      documentId: mendeleyAnnotation.documentId,
      position: this.convertMendeleyPosition(mendeleyAnnotation.positions),
      createdAt: mendeleyAnnotation.created,
      modifiedAt: mendeleyAnnotation.last_modified,
      content: {
        text: mendeleyAnnotation.text,
        comment: mendeleyAnnotation.note,
        color: mendeleyAnnotation.color?.hex
      },
      metadata: {
        platform: 'mendeley',
        version: '1.0',
        author: {
          id: mendeleyAnnotation.profile_id,
          name: mendeleyAnnotation.author?.first_name + ' ' + mendeleyAnnotation.author?.last_name,
          platform: 'mendeley',
          isAuthoritative: true
        },
        visibility: mendeleyAnnotation.privacy_level === 'group' ? 'shared' : 'private'
      }
    };
  }
}
```

## API接口规范

### RESTful API设计
```typescript
// 标注CRUD操作
interface AnnotationAPI {
  // 创建标注
  POST /api/v1/annotations
  Body: UniversalAnnotation
  Response: { id: string, created: UniversalAnnotation }
  
  // 获取标注
  GET /api/v1/annotations/:id
  Response: UniversalAnnotation
  
  // 更新标注
  PUT /api/v1/annotations/:id
  Body: Partial<UniversalAnnotation>
  Response: { updated: UniversalAnnotation }
  
  // 删除标注
  DELETE /api/v1/annotations/:id
  Response: { deleted: boolean }
  
  // 批量操作
  POST /api/v1/annotations/batch
  Body: { action: 'create' | 'update' | 'delete', annotations: UniversalAnnotation[] }
  Response: { results: Array<{ id: string, success: boolean, error?: string }> }
}

// 文档标注查询
interface DocumentAPI {
  // 获取文档的所有标注
  GET /api/v1/documents/:documentId/annotations
  Query: { 
    platform?: PlatformType[],
    type?: AnnotationType[],
    author?: string,
    visibility?: VisibilityLevel,
    limit?: number,
    offset?: number
  }
  Response: { annotations: UniversalAnnotation[], total: number }
  
  // 分享文档标注
  POST /api/v1/documents/:documentId/share
  Body: { users: string[], permissions: SharingPermissions, expirationDate?: string }
  Response: { shareId: string, shareUrl: string }
}

// 用户和权限管理
interface UserAPI {
  // 获取用户信息
  GET /api/v1/users/me
  Response: { user: AuthorInfo, platforms: PlatformConnection[] }
  
  // 连接平台
  POST /api/v1/users/platforms/connect
  Body: { platform: PlatformType, credentials: Record<string, unknown> }
  Response: { connected: boolean, platformId: string }
  
  // 获取共享标注
  GET /api/v1/users/shared-annotations
  Response: { annotations: UniversalAnnotation[], sharedBy: AuthorInfo[] }
}
```

### WebSocket实时同步
```typescript
interface WebSocketMessages {
  // 标注创建
  type: 'annotation:created';
  payload: { annotation: UniversalAnnotation, documentId: string };
  
  // 标注更新
  type: 'annotation:updated';
  payload: { annotation: UniversalAnnotation, changes: Partial<UniversalAnnotation> };
  
  // 标注删除
  type: 'annotation:deleted';
  payload: { id: string, documentId: string };
  
  // 用户连接/断开
  type: 'user:connected' | 'user:disconnected';
  payload: { user: AuthorInfo, documentId: string };
  
  // 光标位置同步
  type: 'cursor:moved';
  payload: { user: AuthorInfo, position: PositionInfo, documentId: string };
}
```

## 安全和隐私控制

### 权限管理
```typescript
interface AccessControl {
  // 标注可见性级别
  visibility: VisibilityLevel;
  
  // 具体权限设置
  permissions: {
    read: string[];              // 可读用户ID列表
    write: string[];             // 可写用户ID列表
    admin: string[];             // 管理员用户ID列表
  };
  
  // 组织级别权限
  organization?: {
    id: string;
    role: 'member' | 'admin' | 'owner';
    department?: string;
  };
  
  // 期限设置
  expiration?: {
    date: string;                // 过期日期
    action: 'hide' | 'readonly' | 'delete'; // 过期后的操作
  };
}

// 数据加密
interface EncryptionConfig {
  algorithm: 'AES-256-GCM';      // 加密算法
  keyDerivation: 'PBKDF2';       // 密钥派生
  saltLength: number;            // 盐长度
  iterations: number;            // 迭代次数
}
```

### 数据同步策略
```typescript
interface SyncStrategy {
  // 冲突解决
  conflictResolution: 'last-write-wins' | 'manual-merge' | 'version-branch';
  
  // 同步频率
  syncInterval: number;          // 毫秒
  
  // 离线支持
  offlineStrategy: 'cache-all' | 'cache-recent' | 'no-cache';
  
  // 带宽优化
  deltaSync: boolean;            // 是否使用增量同步
  compression: boolean;          // 是否压缩数据
}
```

## 实现路线图

### 第一阶段：核心协议实现
1. 定义标准化数据模型
2. 实现Zotero格式转换器
3. 建立基础API接口
4. 开发权限管理系统

### 第二阶段：平台集成
1. 集成Mendeley格式转换
2. 支持Adobe Reader导入导出
3. 实现WebSocket实时同步
4. 开发冲突解决机制

### 第三阶段：增强功能
1. 智能标注推荐
2. 多语言本地化支持
3. 高级搜索和过滤
4. 标注质量评估

### 第四阶段：生态扩展
1. 第三方平台API
2. 移动端SDK开发
3. 浏览器扩展集成
4. 学术机构定制版本