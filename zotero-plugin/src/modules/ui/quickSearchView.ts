import type { PaperInfo } from "./types";
import { logger } from "../../utils/logger";
import { containerPadding } from "./styles";

/**
 * 快捷搜索视图
 * 提供多个学术搜索网站的快速访问
 */

interface SearchSite {
  name: string;
  nameZh: string;
  url: (query: string, type: 'doi' | 'title') => string;
  description: string;
  category: 'general' | 'database' | 'repository' | 'chinese';
}

// 搜索网站配置
const searchSites: SearchSite[] = [
  {
    name: 'Google Scholar',
    nameZh: '谷歌学术',
    url: (query, type) => type === 'doi' 
      ? `https://scholar.google.com/scholar?q="${query}"` 
      : `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
    description: '最全面的学术文献搜索引擎',
    category: 'general'
  },
  {
    name: 'Sci-Hub',
    nameZh: 'Sci-Hub',
    url: (query, type) => type === 'doi' 
      ? `https://sci-hub.ru/${query}` 
      : `https://sci-hub.ru/${encodeURIComponent(query)}`,
    description: '免费获取论文全文',
    category: 'repository'
  },
  {
    name: 'Semantic Scholar',
    nameZh: 'Semantic Scholar',
    url: (query, type) => type === 'doi' 
      ? `https://www.semanticscholar.org/search?q=${query}` 
      : `https://www.semanticscholar.org/search?q=${encodeURIComponent(query)}`,
    description: 'AI 驱动的学术搜索和分析',
    category: 'general'
  },
  {
    name: 'Web of Science',
    nameZh: 'Web of Science',
    url: (query, type) => `https://webofscience.clarivate.cn/wos/alldb/basic-search?query=${encodeURIComponent(query)}`,
    description: '权威的学术数据库和引用分析',
    category: 'database'
  },
  {
    name: 'ResearchGate',
    nameZh: 'ResearchGate',
    url: (query, type) => `https://www.researchgate.net/search?q=${encodeURIComponent(query)}`,
    description: '学术社交网络和论文分享平台',
    category: 'general'
  },
  {
    name: 'PubMed',
    nameZh: 'PubMed',
    url: (query, type) => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}`,
    description: '生物医学和生命科学文献数据库',
    category: 'database'
  },
  {
    name: '百度学术',
    nameZh: '百度学术',
    url: (query, type) => `https://xueshu.baidu.com/s?wd=${encodeURIComponent(query)}`,
    description: '百度学术搜索引擎',
    category: 'chinese'
  },
  {
    name: 'arXiv',
    nameZh: 'arXiv',
    url: (query, type) => `https://arxiv.org/search/?query=${encodeURIComponent(query)}&searchtype=all`,
    description: '物理、数学、计算机科学预印本论文库',
    category: 'repository'
  },
  {
    name: 'CrossRef',
    nameZh: 'CrossRef',
    url: (query, type) => type === 'doi' 
      ? `https://search.crossref.org/?q=${query}` 
      : `https://search.crossref.org/?q=${encodeURIComponent(query)}`,
    description: 'DOI 注册和引用链接服务',
    category: 'database'
  },
  {
    name: 'Scholar Mirror',
    nameZh: '学术镜像',
    url: (query, type) => type === 'doi' 
      ? `https://scholar.lanfanshu.cn/scholar?q="${query}"` 
      : `https://scholar.lanfanshu.cn/scholar?q=${encodeURIComponent(query)}`,
    description: 'Google Scholar 镜像站点 (蓝帆学术)',
    category: 'chinese'
  },
  {
    name: 'IEEE Xplore',
    nameZh: 'IEEE Xplore',
    url: (query, type) => `https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=${encodeURIComponent(query)}`,
    description: 'IEEE 电子电气工程师协会数据库',
    category: 'database'
  },
  {
    name: 'SpringerLink',
    nameZh: 'SpringerLink',
    url: (query, type) => `https://link.springer.com/search?query=${encodeURIComponent(query)}`,
    description: 'Springer 出版社学术资源',
    category: 'database'
  },
  {
    name: '中国知网',
    nameZh: '中国知网',
    url: (query, type) => `https://kns.cnki.net/kns8/defaultresult/index?kw=${encodeURIComponent(query)}`,
    description: '中国最大的学术数据库',
    category: 'chinese'
  },
  {
    name: '万方数据',
    nameZh: '万方数据',
    url: (query, type) => `https://www.wanfangdata.com.cn/search/searchList.do?searchWord=${encodeURIComponent(query)}`,
    description: '万方数据知识服务平台',
    category: 'chinese'
  },
  {
    name: 'bioRxiv',
    nameZh: 'bioRxiv',
    url: (query, type) => `https://www.biorxiv.org/search/${encodeURIComponent(query)}`,
    description: '生物学预印本论文服务器',
    category: 'repository'
  }
];

const categoryNames = {
  general: '通用搜索',
  database: '学术数据库',
  repository: '论文仓库',
  chinese: '中文平台'
};

export class QuickSearchView {
  private isExpanded: boolean = false;
  private selectedSites: string[] = [];
  private searchStats: { [key: string]: number } = {};
  private currentPaper: PaperInfo | null = null;

  constructor() {
    this.loadPreferences();
  }

  /**
   * 从Zotero偏好设置加载用户选择
   */
  private loadPreferences(): void {
    try {
      // 加载选中的网站
      const savedSites = Zotero.Prefs.get('extensions.researchopia.quickSearch.selectedSites', true) as string;
      if (savedSites) {
        this.selectedSites = JSON.parse(savedSites);
      } else {
        // 默认选择前8个网站
        this.selectedSites = searchSites.slice(0, 8).map(s => s.name);
      }

      // 加载搜索统计
      const savedStats = Zotero.Prefs.get('extensions.researchopia.quickSearch.stats', true) as string;
      if (savedStats) {
        this.searchStats = JSON.parse(savedStats);
      }
    } catch (error) {
      logger.error("[QuickSearchView] Error loading preferences:", error);
      this.selectedSites = searchSites.slice(0, 8).map(s => s.name);
      this.searchStats = {};
    }
  }

  /**
   * 保存用户选择到Zotero偏好设置
   */
  private savePreferences(): void {
    try {
      Zotero.Prefs.set('extensions.researchopia.quickSearch.selectedSites', JSON.stringify(this.selectedSites), true);
      Zotero.Prefs.set('extensions.researchopia.quickSearch.stats', JSON.stringify(this.searchStats), true);
    } catch (error) {
      logger.error("[QuickSearchView] Error saving preferences:", error);
    }
  }

  /**
   * 渲染快捷搜索视图
   */
  public async render(container: HTMLElement, paperInfo: PaperInfo): Promise<void> {
    logger.log("[QuickSearchView] Rendering quick search view");
    
    this.currentPaper = paperInfo;
    const doc = container.ownerDocument;
    
    container.innerHTML = '';
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: ${containerPadding.content};
      overflow-y: auto;
    `;

    // 创建标题和说明
    const header = this.createHeader(doc, paperInfo);
    container.appendChild(header);

    // 创建搜索按钮网格
    const buttonsGrid = this.createButtonsGrid(doc, paperInfo);
    container.appendChild(buttonsGrid);

    // 创建底部说明
    const footer = this.createFooter(doc);
    container.appendChild(footer);
  }

  /**
   * 创建头部区域
   */
  private createHeader(doc: Document, paperInfo: PaperInfo): HTMLElement {
    const header = doc.createElement('div');
    header.style.cssText = `
      margin-bottom: 16px;
      padding: 16px;
      background: #ffffff;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    `;

    const infoDiv = doc.createElement('div');
    infoDiv.style.cssText = 'margin-bottom: 12px;'; // 垂直布局,文字在上
    infoDiv.innerHTML = `
      <div style="font-size: 16px; font-weight: 700; color: #1f2937; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px;">🔍</span>
        <span>快捷搜索</span>
      </div>
      <div style="font-size: 13px; color: #6b7280; line-height: 1.5;">
        ${paperInfo.doi
          ? `基于 DOI <code style="background: #f3f4f6; padding: 3px 8px; border-radius: 6px; font-size: 12px; color: #4b5563; font-weight: 500;">${paperInfo.doi}</code> 在其他学术平台搜索此论文`
          : '基于论文标题在其他学术平台搜索此论文'
        }
      </div>
    `;

    const buttonsDiv = doc.createElement('div');
    buttonsDiv.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;'; // 按钮靠右对齐

    // 展开/收起按钮
    const filteredSites = searchSites.filter(site => this.selectedSites.includes(site.name));
    if (filteredSites.length > 6) {
      const toggleBtn = doc.createElement('button');
      toggleBtn.textContent = this.isExpanded ? '📤 收起' : '📥 展开';
      toggleBtn.style.cssText = `
        padding: 6px 12px;
        font-size: 12px;
        background: #f0fdf4;
        color: #15803d;
        border: 1px solid #86efac;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;
      `;
      toggleBtn.addEventListener('mouseenter', () => {
        toggleBtn.style.background = '#dcfce7';
      });
      toggleBtn.addEventListener('mouseleave', () => {
        toggleBtn.style.background = '#f0fdf4';
      });
      toggleBtn.addEventListener('click', () => {
        this.isExpanded = !this.isExpanded;
        this.render(doc.getElementById('researchopia-content') as HTMLElement, this.currentPaper!);
      });
      buttonsDiv.appendChild(toggleBtn);
    }

    // 设置按钮
    const settingsBtn = doc.createElement('button');
    settingsBtn.textContent = '⚙️ 设置';
    settingsBtn.style.cssText = `
      padding: 6px 12px;
      font-size: 12px;
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #93c5fd;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    `;
    settingsBtn.addEventListener('mouseenter', () => {
      settingsBtn.style.background = '#dbeafe';
    });
    settingsBtn.addEventListener('mouseleave', () => {
      settingsBtn.style.background = '#eff6ff';
    });
    settingsBtn.addEventListener('click', () => this.showSettingsDialog(doc));

    buttonsDiv.appendChild(settingsBtn);
    header.appendChild(infoDiv);
    header.appendChild(buttonsDiv);

    return header;
  }

  /**
   * 创建搜索按钮网格
   */
  private createButtonsGrid(doc: Document, paperInfo: PaperInfo): HTMLElement {
    const grid = doc.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
      padding: 4px;
    `;

    const filteredSites = searchSites.filter(site => this.selectedSites.includes(site.name));
    const displaySites = this.isExpanded ? filteredSites : filteredSites.slice(0, 6);

    displaySites.forEach(site => {
      const button = this.createSearchButton(doc, site, paperInfo);
      grid.appendChild(button);
    });

    return grid;
  }

  /**
   * 创建单个搜索按钮
   */
  private createSearchButton(doc: Document, site: SearchSite, paperInfo: PaperInfo): HTMLElement {
    // 定义品牌色
    const brandColors: { [key: string]: { bg: string, border: string, hover: string } } = {
      'Google Scholar': { bg: '#4285f4', border: '#4285f4', hover: '#1a73e8' },
      'Sci-Hub': { bg: '#dc2626', border: '#dc2626', hover: '#b91c1c' },
      'Semantic Scholar': { bg: '#f97316', border: '#f97316', hover: '#ea580c' },
      'Web of Science': { bg: '#0891b2', border: '#0891b2', hover: '#0e7490' },
      'ResearchGate': { bg: '#00d0b1', border: '#00d0b1', hover: '#00b89f' },
      'PubMed': { bg: '#2563eb', border: '#2563eb', hover: '#1d4ed8' },
      '百度学术': { bg: '#2319dc', border: '#2319dc', hover: '#1810b0' },
      'arXiv': { bg: '#b91c1c', border: '#b91c1c', hover: '#991b1b' },
      'CrossRef': { bg: '#059669', border: '#059669', hover: '#047857' },
      'Scholar Mirror': { bg: '#7c3aed', border: '#7c3aed', hover: '#6d28d9' },
      'IEEE Xplore': { bg: '#0369a1', border: '#0369a1', hover: '#075985' },
      'SpringerLink': { bg: '#dc2626', border: '#dc2626', hover: '#b91c1c' },
      '中国知网': { bg: '#dc2626', border: '#dc2626', hover: '#b91c1c' },
      '万方数据': { bg: '#0891b2', border: '#0891b2', hover: '#0e7490' },
      'bioRxiv': { bg: '#16a34a', border: '#16a34a', hover: '#15803d' }
    };

    const colors = brandColors[site.name] || { bg: '#6b7280', border: '#6b7280', hover: '#4b5563' };

    const button = doc.createElement('button');
    button.style.cssText = `
      padding: 14px;
      background: #ffffff;
      color: #1f2937;
      border: 2px solid ${colors.border};
      border-radius: 10px;
      cursor: pointer;
      text-align: left;
      transition: all 0.25s ease;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      position: relative;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 80px;
    `;

    button.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-shrink: 0; overflow: hidden;">
        <div style="width: 8px; height: 8px; background: ${colors.bg}; border-radius: 50%; flex-shrink: 0;"></div>
        <div style="font-weight: 600; font-size: 14px; color: ${colors.bg}; word-break: break-word; flex: 1; overflow: hidden; text-overflow: ellipsis;">${site.nameZh}</div>
      </div>
      <div style="font-size: 12px; color: #6b7280; line-height: 1.4; word-break: break-word; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${site.description}</div>
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = colors.bg;
      button.style.color = '#ffffff';
      button.style.transform = 'translateY(-4px) scale(1.02)';
      button.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.15)';

      // 改变内部文字颜色
      const titleDiv = button.querySelector('div > div:nth-child(2)') as HTMLElement;
      const descDiv = button.querySelector('div:nth-child(2)') as HTMLElement;
      if (titleDiv) titleDiv.style.color = '#ffffff';
      if (descDiv) descDiv.style.color = 'rgba(255, 255, 255, 0.9)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#ffffff';
      button.style.color = '#1f2937';
      button.style.transform = 'translateY(0) scale(1)';
      button.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.08)';

      // 恢复内部文字颜色
      const titleDiv = button.querySelector('div > div:nth-child(2)') as HTMLElement;
      const descDiv = button.querySelector('div:nth-child(2)') as HTMLElement;
      if (titleDiv) titleDiv.style.color = colors.bg;
      if (descDiv) descDiv.style.color = '#6b7280';
    });

    button.addEventListener('click', () => this.handleSearch(site, paperInfo));

    return button;
  }

  /**
   * 创建底部说明
   */
  private createFooter(doc: Document): HTMLElement {
    const footer = doc.createElement('div');
    footer.style.cssText = `
      padding-top: 12px;
      border-top: 1px solid #e9ecef;
      font-size: 11px;
      color: #9ca3af;
    `;

    const filteredSites = searchSites.filter(site => this.selectedSites.includes(site.name));

    footer.innerHTML = `
      <div style="display: flex; gap: 12px; margin-bottom: 8px; flex-wrap: wrap;">
        <span style="display: flex; align-items: center; gap: 4px;">
          <span style="width: 8px; height: 8px; background: #3b82f6; border-radius: 50%;"></span>
          <span>通用搜索</span>
        </span>
        <span style="display: flex; align-items: center; gap: 4px;">
          <span style="width: 8px; height: 8px; background: #8b5cf6; border-radius: 50%;"></span>
          <span>专业数据库</span>
        </span>
        <span style="display: flex; align-items: center; gap: 4px;">
          <span style="width: 8px; height: 8px; background: #f97316; border-radius: 50%;"></span>
          <span>论文仓库</span>
        </span>
        <span style="display: flex; align-items: center; gap: 4px;">
          <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></span>
          <span>中文平台</span>
        </span>
      </div>
      <div>💡 点击按钮将在浏览器中打开对应网站的搜索结果 • 显示 ${filteredSites.length}/${searchSites.length} 个网站</div>
    `;

    return footer;
  }

  /**
   * 处理搜索按钮点击
   */
  private handleSearch(site: SearchSite, paperInfo: PaperInfo): void {
    try {
      // 优先使用 DOI，如果没有则使用标题
      const query = paperInfo.doi || paperInfo.title;
      const queryType = paperInfo.doi ? 'doi' : 'title';

      const url = site.url(query, queryType);

      // 统计点击次数
      this.searchStats[site.name] = (this.searchStats[site.name] || 0) + 1;
      this.savePreferences();

      // 打开URL
      this.openExternalURL(url);

      logger.log("[QuickSearchView] Opened search URL:", site.nameZh, url);
    } catch (error) {
      logger.error("[QuickSearchView] Error opening search URL:", error);
    }
  }

  /**
   * 打开外部URL
   * 使用Zotero.launchURL避免浏览器选择弹窗
   */
  private openExternalURL(url: string): void {
    try {
      // 使用Zotero的官方API打开外部链接，避免弹窗
      (Zotero as any).launchURL(url);
      logger.log("[QuickSearchView] Opened URL via Zotero.launchURL:", url);
    } catch (error) {
      logger.error("[QuickSearchView] Error opening external URL:", error);
    }
  }

  /**
   * 显示设置对话框
   */
  private showSettingsDialog(doc: Document): void {
    // 获取当前容器
    const contentSection = doc.getElementById('researchopia-content');
    if (!contentSection) {
      logger.error("[QuickSearchView] Content section not found");
      return;
    }

    // 创建模态对话框
    const overlay = doc.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const dialog = doc.createElement('div');
    dialog.style.cssText = `
      background: #ffffff;
      border-radius: 16px;
      padding: 28px;
      width: 650px;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

    // 标题栏
    const header = doc.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e5e7eb;
    `;
    header.innerHTML = `
      <div style="font-size: 20px; font-weight: 700; color: #1f2937; display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 24px;">⚙️</span>
        <span>搜索偏好设置</span>
      </div>
    `;

    const closeBtn = doc.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: #f3f4f6;
      border: none;
      font-size: 22px;
      cursor: pointer;
      color: #6b7280;
      padding: 0;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      transition: all 0.2s;
    `;
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#e5e7eb';
      closeBtn.style.color = '#1f2937';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = '#f3f4f6';
      closeBtn.style.color = '#6b7280';
    });
    closeBtn.addEventListener('click', () => overlay.remove());
    header.appendChild(closeBtn);

    // 说明文字
    const description = doc.createElement('div');
    description.style.cssText = 'font-size: 14px; color: #6b7280; margin-bottom: 20px; line-height: 1.6;';
    description.textContent = '💡 选择您希望在快捷搜索中显示的学术网站，支持按分类快速选择';

    // 快捷操作按钮
    const quickActions = doc.createElement('div');
    quickActions.style.cssText = 'display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;';

    const actionButtons = [
      { text: '✓ 全选', action: () => this.selectAll(), color: '#10b981' },
      { text: '✗ 全不选', action: () => this.selectNone(), color: '#ef4444' },
      { text: '🌐 通用搜索', action: () => this.selectByCategory('general'), color: '#3b82f6' },
      { text: '📚 学术数据库', action: () => this.selectByCategory('database'), color: '#8b5cf6' },
      { text: '📄 论文仓库', action: () => this.selectByCategory('repository'), color: '#f97316' },
      { text: '🇨🇳 中文平台', action: () => this.selectByCategory('chinese'), color: '#10b981' }
    ];

    actionButtons.forEach(({ text, action, color }) => {
      const btn = doc.createElement('button');
      btn.textContent = text;
      btn.style.cssText = `
        padding: 8px 16px;
        font-size: 13px;
        background: #ffffff;
        color: ${color};
        border: 2px solid ${color};
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 38px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-sizing: border-box;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = color;
        btn.style.color = '#ffffff';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#ffffff';
        btn.style.color = color;
      });
      btn.addEventListener('click', () => {
        action();
        this.renderSitesList(sitesContainer);
      });
      quickActions.appendChild(btn);
    });

    // 网站列表容器
    const sitesContainer = doc.createElement('div');
    this.renderSitesList(sitesContainer);

    // 底部按钮
    const footer = doc.createElement('div');
    footer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
    `;

    const countInfo = doc.createElement('div');
    countInfo.style.cssText = 'font-size: 14px; color: #6b7280; font-weight: 500;';
    countInfo.innerHTML = `
      <span style="color: #1f2937;">已选择</span>
      <span style="color: #3b82f6; font-weight: 700; font-size: 16px;">${this.selectedSites.length}</span>
      <span style="color: #9ca3af;">/</span>
      <span style="color: #6b7280;">${searchSites.length}</span>
      <span style="color: #1f2937;">个网站</span>
    `;

    const buttonGroup = doc.createElement('div');
    buttonGroup.style.cssText = 'display: flex; gap: 10px;';

    const cancelBtn = doc.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
      padding: 10px 20px;
      font-size: 14px;
      background: #f3f4f6;
      color: #4b5563;
      border: 2px solid #d1d5db;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 44px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;
    `;
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.background = '#e5e7eb';
      cancelBtn.style.borderColor = '#9ca3af';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.background = '#f3f4f6';
      cancelBtn.style.borderColor = '#d1d5db';
    });
    cancelBtn.addEventListener('click', () => {
      this.loadPreferences(); // 恢复原设置
      overlay.remove();
    });

    const saveBtn = doc.createElement('button');
    saveBtn.textContent = '✓ 保存设置';
    saveBtn.style.cssText = `
      padding: 10px 24px;
      font-size: 14px;
      background: #3b82f6;
      color: white;
      border: 2px solid #3b82f6;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      height: 44px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;
    `;
    saveBtn.addEventListener('mouseenter', () => {
      saveBtn.style.background = '#2563eb';
      saveBtn.style.borderColor = '#2563eb';
      saveBtn.style.transform = 'translateY(-2px)';
      saveBtn.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
    });
    saveBtn.addEventListener('mouseleave', () => {
      saveBtn.style.background = '#3b82f6';
      saveBtn.style.borderColor = '#3b82f6';
      saveBtn.style.transform = 'translateY(0)';
      saveBtn.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
    });
    saveBtn.addEventListener('click', () => {
      this.savePreferences();
      overlay.remove();
      // 重新渲染主视图
      const contentSection = doc.getElementById('researchopia-content') as HTMLElement;
      if (contentSection && this.currentPaper) {
        this.render(contentSection, this.currentPaper);
      }
    });

    buttonGroup.appendChild(cancelBtn);
    buttonGroup.appendChild(saveBtn);
    footer.appendChild(countInfo);
    footer.appendChild(buttonGroup);

    // 组装对话框
    dialog.appendChild(header);
    dialog.appendChild(description);
    dialog.appendChild(quickActions);
    dialog.appendChild(sitesContainer);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);

    // 点击遮罩层关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.loadPreferences(); // 恢复原设置
        overlay.remove();
      }
    });

    // 添加到内容区域而不是body
    contentSection.appendChild(overlay);
  }

  /**
   * 渲染网站列表（用于设置对话框）
   */
  private renderSitesList(container: HTMLElement): void {
    const doc = container.ownerDocument;
    container.innerHTML = '';
    container.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';

    // 按分类组织网站
    const sitesByCategory: { [key: string]: SearchSite[] } = {};
    searchSites.forEach(site => {
      if (!sitesByCategory[site.category]) {
        sitesByCategory[site.category] = [];
      }
      sitesByCategory[site.category].push(site);
    });

    // 分类图标和颜色
    const categoryIcons: { [key: string]: { icon: string, color: string } } = {
      'general': { icon: '🌐', color: '#3b82f6' },
      'database': { icon: '📚', color: '#8b5cf6' },
      'repository': { icon: '📄', color: '#f97316' },
      'chinese': { icon: '🇨🇳', color: '#10b981' }
    };

    // 渲染每个分类
    Object.entries(sitesByCategory).forEach(([category, sites]) => {
      const categorySection = doc.createElement('div');
      categorySection.style.cssText = `
        background: #f9fafb;
        border-radius: 12px;
        padding: 16px;
        border: 1px solid #e5e7eb;
      `;

      const categoryInfo = categoryIcons[category] || { icon: '📌', color: '#6b7280' };

      const categoryTitle = doc.createElement('div');
      categoryTitle.style.cssText = `
        font-size: 15px;
        font-weight: 700;
        color: #1f2937;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      categoryTitle.innerHTML = `
        <span style="font-size: 18px;">${categoryInfo.icon}</span>
        <span>${categoryNames[category as keyof typeof categoryNames]}</span>
        <span style="font-size: 13px; color: #9ca3af; font-weight: 500;">(${sites.length})</span>
      `;

      const sitesGrid = doc.createElement('div');
      sitesGrid.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 10px;
      `;

      sites.forEach(site => {
        const isSelected = this.selectedSites.includes(site.name);
        const categoryInfo = categoryIcons[site.category] || { icon: '📌', color: '#6b7280' };

        const siteItem = doc.createElement('label');
        siteItem.style.cssText = `
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px;
          background: ${isSelected ? '#ffffff' : '#ffffff'};
          border: 2px solid ${isSelected ? categoryInfo.color : '#e5e7eb'};
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: ${isSelected ? `0 2px 8px ${categoryInfo.color}40` : '0 1px 3px rgba(0, 0, 0, 0.05)'};
          width: 100%;
          box-sizing: border-box;
        `;

        siteItem.addEventListener('mouseenter', () => {
          if (!isSelected) {
            siteItem.style.borderColor = categoryInfo.color;
            siteItem.style.boxShadow = `0 2px 8px ${categoryInfo.color}20`;
          }
        });
        siteItem.addEventListener('mouseleave', () => {
          if (!isSelected) {
            siteItem.style.borderColor = '#e5e7eb';
            siteItem.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
          }
        });

        // 自定义开关样式
        const switchContainer = doc.createElement('div');
        switchContainer.style.cssText = `
          position: relative;
          width: 40px;
          height: 22px;
          flex-shrink: 0;
          margin-top: 2px;
        `;

        const checkbox = doc.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isSelected;
        checkbox.style.cssText = 'display: none;';
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            if (!this.selectedSites.includes(site.name)) {
              this.selectedSites.push(site.name);
            }
          } else {
            this.selectedSites = this.selectedSites.filter(name => name !== site.name);
          }
          this.renderSitesList(container);
        });

        const switchTrack = doc.createElement('div');
        switchTrack.style.cssText = `
          width: 40px;
          height: 22px;
          background: ${isSelected ? categoryInfo.color : '#d1d5db'};
          border-radius: 11px;
          position: relative;
          transition: all 0.2s;
        `;

        const switchThumb = doc.createElement('div');
        switchThumb.style.cssText = `
          width: 18px;
          height: 18px;
          background: white;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          left: ${isSelected ? '20px' : '2px'};
          transition: all 0.2s;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        `;

        switchTrack.appendChild(switchThumb);
        switchContainer.appendChild(checkbox);
        switchContainer.appendChild(switchTrack);

        const textDiv = doc.createElement('div');
        textDiv.style.cssText = 'flex: 1; min-width: 0; overflow: hidden;';
        textDiv.innerHTML = `
          <div style="font-size: 13px; font-weight: 600; color: #1f2937; margin-bottom: 4px; word-break: break-word;">
            ${site.nameZh}
          </div>
          <div style="font-size: 12px; color: #6b7280; line-height: 1.4; word-break: break-word;">
            ${site.description}
          </div>
        `;

        siteItem.appendChild(switchContainer);
        siteItem.appendChild(textDiv);
        sitesGrid.appendChild(siteItem);
      });

      categorySection.appendChild(categoryTitle);
      categorySection.appendChild(sitesGrid);
      container.appendChild(categorySection);
    });
  }

  /**
   * 选择所有网站
   */
  private selectAll(): void {
    this.selectedSites = searchSites.map(site => site.name);
  }

  /**
   * 取消选择所有网站
   */
  private selectNone(): void {
    this.selectedSites = [];
  }

  /**
   * 按分类选择网站
   */
  private selectByCategory(category: string): void {
    const categorySites = searchSites
      .filter(site => site.category === category)
      .map(site => site.name);

    // 添加到已选择列表（去重）
    this.selectedSites = [...new Set([...this.selectedSites, ...categorySites])];
  }
}

