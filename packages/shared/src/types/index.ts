/**
 * 核心数据类型 - 三端共享
 * 统一网站、Zotero插件、浏览器扩展的类型定义
 */

// ========== 论文相关 ==========

export interface Paper {
  id: string;
  doi: string;
  title: string;
  abstract?: string;
  authors?: string[];
  journal?: string;
  year?: number;
  pdf_url?: string;
  keywords?: string[];
  publication_date?: string;
  view_count?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ========== 标注相关 ==========

export interface AnnotationPosition {
  pageIndex: number;
  rects: number[][]; // [[x1, y1, x2, y2], ...]
}

export interface Annotation {
  id: string;
  paper_id: string;
  user_id: string;
  session_id?: string;
  content: string;
  comment?: string;
  color: string;
  type: 'highlight' | 'underline' | 'note' | 'image';
  position: AnnotationPosition;
  show_author_name?: boolean;
  quality_score?: number;
  created_at: string;
  updated_at?: string;
}

// 带用户信息的标注（用于显示）
export interface AnnotationWithUser extends Annotation {
  username?: string;
  users?: {
    username: string;
    avatar_url: string | null;
  };
}

// ========== 用户相关 ==========

export interface User {
  id: string;
  email: string;
  username: string;
  avatar_url?: string;
  bio?: string;
  role: 'user' | 'admin';
  created_at: string;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  bio?: string;
  avatar_url?: string;
  institution?: string;
  website?: string;
  created_at: string;
}

// ========== 阅读会话相关 ==========

export interface ReadingSession {
  id: string;
  paper_id: string;
  title: string;
  description?: string;
  creator_id: string;
  is_public: boolean;
  member_count?: number;
  annotation_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SessionMember {
  session_id: string;
  user_id: string;
  role: 'creator' | 'member';
  joined_at: string;
}

// ========== 评分和评论 ==========

export interface Rating {
  id: string;
  paper_id: string;
  user_id: string;
  overall_score: number;
  novelty_score?: number;
  methodology_score?: number;
  clarity_score?: number;
  significance_score?: number;
  comment?: string;
  created_at: string;
  updated_at?: string;
}

export interface Comment {
  id: string;
  paper_id: string;
  user_id: string;
  content: string;
  parent_id?: string;
  created_at: string;
  updated_at?: string;
}

// ========== 跨端通信协议 ==========

export interface CrossPlatformMessage {
  type: string;
  source: 'website' | 'zotero-plugin' | 'browser-extension';
  timestamp: number;
  data: any;
}

export interface AuthMessage extends CrossPlatformMessage {
  type: 'AUTH_STATUS' | 'AUTH_STATUS_RESPONSE' | 'AUTH_LOGIN' | 'AUTH_LOGOUT';
  data: {
    authenticated: boolean;
    user?: {
      id: string;
      name: string;
      email: string;
      username: string;
    };
    token?: string;
  };
}

export interface AnnotationSyncMessage extends CrossPlatformMessage {
  type: 'ANNOTATION_SYNC' | 'ANNOTATION_UPDATE' | 'ANNOTATION_DELETE';
  data: {
    sessionId: string;
    annotations: Annotation[];
  };
}

// ========== 数据库查询结果类型 ==========

export interface PaperWithStats extends Paper {
  averageRating: number;
  commentCount: number;
  favoriteCount: number;
}

export interface SessionWithDetails extends ReadingSession {
  paper?: Paper;
  creator?: {
    username: string;
    avatar_url?: string;
  };
  members?: SessionMember[];
}
