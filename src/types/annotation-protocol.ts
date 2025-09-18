// 跨平台标注分享协议类型定义
// Cross-Platform Annotation Sharing Protocol Types

/**
 * 通用标注接口
 * Universal Annotation Interface
 */
export interface UniversalAnnotation {
  // 必需字段 Required fields
  id: string;                    // 全局唯一标识符
  type: AnnotationType;          // 标注类型
  documentId: string;            // 文档标识符
  createdAt: string;            // ISO 8601 时间戳
  modifiedAt: string;           // ISO 8601 时间戳
  version: string;              // 协议版本
  
  // 内容字段 Content fields
  content?: {
    text?: string;               // 选中的文本内容
    comment?: string;            // 用户评论
    color?: string;              // 颜色值
    position?: {                 // 位置信息
      page?: number;
      start?: { x: number; y: number };
      end?: { x: number; y: number };
    };
  };
  
  // 元数据 Metadata
  metadata: {
    platform: PlatformType;      // 来源平台
    author: AuthorInfo;          // 作者信息
    tags?: string[];             // 标签
    visibility: VisibilityLevel; // 可见性级别
    permissions?: {              // 权限信息
      canEdit: string[];
      canView: string[];
    };
    documentInfo?: {             // 文档信息
      title?: string;
      doi?: string;
      url?: string;
    };
    originalData?: any;          // 原始平台数据
  };
}

/**
 * 标注类型枚举
 * Annotation Types
 */
export type AnnotationType = 
  | 'highlight'     // 高亮
  | 'underline'     // 下划线
  | 'strikeout'     // 删除线
  | 'note'          // 便笺
  | 'text'          // 文本框
  | 'ink'           // 手绘
  | 'image'         // 图片标注
  | 'shape';        // 几何图形

/**
 * 平台类型
 * Platform Types
 */
export type PlatformType = 
  | 'zotero'
  | 'mendeley'
  | 'adobe-reader'
  | 'researchopia'
  | 'hypothesis'
  | 'web-annotate'
  | 'calibre'
  | 'koreader';

/**
 * 可见性级别
 * Visibility Levels
 */
export type VisibilityLevel = 'private' | 'shared' | 'public';

/**
 * 位置信息
 * Position Information
 */
export interface PositionInfo {
  documentType: DocumentType;
  
  // PDF位置信息（基于Zotero格式）
  pdf?: PDFPosition;
  
  // EPUB位置信息（基于CFI标准）
  epub?: EPUBPosition;
  
  // HTML/Web位置信息
  web?: WebPosition;
  
  // 通用文本位置
  text?: TextPosition;
}

export type DocumentType = 'pdf' | 'epub' | 'html' | 'text';

/**
 * PDF位置信息
 * PDF Position
 */
export interface PDFPosition {
  pageIndex: number;           // 页面索引（从0开始）
  rects?: number[][];          // 矩形坐标数组 [x1, y1, x2, y2]
  paths?: number[][];          // 路径坐标（用于手绘）
  rotation?: number;           // 页面旋转角度
  fontSize?: number;           // 字体大小（用于文本标注）
  width?: number;              // 标注宽度
  height?: number;             // 标注高度
}

/**
 * EPUB位置信息
 * EPUB Position
 */
export interface EPUBPosition {
  cfi: string;                 // Canonical Fragment Identifier
  spineIndex?: number;         // 章节索引
  startCfi?: string;           // 起始CFI
  endCfi?: string;             // 结束CFI
}

/**
 * Web位置信息
 * Web Position
 */
export interface WebPosition {
  selector: WebSelector;       // W3C标准选择器
  url: string;                 // 页面URL
  title?: string;              // 页面标题
  xpath?: string;              // XPath选择器（备用）
}

/**
 * Web选择器（基于W3C Web Annotation标准）
 * Web Selector (Based on W3C Web Annotation)
 */
export type WebSelector = 
  | TextQuoteSelector
  | TextPositionSelector
  | CssSelector
  | XPathSelector
  | FragmentSelector;

export interface TextQuoteSelector {
  type: 'TextQuoteSelector';
  exact: string;               // 精确文本
  prefix?: string;             // 前缀文本
  suffix?: string;             // 后缀文本
  refinedBy?: WebSelector;     // 细化选择器
}

export interface TextPositionSelector {
  type: 'TextPositionSelector';
  start: number;               // 起始位置
  end: number;                 // 结束位置
  refinedBy?: WebSelector;     // 细化选择器
}

export interface CssSelector {
  type: 'CssSelector';
  value: string;               // CSS选择器值
  refinedBy?: WebSelector;     // 细化选择器
}

export interface XPathSelector {
  type: 'XPathSelector';
  value: string;               // XPath表达式
  refinedBy?: WebSelector;     // 细化选择器
}

export interface FragmentSelector {
  type: 'FragmentSelector';
  value: string;               // 片段标识符
  conformsTo?: string;         // 符合的规范
}

/**
 * 文本位置信息
 * Text Position
 */
export interface TextPosition {
  startOffset: number;         // 起始偏移
  endOffset: number;           // 结束偏移
  context?: string;            // 上下文文本
  lineNumber?: number;         // 行号
  columnNumber?: number;       // 列号
}

/**
 * 作者信息
 * Author Information
 */
export interface AuthorInfo {
  id: string;                  // 用户唯一标识
  name: string;                // 显示名称
  email?: string;              // 邮箱地址
  avatar?: string;             // 头像URL
  platform?: PlatformType;     // 所属平台
  isAuthoritative?: boolean;    // 是否为权威作者
  profile?: UserProfile;       // 用户详细信息
}

/**
 * 标注转换器接口
 * Annotation Converter Interface
 */
export interface AnnotationConverter<T = any> {
  platform: PlatformType;
  fromPlatform(platformAnnotation: T, context?: any): Promise<UniversalAnnotation>;
  toPlatform(universalAnnotation: UniversalAnnotation): Promise<T>;
  validate(annotation: unknown): annotation is T;
}

/**
 * 用户资料
 * User Profile
 */
export interface UserProfile {
  organization?: string;       // 所属机构
  department?: string;         // 部门
  title?: string;              // 职位/头衔
  researchInterests?: string[]; // 研究兴趣
  orcid?: string;              // ORCID标识符
  website?: string;            // 个人网站
}

/**
 * 分享权限
 * Sharing Permissions
 */
export interface SharingPermissions {
  canEdit: boolean;            // 是否可编辑
  canDelete: boolean;          // 是否可删除
  canShare: boolean;           // 是否可分享
  canComment: boolean;         // 是否可评论
  canDownload: boolean;        // 是否可下载
  expirationDate?: string;     // 过期时间
  maxViews?: number;           // 最大查看次数
}

/**
 * 访问控制
 * Access Control
 */
export interface AccessControl {
  visibility: VisibilityLevel;
  permissions: {
    read: string[];            // 可读用户ID列表
    write: string[];           // 可写用户ID列表
    admin: string[];           // 管理员用户ID列表
  };
  organization?: {
    id: string;
    role: 'member' | 'admin' | 'owner';
    department?: string;
  };
  expiration?: {
    date: string;              // 过期日期
    action: 'hide' | 'readonly' | 'delete'; // 过期后的操作
  };
}

/**
 * Zotero标注格式
 * Zotero Annotation Format
 */
export interface ZoteroAnnotation {
  id: string;
  type: string;
  color?: string;
  sortIndex: string;
  pageLabel?: string;
  position: any;               // 可以是PDFPosition或Selector
  text?: string;
  comment?: string;
  tags: string[];
  dateCreated: string;
  dateModified: string;
  authorName: string;
  isAuthorNameAuthoritative: boolean;
  readOnly?: boolean;
}

/**
 * Mendeley标注格式（示例）
 * Mendeley Annotation Format (Example)
 */
export interface MendeleyAnnotation {
  uuid: string;
  type: string;
  documentId: string;
  positions: any[];
  created: string;
  last_modified: string;
  text?: string;
  note?: string;
  color?: {
    hex: string;
    r: number;
    g: number;
    b: number;
  };
  profile_id: string;
  author?: {
    first_name: string;
    last_name: string;
  };
  privacy_level: 'private' | 'group' | 'public';
}

/**
 * API响应格式
 * API Response Format
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    version?: string;
  };
}

/**
 * 批量操作结果
 * Batch Operation Result
 */
export interface BatchResult {
  results: Array<{
    id: string;
    success: boolean;
    error?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

/**
 * WebSocket消息类型
 * WebSocket Message Types
 */
export type WebSocketMessage = 
  | AnnotationCreatedMessage
  | AnnotationUpdatedMessage
  | AnnotationDeletedMessage
  | UserConnectedMessage
  | UserDisconnectedMessage
  | CursorMovedMessage;

export interface AnnotationCreatedMessage {
  type: 'annotation:created';
  payload: {
    annotation: UniversalAnnotation;
    documentId: string;
  };
}

export interface AnnotationUpdatedMessage {
  type: 'annotation:updated';
  payload: {
    annotation: UniversalAnnotation;
    changes: Partial<UniversalAnnotation>;
  };
}

export interface AnnotationDeletedMessage {
  type: 'annotation:deleted';
  payload: {
    id: string;
    documentId: string;
  };
}

export interface UserConnectedMessage {
  type: 'user:connected';
  payload: {
    user: AuthorInfo;
    documentId: string;
  };
}

export interface UserDisconnectedMessage {
  type: 'user:disconnected';
  payload: {
    user: AuthorInfo;
    documentId: string;
  };
}

export interface CursorMovedMessage {
  type: 'cursor:moved';
  payload: {
    user: AuthorInfo;
    position: PositionInfo;
    documentId: string;
  };
}

/**
 * 同步配置
 * Sync Configuration
 */
export interface SyncConfig {
  conflictResolution: 'last-write-wins' | 'manual-merge' | 'version-branch';
  syncInterval: number;        // 毫秒
  offlineStrategy: 'cache-all' | 'cache-recent' | 'no-cache';
  deltaSync: boolean;          // 是否使用增量同步
  compression: boolean;        // 是否压缩数据
  maxRetries: number;          // 最大重试次数
  retryDelay: number;          // 重试延迟（毫秒）
}

/**
 * 平台连接配置
 * Platform Connection Configuration
 */
export interface PlatformConnection {
  platform: PlatformType;
  connected: boolean;
  lastSyncAt?: string;
  credentials?: Record<string, unknown>;
  syncConfig?: SyncConfig;
  errorCount?: number;
  lastError?: string;
}