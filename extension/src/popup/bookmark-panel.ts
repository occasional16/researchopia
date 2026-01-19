/**
 * Bookmark Panel Module
 * Handles bookmarking current page functionality
 */

import { showToast } from '../utils/toast';
import { getSyncStorage } from '../utils/storage';

export interface BookmarkFolder {
  id: string;
  name: string;
  parent_id: string | null;
  visibility: string;
  children?: BookmarkFolder[];
  item_count?: number;
}

export interface BookmarkInfo {
  id: string;
  custom_title: string | null;
  note: string | null;
  folder_id: string | null;
  created_at: string;
  folder: { id: string; name: string } | null;
}

export interface BookmarkPanelState {
  pageUrl: string;
  pageTitle: string;
  isLoggedIn: boolean;
  isSaving: boolean;
  isLoading: boolean;
  folders: BookmarkFolder[];
  selectedFolderId: string | null;
  customTitle: string;
  originalTitle: string;  // Track original title to detect changes
  note: string;
  isBookmarked: boolean;
  existingBookmarks: BookmarkInfo[];
}

export class BookmarkPanel {
  private state: BookmarkPanelState = {
    pageUrl: '',
    pageTitle: '',
    isLoggedIn: false,
    isSaving: false,
    isLoading: false,
    folders: [],
    selectedFolderId: null,
    customTitle: '',
    originalTitle: '',
    note: '',
    isBookmarked: false,
    existingBookmarks: [],
  };
  private researchopiaUrl: string = 'https://www.researchopia.com';

  constructor(researchopiaUrl?: string) {
    if (researchopiaUrl) {
      this.researchopiaUrl = researchopiaUrl;
    }
  }

  /**
   * Initialize the bookmark panel
   */
  async init(tab: chrome.tabs.Tab | null, isLoggedIn: boolean): Promise<void> {
    this.state.isLoggedIn = isLoggedIn;
    this.loadPageInfo(tab);
    this.setupEventListeners();
    
    if (isLoggedIn) {
      // Load folders and check if already bookmarked in parallel
      await Promise.all([
        this.loadFolders(),
        this.checkIfBookmarked()
      ]);
      
      // After both are loaded, update button state based on selected folder
      this.updateSaveButtonState();
    }
    
    this.updateUI();
  }

  /**
   * Update researchopia URL (for dev mode)
   */
  setResearchopiaUrl(url: string): void {
    this.researchopiaUrl = url;
  }

  /**
   * Load page information from tab
   */
  loadPageInfo(tab: chrome.tabs.Tab | null): void {
    if (!tab) return;
    this.state.pageUrl = tab.url || '';
    this.state.pageTitle = tab.title || 'Untitled';
    this.state.customTitle = this.state.pageTitle;
    this.state.originalTitle = this.state.pageTitle;
    
    // Update UI
    const titleInput = document.getElementById('customTitleInput') as HTMLInputElement;
    if (titleInput) {
      titleInput.value = this.state.pageTitle;
    }
  }

  /**
   * Check if current folder already has this bookmark
   */
  private isCurrentFolderBookmarked(): boolean {
    if (!this.state.isBookmarked || this.state.existingBookmarks.length === 0) {
      return false;
    }
    
    const currentFolderId = this.state.selectedFolderId;
    return this.state.existingBookmarks.some(b => {
      // Handle both null and undefined for uncategorized bookmarks
      const bookmarkFolderId = b.folder_id || null;
      return bookmarkFolderId === currentFolderId;
    });
  }

  /**
   * Check if title has been modified from original
   */
  private isTitleModified(): boolean {
    return this.state.customTitle !== this.state.originalTitle;
  }

  /**
   * Get the existing bookmark in current folder (if any)
   */
  private getExistingBookmarkInCurrentFolder(): BookmarkInfo | undefined {
    const currentFolderId = this.state.selectedFolderId;
    return this.state.existingBookmarks.find(b => {
      const bookmarkFolderId = b.folder_id || null;
      return bookmarkFolderId === currentFolderId;
    });
  }

  /**
   * Check if current URL is already bookmarked
   */
  async checkIfBookmarked(): Promise<void> {
    if (!this.state.pageUrl) {
      console.log('[BookmarkPanel] No page URL, skipping bookmark check');
      return;
    }

    try {
      const storage = await getSyncStorage(['authToken']);
      const token = storage.authToken;
      
      if (!token) {
        console.log('[BookmarkPanel] No auth token, skipping bookmark check');
        return;
      }

      console.log('[BookmarkPanel] Checking bookmark status for:', this.state.pageUrl);
      const response = await fetch(
        `${this.researchopiaUrl}/api/bookmarks/items/check?url=${encodeURIComponent(this.state.pageUrl)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          cache: 'no-store'  // Prevent browser caching
        }
      );

      if (!response.ok) {
        console.error('[BookmarkPanel] Check bookmark API failed:', response.status);
        return;
      }

      const data = await response.json();
      console.log('[BookmarkPanel] Bookmark check result:', data);
      
      if (data.success) {
        this.state.isBookmarked = data.isBookmarked;
        this.state.existingBookmarks = data.bookmarks || [];
        console.log('[BookmarkPanel] isBookmarked:', this.state.isBookmarked, 'bookmarks:', this.state.existingBookmarks.length);
        this.updateBookmarkStatus();
      }
    } catch (error) {
      console.error('Error checking bookmark status:', error);
    }
  }

  /**
   * Load user's bookmark folders
   */
  async loadFolders(): Promise<void> {
    this.state.isLoading = true;
    this.updateLoadingState();
    
    try {
      // Use 'authToken' from sync storage (where AuthManager stores it)
      const storage = await getSyncStorage(['authToken']);
      const token = storage.authToken;
      
      if (!token) {
        console.warn('No access token found');
        return;
      }

      const response = await fetch(`${this.researchopiaUrl}/api/bookmarks/folders`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load folders');
      }

      const data = await response.json();
      if (data.success) {
        this.state.folders = data.folders || [];
        this.renderFolderSelect();
      }
    } catch (error) {
      console.error('Error loading folders:', error);
      showToast('加载文件夹失败', 'error');
    } finally {
      this.state.isLoading = false;
      this.updateLoadingState();
    }
  }

  /**
   * Render folder select dropdown
   */
  private async renderFolderSelect(): Promise<void> {
    const selectEl = document.getElementById('folderSelect') as HTMLSelectElement;
    if (!selectEl) return;

    // Clear existing options except the first (uncategorized)
    selectEl.innerHTML = '<option value="">📁 未分类</option>';

    // Add folders recursively with visual hierarchy
    const addFolderOptions = (folders: BookmarkFolder[], depth: number = 0) => {
      for (const folder of folders) {
        const option = document.createElement('option');
        option.value = folder.id;
        // Use indentation with spaces for hierarchy (2 spaces per level)
        // Deeper levels get a corner connector for visual clarity
        let prefix = '';
        if (depth > 0) {
          // Use em-space for proper indentation in dropdown
          prefix = '\u2003'.repeat(depth) + '└ ';
        }
        const icon = depth === 0 ? '📁' : '📂';
        option.textContent = prefix + icon + ' ' + folder.name;
        selectEl.appendChild(option);

        if (folder.children && folder.children.length > 0) {
          addFolderOptions(folder.children, depth + 1);
        }
      }
    };

    addFolderOptions(this.state.folders);
    
    // Add "New folder" option at the bottom
    const newFolderOption = document.createElement('option');
    newFolderOption.value = '__new__';
    newFolderOption.textContent = '➕ 新建文件夹...';
    selectEl.appendChild(newFolderOption);
    
    // Restore last used folder from storage
    try {
      const { lastFolderId } = await chrome.storage.local.get('lastFolderId');
      if (lastFolderId !== undefined) {
        // Convert special marker back to null for uncategorized folder
        const actualFolderId = lastFolderId === '__uncategorized__' ? null : lastFolderId;
        
        // Recursive function to check if folder exists at any depth
        const findFolderRecursively = (folders: BookmarkFolder[], targetId: string): boolean => {
          for (const folder of folders) {
            if (folder.id === targetId) return true;
            if (folder.children && folder.children.length > 0) {
              if (findFolderRecursively(folder.children, targetId)) return true;
            }
          }
          return false;
        };
        
        // Validate folder exists (null is always valid as "uncategorized")
        const folderExists = actualFolderId === null || 
          findFolderRecursively(this.state.folders, actualFolderId);
        
        if (folderExists) {
          selectEl.value = actualFolderId || '';
          this.state.selectedFolderId = actualFolderId;
        }
      }
    } catch (error) {
      console.warn('Failed to restore last folder:', error);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Save bookmark button
    const saveBtn = document.getElementById('saveBookmarkBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveBookmark());
    }

    // Login button (opens login page)
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: `${this.researchopiaUrl}/auth/login` });
      });
    }

    // Folder select
    const folderSelect = document.getElementById('folderSelect') as HTMLSelectElement;
    if (folderSelect) {
      folderSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const value = target.value;
        
        // Handle "New folder" option
        if (value === '__new__') {
          this.showInlineNewFolder(folderSelect);
          return;
        }
        
        this.state.selectedFolderId = value || null;
        // Update button state when folder changes
        this.updateSaveButtonState();
      });
    }

    // Custom title input
    const titleInput = document.getElementById('customTitleInput');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        this.state.customTitle = target.value;
        // Update button state when title changes
        this.updateSaveButtonState();
      });
    }

    // Note input
    const noteInput = document.getElementById('noteInput');
    if (noteInput) {
      noteInput.addEventListener('input', (e) => {
        const target = e.target as HTMLTextAreaElement;
        this.state.note = target.value;
      });
    }

    // View bookmarks button (opens bookmarks page)
    const viewBookmarksBtn = document.getElementById('viewBookmarksBtn');
    if (viewBookmarksBtn) {
      viewBookmarksBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: `${this.researchopiaUrl}/bookmarks` });
      });
    }
  }

  /**
   * Save bookmark
   */
  async saveBookmark(): Promise<void> {
    if (this.state.isSaving) return;
    if (!this.state.pageUrl) {
      showToast('无法获取页面URL', 'error');
      return;
    }

    // Check if current folder already has this bookmark
    const existingInFolder = this.getExistingBookmarkInCurrentFolder();
    const titleModified = this.isTitleModified();
    
    // If already bookmarked in current folder
    if (existingInFolder) {
      // If title was modified, update the existing bookmark
      if (titleModified) {
        await this.updateBookmarkTitle(existingInFolder.id, this.state.customTitle);
        return;
      } else {
        // Just notify user, don't create duplicate
        showToast('此文件夹已收藏，可以选择添加到其他文件夹', 'info');
        return;
      }
    }

    this.state.isSaving = true;
    this.updateSaveButtonState();

    try {
      // Use 'authToken' from sync storage (where AuthManager stores it)
      const storage = await getSyncStorage(['authToken']);
      const token = storage.authToken;

      if (!token) {
        showToast('请先登录', 'error');
        return;
      }

      const response = await fetch(`${this.researchopiaUrl}/api/bookmarks/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: this.state.pageUrl,
          title: this.state.customTitle || this.state.pageTitle,
          folder_id: this.state.selectedFolderId,
          note: this.state.note || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save bookmark');
      }

      // Different toast message based on context
      if (this.state.isBookmarked) {
        // Already bookmarked elsewhere, added to new folder
        showToast('已收藏到此文件夹', 'success');
      } else {
        showToast('收藏成功', 'success');
      }
      
      // Update local state directly instead of re-fetching (optimization)
      this.state.isBookmarked = true;
      if (data.item) {
        // Add the new bookmark to existing bookmarks list
        this.state.existingBookmarks.push({
          id: data.item.id,
          custom_title: data.item.custom_title,
          note: data.item.note,
          folder_id: data.item.folder_id,
          created_at: data.item.created_at || new Date().toISOString(),
          folder: data.item.folder || null
        });
      }
      
      // Store last used folder for next time (use special marker for uncategorized)
      const folderToStore = this.state.selectedFolderId === null 
        ? '__uncategorized__' 
        : this.state.selectedFolderId;
      chrome.storage.local.set({ lastFolderId: folderToStore });
      
      // Auto-close popup after 1.5 seconds on success (if enabled in settings)
      const { autoClosePopup } = await chrome.storage.sync.get('autoClosePopup');
      // Default to true if not set
      if (autoClosePopup !== false) {
        setTimeout(() => {
          window.close();
        }, 1500);
      }
      
      // Update UI to reflect new state
      this.updateUI();
    } catch (error) {
      console.error('Error saving bookmark:', error);
      showToast(error instanceof Error ? error.message : '收藏失败', 'error');
    } finally {
      this.state.isSaving = false;
      this.updateSaveButtonState();
    }
  }

  /**
   * Update bookmark title
   */
  private async updateBookmarkTitle(bookmarkId: string, newTitle: string): Promise<void> {
    this.state.isSaving = true;
    this.updateSaveButtonState();

    try {
      const storage = await getSyncStorage(['authToken']);
      const token = storage.authToken;

      if (!token) {
        showToast('请先登录', 'error');
        return;
      }

      const response = await fetch(`${this.researchopiaUrl}/api/bookmarks/items/${bookmarkId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          custom_title: newTitle
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update bookmark');
      }

      // Update original title to new title (local state update, no re-fetch needed)
      this.state.originalTitle = newTitle;
      
      // Update the existing bookmark in local state
      const existingBookmark = this.state.existingBookmarks.find(b => b.id === bookmarkId);
      if (existingBookmark) {
        existingBookmark.custom_title = newTitle;
      }
      
      showToast('已更新收藏标题', 'success');
      
      // Auto-close popup after 1.5 seconds on success (if enabled in settings)
      const { autoClosePopup } = await chrome.storage.sync.get('autoClosePopup');
      // Default to true if not set
      if (autoClosePopup !== false) {
        setTimeout(() => {
          window.close();
        }, 1500);
      }

      // Update UI to reflect new state
      this.updateUI();
    } catch (error) {
      console.error('Error updating bookmark:', error);
      showToast(error instanceof Error ? error.message : '更新失败', 'error');
    } finally {
      this.state.isSaving = false;
      this.updateSaveButtonState();
    }
  }

  /**
   * Update loading state
   */
  private updateLoadingState(): void {
    const loadingEl = document.getElementById('foldersLoading');
    const selectEl = document.getElementById('folderSelect');
    
    if (loadingEl) {
      loadingEl.style.display = this.state.isLoading ? 'block' : 'none';
    }
    if (selectEl) {
      (selectEl as HTMLSelectElement).disabled = this.state.isLoading;
    }
  }

  /**
   * Update save button state
   */
  private updateSaveButtonState(): void {
    const saveBtn = document.getElementById('saveBookmarkBtn');
    const saveBtnText = document.getElementById('saveBookmarkText');
    
    const isCurrentFolderSaved = this.isCurrentFolderBookmarked();
    const titleModified = this.isTitleModified();
    
    if (saveBtn) {
      (saveBtn as HTMLButtonElement).disabled = this.state.isSaving;
    }
    if (saveBtnText) {
      if (this.state.isSaving) {
        saveBtnText.textContent = '保存中...';
      } else if (isCurrentFolderSaved) {
        // Current folder already has this bookmark
        if (titleModified) {
          saveBtnText.textContent = '📝 更新标题';
        } else {
          saveBtnText.textContent = '✅ 已收藏到研学港';
        }
      } else {
        // Current folder doesn't have this bookmark
        saveBtnText.textContent = '⭐ 收藏到研学港';
      }
    } else {
      console.warn('[BookmarkPanel] saveBookmarkText element not found');
    }
  }

  /**
   * Update bookmark status display
   */
  private updateBookmarkStatus(): void {
    const savedInfo = document.getElementById('bookmarkSavedInfo');
    const statusText = document.getElementById('bookmarkStatusText');
    const statusHint = document.getElementById('bookmarkStatusHint');
    
    if (savedInfo) {
      if (this.state.isBookmarked && this.state.existingBookmarks.length > 0) {
        // Build folder names list - debug log each bookmark's folder info
        console.log('[BookmarkPanel] Existing bookmarks for status display:', 
          this.state.existingBookmarks.map(b => ({
            id: b.id,
            folder_id: b.folder_id,
            folder: b.folder
          }))
        );
        
        const folderNames = this.state.existingBookmarks.map(b => {
          if (b.folder && b.folder.name) {
            return b.folder.name;
          }
          return '未分类';
        });
        
        // Show which folders contain this bookmark
        const uniqueFolders = [...new Set(folderNames)];
        
        if (statusText) {
          statusText.textContent = `已收藏到：${uniqueFolders.join('、')}`;
        }
        if (statusHint) {
          statusHint.textContent = '可以添加到其他文件夹';
        }
        
        savedInfo.classList.remove('hidden');
      } else {
        savedInfo.classList.add('hidden');
      }
    }
    
    // Also update save button text
    this.updateSaveButtonState();
  }

  /**
   * Update UI based on state
   */
  private updateUI(): void {
    const panel = document.getElementById('bookmarkPanel');
    const loginPrompt = document.getElementById('loginPrompt');
    const savedInfo = document.getElementById('bookmarkSavedInfo');
    const form = document.getElementById('bookmarkForm');

    // Show panel
    if (panel) {
      panel.classList.remove('hidden');
    }
    
    // Show/hide based on login state
    if (loginPrompt) {
      if (this.state.isLoggedIn) {
        loginPrompt.classList.add('hidden');
      } else {
        loginPrompt.classList.remove('hidden');
      }
    }

    if (form) {
      if (this.state.isLoggedIn) {
        form.classList.remove('hidden');
      } else {
        form.classList.add('hidden');
      }
    }

    // Update bookmark status display (shows folder info if already bookmarked)
    this.updateBookmarkStatus();
  }

  /**
   * Show inline input for creating new folder
   */
  private showInlineNewFolder(selectEl: HTMLSelectElement): void {
    // Store previous value to restore if cancelled
    const previousValue = this.state.selectedFolderId || '';
    
    // Build parent folder options HTML
    const buildParentOptions = (folders: BookmarkFolder[], depth: number = 0): string => {
      let html = '';
      for (const folder of folders) {
        const indent = '\u2003'.repeat(depth);
        html += `<option value="${folder.id}">${indent}${depth > 0 ? '└ ' : ''}📁 ${folder.name}</option>`;
        if (folder.children && folder.children.length > 0) {
          html += buildParentOptions(folder.children, depth + 1);
        }
      }
      return html;
    };
    
    // Create inline input container with parent folder selector
    const container = document.createElement('div');
    container.id = 'newFolderInline';
    container.className = 'new-folder-inline';
    container.innerHTML = `
      <div class="new-folder-row">
        <select id="parentFolderSelect" class="parent-folder-select" title="选择父文件夹">
          <option value="">📁 根目录（顶级）</option>
          ${buildParentOptions(this.state.folders)}
        </select>
      </div>
      <div class="new-folder-row">
        <input type="text" id="newFolderNameInput" placeholder="输入文件夹名称" class="new-folder-input" />
        <button type="button" id="confirmNewFolder" class="new-folder-btn confirm" title="确认">✓</button>
        <button type="button" id="cancelNewFolder" class="new-folder-btn cancel" title="取消">✕</button>
      </div>
    `;
    
    // Hide select, show inline input
    selectEl.style.display = 'none';
    selectEl.parentNode?.insertBefore(container, selectEl.nextSibling);
    
    const input = container.querySelector('#newFolderNameInput') as HTMLInputElement;
    const parentSelect = container.querySelector('#parentFolderSelect') as HTMLSelectElement;
    const confirmBtn = container.querySelector('#confirmNewFolder') as HTMLButtonElement;
    const cancelBtn = container.querySelector('#cancelNewFolder') as HTMLButtonElement;
    
    input?.focus();
    
    // Handle confirm
    const handleConfirm = async () => {
      const folderName = input.value.trim();
      if (!folderName) {
        showToast('请输入文件夹名称', 'error');
        return;
      }
      
      // Get selected parent folder (empty string means root/null)
      const parentId = parentSelect.value || null;
      
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      
      try {
        const storage = await getSyncStorage(['authToken']);
        const token = storage.authToken;
        
        if (!token) {
          showToast('请先登录', 'error');
          return;
        }
        
        const response = await fetch(`${this.researchopiaUrl}/api/bookmarks/folders`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: folderName,
            parent_id: parentId,
            visibility: 'private'
          })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to create folder');
        }
        
        // Reload folders and select the new one
        await this.loadFolders();
        
        // Select the newly created folder
        if (data.folder?.id) {
          selectEl.value = data.folder.id;
          this.state.selectedFolderId = data.folder.id;
        }
        
        showToast('文件夹创建成功', 'success');
      } catch (error) {
        console.error('Error creating folder:', error);
        showToast(error instanceof Error ? error.message : '创建文件夹失败', 'error');
        // Restore previous selection
        selectEl.value = previousValue;
      } finally {
        // Cleanup
        container.remove();
        selectEl.style.display = '';
      }
    };
    
    // Handle cancel
    const handleCancel = () => {
      container.remove();
      selectEl.style.display = '';
      selectEl.value = previousValue;
    };
    
    confirmBtn?.addEventListener('click', handleConfirm);
    cancelBtn?.addEventListener('click', handleCancel);
    
    // Enter to confirm, Escape to cancel
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    });
  }

  /**
   * Update login state (called from popup manager)
   */
  updateLoginState(isLoggedIn: boolean): void {
    this.state.isLoggedIn = isLoggedIn;
    if (isLoggedIn && this.state.folders.length === 0) {
      this.loadFolders();
    }
    this.updateUI();
  }
}
