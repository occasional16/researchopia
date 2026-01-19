/// <reference types="chrome" />
/**
 * Webpage Evaluation Sidebar - Main Entry Point
 * 
 * Modular architecture:
 * - types/       - TypeScript type definitions
 * - utils/       - Utility functions (hash, format, escape)
 * - modules/     - Feature modules (auth, settings, rating-ui, comment-ui, api)
 */

import type { PageInfo, SidebarSettings, AuthState } from './types';
import { hashUrl, showToast, getElement } from './utils';
import { AuthManager, SettingsManager, RatingUIManager, CommentUIManager, ApiService } from './modules';

// ============================================================================
// Constants
// ============================================================================

const COMMENT_PAGE_SIZE = 10;
const TAB_STORAGE_KEY = 'sidebarActiveTab';

// ============================================================================
// Main Sidebar Class
// ============================================================================

class WebpageEvaluationSidebar {
  // Modules
  private settingsManager: SettingsManager;
  private authManager: AuthManager;
  private ratingUI: RatingUIManager;
  private commentUI: CommentUIManager;
  private api: ApiService;

  // Page state
  private pageInfo: PageInfo = { url: '', title: '', urlHash: '', doi: null };
  
  // Pagination state
  private commentPage: number = 0;
  
  // Tab state
  private activeTab: string = 'rating';

  constructor() {
    // Initialize modules with callbacks
    this.settingsManager = new SettingsManager((settings) => this.onSettingsChange(settings));
    this.authManager = new AuthManager('', (state) => this.onAuthChange(state));
    this.ratingUI = new RatingUIManager();
    this.commentUI = new CommentUIManager({
      onSubmit: (content, parentId, isAnonymous) => this.submitComment(content, parentId, isAnonymous),
      onDelete: (commentId) => this.deleteComment(commentId),
      onLoadMore: () => this.loadMoreComments(),
      onLike: (commentId) => this.likeComment(commentId),
    });
    this.api = new ApiService('', () => this.authManager.showLoginPrompt());

    this.init();
  }

  // ==================== Initialization ====================

  private async init(): Promise<void> {
    // 0. Display version number from manifest
    this.displayVersion();
    
    // 1. Load settings first (includes server URL)
    const settings = await this.settingsManager.loadSettings();
    
    // 2. Load and apply saved tab state
    await this.loadTabState();
    
    // 3. Update modules with server URL
    this.authManager.setServerUrl(settings.serverUrl);
    this.api.setServerUrl(settings.serverUrl);

    // 4. Check auth status
    const isLoggedIn = await this.authManager.checkAuthStatus();
    
    if (isLoggedIn) {
      this.api.setAccessToken(this.authManager.accessToken);
      this.authManager.showLoggedInContent();
      this.authManager.updateUserInfo();
      this.commentUI.setCurrentUserId(this.authManager.userId);
      this.ratingUI.setCurrentUserId(this.authManager.userId);
    } else {
      this.authManager.showLoginPrompt();
    }

    // 5. Get current page info
    await this.getCurrentPageInfo();

    // 6. Setup all event listeners (including tabs)
    this.setupEventListeners();

    // 7. Load data if authenticated
    if (isLoggedIn && this.pageInfo.urlHash) {
      await this.loadWebpageData();
    }
  }

  // ==================== Tab Management ====================

  private async loadTabState(): Promise<void> {
    try {
      // Check if there's a pending action request from popup (e.g., open settings)
      const sessionResult = await chrome.storage.session.get(['pendingSidebarAction']);
      if (sessionResult.pendingSidebarAction === 'openSettings') {
        // Clear the pending request
        await chrome.storage.session.remove(['pendingSidebarAction']);
        // Open settings panel after a short delay to ensure DOM is ready
        setTimeout(() => {
          this.settingsManager.openSettings();
        }, 100);
      }
      
      // Load saved tab preference
      const result = await chrome.storage.sync.get([TAB_STORAGE_KEY]);
      const savedTab = result[TAB_STORAGE_KEY];
      if (savedTab && typeof savedTab === 'string') {
        this.activeTab = savedTab;
      }
      this.switchTab(this.activeTab);
    } catch (error) {
      console.error('Failed to load tab state:', error);
      this.switchTab('rating');
    }
  }

  private async saveTabState(tabId: string): Promise<void> {
    try {
      await chrome.storage.sync.set({ [TAB_STORAGE_KEY]: tabId });
    } catch (error) {
      console.error('Failed to save tab state:', error);
    }
  }

  private switchTab(tabId: string): void {
    this.activeTab = tabId;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const el = btn as HTMLElement;
      el.classList.toggle('active', el.dataset.tab === tabId);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabId}-tab`);
    });

    // Save preference
    this.saveTabState(tabId);
  }

  // ==================== Version Display ====================

  /**
   * Display extension version from manifest
   */
  private displayVersion(): void {
    const versionBadge = document.getElementById('versionBadge');
    if (versionBadge) {
      const manifest = chrome.runtime.getManifest();
      versionBadge.textContent = `v${manifest.version}`;
    }
  }

  // ==================== Page Info ====================

  private async getCurrentPageInfo(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url && tab.id) {
        this.pageInfo = {
          url: tab.url,
          title: tab.title || '',
          urlHash: await hashUrl(tab.url),
          doi: null,
        };

        // Update display
        const pageHostEl = document.getElementById('pageHost');
        const pageUrlEl = document.getElementById('pageUrl');
        const pageTitleEl = document.getElementById('pageTitle');
        
        // Show full URL (not just hostname)
        if (pageHostEl) {
          pageHostEl.textContent = tab.url;
        }
        // Set tooltip with full URL and copy hint
        if (pageUrlEl) {
          pageUrlEl.title = `${tab.url}\n\n点击复制URL`;
        }
        if (pageTitleEl) {
          const title = this.pageInfo.title || '无标题';
          pageTitleEl.textContent = title;
          pageTitleEl.title = `${title}\n\n点击复制标题`;
        }
        
        // Try to get DOI from content script
        await this.detectDOI(tab.id);
      }
    } catch (error) {
      console.error('Failed to get page info:', error);
    }
  }
  
  /**
   * Detect DOI from content script and update Paper Info display
   */
  private async detectDOI(tabId: number): Promise<void> {
    try {
      // Send message to content script to get detected DOI
      // Note: content script uses 'action' not 'type' for message routing
      const response = await chrome.tabs.sendMessage(tabId, { action: 'getCurrentDOI' });
      
      if (response?.success && response.doi) {
        this.pageInfo.doi = response.doi;
        this.showPaperInfo(response.doi);
      } else {
        this.hidePaperInfo();
      }
    } catch (error) {
      // Content script may not be injected on this page
      console.debug('Could not get DOI from content script:', error);
      this.hidePaperInfo();
    }
  }
  
  /**
   * Show Paper Info section with DOI
   */
  private showPaperInfo(doi: string): void {
    const paperInfoEl = document.getElementById('paperInfo');
    const paperDoiEl = document.getElementById('paperDoi');
    const doiValueEl = document.getElementById('doiValue');
    
    if (paperInfoEl) {
      paperInfoEl.classList.remove('hidden');
    }
    if (doiValueEl) {
      doiValueEl.textContent = doi;
    }
    // Set tooltip with full DOI and copy hint
    if (paperDoiEl) {
      paperDoiEl.title = `DOI: ${doi}\n\n点击复制DOI`;
    }
  }
  
  /**
   * Hide Paper Info section
   */
  private hidePaperInfo(): void {
    const paperInfoEl = document.getElementById('paperInfo');
    if (paperInfoEl) {
      paperInfoEl.classList.add('hidden');
    }
  }

  // ==================== Data Loading ====================

  private async loadWebpageData(): Promise<void> {
    if (!this.pageInfo.urlHash) return;

    try {
      await Promise.all([
        this.loadRatings(),
        this.loadComments(),
      ]);
    } catch (error) {
      console.error('Failed to load webpage data:', error);
    }
  }

  /**
   * Refresh all data - equivalent to closing and reopening the sidebar
   */
  private async refreshData(): Promise<void> {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.classList.add('spinning');
    }

    try {
      // 1. Re-check auth status
      const isLoggedIn = await this.authManager.checkAuthStatus();
      
      if (isLoggedIn) {
        this.api.setAccessToken(this.authManager.accessToken);
        this.authManager.showLoggedInContent();
        this.authManager.updateUserInfo();
        this.commentUI.setCurrentUserId(this.authManager.userId);
        this.ratingUI.setCurrentUserId(this.authManager.userId);
      } else {
        this.authManager.showLoginPrompt();
      }

      // 2. Refresh page info and paper info (DOI detection)
      await this.getCurrentPageInfo();

      // 3. Reset comment state
      this.commentPage = 0;
      this.commentUI.setFilter('all');
      const filterSelect = document.getElementById('commentFilter') as HTMLSelectElement;
      if (filterSelect) filterSelect.value = 'all';
      
      // 4. Reset rating form state
      this.ratingUI.resetForm();

      // 5. Reload data if authenticated
      if (isLoggedIn && this.pageInfo.urlHash) {
        await this.loadWebpageData();
      } else {
        // Clear displayed data if not logged in
        this.ratingUI.clearDisplay();
        this.commentUI.setComments([], false, 0);
      }
      
      console.log('✅ Sidebar refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh sidebar:', error);
    } finally {
      if (refreshBtn) {
        refreshBtn.classList.remove('spinning');
      }
    }
  }

  private async loadRatings(): Promise<void> {
    try {
      const response = await this.api.loadRatings(this.pageInfo.urlHash);

      // Update stats display
      if (response.stats && response.stats.count > 0) {
        this.ratingUI.updateStatsDisplay(response.stats.average.overall, response.stats.count);
      }

      // Update ratings list
      if (response.ratings) {
        this.ratingUI.setRatingsList(response.ratings);
      }

      // Update user's rating if exists
      if (response.userRating) {
        this.ratingUI.setExistingRatingId(response.userRating.id);
        this.ratingUI.setRatings({
          quality: response.userRating.dimension1 || 0,
          usefulness: response.userRating.dimension2 || 0,
          accuracy: response.userRating.dimension3 || 0,
          overall: response.userRating.overallScore || 0,
        });

        const submitBtn = document.getElementById('submitRatingBtn');
        if (submitBtn) submitBtn.innerHTML = '<span>更新评分</span>';
      }
    } catch (error) {
      console.log('No existing rating found:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async loadComments(append: boolean = false): Promise<void> {
    if (!append) {
      this.commentPage = 0;
      this.commentUI.showLoading();
    }

    try {
      const offset = this.commentPage * COMMENT_PAGE_SIZE;
      const response = await this.api.loadComments(this.pageInfo.urlHash, COMMENT_PAGE_SIZE, offset);

      this.commentUI.hideLoading();

      if (response.comments) {
        if (append) {
          this.commentUI.appendComments(response.comments, response.hasMore || false);
        } else {
          this.commentUI.setComments(response.comments, response.hasMore || false, response.total);
        }
      }
    } catch (error) {
      this.commentUI.hideLoading();
      console.log('Failed to load comments:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async loadMoreComments(): Promise<void> {
    this.commentPage++;
    await this.loadComments(true);
  }

  // ==================== Rating Submission ====================

  private async submitRating(): Promise<void> {
    if (!this.ratingUI.validate()) return;

    const submitBtn = getElement<HTMLButtonElement>('submitRatingBtn');
    const isAnonymous = getElement<HTMLInputElement>('ratingAnonymous')?.checked || false;
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>提交中...</span>';
    }

    try {
      const ratings = this.ratingUI.getRatings();
      await this.api.submitRating({
        targetId: this.pageInfo.urlHash,
        scores: {
          dimension1: ratings.quality || null,
          dimension2: ratings.usefulness || null,
          dimension3: ratings.accuracy || null,
          overall: ratings.overall,
        },
        url: this.pageInfo.url,
        title: this.pageInfo.title,
        isAnonymous,
        showUsername: !isAnonymous, // Simple: show username when not anonymous
      });

      if (submitBtn) {
        submitBtn.classList.add('success');
        submitBtn.innerHTML = '<span>✓ 评分成功</span>';

        setTimeout(() => {
          submitBtn.classList.remove('success');
          submitBtn.innerHTML = '<span>更新评分</span>';
          submitBtn.disabled = false;
        }, 2000);
      }

      await this.loadRatings();
      showToast('评分提交成功', 'success');
    } catch (error) {
      if (submitBtn) {
        submitBtn.innerHTML = '<span>提交评分</span>';
        submitBtn.disabled = false;
      }
      showToast('提交评分失败', 'error');
    }
  }

  // ==================== Comment Actions ====================

  private async submitComment(content: string, parentId?: string | null, replyAnonymous?: boolean): Promise<void> {
    if (!content.trim()) {
      showToast('请输入评论内容', 'error');
      return;
    }

    const submitBtn = getElement<HTMLButtonElement>('submitCommentBtn');
    // For replies, use the passed anonymous param; for main comments, read from checkbox
    const isAnonymous = parentId 
      ? (replyAnonymous || false)
      : (getElement<HTMLInputElement>('commentAnonymous')?.checked || false);
    
    if (submitBtn) submitBtn.disabled = true;

    try {
      await this.api.submitComment({
        targetId: this.pageInfo.urlHash,
        content: content.trim(),
        url: this.pageInfo.url,
        title: this.pageInfo.title,
        parentId,
        isAnonymous,
      });

      if (!parentId) {
        this.commentUI.clearInput();
        // Reset anonymous checkbox after submission
        const anonymousCheckbox = getElement<HTMLInputElement>('commentAnonymous');
        if (anonymousCheckbox) anonymousCheckbox.checked = false;
      }

      await this.loadComments();
      showToast('评论发表成功', 'success');
    } catch (error) {
      console.error('Comment submit failed:', error);
      showToast('发表评论失败', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  private async deleteComment(commentId: string): Promise<void> {
    try {
      await this.api.deleteComment(this.pageInfo.urlHash, commentId);
      await this.loadComments();
      showToast('评论已删除', 'success');
    } catch (error) {
      showToast('删除失败', 'error');
    }
  }

  private async likeComment(commentId: string): Promise<void> {
    try {
      const result = await this.api.voteComment(commentId);
      this.commentUI.updateCommentLike(commentId, result.hasLiked, result.likeCount);
    } catch (error) {
      console.error('Like comment error:', error);
      showToast('操作失败', 'error');
    }
  }

  // ==================== Callbacks ====================

  private onSettingsChange(settings: SidebarSettings): void {
    this.authManager.setServerUrl(settings.serverUrl);
    this.api.setServerUrl(settings.serverUrl);
  }

  private onAuthChange(state: AuthState): void {
    this.api.setAccessToken(state.accessToken);
    this.commentUI.setCurrentUserId(state.userId);
    this.ratingUI.setCurrentUserId(state.userId);

    if (state.isLoggedIn && this.pageInfo.urlHash) {
      this.loadWebpageData();
    }
  }

  // ==================== Event Listeners ====================

  private setupEventListeners(): void {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tabId = target.dataset.tab;
        if (tabId) this.switchTab(tabId);
      });
    });

    // Settings module listeners
    this.settingsManager.setupEventListeners();

    // Auth buttons (both header and content area)
    document.getElementById('loginBtn')?.addEventListener('click', () => this.authManager.login());
    document.getElementById('headerLoginBtn')?.addEventListener('click', () => this.authManager.login());
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.authManager.logout());
    
    // Refresh button - reload ratings and comments
    document.getElementById('refreshBtn')?.addEventListener('click', () => this.refreshData());
    
    // Header avatar click - show user menu or logout
    document.getElementById('headerAvatar')?.addEventListener('click', () => {
      // Simple: click avatar to logout (can be enhanced to dropdown menu later)
      if (confirm('是否退出登录？')) {
        this.authManager.logout();
      }
    });

    // Brand click - open website homepage
    document.querySelector('.brand')?.addEventListener('click', () => {
      this.openResearchopiaPage('/');
    });
    
    // Username click - open profile page
    document.getElementById('headerUsername')?.addEventListener('click', () => {
      this.openResearchopiaPage('/profile');
    });

    // Auth message listener
    this.authManager.setupMessageListener();

    // Rating form
    document.getElementById('ratingForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitRating();
    });

    // Rating list toggle button
    document.getElementById('toggleRatingsListBtn')?.addEventListener('click', () => {
      this.ratingUI.toggleRatingsList();
    });

    // Rating UI listeners
    this.ratingUI.setupEventListeners();

    // Comment UI listeners
    this.commentUI.setupEventListeners();
    
    // Comment filter
    document.getElementById('commentFilter')?.addEventListener('change', (e) => {
      const filter = (e.target as HTMLSelectElement).value as 'all' | 'mine';
      this.commentUI.setFilter(filter);
    });
    
    // Page info click handlers (copy to clipboard)
    document.getElementById('pageTitle')?.addEventListener('click', () => {
      this.copyToClipboard(this.pageInfo.title, '标题已复制');
    });
    
    document.getElementById('pageUrl')?.addEventListener('click', () => {
      this.copyToClipboard(this.pageInfo.url, 'URL已复制');
    });
    
    // Page detail button - go to webpage detail page
    document.getElementById('pageDetailBtn')?.addEventListener('click', () => {
      this.goToWebpageDetail();
    });
    
    // Rating detail button - go to webpage detail page (ratings section)
    document.getElementById('ratingDetailBtn')?.addEventListener('click', () => {
      this.goToWebpageDetail('#ratings');
    });
    
    // Comment detail button - go to webpage detail page (comments section)
    document.getElementById('commentDetailBtn')?.addEventListener('click', () => {
      this.goToWebpageDetail('#comments');
    });
    
    // Paper info click handlers (copy DOI, go to paper detail)
    document.getElementById('paperDoi')?.addEventListener('click', () => {
      if (this.pageInfo.doi) {
        this.copyToClipboard(this.pageInfo.doi, 'DOI已复制');
      }
    });
    
    document.getElementById('paperDetailBtn')?.addEventListener('click', () => {
      this.goToPaperDetail();
    });
    
    // Listen for pending actions from popup (e.g., open settings)
    chrome.storage.session.onChanged.addListener((changes) => {
      if (changes.pendingSidebarAction?.newValue === 'openSettings') {
        // Clear the pending request
        chrome.storage.session.remove(['pendingSidebarAction']);
        // Open settings panel
        this.settingsManager.openSettings();
      }
    });
  }
  
  // ==================== Utility Methods ====================
  
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
   * Navigate to webpage detail page on Researchopia
   * @param hash Optional hash to jump to specific section (e.g., '#ratings', '#comments')
   */
  private goToWebpageDetail(hash: string = ''): void {
    if (!this.pageInfo.urlHash) {
      showToast('无法获取页面信息', 'error');
      return;
    }
    
    const serverUrl = this.settingsManager.serverUrl;
    const detailUrl = `${serverUrl}/webpages/${this.pageInfo.urlHash}${hash}`;
    
    // Open in new tab
    window.open(detailUrl, '_blank');
  }
  
  /**
   * Navigate to paper detail page on Researchopia
   */
  private goToPaperDetail(): void {
    if (!this.pageInfo.doi) {
      showToast('无法获取论文DOI', 'error');
      return;
    }
    
    const serverUrl = this.settingsManager.serverUrl;
    // The paper detail page uses DOI as path: /papers/10.xxx/xxx
    const detailUrl = `${serverUrl}/papers/${this.pageInfo.doi}`;
    
    // Open in new tab
    window.open(detailUrl, '_blank');
  }

  /**
   * Open a Researchopia page (e.g., homepage or profile)
   */
  private openResearchopiaPage(path: string): void {
    const serverUrl = this.settingsManager.serverUrl;
    const targetUrl = `${serverUrl}${path}`;
    window.open(targetUrl, '_blank');
  }
}

// ============================================================================
// Initialize
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  (window as unknown as { sidebar: WebpageEvaluationSidebar }).sidebar = new WebpageEvaluationSidebar();
});
