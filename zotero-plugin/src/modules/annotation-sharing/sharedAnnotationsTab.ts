/**
 * Sidebar Shared Annotations View (共享标注Tab)
 * 
 * 功能: 在Zotero Reader sidebar创建"Shared Annotations"自定义tab
 * 设计文档: docs/docs-dev/1.4.12-SHARED_ANNOTATIONS_TAB_DESIGN.md
 * 参考: Jasminum插件的sidebar tab实现 (docs-dev/1.4.11)
 * 
 * @version 2.0.0 - 重构至 annotation-sharing 模块
 */

import { config } from "../../../package.json";
import { logger } from "../../utils/logger";
import { APIClient } from "../../utils/apiClient";
import { SupabaseManager } from "../supabase";
import { UserHoverCardManager } from "../ui/userHoverCard";
import { AuthManager } from "../auth";
import { formatDate, resolveCommentDisplayInfo, createToggleSwitch } from "../ui/helpers";
import { ServicesAdapter } from "../../adapters/services-adapter";
import { annotationSharingCache } from "./cache";

export class SidebarSharedView {
  private static instance: SidebarSharedView;
  // 记录已注册的reader，避免重复注册
  private registeredReaders: Set<string> = new Set();
  // Phase 2: 数据相关
  private apiClient = APIClient.getInstance();
  private supabaseManager = new SupabaseManager(); // 参考ui-manager.ts:46
  // 🚀 使用共享缓存管理器
  private cache = annotationSharingCache;
  private currentReader: any = null; // 当前reader引用
  private pdfReaderManager: any | null = null; // PDFReaderManager实例(懒加载)
  private loadingAnnotations: Set<string> = new Set(); // 正在加载的reader IDs
  private userHoverCardManager: UserHoverCardManager;
  private currentAnnotations: Map<string, any[]> = new Map(); // 存储每个reader的当前标注列表 (readerId -> annotations)
  private readerCache: Map<string, any> = new Map(); // 存储每个doc对应的reader实例 (docId -> reader)
  
  private constructor() {
    // 初始化 UserHoverCardManager (无需 context,自动创建 mock context)
    this.userHoverCardManager = new UserHoverCardManager(null as any);
  }
  
  public static getInstance(): SidebarSharedView {
    if (!SidebarSharedView.instance) {
      SidebarSharedView.instance = new SidebarSharedView();
    }
    return SidebarSharedView.instance;
  }

  /**
   * 注册Shared Annotations Tab
   */
  public register() {
    logger.log("[SidebarSharedView] Registering Shared Annotations Tab...");
    
    // 1️⃣ renderToolbar事件 - Reader首次打开时触发
    (Zotero as any).Reader.registerEventListener(
      "renderToolbar",
      async (event: any) => {
        const { reader, doc } = event;
        logger.log(`[SidebarSharedView] renderToolbar triggered for tabID: ${reader.tabID}`);
        
        try {
          await this.init(doc, reader);
        } catch (error) {
          // 降级为warn,因为初始化失败通常不会影响主要功能
          const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
          logger.warn(`[SidebarSharedView] ⚠️ Tab init skipped: ${errorMsg}`);
        }
      },
      config.addonID
    );

    // 2️⃣ renderSidebarAnnotationHeader事件 - Toggle sidebar后检测DOM重建
    (Zotero as any).Reader.registerEventListener(
      "renderSidebarAnnotationHeader",
      async (event: any) => {
        const { reader, doc } = event;
        
        // 检查自定义tab button是否丢失
        const myButton = doc.getElementById("researchopia-shared-annotations-button");
        const myView = doc.getElementById("researchopia-shared-annotations-view");
        
        // 如果DOM丢失但registeredReaders中有记录,说明Toggle sidebar导致DOM重建
        if (this.registeredReaders.has(reader.tabID) && (!myButton || !myView)) {
          logger.warn(`[SidebarSharedView] ⚠️ Tab DOM lost for reader ${reader.tabID} (Toggle detected), re-injecting...`);
          this.registeredReaders.delete(reader.tabID);
          
          // 🔥 使用重试逻辑: Toggle后div.start渲染比annotation卡片慢
          let retryCount = 0;
          const maxRetries = 10; // 最多尝试10次
          const retryDelay = 100; // 每次延迟100ms
          
          const tryReinject = async () => {
            retryCount++;
            try {
              await this.init(doc, reader);
              logger.log(`[SidebarSharedView] ✅ Tab re-injected after Toggle (attempt ${retryCount})`);
            } catch (error) {
              if (retryCount < maxRetries) {
                logger.log(`[SidebarSharedView] Re-injection attempt ${retryCount} failed, retrying in ${retryDelay}ms...`);
                setTimeout(tryReinject, retryDelay);
              } else {
                logger.error(`[SidebarSharedView] ❌ Failed to re-inject after ${maxRetries} attempts:`, error);
              }
            }
          };
          
          setTimeout(tryReinject, 100); // 首次延迟100ms
        }
      },
      config.addonID
    );

    // 检查现有Reader并注入 (用于热重载或启动时已有打开的Reader)
    this.injectIntoExistingReaders();
  }

  /**
   * 注入到现有的Readers
   */
  private async injectIntoExistingReaders() {
    try {
      logger.log("[SidebarSharedView] Checking existing readers...");
      const readers = (Zotero as any).Reader._readers || [];
      
      for (const reader of readers) {
        // 跳过已注册的reader
        if (this.registeredReaders.has(reader.tabID)) {
          logger.log(`[SidebarSharedView] Reader ${reader.tabID} already registered`);
          continue;
        }
        
        try {
          logger.log(`[SidebarSharedView] Found existing reader: ${reader.tabID}`);
          await reader._initPromise;
          
          const doc = reader._iframeWindow?.document;
          if (doc) {
            // 检查是否已经渲染了Toolbar
            if (doc.getElementById("viewAnnotations")) {
              await this.init(doc, reader);
            } else {
              logger.log(`[SidebarSharedView] Reader ${reader.tabID} toolbar not ready yet`);
            }
          } else {
            logger.warn(`[SidebarSharedView] Reader ${reader.tabID} has no document`);
          }
        } catch (e) {
          logger.error(`[SidebarSharedView] Failed to inject into existing reader ${reader.tabID}:`, e);
        }
      }
    } catch (error) {
      logger.error("[SidebarSharedView] Error checking existing readers:", error);
    }
  }

  /**
   * 初始化Tab UI
   */
  private async init(doc: Document, reader: any) {
    // 检查是否已经注册过
    if (this.registeredReaders.has(reader.tabID)) {
      logger.log(`[SidebarSharedView] Reader ${reader.tabID} already initialized, skipping...`);
      return;
    }

    logger.log(`[SidebarSharedView] Initializing for reader ${reader.tabID}...`);
    
    // 标记为已注册
    this.registeredReaders.add(reader.tabID);
    
    // 0. 等待sidebar DOM就绪
    await this.waitForSidebarReady(doc);
    
    // 1. 注入样式
    this.injectStyle(doc);

    // 2. 注入按钮
    this.injectSidebarButton(doc, reader);
    
    // 3. 注入内容容器
    this.injectSidebarContent(doc, reader);
    
    // 4. 绑定Tab切换事件
    this.bindTabEvents(doc, reader);

    // 5. 监听Sidebar重建 (修复Toggle Sidebar后消失的问题)
    this.observeSidebar(doc, reader);
    
    // 6. 启动轮询 (作为Observer的后备方案)
    this.startPolling(doc, reader);
    
    // 7. Phase 2: 保存当前reader引用
    this.currentReader = reader;
  }

  /**
   * 等待sidebar DOM就绪
   */
  private async waitForSidebarReady(doc: Document): Promise<void> {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 200; // 200次 * 50ms = 10秒超时
      
      const checkInterval = setInterval(() => {
        attempts++;
        const sidebarContainer = doc.querySelector("#sidebarContainer div.start");
        const sidebarContent = doc.getElementById("sidebarContent");
        
        if (sidebarContainer && sidebarContent) {
          clearInterval(checkInterval);
          logger.log(`[SidebarSharedView] Sidebar DOM ready after ${attempts * 50}ms`);
          resolve();
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          logger.warn(`[SidebarSharedView] Sidebar DOM wait timeout after ${maxAttempts * 50}ms`);
          resolve();
        }
      }, 50); // 每50ms检查一次
    });
  }

  /**
   * 注入样式
   */
  private injectStyle(doc: Document) {
    if (doc.getElementById("researchopia-sidebar-style")) return;
    const style = doc.createElement("style");
    style.id = "researchopia-sidebar-style";
    style.textContent = `
      /* 自定义视图容器 - 关键：正确控制显示/隐藏 */
      #researchopia-shared-annotations-view {
        display: flex; /* 默认flex布局 */
        width: 100%;
        height: 100%;
        flex-direction: column;
        background: var(--material-sidebar-bg, #fff);
      }
      #researchopia-shared-annotations-view.hidden {
        display: none !important; /* 隐藏时完全不显示 */
      }
      
      /* 确保原生视图也正确隐藏 */
      #thumbnailView.hidden,
      #outlineView.hidden,
      #annotationsView.hidden {
        display: none !important;
      }
    `;
    doc.head.appendChild(style);
  }

  /**
   * 启动轮询检查（作为Observer的后备方案）
   */
  private startPolling(doc: Document, reader: any) {
    // 清除旧轮询
    if ((doc as any)._researchopiaSidebarPoller) {
      clearInterval((doc as any)._researchopiaSidebarPoller);
    }
    
    logger.log("[SidebarSharedView] Starting polling (every 500ms)...");
    const interval = setInterval(() => {
      // 检查文档是否仍然有效
      if (!doc || !doc.body) {
        clearInterval(interval);
        logger.log("[SidebarSharedView] Document invalid, stopping polling");
        return;
      }
      
      const buttonContainer = doc.querySelector("#sidebarContainer div.start");
      const sidebarContent = doc.getElementById("sidebarContent");
      const myButton = doc.getElementById("researchopia-shared-annotations-button");
      const myView = doc.getElementById("researchopia-shared-annotations-view");
      
      // ⚠️ 关键: 检查DOM是否存在,如果不存在则清除标志
      // 场景: Toggle sidebar关闭-打开后,Zotero重新创建DOM,导致组件丢失
      if (this.registeredReaders.has(reader.tabID) && (!myButton || !myView)) {
        logger.warn(`[SidebarSharedView] ⚠️ DOM lost for reader ${reader.tabID}, clearing flag`);
        this.registeredReaders.delete(reader.tabID);
      }
      
      // 如果sidebar存在但我们的组件消失了，重新注入
      if (buttonContainer && sidebarContent) {
        let needReinject = false;
        
        if (!myButton) {
          logger.log("[SidebarSharedView] Polling detected: button missing");
          needReinject = true;
        }
        
        if (!myView) {
          logger.log("[SidebarSharedView] Polling detected: view missing");
          needReinject = true;
        }
        
        if (needReinject) {
          // 重新注入组件
          this.injectStyle(doc);
          this.injectSidebarButton(doc, reader);
          this.injectSidebarContent(doc, reader);
          
          // 重新绑定事件
          const container = doc.getElementById("sidebarContainer");
          if (container && !(container as any)._researchopiaEventBound) {
            this.bindTabEvents(doc, reader);
          }
        }
      }
    }, 500); // 每500ms检查一次 (更快响应toggle操作)
    
    (doc as any)._researchopiaSidebarPoller = interval;
  }

  /**
   * 监听Sidebar DOM变化（Toggle Sidebar时会重建DOM）
   */
  private observeSidebar(doc: Document, reader: any) {
    // 清除旧Observer
    if ((doc as any)._researchopiaSidebarObserver) {
        (doc as any)._researchopiaSidebarObserver.disconnect();
    }

    const observer = new MutationObserver((mutations) => {
      // 检查sidebar container是否被重建
      const buttonContainer = doc.querySelector("#sidebarContainer div.start");
      const sidebarContent = doc.getElementById("sidebarContent");
      
      if (buttonContainer && sidebarContent) {
        const myButton = doc.getElementById("researchopia-shared-annotations-button");
        const myView = doc.getElementById("researchopia-shared-annotations-view");
        
        // 如果按钮或视图消失，重新注入
        if (!myButton || !myView) {
          logger.log("[SidebarSharedView] Sidebar DOM lost, re-injecting components...");
          
          // 重新注入所有组件
          if (!myButton) {
            this.injectSidebarButton(doc, reader);
          }
          if (!myView) {
            this.injectSidebarContent(doc, reader);
          }
          
          // 重新绑定事件（如果sidebarContainer被重建，事件监听器会丢失）
          const container = doc.getElementById("sidebarContainer");
          if (container && !(container as any)._researchopiaEventBound) {
            this.bindTabEvents(doc, reader);
          }
        }
      }
    });

    // 监听整个body（sidebar可能被完全移除再添加）
    observer.observe(doc.body, {
      childList: true,
      subtree: true
    });

    (doc as any)._researchopiaSidebarObserver = observer;
    logger.log("[SidebarSharedView] Sidebar observer started");
  }

  /**
   * 注入Sidebar按钮
   */
  private injectSidebarButton(doc: Document, reader: any) {
    const buttonContainer = doc.querySelector("#sidebarContainer div.start");
    if (!buttonContainer) {
      logger.warn("[SidebarSharedView] #sidebarContainer div.start not found");
      throw new Error("#sidebarContainer div.start not found"); // 🔥 抛出错误而不是静默返回
    }
    
    if (doc.getElementById("researchopia-shared-annotations-button")) {
      logger.log("[SidebarSharedView] Button already exists");
      return;
    }

    logger.log("[SidebarSharedView] Creating sidebar button...");
    const button = doc.createElement("button");
    button.id = "researchopia-shared-annotations-button";
    // 🔥 使用 toolbar-button 类（与Jasminum相同，利用Zotero原生样式）
    button.className = "toolbar-button";
    button.type = "button";
    button.tabIndex = -1;
    button.title = "Shared Annotations";
    button.setAttribute("aria-selected", "false");
    button.setAttribute("aria-controls", "researchopia-shared-annotations-view");
    
    // 🎨 使用 Researchopia 内联 SVG 图标（参考Jasminum实现）
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 15 Q5 14 10 15 T19 15" fill="none" stroke="#a855f7" stroke-width="1.2" opacity="0.6"/>
        <rect x="5" y="5" width="10" height="8" rx="1.2" fill="#7c3aed"/>
        <rect x="5.6" y="5.6" width="8.8" height="6.8" rx="0.6" fill="#8b5cf6"/>
        <line x1="7.5" y1="7.5" x2="12.5" y2="7.5" stroke="white" stroke-width="0.6"/>
        <line x1="7.5" y1="9.5" x2="12.5" y2="9.5" stroke="white" stroke-width="0.6"/>
        <line x1="7.5" y1="11.5" x2="11.5" y2="11.5" stroke="white" stroke-width="0.6"/>
        <line x1="10" y1="5.6" x2="10" y2="12.4" stroke="#6d28d9" stroke-width="0.4"/>
        <circle cx="15" cy="3.8" r="1.8" fill="#fbbf24"/>
        <rect x="14.4" y="5.3" width="1.2" height="1.8" fill="#f59e0b"/>
        <g stroke="#fbbf24" stroke-width="0.6" opacity="0.7">
          <line x1="12" y1="3.8" x2="11.2" y2="3.8"/>
          <line x1="18" y1="3.8" x2="18.8" y2="3.8"/>
          <line x1="15" y1="0.7" x2="15" y2="0"/>
          <line x1="13" y1="1.8" x2="12.3" y2="1.1"/>
          <line x1="17" y1="1.8" x2="17.7" y2="1.1"/>
        </g>
      </svg>
    `;
    
    // 🎯 插入到Annotations和Outline之间 (第2个按钮位置)
    const outlineButton = buttonContainer.querySelector('[id="viewOutline"]');
    if (outlineButton) {
      buttonContainer.insertBefore(button, outlineButton);
      logger.log("[SidebarSharedView] Button inserted between Annotations and Outline");
    } else {
      buttonContainer.appendChild(button);
      logger.warn("[SidebarSharedView] Outline button not found, appended to end");
    }
  }

  /**
   * 注入内容容器
   */
  private injectSidebarContent(doc: Document, reader: any) {
    const sidebarContent = doc.getElementById("sidebarContent");
    if (!sidebarContent) return;
    
    if (doc.getElementById("researchopia-shared-annotations-view")) return;

    const container = doc.createElement("div");
    container.id = "researchopia-shared-annotations-view";
    container.className = "hidden"; // 默认隐藏，通过CSS控制
    container.setAttribute("role", "tabpanel");
    container.setAttribute("aria-labelledby", "researchopia-shared-annotations-button");
    // 设置flex布局，确保子元素正确排列
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
    `;

    // 1. 顶部工具栏
    const toolbar = doc.createElement("div");
    toolbar.className = "shared-annotations-toolbar";
    toolbar.style.cssText = `
      padding: 8px 12px;
      border-bottom: 1px solid var(--material-divider, #e0e0e0);
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
    `;
    
    // 刷新按钮
    const refreshBtn = doc.createElement("button");
    refreshBtn.id = "refresh-btn";
    refreshBtn.textContent = "🔄 刷新";
    refreshBtn.style.cssText = `
      padding: 6px 12px;
      cursor: pointer;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      transition: background 0.2s;
    `;
    refreshBtn.title = "重新加载共享标注";
    
    // 鼠标悬停效果
    refreshBtn.addEventListener('mouseenter', () => {
      refreshBtn.style.background = '#0056b3';
    });
    refreshBtn.addEventListener('mouseleave', () => {
      refreshBtn.style.background = '#007bff';
    });
    
    toolbar.appendChild(refreshBtn);
    
    // 缓存 reader 实例 (供PDF展示按钮使用)
    const docId = (doc as any).__researchopia_doc_id || `doc-${Date.now()}`;
    (doc as any).__researchopia_doc_id = docId;
    this.readerCache.set(docId, reader);
    
    // 1.5 筛选排序工具栏 (参考 sessionAnnotationsView.ts:1577-1678)
    const filterSortToolbar = this.createFilterSortToolbar(doc);
    
    // 2. 标注列表容器
    const list = doc.createElement("div");
    list.className = "shared-annotations-list";
    list.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    `;
    
    // Phase 2: 初始显示加载状态
    list.id = "shared-annotations-list-container";
    list.innerHTML = `
      <div id="shared-loading-state" style="text-align: center; color: #999; margin-top: 40px;">
        <div style="font-size: 24px;">⏳</div>
        <div style="margin-top: 8px;">加载共享标注...</div>
      </div>
    `;

    container.appendChild(toolbar);
    container.appendChild(filterSortToolbar);
    container.appendChild(list);
    
    sidebarContent.appendChild(container);
  }

  /**
   * 绑定Tab切换事件 (参考Jasminum设计)
   */
  private bindTabEvents(doc: Document, reader: any) {
    const myButton = doc.getElementById("researchopia-shared-annotations-button");
    
    if (!myButton) {
      logger.warn("[SidebarSharedView] Button not found, cannot bind events");
      return;
    }

    // 防止重复绑定
    if (myButton.getAttribute("data-event-bound")) {
      return;
    }
    
    // 点击自己的按钮
    myButton.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      logger.log("[SidebarSharedView] Own button clicked");
      this.showMyView(doc);
      
      // Phase 2: 加载标注数据
      await this.loadAnnotations(reader, doc);
    });
    
    myButton.setAttribute("data-event-bound", "true");
    
    // 绑定刷新按钮事件
    const refreshBtn = doc.getElementById("refresh-btn");
    if (refreshBtn && !refreshBtn.getAttribute("data-event-bound")) {
      refreshBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        logger.log("[SidebarSharedView] Refresh button clicked");
        
        // 获取当前的筛选和排序设置
        const sortSelect = doc.getElementById('shared-annotation-sort-select') as HTMLSelectElement;
        const filterSelectNew = doc.getElementById('shared-annotation-filter-select') as HTMLSelectElement;
        
        await this.loadAnnotations(reader, doc, { 
          sort: sortSelect?.value || 'time-desc', 
          filter: filterSelectNew?.value || 'all' 
        });
      });
      refreshBtn.setAttribute("data-event-bound", "true");
    }

    // 监听所有toolbar按钮点击（包括原生按钮）
    const handleButtonClick = (e: Event) => {
      const target = (e.target as Element).closest("button");
      if (!target) return;
      
      const buttonId = target.id;
      
      if (buttonId === "researchopia-shared-annotations-button") {
        // 我们自己的按钮已经在上面处理
        return;
      }
      
      // 点击了其他按钮（原生tab），隐藏我们的视图
      logger.log(`[SidebarSharedView] Other button clicked: ${buttonId}`);
      
      // 根据按钮ID确定对应的视图ID
      const viewMap: Record<string, string> = {
        "viewThumbnail": "thumbnailView",
        "viewOutline": "outlineView",
        "viewAnnotations": "annotationsView"
      };
      
      const targetViewId = viewMap[buttonId];
      if (targetViewId) {
        // 不阻止事件传播，让Zotero自己的处理器先运行
        // 然后我们在下一个tick再调整
        setTimeout(() => {
          this.hideMyView(doc, targetViewId);
        }, 0);
      }
    };
    
    // 在sidebar container上监听所有按钮点击（事件委托）
    const sidebarContainer = doc.getElementById("sidebarContainer");
    if (sidebarContainer) {
      sidebarContainer.addEventListener("click", handleButtonClick, true);
      // 标记已绑定
      (sidebarContainer as any)._researchopiaEventBound = true;
    }
  }
  
  /**
   * 显示我们的视图
   */
  private showMyView(doc: Document) {
    // 1. 隐藏所有原生视图
    const nativeViews = ["thumbnailView", "outlineView", "annotationsView"];
    nativeViews.forEach(id => {
      const el = doc.getElementById(id);
      if (el) {
        el.classList.add("hidden");
      }
    });
    
    // 2. 显示我们的视图
    const myView = doc.getElementById("researchopia-shared-annotations-view");
    if (myView) {
      myView.classList.remove("hidden");
    }
    
    // 3. 更新按钮状态
    doc.querySelectorAll("#sidebarContainer button").forEach(btn => {
      if (btn.id === "researchopia-shared-annotations-button") {
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
      } else {
        btn.classList.remove("active");
        btn.setAttribute("aria-selected", "false");
      }
    });
  }
  
  /**
   * 隐藏我们的视图，显示对应的原生视图
   */
  private hideMyView(doc: Document, targetViewId?: string) {
    // 1. 隐藏我们的视图
    const myView = doc.getElementById("researchopia-shared-annotations-view");
    if (myView) {
      myView.classList.add("hidden");
    }
    
    // 2. 取消我们按钮的激活状态
    const myButton = doc.getElementById("researchopia-shared-annotations-button");
    if (myButton) {
      myButton.classList.remove("active");
      myButton.setAttribute("aria-selected", "false");
    }
    
    // 3. 先隐藏所有原生视图
    const nativeViews = ["thumbnailView", "outlineView", "annotationsView"];
    nativeViews.forEach(id => {
      const el = doc.getElementById(id);
      if (el) {
        el.classList.add("hidden");
      }
    });
    
    // 4. 如果指定了目标视图，则显示它并激活对应按钮
    if (targetViewId) {
      const targetView = doc.getElementById(targetViewId);
      if (targetView) {
        targetView.classList.remove("hidden");
      }
      
      // 激活对应的按钮
      const buttonMap: Record<string, string> = {
        "thumbnailView": "viewThumbnail",
        "outlineView": "viewOutline",
        "annotationsView": "viewAnnotations"
      };
      
      const targetButtonId = buttonMap[targetViewId];
      if (targetButtonId) {
        doc.querySelectorAll("#sidebarContainer button").forEach(btn => {
          if (btn.id === targetButtonId) {
            btn.classList.add("active");
            btn.setAttribute("aria-selected", "true");
          } else if (btn.id !== "researchopia-shared-annotations-button") {
            btn.classList.remove("active");
            btn.setAttribute("aria-selected", "false");
          }
        });
      }
    }
  }

  /**
   * 切换Tab (已废弃，使用showMyView/hideMyView)
   */
  private switchTab(doc: Document, reader: any, viewName: string) {
    logger.warn(`[SidebarSharedView] switchTab is deprecated, use showMyView/hideMyView instead`);
    logger.log(`[SidebarSharedView] Switching to ${viewName}`);
    
    // 不调用reader.setSidebarView - 会导致TypeError
    // 完全手动控制UI

    // 1. 更新UI可见性
    const views = ["thumbnailView", "outlineView", "annotationsView", "researchopia-shared-annotations-view"];
    views.forEach(id => {
      const el = doc.getElementById(id);
      if (el) {
        if (id === "researchopia-shared-annotations-view") {
          // 显示我们的视图
          el.classList.remove("hidden");
          el.style.display = "flex";
        } else {
          // 隐藏原生视图
          el.classList.add("hidden");
          el.style.display = "none";
        }
      }
    });

    // 2. 更新按钮状态
    const myButton = doc.getElementById("researchopia-shared-annotations-button");
    if (myButton) {
      myButton.classList.add("active");
      myButton.setAttribute("aria-selected", "true");
    }
    
    // 移除其他按钮active状态 (包括toolbar-button和其他可能的类名)
    const allButtons = doc.querySelectorAll("#sidebarContainer button");
    allButtons.forEach(btn => {
      if (btn.id !== "researchopia-shared-annotations-button") {
        btn.classList.remove("active");
        btn.setAttribute("aria-selected", "false");
      }
    });
  }

  // ============ Phase 2: 数据加载与渲染 ============

  /**
   * 加载共享标注
   */
  private async loadAnnotations(
    reader: any, 
    doc: Document, 
    options?: { sort?: string; filter?: string }
  ): Promise<void> {
    const readerId = reader.tabID;
    
    // 保存当前reader引用,供筛选排序工具栏使用
    this.currentReader = reader;
    
    // 防止重复加载
    if (this.loadingAnnotations.has(readerId)) {
      logger.log(`[SidebarSharedView] Already loading annotations for reader ${readerId}`);
      return;
    }
    
    this.loadingAnnotations.add(readerId);
    
    try {
      logger.log(`[SidebarSharedView] Loading annotations for reader ${readerId}`);
      
      // 1. 获取当前文献DOI
      let item = Zotero.Items.get(reader.itemID);
      if (!item) {
        logger.error(`[SidebarSharedView] ❌ Cannot get item for reader.itemID: ${reader.itemID}`);
        this.showEmptyState(doc, '无法获取文献信息');
        return;
      }
      
      logger.log(`[SidebarSharedView] ✅ Got item: ${item.id}, type: ${item.itemType}`);
      
      // 如果是attachment,获取父级Item (参考ui-manager.ts:618-620)
      if ((item as any).itemType === 'attachment' && item.parentItemID) {
        logger.log(`[SidebarSharedView] 📎 Item is attachment, getting parent item ${item.parentItemID}`);
        item = Zotero.Items.get(item.parentItemID);
        logger.log(`[SidebarSharedView] ✅ Got parent item: ${item.id}, type: ${(item as any).itemType}`);
      }
      
      let doi = '';
      try {
        doi = item.getField('DOI');
        logger.log(`[SidebarSharedView] ✅ Found DOI: ${doi}`);
      } catch (e) {
        logger.error(`[SidebarSharedView] ❌ Failed to get DOI field:`, e);
        this.showEmptyState(doc, '当前文献无DOI，无法加载共享标注');
        return;
      }
      
      if (!doi || doi.trim() === '') {
        logger.warn(`[SidebarSharedView] ⚠️ DOI field is empty`);
        this.showEmptyState(doc, '当前文献无DOI，无法加载共享标注');
        return;
      }
      
      // 2. 查询Supabase Document ID (使用共享缓存)
      let documentId = this.cache.getDocumentId(doi);
      if (!documentId) {
        logger.log(`[SidebarSharedView] Finding or creating document for item ${item.id}`);
        
        // 使用supabaseManager.findOrCreateDocument() (参考myAnnotationsView.ts:106)
        const documentInfo = await this.supabaseManager.findOrCreateDocument(item);
        
        if (!documentInfo?.id) {
          this.showEmptyState(doc, '无法创建文档记录');
          return;
        }
        
        documentId = documentInfo.id as string;
        this.cache.setDocumentId(doi, documentId);
        logger.log(`[SidebarSharedView] Document ID: ${documentId}`);
      }
      
      // 3. 获取共享标注 (type=all 获取所有用户的标注)
      logger.log(`[SidebarSharedView] Fetching shared annotations for document: ${documentId}`);
      
      // 处理筛选和排序选项
      const sortType = options?.sort || 'time-desc';
      const filterType = options?.filter || 'all-others';
      
      const annotationParams = new URLSearchParams({
        document_id: documentId,
        type: 'all', // 获取所有用户的共享标注
      });
      
      // 应用排序
      if (sortType === 'page-asc') {
        annotationParams.set('order', 'position.pageIndex.asc');
      } else if (sortType === 'page-desc') {
        annotationParams.set('order', 'position.pageIndex.desc');
      } else if (sortType === 'time-desc') {
        annotationParams.set('order', 'created_at.desc');
      } else if (sortType === 'time-asc') {
        annotationParams.set('order', 'created_at.asc');
      } else if (sortType === 'likes-desc') {
        annotationParams.set('order', 'likes_count.desc');
      } else if (sortType === 'comments-desc') {
        annotationParams.set('order', 'comments_count.desc');
      }
      
      // 应用筛选 (新的3按钮逻辑)
      if (filterType === 'all') {
        // 所有按钮: 他人public/anonymous + 自己所有(含private)
        annotationParams.set('filter', 'all');
        logger.log('[SidebarSharedView] Filter: all (others\' public/anonymous + my all)');
      } else if (filterType === 'others') {
        // 他人按钮: 仅他人public/anonymous
        annotationParams.set('filter', 'others');
        logger.log('[SidebarSharedView] Filter: others (public/anonymous, exclude myself)');
      } else if (filterType === 'followed') {
        // 关注按钮: 仅关注用户的public
        annotationParams.set('filter', 'followed');
        logger.log('[SidebarSharedView] Filter: followed (followed users\' public only)');
      }
      
      logger.log(`[SidebarSharedView] Final params - Filter: ${filterType}, Sort: ${sortType}`);
      logger.log(`[SidebarSharedView] API query string: ${annotationParams.toString()}`);
      const annotations: any = await this.apiClient.get('/api/proxy/annotations', annotationParams);
      
      if (!annotations?.data || annotations.data.length === 0) {
        // 根据筛选类型显示不同提示
        let emptyMessage = '该文献暂无共享标注';
        if (filterType === 'followed') {
          emptyMessage = '您关注的用户暂无该文献的公开标注';
        } else if (filterType === 'others') {
          emptyMessage = '其他用户暂无该文献的公开/匿名标注';
        }
        this.showEmptyState(doc, emptyMessage);
        return;
      }
      
      logger.log(`[SidebarSharedView] Loaded ${annotations.data.length} shared annotations`);
      
      // 🔍 DEBUG: 打印API返回的ID顺序(验证后端排序是否生效)
      const apiOrder = annotations.data.map((ann: any) => ann.id.substring(0, 8)).join(' → ');
      logger.log(`[SidebarSharedView] API returned order: ${apiOrder}`);
      
      // 保存当前标注列表 (供PDF展示按钮使用)
      this.currentAnnotations.set(readerId, annotations.data);
      
      // 4. 渲染标注列表(传入reader供导航使用)
      await this.renderAnnotationList(annotations.data, doc, reader);
      
    } catch (error) {
      logger.error('[SidebarSharedView] Failed to load annotations:', error);
      this.showErrorState(doc, '加载失败，请刷新重试');
    } finally {
      this.loadingAnnotations.delete(readerId);
    }
  }

  /**
   * 渲染标注列表 (参考 sessionAnnotationsView.ts:1678-1691)
   */
  private async renderAnnotationList(annotations: any[], doc: Document, reader: any): Promise<void> {
    const container = doc.getElementById('shared-annotations-list-container');
    if (!container) {
      logger.error('[SidebarSharedView] List container not found');
      return;
    }
    
    // 清空容器
    container.innerHTML = '';
    
    logger.log(`[SidebarSharedView] Rendering ${annotations.length} annotation cards`);
    
    // 🔍 DEBUG: 打印所有标注的排序关键字段
    annotations.forEach((ann: any, idx: number) => {
      logger.log(`[SidebarSharedView] Annotation ${idx + 1}:`, {
        id: ann.id.substring(0, 8),
        content: ann.content?.substring(0, 30) || 'No content',
        page: ann.position?.pageIndex,
        created_at: ann.created_at,
        likes: ann.likes_count,
        comments: ann.comments_count
      });
    });
    
    // 批量获取所有标注的点赞状态 (参考 sessionAnnotationsView.ts:1684-1686)
    const currentUser = AuthManager.getCurrentUser();
    const currentUserId = currentUser?.id || '';
    const annotationIds = annotations.map((a: any) => a.id);
    const likeMap = await this.supabaseManager.batchCheckUserLikes(annotationIds, currentUserId);
    
    // 遍历并渲染每个标注卡片
    annotations.forEach(annotation => {
      const userLiked = likeMap.get(annotation.id) || false;
      const card = this.renderAnnotationCard(annotation, doc, reader, userLiked);
      container.appendChild(card);
    });
  }

  /**
   * 渲染单个标注卡片 (参考sessionAnnotationsView.ts:1690的完整实现)
   */
  private renderAnnotationCard(annotation: any, doc: Document, reader: any, userLiked: boolean = false): HTMLElement {
    const card = doc.createElement('div');
    card.className = 'shared-annotation-card';
    card.dataset.annotationId = annotation.id;
    
    // 从annotation_data中提取颜色 (参考sessionAnnotationsView.ts:1713)
    const annotationColor = annotation.annotation_data?.color || annotation.color || '#ffd400';
    
    card.style.cssText = `
      padding: 10px;
      background: #ffffff;
      border-radius: 4px;
      border-left: 3px solid ${annotationColor};
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.08);
      transition: transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
      margin-bottom: 8px;
    `;
    
    // 头部 - 用户信息和时间 (参考sessionAnnotationsView.ts:1723-1728)
    const headerDiv = doc.createElement("div");
    headerDiv.style.cssText = "display: flex; justify-content: space-between; align-items: center;";

    const userInfo = doc.createElement("div");
    userInfo.style.cssText = "display: flex; align-items: center; gap: 6px; font-size: 11px; color: #6c757d;";

    // ✨ 使用 UserHoverCardManager 创建用户元素 (参考 sessionAnnotationsView.ts:1736-1771)
    const visibility = annotation.visibility || 'public';
    
    const isPrivate = visibility === 'private';
    const isAnonymous = visibility === 'anonymous';
    
    let displayName: string;
    let username: string;
    let clickable: boolean;
    
    if (isPrivate) {
      // 私密标注显示"私密"
      displayName = '私密';
      username = '';
      clickable = false;
    } else if (isAnonymous) {
      // 匿名标注显示"匿名用户"
      displayName = '匿名用户';
      username = '';
      clickable = false;
    } else {
      // 公开标注显示真实用户名
      displayName = annotation.user?.username || annotation.user?.email || '未知用户';
      username = annotation.user?.username || '';
      clickable = true;
    }
    
    const userElement = this.userHoverCardManager.createUserElement(
      doc,
      username,
      displayName,
      { isAnonymous: isAnonymous || isPrivate, clickable, avatarUrl: annotation.user?.avatar_url }
    );
    userInfo.appendChild(userElement);

    const separator = doc.createElement("span");
    separator.style.color = "#9ca3af";
    separator.textContent = "·";
    userInfo.appendChild(separator);

    const timeSpan = doc.createElement("span");
    timeSpan.style.color = "#9ca3af";
    timeSpan.textContent = this.formatTimestamp(annotation.created_at);
    userInfo.appendChild(timeSpan);

    // 页码标签 (参考sessionAnnotationsView.ts:1789-1797)
    const pageInfo = doc.createElement('span');
    const pageNumber = annotation.position?.pageIndex !== undefined ? annotation.position.pageIndex + 1 : (annotation.page_number || 1);
    pageInfo.textContent = `p.${pageNumber}`;
    pageInfo.style.cssText = `
      background: #e7f5ff;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 10px;
      color: #0d6efd;
      display: inline-block;
    `;

    headerDiv.appendChild(userInfo);
    headerDiv.appendChild(pageInfo);
    card.appendChild(headerDiv);

    // 标注内容 (参考sessionAnnotationsView.ts:1801-1820)
    const annotationText = annotation.annotation_data?.text || 
                          annotation.annotation_data?.comment || 
                          annotation.content ||
                          '';
    
    if (annotationText) {
      const contentDiv = doc.createElement("div");
      contentDiv.style.cssText = `
        font-size: 12px;
        line-height: 1.4;
        color: #212529;
        background: ${annotationColor}20;
        padding: 6px;
        border-radius: 3px;
      `;
      contentDiv.textContent = annotationText;
      card.appendChild(contentDiv);
    }

    // 原生评论内容 (参考sessionAnnotationsView.ts:1822-1833)
    if (annotation.comment) {
      const commentDiv = doc.createElement("div");
      commentDiv.style.cssText = `
        font-size: 11px;
        line-height: 1.3;
        color: #6c757d;
        font-style: italic;
        padding-left: 10px;
        border-left: 2px solid #e9ecef;
      `;
      commentDiv.textContent = annotation.comment;
      card.appendChild(commentDiv);
    }

    // 操作按钮区域 - 点赞和评论 (参考 sessionAnnotationsView.ts:1839-1881)
    const actionsDiv = doc.createElement("div");
    actionsDiv.className = "social-actions";
    actionsDiv.style.cssText = "display: flex; gap: 12px; align-items: center;";

    // 获取当前用户ID (参考 sessionAnnotationsView.ts:234)
    const currentUser = AuthManager.getCurrentUser();
    const currentUserId = currentUser?.id || '';

    // 点赞按钮 (参考 sessionAnnotationsView.ts:1843-1854)
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
      e.stopPropagation(); // 阻止冒泡到卡片点击事件
      await this.handleLikeAnnotation(annotation.id, currentUserId, card);
    });

    // 评论按钮
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
      e.stopPropagation(); // 阻止冒泡到卡片点击事件
      await this.showCommentsSection(card, annotation.id, currentUserId);
    });

    actionsDiv.appendChild(likeButton);
    actionsDiv.appendChild(commentButton);
    card.appendChild(actionsDiv);
    
    // 卡片点击事件 - 定位到PDF页面 (参考 sessionAnnotationsView.ts:1893-1910)
    card.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;

      // 如果点击的是按钮或评论区域,不触发卡片点击事件
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        return;
      }

      if (target.classList.contains('comments-section') || target.closest('.comments-section')) {
        return;
      }

      // 触发定位功能
      await this.navigateToAnnotation(annotation, reader);
    });
    
    // Hover效果
    card.addEventListener('mouseenter', () => {
      card.style.background = '#f8f9fa';
      card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.12)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.background = '#ffffff';
      card.style.boxShadow = '0 1px 2px rgba(0,0,0,0.08)';
    });
    
    return card;
  }

  /**
   * 跳转到标注位置
   */
  private async navigateToAnnotation(annotation: any, reader: any): Promise<void> {
    try {
      logger.log(`[SidebarSharedView] Navigating to annotation: ${annotation.id}`);
      logger.log(`[SidebarSharedView] Position data:`, JSON.stringify(annotation.position));
      logger.log(`[SidebarSharedView] Reader ID:`, reader?.tabID);
      
      // 1. 懒加载 PDFReaderManager
      const pdfManager = await this.getPDFReaderManager();
      if (!pdfManager) {
        logger.error('[SidebarSharedView] PDFReaderManager not available');
        return;
      }
      
      // 2. 验证参数
      if (!reader) {
        logger.error('[SidebarSharedView] No reader provided');
        return;
      }
      
      if (!annotation.position) {
        logger.error('[SidebarSharedView] No position data in annotation');
        return;
      }
      
      // 3. 使用 highlightAnnotation 方法 (公开API)
      // 参考 sessionAnnotationsView.ts:2804-2818
      const success = await pdfManager.highlightAnnotation(
        reader,
        {
          id: annotation.id,
          type: annotation.type || 'highlight',
          content: annotation.content || '',
          comment: annotation.comment || '',
          color: annotation.color || '#ffd400',
          position: annotation.position,
          username: annotation.user?.username || annotation.user?.email || '匿名用户',
          user_id: annotation.user_id,
          visibility: annotation.visibility, // 🔥 传递 visibility 字段
          created_at: annotation.created_at
        },
        {
          scrollToView: true,
          showPopup: false // 🔥 禁用弹窗，用户需通过点击PDF图层来查看
        }
      );
      
      if (success) {
        logger.log(`[SidebarSharedView] ✅ Navigated successfully`);
      } else {
        logger.warn(`[SidebarSharedView] ⚠️ Navigation returned false`);
      }
      
    } catch (error) {
      logger.error('[SidebarSharedView] Navigation failed:', error);
      logger.error('[SidebarSharedView] Error details:', error instanceof Error ? error.message : String(error));
      logger.error('[SidebarSharedView] Error stack:', error instanceof Error ? error.stack : 'N/A');
    }
  }

  /**
   * 反向导航: 点击PDF标注图层时，滚动到对应的共享标注卡片并高亮提示
   * @param annotationId 标注ID
   * @param doc Document对象
   */
  public scrollToAndHighlightCard(annotationId: string, doc: Document): void {
    logger.log(`[SidebarSharedView] 📍 Scrolling to card: ${annotationId}`);
    
    // 查找对应的卡片
    const card = doc.querySelector(`.shared-annotation-card[data-annotation-id="${annotationId}"]`) as HTMLElement;
    
    if (!card) {
      logger.warn(`[SidebarSharedView] ⚠️ Card not found: ${annotationId}`);
      return;
    }
    
    // 滚动到卡片位置
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // 添加高亮动画
    const originalBackground = card.style.background;
    const originalBoxShadow = card.style.boxShadow;
    
    // 高亮效果
    card.style.background = '#fff3cd'; // 黄色高亮
    card.style.boxShadow = '0 0 0 3px rgba(255, 193, 7, 0.5)';
    card.style.transition = 'all 0.3s ease';
    
    // 1.5秒后恢复原样
    setTimeout(() => {
      card.style.background = originalBackground;
      card.style.boxShadow = originalBoxShadow;
    }, 1500);
    
    logger.log(`[SidebarSharedView] ✅ Card highlighted successfully`);
  }

  /**
   * 处理点赞标注
   * 修复: 点赞后重新获取数据库的真实 likes_count,避免计数错误
   */
  private async handleLikeAnnotation(
    annotationId: string,
    userId: string,
    cardElement?: HTMLElement
  ): Promise<void> {
    if (!cardElement) return;
    
    const likeButton = cardElement.querySelector(
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
      const isNowLiked = await this.supabaseManager.likeAnnotation(annotationId, userId);
      
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
      logger.error("[SidebarSharedView] Error liking annotation:", error);
    } finally {
      // 恢复按钮可用状态
      if (likeButton) {
        likeButton.disabled = false;
      }
    }
  }

  /**
   * 显示评论区域 (完全参考 sessionAnnotationsView.ts:1955-2094)
   */
  private async showCommentsSection(
    cardElement: HTMLElement,
    annotationId: string,
    currentUserId: string
  ): Promise<void> {
    const doc = cardElement.ownerDocument;

    let commentsSection = cardElement.querySelector(".comments-section") as HTMLElement | null;

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
      const commentTree = await this.supabaseManager.getAnnotationCommentTree(annotationId);

      if (commentTree.length > 0) {
        const commentsList = doc.createElement("div");
        commentsList.className = "comments-tree";
        commentsList.style.cssText = "display: flex; flex-direction: column; gap: 4px;";

        commentTree.forEach((rootComment) => {
          const commentNode = this.renderCommentNode(
            rootComment,
            0,
            doc,
            currentUserId,
            annotationId,
            cardElement
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

          await this.supabaseManager.addComment(annotationId, currentUserId, content, null, isAnonymous);
          textarea.value = "";

          // 重新加载评论
          cardElement.removeChild(commentsSection!);
          await this.showCommentsSection(cardElement, annotationId, currentUserId);

          // 更新评论计数
          const commentButton = cardElement.querySelector("button[data-comment-button]") as HTMLButtonElement;
          if (commentButton) {
            const currentCount = parseInt(commentButton.textContent?.match(/\d+/)?.[0] || "0", 10);
            commentButton.innerHTML = `💬 ${currentCount + 1}`;
          }
        } catch (error) {
          logger.error("[SidebarSharedView] Error adding comment:", error);
        }
      });

      buttonContainer.appendChild(submitButton);

      inputAreaContainer.appendChild(textarea);
      inputAreaContainer.appendChild(anonymousContainer);
      inputAreaContainer.appendChild(buttonContainer);

      commentsSection.appendChild(inputAreaContainer);
      cardElement.appendChild(commentsSection);

    } catch (error) {
      logger.error("[SidebarSharedView] Error loading comments:", error);
    }
  }

  /**
   * 创建筛选排序工具栏 (使用按钮组替代select,解决iframe环境下拉菜单问题)
   * 完整功能: 排序(页码/时间/点赞/评论) + 筛选(页码/用户) + PDF展示控制
   */
  private createFilterSortToolbar(doc: Document): HTMLElement {
    const toolbar = doc.createElement('div');
    toolbar.className = 'filter-sort-toolbar';
    toolbar.style.cssText = `
      margin-bottom: 12px;
      padding: 8px;
      background: #f8f9fa;
      border-radius: 6px;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 6px;
    `;

    // === 1. 排序按钮组 (两行) ===
    const sortLabel = doc.createElement('div');
    sortLabel.textContent = '排序:';
    sortLabel.style.cssText = 'font-size: 10px; color: #6c757d; font-weight: 500;';
    toolbar.appendChild(sortLabel);

    // 第一行: 页码排序
    const sortRow1 = doc.createElement('div');
    sortRow1.style.cssText = 'display: flex; gap: 4px;';
    const pageSort = [
      { value: 'page-asc', label: '📄 页码↑' },
      { value: 'page-desc', label: '📄 页码↓' }
    ];
    this.createButtonGroup(doc, sortRow1, pageSort, 'sort-btn', false, (value) => {
      this.handleSortChange(doc, value);
    });
    toolbar.appendChild(sortRow1);

    // 第二行: 时间/点赞/评论排序
    const sortRow2 = doc.createElement('div');
    sortRow2.style.cssText = 'display: flex; gap: 4px;';
    const otherSort = [
      { value: 'time-asc', label: '⏰ 最早' },
      { value: 'time-desc', label: '⏰ 最新', default: true },
      { value: 'likes-desc', label: '❤️ 点赞' },
      { value: 'comments-desc', label: '💬 评论' }
    ];
    this.createButtonGroup(doc, sortRow2, otherSort, 'sort-btn', true, (value) => {
      this.handleSortChange(doc, value);
    });
    toolbar.appendChild(sortRow2);

    // === 2. 筛选按钮组 ===
    const filterLabel = doc.createElement('div');
    filterLabel.textContent = '筛选:';
    filterLabel.style.cssText = 'font-size: 10px; color: #6c757d; font-weight: 500; margin-top: 4px;';
    toolbar.appendChild(filterLabel);

    // 用户筛选 (新的3按钮)
    const filterRow1 = doc.createElement('div');
    filterRow1.style.cssText = 'display: flex; gap: 4px;';
    const userFilters = [
      { value: 'all', label: '📚 所有', default: true },
      { value: 'others', label: '👥 他人' },
      { value: 'followed', label: '⭐ 关注' }
    ];
    this.createButtonGroup(doc, filterRow1, userFilters, 'filter-btn', true, (value) => {
      this.handleFilterChange(doc, value);
    });
    toolbar.appendChild(filterRow1);

    // 页码筛选占位(待实现分页后添加)
    // const filterRow2 = doc.createElement('div');
    // filterRow2.id = 'page-filter-row';
    // filterRow2.style.cssText = 'display: none; gap: 4px;'; // 初始隐藏
    // toolbar.appendChild(filterRow2);

    // === 3. PDF展示控制 ===
    const controlLabel = doc.createElement('div');
    controlLabel.textContent = 'PDF展示:';
    controlLabel.style.cssText = 'font-size: 10px; color: #6c757d; font-weight: 500; margin-top: 4px;';
    toolbar.appendChild(controlLabel);

    const controlRow = doc.createElement('div');
    controlRow.style.cssText = 'display: flex; gap: 4px;';
    
    // 展示在PDF按钮(切换型)
    const showInPdfBtn = doc.createElement('button');
    showInPdfBtn.id = 'show-in-pdf-btn';
    showInPdfBtn.textContent = '📍 展示在PDF';
    showInPdfBtn.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      background: white;
      color: #495057;
      font-size: 10px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    showInPdfBtn.addEventListener('click', async () => {
      const isActive = showInPdfBtn.style.background === 'rgb(0, 123, 255)';
      if (isActive) {
        // 清除PDF中的共享标注高亮
        showInPdfBtn.style.background = 'white';
        showInPdfBtn.style.color = '#495057';
        showInPdfBtn.textContent = '📍 展示在PDF';
        logger.log('[SidebarSharedView] Hide shared annotations from PDF');
        
        const pdfManager = await this.getPDFReaderManager();
        if (pdfManager) {
          pdfManager.clearAllHighlights();
        }
      } else {
        // 展示当前筛选后的共享标注到PDF
        showInPdfBtn.style.background = '#007bff';
        showInPdfBtn.style.color = 'white';
        showInPdfBtn.textContent = '✅ 已展示';
        logger.log('[SidebarSharedView] Show shared annotations in PDF');
        
        await this.handleShowInPdf(doc);
      }
    });
    controlRow.appendChild(showInPdfBtn);

    // 显示/隐藏本地标注按钮(切换型)
    // 初始状态：本地标注显示（Zotero默认），按钮显示"🙈 隐藏本地"（白色 = 正常状态）
    const toggleLocalBtn = doc.createElement('button');
    toggleLocalBtn.id = 'toggle-local-btn';
    toggleLocalBtn.textContent = '🙈 隐藏本地';
    toggleLocalBtn.style.cssText = `
      flex: 1;
      padding: 6px 8px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      background: white;
      color: #495057;
      font-size: 10px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    
    // 用data属性标记当前状态（true=显示，false=隐藏）
    toggleLocalBtn.setAttribute('data-showing', 'true');
    
    toggleLocalBtn.addEventListener('click', async () => {
      const isCurrentlyShowing = toggleLocalBtn.getAttribute('data-showing') === 'true';
      
      // 获取reader
      const docId = (doc as any).__researchopia_doc_id;
      const reader = docId ? this.readerCache.get(docId) : null;
      if (!reader) {
        logger.error('[SidebarSharedView] Cannot find reader for toggle local annotations');
        return;
      }
      
      const pdfManager = await this.getPDFReaderManager();
      if (!pdfManager) {
        logger.error('[SidebarSharedView] PDFReaderManager not available');
        return;
      }
      
      if (isCurrentlyShowing) {
        // 当前显示 → 点击后隐藏
        pdfManager.toggleNativeAnnotations(reader, true); // true = hide
        toggleLocalBtn.style.background = '#007bff';
        toggleLocalBtn.style.color = 'white';
        toggleLocalBtn.textContent = '✅ 已隐藏本地';
        toggleLocalBtn.setAttribute('data-showing', 'false');
        logger.log('[SidebarSharedView] Hide local annotations');
      } else {
        // 当前隐藏 → 点击后显示
        pdfManager.toggleNativeAnnotations(reader, false); // false = show
        toggleLocalBtn.style.background = 'white';
        toggleLocalBtn.style.color = '#495057';
        toggleLocalBtn.textContent = '🙈 隐藏本地';
        toggleLocalBtn.setAttribute('data-showing', 'true');
        logger.log('[SidebarSharedView] Show local annotations');
      }
    });
    controlRow.appendChild(toggleLocalBtn);

    toolbar.appendChild(controlRow);

    return toolbar;
  }

  /**
   * 创建按钮组的辅助方法
   */
  private createButtonGroup(
    doc: Document,
    container: HTMLElement,
    options: Array<{ value: string; label: string; default?: boolean }>,
    className: string,
    hasDefault: boolean,
    onClick: (value: string) => void
  ): void {
    options.forEach((opt) => {
      const btn = doc.createElement('button');
      btn.className = className;
      btn.dataset.value = opt.value;
      btn.textContent = opt.label;
      const isActive = hasDefault && opt.default;
      btn.style.cssText = `
        flex: 1;
        padding: 6px 8px;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        background: ${isActive ? '#007bff' : 'white'};
        color: ${isActive ? 'white' : '#495057'};
        font-size: 10px;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      `;

      btn.addEventListener('click', () => {
        // 🔥 修复: 更新整个文档中同类按钮的样式 (跨行互斥)
        doc.querySelectorAll(`.${className}`).forEach(b => {
          (b as HTMLButtonElement).style.background = 'white';
          (b as HTMLButtonElement).style.color = '#495057';
        });
        btn.style.background = '#007bff';
        btn.style.color = 'white';

        onClick(opt.value);
      });

      container.appendChild(btn);
    });
  }

  /**
   * 处理排序变化
   */
  private async handleSortChange(doc: Document, sortType: string): Promise<void> {
    logger.log(`[SidebarSharedView] Sort changed to: ${sortType}`);
    
    // 获取当前筛选
    const activeFilter = doc.querySelector('.filter-btn[style*="rgb(0, 123, 255)"]') as HTMLButtonElement;
    const filterType = activeFilter?.dataset.value || 'all';
    logger.log(`[SidebarSharedView] Current active filter: ${filterType}`);
    
    await this.applyFilterSort(doc, sortType, filterType);
  }

  /**
   * 处理筛选变化
   */
  private async handleFilterChange(doc: Document, filterType: string): Promise<void> {
    logger.log(`[SidebarSharedView] Filter changed to: ${filterType}`);
    
    // 获取当前排序
    const activeSort = doc.querySelector('.sort-btn[style*="rgb(0, 123, 255)"]') as HTMLButtonElement;
    const sortType = activeSort?.dataset.value || 'time-desc';
    logger.log(`[SidebarSharedView] Current active sort: ${sortType}`);
    
    await this.applyFilterSort(doc, sortType, filterType);
  }

  /**
   * 应用筛选和排序
   */
  private async applyFilterSort(
    doc: Document,
    sortType: string,
    filterType: string
  ): Promise<void> {
    try {
      // 使用保存的reader引用
      if (!this.currentReader) {
        logger.error('[SidebarSharedView] No current reader available for filter/sort');
        return;
      }
      
      logger.log(`[SidebarSharedView] Applying filter/sort: ${filterType} / ${sortType}`);
      
      // 重新加载并应用筛选排序
      await this.loadAnnotations(this.currentReader, doc, { sort: sortType, filter: filterType });
    } catch (error) {
      logger.error('[SidebarSharedView] Error applying filter/sort:', error);
    }
  }



  /**
   * 渲染评论节点 (完整复用 sessionAnnotationsView.ts:2131-2305)
   */
  private renderCommentNode(
    comment: any,
    depth: number,
    doc: Document,
    currentUserId: string,
    annotationId: string,
    cardElement: HTMLElement
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
      this.toggleReplyBox(container, comment, annotationId, currentUserId, cardElement);
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
        color: #0d6efd;
        border: 1px solid currentColor;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
      `;
      editBtn.addEventListener("click", () => {
        this.toggleEditMode(commentBody, comment, cardElement, annotationId, currentUserId);
      });
      actions.appendChild(editBtn);
    }

    if (canDelete) {
      const deleteBtn = doc.createElement("button");
      deleteBtn.textContent = isAdmin && !isOwnComment ? "删除(管理员)" : "删除";
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
          await this.handleDeleteComment(comment.id, cardElement, annotationId, currentUserId);
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
          cardElement
        );
        container.appendChild(childNode);
      });
    }

    return container;
  }

  /**
   * 切换回复框显示 (复用 sessionAnnotationsView.ts:2319-2434)
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

    if (replyBoxContainer.style.display !== "none") {
      replyBoxContainer.style.display = "none";
      replyBoxContainer.innerHTML = "";
      return;
    }

    replyBoxContainer.innerHTML = "";
    replyBoxContainer.style.cssText =
      "display: flex; flex-direction: column; gap: 8px; margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 3px;";

    const textarea = doc.createElement("textarea");
    const { name: parentDisplayName } = resolveCommentDisplayInfo(parentComment);
    textarea.placeholder = `回复 @${parentDisplayName}...`;
    textarea.style.cssText = `
      padding: 6px;
      border: 1px solid #e9ecef;
      border-radius: 3px;
      font-size: 12px;
      font-family: inherit;
      resize: vertical;
      min-height: 50px;
      background: #ffffff;
      color: #212529;
    `;

    const anonymousContainer = doc.createElement("div");
    anonymousContainer.style.cssText =
      "display: flex; align-items: center; gap: 8px; font-size: 11px; color: #6c757d;";

    const anonymousSwitch = createToggleSwitch(
      doc,
      `anonymous-reply-${parentComment.id}`,
      false,
      "#8b5cf6"
    );

    const anonymousLabel = doc.createElement("label");
    anonymousLabel.htmlFor = `anonymous-reply-${parentComment.id}`;
    anonymousLabel.textContent = '匿名回复（将显示为"匿名用户"）';
    anonymousLabel.style.cssText = "cursor: pointer; user-select: none;";

    anonymousContainer.appendChild(anonymousSwitch);
    anonymousContainer.appendChild(anonymousLabel);

    const buttonGroup = doc.createElement("div");
    buttonGroup.style.cssText = "display: flex; gap: 8px; justify-content: flex-end;";

    const submitBtn = doc.createElement("button");
    submitBtn.textContent = "发送";
    submitBtn.style.cssText = `
      padding: 4px 12px;
      background: #0d6efd;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    submitBtn.addEventListener("click", async () => {
      const content = textarea.value.trim();
      if (!content) return;

      try {
        const switchCheckbox = anonymousSwitch.querySelector('input[type="checkbox"]') as HTMLInputElement;
        const isAnonymous = switchCheckbox ? switchCheckbox.checked : false;

        await this.supabaseManager.replyToAnnotationComment(
          annotationId,
          parentComment.id,
          currentUserId,
          content,
          isAnonymous
        );

        const section = cardElement.querySelector(".comments-section") as HTMLElement | null;
        if (section) {
          cardElement.removeChild(section);
          await this.showCommentsSection(cardElement, annotationId, currentUserId);
        }
      } catch (error) {
        logger.error("[SidebarSharedView] Error replying to comment:", error);
      }
    });

    const cancelBtn = doc.createElement("button");
    cancelBtn.textContent = "取消";
    cancelBtn.style.cssText = `
      padding: 4px 12px;
      background: #9ca3af;
      color: #212529;
      border: 1px solid #e9ecef;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    cancelBtn.addEventListener("click", () => {
      replyBoxContainer.style.display = "none";
      replyBoxContainer.innerHTML = "";
    });

    buttonGroup.appendChild(cancelBtn);
    buttonGroup.appendChild(submitBtn);
    replyBoxContainer.appendChild(textarea);
    replyBoxContainer.appendChild(anonymousContainer);
    replyBoxContainer.appendChild(buttonGroup);

    textarea.focus();
  }

  /**
   * 切换编辑模式 (复用 sessionAnnotationsView.ts:2443-2545)
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

    if (bodyEl.classList.contains("editing")) {
      bodyEl.classList.remove("editing");
      contentDiv.textContent = comment.content;
      const editForm = bodyEl.querySelector(".edit-form");
      if (editForm) editForm.remove();
      return;
    }

    bodyEl.classList.add("editing");
    const originalContent = comment.content;

    const editForm = doc.createElement("div");
    editForm.className = "edit-form";
    editForm.style.cssText = "margin-top: 8px;";

    const textarea = doc.createElement("textarea");
    textarea.value = originalContent;
    textarea.style.cssText = `
      width: 100%;
      padding: 6px;
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
    anonymousContainer.style.cssText = "display: flex; align-items: center; gap: 8px; margin-top: 6px;";

    // 获取当前评论的匿名状态
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
    anonymousLabel.style.cssText = "font-size: 11px; color: #6c757d; cursor: pointer;";

    anonymousContainer.appendChild(anonymousSwitch);
    anonymousContainer.appendChild(anonymousLabel);

    const buttonGroup = doc.createElement("div");
    buttonGroup.style.cssText = "display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;";

    const saveBtn = doc.createElement("button");
    saveBtn.textContent = "保存";
    saveBtn.style.cssText = `
      padding: 4px 12px;
      background: #0d6efd;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    saveBtn.addEventListener("click", async () => {
      const newContent = textarea.value.trim();
      if (!newContent) return;

      try {
        const switchCheckbox = anonymousSwitch.querySelector('input[type="checkbox"]') as HTMLInputElement;
        const isAnonymous = switchCheckbox ? switchCheckbox.checked : false;

        await this.supabaseManager.updateComment(comment.id, newContent, isAnonymous);

        // 重新加载评论区以反映匿名状态变化 (用户名显示由 resolveCommentDisplayInfo 在 renderCommentNode 时决定)
        const commentsSection = cardElement.querySelector(".comments-section") as HTMLElement;
        if (commentsSection) {
          cardElement.removeChild(commentsSection);
        }
        
        const currentUser = AuthManager.getCurrentUser();
        const currentUserId = currentUser?.id || '';
        const annotationId = cardElement.getAttribute("data-annotation-id") || '';
        
        await this.showCommentsSection(cardElement, annotationId, currentUserId);
      } catch (error) {
        logger.error("[SidebarSharedView] Error updating comment:", error);
      }
    });

    const cancelBtn = doc.createElement("button");
    cancelBtn.textContent = "取消";
    cancelBtn.style.cssText = `
      padding: 4px 12px;
      background: #9ca3af;
      color: #212529;
      border: 1px solid #e9ecef;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    cancelBtn.addEventListener("click", () => {
      bodyEl.classList.remove("editing");
      contentDiv.textContent = originalContent;
      editForm.remove();
    });

    buttonGroup.appendChild(cancelBtn);
    buttonGroup.appendChild(saveBtn);
    editForm.appendChild(textarea);
    editForm.appendChild(anonymousContainer);
    editForm.appendChild(buttonGroup);
    contentDiv.after(editForm);

    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
  }

  /**
   * 删除评论 (复用 sessionAnnotationsView.ts:2589-2639)
   */
  private async handleDeleteComment(
    commentId: string,
    cardElement: HTMLElement,
    annotationId: string,
    currentUserId: string
  ): Promise<void> {
    try {
      await this.supabaseManager.deleteComment(commentId);

      const section = cardElement.querySelector(".comments-section") as HTMLElement | null;
      if (section) {
        const commentTree = await this.supabaseManager.getAnnotationCommentTree(annotationId);
        const commentsList = section.querySelector(".comments-tree") as HTMLElement | null;
        if (commentsList) {
          commentsList.innerHTML = "";

          const countAllComments = (comments: any[]): number =>
            comments.reduce(
              (total, c) => total + 1 + (c.children ? countAllComments(c.children) : 0),
              0
            );
          const totalComments = countAllComments(commentTree);

          commentTree.forEach((rootComment: any) => {
            const commentNode = this.renderCommentNode(
              rootComment,
              0,
              cardElement.ownerDocument,
              currentUserId,
              annotationId,
              cardElement
            );
            commentsList.appendChild(commentNode);
          });

          const commentButton = cardElement.querySelector(
            "button[data-comment-button]"
          ) as HTMLButtonElement | null;
          if (commentButton) {
            commentButton.innerHTML = `💬 ${totalComments}`;
          }
        }
      }
    } catch (error) {
      logger.error("[SidebarSharedView] Error deleting comment:", error);
    }
  }

  /**
   * 获取PDFReaderManager实例 (懒加载)
   */
  private async getPDFReaderManager(): Promise<any | null> {
    if (this.pdfReaderManager) {
      return this.pdfReaderManager;
    }
    
    // 从全局Zotero对象获取
    const addon = (Zotero as any).Researchopia;
    if (addon?._pdfReaderManager) {
      this.pdfReaderManager = addon._pdfReaderManager;
      return this.pdfReaderManager;
    }
    
    // 动态导入并初始化
    try {
      const { PDFReaderManager } = await import('../pdf');
      const manager = PDFReaderManager.getInstance();
      await manager.initialize();
      if (addon) {
        addon._pdfReaderManager = manager;
      }
      this.pdfReaderManager = manager;
      return manager;
    } catch (error) {
      logger.error('[SidebarSharedView] Failed to load PDFReaderManager:', error);
      return null;
    }
  }

  // ============ 辅助方法 ============

  /**
   * 显示空状态
   */
  private showEmptyState(doc: Document, message: string): void {
    const container = doc.getElementById('shared-annotations-list-container');
    if (!container) return;
    
    container.innerHTML = `
      <div style="text-align: center; color: #999; margin-top: 60px;">
        <div style="font-size: 48px;">📭</div>
        <div style="margin-top: 12px; font-size: 14px;">${message}</div>
      </div>
    `;
  }

  /**
   * 显示错误状态
   */
  private showErrorState(doc: Document, message: string): void {
    const container = doc.getElementById('shared-annotations-list-container');
    if (!container) return;
    
    container.innerHTML = `
      <div style="text-align: center; color: #f44336; margin-top: 60px;">
        <div style="font-size: 48px;">⚠️</div>
        <div style="margin-top: 12px; font-size: 14px;">${message}</div>
      </div>
    `;
  }

  /**
   * 为用户生成颜色
   */
  private getColorForUser(userId: string): string {
    const colors = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336', '#00BCD4'];
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  /**
   * 处理"展示在PDF"按钮点击 - 将当前筛选后的共享标注显示在PDF中
   * 参考 sessionAnnotationsView.ts:1415-1569
   */
  private async handleShowInPdf(doc: Document): Promise<void> {
    try {
      logger.log('[SidebarSharedView] Handling show in PDF');
      
      // 1. 获取reader
      const docId = (doc as any).__researchopia_doc_id;
      logger.log(`[SidebarSharedView] docId: ${docId}, has cache: ${this.readerCache.has(docId)}`);
      const reader = docId ? this.readerCache.get(docId) : null;
      if (!reader) {
        logger.error('[SidebarSharedView] Cannot find reader');
        return;
      }
      
      // 🔥 关键修复：使用 reader.tabID 作为 key，与保存时保持一致
      const readerId = reader.tabID;
      logger.log(`[SidebarSharedView] readerId: ${readerId}`);
      
      // 2. 获取当前标注列表
      logger.log(`[SidebarSharedView] currentAnnotations Map size: ${this.currentAnnotations.size}`);
      logger.log(`[SidebarSharedView] currentAnnotations keys: ${Array.from(this.currentAnnotations.keys()).join(', ')}`);
      const annotations = this.currentAnnotations.get(readerId);
      logger.log(`[SidebarSharedView] annotations for ${readerId}: ${annotations ? annotations.length : 'undefined'}`);
      if (!annotations || annotations.length === 0) {
        logger.warn('[SidebarSharedView] No annotations to display');
        return;
      }
      
      // 3. 获取PDFReaderManager
      const pdfManager = await this.getPDFReaderManager();
      if (!pdfManager) {
        logger.error('[SidebarSharedView] PDFReaderManager not available');
        return;
      }
      
      logger.log(`[SidebarSharedView] Displaying ${annotations.length} annotations in PDF`);
      
      // 4. 转换为共享标注格式 (参考 sessionAnnotationsView.ts:1521-1553)
      const sharedAnnotations = annotations.map((ann: any, index: number) => {
        // 🔥 关键修复：position 字段在根层级，不在 annotation_data 里
        let position = ann.position;
        if (typeof position === 'string') {
          try {
            position = JSON.parse(position);
          } catch (e) {
            position = null;
          }
        }
        
        // 如果没有有效position,使用page_number构造
        if (!position || typeof position.pageIndex !== 'number') {
          position = ann.page_number ? { pageIndex: ann.page_number - 1 } : null;
        }
        
        return {
          id: ann.id,
          type: ann.type || 'highlight',
          content: ann.content || '',
          comment: ann.comment,
          color: ann.color || '#ffd400',
          position: position,
          username: ann.user?.username || ann.user?.email || '未知用户',
          user_id: ann.user_id,
          visibility: ann.visibility, // 🔥 传递 visibility 字段
          show_author_name: true,
          created_at: ann.created_at
        };
      }).filter((ann: any) => ann.position && typeof ann.position.pageIndex === 'number');
      
      logger.log(`[SidebarSharedView] Filtered to ${sharedAnnotations.length} valid annotations`);
      
      // 5. 调用PDFReaderManager显示标注，并传递反向导航回调
      const result = await pdfManager.highlightMultipleAnnotations(reader, sharedAnnotations, {
        onCardNavigation: (annotationId: string, pdfDoc: Document) => {
          // 🔥 反向导航：点击PDF图层时，滚动到对应卡片
          this.scrollToAndHighlightCard(annotationId, doc); // 注意使用sidebar的doc，不是PDF的doc
        }
      });
      
      logger.log(`[SidebarSharedView] Successfully displayed ${result.success} annotations${result.failed > 0 ? `, ${result.failed} failed` : ''}`);
    } catch (error) {
      logger.error('[SidebarSharedView] Error handling show in PDF:', error);
    }
  }

  /**
   * 获取高亮颜色
   */
  private getHighlightColor(color?: string): string {
    const colorMap: Record<string, string> = {
      'yellow': '#FFEB3B',
      'red': '#F44336',
      'green': '#4CAF50',
      'blue': '#2196F3',
      'purple': '#9C27B0'
    };
    return color ? (colorMap[color] || '#FFEB3B') : '#FFEB3B';
  }

  /**
   * 格式化时间戳
   */
  private formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  }
}
