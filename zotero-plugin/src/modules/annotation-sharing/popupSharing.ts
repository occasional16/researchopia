/**
 * AnnotationSharingPopup - 原生标注弹窗注入4级共享按钮
 * 
 * 功能:
 * 1. 在Zotero PDF Reader的文本选择弹窗中注入4个共享模式按钮
 * 2. 用户点击按钮后,保存待共享模式到sessionStorage
 * 3. 当标注创建后,通过Notifier自动应用共享模式
 * 
 * 参考文档: docs/docs-dev/1.4.3-FOUR_TIER_SHARING_MODE_DESIGN.md
 */

import { logger } from "../../utils/logger";
import { AnnotationManager } from "../annotations";
import { AuthManager } from "../auth";
import { CommentRenderer } from "../ui/utils/CommentRenderer";
import { SHARE_MODES, CACHE_EXPIRY_MS, SHARE_STATUS_COLORS } from "./constants";
import { annotationSharingCache } from "./cache";
import type { ShareMode, ShareModeButton, SharedAnnotationCacheEntry } from "./types";

// Re-export ShareMode for backwards compatibility
export type { ShareMode };

/**
 * 原生标注弹窗共享按钮管理器
 */
export class AnnotationSharingPopup {
  private static instance: AnnotationSharingPopup;
  private annotationManager: AnnotationManager;
  private zoteroNotifierID?: string;
  private isInitialized = false;
  
  // 🚀 使用共享缓存管理器 (替代本地 documentCache 和 sharedInfoCache)
  private cache = annotationSharingCache;

  // 4种共享模式配置 (使用统一常量)
  private shareModes = SHARE_MODES;

  // 🆕 Sidebar标注增强器实例
  private sidebarEnhancer?: any; // SidebarAnnotationEnhancer类型,延迟导入避免循环依赖

  private constructor(annotationManager: AnnotationManager) {
    this.annotationManager = annotationManager;
  }

  /**
   * 获取单例实例
   */
  public static getInstance(annotationManager?: AnnotationManager): AnnotationSharingPopup {
    if (!AnnotationSharingPopup.instance) {
      if (!annotationManager) {
        throw new Error('[AnnotationSharingPopup] AnnotationManager is required for initialization');
      }
      AnnotationSharingPopup.instance = new AnnotationSharingPopup(annotationManager);
    }
    return AnnotationSharingPopup.instance;
  }

  /**
   * 初始化 - 注册事件监听
   */
  public initialize(): void {
    if (this.isInitialized) {
      logger.log('[AnnotationSharingPopup] Already initialized');
      return;
    }

    try {
      // 1. 注册renderTextSelectionPopup事件 (选中文本时的弹窗)
      this.registerTextSelectionPopup();

      // 2. 🆕 注册renderAnnotationPopup事件 (点击已有标注时的弹窗)
      this.registerAnnotationPopup();

      // 3. 注册Notifier监听标注创建
      this.registerAnnotationNotifier();

      // 4. 🆕 注册sidebar标注增强器 (在sidebar标注卡片显示共享按钮)
      this.registerSidebarEnhancer();

      this.isInitialized = true;
      logger.log('[AnnotationSharingPopup] ✅ Initialized successfully (selection-popup + annotation-popup + sidebar + notifier)');
    } catch (error) {
      logger.error('[AnnotationSharingPopup] ❌ Initialization failed:', error);
    }
  }

  /**
   * 注册文本选择弹窗事件 (Zotero 7+ API)
   */
  private registerTextSelectionPopup(): void {
    try {
      if (!(Zotero as any).Reader?.registerEventListener) {
        logger.error('[AnnotationSharingPopup] Zotero.Reader.registerEventListener not available');
        return;
      }

      (Zotero as any).Reader.registerEventListener(
        'renderTextSelectionPopup',
        (event: any) => {
          this.onPopupRender(event);
        },
        'researchopia-sharing'
      );

      logger.log('[AnnotationSharingPopup] ✅ Registered renderTextSelectionPopup event');
    } catch (error) {
      logger.error('[AnnotationSharingPopup] Error registering text selection popup:', error);
    }
  }

  /**
   * 弹窗渲染回调 - 注入4个共享按钮
   */
  private onPopupRender(event: any): void {
    try {
      const { append, doc } = event;

      if (!append || !doc) {
        logger.error('[AnnotationSharingPopup] Missing append or doc in event');
        return;
      }

      // 创建按钮容器
      const container = this.createButtonContainer(doc);

      // 追加到弹窗
      append(container);

      logger.log('[AnnotationSharingPopup] ✅ Sharing buttons injected into popup');
    } catch (error) {
      logger.error('[AnnotationSharingPopup] Error rendering popup:', error);
    }
  }

  /**
   * 创建4个共享按钮的容器
   */
  private createButtonContainer(doc: Document): HTMLElement {
    const container = doc.createElement('div');
    container.id = 'researchopia-sharing-buttons';
    // 🆕 按钮左右分散对齐
    container.style.cssText = `
      display: flex;
      gap: 4px;
      padding: 6px 0;
      border-top: 1px solid #e0e0e0;
      margin-top: 6px;
      justify-content: space-between;
    `;

    // 获取当前选中的模式
    const currentMode = this.getPendingShareMode();

    // 创建4个按钮
    this.shareModes.forEach(mode => {
      const button = this.createShareButton(doc, mode, currentMode, () => {
        this.onModeSelect(mode.id, doc);
      });
      container.appendChild(button);
    });

    return container;
  }

  /**
   * 🆕 创建单个共享模式按钮 (通用方法,可复用于selection-popup和annotation-popup)
   * @param doc 文档对象
   * @param mode 共享模式配置
   * @param currentMode 当前激活的模式 (用于高亮显示)
   * @param onClick 点击回调函数
   */
  private createShareButton(
    doc: Document,
    mode: ShareModeButton,
    currentMode: ShareMode,
    onClick: () => void
  ): HTMLElement {
    const button = doc.createElement('button');
    button.className = 'toolbar-button researchopia-share-mode-btn';
    button.id = `researchopia-share-${mode.id || 'unshare'}`;
    button.setAttribute('data-mode', mode.id || 'unshare');
    button.title = mode.title; // tooltip显示完整标题

    const isActive = currentMode === mode.id;

    // 🆕 复用侧边栏按钮样式 (只显示图标，与 sidebarEnhancer.ts 一致)
    button.style.cssText = `
      width: 28px;
      height: 28px;
      border: 2px solid ${isActive ? mode.color : '#ccc'};
      border-radius: 4px;
      background: ${isActive ? `${mode.color}20` : '#fff'};
      color: ${isActive ? mode.color : '#333'};
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: ${isActive ? '600' : '400'};
      transition: all 0.2s;
      padding: 0;
    `;

    // 只显示图标，不显示文字
    button.textContent = mode.icon;

    // 标记当前激活状态 (供hover事件动态检查)
    button.setAttribute('data-active', isActive ? 'true' : 'false');

    // 鼠标悬停效果 (动态检查激活状态)
    button.addEventListener('mouseenter', () => {
      const isCurrentlyActive = button.getAttribute('data-active') === 'true';
      if (!isCurrentlyActive) {
        button.style.borderColor = mode.color;
        button.style.background = `${mode.color}10`;
      }
    });

    button.addEventListener('mouseleave', () => {
      const isCurrentlyActive = button.getAttribute('data-active') === 'true';
      if (!isCurrentlyActive) {
        button.style.borderColor = '#ccc';
        button.style.background = '#fff';
      }
    });

    // 点击事件
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });

    return button;
  }

  /**
   * 模式选择回调
   */
  private onModeSelect(mode: ShareMode, doc: Document): void {
    logger.log(`[AnnotationSharingPopup] 📌 Selected mode: ${mode || 'unshare'}`);

    // 1. 保存到全局变量
    this.setPendingShareMode(mode);
    
    // DEBUG: 验证存储是否成功
    const verifyMode = this.getPendingShareMode();
    logger.log(`[AnnotationSharingPopup] DEBUG Verified stored mode: ${verifyMode}`);

    // 2. 更新按钮状态
    this.updateButtonStates(doc, mode);

    // 3. 视觉反馈
    this.showFeedback(doc, mode);
  }

  /**
   * 更新按钮高亮状态
   */
  private updateButtonStates(doc: Document, selectedMode: ShareMode): void {
    this.shareModes.forEach(mode => {
      const button = doc.getElementById(`researchopia-share-${mode.id || 'unshare'}`) as HTMLButtonElement;
      if (!button) return;

      const isActive = selectedMode === mode.id;

      // 🆕 更新 data-active 属性 (供hover事件动态检查)
      button.setAttribute('data-active', isActive ? 'true' : 'false');
      
      // 更新样式 (与 createShareButton 中的样式保持一致)
      button.style.borderColor = isActive ? mode.color : '#ccc';
      button.style.background = isActive ? `${mode.color}20` : '#fff';
      button.style.color = isActive ? mode.color : '#333';
      button.style.fontWeight = isActive ? '600' : '400';
    });
  }

  /**
   * 显示视觉反馈
   */
  private showFeedback(doc: Document, mode: ShareMode): void {
    const modeConfig = this.shareModes.find(m => m.id === mode);
    const label = modeConfig ? `${modeConfig.icon} ${modeConfig.label}` : '❌ 取消共享';

    // 在弹窗底部显示提示
    let feedbackElement = doc.getElementById('researchopia-share-feedback');
    
    if (!feedbackElement) {
      feedbackElement = doc.createElement('div');
      feedbackElement.id = 'researchopia-share-feedback';
      feedbackElement.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 16px;
        background: rgba(0, 0, 0, 0.8);
        color: #fff;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s;
      `;
      doc.body.appendChild(feedbackElement);
    }

    feedbackElement.textContent = `将创建为: ${label}`;
    feedbackElement.style.opacity = '1';

    // 2秒后淡出
    setTimeout(() => {
      feedbackElement!.style.opacity = '0';
    }, 2000);
  }

  /**
   * 注册Zotero Notifier监听标注创建
   */
  private registerAnnotationNotifier(): void {
    if (this.zoteroNotifierID) {
      logger.log('[AnnotationSharingPopup] Notifier already registered');
      return;
    }

    const notifierCallback = {
      notify: async (event: string, type: string, ids: any[], extraData: any) => {
        // 仅处理标注创建事件
        if (event !== 'add' || type !== 'item') return;

        for (const id of ids) {
          const item = (Zotero as any).Items.get(id);
          
          // 确认是标注类型
          if (!item || !(item as any).isAnnotation?.()) continue;

          await this.handleAnnotationCreated(item);
        }
      }
    };

    this.zoteroNotifierID = (Zotero as any).Notifier.registerObserver(notifierCallback, ['item']);
    logger.log('[AnnotationSharingPopup] ✅ Notifier registered for annotation creation');
  }

  /**
   * 🆕 注册sidebar标注增强器 (在sidebar标注卡片显示共享按钮)
   */
  private async registerSidebarEnhancer(): Promise<void> {
    try {
      // 动态导入 SidebarAnnotationEnhancer 避免循环依赖
      const { SidebarAnnotationEnhancer } = await import('./sidebarEnhancer');
      
      // 创建实例 (传入annotationManager以复用缓存和API逻辑)
      this.sidebarEnhancer = new SidebarAnnotationEnhancer(this.annotationManager);
      
      // 注册Zotero Reader事件
      await this.sidebarEnhancer.register('researchopia-sidebar-enhancer');
      
      logger.log('[AnnotationSharingPopup] ✅ Sidebar enhancer registered');
    } catch (error) {
      logger.error('[AnnotationSharingPopup] ❌ Failed to register sidebar enhancer:', error);
    }
  }

  /**
   * 处理标注创建事件
   */
  private async handleAnnotationCreated(item: any): Promise<void> {
    try {
      const pendingMode = this.getPendingShareMode();

      // 如果没有待共享模式,或选择了取消(null),不执行任何操作
      if (!pendingMode) {
        logger.log('[AnnotationSharingPopup] No pending share mode, skipping auto-share');
        this.clearPendingShareMode();
        return;
      }

      logger.log(`[AnnotationSharingPopup] 🚀 Auto-sharing annotation as: ${pendingMode}`);

      // 获取标注的完整信息
      // Zotero结构: 标注 -> PDF附件 -> 论文条目
      const pdfAttachment = item.parentItem;  // 第一层parent是PDF附件
      if (!pdfAttachment) {
        logger.error('[AnnotationSharingPopup] Cannot get PDF attachment (parentItem)');
        this.clearPendingShareMode();
        return;
      }
      
      // 获取论文条目 (PDF附件的parent)
      let paperItem = pdfAttachment.parentItem;
      if (!paperItem && pdfAttachment.parentItemID) {
        // Fallback: 通过parentItemID获取
        paperItem = (Zotero as any).Items.get(pdfAttachment.parentItemID);
      }
      
      if (!paperItem) {
        logger.error('[AnnotationSharingPopup] Cannot get paper item (PDF attachment has no parent)');
        this.clearPendingShareMode();
        return;
      }
      
      // 从论文条目获取DOI
      const doi = paperItem.getField?.('DOI');
      if (!doi) {
        logger.error(`[AnnotationSharingPopup] Paper item (${paperItem.itemType}) has no DOI`);
        this.clearPendingShareMode();
        return;
      }
      
      logger.log(`[AnnotationSharingPopup] ✅ Found DOI: ${doi} from paper item ${paperItem.id}`);

      // 获取document (通过SupabaseManager.findOrCreateDocument)
      logger.log('[AnnotationSharingPopup] Step 1: Getting AnnotationManager instance...');
      const annotationManager = AnnotationManager.getInstance();
      
      logger.log('[AnnotationSharingPopup] Step 2: Finding/creating document...');
      const document = await (annotationManager as any).supabaseManager.findOrCreateDocument(paperItem);
      
      if (!document) {
        logger.error(`[AnnotationSharingPopup] Failed to find/create document for DOI: ${doi}`);
        this.clearPendingShareMode();
        return;
      }
      logger.log(`[AnnotationSharingPopup] ✅ Document found: ${document.id}`);

      // 获取当前用户ID (通过AuthManager)
      logger.log('[AnnotationSharingPopup] Step 3: Getting current user...');
      const user = AuthManager.getCurrentUser();
      if (!user?.id) {
        logger.error('[AnnotationSharingPopup] User not logged in');
        this.clearPendingShareMode();
        return;
      }
      logger.log(`[AnnotationSharingPopup] ✅ User: ${user.email}`);

      // 构造ZoteroAnnotation对象
      logger.log('[AnnotationSharingPopup] Step 4: Building annotation object...');
      const annotation: any = {
        key: item.key,
        type: item.annotationType,
        text: item.annotationText || '',
        comment: item.annotationComment || '',
        color: item.annotationColor || '',
        pageLabel: item.annotationPageLabel || '',
        position: item.annotationPosition ? JSON.parse(item.annotationPosition) : {},
        tags: item.getTags().map((t: any) => t.tag),
        supabaseId: undefined, // 新创建的标注
        visibility: undefined,
        showAuthorName: undefined,
        synced: false
      };
      logger.log(`[AnnotationSharingPopup] ✅ Annotation object built: key=${item.key}, text="${item.annotationText}"`);

      // 转换模式: anonymous → public + show_author_name=false
      const visibilityValue = pendingMode === 'anonymous' ? 'public' : pendingMode;
      const showAuthorName = pendingMode !== 'anonymous';
      logger.log(`[AnnotationSharingPopup] Mode conversion: ${pendingMode} -> visibility=${visibilityValue}, showAuthorName=${showAuthorName}`);

      // 调用AnnotationManager.updateAnnotationSharing
      logger.log('[AnnotationSharingPopup] Step 5: Calling updateAnnotationSharing...');
      const success = await AnnotationManager.updateAnnotationSharing(
        annotation,
        document.id,
        user.id,
        visibilityValue, // 'private', 'public', 'public'(anonymous)
        showAuthorName
      );

      if (!success) {
        logger.error('[AnnotationSharingPopup] updateAnnotationSharing failed');
        this.clearPendingShareMode();
        return;
      }

      logger.log(`[AnnotationSharingPopup] ✅ Annotation ${item.key} shared as ${pendingMode}`);

      // 🆕 通知侧边栏更新按钮状态 (共享完成后立即更新UI)
      if (this.sidebarEnhancer) {
        logger.log(`[AnnotationSharingPopup] 🔄 Notifying sidebar to update button states for ${item.key}`);
        this.sidebarEnhancer.updateAnnotationButtonStates(item.key, pendingMode);
      }

      // 🆕 如果是public/anonymous且有当前session,添加到session (与管理标注页面逻辑一致)
      if (visibilityValue === 'public' && annotation.supabaseId) {
        const { ReadingSessionManager } = await import('../readingSessionManager');
        const sessionManager = ReadingSessionManager.getInstance();
        const session = sessionManager.getCurrentSession();
        
        if (session) {
          logger.log('[AnnotationSharingPopup] Step 6: Adding annotation to current session...');
          try {
            const { APIClient } = await import('../../utils/apiClient');
            const apiClient = APIClient.getInstance();
            await apiClient.post('/api/proxy/annotations/share-to-session', {
              annotation_id: annotation.supabaseId,
              session_id: session.id
            });
            logger.log(`[AnnotationSharingPopup] ✅✅✅ Annotation ${item.key} added to session ${session.id}`);
          } catch (error) {
            logger.error('[AnnotationSharingPopup] Failed to add annotation to session:', error);
            // 不阻塞主流程,只记录错误
          }
        } else {
          logger.log('[AnnotationSharingPopup] ⚠️ No current session, annotation only shared to Supabase');
        }
      }

      // 清除待共享模式
      this.clearPendingShareMode();

    } catch (error) {
      logger.error('[AnnotationSharingPopup] ❌ Error handling annotation creation:', error);
      logger.error(`[AnnotationSharingPopup] Error details: ${String(error)}, stack: ${(error as any)?.stack}`);
      this.clearPendingShareMode(); // 确保清除状态
    }
  }

  /**
   * 获取待共享模式 (使用全局变量而非sessionStorage)
   */
  private getPendingShareMode(): ShareMode {
    try {
      const addon = (Zotero as any).Researchopia;
      return addon?.data?.pendingShareMode || null;
    } catch (error) {
      logger.error('[AnnotationSharingPopup] Error reading pendingShareMode:', error);
      return null;
    }
  }

  /**
   * 设置待共享模式 (使用全局变量)
   */
  private setPendingShareMode(mode: ShareMode): void {
    try {
      const addon = (Zotero as any).Researchopia;
      logger.log(`[AnnotationSharingPopup] DEBUG addon exists: ${!!addon}`);
      logger.log(`[AnnotationSharingPopup] DEBUG addon.data exists: ${!!addon?.data}`);
      
      if (addon?.data) {
        addon.data.pendingShareMode = mode;
        logger.log(`[AnnotationSharingPopup] ✅ Set pending mode: ${mode}`);
      } else {
        logger.error('[AnnotationSharingPopup] ❌ addon.data not available');
      }
    } catch (error) {
      logger.error('[AnnotationSharingPopup] Error writing pendingShareMode:', error);
    }
  }

  /**
   * 清除待共享模式
   */
  private clearPendingShareMode(): void {
    this.setPendingShareMode(null);
  }

  // ========== 🆕 Annotation-Popup功能 (点击已有标注时显示) ==========

  /**
   * 🆕 监控Zotero Reader iframe中的annotation-popup
   * Zotero Reader API无renderAnnotationPopup事件,使用轮询检测
   */
  private registerAnnotationPopup(): void {
    try {
      logger.log('[AnnotationSharingPopup] ⏰ Setting up polling for annotation-popup (no Zotero API)');
      
      // 每500ms检查一次所有打开的reader
      setInterval(() => {
        const readers = (Zotero as any).Reader?._readers || [];
        
        for (const reader of readers) {
          try {
            // 获取reader的iframe document
            const doc = reader._iframeWindow?.document;
            if (!doc) continue;

            // 查找annotation-popup
            const popups = doc.querySelectorAll('.annotation-popup');
            popups.forEach((popupElement: Element) => {
              // 检查是否已注入按钮
              if (!(popupElement as HTMLElement).querySelector('#researchopia-annotation-popup-buttons')) {
                logger.log('[AnnotationSharingPopup] 🔍 Detected annotation-popup, injecting buttons...');
                this.injectButtonsToAnnotationPopup(popupElement as HTMLElement);
              }
            });
          } catch (err) {
            // 某个reader出错不影响其他reader
          }
        }
      }, 200); // 🚀 优化: 200ms polling (更快响应)

      logger.log('[AnnotationSharingPopup] ✅ Polling started for annotation-popup (every 200ms)');
    } catch (error) {
      logger.error('[AnnotationSharingPopup] Error setting up annotation-popup polling:', error);
    }
  }

  /**
   * 🆕 向annotation-popup注入4个共享按钮 (轮询调用)
   */
  private injectButtonsToAnnotationPopup(popupElement: HTMLElement): void {
    try {
      logger.log('[AnnotationSharingPopup] 🔍 Annotation-popup detected, starting injection...');

      // 找到.preview容器
      const previewContainer = popupElement.querySelector('.preview');
      if (!previewContainer) {
        logger.warn('[AnnotationSharingPopup] Cannot find .preview container, skipping');
        return;
      }

      // 防止重复注入
      if (previewContainer.querySelector('#researchopia-annotation-popup-buttons')) {
        // 静默跳过 (轮询会频繁触发)
        return;
      }

      logger.log('[AnnotationSharingPopup] ✅ Found .preview container, creating buttons...');

      // 获取popupElement所属的document (可能是iframe内的document)
      const doc = popupElement.ownerDocument || document;

      // ⚠️ **关键决策**: popup本身不包含annotation ID
      // 策略: 在按钮点击时,从sidebar的.annotation.selected元素获取当前annotation
      
      // 找到reader以获取libraryID
      const reader = (Zotero as any).Reader?._readers?.find((r: any) => 
        r._iframeWindow?.document === doc
      );
      
      if (!reader) {
        logger.error('[AnnotationSharingPopup] Cannot find reader instance');
        return;
      }

      // 🔍 先获取annotation key以查询其共享状态
      const contentElement = popupElement.querySelector('.comment .content') as HTMLElement;
      const annotationKey = contentElement?.id;
      
      if (!annotationKey) {
        logger.warn('[AnnotationSharingPopup] Cannot find annotation key from popup, skipping');
        return;
      }
      
      // 创建按钮容器
      const buttonContainer = doc.createElement('div');
      buttonContainer.id = 'researchopia-annotation-popup-buttons';
      buttonContainer.style.cssText = `
        display: flex;
        gap: 6px;
        padding: 6px 0;
        border-top: 1px solid #e0e0e0;
        margin-top: 6px;
      `;

      // 异步查询共享状态并创建按钮
      const libraryID = reader.itemID?.libraryID || 1;
      
      // 立即创建按钮(默认状态),然后异步查询并更新状态
      // ⚠️ 注意: 传入 'none' 而不是 null,避免与 "取消" 按钮的 id=null 冲突导致高亮
      this.shareModes.forEach(mode => {
        const button = this.createShareButton(doc, mode, 'none' as ShareMode, async () => {
          logger.log(`[AnnotationSharingPopup] 🖱️ Button clicked: ${mode.id}`);
          
          // 🔍 关键发现: popup HTML中 .comment .content 元素的 id 就是 annotation key!
          // 例: <div id="5FCS8K7D" class="content" contenteditable="true" ...>
          const contentElement = popupElement.querySelector('.comment .content') as HTMLElement;
          const annotationKey = contentElement?.id;
          
          logger.log(`[AnnotationSharingPopup] 🔑 Annotation key from popup .content id: ${annotationKey}`);
          
          // 通过annotation key获取item
          const annotationItem = (Zotero as any).Items.getByLibraryAndKey(libraryID, annotationKey);
          
          if (!annotationItem) {
            logger.error(`[AnnotationSharingPopup] Cannot find annotation item: ${annotationKey}`);
            this.showAnnotationPopupFeedback(doc, '❌ 找不到标注', false);
            return;
          }

          logger.log(`[AnnotationSharingPopup] ✅ Using annotation item: ${annotationItem.key}`);
          
          // 调用updateAnnotationImmediately
          await this.updateAnnotationImmediately(annotationItem, mode.id, doc);
        });
        buttonContainer.appendChild(button);
      });

      // 添加到.preview容器底部
      previewContainer.appendChild(buttonContainer);

      logger.log('[AnnotationSharingPopup] ✅✅ Annotation-popup buttons injected successfully!');
      
      // 🆕 注入共享信息区 (用户名、点赞、评论)
      this.injectSharedInfoToAnnotationPopup(popupElement, annotationKey, doc, reader);
      
      // 异步查询当前标注的共享状态并更新按钮高亮
      (async () => {
        try {
          // Step 1: 获取annotation item
          const libraryID = reader.itemID?.libraryID || 1;
          const annotationItem = (Zotero as any).Items.getByLibraryAndKey(libraryID, annotationKey);
          if (!annotationItem) return;
          
          // Step 2: 获取paper item并获取DOI
          const pdfAttachment = annotationItem.parentItem;
          if (!pdfAttachment) return;
          let paperItem = pdfAttachment.parentItem;
          if (!paperItem && pdfAttachment.parentItemID) {
            paperItem = (Zotero as any).Items.get(pdfAttachment.parentItemID);
          }
          if (!paperItem) return;
          
          const doi = paperItem.getField?.('DOI');
          if (!doi) return;
          
          // Step 3: 获取document (使用共享缓存)
          let documentId: string | undefined = this.cache.getDocumentId(doi);
          if (!documentId) {
            const document = await (this.annotationManager as any).supabaseManager.findOrCreateDocument(paperItem);
            if (!document?.id) return;
            documentId = document.id as string;
            this.cache.setDocumentId(doi, documentId); // 缓存document ID
          }
          
          if (!documentId) return; // TypeScript类型守卫
          
          // Step 4: 通过API查询该document下的所有annotations
          const { APIClient } = await import('../../utils/apiClient');
          const apiClient = APIClient.getInstance();
          const params = new URLSearchParams();
          params.append('document_id', documentId);
          params.append('type', 'my');
          
          const response = await apiClient.get<{ success: boolean, data: any[] }>(
            '/api/proxy/annotations',
            params
          );
          
          if (response.success && response.data) {
            // 查找匹配的annotation
            const existingAnnotation = response.data.find(
              (ann: any) => ann.original_id === annotationKey
            );
            
            if (existingAnnotation) {
              // 推断当前模式 (使用visibility字段 + show_author_name字段)
              let currentMode: ShareMode = null;
              const visibility = existingAnnotation.visibility;
              const showAuthorName = existingAnnotation.show_author_name;
              
              // 匿名模式: visibility='public' + show_author_name=false
              if (visibility === 'public' && showAuthorName === false) {
                currentMode = 'anonymous';
              } else if (visibility === 'public') {
                currentMode = 'public';
              } else if (visibility === 'private') {
                currentMode = 'private';
              }
              
              logger.log(`[AnnotationSharingPopup] 🎨 Found existing annotation, current mode: ${currentMode}`);
              
              // 更新按钮状态
              this.shareModes.forEach(mode => {
                const button = buttonContainer.querySelector(`button[data-mode="${mode.id || 'unshare'}"]`) as HTMLButtonElement;
                if (button) {
                  const isActive = currentMode === mode.id;
                  button.style.borderColor = isActive ? mode.color : '#ccc';
                  button.style.background = isActive ? `${mode.color}20` : '#fff';
                  button.style.color = isActive ? mode.color : '#333';
                  button.style.fontWeight = isActive ? '600' : '400';
                }
              });
            }
          }
        } catch (error) {
          logger.error('[AnnotationSharingPopup] Error querying initial annotation status:', error);
          // 不阻塞,静默失败
        }
      })();
    } catch (error) {
      // 详细错误日志
      logger.error('[AnnotationSharingPopup] Error injecting buttons:', {
        error: String(error),
        message: (error as Error)?.message,
        stack: (error as Error)?.stack,
      });
    }
  }

  /**
   * 🆕 即时更新已有标注的共享状态 (无需Notifier)
   * @param annotationItem Zotero标注item对象
   * @param shareMode 共享模式 ('public', 'anonymous', 'private', null)
   * @param doc 文档对象 (用于视觉反馈)
   */
  private async updateAnnotationImmediately(
    annotationItem: any,
    shareMode: ShareMode,
    doc: Document
  ): Promise<void> {
    try {
      logger.log(`[AnnotationSharingPopup] 🔄 Updating annotation ${annotationItem.key} to ${shareMode || 'unshare'} mode...`);

      // Step 1: 获取PDF附件和论文条目
      const pdfAttachment = annotationItem.parentItem;
      if (!pdfAttachment) {
        logger.error('[AnnotationSharingPopup] Cannot get PDF attachment (parentItem)');
        this.showAnnotationPopupFeedback(doc, '❌ 无法获取PDF附件', false);
        return;
      }

      let paperItem = pdfAttachment.parentItem;
      if (!paperItem && pdfAttachment.parentItemID) {
        paperItem = (Zotero as any).Items.get(pdfAttachment.parentItemID);
      }

      if (!paperItem) {
        logger.error('[AnnotationSharingPopup] Cannot get paper item (PDF attachment has no parent)');
        this.showAnnotationPopupFeedback(doc, '❌ 无法获取论文条目', false);
        return;
      }

      // Step 2: 获取DOI
      const doi = paperItem.getField?.('DOI');
      if (!doi) {
        logger.error(`[AnnotationSharingPopup] Paper item (${paperItem.itemType}) has no DOI`);
        this.showAnnotationPopupFeedback(doc, '❌ 论文缺少DOI', false);
        return;
      }
      logger.log(`[AnnotationSharingPopup] ✅ Found DOI: ${doi}`);

      // Step 3: 获取document (通过SupabaseManager)
      const document = await (this.annotationManager as any).supabaseManager.findOrCreateDocument(paperItem);
      if (!document) {
        logger.error(`[AnnotationSharingPopup] Failed to find/create document for DOI: ${doi}`);
        this.showAnnotationPopupFeedback(doc, '❌ 无法创建文档记录', false);
        return;
      }
      logger.log(`[AnnotationSharingPopup] ✅ Document: ${document.id}`);

      // Step 4: 获取当前用户
      const user = AuthManager.getCurrentUser();
      if (!user?.id) {
        logger.error('[AnnotationSharingPopup] User not logged in');
        this.showAnnotationPopupFeedback(doc, '❌ 请先登录', false);
        return;
      }
      logger.log(`[AnnotationSharingPopup] ✅ User: ${user.email}`);

      // Step 5: 查询该annotation是否已存在于Supabase
      let existingAnnotation: any = null;
      try {
        // 🔧 FIX: 使用API Client查询annotations表 (不是直接查Supabase client)
        const { APIClient } = await import('../../utils/apiClient');
        const apiClient = APIClient.getInstance();
        
        // 查询该document下的所有annotations,然后过滤出匹配的
        const params = new URLSearchParams({
          document_id: document.id,
          type: 'my' // 只查询当前用户的标注
        });
        
        const response = await apiClient.get<{ success: boolean, data: any[] }>(
          '/api/proxy/annotations',
          params
        );
        
        if (response.success && response.data) {
          // 在返回的数据中查找匹配original_id (zotero_key)的标注
          existingAnnotation = response.data.find(
            (ann: any) => ann.original_id === annotationItem.key
          );
          
          if (existingAnnotation) {
            logger.log(`[AnnotationSharingPopup] Found existing annotation: ${existingAnnotation.id}, visibility=${existingAnnotation.visibility}, show_author_name=${existingAnnotation.show_author_name}`);
          } else {
            logger.log(`[AnnotationSharingPopup] No existing annotation found for zotero_key: ${annotationItem.key}`);
          }
        }
      } catch (error) {
        logger.error('[AnnotationSharingPopup] Error querying existing annotation:', error);
      }

      // Step 6: 构造annotation对象
      const annotation: any = {
        key: annotationItem.key,
        type: annotationItem.annotationType,
        text: annotationItem.annotationText || '',
        comment: annotationItem.annotationComment || '',
        color: annotationItem.annotationColor || '',
        pageLabel: annotationItem.annotationPageLabel || '',
        position: annotationItem.annotationPosition ? JSON.parse(annotationItem.annotationPosition) : {},
        tags: annotationItem.getTags().map((t: any) => t.tag),
        sortIndex: annotationItem.annotationSortIndex,
        supabaseId: (existingAnnotation as any)?.id, // 使用已存在的ID
        visibility: (existingAnnotation as any)?.visibility,
        showAuthorName: (existingAnnotation as any)?.show_author_name,
        synced: !!existingAnnotation
      };

      // Step 6: 转换模式
      // null -> 删除共享 (需要特殊处理)
      // anonymous -> public + show_author_name=false
      // public -> public + show_author_name=true
      // private -> private + show_author_name=true
      
      if (shareMode === null) {
        // 取消共享: 删除Supabase记录
        logger.log('[AnnotationSharingPopup] Unsharing annotation (deleting from Supabase)');
        if (existingAnnotation) {
          // 🔧 FIX: 使用 existingAnnotation 判断,而非 annotation.supabaseId
          try {
            await (this.annotationManager as any).supabaseManager.deleteAnnotation((existingAnnotation as any).id);
            logger.log(`[AnnotationSharingPopup] ✅ Annotation ${annotationItem.key} unshared (deleted from Supabase)`);
            this.showAnnotationPopupFeedback(doc, '✅ 已取消共享', true);
            
            // 刷新视图
            const { UIManager } = await import('../ui-manager');
            const uiManager = UIManager.getInstance();
            const viewMode = (uiManager as any).currentViewMode;
            if (viewMode === 'annotations-manage' || viewMode === 'annotations-shared') {
              logger.log('[AnnotationSharingPopup] Refreshing view after unshare...');
              const panel = (Zotero as any).Researchopia.UI.panel;
              const itemDoc = panel?.contentDocument || (Zotero as any).Researchopia.data.panel.contentDocument;
              if (itemDoc && (uiManager as any).sessionAnnotationsView) {
                await (uiManager as any).sessionAnnotationsView.render(panel.contentSection, itemDoc, '');
              }
            }
            return; // 提前返回,不执行后续更新逻辑
          } catch (error) {
            logger.error('[AnnotationSharingPopup] Failed to delete annotation:', error);
            this.showAnnotationPopupFeedback(doc, '❌ 取消共享失败', false);
            return;
          }
        } else {
          // 本地标注,没有Supabase记录,无需操作
          logger.log('[AnnotationSharingPopup] Local annotation, no Supabase record to delete');
          this.showAnnotationPopupFeedback(doc, '✅ 标注未共享,无需取消', true);
          return;
        }
      }
      
      const visibilityValue: 'private' | 'shared' | 'public' = shareMode === 'anonymous' ? 'public' : shareMode;
      const showAuthorName = shareMode !== 'anonymous';
      logger.log(`[AnnotationSharingPopup] Mode conversion: ${shareMode} -> visibility=${visibilityValue}, showAuthorName=${showAuthorName}`);

      // Step 7: 调用AnnotationManager.updateAnnotationSharing
      const success = await AnnotationManager.updateAnnotationSharing(
        annotation,
        document.id,
        user.id,
        visibilityValue,
        showAuthorName
      );

      if (!success) {
        logger.error('[AnnotationSharingPopup] updateAnnotationSharing failed');
        this.showAnnotationPopupFeedback(doc, '❌ 共享更新失败', false);
        return;
      }

      // Step 8: Session关联 (public/anonymous模式且有当前session)
      if (visibilityValue === 'public') {
        logger.log(`[AnnotationSharingPopup] 🔍 Checking session association... annotation.supabaseId=${annotation.supabaseId}`);
        
        if (!annotation.supabaseId) {
          logger.error('[AnnotationSharingPopup] ❌ annotation.supabaseId is undefined, cannot add to session!');
        } else {
          const { ReadingSessionManager } = await import('../readingSessionManager');
          const sessionManager = ReadingSessionManager.getInstance();
          const session = sessionManager.getCurrentSession();

          if (session) {
            logger.log(`[AnnotationSharingPopup] Adding annotation ${annotation.supabaseId} to session ${session.id}...`);
            try {
              const { APIClient } = await import('../../utils/apiClient');
              const apiClient = APIClient.getInstance();
              await apiClient.post('/api/proxy/annotations/share-to-session', {
                annotation_id: annotation.supabaseId,
                session_id: session.id
              });
              logger.log(`[AnnotationSharingPopup] ✅✅✅ Annotation added to session ${session.id}`);
            } catch (error) {
              logger.error('[AnnotationSharingPopup] Failed to add annotation to session:', error);
              // 不阻塞主流程
            }
          } else {
            logger.log('[AnnotationSharingPopup] No current session, skipping session association');
          }
        }
      }

      // Step 9: 视觉反馈
      const modeConfig = this.shareModes.find(m => m.id === shareMode);
      const label = modeConfig ? `${modeConfig.icon} ${modeConfig.label}` : '❌ 取消共享';
      this.showAnnotationPopupFeedback(doc, `✅ 已更新为: ${label}`, true);

      // Step 10: 刷新视图 (如果在管理标注模式)
      try {
        const { UIManager } = await import('../ui-manager');
        const uiManager = UIManager.getInstance();
        const viewMode = (uiManager as any).currentViewMode;
        
        if (viewMode === 'annotations-manage' || viewMode === 'annotations-shared') {
          logger.log(`[AnnotationSharingPopup] Refreshing ${viewMode} view...`);
          const panel = (Zotero as any).Researchopia.UI.panel;
          const itemDoc = panel?.contentDocument || (Zotero as any).Researchopia.data.panel.contentDocument;
          if (itemDoc && (uiManager as any).sessionAnnotationsView) {
            await (uiManager as any).sessionAnnotationsView.render(panel.contentSection, itemDoc, '');
          }
        }
      } catch (error) {
        logger.error('[AnnotationSharingPopup] Failed to refresh view:', error);
        // 不阻塞主流程
      }

      logger.log(`[AnnotationSharingPopup] ✅ Annotation ${annotationItem.key} updated to ${shareMode || 'unshare'} mode`);
      
      // Step 11: 更新annotation-popup中的按钮状态和共享信息区域
      try {
        // 在doc中查找包含该annotation key的popup
        const popups = doc.querySelectorAll('.annotation-popup');
        popups.forEach(async (popup: Element) => {
          const contentElement = popup.querySelector('.comment .content') as HTMLElement;
          if (contentElement?.id === annotationItem.key) {
            // 找到了对应的popup,更新其中的按钮状态
            const buttonContainer = popup.querySelector('#researchopia-annotation-popup-buttons');
            if (buttonContainer) {
              this.shareModes.forEach(mode => {
                const button = buttonContainer.querySelector(`button[data-mode="${mode.id || 'unshare'}"]`) as HTMLButtonElement;
                if (button) {
                  const isActive = shareMode === mode.id;
                  button.style.borderColor = isActive ? mode.color : '#ccc';
                  button.style.background = isActive ? `${mode.color}20` : '#fff';
                  button.style.color = isActive ? mode.color : '#333';
                  button.style.fontWeight = isActive ? '600' : '400';
                  // 🆕 同步更新 data-active 属性
                  button.setAttribute('data-active', isActive ? 'true' : 'false');
                }
              });
              logger.log(`[AnnotationSharingPopup] 🎨 Updated button states in popup for ${annotationItem.key}`);
            }
            
            // 🆕 刷新 shared-info 区域
            const sharedInfoContainer = popup.querySelector('#researchopia-shared-info') as HTMLElement;
            if (sharedInfoContainer) {
              // 显示加载状态
              sharedInfoContainer.innerHTML = '<div style="text-align: center; color: #999; padding: 8px; font-size: 11px;">⏳ 刷新共享信息...</div>';
              
              // 获取 reader 对象
              const readerWindows = (Zotero as any).Reader.getWindowStates();
              const reader = readerWindows?.length > 0 ? (Zotero as any).Reader._readers?.[0] : null;
              
              if (reader) {
                // 清除缓存并重新加载
                this.cache.clearSharedInfoCache();
                await this.loadSharedInfo(annotationItem.key, sharedInfoContainer, doc, reader, true);
                logger.log(`[AnnotationSharingPopup] 📊 Refreshed shared-info for ${annotationItem.key}`);
              } else {
                sharedInfoContainer.innerHTML = '<div style="color: #999; font-style: italic;">刷新失败</div>';
              }
            }
          }
        });
      } catch (error) {
        logger.error('[AnnotationSharingPopup] Error updating button states:', error);
        // 不阻塞主流程
      }
    } catch (error) {
      logger.error('[AnnotationSharingPopup] ❌ Error updating annotation:', error);
      this.showAnnotationPopupFeedback(doc, '❌ 更新失败,请重试', false);
    }
  }

  /**
   * 🆕 显示annotation-popup的视觉反馈
   */
  private showAnnotationPopupFeedback(doc: Document, message: string, isSuccess: boolean): void {
    let feedbackElement = doc.getElementById('researchopia-annotation-popup-feedback');

    if (!feedbackElement) {
      feedbackElement = doc.createElement('div');
      feedbackElement.id = 'researchopia-annotation-popup-feedback';
      feedbackElement.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 16px;
        background: rgba(0, 0, 0, 0.8);
        color: #fff;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s;
      `;
      doc.body.appendChild(feedbackElement);
    }

    feedbackElement.textContent = message;
    feedbackElement.style.opacity = '1';

    // 2秒后淡出
    setTimeout(() => {
      feedbackElement!.style.opacity = '0';
    }, 2000);
  }

  /**
   * 🆕 向annotation-popup注入共享信息区 (用户名、点赞、评论)
   */
  private async injectSharedInfoToAnnotationPopup(
    popupElement: HTMLElement,
    annotationKey: string,
    doc: Document,
    reader: any
  ): Promise<void> {
    try {
      logger.log('[AnnotationSharingPopup] 📊 Injecting shared info to annotation-popup...');

      const previewContainer = popupElement.querySelector('.preview') as HTMLElement;
      if (!previewContainer) {
        logger.warn('[AnnotationSharingPopup] Cannot find .preview container');
        return;
      }

      // 检查是否已注入
      if (previewContainer.querySelector('#researchopia-shared-info')) {
        logger.log('[AnnotationSharingPopup] Shared info already injected, skipping');
        return;
      }

      // 创建共享信息容器
      const sharedInfoContainer = doc.createElement('div');
      sharedInfoContainer.id = 'researchopia-shared-info';
      sharedInfoContainer.style.cssText = `
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #e0e0e0;
        font-size: 11px;
        color: #666;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      `;

      // 立即插入 "加载中..." 占位符
      const loadingDiv = doc.createElement('div');
      loadingDiv.textContent = '⏳ 加载共享信息...';
      loadingDiv.style.cssText = `
        text-align: center;
        color: #999;
        padding: 8px;
        font-size: 11px;
      `;
      sharedInfoContainer.appendChild(loadingDiv);

      // 插入到 preview 容器
      previewContainer.appendChild(sharedInfoContainer);

      // 异步加载共享信息
      await this.loadSharedInfo(annotationKey, sharedInfoContainer, doc, reader);

      logger.log('[AnnotationSharingPopup] ✅ Shared info container injected');
    } catch (error) {
      logger.error('[AnnotationSharingPopup] Error injecting shared info:', error);
    }
  }

  /**
   * 🆕 加载并渲染共享信息 (异步)
   * @param forceRefresh 是否强制刷新 (跳过缓存)
   */
  private async loadSharedInfo(
    annotationKey: string,
    container: HTMLElement,
    doc: Document,
    reader: any,
    forceRefresh: boolean = false
  ): Promise<void> {
    try {
      // Step 1: 获取annotation item
      const libraryID = reader.itemID?.libraryID || 1;
      const annotationItem = (Zotero as any).Items.getByLibraryAndKey(libraryID, annotationKey);
      if (!annotationItem) {
        container.innerHTML = '<div style="color: #999; font-style: italic;">未找到标注</div>';
        return;
      }

      // Step 2: 获取paper和DOI
      const pdfAttachment = annotationItem.parentItem;
      if (!pdfAttachment) {
        container.innerHTML = '<div style="color: #999; font-style: italic;">未找到PDF</div>';
        return;
      }
      
      let paperItem = pdfAttachment.parentItem;
      if (!paperItem && pdfAttachment.parentItemID) {
        paperItem = (Zotero as any).Items.get(pdfAttachment.parentItemID);
      }
      if (!paperItem) {
        container.innerHTML = '<div style="color: #999; font-style: italic;">未找到论文</div>';
        return;
      }

      const doi = paperItem.getField?.('DOI');
      if (!doi) {
        container.innerHTML = '<div style="color: #999; font-style: italic;">论文无DOI</div>';
        return;
      }

      // Step 3: 获取document ID 和 paper_id (使用共享缓存)
      let documentId: string | undefined = this.cache.getDocumentId(doi);
      let paperId: string | undefined = this.cache.getPaperId(doi);
      
      if (!documentId) {
        const document = await (this.annotationManager as any).supabaseManager.findOrCreateDocument(paperItem);
        if (!document?.id) {
          container.innerHTML = '<div style="color: #999; font-style: italic;">未创建文档</div>';
          return;
        }
        documentId = document.id as string;
        this.cache.setDocumentId(doi, documentId);
        
        // 同时缓存 paper_id (用于打开论文详情页)
        if (document.paper_id) {
          paperId = document.paper_id as string;
          this.cache.setPaperId(doi, paperId);
        }
      }

      // Step 4: 查询标注详情
      const { APIClient } = await import('../../utils/apiClient');
      const apiClient = APIClient.getInstance();
      const params = new URLSearchParams();
      params.append('document_id', documentId);
      params.append('type', 'my');

      const response = await apiClient.get<{ success: boolean, data: any[] }>(
        '/api/proxy/annotations',
        params
      );

      if (!response.success || !response.data) {
        container.innerHTML = '<div style="color: #999; font-style: italic;">未共享</div>';
        return;
      }

      const annotation = response.data.find((ann: any) => ann.original_id === annotationKey);
      if (!annotation) {
        container.innerHTML = '<div style="color: #999; font-style: italic;">未共享</div>';
        return;
      }

      // Step 5: 检查缓存 (使用共享缓存, 5秒有效期), forceRefresh=true时跳过缓存
      let likes: any[] = [];
      let comments: any[] = [];

      const cached = !forceRefresh ? this.cache.getSharedInfo(annotation.id) : null;
      if (cached) {
        logger.log('[AnnotationSharingPopup] Using cached shared info');
        likes = cached.likes;
        comments = cached.comments;
      } else {
        // 并行查询点赞和评论
        const { UIManager } = await import('../ui-manager');
        const uiManager = UIManager.getInstance();
        const supabaseManager = (uiManager as any).supabaseManager;

        if (supabaseManager) {
          [likes, comments] = await Promise.all([
            supabaseManager.getAnnotationLikes(annotation.id),
            supabaseManager.getAnnotationCommentTree(annotation.id)
          ]);

          // 🔍 调试: 打印评论数据结构
          logger.log('[AnnotationSharingPopup] 📝 Comments data:', JSON.stringify(comments?.slice(0, 1), null, 2));

          // 存入共享缓存
          this.cache.setSharedInfo(annotation.id, likes || [], comments || []);
        }
      }

      // Step 6: 清空 "加载中..." 占位符
      container.innerHTML = '';

      // Step 7: 渲染点赞数 (可点击) - 不显示用户名,因为是自己的标注
      const likesDiv = doc.createElement('div');
      likesDiv.textContent = `❤️ ${likes.length}人点赞`;
      likesDiv.style.cssText = `
        margin-bottom: 6px;
        cursor: pointer;
        color: #666;
        transition: color 0.2s;
      `;
      likesDiv.addEventListener('mouseenter', () => {
        likesDiv.style.color = '#f87171';
      });
      likesDiv.addEventListener('mouseleave', () => {
        likesDiv.style.color = '#666';
      });
      likesDiv.addEventListener('click', () => {
        // 打开论文详情页 (使用 paper_id)
        if (paperId) {
          const url = `https://researchopia.com/papers/${paperId}`;
          (Zotero as any).launchURL(url);
        } else {
          logger.warn('[AnnotationSharingPopup] No paper_id available, cannot open paper detail page');
        }
      });
      container.appendChild(likesDiv);

      // Step 9: 渲染评论 (前3条)
      if (comments && comments.length > 0) {
        const totalComments = CommentRenderer.countTotalComments(comments);
        const commentsTitle = doc.createElement('div');
        commentsTitle.textContent = `💬 ${totalComments}条评论`;
        commentsTitle.style.cssText = `
          font-weight: 600;
          color: #666;
          margin: 8px 0 6px 0;
          font-size: 11px;
        `;
        container.appendChild(commentsTitle);

        // 渲染前3条评论
        CommentRenderer.renderCommentList(comments.slice(0, 3), container, doc, { maxDepth: 2 });

        // "查看全部" 链接
        if (comments.length > 3) {
          const viewAllLink = doc.createElement('a');
          viewAllLink.textContent = '查看全部评论 →';
          // 打开论文详情页 (使用 paper_id)
          viewAllLink.href = paperId ? `https://researchopia.com/papers/${paperId}` : '#';
          viewAllLink.target = '_blank';
          viewAllLink.style.cssText = `
            display: block;
            margin-top: 8px;
            color: #3b82f6;
            text-decoration: none;
            font-size: 10px;
            cursor: pointer;
          `;
          viewAllLink.addEventListener('mouseenter', () => {
            viewAllLink.style.textDecoration = 'underline';
          });
          viewAllLink.addEventListener('mouseleave', () => {
            viewAllLink.style.textDecoration = 'none';
          });
          container.appendChild(viewAllLink);
        }
      } else {
        const noComments = doc.createElement('div');
        noComments.textContent = '暂无评论';
        noComments.style.cssText = `
          color: #999;
          font-style: italic;
          margin-top: 6px;
          font-size: 11px;
        `;
        container.appendChild(noComments);
      }

      logger.log('[AnnotationSharingPopup] ✅ Shared info loaded and rendered');
    } catch (error) {
      logger.error('[AnnotationSharingPopup] Error loading shared info:', error);
      container.innerHTML = '<div style="color: #f87171; font-size: 11px;">加载失败</div>';
    }
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    if (this.zoteroNotifierID) {
      (Zotero as any).Notifier.unregisterObserver(this.zoteroNotifierID);
      this.zoteroNotifierID = undefined;
      logger.log('[AnnotationSharingPopup] Notifier unregistered');
    }

    this.isInitialized = false;
    logger.log('[AnnotationSharingPopup] ✅ Destroyed');
  }
}
