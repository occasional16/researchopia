/**
 * Quick Bookmark Module
 * Handles keyboard shortcut bookmarking functionality
 */

interface QuickBookmarkResult {
  success: boolean;
  message: string;
  folderId?: string;
  folderName?: string;
}

/**
 * Get the Researchopia URL from storage based on devMode setting
 */
async function getResearchopiaUrl(): Promise<string> {
  const storage = await chrome.storage.sync.get(['devMode']) as { devMode?: boolean };
  // Use localhost in dev mode, otherwise production
  return storage.devMode ? 'http://localhost:3000' : 'https://www.researchopia.com';
}

/**
 * Get the auth token from storage
 */
async function getAuthToken(): Promise<string | null> {
  const storage = await chrome.storage.sync.get(['authToken']) as { authToken?: string };
  return storage.authToken || null;
}

/**
 * Get the last used folder ID from storage
 * Returns null for uncategorized folder, undefined if never saved
 */
async function getLastFolderId(): Promise<string | null | undefined> {
  const storage = await chrome.storage.local.get(['lastFolderId']) as { lastFolderId?: string };
  
  if (storage.lastFolderId === undefined) {
    // Never saved before - return undefined to indicate "no preference"
    return undefined;
  }
  
  // Convert special marker back to null for uncategorized folder
  if (storage.lastFolderId === '__uncategorized__') {
    return null;
  }
  
  return storage.lastFolderId;
}

/**
 * Check if quick bookmark feature is enabled
 */
async function isQuickBookmarkEnabled(): Promise<boolean> {
  const { quickBookmarkEnabled } = await chrome.storage.sync.get('quickBookmarkEnabled');
  // Default to true if not set
  return quickBookmarkEnabled !== false;
}

/**
 * Quick bookmark the current tab
 * Uses the last selected folder, or saves to uncategorized if none
 */
export async function quickBookmarkCurrentTab(): Promise<QuickBookmarkResult> {
  try {
    // Check if feature is enabled
    if (!(await isQuickBookmarkEnabled())) {
      return {
        success: false,
        message: '快捷键收藏已禁用，请在设置中启用'
      };
    }
    
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url) {
      return {
        success: false,
        message: '无法获取当前页面信息'
      };
    }
    
    // Get auth token
    const token = await getAuthToken();
    if (!token) {
      return {
        success: false,
        message: '请先登录'
      };
    }
    
    const researchopiaUrl = await getResearchopiaUrl();
    const lastFolderId = await getLastFolderId();
    
    // Save bookmark - use null for folder_id if uncategorized or never saved
    const folderIdToSave = lastFolderId === undefined ? null : lastFolderId;
    
    // Save bookmark
    const response = await fetch(`${researchopiaUrl}/api/bookmarks/items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: tab.url,
        title: tab.title || 'Untitled',
        folder_id: folderIdToSave,
        note: undefined
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        message: data.error || '收藏失败'
      };
    }
    
    // Show success notification
    // lastFolderId === null means user explicitly chose uncategorized
    // lastFolderId === undefined means never saved before (also goes to uncategorized)
    const message = lastFolderId !== undefined && lastFolderId !== null 
      ? '已收藏到上次使用的文件夹' 
      : '已收藏到未分类';
    
    return {
      success: true,
      message,
      folderId: lastFolderId ?? undefined
    };
    
  } catch (error) {
    console.error('[QuickBookmark] Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '收藏失败'
    };
  }
}

/**
 * Show a notification badge on the extension icon
 */
export async function showBadgeNotification(success: boolean, tabId?: number): Promise<void> {
  const badgeText = success ? '✓' : '✕';
  const badgeColor = success ? '#22c55e' : '#ef4444';
  
  if (tabId) {
    await chrome.action.setBadgeText({ text: badgeText, tabId });
    await chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId });
    
    // Clear badge after 2 seconds
    setTimeout(async () => {
      try {
        await chrome.action.setBadgeText({ text: '', tabId });
      } catch {
        // Tab might be closed
      }
    }, 2000);
  }
}
