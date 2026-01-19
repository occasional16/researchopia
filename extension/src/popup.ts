/**
 * Researchopia Popup Manager (Modular Version)
 * Extension popup with Bookmark support
 * v0.7.0 - Replaced Knowledge Web with Bookmark functionality
 */

import { DOIPanel } from './popup/doi-panel';
import { BookmarkPanel } from './popup/bookmark-panel';
import { SettingsPanel } from './popup/settings-panel';
import { showToast } from './utils/toast';
import { getSettings, getLocalStorage, getSyncStorage } from './utils/storage';
import type { ExtensionSettings } from './types/api';

// ============================================================================
// Constants (same as sidebar settings.ts)
// ============================================================================

const DEV_SERVER_URL = 'http://localhost:3000';
const PROD_SERVER_URL = 'https://www.researchopia.com';

// ============================================================================
// Type Definitions
// ============================================================================

interface MessageResponse {
  success: boolean;
  doi?: string | null;
  error?: string;
  token?: string;
  userId?: string;
  email?: string;
}


// ============================================================================
// Popup Manager Class (Coordinator)
// ============================================================================

class PopupManager {
  private currentTab: chrome.tabs.Tab | null = null;
  private isLoggedIn: boolean = false;
  private isSidebarOpen: boolean = false;
  private settings: ExtensionSettings | null = null;
  private devMode: boolean = false; // Same as sidebar: devMode controls server URL
  
  // Modular panels
  private doiPanel: DOIPanel;
  private bookmarkPanel: BookmarkPanel;
  private settingsPanel: SettingsPanel;

  constructor() {
    // Initialize panels
    this.doiPanel = new DOIPanel();
    this.bookmarkPanel = new BookmarkPanel();
    this.settingsPanel = new SettingsPanel();
    
    this.init();
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  private async init(): Promise<void> {
    await this.getCurrentTab();
    await this.loadSettings();
    await this.checkSidebarState();
    await this.checkLoginStatus();
    
    // Auto-open sidebar if enabled
    await this.checkAutoOpenSidebar();
    
    // Initialize header with page info
    this.initHeader();
    
    // Initialize panels
    await this.doiPanel.init(this.currentTab?.id || null);
    
    // Update bookmark panel with correct server URL based on dev mode
    const serverUrl = this.devMode ? DEV_SERVER_URL : PROD_SERVER_URL;
    this.bookmarkPanel.setResearchopiaUrl(serverUrl);
    await this.bookmarkPanel.init(this.currentTab, this.isLoggedIn);
    
    await this.settingsPanel.init(this.currentTab);
    
    this.setupEventListeners();
    this.updateUI();
  }

  /**
   * Initialize header with version and page info
   */
  private initHeader(): void {
    // Set version badge
    const versionBadge = document.getElementById('versionBadge');
    if (versionBadge) {
      const manifest = chrome.runtime.getManifest();
      versionBadge.textContent = `v${manifest.version}`;
    }
    
    // Set page title and URL
    if (this.currentTab) {
      const pageTitleEl = document.getElementById('pageTitle');
      const pageUrlEl = document.getElementById('pageUrl');
      const pageHostEl = document.getElementById('pageHost');
      
      const title = this.currentTab.title || '无标题';
      const url = this.currentTab.url || '';
      
      if (pageTitleEl) {
        pageTitleEl.textContent = title;
        pageTitleEl.title = `${title}\n\n点击复制标题`;
      }
      if (pageHostEl) {
        pageHostEl.textContent = url;
      }
      if (pageUrlEl) {
        pageUrlEl.title = `${url}\n\n点击复制URL`;
      }
    }
  }

  private async getCurrentTab(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
    } catch (error) {
      console.error('Failed to get current tab:', error);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      this.settings = await getSettings();
      // Load devMode from sync storage (same as sidebar SettingsManager)
      const result = await getSyncStorage(['devMode']);
      this.devMode = result.devMode === true;
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Get server URL based on devMode (same logic as sidebar SettingsManager)
   */
  private getServerUrl(): string {
    return this.devMode ? DEV_SERVER_URL : PROD_SERVER_URL;
  }

  /**
   * Fetch user profile from server to get username (same as sidebar AuthManager)
   */
  private async fetchUserProfile(token: string): Promise<void> {
    try {
      const response = await fetch(`${this.getServerUrl()}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const username = data.username;
        
        if (username) {
          await chrome.storage.sync.set({ userName: username });
          // Update UI with username
          const headerUsername = document.getElementById('headerUsername');
          const headerAvatar = document.getElementById('headerAvatar');
          if (headerUsername) {
            headerUsername.textContent = username;
          }
          if (headerAvatar) {
            headerAvatar.textContent = username.charAt(0).toUpperCase();
          }
        }
        // If no username from API, UI will fall back to email prefix in updateUI()
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  }

  private async checkSidebarState(): Promise<void> {
    if (!this.currentTab?.id) {
      this.isSidebarOpen = false;
      return;
    }

    try {
      const key = `panelOpen_${this.currentTab.id}`;
      const store = chrome.storage?.session || chrome.storage.local;
      const result = await store.get([key]);
      this.isSidebarOpen = result[key] === true;
    } catch (error) {
      console.warn('Failed to check sidebar state:', error);
      this.isSidebarOpen = false;
    }
  }

  /**
   * Auto-open sidebar if the autoOpen setting is enabled
   */
  private async checkAutoOpenSidebar(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['autoOpen']);
      if (result.autoOpen === true && this.currentTab?.id) {
        // Open sidebar automatically
        await this.openSidebar();
      }
    } catch (error) {
      console.warn('Failed to check autoOpen setting:', error);
    }
  }

  private async checkLoginStatus(): Promise<void> {
    try {
      // Use sync storage (same as sidebar AuthManager)
      const result = await getSyncStorage(['authToken', 'userId', 'userEmail', 'userName']);

      // Check if we have valid auth data
      if (result.authToken && result.userId) {
        this.isLoggedIn = true;
        
        // Fetch username from server if not cached in storage
        if (!result.userName && result.authToken) {
          await this.fetchUserProfile(result.authToken);
        }
        
        console.log('✅ Using synced auth from sidebar');
        return;
      }

      // Try to get token from website's localStorage via content script
      if (this.currentTab?.url && this.currentTab?.id) {
        try {
          const url = new URL(this.currentTab.url);
          if (url.hostname === 'localhost' || url.hostname.includes('researchopia.com')) {
            console.log('🔄 Trying to get auth from page...');
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
              action: 'getSupabaseAuth',
            }) as MessageResponse | undefined;

            if (response?.success && response.token) {
              // Save to sync storage (same as sidebar)
              await chrome.storage.sync.set({
                authToken: response.token,
                userId: response.userId,
                userEmail: response.email,
              });
              
              // Fetch username from API (same as sidebar AuthManager.fetchUserProfile)
              // Use await to ensure username is fetched before updateUI()
              await this.fetchUserProfile(response.token);
              
              this.isLoggedIn = true;
              console.log('✅ Auth synced from page');
              return;
            }
          }
        } catch (e) {
          console.log('Could not get auth from page:', e instanceof Error ? e.message : 'Unknown error');
        }
      }

      this.isLoggedIn = false;
      console.log('❌ Not logged in');
    } catch (error) {
      console.error('Failed to check login status:', error);
      this.isLoggedIn = false;
    }
  }

  // --------------------------------------------------------------------------
  // Event Listeners
  // --------------------------------------------------------------------------

  private setupEventListeners(): void {
    console.log('🎛️ Setting up popup event listeners...');

    // Header login button
    document.getElementById('headerLoginBtn')?.addEventListener('click', () => {
      this.openLoginPage();
    });

    // Header sidebar button - open sidebar
    document.getElementById('headerSidebarBtn')?.addEventListener('click', async () => {
      await this.openSidebar();
      window.close();
    });

    // Settings button - open sidebar and show settings panel
    document.getElementById('settingsBtn')?.addEventListener('click', async () => {
      // Signal sidebar to open settings panel after opening
      await chrome.storage.session.set({ pendingSidebarAction: 'openSettings' });
      // Always open sidebar (don't toggle)
      if (this.currentTab?.windowId) {
        await chrome.sidePanel.open({ windowId: this.currentTab.windowId });
      }
      window.close();
    });
    
    // Header avatar click - logout
    document.getElementById('headerAvatar')?.addEventListener('click', async () => {
      if (confirm('是否退出登录？')) {
        await this.logout();
      }
    });
    
    // Page title click - copy
    document.getElementById('pageTitle')?.addEventListener('click', () => {
      if (this.currentTab?.title) {
        this.copyToClipboard(this.currentTab.title, '标题已复制');
      }
    });
    
    // Page URL click - copy
    document.getElementById('pageUrl')?.addEventListener('click', () => {
      if (this.currentTab?.url) {
        this.copyToClipboard(this.currentTab.url, 'URL已复制');
      }
    });
    
    // DOI click - copy
    document.getElementById('paperDoi')?.addEventListener('click', () => {
      const doi = this.doiPanel.getDOI();
      if (doi) {
        this.copyToClipboard(doi, 'DOI已复制');
      }
    });
    
    // Page detail button - open webpage detail
    document.getElementById('pageDetailBtn')?.addEventListener('click', () => {
      this.openWebpageDetail();
    });
    
    // Paper detail button - open paper detail
    document.getElementById('paperDetailBtn')?.addEventListener('click', () => {
      this.openPaperDetail();
    });

    // Brand click - open website homepage
    document.querySelector('.brand')?.addEventListener('click', () => {
      this.openResearchopiaPage('/');
    });
    
    // Username click - open profile page
    document.getElementById('headerUsername')?.addEventListener('click', () => {
      this.openResearchopiaPage('/profile');
    });

    console.log('✅ Popup event listeners ready');
  }

  // --------------------------------------------------------------------------
  // UI Updates
  // --------------------------------------------------------------------------

  private updateUI(): void {
    // Update header user state
    const headerUser = document.getElementById('headerUser');
    const headerLoginBtn = document.getElementById('headerLoginBtn');
    const headerAvatar = document.getElementById('headerAvatar');
    const headerUsername = document.getElementById('headerUsername');
    
    if (this.isLoggedIn) {
      headerUser?.classList.remove('hidden');
      headerLoginBtn?.classList.add('hidden');
      
      // Try to get username from sync storage (same as sidebar)
      getSyncStorage(['userName', 'userEmail']).then((storageResult) => {
        if (headerAvatar && headerUsername) {
          const name = storageResult.userName || storageResult.userEmail?.split('@')[0] || '用户';
          headerAvatar.textContent = name.charAt(0).toUpperCase();
          headerUsername.textContent = name;
          headerAvatar.title = storageResult.userEmail || '点击退出登录';
        }
      });
    } else {
      headerUser?.classList.add('hidden');
      headerLoginBtn?.classList.remove('hidden');
    }
    
    // Update Paper Info if DOI detected
    const doi = this.doiPanel.getDOI();
    const paperInfo = document.getElementById('paperInfo');
    const doiValueEl = document.getElementById('doiValue');
    const paperDoiEl = document.getElementById('paperDoi');
    
    if (doi && paperInfo && doiValueEl) {
      paperInfo.classList.remove('hidden');
      doiValueEl.textContent = doi;
      if (paperDoiEl) {
        paperDoiEl.title = `DOI: ${doi}\n\n点击复制DOI`;
      }
    }
    
    // Update bookmark panel based on login state
    this.bookmarkPanel.updateLoginState(this.isLoggedIn);
  }

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  private async openSidebar(): Promise<boolean> {
    try {
      if (!this.currentTab?.id) {
        return false;
      }

      const doi = this.doiPanel.getDOI();

      if (this.isSidebarOpen) {
        const response = await chrome.runtime.sendMessage({
          action: 'toggleSidePanel',
          doi,
          url: this.currentTab.url,
        }) as MessageResponse | undefined;

        if (response?.success) {
          this.isSidebarOpen = false;
          this.updateUI();
          return true;
        }
      } else {
        try {
          await chrome.sidePanel.setOptions({
            tabId: this.currentTab.id,
            path: 'sidebar.html',
            enabled: true,
          });

          await chrome.sidePanel.open({ tabId: this.currentTab.id });

          chrome.runtime.sendMessage({
            action: 'updatePanelState',
            tabId: this.currentTab.id,
            isOpen: true,
            doi,
            url: this.currentTab.url,
          }).catch(() => {});

          this.isSidebarOpen = true;
          this.updateUI();
          setTimeout(() => window.close(), 300);
          return true;
        } catch (error) {
          console.error('Failed to open sidebar directly:', error);

          const response = await chrome.runtime.sendMessage({
            action: 'toggleSidePanel',
            doi,
            url: this.currentTab.url,
          }) as MessageResponse | undefined;

          if (response?.success) {
            this.isSidebarOpen = true;
            this.updateUI();
            setTimeout(() => window.close(), 300);
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Sidebar toggle error:', error);
      return false;
    }
  }

  private openLoginPage(): void {
    const baseUrl = this.getServerUrl();
    chrome.tabs.create({ url: baseUrl });
    showToast('请在网站上登录，然后重新打开弹窗', 'success');
  }

  private async logout(): Promise<void> {
    // Clear auth data from sync storage (same as sidebar AuthManager)
    await chrome.storage.sync.remove(['authToken', 'userId', 'userEmail', 'userName']);
    this.isLoggedIn = false;
    this.updateUI();
    showToast('已退出登录', 'success');
  }

  private openWebsite(): void {
    const url = this.getServerUrl();
    chrome.tabs.create({ url, active: true });
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  /**
   * Copy text to clipboard
   */
  private async copyToClipboard(text: string, successMessage: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage, 'success');
    } catch {
      showToast('复制失败', 'error');
    }
  }

  /**
   * Open webpage detail page
   */
  private openWebpageDetail(): void {
    if (!this.currentTab?.url) {
      showToast('无法获取页面信息', 'error');
      return;
    }
    
    try {
      const baseUrl = this.getServerUrl();
      const urlHash = this.getUrlHash(this.currentTab.url);
      const detailUrl = `${baseUrl}/webpages/${urlHash}`;
      chrome.tabs.create({ url: detailUrl, active: true });
    } catch (error) {
      console.error('Failed to open webpage detail:', error);
      showToast('打开详情页失败', 'error');
    }
  }

  /**
   * Open a Researchopia page (e.g., homepage or profile)
   */
  private openResearchopiaPage(path: string): void {
    const baseUrl = this.getServerUrl();
    const targetUrl = `${baseUrl}${path}`;
    chrome.tabs.create({ url: targetUrl, active: true });
  }

  /**
   * Open paper detail page
   */
  private openPaperDetail(): void {
    const doi = this.doiPanel.getDOI();
    if (!doi) {
      showToast('未检测到DOI', 'error');
      return;
    }
    
    const baseUrl = this.getServerUrl();
    const detailUrl = `${baseUrl}/papers/${encodeURIComponent(doi)}`;
    chrome.tabs.create({ url: detailUrl, active: true });
  }

  /**
   * Generate URL hash (simple implementation)
   */
  private getUrlHash(url: string): string {
    // Use the URL normalizer if available, otherwise simple hash
    try {
      // @ts-expect-error - urlNormalizer is loaded as a separate script
      if (typeof window.urlNormalizer !== 'undefined') {
        // @ts-expect-error - urlNormalizer is loaded as a separate script
        return window.urlNormalizer.generateUrlHash(url);
      }
    } catch {
      // fallback
    }
    
    // Simple hash fallback
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
