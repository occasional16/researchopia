/**
 * UI管理模块
 * 负责注册和管理Zotero item pane中的自定义面板
 * 使用Zotero 7/8的官方ItemPaneManager API
 */

import { logger } from "../utils/logger";
import { envConfig } from "../config/env";
import { config, version as packageVersion } from "../../package.json";
import { AuthManager } from "./auth";
import { SupabaseManager } from "./supabase";
import { MyAnnotationsView } from "./ui/myAnnotationsView";
import { PaperEvaluationView } from "./ui/paperEvaluationView";
import { QuickSearchView } from "./ui/quickSearchView";
import { ProfilePreviewView } from "./ui/profilePreviewView";
import { ReadingSessionView } from "./ui/readingSessionView";
import { containerPadding } from "./ui/styles";
import { createPaperInfoSection, createButtonsSection, createContentSection, createUserInfoBar } from "./ui/components";
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
  private readonly paperEvaluationView: PaperEvaluationView;
  private readonly profilePreviewView: ProfilePreviewView;
  private readonly readingSessionView: ReadingSessionView;
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
    this.paperEvaluationView = new PaperEvaluationView(this.viewContext);
    this.profilePreviewView = new ProfilePreviewView(this.viewContext);
    this.quickSearchView = new QuickSearchView();
    this.readingSessionView = new ReadingSessionView(this.viewContext);
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

  /**
   * 显示"即将上线"提示
   */
  private showFeatureComingSoonMessage(container: HTMLElement, featureName: string): void {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">🚀</div>
        <div style="font-size: 18px; font-weight: 600; color: #212529; margin-bottom: 8px;">
          ${featureName}功能即将上线
        </div>
        <div style="font-size: 14px; color: #6c757d; margin-bottom: 20px;">
          我们正在努力开发和测试中,敬请期待!
        </div>
        <div style="font-size: 12px; color: #9ca3af; padding: 12px 20px; background: #ffffff; border-radius: 8px;">
          💡 提示: 开发者可以在"偏好设置 → 开发者选项"中开启实验性功能进行测试
        </div>
      </div>
    `;
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
      // 版本检测（必须在最前面）
      const { VersionChecker } = await import('./versionChecker');
      const versionChecker = VersionChecker.getInstance();
      const versionOk = await versionChecker.checkAndEnforce();
      
      if (!versionOk) {
        logger.warn("[UIManager] ⚠️ Version check failed, plugin may be restricted");
        // 不抛出错误，允许插件部分功能运行
      }
      
      // 确保ItemPaneManager可用 (Zotero 7+)
      if (!(Zotero as any).ItemPaneManager) {
        throw new Error("ItemPaneManager not available. Requires Zotero 7+");
      }

      // 注册自定义item pane section
      // ✅ FIX CONFIRMED: ItemPane registration is SAFE, FTL insertion is the problem
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

      // 监听个人主页预览事件
      win.document.addEventListener('researchopia:show-profile-preview', async (event: any) => {
        const username = event.detail?.username;
        if (!username) {
          logger.warn("[UIManager] ⚠️ No username in profile preview event");
          return;
        }
        logger.log("[UIManager] 👤 Received show-profile-preview event:", username);
        await this.showProfilePreview(username);
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
      pluginID: "researchopia@occasional16.com",
      header: {
        l10nID: "researchopia-section-header",
        icon: "chrome://researchopia/content/icons/icon20.svg"
      },
      sidenav: {
        l10nID: "researchopia-section-sidenav",
        icon: "chrome://researchopia/content/icons/icon20.svg"
      },
      onRender: async ({ doc, body, item, editable, tabType }: any) => {
        try {
          logger.log("[UIManager] onRender called with item:", item?.id, "tabType:", tabType);

          // ✨ 自定义collapsible-section的head部分，使用MutationObserver保证持久性
          try {
          const collapsibleSection = body.closest('collapsible-section');
          if (collapsibleSection) {
            // 创建自定义元素的函数
            const createTitleAddon = () => {
              const head = collapsibleSection.querySelector('.head');
              const titleBox = head?.querySelector('.title-box');
              const titleSpan = titleBox?.querySelector('.title');
              
              if (head && titleSpan) {
                // 检查是否已经自定义过(通过检查版本号span是否存在)
                if (titleSpan.querySelector('.researchopia-version')) {
                  return false; // 已经存在,不重复添加
                }
                
                // 清空title并重新构建内容
                titleSpan.textContent = '';
                
                // 插件名
                const nameSpan = doc.createElement('span');
                nameSpan.textContent = '研学港 Researchopia';
                titleSpan.appendChild(nameSpan);
                
                // 版本号(紧跟插件名,从package.json自动获取)
                const versionSpan = doc.createElement('span');
                versionSpan.className = 'researchopia-version';
                versionSpan.style.cssText = `
                  color: #6c757d; 
                  font-size: inherit; 
                  font-weight: 600;
                  margin-left: 4px;
                `;
                versionSpan.textContent = `v${packageVersion}`;
                titleSpan.appendChild(versionSpan);

                // 官网按钮添加到head右侧 - 在twisty按钮之前
                if (!head.querySelector('.researchopia-website-btn')) {
                  const websiteBtn = doc.createElement('button');
                  websiteBtn.className = 'researchopia-website-btn';
                  websiteBtn.style.cssText = `
                    padding: 3px 8px;
                    background: transparent;
                    color: #6c757d;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: inherit;
                    font-weight: 600;
                    transition: all 0.2s;
                    white-space: nowrap;
                    margin-right: 4px;
                  `;
                  websiteBtn.textContent = '🌐 官网';
                  websiteBtn.title = 'Visit Researchopia Website';
                  websiteBtn.addEventListener('mouseenter', () => {
                    websiteBtn.style.background = 'var(--fill-quinary)';
                  });
                  websiteBtn.addEventListener('mouseleave', () => {
                    websiteBtn.style.background = 'transparent';
                  });
                  websiteBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // 防止触发section折叠
                    (Zotero as any).launchURL(envConfig.apiBaseUrl);
                  });
                  
                  // 将按钮插入到twisty之前
                  const twisty = head.querySelector('.twisty');
                  if (twisty) {
                    head.insertBefore(websiteBtn, twisty);
                  } else {
                    head.appendChild(websiteBtn);
                  }
                }
                
                logger.log("[UIManager] ✅ Title bar customized");
                return true;
              }
              return false;
            };

            // 初次创建
            createTitleAddon();

            // 使用MutationObserver监听title变化并重新添加
            const head = collapsibleSection.querySelector('.head');
            if (head) {
              const observer = new (doc.defaultView as any).MutationObserver(() => {
                // 检查自定义元素是否还存在
                const titleSpan = collapsibleSection.querySelector('.title');
                const hasVersion = titleSpan?.querySelector('.researchopia-version');
                const hasWebsiteBtn = head.querySelector('.researchopia-website-btn');
                
                // 如果版本号或官网按钮消失,重新添加
                if (!hasVersion || !hasWebsiteBtn) {
                  logger.log("[UIManager] 🔄 Title customization lost, re-adding...");
                  createTitleAddon();
                }
              });
              
              observer.observe(head, {
                childList: true,
                subtree: true
              });

              logger.log("[UIManager] 👀 MutationObserver attached to monitor title bar");
            }
          }
        } catch (error) {
          logger.error("[UIManager] ❌ Failed to customize title bar:", error);
        }

        // 🔧 改进的重复渲染检查：使用data属性标记已渲染的容器
        const isAlreadyRendered = body.hasAttribute('data-researchopia-rendered');
        logger.log("[UIManager] Container already rendered:", isAlreadyRendered);

        // 只在容器未渲染时渲染面板UI结构
        if (!isAlreadyRendered) {
          await this.renderPanel(doc, body);
          // 标记容器已渲染
          body.setAttribute('data-researchopia-rendered', 'true');
          logger.log("[UIManager] ✅ Panel rendered and marked, panelDocument updated to:", doc?.location?.href || "unknown");
        } else {
          // 容器已渲染，只更新document引用
          this.panelDocument = doc;
          logger.log("[UIManager] ⏭️ Panel already rendered, skipped re-rendering, panelDocument updated to:", doc?.location?.href || "unknown");
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
            await this.handleItemChange(targetItem, doc);
          }
        } catch (error) {
          logger.error("[UIManager] ❌ Error in onRender:", error);
          // 确保即使出错也不影响Zotero的其他功能
        }
      },
      onItemChange: ({ item, setEnabled, tabType, doc }: any) => {
        try {
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

            // 使用.catch()处理Promise,避免unhandled rejection
            this.handleItemChange(targetItem).catch((err) => {
              logger.error("[UIManager] ❌ handleItemChange failed in onItemChange:", err);
            });
          }
        } catch (error) {
          logger.error("[UIManager] ❌ Error in onItemChange:", error);
          // 确保即使出错也不影响Zotero的其他功能,仍然setEnabled(true)
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
  private async renderPanel(doc: Document, container: HTMLElement): Promise<void> {
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
      background: #ffffff;
      min-height: 400px;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
      overflow-x: auto;
      overflow-y: auto;
    `;

    // 用户信息栏
    const userInfoBar = await createUserInfoBar(doc);
    mainContainer.appendChild(userInfoBar);

    // 论文信息区域
    const paperInfoSection = createPaperInfoSection(doc);
    mainContainer.appendChild(paperInfoSection);

    // 功能按钮区域(传入禁用的功能列表)
    const { VersionChecker } = await import('./versionChecker');
    const versionChecker = VersionChecker.getInstance();
    const disabledFeatures = versionChecker.getDisabledFeatures();
    const buttonsSection = createButtonsSection(doc, this.handleButtonClick.bind(this), disabledFeatures);
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
    try {
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
          
          // 创建功能介绍
          panel.contentSection.innerHTML = '';
          panel.contentSection.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            padding: ${containerPadding.content};
          `;
          
          const featuresContainer = itemDoc.createElement('div');
          featuresContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-width: 420px;
          `;
          
          const features = [
            { icon: '📖', color: '#ec4899', title: '文献共读', desc: '创建或加入共读会话,与他人协同阅读' },
            { icon: '⭐', color: '#f97316', title: '论文评价', desc: '查看论文评分、评论及学术讨论' }, 
            { icon: '🔍', color: '#10b981', title: '快捷搜索', desc: '一键搜索相关论文和学术资源' }
          ];
          
          features.forEach(feature => {
            const featureItem = itemDoc.createElement('div');
            featureItem.style.cssText = `
              display: flex;
              align-items: start;
              gap: 10px;
              padding: 12px;
              background: #ffffff;
              border-radius: 8px;
              border-left: 4px solid ${feature.color};
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
              transition: all 0.2s;
            `;
            
            // 添加hover效果
            featureItem.addEventListener('mouseenter', () => {
              featureItem.style.transform = 'translateX(4px)';
              featureItem.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.12)';
            });
            featureItem.addEventListener('mouseleave', () => {
              featureItem.style.transform = 'translateX(0)';
              featureItem.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
            });
            
            const iconSpan = itemDoc.createElement('span');
            iconSpan.style.cssText = 'font-size: 20px; flex-shrink: 0;';
            iconSpan.textContent = feature.icon;
            
            const textDiv = itemDoc.createElement('div');
            textDiv.style.cssText = 'flex: 1;';
            
            const titleSpan = itemDoc.createElement('div');
            titleSpan.style.cssText = `font-weight: 600; color: ${feature.color}; font-size: 13px; margin-bottom: 3px;`;
            titleSpan.textContent = feature.title;
            
            const descSpan = itemDoc.createElement('div');
            descSpan.style.cssText = 'font-size: 12px; color: #6b7280; line-height: 1.4;';
            descSpan.textContent = feature.desc;
            
            textDiv.appendChild(titleSpan);
            textDiv.appendChild(descSpan);
            
            featureItem.appendChild(iconSpan);
            featureItem.appendChild(textDiv);
            
            featuresContainer.appendChild(featureItem);
          });
          
          panel.contentSection.appendChild(featuresContainer);
        }
      }
      }
    } catch (error) {
      logger.error("[UIManager] ❌ Error in handleItemChange:", error);
      // 即使出错也不要抛出,防止影响Zotero核心功能
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
      // 检查功能是否被禁用
      const { VersionChecker } = await import('./versionChecker');
      const versionChecker = VersionChecker.getInstance();
      const featureMap: { [key: string]: 'reading-session' | 'paper-evaluation' | 'quick-search' } = {
        'reading-session': 'reading-session',
        'paper-evaluation': 'paper-evaluation',
        'quick-search': 'quick-search'
      };
      
      if (mode in featureMap && versionChecker.isFeatureDisabled(featureMap[mode])) {
        // 在内容区域显示禁用提示,而非弹窗
        this.showFeatureDisabledView(featureMap[mode]);
        return;
      }
      
      // 功能权限控制: 只有"快捷搜索"可以无登录使用,其他功能需要登录
      const requiresLogin = mode !== 'quick-search';
      
      if (requiresLogin) {
        const isLoggedIn = await AuthManager.isLoggedIn();
        if (!isLoggedIn) {
          this.showMessage('此功能需要登录，请先在偏好设置中登录', 'warning');
          // 打开偏好设置窗口
          try {
            const win = (Zotero as any).getMainWindow();
            if (win && win.openPreferences) {
              win.openPreferences('researchopia-preferences');
            }
          } catch (e) {
            logger.error("[UIManager] ❌ Error opening preferences:", e);
          }
          return;
        }
      }

      // 检查是否有选中的item
      if (!this.currentItem || !this.currentItemId) {
        this.showMessage('请先选择一篇文献', 'warning');
        return;
      }

      // 对于需要登录的功能,自动确保论文已注册到数据库
      if (requiresLogin) {
        const { PaperRegistry } = await import('./paperRegistry');
        const registrationResult = await PaperRegistry.ensurePaperRegistered(this.currentItem);
        if (!registrationResult.success) {
          logger.warn("[UIManager] ⚠️ Paper auto-registration failed:", registrationResult.error);
          // 不阻止功能使用,只记录警告
        } else {
          logger.log("[UIManager] ✅ Paper registered in database");
        }
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
          <div style="text-align: center; color: #6c757d;">
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
          case 'paper-evaluation':
            await this.paperEvaluationView.render(contentSection, paperInfo);
            logger.log("[UIManager] ✅ Paper evaluation rendered");
            break;
          case 'quick-search':
            await this.quickSearchView.render(contentSection, paperInfo);
            logger.log("[UIManager] ✅ Quick search rendered");
            break;
          case 'reading-session':
            await this.readingSessionView.render();
            logger.log("[UIManager] ✅ Reading session view rendered");
            break;
        }

        // 渲染完成后检查item是否仍然是当前的
        if (this.currentItemId !== clickedItemId) {
          logger.warn("[UIManager] ⚠️ Item changed after rendering completed. Clearing stale content.");
          // 内容渲染到了错误的document,需要清空并显示提示
          contentSection.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; padding: 40px;">
              <div style="text-align: center; color: #9ca3af;">
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
            <div style="text-align: center; color: #dc3545;">
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
   * 在内容区域显示功能禁用提示
   */
  private async showFeatureDisabledView(feature: 'reading-session' | 'paper-evaluation' | 'quick-search'): Promise<void> {
    try {
      const featureNames = {
        'reading-session': '文献共读',
        'paper-evaluation': '论文评价',
        'quick-search': '快捷搜索'
      };
      const featureName = featureNames[feature];
      
      const { VersionChecker } = await import('./versionChecker');
      const versionChecker = VersionChecker.getInstance();
      const versionConfig = versionChecker.getVersionConfig();
      const latestVersion = versionConfig?.latest_version || '最新版本';
      
      // 获取所有面板的内容区域并更新
      for (const [itemId, panelDoc] of this.itemDocuments) {
        const contentSection = panelDoc.querySelector('#researchopia-content');
        if (contentSection) {
          const { envConfig } = await import('../config/env');
          
          contentSection.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; color: white;">
              <div style="font-size: 64px; margin-bottom: 20px;">🔒</div>
              <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px;">功能未开放</h2>
              <p style="font-size: 14px; margin-bottom: 8px; opacity: 0.9;">${featureName} 功能在当前版本中不可用</p>
              <p style="font-size: 14px; margin-bottom: 24px; opacity: 0.9;">请升级到 <span style="font-weight: 600;">v${latestVersion}</span> 以使用此功能</p>
              <button id="btn-goto-update" style="padding: 12px 32px; background: white; color: #667eea; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                前往更新
              </button>
            </div>
          `;
          
          const updateBtn = contentSection.querySelector('#btn-goto-update');
          if (updateBtn) {
            updateBtn.addEventListener('mouseenter', () => {
              (updateBtn as HTMLElement).style.transform = 'scale(1.05)';
              (updateBtn as HTMLElement).style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
            });
            updateBtn.addEventListener('mouseleave', () => {
              (updateBtn as HTMLElement).style.transform = 'scale(1)';
              (updateBtn as HTMLElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            });
            updateBtn.addEventListener('click', () => {
              const url = `${envConfig.apiBaseUrl}/updates`;
              (Zotero as any).launchURL(url);
            });
          }
        }
      }
      
      logger.log(`[UIManager] Showed feature disabled view for: ${feature}`);
    } catch (error) {
      logger.error("[UIManager] Error showing feature disabled view:", error);
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

  /**
   * 显示个人主页预览
   */
  private async showProfilePreview(username: string): Promise<void> {
    try {
      logger.log('[UIManager] 👤 Showing profile preview for:', username);

      // 获取用户资料
      const profile = await this.profilePreviewView.fetchProfile(username);
      if (!profile) {
        this.showMessage('获取用户资料失败', 'error');
        return;
      }

      // 创建模态对话框
      const win = (Zotero as any).getMainWindow();
      if (!win) {
        logger.warn('[UIManager] ⚠️ Main window not available');
        return;
      }

      // 创建对话框容器
      const dialog = win.document.createElement('div');
      dialog.id = 'researchopia-profile-preview-dialog';
      dialog.style.cssText = `
        position: fixed;
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

      // 创建对话框内容
      const dialogContent = win.document.createElement('div');
      dialogContent.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        position: relative;
      `;

      // 添加关闭按钮
      const closeBtn = win.document.createElement('button');
      closeBtn.textContent = '×';
      closeBtn.style.cssText = `
        position: absolute;
        top: 12px;
        right: 12px;
        width: 32px;
        height: 32px;
        border: none;
        background: #f3f4f6;
        color: #374151;
        font-size: 24px;
        line-height: 1;
        border-radius: 50%;
        cursor: pointer;
        z-index: 1;
        transition: all 0.2s;
      `;
      closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = '#e5e7eb';
      });
      closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = '#f3f4f6';
      });
      closeBtn.addEventListener('click', () => {
        dialog.remove();
      });

      dialogContent.appendChild(closeBtn);

      // 渲染个人主页预览
      this.profilePreviewView.render(dialogContent, profile);

      dialog.appendChild(dialogContent);
      win.document.body.appendChild(dialog);

      // 点击背景关闭
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          dialog.remove();
        }
      });

      logger.log('[UIManager] ✅ Profile preview shown');
    } catch (error) {
      logger.error('[UIManager] ❌ Error showing profile preview:', error);
      this.showMessage('显示个人主页预览失败', 'error');
    }
  }

  /**
   * 生成诊断报告(静态方法,可从任何地方调用)
   */
  public static async generateDiagnosticReport(): Promise<void> {
    try {
      const { DiagnosticsManager } = await import('./diagnostics');
      await DiagnosticsManager.generateReport();
    } catch (error) {
      logger.error('[UIManager] ❌ Failed to generate diagnostic report:', error);
      
      const ProgressWindow = (Zotero as any).ProgressWindow;
      if (ProgressWindow) {
        const progressWindow = new ProgressWindow({ closeOnClick: true });
        progressWindow.changeHeadline('错误');
        progressWindow.addDescription('❌ 生成诊断报告失败');
        progressWindow.addDescription(String(error));
        progressWindow.show();
        progressWindow.startCloseTimer(3000);
      }
    }
  }
}
