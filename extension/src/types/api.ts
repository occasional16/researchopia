/**
 * API Related Type Definitions
 * For HTTP requests, responses, and messaging
 */

// ============================================================================
// Message Types (Chrome Extension Messaging)
// ============================================================================

export type MessageAction =
  | 'toggleSidePanel'
  | 'openSidePanel'
  | 'floatingIconClicked'
  | 'triggerSidePanelFromFloating'
  | 'openSidebar'
  | 'getSettings'
  | 'updateSettings'
  | 'detectDOI'
  | 'updatePanelState'
  | 'getCurrentDOI'
  | 'toggleFloating'
  | 'toggleFloatingIcon'
  | 'panelClosed'
  | 'saveKnowledgeUnit'
  | 'log';

export interface MessageRequest {
  action: MessageAction;
  doi?: string | null;
  url?: string;
  tabId?: number;
  isOpen?: boolean;
  enabled?: boolean;
  settings?: Record<string, unknown>;
  data?: KnowledgeUnitData;
  message?: string;
}

export interface MessageResponse {
  success: boolean;
  error?: string;
  doi?: string | null;
  settings?: ExtensionSettings;
  message?: string;
  token?: string;
  userId?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status?: number;
}

export interface RatingSubmission {
  url_hash: string;
  normalized_url: string;
  doi?: string;
  dimension1: number;
  dimension2: number;
  dimension3: number;
  overall_score: number;
}

export interface CommentSubmission {
  url_hash: string;
  normalized_url: string;
  content: string;
  parent_id?: string;
  is_anonymous?: boolean;
}

export interface KnowledgeUnitData {
  type: string;
  url: string;
  title: string;
  visibility?: string;
  doi?: string;
  metadata?: {
    doi?: string | null;
    savedAt?: string;
    source?: string;
  };
}

// ============================================================================
// Settings Types
// ============================================================================

export interface ExtensionSettings {
  floatingEnabled: boolean;
  researchopiaUrl: string;
  autoDetectDOI: boolean;
  sidebarWidth: number;
}

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  floatingEnabled: true,
  researchopiaUrl: 'https://www.researchopia.com',
  autoDetectDOI: true,
  sidebarWidth: 400,
};

// ============================================================================
// Evaluation API Types (from lib/evaluation-api.ts)
// ============================================================================

export interface EvaluationStats {
  count: number;
  average: {
    dimension1?: number;
    dimension2?: number;
    dimension3?: number;
    overall: number;
  };
}

export interface UserRating {
  id: string;
  dimension1?: number;
  dimension2?: number;
  dimension3?: number;
  overallScore: number;
}

export interface RatingsApiResponse {
  stats?: EvaluationStats;
  userRating?: UserRating;
}

export interface Comment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  parentId?: string;
  likesCount: number;
  isAnonymous: boolean;
  user_email?: string;
  user_id?: string;
  parent_id?: string;
  created_at?: string;
  user?: {
    username?: string;
    email?: string;
    avatarUrl?: string;
  };
}

export interface CommentsApiResponse {
  comments?: Comment[];
  hasMore?: boolean;
  total?: number;
}

// ============================================================================
// HTTP Helper Types
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}
