/**
 * Chrome Storage Type Definitions
 * For sync, local, and session storage
 */

// ============================================================================
// Storage Keys
// ============================================================================

export type SyncStorageKey =
  | 'floatingEnabled'
  | 'researchopiaUrl'
  | 'autoDetectDOI'
  | 'sidebarWidth'
  | 'authToken'
  | 'userId'
  | 'userEmail'
  | 'userName'
  | 'tokenExpiry'
  | 'iconPosition'
  | 'doiFromContentScript'
  | 'currentPageUrl'
  | 'lastClickTime'
  | 'sidebarActiveTab';

export type LocalStorageKey =
  | 'authToken'
  | 'userId'
  | 'cachedRatings'
  | 'cachedComments';

// ============================================================================
// Storage Data Types
// ============================================================================

export interface IconPosition {
  left: string;
  right: string;
  top: string;
  timestamp?: number;
}

export interface SyncStorageData {
  floatingEnabled?: boolean;
  researchopiaUrl?: string;
  autoDetectDOI?: boolean;
  sidebarWidth?: number;
  authToken?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  tokenExpiry?: number;
  iconPosition?: IconPosition;
  doiFromContentScript?: string;
  currentPageUrl?: string;
  lastClickTime?: number;
  sidebarActiveTab?: 'rating' | 'ai-summary';
  devMode?: boolean;
}

export interface LocalStorageData {
  authToken?: string;
  userId?: string;
  cachedRatings?: Record<string, unknown>;
  cachedComments?: Record<string, unknown>;
}

export interface SessionStorageData {
  [key: `panelOpen_${number}`]: boolean;
}

// ============================================================================
// Auth Storage Types
// ============================================================================

export interface AuthStorageData {
  authToken: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  tokenExpiry: number | null;
}

// ============================================================================
// Storage Helper Functions Types
// ============================================================================

export interface StorageResult<T> {
  data: T | null;
  error: Error | null;
}
