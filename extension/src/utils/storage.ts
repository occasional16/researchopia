/**
 * Chrome Storage Utility Functions
 * Simplified storage access with type safety
 */

import type { 
  SyncStorageData, 
  LocalStorageData, 
  IconPosition,
  AuthStorageData 
} from '../types/storage';

// ============================================================================
// Sync Storage
// ============================================================================

/**
 * Get data from chrome.storage.sync
 */
export async function getSyncStorage<K extends keyof SyncStorageData>(
  keys: K | K[]
): Promise<Pick<SyncStorageData, K>> {
  const keyArray = Array.isArray(keys) ? keys : [keys];
  return chrome.storage.sync.get(keyArray) as Promise<Pick<SyncStorageData, K>>;
}

/**
 * Set data in chrome.storage.sync
 */
export async function setSyncStorage(data: Partial<SyncStorageData>): Promise<void> {
  return chrome.storage.sync.set(data);
}

/**
 * Remove data from chrome.storage.sync
 */
export async function removeSyncStorage(keys: keyof SyncStorageData | (keyof SyncStorageData)[]): Promise<void> {
  return chrome.storage.sync.remove(keys as string | string[]);
}

// ============================================================================
// Local Storage
// ============================================================================

/**
 * Get data from chrome.storage.local
 */
export async function getLocalStorage<K extends keyof LocalStorageData>(
  keys: K | K[]
): Promise<Pick<LocalStorageData, K>> {
  const keyArray = Array.isArray(keys) ? keys : [keys];
  return chrome.storage.local.get(keyArray) as Promise<Pick<LocalStorageData, K>>;
}

/**
 * Set data in chrome.storage.local
 */
export async function setLocalStorage(data: Partial<LocalStorageData>): Promise<void> {
  return chrome.storage.local.set(data);
}

// ============================================================================
// Session Storage (with fallback)
// ============================================================================

/**
 * Get session/local storage store
 */
function getSessionStore() {
  return chrome.storage.session || chrome.storage.local;
}

/**
 * Get panel state for a tab
 */
export async function getPanelState(tabId: number): Promise<boolean> {
  const store = getSessionStore();
  const key = `panelOpen_${tabId}`;
  const result = await store.get([key]);
  return result[key] === true;
}

/**
 * Set panel state for a tab
 */
export async function setPanelState(tabId: number, isOpen: boolean): Promise<void> {
  const store = getSessionStore();
  const key = `panelOpen_${tabId}`;
  await store.set({ [key]: isOpen });
}

// ============================================================================
// Specialized Getters
// ============================================================================

/**
 * Get extension settings
 */
export async function getSettings(): Promise<{
  floatingEnabled: boolean;
  researchopiaUrl: string;
  autoDetectDOI: boolean;
  sidebarWidth: number;
}> {
  const result = await getSyncStorage([
    'floatingEnabled',
    'researchopiaUrl',
    'autoDetectDOI',
    'sidebarWidth'
  ]);
  
  return {
    floatingEnabled: result.floatingEnabled !== false,
    researchopiaUrl: result.researchopiaUrl || 'https://www.researchopia.com',
    autoDetectDOI: result.autoDetectDOI !== false,
    sidebarWidth: result.sidebarWidth || 400,
  };
}

/**
 * Save extension settings
 */
export async function saveSettings(settings: {
  floatingEnabled?: boolean;
  researchopiaUrl?: string;
  autoDetectDOI?: boolean;
  sidebarWidth?: number;
}): Promise<void> {
  await setSyncStorage(settings as Partial<SyncStorageData>);
}

/**
 * Get auth data
 */
export async function getAuthData(): Promise<AuthStorageData> {
  const result = await getSyncStorage(['authToken', 'userId', 'userEmail', 'tokenExpiry']);
  
  return {
    authToken: result.authToken || null,
    userId: result.userId || null,
    userEmail: result.userEmail || null,
    tokenExpiry: result.tokenExpiry || null,
  };
}

/**
 * Set auth data
 */
export async function setAuthData(data: Partial<AuthStorageData>): Promise<void> {
  await setSyncStorage(data as Partial<SyncStorageData>);
}

/**
 * Clear auth data
 */
export async function clearAuthData(): Promise<void> {
  await removeSyncStorage(['authToken', 'userId', 'userEmail', 'tokenExpiry']);
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const { authToken, tokenExpiry } = await getAuthData();
  
  if (!authToken) return false;
  if (tokenExpiry && Date.now() > tokenExpiry) return false;
  
  return true;
}

/**
 * Get icon position
 */
export async function getIconPosition(): Promise<IconPosition | null> {
  const result = await getSyncStorage('iconPosition');
  return result.iconPosition || null;
}

/**
 * Save icon position
 */
export async function saveIconPosition(position: IconPosition): Promise<void> {
  await setSyncStorage({ iconPosition: position });
}

/**
 * Get DOI from content script
 */
export async function getStoredDOI(): Promise<{
  doi: string | null;
  url: string | null;
  timestamp: number | null;
}> {
  const result = await getSyncStorage(['doiFromContentScript', 'currentPageUrl', 'lastClickTime']);
  
  return {
    doi: result.doiFromContentScript || null,
    url: result.currentPageUrl || null,
    timestamp: result.lastClickTime || null,
  };
}

/**
 * Store DOI information
 */
export async function storeDOI(doi: string, url: string): Promise<void> {
  await setSyncStorage({
    doiFromContentScript: doi,
    currentPageUrl: url,
    lastClickTime: Date.now(),
  });
}

/**
 * Get active tab for sidebar
 */
export async function getSidebarActiveTab(): Promise<'rating' | 'ai-summary'> {
  const result = await getSyncStorage('sidebarActiveTab');
  return result.sidebarActiveTab || 'rating';
}

/**
 * Save active tab for sidebar
 */
export async function saveSidebarActiveTab(tab: 'rating' | 'ai-summary'): Promise<void> {
  await setSyncStorage({ sidebarActiveTab: tab });
}
