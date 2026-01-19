/**
 * DOM Related Type Definitions
 * For UI components and page elements
 */

// ============================================================================
// Page Information
// ============================================================================

export interface PageInfo {
  url: string;
  title: string;
  type?: 'webpage' | 'paper' | 'book' | 'video';
  doi?: string | null;
  normalizedUrl?: string;
  urlHash?: string;
}

// ============================================================================
// Toast Types
// ============================================================================

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  position?: 'top' | 'bottom' | 'center';
}

// ============================================================================
// Floating Icon Types
// ============================================================================

export interface FloatingIconState {
  isVisible: boolean;
  isDragging: boolean;
  hasDOI: boolean;
  position: IconPosition;
}

export interface IconPosition {
  x: number;
  y: number;
  side?: 'left' | 'right';
}

export interface DragOffset {
  x: number;
  y: number;
}

// ============================================================================
// Tab Types
// ============================================================================

export type TabId = 'rating' | 'ai-summary' | 'knowledge' | 'doi' | 'settings';

export interface Tab {
  id: TabId;
  label: string;
  icon?: string;
  isActive: boolean;
}

// ============================================================================
// Rating UI Types
// ============================================================================

export interface RatingDimension {
  id: string;
  label: string;
  description: string;
  value: number;
}

export interface RatingFormData {
  dimension1: number;
  dimension2: number;
  dimension3: number;
  overall: number;
}

// ============================================================================
// Comment UI Types
// ============================================================================

export interface CommentFormData {
  content: string;
  parentId?: string;
  isAnonymous: boolean;
}

export interface CommentDisplayData {
  id: string;
  content: string;
  author: string;
  authorEmail?: string;
  timestamp: string;
  likesCount: number;
  isAnonymous: boolean;
  canEdit: boolean;
  canDelete: boolean;
  replies?: CommentDisplayData[];
}

// ============================================================================
// Knowledge Panel Types
// ============================================================================

export type KnowledgeType = 'webpage' | 'paper' | 'book' | 'video' | 'note';
export type Visibility = 'public' | 'private' | 'unlisted';

export interface KnowledgeFormData {
  type: KnowledgeType;
  title: string;
  url: string;
  doi?: string;
  tags: string[];
  visibility: Visibility;
  notes?: string;
}

// ============================================================================
// DOM Element Types
// ============================================================================

export interface ElementIds {
  // Popup
  floatingToggle: 'floatingToggle';
  doiDisplay: 'doi-display';
  copyDoi: 'copy-doi';
  openSidebar: 'openSidebar';
  toast: 'toast';
  
  // Sidebar
  ratingContainer: 'rating-container';
  commentsContainer: 'comments-container';
  settingsPanel: 'settings-panel';
  
  // Floating Icon
  floatingIcon: 'researchopia-floating-icon';
}

// ============================================================================
// Event Types
// ============================================================================

export interface CustomEventMap {
  'doi-detected': CustomEvent<{ doi: string }>;
  'rating-submitted': CustomEvent<{ rating: RatingFormData }>;
  'comment-submitted': CustomEvent<{ comment: CommentFormData }>;
  'panel-toggled': CustomEvent<{ isOpen: boolean }>;
}
