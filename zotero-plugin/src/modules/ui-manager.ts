/**
 * UI管理模块
 * 负责注册和管理Zotero item pane中的自定义面板
 * 使用Zotero 7/8的官方ItemPaneManager API
 */

import { logger } from "../utils/logger";
import { AuthManager } from "./auth";
import { SupabaseManager } from "./supabase";
import { MyAnnotationsView } from "./ui/myAnnotationsView";
import { SharedAnnotationsView } from "./ui/sharedAnnotationsView";
import { PaperEvaluationView } from "./ui/paperEvaluationView";
import { QuickSearchView } from "./ui/quickSearchView";
import { createPaperInfoSection, createButtonsSection, createContentSection } from "./ui/components";
import type {
  BaseViewContext,
  PanelElements,
  PaperInfo,
  ViewMode,
  MessageType
} from "./ui/types";

export class UIManager {
  private static instance: UIManager | null = null;
  private isInitialized = false;
  private supabaseManager: SupabaseManager;
  private readonly viewContext: BaseViewContext;
  private readonly myAnnotationsView: MyAnnotationsView;
  private readonly sharedAnnotationsView: SharedAnnotationsView;
  private readonly paperEvaluationView: PaperEvaluationView;
  private currentItem: any = null;
  private currentViewMode: ViewMode = 'none';
  private panelId = 'researchopia-panel';
  private panelDocument: Document | null = null; // 保存ItemPane的document引用(当前活动标签)
  private itemDocuments: Map<number, Document> = new Map(); // 存储每个item ID对应的document引用
  private currentItemId: number | null = null; // 保存当前正在处理的item ID

  private readonly quickSearchView: QuickSearchView;

  private constructor() {
    this.supabaseManager = new SupabaseManager();
    this.viewContext = this.createViewContext();
    this.myAnnotationsView = new MyAnnotationsView(this.viewContext);
    this.sharedAnnotationsView = new SharedAnnotationsView(this.viewContext);
    this.paperEvaluationView = new PaperEvaluationView(this.viewContext);
    this.quickSearchView = new QuickSearchView();
  }

  private createViewContext(): BaseViewContext {
    return {
      supabaseManager: this.supabaseManager,
      showMessage: (message: string, type: MessageType = 'info') => this.showMessage(message, type),
      getPanelsForCurrentItem: () => this.getPanelsForCurrentItem(),
      getCurrentItem: () => this.currentItem,
      isActive: () => this.currentViewMode !== 'none',
      handleButtonClick: (mode: ViewMode, originElement?: HTMLElement) => this.handleButtonClick(mode, originElement)
    };
  }

  private collectPanelElements(root: HTMLElement): PanelElements {
    return {
      root,
      paperInfoSection: root.querySelector('[data-researchopia-role="paper-info"]') as HTMLElement | null,
      titleElement: root.querySelector('[data-researchopia-role="paper-title"]') as HTMLElement | null,
      authorsElement: root.querySelector('[data-researchopia-role="paper-authors"]') as HTMLElement | null,
      authorsTextElement: root.querySelector('[data-researchopia-role="paper-authors-text"]') as HTMLElement | null,
      yearElement: root.querySelector('[data-researchopia-role="paper-year"]') as HTMLElement | null,
      journalElement: root.querySelector('[data-researchopia-role="paper-journal"]') as HTMLElement | null,
      doiElement: root.querySelector('[data-researchopia-role="paper-doi"]') as HTMLElement | null,
      contentSection: root.querySelector('[data-researchopia-role="content"]') as HTMLElement | null
    };
  }

  private getPanelElements(targetDoc?: Document | null): PanelElements[] {
    const doc = targetDoc || this.panelDocument;
    if (!doc) {
      return [];
    }

    const roots = doc.querySelectorAll<HTMLElement>('[data-researchopia-panel="true"]');
    if (roots.length === 0) {
      return [];
    }

    return Array.from(roots).map(root => this.collectPanelElements(root));
  }

  private getPanelsForCurrentItem(): PanelElements[] {
    const doc = (this.currentItemId && this.itemDocuments.get(this.currentItemId)) || this.panelDocument;
    return this.getPanelElements(doc);
  }

  public static getInstance(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
    }
    return UIManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.log("[UIManager] 🎨 Initializing UI Manager...");

    try {
      // 确保ItemPaneManager可用 (Zotero 7+)
      if (!(Zotero as any).ItemPaneManager) {
        throw new Error("ItemPaneManager not available. Requires Zotero 7+");
      }

      // 注册自定义item pane section
      this.registerItemPaneSection();

      // 监听PDF页面标注点击事件，高亮插件面板中的对应卡片
      this.setupAnnotationClickListener();

      this.isInitialized = true;
      logger.log("[UIManager] ✅ UI Manager initialized successfully");
    } catch (error) {
      logger.error("[UIManager] ❌ Initialization error:", error);
      throw error;
    }
  }

  /**
   * 设置标注点击事件监听器
   * 当PDF页面上的标注被点击时，高亮插件面板中的对应卡片
   */
  private setupAnnotationClickListener(): void {
    try {
      const win = (Zotero as any).getMainWindow();
      if (!win) {
        logger.warn("[UIManager] ⚠️ Main window not available for event listener");
        return;
      }

      // 监听标注点击事件，高亮对应卡片
      win.addEventListener('researchopia-scroll-to-annotation', (event: any) => {
        const annotationId = event.detail?.annotationId;
        if (!annotationId) {
          logger.warn("[UIManager] ⚠️ No annotation ID in event");
          return;
        }

        logger.log("[UIManager] 📍 Received scroll-to-annotation event:", annotationId);
        this.highlightAnnotationCard(annotationId);
      });

      // 监听清除高亮事件，清除所有卡片高亮
      win.addEventListener('researchopia-clear-card-highlight', () => {
        logger.log("[UIManager] 🔄 Received clear-card-highlight event");
        this.clearAllCardHighlights();
      });

      logger.log("[UIManager] ✅ Annotation click listener setup complete");
    } catch (error) {
      logger.error("[UIManager] ❌ Error setting up annotation click listener:", error);
    }
  }

  /**
   * 高亮插件面板中的标注卡片
   */
  private highlightAnnotationCard(annotationId: string): void {
    try {
      if (!this.panelDocument) {
        logger.warn("[UIManager] ⚠️ Panel document not available");
        return;
      }

      // 查找对应的卡片
      const card = this.panelDocument.querySelector(
        `.shared-annotation-card[data-annotation-id="${annotationId}"]`
      ) as HTMLElement;

      if (!card) {
        logger.warn("[UIManager] ⚠️ Card not found for annotation:", annotationId);
        return;
      }

      // 清除之前的高亮
      this.clearAllCardHighlights();

      // 高亮当前卡片
      card.classList.add('highlighted');
      card.style.background = 'rgba(0, 123, 255, 0.1)';
      card.style.transform = 'translateY(-2px)';

      // 滚动到可视区域
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });

      logger.log("[UIManager] ✅ Card highlighted:", annotationId);
    } catch (error) {
      logger.error("[UIManager] ❌ Error highlighting card:", error);
    }
  }

  /**
   * 清除所有卡片的高亮效果
   */
  private clearAllCardHighlights(): void {
    try {
      if (!this.panelDocument) {
        return;
      }

      const highlightedCards = this.panelDocument.querySelectorAll('.shared-annotation-card.highlighted');
      highlightedCards.forEach(el => {
        el.classList.remove('highlighted');
        (el as HTMLElement).style.background = 'var(--material-background)';
        (el as HTMLElement).style.transform = 'translateY(0)';
      });

      logger.log("[UIManager] 🔄 Cleared all card highlights");
    } catch (error) {
      logger.error("[UIManager] ❌ Error clearing card highlights:", error);
    }
  }

  /**
   * 注册Item Pane Section
   */
  private registerItemPaneSection(): void {
    const ItemPaneManager = (Zotero as any).ItemPaneManager;

    logger.log("[UIManager] 📝 Registering item pane section...");

    // 注册section
    ItemPaneManager.registerSection({
      paneID: this.panelId,
      pluginID: "researchopia@occasional15.com",
      header: {
        l10nID: "researchopia-section-header",
        icon: "chrome://researchopia/content/icons/icon20.svg"
      },
      sidenav: {
        l10nID: "researchopia-section-sidenav",
        icon: "chrome://researchopia/content/icons/icon20.svg"
      },
      onRender: ({ doc, body, item, editable, tabType }: any) => {
        logger.log("[UIManager] onRender called with item:", item?.id, "tabType:", tabType);
        
        // 检查容器是否已有内容
        const hasContent = body.children.length > 0;
        logger.log("[UIManager] Container hasContent:", hasContent);
        
        // 只在容器为空时渲染面板UI结构
        if (!hasContent) {
          this.renderPanel(doc, body);
          logger.log("[UIManager] ✅ Panel rendered, panelDocument updated to:", doc?.location?.href || "unknown");
        } else {
          // 容器已有内容，只更新document引用
          this.panelDocument = doc;
          logger.log("[UIManager] ⏭️ Panel already exists, skipped re-rendering, panelDocument updated to:", doc?.location?.href || "unknown");
        }
        
        // 保存item ID到document的映射
        let targetItem = this.getCorrectItem(item, tabType);
        if (targetItem && targetItem.id) {
          this.itemDocuments.set(targetItem.id, doc);
          logger.log("[UIManager] 💾 Saved document for item:", targetItem.id);
        }
        
        // 🔧 关键修复：传递正确的doc参数给handleItemChange
        // 确保使用onRender提供的最新document更新面板内容
        if (targetItem) {
          this.handleItemChange(targetItem, doc);
        }
        return;
      },
      onItemChange: ({ item, setEnabled, tabType, doc }: any) => {
        logger.log("[UIManager] onItemChange called with item:", item?.id, "tabType:", tabType);
        // 允许在所有tab中显示
        setEnabled(true);
        
        // 更新当前的panelDocument引用(这是关键!)
        if (doc) {
          this.panelDocument = doc;
          logger.log("[UIManager] Updated panelDocument in onItemChange");
        }
        
        // 获取正确的item并更新
        const targetItem = this.getCorrectItem(item, tabType);
        if (targetItem && doc) {
          // 保存item ID到document的映射
          // 如果targetItem是PDF attachment,需要获取父条目ID并同时保存两个映射
          if (targetItem.isAttachment && targetItem.isAttachment()) {
            // 保存attachment ID -> doc
            this.itemDocuments.set(targetItem.id, doc);
            logger.log("[UIManager] 💾 Updated document mapping for attachment:", targetItem.id);
            
            // 如果有父条目,也保存父条目ID -> doc
            const parentItemID = targetItem.parentItemID;
            if (parentItemID) {
              this.itemDocuments.set(parentItemID, doc);
              logger.log("[UIManager] 💾 Updated document mapping for parent item:", parentItemID);
            }
          } else {
            // 普通条目,直接保存
            this.itemDocuments.set(targetItem.id, doc);
            logger.log("[UIManager] 💾 Updated document mapping for item:", targetItem.id);
          }
          
          this.handleItemChange(targetItem);
        }
      },
      onDestroy: () => {
        this.cleanup();
      }
    });

    logger.log("[UIManager] ✅ Item pane section registered");
  }

  /**
   * 渲染面板主体
   */
  private renderPanel(doc: Document, container: HTMLElement): void {
    logger.log("[UIManager] 🎨 Rendering panel...");

    // 保存document引用
    this.panelDocument = doc;

    // 清空容器
    container.innerHTML = '';

    // 创建主容器
    const mainContainer = doc.createElement('div');
    mainContainer.id = 'researchopia-main-container';
    mainContainer.setAttribute('data-researchopia-panel', 'true');
    mainContainer.style.cssText = `
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--material-background);
      min-height: 400px;
    `;

    // 论文信息区域
    const paperInfoSection = createPaperInfoSection(doc);
    mainContainer.appendChild(paperInfoSection);

    // 功能按钮区域
    const buttonsSection = createButtonsSection(doc, this.handleButtonClick.bind(this));
    mainContainer.appendChild(buttonsSection);

    // 内容展示区域
    const contentSection = createContentSection(doc);
    mainContainer.appendChild(contentSection);

    container.appendChild(mainContainer);

    logger.log("[UIManager] ✅ Panel rendered");
  }



  /**
   * 获取正确的item(处理reader tab和attachment的情况)
   */
  private getCorrectItem(item: any, tabType: string): any {
    logger.log("[UIManager] Getting correct item for tabType:", tabType, "item:", item?.id);
    
    // 如果在reader tab中,尝试从reader获取PDF附件item
    if (tabType === 'reader') {
      try {
        const win = Zotero.getMainWindow();
        if (win && win.Zotero_Tabs) {
          const selectedID = win.Zotero_Tabs.selectedID;
          logger.log("[UIManager] Selected tab ID:", selectedID);
          
          // 尝试多种方式获取tab对象
          let selectedTab: any = null;
          
          // 方法1: 如果_tabs是Map
          if (win.Zotero_Tabs._tabs && typeof win.Zotero_Tabs._tabs.get === 'function') {
            selectedTab = win.Zotero_Tabs._tabs.get(selectedID);
            logger.log("[UIManager] Got tab via Map.get():", !!selectedTab);
          }
          
          // 方法2: 如果_tabs是数组
          if (!selectedTab && Array.isArray(win.Zotero_Tabs._tabs)) {
            selectedTab = win.Zotero_Tabs._tabs.find((t: any) => t.id === selectedID);
            logger.log("[UIManager] Got tab via Array.find():", !!selectedTab);
          }
          
          // 方法3: 使用_tabs.values()迭代
          if (!selectedTab && win.Zotero_Tabs._tabs && typeof win.Zotero_Tabs._tabs.values === 'function') {
            const tabs = Array.from(win.Zotero_Tabs._tabs.values());
            selectedTab = tabs.find((t: any) => t.id === selectedID);
            logger.log("[UIManager] Got tab via values() iteration:", !!selectedTab);
          }
          
          logger.log("[UIManager] Selected tab:", selectedTab);
          
          if (selectedTab && selectedTab.type === 'reader' && selectedTab.data?.itemID) {
            const readerItem = Zotero.Items.get(selectedTab.data.itemID);
            logger.log("[UIManager] Got PDF attachment from reader tab:", readerItem?.id);
            return readerItem;
          }
        }
      } catch (error) {
        // 记录详细的错误信息
        logger.error("[UIManager] Error getting item from reader:", error);
        if (error instanceof Error) {
          logger.error("[UIManager] Error message:", error.message);
          logger.error("[UIManager] Error stack:", error.stack);
        }
      }
    }
    
    // 否则使用传入的item
    return item;
  }

  /**
   * 处理item变化
   */
  private async handleItemChange(item: any, explicitDoc?: Document): Promise<void> {
    logger.log("[UIManager] 📄 Item changed:", item?.id);

    // 如果是PDF附件,获取其父条目
    let targetItem = item;
    if (item && item.isAttachment && item.isAttachment()) {
      logger.log("[UIManager] Item is attachment, getting parent item");
      const parentItemID = item.parentItemID;
      if (parentItemID) {
        targetItem = Zotero.Items.get(parentItemID);
        logger.log("[UIManager] Got parent item:", targetItem?.id);
      } else {
        logger.warn("[UIManager] Attachment has no parent item");
      }
    }

    this.currentItem = targetItem;
    this.currentItemId = targetItem?.id || null; // 保存当前item ID
    this.currentViewMode = 'none';

    // 🔧 关键修复：优先使用explicitDoc（onRender传递的最新document）
    // 其次使用panelDocument（最近更新的document引用）
    // 不要从itemDocuments Map中查找，因为那可能是其他tab的document
    let itemDoc = explicitDoc || this.panelDocument || undefined;
    if (explicitDoc) {
      logger.log("[UIManager] 📄 Using explicit document from onRender for item:", targetItem?.id);
    } else {
      logger.log("[UIManager] 📄 Using current panelDocument for item:", targetItem?.id);
    }

    if (itemDoc && targetItem?.id) {
      this.itemDocuments.set(targetItem.id, itemDoc);
      logger.log("[UIManager] 💾 Cached document for item:", targetItem.id);
    }

    if (itemDoc && item?.id) {
      this.itemDocuments.set(item.id, itemDoc);
      logger.log("[UIManager] 💾 Cached document for raw item:", item.id);
    }

    // 更新论文信息
    if (targetItem && targetItem.isRegularItem && targetItem.isRegularItem()) {
      this.updatePaperInfo(targetItem, itemDoc);
    } else {
      this.clearPaperInfo(itemDoc);
    }

    // 重置内容区域
    if (itemDoc) {
      const panels = this.getPanelElements(itemDoc);
      for (const [index, panel] of panels.entries()) {
        if (panel.contentSection) {
          logger.log(`[UIManager] 🔄 Resetting content section for panel ${index}`);
          // 简单清空内容，让用户重新点击按钮
          panel.contentSection.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; color: var(--fill-tertiary); font-size: 13px;">
              选择上方功能按钮以开始
            </div>
          `;
        }
      }
    }
  }

  /**
   * 更新论文信息显示
   */
  private updatePaperInfo(item: any, targetDoc?: Document, attempt = 0): void {
    const paperInfo = this.extractPaperInfo(item);
    
    logger.log("[UIManager] Updating paper info:", paperInfo);

    // 使用传入的document或默认panelDocument
    const doc = targetDoc || this.panelDocument;
    logger.log("[UIManager] 🔍 Document source:", targetDoc ? "parameter" : "panelDocument");
    logger.log("[UIManager] 🔍 Document URL:", doc?.location?.href || "unknown");
    
    if (!doc) {
      logger.error("[UIManager] Panel document not available");
      return;
    }

    const panels = this.getPanelElements(doc);
    if (panels.length === 0) {
      if (doc?.defaultView && attempt < 5) {
        const nextAttempt = attempt + 1;
        logger.log(`[UIManager] ℹ️ Panel elements not ready, scheduling retry ${nextAttempt}/5`);
        doc.defaultView.setTimeout(() => this.updatePaperInfo(item, targetDoc, nextAttempt), 60);
      } else {
        logger.warn("[UIManager] No panel instances found in document after retries");
      }
      return;
    }

    logger.log("[UIManager] Elements found:", panels.map((panel, index) => ({
      panelIndex: index,
      titleElement: !!panel.titleElement,
      authorsElement: !!panel.authorsElement,
      authorsTextElement: !!panel.authorsTextElement,
      yearElement: !!panel.yearElement,
      journalElement: !!panel.journalElement,
      doiElement: !!panel.doiElement
    })));

    let updatedCount = 0;

    panels.forEach((panel, index) => {
      const {
        titleElement,
        authorsElement,
        authorsTextElement,
        yearElement,
        journalElement,
        doiElement,
        paperInfoSection,
        root
      } = panel;

      if (!titleElement || !titleElement.parentElement) {
        logger.log(`[UIManager] ⏳ Panel ${index} DOM not ready yet (no parent), skipping update for this panel`);
        return;
      }

      titleElement.textContent = paperInfo.title || '无标题';
      logger.log(`[UIManager] Updated title for panel ${index} to:`, paperInfo.title);
      logger.log(`[UIManager] 🔍 Panel ${index} titleElement textContent after update:`, titleElement.textContent);

      if (paperInfoSection) {
        paperInfoSection.style.visibility = 'visible';
        logger.log(`[UIManager] 🎨 Panel ${index} paper-info section set to visible`);
      }

      if (root) {
        root.style.visibility = 'visible';
        logger.log(`[UIManager] 🎨 Panel ${index} main container set to visible`);
      }

      if (authorsElement && authorsTextElement) {
        if (paperInfo.authors && paperInfo.authors.length > 0) {
          authorsElement.style.display = 'block';
          const displayAuthors = paperInfo.authors.length > 3
            ? paperInfo.authors.slice(0, 3).join(', ') + ` 等 ${paperInfo.authors.length} 人`
            : paperInfo.authors.join(', ');
          authorsTextElement.textContent = displayAuthors;
        } else {
          authorsElement.style.display = 'none';
        }
      }

      if (yearElement) {
        if (paperInfo.year) {
          yearElement.style.display = 'inline';
          yearElement.innerHTML = `<strong>年份:</strong> ${paperInfo.year}`;
        } else {
          yearElement.style.display = 'none';
        }
      }

      if (journalElement) {
        if (paperInfo.journal) {
          journalElement.style.display = 'inline';
          journalElement.innerHTML = `<strong>期刊:</strong> ${paperInfo.journal}`;
        } else {
          journalElement.style.display = 'none';
        }
      }

      if (doiElement) {
        if (paperInfo.doi) {
          doiElement.style.display = 'inline';
          const doiTextSpan = doiElement.querySelector('.doi-text');
          if (doiTextSpan) {
            doiTextSpan.textContent = `DOI: ${paperInfo.doi}`;
          } else {
            // 如果没有找到.doi-text元素，则创建完整结构
            doiElement.innerHTML = `<span class="doi-text">DOI: ${paperInfo.doi}</span>`;
          }

          // 添加点击复制功能
          this.attachDoiCopyHandler(doiElement, paperInfo.doi);
        } else {
          doiElement.style.display = 'none';
        }
      }

      updatedCount += 1;
    });

    if (updatedCount === 0) {
      logger.warn("[UIManager] No panel updated because all were pending DOM readiness");
    }
  }

  /**
   * 为DOI元素添加点击复制功能
   */
  private attachDoiCopyHandler(doiElement: HTMLElement, doi: string): void {
    // 移除旧的事件监听器（通过克隆元素）
    const newDoiElement = doiElement.cloneNode(true) as HTMLElement;
    doiElement.parentNode?.replaceChild(newDoiElement, doiElement);

    // 添加点击事件
    newDoiElement.addEventListener('click', () => {
      if (!doi) return;

      try {
        // 使用Zotero的剪贴板API
        const clipboardHelper = (Components as any).classes["@mozilla.org/widget/clipboardhelper;1"]
          .getService((Components as any).interfaces.nsIClipboardHelper);
        clipboardHelper.copyString(doi);

        const originalBg = newDoiElement.style.background;
        const originalText = newDoiElement.innerHTML;

        // 显示复制成功提示
        newDoiElement.style.background = '#10b981';
        newDoiElement.style.color = '#ffffff';
        newDoiElement.innerHTML = '✓ 已复制到剪贴板';

        setTimeout(() => {
          newDoiElement.style.background = originalBg;
          newDoiElement.style.color = '#6b21a8';
          newDoiElement.innerHTML = originalText;
        }, 1500);
      } catch (error) {
        logger.error('[UIManager] Failed to copy DOI:', error);
        const originalBg = newDoiElement.style.background;
        newDoiElement.style.background = '#ef4444';
        newDoiElement.style.color = '#ffffff';
        newDoiElement.innerHTML = '✗ 复制失败';
        setTimeout(() => {
          newDoiElement.style.background = originalBg;
          newDoiElement.style.color = '#6b21a8';
          const doiTextSpan = newDoiElement.querySelector('.doi-text');
          if (doiTextSpan) {
            newDoiElement.innerHTML = doiTextSpan.outerHTML;
          }
        }, 1500);
      }
    });

    // 添加hover效果
    newDoiElement.addEventListener('mouseenter', () => {
      newDoiElement.style.background = '#e9d5ff';
      newDoiElement.style.transform = 'scale(1.05)';
    });
    newDoiElement.addEventListener('mouseleave', () => {
      newDoiElement.style.background = '#f3e8ff';
      newDoiElement.style.transform = 'scale(1)';
    });
  }

  /**
   * 清空论文信息
   */
  private clearPaperInfo(targetDoc?: Document): void {
    // 使用传入的document或默认panelDocument
    const doc = targetDoc || this.panelDocument;
    if (!doc) {
      return;
    }

    const panels = this.getPanelElements(doc);
    panels.forEach((panel, index) => {
      if (panel.titleElement) {
        panel.titleElement.textContent = '请选择一篇文献';
      }

      if (panel.authorsElement) {
        panel.authorsElement.style.display = 'none';
      }

      if (panel.yearElement) {
        panel.yearElement.style.display = 'none';
      }

      if (panel.journalElement) {
        panel.journalElement.style.display = 'none';
      }

      if (panel.doiElement) {
        panel.doiElement.style.display = 'none';
      }

      logger.log(`[UIManager] Cleared paper info for panel ${index}`);
    });
  }

  /**
   * 从item中提取论文信息
   */
  private extractPaperInfo(item: any): PaperInfo {
    const info: PaperInfo = {
      title: '',
      authors: []
    };

    try {
      // 标题
      info.title = item.getDisplayTitle ? item.getDisplayTitle() : item.getField('title');

      // DOI
      try {
        info.doi = item.getField('DOI');
      } catch (e) {
        // DOI字段可能不存在
      }

      // 作者
      try {
        const creators = item.getCreators();
        if (creators && creators.length > 0) {
          info.authors = creators.map((creator: any) => {
            if (creator.name) return creator.name;
            const firstName = creator.firstName || '';
            const lastName = creator.lastName || '';
            return `${firstName} ${lastName}`.trim();
          }).filter((name: string) => name.length > 0);
        }
      } catch (e) {
        // 作者字段可能不存在
      }

      // 年份
      try {
        const date = item.getField('date');
        if (date) {
          const year = date.match(/\d{4}/);
          if (year) info.year = year[0];
        }
      } catch (e) {
        // 日期字段可能不存在
      }

      // 期刊
      try {
        info.journal = item.getField('publicationTitle') || item.getField('journalAbbreviation');
      } catch (e) {
        // 期刊字段可能不存在
      }

    } catch (error) {
      logger.error("[UIManager] Error extracting paper info:", error);
    }

    return info;
  }

  /**
   * 处理按钮点击
   */
  private async handleButtonClick(mode: ViewMode, originElement?: HTMLElement): Promise<void> {
    logger.log("[UIManager] 🔘 Button clicked:", mode);
    logger.log("[UIManager] panelDocument available:", !!this.panelDocument);
    logger.log("[UIManager] currentItem:", this.currentItem?.id);
    logger.log("[UIManager] currentItemId saved:", this.currentItemId);

    try {
      // 检查是否已登录
      const isLoggedIn = await AuthManager.isLoggedIn();
      if (!isLoggedIn) {
        this.showMessage('请先登录以使用此功能', 'warning');
        return;
      }

      // 检查是否有选中的item
      if (!this.currentItem || !this.currentItemId) {
        this.showMessage('请先选择一篇文献', 'warning');
        return;
      }

      // 保存点击时的状态快照
      const clickedItemId = this.currentItemId;
      const clickedItem = this.currentItem;
      
      // 🔍 记录当前tab类型
      const zoteroPane = (Zotero as any).getActiveZoteroPane();
      if (zoteroPane && zoteroPane.tabs) {
        const selectedTab = zoteroPane.tabs.selectedID;
        const selectedTabInfo = zoteroPane.tabs._getTab(selectedTab);
        logger.log("[UIManager] 📑 Button clicked in tab:", selectedTab, "type:", selectedTabInfo?.type);
      }
      
      this.currentViewMode = mode;

      let targetDoc: Document | undefined;
      let panelInfo: PanelElements | undefined;

      if (originElement) {
        const panelRoot = originElement.closest('[data-researchopia-panel="true"]') as HTMLElement | null;
        if (panelRoot) {
          panelInfo = this.collectPanelElements(panelRoot);
          targetDoc = panelRoot.ownerDocument;
        }
      }

      if (!targetDoc) {
        targetDoc = this.itemDocuments.get(clickedItemId) || this.panelDocument || undefined;
      }

      if (!panelInfo && targetDoc) {
        const panels = this.getPanelElements(targetDoc);
        if (panels.length > 0) {
          panelInfo = panels.find(panel => panel.root.offsetParent !== null) || panels[0];
        }
      }

      if (!targetDoc || !panelInfo) {
        logger.error("[UIManager] Unable to resolve panel context for button click");
        return;
      }

      this.itemDocuments.set(clickedItemId, targetDoc);
      logger.log("[UIManager] Using document for item:", clickedItemId);

      logger.log("[UIManager] targetDoc === panelDocument:", targetDoc === this.panelDocument);
      logger.log("[UIManager] Document title:", targetDoc.title);
      logger.log("[UIManager] Document location:", targetDoc.location?.href);

      const contentSection = panelInfo.contentSection;
      logger.log("[UIManager] Content section found:", !!contentSection);
      
      if (contentSection) {
        logger.log("[UIManager] Content section parent:", contentSection.parentElement?.tagName);
        logger.log("[UIManager] Content section visible:", contentSection.offsetParent !== null);
        logger.log("[UIManager] Content section current children:", contentSection.childElementCount);
      }
      
      if (!contentSection) {
        logger.error("[UIManager] Content section not found in panel document");
        return;
      }
      
      // 🔍 检查当前paper-title的值
      const paperTitleElement = panelInfo.titleElement;
      logger.log("[UIManager] 📋 Current paper-title element found:", !!paperTitleElement);
      if (paperTitleElement) {
        logger.log("[UIManager] 📋 Current paper-title text:", paperTitleElement.textContent);
        const computedStyle = targetDoc.defaultView?.getComputedStyle(paperTitleElement);
        logger.log("[UIManager] 📋 Title element display:", computedStyle?.display);
        logger.log("[UIManager] 📋 Title element visibility:", computedStyle?.visibility);
        logger.log("[UIManager] 📋 Title element opacity:", computedStyle?.opacity);
      }
      
      // 检查整个paper-info section的状态
      const paperInfoSection = panelInfo.paperInfoSection;
      if (paperInfoSection) {
        const computedStyle = targetDoc.defaultView?.getComputedStyle(paperInfoSection);
        logger.log("[UIManager] 📋 Paper-info section display:", computedStyle?.display);
        logger.log("[UIManager] 📋 Paper-info section visibility:", computedStyle?.visibility);
      }
      
      logger.log("[UIManager] ✅ Found content section, clearing and rendering...");

      // 提取论文信息
      const paperInfo = await this.extractPaperInfo(clickedItem);

      // 清空内容区域，避免重复渲染
      contentSection.innerHTML = '';
      logger.log("[UIManager] Content section cleared, starting render for mode:", mode);

      // 显示加载提示
      logger.log("[UIManager] 🔄 Showing loading indicator...");
      contentSection.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; padding: 40px;">
          <div style="text-align: center; color: var(--fill-secondary);">
            <div style="margin-bottom: 8px;">⏳ 正在加载数据...</div>
          </div>
        </div>
      `;

      try {
        // 根据模式渲染不同内容
        switch (mode) {
          case 'my-annotations':
            await this.renderMyAnnotations(contentSection);
            logger.log("[UIManager] ✅ My annotations rendered");
            break;
          case 'shared-annotations':
            await this.renderSharedAnnotations(contentSection);
            logger.log("[UIManager] ✅ Shared annotations rendered");
            break;
          case 'paper-evaluation':
            await this.paperEvaluationView.render(contentSection, paperInfo);
            logger.log("[UIManager] ✅ Paper evaluation rendered");
            break;
          case 'quick-search':
            await this.quickSearchView.render(contentSection, paperInfo);
            logger.log("[UIManager] ✅ Quick search rendered");
            break;
        }
        
        // 渲染完成后检查item是否仍然是当前的
        if (this.currentItemId !== clickedItemId) {
          logger.warn("[UIManager] ⚠️ Item changed after rendering completed. Clearing stale content.");
          // 内容渲染到了错误的document,需要清空并显示提示
          contentSection.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; padding: 40px;">
              <div style="text-align: center; color: var(--fill-tertiary);">
                <div style="margin-bottom: 8px;">ℹ️ 请重新点击按钮</div>
                <div style="font-size: 12px;">文献已切换</div>
              </div>
            </div>
          `;
        } else {
          logger.log("[UIManager] ✅ Rendering completed for item:", clickedItemId);
          
          if (panelInfo.root) {
            panelInfo.root.style.visibility = 'visible';
            logger.log("[UIManager] 🎨 Set main container visibility to visible after rendering");
          }
          
          if (panelInfo.paperInfoSection) {
            panelInfo.paperInfoSection.style.visibility = 'visible';
            logger.log("[UIManager] 🎨 Set paper-info section visibility to visible after rendering");
          }
          
          const paperTitleAfter = panelInfo.titleElement;
          logger.log("[UIManager] 📋 After render - paper-title element found:", !!paperTitleAfter);
          if (paperTitleAfter) {
            logger.log("[UIManager] 📋 After render - paper-title text:", paperTitleAfter.textContent);
            const computedStyle = targetDoc.defaultView?.getComputedStyle(paperTitleAfter);
            logger.log("[UIManager] 📋 After render - title visibility:", computedStyle?.visibility);
          }
        }
      } catch (error) {
        logger.error("[UIManager] Error during rendering:", error);
        contentSection.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; padding: 40px;">
            <div style="text-align: center; color: var(--accent-red);">
              <div>❌ 加载失败</div>
              <div style="font-size: 12px; margin-top: 8px;">${error instanceof Error ? error.message : '未知错误'}</div>
            </div>
          </div>
        `;
        throw error;
      }
    } catch (error) {
      logger.error("[UIManager] Error in handleButtonClick:", error);
      this.showMessage('操作失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    }
  }

  /**
   * 渲染"管理我的标注"视图
   */
  private async renderMyAnnotations(container: HTMLElement, searchQuery = ''): Promise<void> {
    logger.log("[UIManager] 📝 Rendering my annotations via view...", searchQuery ? `search: "${searchQuery}"` : 'no search');
    await this.myAnnotationsView.render(container, searchQuery);
  }

  /**
   * 渲染"查看共享标注"视图
   * 委托给SharedAnnotationsView处理
   */
  private async renderSharedAnnotations(container: HTMLElement, searchQuery = ''): Promise<void> {
    logger.log("[UIManager] 👥 Delegating to SharedAnnotationsView.render()...");
    await this.sharedAnnotationsView.render(container, searchQuery);
  }











  /**
   * 格式化日期
   */
  /**
   * 递归渲染评论节点(支持嵌套)
   */

  /**
   * 显示消息提示
   */
  private showMessage(message: string, type: MessageType = 'info'): void {
    try {
      // 使用Zotero 7+的通知API
      const iconMap = {
        info: 'chrome://zotero/skin/16/universal/info.svg',
        warning: 'chrome://zotero/skin/16/universal/warning.svg',
        error: 'chrome://zotero/skin/16/universal/error.svg'
      };

      const progressWindow = new (Zotero as any).ProgressWindow({ closeOnClick: true });
      progressWindow.changeHeadline("Researchopia");
      progressWindow.addDescription(message);
      progressWindow.show();
      progressWindow.startCloseTimer(3000);
      
      logger.log(`[UIManager] Message shown: ${message}`);
    } catch (error) {
      logger.error("[UIManager] Error showing message:", error);
      // 降级方案：使用alert
      alert(`Researchopia: ${message}`);
    }
  }

  /**
   * 清理
   */
  public cleanup(): void {
    logger.log("[UIManager] 🧹 Cleaning up UI Manager...");
    this.currentItem = null;
    this.currentViewMode = 'none';
  }






  /**
   * 处理定位标注到PDF
   */
  private async handleLocateAnnotation(annotation: any): Promise<void> {
    try {
      logger.log('[UIManager] 📍 Locating annotation in PDF:', annotation.id);

      // 检查标注是否有位置信息
      if (!annotation.position || typeof annotation.position.pageIndex !== 'number') {
        this.showMessage('该标注缺少位置信息', 'warning');
        return;
      }

      // 获取当前论文的DOI
      if (!this.currentItem) {
        this.showMessage('请先选择一篇论文', 'warning');
        return;
      }

      const doi = this.currentItem.getField('DOI');
      if (!doi) {
        this.showMessage('该论文没有DOI,无法定位', 'warning');
        return;
      }

      // 导入PDF Reader Manager
      const { PDFReaderManager } = await import('./pdfReaderManager');
      const readerManager = PDFReaderManager.getInstance();
      await readerManager.initialize();

      // 查找打开的PDF阅读器
      let reader = await readerManager.findOpenReader(doi);

      if (!reader) {
        // 尝试打开PDF
        logger.log('[UIManager] Reader not found, trying to open PDF...');
        const opened = await this.openPDFReader(this.currentItem);
        
        if (opened) {
          // 等待reader初始化
          await new Promise(resolve => setTimeout(resolve, 1000));
          reader = await readerManager.findOpenReader(doi);
        }
      }

      if (!reader) {
        this.showMessage('无法打开PDF阅读器', 'error');
        return;
      }

      // 在PDF中高亮显示标注并打开弹窗
      const success = await readerManager.highlightAnnotation(reader, {
        id: annotation.id,
        type: annotation.type,
        content: annotation.content || '',
        comment: annotation.comment,
        color: annotation.color || '#ffff00',
        position: annotation.position,
        username: annotation.users?.username, // ✨ 传递username字段
        users: annotation.users, // ✨ 传递users对象
        show_author_name: annotation.show_author_name, // ✨ 传递show_author_name标志
        quality_score: annotation.quality_score,
        created_at: annotation.created_at,
        user_id: annotation.user_id
      }, {
        scrollToView: true,
        showPopup: true // ✨ 打开弹窗
      });

      if (success) {
        this.showMessage('已定位到PDF页面', 'info');
        // 高亮插件面板中的对应卡片
        this.highlightAnnotationCard(annotation.id);
      } else {
        this.showMessage('定位失败', 'error');
      }

    } catch (error) {
      logger.error('[UIManager] Error locating annotation:', error);
      this.showMessage('定位失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    }
  }

  /**
   * 尝试打开PDF阅读器
   */
  private async openPDFReader(item: any): Promise<boolean> {
    try {
      // 获取PDF附件
      const attachmentIDs = item.getAttachments();
      
      for (const attachmentID of attachmentIDs) {
        const attachment = Zotero.Items.get(attachmentID);
        if (attachment && attachment.isPDFAttachment?.()) {
          // 使用Zotero 8新API打开PDF
          if ((Zotero as any).FileHandlers && (Zotero as any).FileHandlers.open) {
            await (Zotero as any).FileHandlers.open(attachment, { location: { pageIndex: 0 } });
          } else {
            // 降级到旧API
            await (Zotero as any).OpenPDF?.openToPage?.(attachment, 1);
          }
          return true;
        }
      }

      logger.warn('[UIManager] No PDF attachment found');
      return false;
    } catch (error) {
      logger.error('[UIManager] Error opening PDF:', error);
      return false;
    }
  }






}
