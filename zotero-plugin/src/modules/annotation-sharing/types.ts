/**
 * 标注共享模块 - 类型定义
 * 
 * 此文件包含标注共享功能的所有共享类型定义，
 * 避免在多个文件中重复定义相同的类型。
 */

/**
 * 共享模式类型
 * - 'public': 公开共享，显示真实用户名
 * - 'anonymous': 匿名共享，显示"匿名用户"
 * - 'private': 私密共享，仅自己可见
 * - null: 取消共享，仅本地保存
 */
export type ShareMode = 'public' | 'anonymous' | 'private' | null;

/**
 * 共享模式按钮配置
 */
export interface ShareModeButton {
  id: ShareMode;
  label: string;
  icon: string;
  color: string;
  title: string;
}

/**
 * 共享标注信息缓存条目
 */
export interface SharedAnnotationCacheEntry {
  likes: any[];
  comments: any[];
  cachedAt: number;
}

/**
 * 共享标注数据
 */
export interface SharedAnnotation {
  id: string;
  annotation_key: string;
  document_id: string;
  user_id: string;
  visibility: 'public' | 'private';
  show_author_name: boolean;
  annotation_text: string;
  annotation_comment?: string;
  annotation_color?: string;
  annotation_type: string;
  page_index?: number;
  position_data?: any;
  created_at: string;
  updated_at: string;
  // 扩展字段
  likes_count?: number;
  comments_count?: number;
  user?: {
    id: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

/**
 * 点赞数据
 */
export interface AnnotationLike {
  id: string;
  annotation_id: string;
  user_id: string;
  created_at: string;
}

/**
 * 评论数据
 */
export interface AnnotationComment {
  id: string;
  annotation_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

/**
 * API 响应结构
 */
export interface AnnotationApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
