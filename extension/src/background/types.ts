/**
 * Background Module Types
 */

export interface MessageRequest {
  action: string;
  doi?: string;
  url?: string;
  tabId?: number;
  isOpen?: boolean;
  settings?: Record<string, unknown>;
}

export interface MessageResponse {
  success: boolean;
  error?: string;
  settings?: Record<string, unknown>;
  message?: string;
  // Auth fields
  token?: string;
  userId?: string;
  email?: string;
}

export interface PanelState {
  tabId: number;
  isOpen: boolean;
}

export interface DOIContext {
  doi: string;
  url?: string;
  timestamp: number;
}
