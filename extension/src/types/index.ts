/**
 * Shared type definitions for the browser extension
 * Re-exports all types from specialized modules
 */

// Re-export all types from specialized modules
export * from './api';
export * from './storage';
export * from './dom';

// ============================================================================
// Legacy Types (for backward compatibility)
// ============================================================================

// Settings Types
export interface SidebarSettings {
  serverUrl: string;
  autoOpen: boolean;
  darkMode: boolean;
  devMode: boolean; // Simple toggle for dev/prod server
  floatingEnabled: boolean; // Show floating icon on pages
  quickBookmarkEnabled: boolean; // Enable Ctrl+Shift+B quick bookmark shortcut
  autoClosePopup: boolean; // Auto-close popup after successful save
}

export const DEFAULT_SETTINGS: SidebarSettings = {
  serverUrl: 'https://www.researchopia.com',
  autoOpen: false,
  darkMode: false,
  devMode: false, // Set to true for development testing
  floatingEnabled: true, // Default to show floating icon
  quickBookmarkEnabled: true, // Default to enable quick bookmark
  autoClosePopup: true, // Default to auto-close popup
};

// ============================================================================
// Rating Types
// ============================================================================

export interface Ratings {
  quality: number;
  usefulness: number;
  accuracy: number;
  overall: number;
}

export const DEFAULT_RATINGS: Ratings = {
  quality: 0,
  usefulness: 0,
  accuracy: 0,
  overall: 0,
};

// ============================================================================
// Comment Types (extended from evaluation-api)
// ============================================================================

export interface SidebarComment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  parentId?: string;
  likesCount: number;
  isAnonymous: boolean;
  hasLiked?: boolean; // Whether current user has liked this comment
  children?: SidebarComment[]; // Nested replies
  // snake_case variants from API responses
  user_email?: string;
  user_id?: string;
  parent_id?: string;
  created_at?: string;
  likes_count?: number;
  has_liked?: boolean;
  is_anonymous?: boolean;
  // User info
  user?: {
    username?: string;
    email?: string;
    avatarUrl?: string;
    avatar_url?: string;
  };
}

// ============================================================================
// Auth Types
// ============================================================================

export interface AuthState {
  accessToken: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;  // From users.username table
  isLoggedIn: boolean;
}

export interface AuthMessage {
  action?: string;
  token?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface RatingItem {
  id: string;
  dimension1?: number | null;
  dimension2?: number | null;
  dimension3?: number | null;
  overallScore: number;
  isAnonymous: boolean;
  showUsername?: boolean;
  createdAt: string;
  user?: {
    id: string;
    username: string | null;
    avatarUrl: string | null;
  };
}

export interface RatingsResponse {
  stats?: {
    count: number;
    average: {
      dimension1?: number;
      dimension2?: number;
      dimension3?: number;
      overall: number;
    };
  };
  ratings?: RatingItem[];
  userRating?: {
    id: string;
    dimension1?: number;
    dimension2?: number;
    dimension3?: number;
    overallScore: number;
  };
}

export interface CommentsResponse {
  comments?: SidebarComment[];
  hasMore?: boolean;
  total?: number;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface StorageSettings {
  serverUrl?: string;
  autoOpen?: boolean;
  darkMode?: boolean;
  devMode?: boolean;
  floatingEnabled?: boolean;
  quickBookmarkEnabled?: boolean;
  autoClosePopup?: boolean;
}

export interface StorageAuth {
  authToken?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
}
