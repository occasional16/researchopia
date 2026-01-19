/**
 * Knowledge Panel Module
 * Handles knowledge unit saving functionality
 */

import { showToast } from '../utils/toast';
import { getLocalStorage } from '../utils/storage';
import type { PageInfo, KnowledgeType, Visibility } from '../types/dom';

export interface KnowledgePanelState {
  pageInfo: PageInfo | null;
  selectedTags: string[];
  isLoggedIn: boolean;
  isSaving: boolean;
}

export interface KnowledgeUnitBody {
  type: KnowledgeType;
  url: string;
  title: string;
  visibility: Visibility;
  doi?: string;
  tags?: string[];
  metadata: {
    doi: string | null;
    savedAt: string;
    source: string;
  };
}

export class KnowledgePanel {
  private state: KnowledgePanelState = {
    pageInfo: null,
    selectedTags: [],
    isLoggedIn: false,
    isSaving: false,
  };
  private researchopiaUrl: string = 'https://www.researchopia.com';

  constructor(researchopiaUrl?: string) {
    if (researchopiaUrl) {
      this.researchopiaUrl = researchopiaUrl;
    }
  }

  /**
   * Initialize the knowledge panel
   */
  async init(tab: chrome.tabs.Tab | null, isLoggedIn: boolean): Promise<void> {
    this.state.isLoggedIn = isLoggedIn;
    this.loadPageInfo(tab);
    this.setupEventListeners();
  }

  /**
   * Load page information from tab
   */
  loadPageInfo(tab: chrome.tabs.Tab | null): void {
    if (!tab) return;

    try {
      const url = tab.url || '';
      const title = tab.title || 'Untitled';
      
      // Detect page type
      let type: KnowledgeType = 'webpage';
      let doi: string | null = null;
      
      // Check for DOI in URL
      const doiMatch = url.match(/10\.\d{4,9}\/[^\s&?#]+/);
      if (doiMatch) {
        doi = doiMatch[0];
        type = 'paper';
      }
      
      // Check for known sites
      if (url.includes('arxiv.org')) {
        type = 'paper';
      } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        type = 'video';
      } else if (url.includes('amazon.com/dp/') || url.includes('amazon.com/gp/product/')) {
        type = 'book';
      }

      this.state.pageInfo = {
        url,
        title,
        type,
        doi,
        normalizedUrl: url,
      };

      this.updateDisplay();
    } catch (error) {
      console.error('Failed to load page info:', error);
    }
  }

  /**
   * Update UI display
   */
  private updateDisplay(): void {
    const typeEl = document.getElementById('knType');
    const titleEl = document.getElementById('knTitle');
    const urlEl = document.getElementById('knUrl');

    if (!this.state.pageInfo) return;

    // Type icon mapping
    const typeIcons: Record<KnowledgeType, string> = {
      webpage: '📄 网页',
      paper: '📑 论文',
      book: '📚 书籍',
      video: '🎬 视频',
      note: '📝 笔记',
    };

    const pageType = this.state.pageInfo.type || 'webpage';
    if (typeEl) typeEl.textContent = typeIcons[pageType as KnowledgeType] || '📄 网页';
    if (titleEl) titleEl.textContent = this.state.pageInfo.title;
    if (urlEl) urlEl.textContent = this.state.pageInfo.url;

    this.renderTags();
    this.updateSaveButton();
  }

  /**
   * Update save button state
   */
  private updateSaveButton(): void {
    const saveBtn = document.getElementById('saveKnBtn') as HTMLButtonElement | null;
    const loginBtn = document.getElementById('loginBtn');
    const loginHint = document.getElementById('login-hint');

    if (this.state.isLoggedIn) {
      if (saveBtn) saveBtn.classList.remove('hidden');
      if (loginBtn) loginBtn.classList.add('hidden');
      if (loginHint) loginHint.classList.add('hidden');
    } else {
      if (saveBtn) saveBtn.classList.add('hidden');
      if (loginBtn) loginBtn.classList.remove('hidden');
      if (loginHint) loginHint.classList.remove('hidden');
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    document.getElementById('saveKnBtn')?.addEventListener('click', () => {
      this.save();
    });

    // Tags input
    const tagsInput = document.getElementById('tagsInput') as HTMLInputElement | null;
    tagsInput?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && tagsInput.value.trim()) {
        e.preventDefault();
        this.addTag(tagsInput.value.trim());
        tagsInput.value = '';
      }
    });
  }

  /**
   * Add a tag
   */
  addTag(tagName: string): void {
    if (!this.state.selectedTags.includes(tagName)) {
      this.state.selectedTags.push(tagName);
      this.renderTags();
    }
  }

  /**
   * Remove a tag
   */
  removeTag(tagName: string): void {
    this.state.selectedTags = this.state.selectedTags.filter(t => t !== tagName);
    this.renderTags();
  }

  /**
   * Render tag chips
   */
  private renderTags(): void {
    const container = document.getElementById('tagsContainer');
    const input = document.getElementById('tagsInput');
    if (!container || !input) return;

    // Remove existing tag chips
    container.querySelectorAll('.tag-chip').forEach(chip => chip.remove());
    
    // Add tag chips before input
    this.state.selectedTags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `
        ${tag}
        <span class="remove-tag" data-tag="${tag}">×</span>
      `;
      const removeBtn = chip.querySelector('.remove-tag');
      removeBtn?.addEventListener('click', () => {
        this.removeTag(tag);
      });
      container.insertBefore(chip, input);
    });
  }

  /**
   * Save knowledge unit
   */
  async save(): Promise<void> {
    if (!this.state.isLoggedIn) {
      showToast('请先登录', 'error');
      return;
    }

    if (!this.state.pageInfo) {
      showToast('无法获取页面信息', 'error');
      return;
    }

    if (this.state.isSaving) return;
    this.state.isSaving = true;

    const saveBtn = document.getElementById('saveKnBtn') as HTMLButtonElement | null;
    const saveText = document.getElementById('saveKnText');
    const savedInfo = document.getElementById('savedInfo');
    const visibilitySelect = document.getElementById('knVisibility') as HTMLSelectElement | null;
    const visibility = (visibilitySelect?.value || 'private') as Visibility;

    // UI feedback
    if (saveBtn) saveBtn.disabled = true;
    const originalText = saveText?.textContent || '';
    if (saveText) saveText.innerHTML = '<span class="spinner"></span> 保存中...';

    try {
      const storage = await getLocalStorage(['authToken', 'userId']);
      
      if (!storage.authToken) {
        throw new Error('Not authenticated');
      }

      const body: KnowledgeUnitBody = {
        type: this.state.pageInfo.type as KnowledgeType,
        url: this.state.pageInfo.url,
        title: this.state.pageInfo.title,
        visibility,
        tags: this.state.selectedTags.length > 0 ? this.state.selectedTags : undefined,
        metadata: {
          doi: this.state.pageInfo.doi,
          savedAt: new Date().toISOString(),
          source: 'browser-extension',
        },
      };

      if (this.state.pageInfo.doi) {
        body.doi = this.state.pageInfo.doi;
      }

      console.log('📤 Saving knowledge unit:', body);

      const response = await fetch(`${this.researchopiaUrl}/api/kn/units/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storage.authToken}`,
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      console.log('📥 API response:', result);

      if (result.success !== false && !result.error) {
        saveBtn?.classList.add('saved');
        if (saveText) saveText.textContent = '✓ 已保存';
        savedInfo?.classList.remove('hidden');
        
        showToast('已保存到知识网络', 'success');
        
        setTimeout(() => {
          saveBtn?.classList.remove('saved');
          if (saveText) saveText.textContent = originalText;
          if (saveBtn) saveBtn.disabled = false;
        }, 3000);
      } else {
        throw new Error(result.error || 'Save failed');
      }
    } catch (error) {
      console.error('Save failed:', error);
      showToast(error instanceof Error ? error.message : '保存失败', 'error');
      
      if (saveText) saveText.textContent = originalText;
      if (saveBtn) saveBtn.disabled = false;
    } finally {
      this.state.isSaving = false;
    }
  }

  /**
   * Set login status
   */
  setLoggedIn(isLoggedIn: boolean): void {
    this.state.isLoggedIn = isLoggedIn;
    this.updateSaveButton();
  }

  /**
   * Get page info
   */
  getPageInfo(): PageInfo | null {
    return this.state.pageInfo;
  }
}
