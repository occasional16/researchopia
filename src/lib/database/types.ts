/**
 * 数据库类型定义
 */

export interface Paper {
  id: number;
  doi: string;
  title: string;
  authors?: string[];
  abstract?: string;
  keywords?: string[];
  publication_date?: string;
  journal?: string;
  url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SharedAnnotation {
  id: string;
  paper_id: number;
  user_id: string;
  content: string;
  color?: string;
  page_number?: number;
  position?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface ReadingSession {
  id: string;
  paper_id: number;
  host_user_id: string;
  title?: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}
