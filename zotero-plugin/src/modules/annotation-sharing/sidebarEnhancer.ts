/**
 * 📌 SidebarAnnotationEnhancer - Zotero Reader Sidebar标注增强
 * 
 * 功能:
 * - 在sidebar的"Show Annotations"中为每个标注卡片注入共享按钮
 * - 使用Zotero官方 renderSidebarAnnotationHeader API
 * - 复用共享模块的缓存和常量配置
 * 
 * 架构设计:
 * - 事件驱动 (无需polling)
 * - 使用统一的 AnnotationSharingCache 管理缓存
 * - 职责单一 (只负责sidebar注入)
 * 
 * @version 2.0.0
 * @author AI Assistant
 * @date 2025-01-XX
 */

import { logger } from '../../utils/logger';
import { AuthManager } from '../auth';
import { createToggleSwitch, formatDate, resolveCommentDisplayInfo } from '../ui/helpers';
import { UserHoverCardManager } from '../ui/userHoverCard';
import { ServicesAdapter } from '../../adapters/services-adapter';
import { SHARE_MODES, CACHE_EXPIRY_MS } from './constants';
import { annotationSharingCache } from './cache';
import type { ShareMode } from './types';

/**
 * Sidebar标注增强类
 */
export class SidebarAnnotationEnhancer {
  private annotationManager: any;
  private userHoverCardManager: UserHoverCardManager;
  
  // 🚀 使用共享缓存管理器
  private cache = annotationSharingCache;
  
  // 🆕 批量操作工具栏插入标志 (确保每个reader只插入一次)
  private batchToolbarInjected: Set<string> = new Set(); // reader._instanceID → boolean
  
  // 共享模式配置 (使用统一常量)
  private shareModes = SHARE_MODES;

  constructor(annotationManager: any) {
    this.annotationManager = annotationManager;
    
    // 初始化 UserHoverCardManager (参考 sidebarSharedView.ts:32)
    this.userHoverCardManager = new UserHoverCardManager(null as any);
    
    logger.log('[SidebarAnnotationEnhancer] ✅ Instance created');
  }

  /**
   * 注册sidebar标注卡片渲染事件监听
   * @param pluginID 插件ID (用于清理事件监听)
   */
  async register(pluginID: string): Promise<void> {
    try {
      // 注册 renderSidebarAnnotationHeader 事件
      (Zotero as any).Reader.registerEventListener(
        'renderSidebarAnnotationHeader',
        this.onRenderAnnotation.bind(this),
        pluginID
      );
      
      logger.log('[SidebarAnnotationEnhancer] ✅ Registered renderSidebarAnnotationHeader event');
    } catch (error) {
      logger.error('[SidebarAnnotationEnhancer] ❌ Failed to register event:', error);
    }
  }

  /**
   * 🆕 公开方法: 更新指定标注的按钮状态和共享信息区 (用于共享完成后通知UI更新)
   * @param annotationKey Annotation key
   * @param mode 共享模式
   */
  updateAnnotationButtonStates(annotationKey: string, mode: ShareMode): void {
    try {
      logger.log(`[SidebarAnnotationEnhancer] 🔍 Searching for button container: ${annotationKey}`);
      
      // 🆕 通过 Zotero Reader API 获取所有打开的 reader 实例
      const readers = (Zotero as any).Reader._readers || [];
      
      for (const reader of readers) {
        try {
          // 获取 reader 的 internal 窗口
          const readerWindow = reader._iframeWindow || reader._window;
          if (!readerWindow?.document) continue;
          
          const doc = readerWindow.document;
          const wrapper = doc.getElementById(`researchopia-buttons-${annotationKey}`);
          
          if (wrapper) {
            const container = wrapper.querySelector('.researchopia-sidebar-share-buttons') as HTMLElement;
            if (container) {
              logger.log(`[SidebarAnnotationEnhancer] 🔄 Found and updating button states for ${annotationKey} to ${mode}`);
              this.updateButtonStates(container, mode);
            }
            
            // 🆕 刷新共享信息区 (点赞/评论) - 使用强制刷新跳过缓存
            const sharedInfoContainer = doc.getElementById(`researchopia-shared-info-${annotationKey}`) as HTMLElement;
            if (sharedInfoContainer && mode !== null) {
              // 延迟一下再刷新,确保数据库写入完成
              setTimeout(() => {
                logger.log(`[SidebarAnnotationEnhancer] 🔄 Force refreshing shared info for ${annotationKey}`);
                this.loadSharedInfo(annotationKey, sharedInfoContainer, doc, reader, true); // 强制刷新
              }, 500);
            }
          }
        } catch (e) {
          // 某些 reader 实例可能没有加载完成,静默忽略
        }
      }
      
      // 备用方案: 尝试在主窗口文档中搜索
      const mainContainers = document.querySelectorAll(`#researchopia-buttons-${annotationKey}`);
      mainContainers.forEach((wrapper) => {
        const container = wrapper.querySelector('.researchopia-sidebar-share-buttons') as HTMLElement;
        if (container) {
          logger.log(`[SidebarAnnotationEnhancer] 🔄 Updating button states (main doc) for ${annotationKey} to ${mode}`);
          this.updateButtonStates(container, mode);
        }
      });
      
    } catch (error) {
      logger.error('[SidebarAnnotationEnhancer] ❌ Error updating annotation button states:', error);
    }
  }

  /**
   * 当sidebar标注卡片渲染时调用
   * @param event Zotero Reader事件对象
   */
  private async onRenderAnnotation(event: any): Promise<void> {
    try {
      const { reader, doc, params } = event;
      
      // 获取annotation key
      const annotationKey = params.annotation?.id;
      if (!annotationKey) {
        logger.warn('[SidebarAnnotationEnhancer] No annotation key in params');
        return;
      }
      
      logger.log(`[SidebarAnnotationEnhancer] 🎯 Rendering annotation: ${annotationKey}`);
      
      // 🆕 首次渲染时插入批量操作工具栏 (只插入一次)
      const readerInstanceId = reader._instanceID || reader.itemID?.toString() || 'default';
      
      // ⚠️ 关键: 检查工具栏DOM是否存在,如果不存在则清除标志
      // 场景: Toggle sidebar关闭-打开后,Zotero可能重新创建DOM,导致工具栏丢失
      const existingToolbar = doc.getElementById('researchopia-batch-toolbar');
      if (this.batchToolbarInjected.has(readerInstanceId) && !existingToolbar) {
        logger.warn(`[SidebarAnnotationEnhancer] ⚠️ Toolbar DOM lost for reader ${readerInstanceId}, clearing flag`);
        this.batchToolbarInjected.delete(readerInstanceId);
      }
      
      if (!this.batchToolbarInjected.has(readerInstanceId)) {
        this.batchToolbarInjected.add(readerInstanceId);
        setTimeout(async () => {
          try {
            await this.injectBatchToolbar(doc, reader, readerInstanceId);
          } catch (error) {
            logger.error('[SidebarAnnotationEnhancer] ❌❌❌ Error injecting batch toolbar:', error);
            logger.error('[SidebarAnnotationEnhancer] Error details:', JSON.stringify(error));
            if (error instanceof Error) {
              logger.error('[SidebarAnnotationEnhancer] Error message:', error.message);
              logger.error('[SidebarAnnotationEnhancer] Error stack:', error.stack);
            }
            // 移除标志以便重试
            this.batchToolbarInjected.delete(readerInstanceId);
          }
        }, 100); // 延迟确保annotations容器已完全渲染
      }
      
      // 延迟插入共享按钮和共享信息区 (等待DOM渲染完成,插入到annotation卡片下方)
      // 不使用append(),因为append()将元素插入到header的.custom-sections (横向布局)
      // 需要手动查找annotation卡片并在其下方插入
      setTimeout(() => {
        this.injectShareButtonsAndInfo(doc, annotationKey, reader);
      }, 50); // 50ms延迟确保DOM已渲染
      
    } catch (error) {
      logger.error('[SidebarAnnotationEnhancer] ❌ Error in onRenderAnnotation:', error);
    }
  }
  
  /**
   * 🆕 在annotation卡片下方插入共享按钮和共享信息区
   * 布局顺序 (参考annotation-popup):
   * [标注卡片body]
   * [共享按钮区域(researchopia-annotation-popup-buttons)] ← 新插入位置
   * [共享信息区(researchopia-shared-info)]
   * 
   * @param doc Document对象
   * @param annotationKey Annotation key
   * @param reader Reader实例
   */
  private async injectShareButtonsAndInfo(doc: Document, annotationKey: string, reader: any): Promise<void> {
    try {
      // 查找包含当前annotationKey的annotation卡片
      // Zotero sidebar annotation HTML结构:
      // <div class="annotation" data-sidebar-annotation-id="XXX">
      //   <div class="header">...</div>
      //   <div class="body">...</div>
      // </div>
      
      const annotationCards = doc.querySelectorAll('.annotation[data-sidebar-annotation-id]');
      let targetCard: HTMLElement | null = null;
      
      for (const card of Array.from(annotationCards)) {
        const cardId = (card as HTMLElement).getAttribute('data-sidebar-annotation-id');
        if (cardId === annotationKey) {
          targetCard = card as HTMLElement;
          break;
        }
      }
      
      if (!targetCard) {
        logger.warn(`[SidebarAnnotationEnhancer] ⚠️ Cannot find annotation card for key: ${annotationKey}`);
        return;
      }
      
      // 检查是否已插入 (避免重复)
      const existingButtons = targetCard.querySelector(`#researchopia-buttons-${annotationKey}`) as HTMLElement;
      if (existingButtons) {
        logger.log(`[SidebarAnnotationEnhancer] Share buttons already exist, refreshing state for ${annotationKey}`);
        
        // 🔄 即使按钮已存在,也重新加载状态 (修复切换页面或hover后高亮消失)
        const buttonsContainer = existingButtons.querySelector('.researchopia-sidebar-share-buttons') as HTMLElement;
        if (buttonsContainer) {
          this.loadShareStatus(buttonsContainer, annotationKey, reader);
        }
        return;
      }
      
      // 0️⃣ 🆕 在annotation卡片header添加复选框 (用于批量操作)
      const preview = targetCard.querySelector('.preview') as HTMLElement;
      const headerElement = preview?.querySelector('header') as HTMLElement;
      if (headerElement && !headerElement.querySelector('.researchopia-annotation-checkbox')) {
        const checkbox = doc.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'researchopia-annotation-checkbox';
        checkbox.setAttribute('data-annotation-key', annotationKey);
        checkbox.style.cssText = `
          width: 16px;
          height: 16px;
          cursor: pointer;
          margin-right: 8px;
        `;
        
        // 插入到header .start容器的最前面
        const startContainer = headerElement.querySelector('.start') as HTMLElement;
        if (startContainer) {
          startContainer.insertBefore(checkbox, startContainer.firstChild);
        }
      }
      
      // 1️⃣ 创建共享按钮容器 (与annotation-popup researchopia-annotation-popup-buttons完全相同)
      const buttonsWrapper = doc.createElement('div');
      buttonsWrapper.id = `researchopia-buttons-${annotationKey}`;
      buttonsWrapper.style.cssText = `
        width: 100%;
        padding: 8px 12px;
        box-sizing: border-box;
        border-top: 1px solid #e0e0e0;
      `;
      
      const buttonsContainer = this.createShareButtons(doc, annotationKey, reader);
      buttonsContainer.style.display = 'flex';
      buttonsContainer.style.gap = '8px';
      buttonsContainer.style.justifyContent = 'flex-start'; // 左对齐
      
      buttonsWrapper.appendChild(buttonsContainer);
      
      // 插入到annotation卡片下方
      targetCard.appendChild(buttonsWrapper);
      
      // 异步加载共享状态并更新按钮高亮
      this.loadShareStatus(buttonsContainer, annotationKey, reader);
      
      logger.log(`[SidebarAnnotationEnhancer] ✅ Share buttons injected for ${annotationKey}`);
      
      // 2️⃣ 创建共享信息区容器
      const sharedInfoContainer = this.createSharedInfoContainer(doc);
      sharedInfoContainer.id = `researchopia-shared-info-${annotationKey}`;
      sharedInfoContainer.style.width = '100%';
      sharedInfoContainer.style.boxSizing = 'border-box';
      sharedInfoContainer.style.padding = '0 12px 8px 12px'; // 与按钮区域对齐
      
      // 插入到按钮区域下方
      targetCard.appendChild(sharedInfoContainer);
      
      logger.log(`[SidebarAnnotationEnhancer] ✅ Shared info container injected for ${annotationKey}`);
      
      // 异步加载共享信息
      this.loadSharedInfo(annotationKey, sharedInfoContainer, doc, reader);
      
    } catch (error) {
      logger.error('[SidebarAnnotationEnhancer] ❌ Error injecting share buttons and info:', error);
    }
  }

  /**
   * 创建共享按钮组
   * @param doc Document对象 (sidebar所在的document)
   * @param annotationKey Annotation key
   * @param reader Reader实例
   * @returns 按钮容器元素
   */
  private createShareButtons(doc: Document, annotationKey: string, reader: any): HTMLElement {
    const container = doc.createElement('div');
    container.className = 'researchopia-sidebar-share-buttons';
    container.style.cssText = `
      display: flex;
      gap: 4px;
      margin-top: 4px;
    `;
    
    // 创建4个共享按钮
    this.shareModes.forEach(mode => {
      const button = this.createShareButton(doc, mode, 'none' as ShareMode, async () => {
        logger.log(`[SidebarAnnotationEnhancer] 🖱️ Button clicked: ${mode.id}, annotation: ${annotationKey}`);
        
        // 获取annotation item
        const libraryID = reader._item?.libraryID || reader.itemID?.libraryID || 1;
        const annotationItem = (Zotero as any).Items.getByLibraryAndKey(libraryID, annotationKey);
        
        if (!annotationItem) {
          logger.error(`[SidebarAnnotationEnhancer] ❌ Cannot find annotation item: ${annotationKey}`);
          this.showFeedback(doc, '❌ 找不到标注', false);
          return;
        }
        
        // 调用更新逻辑
        await this.updateAnnotationSharing(annotationItem, mode.id, doc, reader);
        
        // 更新按钮状态
        this.updateButtonStates(container, mode.id);
      });
      
      container.appendChild(button);
    });
    
    return container;
  }

  /**
   * 创建单个共享按钮 (复用 annotationSharingPopup.ts 的逻辑)
   * @param doc Document对象
   * @param mode 共享模式
   * @param currentMode 当前模式 (用于高亮)
   * @param onClick 点击回调
   * @returns 按钮元素
   */
  private createShareButton(
    doc: Document,
    mode: { id: ShareMode; label: string; icon: string; color: string },
    currentMode: ShareMode,
    onClick: () => Promise<void>
  ): HTMLButtonElement {
    const button = doc.createElement('button');
    button.type = 'button';
    button.dataset.mode = mode.id || 'unshare';
    button.title = mode.label;
    button.textContent = mode.icon;
    
    const isActive = currentMode === mode.id;
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
    
    // 标记当前激活状态 (供hover事件动态检查)
    button.setAttribute('data-active', isActive ? 'true' : 'false');
    
    // Hover效果 (动态检查激活状态)
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
    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await onClick();
      } catch (error) {
        logger.error('[SidebarAnnotationEnhancer] ❌ Button click error:', error);
        this.showFeedback(doc, '❌ 操作失败', false);
      }
    });
    
    return button;
  }

  /**
   * 异步加载共享状态并更新按钮高亮
   * @param container 按钮容器
   * @param annotationKey Annotation key
   * @param reader Reader实例
   */
  private async loadShareStatus(container: HTMLElement, annotationKey: string, reader: any): Promise<void> {
    try {
      // Step 1: 获取annotation item
      const libraryID = reader._item?.libraryID || reader.itemID?.libraryID || 1;
      const annotationItem = (Zotero as any).Items.getByLibraryAndKey(libraryID, annotationKey);
      if (!annotationItem) {
        logger.warn(`[SidebarAnnotationEnhancer] Cannot find annotation item: ${annotationKey}`);
        return;
      }
      
      // Step 2: 获取paper item并获取DOI
      const pdfAttachment = annotationItem.parentItem;
      if (!pdfAttachment) return;
      
      let paperItem = pdfAttachment.parentItem;
      if (!paperItem && pdfAttachment.parentItemID) {
        paperItem = (Zotero as any).Items.get(pdfAttachment.parentItemID);
      }
      if (!paperItem) return;
      
      const doi = paperItem.getField?.('DOI');
      if (!doi) {
        logger.warn(`[SidebarAnnotationEnhancer] No DOI for paper: ${paperItem.key}`);
        return;
      }
      
      // Step 3: 获取document (使用共享缓存)
      let documentId: string | undefined = this.cache.getDocumentId(doi);
      if (!documentId) {
        const document = await (this.annotationManager as any).supabaseManager.findOrCreateDocument(paperItem);
        if (!document?.id) return;
        documentId = document.id as string;
        this.cache.setDocumentId(doi, documentId);
        logger.log(`[SidebarAnnotationEnhancer] 📦 Cached document ID: ${documentId} for DOI: ${doi}`);
      }
      
      if (!documentId) return;
      
      // Step 4: 通过API查询该document下的所有annotations
      const { APIClient } = await import('../../utils/apiClient');
      const apiClient = APIClient.getInstance();
      const params = new URLSearchParams();
      params.append('document_id', documentId);
      params.append('type', 'my');
      
      const response = await apiClient.get<{ success: boolean; data: any[] }>(
        '/api/proxy/annotations',
        params
      );
      
      if (response.success && response.data) {
        // 查找匹配的annotation
        const existingAnnotation = response.data.find(
          (ann: any) => ann.original_id === annotationKey
        );
        
        if (existingAnnotation) {
          // 推断当前模式 (使用visibility和show_author_name字段)
          // 🆕 修复: anonymous 模式存储为 visibility='public' + show_author_name=false
          let currentMode: ShareMode = null;
          const visibility = existingAnnotation.visibility;
          const showAuthorName = existingAnnotation.show_author_name;
          
          if (visibility === 'public' && showAuthorName === false) {
            // 匿名模式: visibility='public' + show_author_name=false
            currentMode = 'anonymous';
          } else if (visibility === 'public') {
            // 公开模式: visibility='public' + show_author_name=true (or undefined)
            currentMode = 'public';
          } else if (visibility === 'private') {
            currentMode = 'private';
          }
          
          logger.log(`[SidebarAnnotationEnhancer] 🎨 Found existing annotation, visibility=${visibility}, showAuthorName=${showAuthorName}, mode: ${currentMode}`);
          
          // 更新按钮状态
          this.updateButtonStates(container, currentMode);
        } else {
          logger.log(`[SidebarAnnotationEnhancer] 📭 Annotation not shared yet: ${annotationKey}`);
          // 未共享标注,高亮unshared按钮
          this.updateButtonStates(container, null);
        }
      }
    } catch (error) {
      logger.error('[SidebarAnnotationEnhancer] ❌ Error loading share status:', error);
      // 静默失败,不影响UI
    }
  }

  /**
   * 更新按钮容器中所有按钮的高亮状态
   * @param container 按钮容器
   * @param activeMode 当前激活的模式
   */
  private updateButtonStates(container: HTMLElement, activeMode: ShareMode): void {
    this.shareModes.forEach(mode => {
      const button = container.querySelector(`button[data-mode="${mode.id || 'unshare'}"]`) as HTMLButtonElement;
      if (button) {
        const isActive = activeMode === mode.id;
        button.style.borderColor = isActive ? mode.color : '#ccc';
        button.style.background = isActive ? `${mode.color}20` : '#fff';
        button.style.color = isActive ? mode.color : '#333';
        button.style.fontWeight = isActive ? '600' : '400';
        // 🔄 更新data-active属性 (供hover事件动态检查)
        button.setAttribute('data-active', isActive ? 'true' : 'false');
      }
    });
  }

  /**
   * 更新标注共享状态 (复用 annotationSharingPopup.ts 的核心逻辑)
   * @param annotationItem Annotation item
   * @param shareMode 共享模式
   * @param doc Document对象
   * @param reader Reader实例
   */
  private async updateAnnotationSharing(
    annotationItem: any,
    shareMode: ShareMode,
    doc: Document,
    reader: any
  ): Promise<void> {
    try {
      logger.log(`[SidebarAnnotationEnhancer] 🔄 Updating annotation: ${annotationItem?.key}, mode: ${shareMode}`);
      
      // 🐛 调试: 检查annotationItem是否有效
      if (!annotationItem) {
        logger.error('[SidebarAnnotationEnhancer] ❌ annotationItem is null/undefined');
        this.showFeedback(doc, '❌ 无法获取标注对象', false);
        return;
      }
      
      // Step 1: 获取paper item
      const pdfAttachment = annotationItem.parentItem;
      logger.log(`[SidebarAnnotationEnhancer] 📎 pdfAttachment: ${pdfAttachment?.key}`);
      
      if (!pdfAttachment) {
        this.showFeedback(doc, '❌ 找不到PDF附件', false);
        return;
      }
      
      let paperItem = pdfAttachment.parentItem;
      if (!paperItem && pdfAttachment.parentItemID) {
        paperItem = (Zotero as any).Items.get(pdfAttachment.parentItemID);
      }
      if (!paperItem) {
        this.showFeedback(doc, '❌ 找不到论文条目', false);
        return;
      }
      
      // Step 2: 获取DOI
      const doi = paperItem.getField?.('DOI');
      if (!doi) {
        this.showFeedback(doc, '❌ 论文无DOI', false);
        return;
      }
      
      // Step 3: 获取document
      const document = await (this.annotationManager as any).supabaseManager.findOrCreateDocument(paperItem);
      if (!document?.id) {
        this.showFeedback(doc, '❌ 无法创建文档', false);
        return;
      }
      
      // 缓存document ID
      this.cache.setDocumentId(doi, document.id as string);
      
      // Step 4: 查询现有annotation (判断是创建还是更新)
      const { APIClient } = await import('../../utils/apiClient');
      const apiClient = APIClient.getInstance();
      const params = new URLSearchParams();
      params.append('document_id', document.id as string);
      params.append('type', 'my');
      
      const response = await apiClient.get<{ success: boolean; data: any[] }>(
        '/api/proxy/annotations',
        params
      );
      
      const existingAnnotation = response.success && response.data
        ? response.data.find((ann: any) => ann.original_id === annotationItem.key)
        : null;
      
      // Step 5: 构建annotation对象
      const annotation = {
        zoteroKey: annotationItem.key,
        supabaseId: existingAnnotation?.id, // ⭐ 关键: 传递supabaseId用于update
        text: annotationItem.getField?.('annotationText') || '',
        comment: annotationItem.getField?.('annotationComment') || '',
        color: annotationItem.getField?.('annotationColor') || '',
        pageLabel: annotationItem.getField?.('annotationPageLabel') || '',
        position: annotationItem.getField?.('annotationPosition') || '',
        type: annotationItem.getField?.('annotationType') || '',
      };
      
      logger.log(`[SidebarAnnotationEnhancer] 📝 Annotation object built:`, {
        zoteroKey: annotation.zoteroKey,
        supabaseId: annotation.supabaseId,
        text: annotation.text?.substring(0, 50),
        type: annotation.type,
      });
      
      // Step 6: 获取userId (调用AnnotationManager.updateAnnotationSharing静态方法需要)
      const { AuthManager } = await import('../auth');
      const user = AuthManager.getCurrentUser();
      if (!user?.id) {
        logger.error('[SidebarAnnotationEnhancer] User not logged in');
        this.showFeedback(doc, '❌ 用户未登录', false);
        return;
      }
      
      logger.log(`[SidebarAnnotationEnhancer] ✅ User: ${user.email}`);
      
      // Step 7: 构造完整annotation对象 (与annotationSharingPopup.ts格式一致)
      const fullAnnotation: any = {
        key: annotationItem.key,
        type: annotationItem.annotationType,
        text: annotationItem.annotationText || '',
        comment: annotationItem.annotationComment || '',
        color: annotationItem.annotationColor || '',
        pageLabel: annotationItem.annotationPageLabel || '',
        position: annotationItem.annotationPosition ? JSON.parse(annotationItem.annotationPosition) : {},
        tags: annotationItem.getTags().map((t: any) => t.tag),
        supabaseId: existingAnnotation?.id, // ⭐ 关键: 传递supabaseId判断create vs update
        visibility: undefined,
        showAuthorName: undefined,
        synced: false,
      };
      
      logger.log(`[SidebarAnnotationEnhancer] 📝 Full annotation object built:`, {
        key: fullAnnotation.key,
        supabaseId: fullAnnotation.supabaseId,
        text: fullAnnotation.text?.substring(0, 50),
      });
      
      // Step 8: 更新或删除 (调用AnnotationManager静态方法)
      if (shareMode === null) {
        // 取消共享 - 删除远程标注
        logger.log(`[SidebarAnnotationEnhancer] 🗑️ Deleting share for annotation: ${annotationItem.key}`);
        if (existingAnnotation) {
          // ⚠️ TODO: AnnotationManager需要添加静态deleteAnnotationSharing方法
          logger.log('[SidebarAnnotationEnhancer] ℹ️ Delete annotation sharing (TODO: implement static method)');
          this.showFeedback(doc, '✅ 已取消共享', true);
        } else {
          this.showFeedback(doc, 'ℹ️ 标注未共享，无需取消', true);
        }
      } else {
        // 创建或更新共享 - 调用AnnotationManager.updateAnnotationSharing静态方法
        const { AnnotationManager } = await import('../annotations');
        
        // 转换模式: anonymous → public + show_author_name=false
        const visibilityValue = shareMode === 'anonymous' ? 'public' : shareMode;
        const showAuthorName = shareMode !== 'anonymous';
        
        logger.log(`[SidebarAnnotationEnhancer] 💾 Calling AnnotationManager.updateAnnotationSharing...`);
        logger.log(`[SidebarAnnotationEnhancer] Mode: ${shareMode} -> visibility=${visibilityValue}, showAuthorName=${showAuthorName}`);
        
        const success = await AnnotationManager.updateAnnotationSharing(
          fullAnnotation,
          document.id as string,
          user.id,
          visibilityValue as 'private' | 'shared' | 'public',
          showAuthorName
        );
        
        if (!success) {
          logger.error('[SidebarAnnotationEnhancer] updateAnnotationSharing failed');
          this.showFeedback(doc, '❌ 操作失败', false);
          return;
        }
        
        logger.log(`[SidebarAnnotationEnhancer] ✅ Annotation ${annotationItem.key} shared as ${shareMode}`);
        this.showFeedback(doc, `✅ 已设为${this.getModeName(shareMode)}`, true);
        
        // Step 9: 如果是public/anonymous,关联到当前session
        if (visibilityValue === 'public' && fullAnnotation.supabaseId) {
          await this.addAnnotationToCurrentSession(annotationItem);
        }
      }
      
    } catch (error) {
      logger.error('[SidebarAnnotationEnhancer] ❌ Error updating annotation:', {
        error: String(error),
        message: (error as Error)?.message,
        stack: (error as Error)?.stack,
        annotationKey: annotationItem?.key,
        shareMode,
      });
      const errorMsg = (error as Error)?.message || String(error) || '未知错误';
      this.showFeedback(doc, `❌ 操作失败: ${errorMsg}`, false);
    }
  }

  /**
   * 将annotation添加到当前reading session (如果存在)
   * @param annotationItem Annotation item
   */
  private async addAnnotationToCurrentSession(annotationItem: any): Promise<void> {
    try {
      const readingSessionManager = (this.annotationManager as any).readingSessionManager;
      if (!readingSessionManager) return;
      
      const currentSession = readingSessionManager.getCurrentSession();
      if (!currentSession?.id) {
        logger.log('[SidebarAnnotationEnhancer] No current session, skipping association');
        return;
      }
      
      // 获取annotation的supabaseId
      const pdfAttachment = annotationItem.parentItem;
      if (!pdfAttachment) return;
      
      let paperItem = pdfAttachment.parentItem;
      if (!paperItem && pdfAttachment.parentItemID) {
        paperItem = (Zotero as any).Items.get(pdfAttachment.parentItemID);
      }
      if (!paperItem) return;
      
      const doi = paperItem.getField?.('DOI');
      if (!doi) return;
      
      // 查询annotation
      const documentId = this.cache.getDocumentId(doi);
      if (!documentId) return;
      
      const { APIClient } = await import('../../utils/apiClient');
      const apiClient = APIClient.getInstance();
      const params = new URLSearchParams();
      params.append('document_id', documentId);
      params.append('type', 'my');
      
      const response = await apiClient.get<{ success: boolean; data: any[] }>(
        '/api/proxy/annotations',
        params
      );
      
      const annotation = response.success && response.data
        ? response.data.find((ann: any) => ann.original_id === annotationItem.key)
        : null;
      
      if (annotation?.id) {
        await readingSessionManager.addAnnotationToSession(currentSession.id, annotation.id);
        logger.log(`[SidebarAnnotationEnhancer] ✅ Added annotation to session: ${currentSession.id}`);
      }
    } catch (error) {
      logger.error('[SidebarAnnotationEnhancer] ❌ Error adding to session:', error);
      // 静默失败,不影响主流程
    }
  }

  /**
   * 显示临时反馈消息
   * @param doc Document对象
   * @param message 消息内容
   * @param isSuccess 是否成功
   */
  private showFeedback(doc: Document, message: string, isSuccess: boolean): void {
    try {
      const feedback = doc.createElement('div');
      feedback.textContent = message;
      feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${isSuccess ? '#4CAF50' : '#F44336'};
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      `;
      
      doc.body.appendChild(feedback);
      
      setTimeout(() => {
        feedback.remove();
      }, 3000);
    } catch (error) {
      logger.error('[SidebarAnnotationEnhancer] ❌ Error showing feedback:', error);
    }
  }

  /**
   * 获取模式名称 (用于反馈消息)
   * @param mode 共享模式
   * @returns 模式名称
   */
  private getModeName(mode: ShareMode): string {
    const modeConfig = this.shareModes.find(m => m.id === mode);
    return modeConfig?.label || '未知';
  }

  /**
   * 🆕 创建共享信息容器 (与annotation-popup researchopia-shared-info完全相同)
   * @param doc Document对象
   * @returns 共享信息容器元素
   */
  private createSharedInfoContainer(doc: Document): HTMLElement {
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

    return sharedInfoContainer;
  }

  /**
   * 🆕 加载并渲染共享信息 (异步) - 完全复用annotation-popup逻辑
   * @param annotationKey Annotation key
   * @param container 共享信息容器
   * @param doc Document对象
   * @param reader Reader实例
   * @param forceRefresh 强制刷新缓存 (默认 false)
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
      const libraryID = reader._item?.libraryID || reader.itemID?.libraryID || 1;
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

      // Step 3: 获取document ID (使用共享缓存)
      let documentId: string | undefined = this.cache.getDocumentId(doi);
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
          this.cache.setPaperId(doi, document.paper_id as string);
        }
      }

      // Step 4: 查询标注详情
      const { APIClient } = await import('../../utils/apiClient');
      const apiClient = APIClient.getInstance();
      const params = new URLSearchParams();
      params.append('document_id', documentId);
      params.append('type', 'my');

      const response = await apiClient.get<{ success: boolean; data: any[] }>(
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

      // Step 5: 检查缓存 (使用共享缓存)
      let likes: any[] = [];
      let comments: any[] = [];

      // 如果强制刷新,先清除缓存
      if (forceRefresh) {
        logger.log(`[SidebarAnnotationEnhancer] 🔄 Force refresh: invalidating cache for ${annotation.id}`);
        this.cache.invalidateSharedInfo(annotation.id);
      }

      const cached = this.cache.getSharedInfo(annotation.id);
      if (cached && !forceRefresh) {
        logger.log('[SidebarAnnotationEnhancer] Using cached shared info');
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

          logger.log('[SidebarAnnotationEnhancer] 📝 Comments data:', JSON.stringify(comments?.slice(0, 1), null, 2));

          // 存入共享缓存
          this.cache.setSharedInfo(annotation.id, likes || [], comments || []);
        }
      }

      // Step 6: 清空 "加载中..." 占位符
      container.innerHTML = '';

      // Step 7: 批量检查用户点赞状态
      const currentUser = AuthManager.getCurrentUser();
      const currentUserId = currentUser?.id || '';
      const userLikesMap = await (this.annotationManager as any).supabaseManager.batchCheckUserLikes([annotation.id], currentUserId);
      const userLiked = userLikesMap.get(annotation.id) || false;

      // Step 8: 渲染交互式 social-actions 按钮区域 (参考 sidebarSharedView.ts:968-1017)
      const actionsDiv = doc.createElement("div");
      actionsDiv.className = "social-actions";
      actionsDiv.style.cssText = "display: flex; gap: 12px; align-items: center; padding: 8px 0;";

      // 点赞按钮 (参考 sidebarSharedView.ts:978-1000)
      const likeButton = doc.createElement("button");
      likeButton.setAttribute("data-like-button", "true");
      likeButton.innerHTML = `${userLiked ? "❤️" : "🤍"} ${annotation.likes_count || 0}`;
      likeButton.style.cssText = `
        padding: 3px 8px;
        background: transparent;
        color: ${userLiked ? "#dc3545" : "#6c757d"};
        border: 1px solid ${userLiked ? "#dc3545" : "#e9ecef"};
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
        transition: all 0.2s;
      `;

      likeButton.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.handleLikeAnnotation(annotation.id, currentUserId, container);
      });

      // 评论按钮 (参考 sidebarSharedView.ts:1002-1017)
      const commentButton = doc.createElement("button");
      commentButton.setAttribute("data-comment-button", "true");
      commentButton.innerHTML = `💬 ${annotation.comments_count || 0}`;
      commentButton.style.cssText = `
        padding: 3px 8px;
        background: transparent;
        color: #6c757d;
        border: 1px solid #e9ecef;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
        transition: all 0.2s;
      `;

      commentButton.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.showCommentsSection(container, annotation.id, currentUserId);
      });

      actionsDiv.appendChild(likeButton);
      actionsDiv.appendChild(commentButton);
      container.appendChild(actionsDiv);

      logger.log('[SidebarAnnotationEnhancer] ✅ Shared info loaded');
    } catch (error) {
      logger.error('[SidebarAnnotationEnhancer] ❌ Error loading shared info:', error);
      container.innerHTML = '<div style="color: #999; font-style: italic;">加载失败</div>';
    }
  }

  /**
   * 🆕 在Sidebar容器顶部插入批量操作工具栏
   * 
   * ⭐ 设计模式: 仿Jasminum插件 (参考 docs/docs-dev/1.4.11-JASMINUM_SIDEBAR_TAB_DESIGN.md)
   * 
   * DOM结构 (Zotero官方 + Jasminum模式):
   * <div id="sidebarContainer">
   *   <div class="sidebar-toolbar">...</div>
   *   [批量操作工具栏插入位置] ← ⭐ 与#sidebarContent平级,生命周期独立
   *   <div id="sidebarContent">
   *     <div id="annotationsView">
   *       <div id="annotations">...</div>
   *       <Selector>...</Selector> (Zotero原生筛选器)
   *     </div>
   *   </div>
   * </div>
   * 
   * @param doc Document对象
   * @param reader Reader实例
   * @param readerInstanceId Reader实例ID (用于清除标志)
   */
  private async injectBatchToolbar(doc: Document, reader: any, readerInstanceId: string): Promise<void> {
    try {
      logger.log('[SidebarAnnotationEnhancer] 🚀 Starting injectBatchToolbar...');
      
      // Step 1: 等待#sidebarContainer加载 (最多3秒)
      let sidebarContainer: HTMLElement | null = null;
      let sidebarContent: HTMLElement | null = null;
      let attempts = 0;
      const maxAttempts = 30; // 3秒 (30次 * 100ms)
      
      logger.log('[SidebarAnnotationEnhancer] 🔍 Searching for #sidebarContainer and #sidebarContent...');
      
      while (attempts < maxAttempts) {
        sidebarContainer = doc.getElementById('sidebarContainer') as HTMLElement;
        sidebarContent = doc.getElementById('sidebarContent') as HTMLElement;
        
        if (sidebarContainer && sidebarContent) {
          logger.log(`[SidebarAnnotationEnhancer] ✅ Found #sidebarContainer (attempts: ${attempts + 1})`);
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!sidebarContainer || !sidebarContent) {
        logger.error('[SidebarAnnotationEnhancer] ❌ Cannot find #sidebarContainer after 3s');
        return;
      }
      
      logger.log('[SidebarAnnotationEnhancer] ✅ Step 1 complete: Found #sidebarContainer');
      
      // Step 2: 检查是否已插入 (避免重复)
      if (doc.getElementById('researchopia-batch-toolbar')) {
        logger.log('[SidebarAnnotationEnhancer] ⚠️ Batch toolbar already exists, skipping');
        return;
      }
      logger.log('[SidebarAnnotationEnhancer] ✅ Step 2 complete: No existing toolbar');
      
      // Step 2.5: 注入CSS样式 (支持.hidden类)
      logger.log('[SidebarAnnotationEnhancer] 🎨 Injecting CSS...');
      if (!doc.getElementById('researchopia-batch-toolbar-css')) {
        const style = doc.createElement('style');
        style.id = 'researchopia-batch-toolbar-css';
        style.textContent = `
          #researchopia-batch-toolbar.hidden {
            display: none !important;
          }
        `;
        doc.head.appendChild(style);
        logger.log('[SidebarAnnotationEnhancer] ✅ CSS for batch toolbar injected');
      } else {
        logger.log('[SidebarAnnotationEnhancer] ℹ️ CSS already exists');
      }
      logger.log('[SidebarAnnotationEnhancer] ✅ Step 2.5 complete: CSS ready');
      
      // Step 3: 创建工具栏容器
      logger.log('[SidebarAnnotationEnhancer] 🛠️ Creating toolbar container...');
      const toolbar = doc.createElement('div');
      toolbar.id = 'researchopia-batch-toolbar';
      toolbar.style.cssText = `
        width: 100%;
        padding: 12px;
        box-sizing: border-box;
        background: #f9fafb;
        border-bottom: 2px solid #e5e7eb;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      `;
      
      // 添加.hidden样式支持 (tab切换时显示/隐藏)
      toolbar.classList.add('hidden'); // 默认隐藏,后续根据激活的tab决定
      logger.log('[SidebarAnnotationEnhancer] ✅ Toolbar container created with .hidden class');
      
      // 创建全选复选框
      logger.log('[SidebarAnnotationEnhancer] 📦 Creating toolbar elements...');
      const selectAllCheckbox = doc.createElement('input');
      selectAllCheckbox.type = 'checkbox';
      selectAllCheckbox.id = 'researchopia-select-all';
      selectAllCheckbox.title = '全选/取消全选'; // hover提示
      selectAllCheckbox.style.cssText = `
        width: 18px;
        height: 18px;
        cursor: pointer;
      `;
      
      selectAllCheckbox.addEventListener('change', () => {
        const checkboxes = doc.querySelectorAll<HTMLInputElement>('.researchopia-annotation-checkbox');
        checkboxes.forEach(cb => {
          cb.checked = selectAllCheckbox.checked;
        });
      });
      
      // 分隔符 (用于视觉分隔checkbox和批量操作按钮)
      const separator = doc.createElement('div');
      separator.textContent = '|';
      separator.style.cssText = 'color: #d1d5db; font-size: 14px; margin: 0 8px;';
      
      // 添加到工具栏
      toolbar.appendChild(selectAllCheckbox);
      toolbar.appendChild(separator);
      
      // 4个批量操作按钮 (只显示emoji，hover显示完整说明)
      const batchButtons = [
        { id: 'batch-public', text: '🌐', title: '批量设为公开分享', mode: 'public' as ShareMode, color: '#2196F3' },
        { id: 'batch-anonymous', text: '🎭', title: '批量设为匿名分享', mode: 'anonymous' as ShareMode, color: '#FF9800' },
        { id: 'batch-private', text: '🔒', title: '批量设为私密分享', mode: 'private' as ShareMode, color: '#9E9E9E' },
        { id: 'batch-unshare', text: '🗑️', title: '批量取消分享', mode: null as ShareMode, color: '#ef4444' }
      ];
      
      batchButtons.forEach(btn => {
        const button = doc.createElement('button');
        button.id = btn.id;
        button.textContent = btn.text;
        button.title = btn.title; // hover提示
        button.style.cssText = `
          width: 28px;
          height: 28px;
          background: #ffffff;
          color: ${btn.color};
          border: 2px solid ${btn.color};
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        `;
        
        button.addEventListener('mouseenter', () => {
          button.style.background = btn.color;
          button.style.color = '#ffffff';
        });
        button.addEventListener('mouseleave', () => {
          button.style.background = '#ffffff';
          button.style.color = btn.color;
        });
        
        button.addEventListener('click', async () => {
          await this.handleBatchOperation(doc, reader, btn.mode);
        });
        
        toolbar.appendChild(button);
      });
      logger.log('[SidebarAnnotationEnhancer] ✅ Step 3 complete: All elements appended to toolbar');
      
      // ⭐ Step 4: 插入到#sidebarContainer下,#sidebarContent之前 (仿Jasminum模式)
      logger.log('[SidebarAnnotationEnhancer] 🚀 Injecting toolbar into DOM...');
      sidebarContainer.insertBefore(toolbar, sidebarContent);
      logger.log('[SidebarAnnotationEnhancer] ✅ Step 4 complete: Batch toolbar injected between #sidebarContainer and #sidebarContent');
      
      // ⭐ Step 5: 监听sidebar按钮的active类变化,切换工具栏显示/隐藏
      // 注意: 由于Firefox iframe环境MutationObserver的安全限制,使用定时轮询检查按钮状态
      logger.log('[SidebarAnnotationEnhancer] 🎧 Setting up tab button listeners...');
      const annotationsButton = doc.getElementById('viewAnnotations');
      logger.log(`[SidebarAnnotationEnhancer] Found viewAnnotations button: ${!!annotationsButton}`);
      
      if (annotationsButton) {
        // 使用定时轮询检查active状态 (每100ms检查一次)
        let lastActiveState = annotationsButton.classList.contains('active');
        const checkInterval = doc.defaultView?.setInterval(() => {
          const currentActiveState = annotationsButton.classList.contains('active');
          if (currentActiveState !== lastActiveState) {
            if (currentActiveState) {
              toolbar.classList.remove('hidden');
              logger.log('[SidebarAnnotationEnhancer] 📌 Showing batch toolbar (Annotations tab active)');
            } else {
              toolbar.classList.add('hidden');
              logger.log('[SidebarAnnotationEnhancer] 🚫 Hiding batch toolbar (switched to other tab)');
            }
            lastActiveState = currentActiveState;
          }
        }, 100); // 100ms检查一次,性能开销可忽略
        
        logger.log('[SidebarAnnotationEnhancer] ✅ Button state polling started (100ms interval)');
        
        // 保存interval ID以便清理 (可选)
        // this.buttonCheckIntervals.set(readerInstanceId, checkInterval);
      } else {
        logger.warn('[SidebarAnnotationEnhancer] ⚠️ viewAnnotations button not found');
      }
      
      // ⭐ Step 6: Sidebar open/close监听 (Toggle sidebar时)
      // 注: 由于Firefox iframe环境对MutationObserver的安全限制,暂时禁用此功能
      //     工具栏会随#sidebarContainer (left: -240px) 自动移出视图,不影响使用
      logger.log('[SidebarAnnotationEnhancer] ⚠️ Sidebar MutationObserver disabled (Firefox security restrictions)');
      
      // ⭐ Step 7: 初始状态 - 检查当前激活的tab,决定工具栏显示/隐藏
      // 注意: annotationsButton已在Step 5中定义,这里直接使用
      if (annotationsButton && annotationsButton.classList.contains('active')) {
        toolbar.classList.remove('hidden');
        logger.log('[SidebarAnnotationEnhancer] 📌 Batch toolbar visible (Annotations tab is active)');
      } else {
        toolbar.classList.add('hidden');
        logger.log('[SidebarAnnotationEnhancer] 🚫 Batch toolbar hidden (Annotations tab is not active)');
      }
      
      logger.log('[SidebarAnnotationEnhancer] ✅✅✅ Batch toolbar setup complete! ✅✅✅');
      
    } catch (error) {
      logger.error('[SidebarAnnotationEnhancer] ❌❌❌ Error injecting batch toolbar:', error);
      logger.error('[SidebarAnnotationEnhancer] Error details:', JSON.stringify(error));
      if (error instanceof Error) {
        logger.error('[SidebarAnnotationEnhancer] Error message:', error.message);
        logger.error('[SidebarAnnotationEnhancer] Error stack:', error.stack);
      }
    }
  }

  /**
   * 🆕 处理批量操作
   * @param doc Document对象
   * @param reader Reader实例
   * @param shareMode 共享模式
   */
  private async handleBatchOperation(doc: Document, reader: any, shareMode: ShareMode): Promise<void> {
    try {
      // Step 1: 获取所有选中的annotation checkboxes
      const selectedCheckboxes = doc.querySelectorAll<HTMLInputElement>('.researchopia-annotation-checkbox:checked');
      
      if (selectedCheckboxes.length === 0) {
        this.showFeedback(doc, '⚠️ 请先选择要操作的标注', false);
        return;
      }
      
      logger.log(`[SidebarAnnotationEnhancer] 🎯 Batch operation: ${shareMode}, selected: ${selectedCheckboxes.length}`);
      
      // Step 2: 获取selected annotation keys
      const annotationKeys: string[] = [];
      selectedCheckboxes.forEach(cb => {
        const annotationKey = cb.getAttribute('data-annotation-key');
        if (annotationKey) {
          annotationKeys.push(annotationKey);
        }
      });
      
      if (annotationKeys.length === 0) {
        this.showFeedback(doc, '❌ 未找到选中的标注', false);
        return;
      }
      
      // Step 3: 批量更新 (复用updateAnnotationSharing逻辑)
      const libraryID = reader._item?.libraryID || reader.itemID?.libraryID || 1;
      const results = await Promise.all(
        annotationKeys.map(async (key) => {
          try {
            const annotationItem = (Zotero as any).Items.getByLibraryAndKey(libraryID, key);
            if (!annotationItem) {
              logger.error(`[SidebarAnnotationEnhancer] ❌ Cannot find annotation: ${key}`);
              return false;
            }
            
            // 调用单个标注的更新逻辑
            await this.updateAnnotationSharing(annotationItem, shareMode, doc, reader);
            return true;
          } catch (error) {
            logger.error(`[SidebarAnnotationEnhancer] ❌ Failed to update annotation ${key}:`, error);
            return false;
          }
        })
      );
      
      const successCount = results.filter(Boolean).length;
      const failCount = results.length - successCount;
      
      if (failCount === 0) {
        this.showFeedback(doc, `✅ 批量操作完成 (${successCount}/${results.length})`, true);
      } else {
        this.showFeedback(doc, `⚠️ 部分失败 (成功${successCount}, 失败${failCount})`, false);
      }
      
      // Step 4: 取消全选
      const selectAllCheckbox = doc.getElementById('researchopia-select-all') as HTMLInputElement;
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
      }
      selectedCheckboxes.forEach(cb => {
        cb.checked = false;
      });
      
    } catch (error) {
      logger.error('[SidebarAnnotationEnhancer] ❌ Error in batch operation:', error);
      this.showFeedback(doc, '❌ 批量操作失败', false);
    }
  }

  /**
   * 处理点赞标注 (完全参考 sidebarSharedView.ts:1115-1163)
   */
  private async handleLikeAnnotation(
    annotationId: string,
    userId: string,
    containerElement?: HTMLElement
  ): Promise<void> {
    if (!containerElement) return;
    
    const likeButton = containerElement.querySelector(
      "button[data-like-button]"
    ) as HTMLButtonElement | null;
    
    if (!likeButton) return;
    
    // 防止并发点击
    if (likeButton.disabled) return;
    
    try {
      // 禁用按钮,显示加载状态
      likeButton.disabled = true;
      const currentCount = parseInt(likeButton.textContent?.match(/\d+/)?.[0] || "0", 10);
      likeButton.innerHTML = `<span style="opacity: 0.5;">...</span>`;
      
      // 执行点赞/取消点赞操作
      const isNowLiked = await (this.annotationManager as any).supabaseManager.likeAnnotation(annotationId, userId);
      
      // 直接根据操作结果计算新的点赞数 (不依赖数据库查询,避免 trigger 延迟/历史数据问题)
      const newCount = isNowLiked ? currentCount + 1 : currentCount - 1;
      
      // 更新UI
      if (isNowLiked) {
        likeButton.innerHTML = `❤️ ${newCount}`;
        likeButton.style.color = "#dc3545";
        likeButton.style.borderColor = "#dc3545";
      } else {
        likeButton.innerHTML = `🤍 ${newCount}`;
        likeButton.style.color = "#6c757d";
        likeButton.style.borderColor = "#e9ecef";
      }
    } catch (error) {
      logger.error("[SidebarAnnotationEnhancer] Error liking annotation:", error);
    } finally {
      // 恢复按钮可用状态
      if (likeButton) {
        likeButton.disabled = false;
      }
    }
  }

  /**
   * 显示评论区域 (完全参考 sidebarSharedView.ts:1170-1310)
   */
  private async showCommentsSection(
    containerElement: HTMLElement,
    annotationId: string,
    currentUserId: string
  ): Promise<void> {
    const doc = containerElement.ownerDocument;

    let commentsSection = containerElement.querySelector(".comments-section") as HTMLElement | null;

    // 切换显示/隐藏
    if (commentsSection) {
      commentsSection.style.display = commentsSection.style.display === "none" ? "flex" : "none";
      return;
    }

    commentsSection = doc.createElement("div");
    commentsSection.className = "comments-section";
    commentsSection.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 12px;
      border-top: 1px solid #e9ecef;
    `;

    try {
      const commentTree = await (this.annotationManager as any).supabaseManager.getAnnotationCommentTree(annotationId);

      if (commentTree.length > 0) {
        const commentsList = doc.createElement("div");
        commentsList.className = "comments-tree";
        commentsList.style.cssText = "display: flex; flex-direction: column; gap: 4px;";

        commentTree.forEach((rootComment: any) => {
          const commentNode = this.renderCommentNode(
            rootComment,
            0,
            doc,
            currentUserId,
            annotationId,
            containerElement
          );
          commentsList.appendChild(commentNode);
        });

        commentsSection.appendChild(commentsList);
      }

      // 创建输入区域容器
      const inputAreaContainer = doc.createElement("div");
      inputAreaContainer.style.cssText = "display: flex; flex-direction: column; gap: 8px;";

      const textarea = doc.createElement("textarea");
      textarea.placeholder = "添加评论...";
      textarea.style.cssText = `
        width: 100%;
        padding: 6px 10px;
        border: 1px solid #e9ecef;
        border-radius: 3px;
        font-size: 12px;
        font-family: inherit;
        resize: vertical;
        min-height: 60px;
        background: #ffffff;
        color: #212529;
        box-sizing: border-box;
      `;

      // 匿名开关容器
      const anonymousContainer = doc.createElement("div");
      anonymousContainer.style.cssText = "display: flex; align-items: center; gap: 8px;";

      const anonymousSwitch = createToggleSwitch(
        doc,
        `anonymous-comment-${annotationId}`,
        false,
        "#8b5cf6"
      );

      const anonymousLabel = doc.createElement("label");
      anonymousLabel.htmlFor = `anonymous-comment-${annotationId}`;
      anonymousLabel.textContent = "匿名显示";
      anonymousLabel.style.cssText = "font-size: 11px; color: #6c757d; cursor: pointer; user-select: none;";

      anonymousContainer.appendChild(anonymousSwitch);
      anonymousContainer.appendChild(anonymousLabel);

      // 按钮容器
      const buttonContainer = doc.createElement("div");
      buttonContainer.style.cssText = "display: flex; justify-content: flex-end;";

      const submitButton = doc.createElement("button");
      submitButton.textContent = "发送";
      submitButton.style.cssText = `
        padding: 6px 12px;
        background: #0d6efd;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
      `;

      submitButton.addEventListener("click", async () => {
        const content = textarea.value.trim();
        if (!content) return;

        try {
          const switchCheckbox = anonymousSwitch.querySelector('input[type="checkbox"]') as HTMLInputElement;
          const isAnonymous = switchCheckbox ? switchCheckbox.checked : false;

          await (this.annotationManager as any).supabaseManager.addComment(annotationId, currentUserId, content, null, isAnonymous);
          textarea.value = "";

          // 重新加载评论
          containerElement.removeChild(commentsSection!);
          await this.showCommentsSection(containerElement, annotationId, currentUserId);

          // 更新评论计数
          const commentButton = containerElement.querySelector("button[data-comment-button]") as HTMLButtonElement;
          if (commentButton) {
            const currentCount = parseInt(commentButton.textContent?.match(/\d+/)?.[0] || "0", 10);
            commentButton.innerHTML = `💬 ${currentCount + 1}`;
          }
        } catch (error) {
          logger.error("[SidebarAnnotationEnhancer] Error adding comment:", error);
        }
      });

      buttonContainer.appendChild(submitButton);

      inputAreaContainer.appendChild(textarea);
      inputAreaContainer.appendChild(anonymousContainer);
      inputAreaContainer.appendChild(buttonContainer);

      commentsSection.appendChild(inputAreaContainer);
      containerElement.appendChild(commentsSection);

    } catch (error) {
      logger.error("[SidebarAnnotationEnhancer] Error loading comments:", error);
    }
  }

  /**
   * 渲染评论节点 (完全复用 sidebarSharedView.ts:1312-1491 的样式和逻辑)
   */
  private renderCommentNode(
    comment: any,
    depth: number,
    doc: Document,
    currentUserId: string,
    annotationId: string,
    containerElement: HTMLElement
  ): HTMLElement {
    const container = doc.createElement("div");
    container.className = "comment-node";
    container.setAttribute("data-comment-id", comment.id);
    container.setAttribute("data-depth", depth.toString());
    container.style.cssText = `
      margin-left: ${depth * 20}px;
      ${depth > 0 ? "border-left: 2px solid #e9ecef; padding-left: 8px;" : ""}
      margin-bottom: ${depth > 0 ? "4px" : "8px"};
    `;

    const commentBody = doc.createElement("div");
    commentBody.className = "comment-body";
    commentBody.style.cssText = `
      padding: 8px;
      background: #f8f9fa;
      border-radius: 3px;
      font-size: 12px;
    `;

    // 评论头部 - 用户信息和时间
    const header = doc.createElement("div");
    header.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 4px;";

    const userInfo = doc.createElement("div");
    userInfo.style.cssText =
      "color: #6c757d; display: flex; gap: 6px; align-items: center; font-size: 11px;";

    const { name: userName, isAnonymous } = resolveCommentDisplayInfo(comment);
    const username = comment.user?.username || comment.username || '';
    const replyCount = comment.reply_count || comment.children?.length || 0;

    const userElement = this.userHoverCardManager.createUserElement(
      doc,
      username,
      userName,
      { isAnonymous, clickable: !isAnonymous }
    );
    userInfo.appendChild(userElement);

    if (isAnonymous) {
      const lockIcon = doc.createElement("span");
      lockIcon.style.cssText = "color: #ced4da; font-size: 10px;";
      lockIcon.textContent = "🔒";
      userInfo.appendChild(lockIcon);
    }

    const sep1 = doc.createElement("span");
    sep1.style.color = "#ced4da";
    sep1.textContent = "·";
    userInfo.appendChild(sep1);

    const timeSpan = doc.createElement("span");
    timeSpan.textContent = formatDate(comment.created_at);
    userInfo.appendChild(timeSpan);

    if (replyCount > 0) {
      const sep2 = doc.createElement("span");
      sep2.style.color = "#0d6efd";
      sep2.textContent = "·";
      userInfo.appendChild(sep2);

      const replySpan = doc.createElement("span");
      replySpan.style.color = "#0d6efd";
      replySpan.textContent = ` ${replyCount} 回复`;
      userInfo.appendChild(replySpan);
    }

    header.appendChild(userInfo);

    // 操作按钮
    const actions = doc.createElement("div");
    actions.style.cssText = "display: flex; gap: 6px; flex-wrap: wrap;";

    const replyBtn = doc.createElement("button");
    replyBtn.textContent = "💬 回复";
    replyBtn.style.cssText = `
      padding: 2px 8px;
      background: transparent;
      color: #0d6efd;
      border: 1px solid currentColor;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `;
    replyBtn.addEventListener("click", () => {
      this.toggleReplyBox(container, comment, annotationId, currentUserId, containerElement);
    });
    actions.appendChild(replyBtn);

    const isOwnComment = comment.user_id === currentUserId;
    const currentUser = AuthManager.getCurrentUser();
    const isAdmin = currentUser?.role === "admin";
    const canDelete = isOwnComment || isAdmin;

    if (isOwnComment) {
      const editBtn = doc.createElement("button");
      editBtn.textContent = "编辑";
      editBtn.style.cssText = `
        padding: 2px 8px;
        background: transparent;
        color: #6c757d;
        border: 1px solid currentColor;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
      `;
      editBtn.addEventListener("click", () => {
        this.toggleEditMode(commentBody, comment, containerElement, annotationId, currentUserId);
      });
      actions.appendChild(editBtn);
    }

    if (canDelete) {
      const deleteBtn = doc.createElement("button");
      deleteBtn.textContent = "删除";
      deleteBtn.style.cssText = `
        padding: 2px 8px;
        background: transparent;
        color: #dc3545;
        border: 1px solid currentColor;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
      `;
      deleteBtn.addEventListener("click", async () => {
        const message = replyCount > 0
          ? `此评论有 ${replyCount} 条回复,删除后回复也会被删除。确定继续？`
          : "确定删除这条评论吗？";

        if (ServicesAdapter.confirm("删除评论", message)) {
          await this.handleDeleteComment(comment.id, replyCount, annotationId, currentUserId, containerElement);
        }
      });
      actions.appendChild(deleteBtn);
    }

    header.appendChild(actions);
    commentBody.appendChild(header);

    // 评论内容
    const contentDiv = doc.createElement("div");
    contentDiv.className = "comment-content";
    contentDiv.style.cssText = "color: #212529; word-wrap: break-word;";
    contentDiv.textContent = comment.content;
    commentBody.appendChild(contentDiv);

    container.appendChild(commentBody);

    // 回复框容器(初始隐藏)
    const replyBoxContainer = doc.createElement("div");
    replyBoxContainer.className = "reply-box-container";
    replyBoxContainer.style.display = "none";
    container.appendChild(replyBoxContainer);

    // 递归渲染子评论
    if (comment.children && comment.children.length > 0) {
      comment.children.forEach((child: any) => {
        const childNode = this.renderCommentNode(
          child,
          depth + 1,
          doc,
          currentUserId,
          annotationId,
          containerElement
        );
        container.appendChild(childNode);
      });
    }

    return container;
  }

  /**
   * 切换回复框 (完全参考 sidebarSharedView.ts:1495-1621)
   */
  private toggleReplyBox(
    container: HTMLElement,
    parentComment: any,
    annotationId: string,
    currentUserId: string,
    cardElement: HTMLElement
  ): void {
    const doc = container.ownerDocument;
    const replyBoxContainer = container.querySelector(".reply-box-container") as HTMLElement | null;

    if (!replyBoxContainer) return;

    // 切换显示/隐藏
    if (replyBoxContainer.style.display === "flex") {
      replyBoxContainer.style.display = "none";
      return;
    }

    // 清空并重新创建回复框
    replyBoxContainer.innerHTML = "";
    replyBoxContainer.style.display = "flex";
    replyBoxContainer.style.flexDirection = "column";
    replyBoxContainer.style.gap = "8px";

    // 获取父评论作者
    const { name: parentDisplayName } = resolveCommentDisplayInfo(parentComment);

    const textarea = doc.createElement("textarea");
    textarea.placeholder = `回复 @${parentDisplayName}...`;
    textarea.style.cssText = `
      width: 100%;
      padding: 6px 10px;
      border: 1px solid #e9ecef;
      border-radius: 3px;
      font-size: 11px;
      font-family: inherit;
      resize: vertical;
      min-height: 50px;
      box-sizing: border-box;
    `;

    // 匿名开关
    const anonymousContainer = doc.createElement("div");
    anonymousContainer.style.cssText = "display: flex; align-items: center; gap: 8px;";

    const anonymousSwitch = createToggleSwitch(
      doc,
      `anonymous-reply-${parentComment.id}`,
      false,
      "#8b5cf6"
    );

    const anonymousLabel = doc.createElement("label");
    anonymousLabel.htmlFor = `anonymous-reply-${parentComment.id}`;
    anonymousLabel.textContent = "匿名显示";
    anonymousLabel.style.cssText = "font-size: 10px; color: #6c757d; cursor: pointer;";

    anonymousContainer.appendChild(anonymousSwitch);
    anonymousContainer.appendChild(anonymousLabel);

    // 按钮容器
    const buttonContainer = doc.createElement("div");
    buttonContainer.style.cssText = "display: flex; gap: 8px; justify-content: flex-end;";

    const sendButton = doc.createElement("button");
    sendButton.textContent = "发送";
    sendButton.style.cssText = `
      padding: 4px 10px;
      background: #0d6efd;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `;

    const cancelButton = doc.createElement("button");
    cancelButton.textContent = "取消";
    cancelButton.style.cssText = `
      padding: 4px 10px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `;

    sendButton.addEventListener("click", async () => {
      const content = textarea.value.trim();
      if (!content) return;

      try {
        const switchCheckbox = anonymousSwitch.querySelector('input[type="checkbox"]') as HTMLInputElement;
        const isAnonymous = switchCheckbox ? switchCheckbox.checked : false;

        await (this.annotationManager as any).supabaseManager.replyToAnnotationComment(
          annotationId,
          parentComment.id,
          currentUserId,
          content,
          isAnonymous
        );

        // 重新加载评论区
        const commentsSection = cardElement.querySelector(".comments-section") as HTMLElement;
        if (commentsSection) {
          cardElement.removeChild(commentsSection);
        }
        await this.showCommentsSection(cardElement, annotationId, currentUserId);

        // 更新评论计数
        const commentButton = cardElement.querySelector("button[data-comment-button]") as HTMLButtonElement;
        if (commentButton) {
          const currentCount = parseInt(commentButton.textContent?.match(/\d+/)?.[0] || "0", 10);
          commentButton.innerHTML = `💬 ${currentCount + 1}`;
        }
      } catch (error) {
        logger.error("[SidebarAnnotationEnhancer] Error replying to comment:", error);
      }
    });

    cancelButton.addEventListener("click", () => {
      replyBoxContainer.style.display = "none";
    });

    buttonContainer.appendChild(sendButton);
    buttonContainer.appendChild(cancelButton);

    replyBoxContainer.appendChild(textarea);
    replyBoxContainer.appendChild(anonymousContainer);
    replyBoxContainer.appendChild(buttonContainer);
  }

  /**
   * 切换编辑模式 (完全参考 sidebarSharedView.ts:1619-1736)
   */
  private toggleEditMode(
    bodyEl: HTMLElement,
    comment: any,
    cardElement: HTMLElement,
    annotationId: string,
    currentUserId: string
  ): void {
    const doc = bodyEl.ownerDocument;
    const contentDiv = bodyEl.querySelector(".comment-content") as HTMLElement | null;
    if (!contentDiv) return;

    // 如果已经在编辑模式,取消
    const existingTextarea = bodyEl.querySelector("textarea");
    if (existingTextarea) {
      contentDiv.style.display = "block";
      existingTextarea.parentElement?.remove();
      return;
    }

    // 隐藏原内容
    contentDiv.style.display = "none";

    // 创建编辑容器
    const editContainer = doc.createElement("div");
    editContainer.style.cssText = "display: flex; flex-direction: column; gap: 6px; margin-top: 4px;";

    const textarea = doc.createElement("textarea");
    textarea.value = comment.content;
    textarea.style.cssText = `
      width: 100%;
      padding: 6px 10px;
      border: 1px solid #e9ecef;
      border-radius: 3px;
      font-size: 11px;
      font-family: inherit;
      resize: vertical;
      min-height: 50px;
      box-sizing: border-box;
    `;

    // 匿名开关容器
    const anonymousContainer = doc.createElement("div");
    anonymousContainer.style.cssText = "display: flex; align-items: center; gap: 8px; margin-top: 6px;";

    // 获取当前评论的匿名状态 (从 show_author_name 推断)
    const currentIsAnonymous = comment.show_author_name === false;

    const anonymousSwitch = createToggleSwitch(
      doc,
      `anonymous-edit-${comment.id}`,
      currentIsAnonymous,
      "#8b5cf6"
    );

    const anonymousLabel = doc.createElement("label");
    anonymousLabel.htmlFor = `anonymous-edit-${comment.id}`;
    anonymousLabel.textContent = "匿名显示";
    anonymousLabel.style.cssText = "font-size: 10px; color: #6c757d; cursor: pointer;";

    anonymousContainer.appendChild(anonymousSwitch);
    anonymousContainer.appendChild(anonymousLabel);

    const buttonContainer = doc.createElement("div");
    buttonContainer.style.cssText = "display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px;";

    const saveButton = doc.createElement("button");
    saveButton.textContent = "保存";
    saveButton.style.cssText = `
      padding: 4px 10px;
      background: #0d6efd;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `;

    const cancelButton = doc.createElement("button");
    cancelButton.textContent = "取消";
    cancelButton.style.cssText = `
      padding: 4px 10px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `;

    saveButton.addEventListener("click", async () => {
      const newContent = textarea.value.trim();
      if (!newContent) return;

      try {
        const switchCheckbox = anonymousSwitch.querySelector('input[type="checkbox"]') as HTMLInputElement;
        const isAnonymous = switchCheckbox ? switchCheckbox.checked : false;

        await (this.annotationManager as any).supabaseManager.updateComment(comment.id, newContent, isAnonymous);

        // 重新加载评论区以反映匿名状态变化
        const commentsSection = cardElement.querySelector(".comments-section") as HTMLElement;
        if (commentsSection) {
          cardElement.removeChild(commentsSection);
        }
        
        await this.showCommentsSection(cardElement, annotationId, currentUserId);
      } catch (error) {
        logger.error("[SidebarAnnotationEnhancer] Error updating comment:", error);
      }
    });

    cancelButton.addEventListener("click", () => {
      contentDiv.style.display = "block";
      editContainer.remove();
    });

    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(cancelButton);

    editContainer.appendChild(textarea);
    editContainer.appendChild(anonymousContainer);
    editContainer.appendChild(buttonContainer);

    contentDiv.parentElement?.insertBefore(editContainer, contentDiv.nextSibling);
  }

  /**
   * 处理删除评论 (完全参考 sidebarSharedView.ts:1738-1788)
   */
  private async handleDeleteComment(
    commentId: string,
    childrenCount: number,
    annotationId: string,
    currentUserId: string,
    containerElement: HTMLElement
  ): Promise<void> {
    // 如果有子评论,警告级联删除
    const message = childrenCount > 0
      ? `此评论有 ${childrenCount} 条回复。删除后将级联删除所有回复,确定继续?`
      : "确定删除此评论?";
    
    if (!ServicesAdapter.confirm("删除评论", message)) {
      return;
    }

    try {
      await (this.annotationManager as any).supabaseManager.deleteComment(commentId);

      // 重新加载评论区
      const commentsSection = containerElement.querySelector(".comments-section") as HTMLElement;
      if (commentsSection) {
        containerElement.removeChild(commentsSection);
      }
      await this.showCommentsSection(containerElement, annotationId, currentUserId);

      // 更新评论计数 (减去删除的评论及其子评论)
      const commentButton = containerElement.querySelector("button[data-comment-button]") as HTMLButtonElement;
      if (commentButton) {
        const currentCount = parseInt(commentButton.textContent?.match(/\d+/)?.[0] || "0", 10);
        const deletedCount = 1 + childrenCount;
        commentButton.innerHTML = `💬 ${Math.max(0, currentCount - deletedCount)}`;
      }
    } catch (error) {
      logger.error("[SidebarAnnotationEnhancer] Error deleting comment:", error);
      alert("删除失败,请稍后重试");
    }
  }
}
