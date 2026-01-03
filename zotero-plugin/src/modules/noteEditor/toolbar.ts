/**
 * Editor Toolbar Integration
 * 在笔记编辑器toolbar中注入自定义搜索按钮
 * Based on zotero-better-notes implementation
 */

import { logger } from "../../utils/logger";
import { getPref } from "../../utils/prefs";
import { SearchManager } from "./search/manager";
import { initLineNumbers, removeLineNumbers } from "./enhancements/lineNumbers";
import { initWordCount, removeWordCount } from "./enhancements/wordCount";
import { initColorPicker, removeColorPicker } from "./enhancements/colorPicker";
import { registerEditorForScrollPreservation as _registerEditorForScrollPreservation } from "./enhancements/scrollPreserver";

/**
 * Register a noteEditor element for scroll preservation
 * This wraps the ScrollPreserver singleton method
 */
function registerEditorForScrollPreservation(noteEditor: any): void {
  _registerEditorForScrollPreservation(noteEditor);
}

// 跟踪已初始化的编辑器，避免重复初始化
const initializedEditors = new WeakSet<Zotero.EditorInstance>();

// 跟踪每个编辑器的当前 note ID，用于检测 note 切换
const editorNoteIdMap = new WeakMap<Zotero.EditorInstance, number>();

/**
 * 获取编辑器当前的 note item ID
 */
function getNoteItemId(editor: Zotero.EditorInstance): number | null {
  try {
    return (editor as any).itemID || (editor as any)._item?.id || null;
  } catch {
    return null;
  }
}

/**
 * Get the noteEditor XUL element from an EditorInstance
 * 
 * STRATEGY (Priority Order):
 * 1. Use EditorInstance._iframeWindow to find the containing noteEditor (MOST RELIABLE)
 * 2. Fall back to searching by _editorInstance reference match
 * 3. Fall back to itemID match (least accurate - may match wrong window)
 * 
 * Key Challenge: Multiple windows can have noteEditors for the SAME itemID!
 * - Item Pane noteEditor (main window)
 * - Separate Window noteEditor (standalone window)
 * These are DIFFERENT noteEditor XUL elements but share the same itemID.
 * 
 * WHY _iframeWindow.frameElement works:
 * - Each EditorInstance has a unique _iframeWindow (the iframe's contentWindow)
 * - iframe.frameElement is the <iframe> DOM element
 * - iframe's parent is inside the noteEditor XUL element
 * - This method ALWAYS finds the correct noteEditor, regardless of timing!
 */
function getNoteEditorElement(editor: Zotero.EditorInstance): any | null {
  try {
    const editorAny = editor as any;
    const instanceID = editor.instanceID;

    // Method 1 (BEST): Use _iframeWindow.frameElement to find containing noteEditor
    // This is the most reliable method because:
    // - Each EditorInstance owns a unique iframe
    // - iframe.frameElement.closest('note-editor') finds the exact parent noteEditor
    // - Works regardless of when _editorInstance was assigned
    const iframeWindow = editorAny._iframeWindow;
    logger.log(`[EditorToolbar] 🔍 Method 1: _iframeWindow exists: ${!!iframeWindow}, frameElement: ${!!iframeWindow?.frameElement}`);
    
    if (iframeWindow?.frameElement) {
      // The iframe is inside the noteEditor XUL element
      // Structure: <note-editor> -> <box> -> <div#note-editor> -> <iframe#editor-view>
      const iframe = iframeWindow.frameElement;
      logger.log(`[EditorToolbar] 🔍 iframe tagName: ${iframe.tagName}, id: ${iframe.id}, parentElement: ${iframe.parentElement?.tagName}`);
      
      // Try closest() first (works if noteEditor is in the same document)
      let noteEditor = iframe.closest?.('note-editor');
      logger.log(`[EditorToolbar] 🔍 closest('note-editor') result: ${!!noteEditor}`);
      
      // If closest() doesn't work, traverse up manually through DOM
      if (!noteEditor) {
        let parent = iframe.parentElement;
        let maxDepth = 10; // Prevent infinite loops
        let depth = 0;
        while (parent && maxDepth-- > 0) {
          depth++;
          logger.log(`[EditorToolbar] 🔍 Traversing depth ${depth}: ${parent.tagName || parent.localName || parent.nodeName}`);
          if (parent.tagName?.toLowerCase() === 'note-editor' || 
              parent.localName === 'note-editor') {
            noteEditor = parent;
            break;
          }
          parent = parent.parentElement;
        }
      }
      
      if (noteEditor) {
        logger.log(`[EditorToolbar] ✅ Found noteEditor via _iframeWindow.frameElement (instanceID: ${instanceID})`);
        return noteEditor;
      } else {
        logger.warn(`[EditorToolbar] ⚠️ iframe.frameElement exists but couldn't find parent noteEditor`);
      }
    }

    // Method 2: Try direct _noteEditor reference (if available)
    if (editorAny._noteEditor) {
      logger.log(`[EditorToolbar] Found noteEditor via _noteEditor reference`);
      return editorAny._noteEditor;
    }

    // Method 3: Global DOM search as fallback
    const itemID = editorAny._item?.id;
    
    if (!itemID) {
      logger.warn("[EditorToolbar] Cannot search: editor._item.id is undefined");
      return null;
    }
    logger.log(`[EditorToolbar] Searching for note-editor with itemID: ${itemID}, instanceID: ${instanceID}`);

    const allCandidates: { noteEditor: any; isExactMatch: boolean; windowType: string }[] = [];

    // Search in standalone note windows FIRST (they are more specific)
    const noteWindows = ((Zotero as any).Notes?.getWindows?.() || []) as any[];
    for (const noteWin of noteWindows) {
      if (!noteWin?.document) continue;
      const noteEditors = noteWin.document.querySelectorAll('note-editor');
      for (const ne of Array.from(noteEditors)) {
        const noteEditor = ne as any;
        if (noteEditor._editorInstance === editor) {
          logger.log(`[EditorToolbar] ✅ Found note-editor in standalone window (EXACT match by editorInstance)`);
          return noteEditor;
        }
        if (noteEditor._item?.id === itemID) {
          allCandidates.push({ noteEditor, isExactMatch: false, windowType: 'standalone' });
        }
      }
    }

    // Search in main windows
    const windows = (Zotero as any).getMainWindows() as Window[];
    for (const win of windows) {
      const noteEditors = win.document.querySelectorAll('note-editor');
      for (const ne of Array.from(noteEditors)) {
        const noteEditor = ne as any;
        if (noteEditor._editorInstance === editor) {
          logger.log(`[EditorToolbar] ✅ Found note-editor in main window (EXACT match by editorInstance)`);
          return noteEditor;
        }
        if (noteEditor._item?.id === itemID) {
          allCandidates.push({ noteEditor, isExactMatch: false, windowType: 'main' });
        }
      }
    }

    // Fall back to itemID match if no exact match found
    if (allCandidates.length > 0) {
      const best = allCandidates[0];
      logger.warn(`[EditorToolbar] ⚠️ Fallback: using itemID match in ${best.windowType} window (instanceID: ${instanceID})`);
      return best.noteEditor;
    }

    logger.warn(`[EditorToolbar] ❌ No note-editor found for itemID: ${itemID}`);
    return null;
  } catch (error) {
    logger.error("[EditorToolbar] Error in getNoteEditorElement:", error);
    return null;
  }
}

/**
 * Find the native Find and Replace button in the toolbar
 * Uses multiple strategies to work with different Zotero localizations
 */
function findNativeFindButton(toolbar: HTMLElement): HTMLElement | null {
  // Strategy 1: Try common title attributes (English and Chinese)
  const titleSelectors = [
    'button[title="Find and Replace"]',
    'button[title="查找和替换"]',  // Chinese
    'button[title="Buscar y reemplazar"]',  // Spanish
    'button[title="Suchen und Ersetzen"]',  // German
    'button[title="Rechercher et remplacer"]',  // French
  ];
  
  for (const selector of titleSelectors) {
    const btn = toolbar.querySelector(selector) as HTMLElement;
    if (btn) return btn;
  }
  
  // Strategy 2: Find by SVG icon pattern (search icon)
  // The native find button has a magnifying glass icon
  const buttons = toolbar.querySelectorAll('button.toolbar-button');
  for (const btn of Array.from(buttons) as Element[]) {
    // Skip our custom search button
    if (btn.hasAttribute('data-researchopia-custom-search')) continue;
    
    // Check if it has a search icon SVG
    const svg = btn.querySelector('svg');
    if (svg) {
      const paths = svg.querySelectorAll('path');
      for (const path of Array.from(paths) as Element[]) {
        const d = path.getAttribute('d');
        // Look for magnifying glass icon pattern
        if (d && (d.includes('M11.742 10.344') || d.includes('search') || 
            // Another common pattern for find icon
            d.includes('M19.4 9a8') || d.includes('m21 21'))) {
          return btn as HTMLElement;
        }
      }
    }
  }
  
  // Strategy 3: Find by position - native find button is usually after certain buttons
  // and before the custom search button we added
  const toolbarMiddle = toolbar.querySelector('.middle');
  if (toolbarMiddle) {
    const allButtons = toolbarMiddle.querySelectorAll('button.toolbar-button:not([data-researchopia-custom-search])');
    // The find button is usually one of the last buttons in the middle section
    for (const btn of Array.from(allButtons) as Element[]) {
      const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
      const title = btn.getAttribute('title')?.toLowerCase() || '';
      if (ariaLabel.includes('find') || ariaLabel.includes('search') || 
          ariaLabel.includes('查找') || ariaLabel.includes('替换') ||
          title.includes('find') || title.includes('search') ||
          title.includes('查找') || title.includes('替换')) {
        return btn as HTMLElement;
      }
    }
  }
  
  return null;
}

/**
 * 初始化编辑器工具栏
 * @param editor - Zotero编辑器实例 (可选，如果不传则更新所有编辑器)
 */
export async function initEditorToolbar(editor?: Zotero.EditorInstance) {
  // 如果没有传入 editor，则更新所有已打开编辑器的工具栏状态
  if (!editor) {
    // 从已注册的编辑器中获取
    const searchManager = SearchManager.getInstance();
    const editors = (searchManager as any).editors as WeakMap<Zotero.EditorInstance, any>;
    // 注意：WeakMap 无法遍历，所以我们通过 Zotero.Notes 获取所有编辑器
    try {
      const allEditors = (Zotero as any).Notes?._editorInstances as Zotero.EditorInstance[] || [];
      for (const ed of allEditors) {
        if (ed && ed._iframeWindow?.document) {
          await updateEditorToolbarState(ed);
        }
      }
    } catch (error) {
      logger.warn("[EditorToolbar] Could not iterate editors:", error);
    }
    return;
  }

  // Initializing toolbar silently

  // Skip if UI disabled
  if ((editor as any)._disableUI) {
    logger.log("[EditorToolbar] UI disabled, skipping");
    return;
  }

  try {
    // 等待编辑器初始化完成
    await editor._initPromise;
    // Editor initialized

    const _document = editor._iframeWindow?.document;
    if (!_document) {
      logger.warn("[EditorToolbar] No iframe document");
      return;
    }
    
    // 等待toolbar元素出现
    let toolbar: HTMLDivElement | null = null;
    for (let i = 0; i < 20; i++) {
      toolbar = _document.querySelector(".toolbar") as HTMLDivElement;
      if (toolbar) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!toolbar) {
      logger.warn("[EditorToolbar] ❌ Toolbar not found after 2 seconds");
      return;
    }

    // Toolbar found

    // 根据偏好设置决定是否添加自定义搜索按钮
    const customSearchEnabled = getPref("customSearch");
    // 默认为 true（undefined 时也启用）
    
    // 原生搜索按钮与自定义搜索按钮完全绑定：
    // 启用自定义搜索 = 隐藏原生搜索按钮
    // 禁用自定义搜索 = 显示原生搜索按钮
    const nativeFindButton = findNativeFindButton(toolbar);
    if (nativeFindButton) {
      nativeFindButton.style.display = (customSearchEnabled !== false) ? 'none' : '';
    }

    if (customSearchEnabled !== false) {
      // Use CustomSearchManager to register toolbar button (like better-notes)
      const manager = SearchManager.getInstance();
      if (typeof (manager as any).registerToolbarButton === 'function') {
        (manager as any).registerToolbarButton(editor, toolbar);
        // Button registered
      } else {
        // Fallback: directly create button
        createSearchButton(editor, toolbar, _document);
      }
    }

    // Initialize line numbers based on preference
    const lineNumbersEnabled = getPref("lineNumbers");
    if (lineNumbersEnabled !== false) {
      await initLineNumbers(editor);
      // Line numbers initialized
    } else {
      removeLineNumbers(editor);
    }

    // Initialize color picker enhancement based on preference
    const colorPickerEnabled = getPref("colorPicker");
    if (colorPickerEnabled !== false) {
      await initColorPicker(editor);
      // Color picker initialized
    } else {
      removeColorPicker(editor);
    }

    // Register noteEditor element for scroll position preservation (multi-window editing support)
    // CRITICAL: Must patch BEFORE initEditor is called (happens during noteEditor.item = xxx)
    // Strategy: Find noteEditor immediately and patch its initEditor method
    // Only register if scrollPreserver is enabled
    const scrollPreserverEnabled = getPref("scrollPreserver");
    if (scrollPreserverEnabled !== false) {
      try {
        // Try to find noteEditor element immediately (before _initPromise resolves)
        const noteEditor = getNoteEditorElement(editor);
        if (noteEditor) {
          // Patch initEditor IMMEDIATELY before it's called
          registerEditorForScrollPreservation(noteEditor);
          logger.log(`[EditorToolbar] ✅ Patched noteEditor.initEditor BEFORE first call (item: ${noteEditor._item?.id})`);
        } else {
          // Fallback: wait for init and try again
          logger.warn("[EditorToolbar] Could not find noteEditor immediately, waiting for init...");
          editor._initPromise?.then(() => {
            const noteEditorDelayed = getNoteEditorElement(editor);
            if (noteEditorDelayed) {
              registerEditorForScrollPreservation(noteEditorDelayed);
              logger.log(`[EditorToolbar] ⚠️ Patched noteEditor.initEditor AFTER init (item: ${noteEditorDelayed._item?.id})`);
            } else {
              logger.error("[EditorToolbar] ❌ Could not find noteEditor even after init");
            }
          }).catch((error: Error) => {
            logger.error("[EditorToolbar] Error waiting for editor init:", error);
          });
        }
      } catch (error) {
        logger.warn("[EditorToolbar] Could not set up noteEditor registration:", error);
      }
    }

    // 根据偏好设置决定是否启用统计功能
    const wordCountEnabled = getPref("wordCount");
    // 默认为 true（undefined 时也启用）
    if (wordCountEnabled !== false) {
      await initWordCount(editor);
      // Word count initialized
    } else {
      // 如果禁用，移除现有的统计栏
      removeWordCount(editor);
    }

    // 标记此编辑器已初始化
    initializedEditors.add(editor);
    
    // 记录当前 note ID
    const currentNoteId = getNoteItemId(editor);
    if (currentNoteId !== null) {
      editorNoteIdMap.set(editor, currentNoteId);
      logger.log("[EditorToolbar] Initial note ID:", currentNoteId);
    }

    // Check and restore findbar state for this note (handles note switching)
    if (customSearchEnabled !== false && currentNoteId !== null) {
      const manager = SearchManager.getInstance();
      if (typeof (manager as any).checkAndRestoreFindbarState === 'function') {
        const restored = (manager as any).checkAndRestoreFindbarState(editor);
        if (restored) {
          logger.log(`[EditorToolbar] Auto-restored findbar for note ${currentNoteId}`);
        }
      }
    }

    // Monitor parent container for toolbar replacement (item pane note switching)
    const MutationObserver = (editor._iframeWindow as any)?.MutationObserver as typeof window.MutationObserver;
    if (MutationObserver) {
      const editorBody = _document.body;
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            // Check if note item has changed (editor reused for different note)
            const newNoteId = getNoteItemId(editor);
            const lastNoteId = editorNoteIdMap.get(editor);
            if (newNoteId !== null && lastNoteId !== undefined && newNoteId !== lastNoteId) {
              logger.log(`[EditorToolbar] Note changed from ${lastNoteId} to ${newNoteId}`);
              editorNoteIdMap.set(editor, newNoteId);
              // Notify SearchManager about note change
              const manager = SearchManager.getInstance();
              if (typeof (manager as any).notifyNoteItemChange === 'function') {
                (manager as any).notifyNoteItemChange(editor, newNoteId);
              }
            }
            
            // Check if toolbar was replaced
            const newToolbar = _document.querySelector(".toolbar") as HTMLDivElement;
            if (newToolbar && newToolbar !== toolbar) {
              // Toolbar replaced, re-registering
              
              // 根据偏好设置注册自定义搜索按钮（与原生搜索按钮完全绑定）
              const customEnabled = getPref("customSearch");
              const nativeFindBtn = findNativeFindButton(newToolbar);
              if (nativeFindBtn) {
                nativeFindBtn.style.display = (customEnabled !== false) ? 'none' : '';
              }
              
              if (customEnabled !== false) {
                const manager = SearchManager.getInstance();
                if (typeof (manager as any).registerToolbarButton === 'function') {
                  (manager as any).registerToolbarButton(editor, newToolbar);
                }
              }
              // Update toolbar reference
              toolbar = newToolbar;
              return;
            }
            
            // Check if button still exists in current toolbar
            if (toolbar) {
              // 原生搜索按钮与自定义搜索完全绑定
              const customEnabled = getPref("customSearch");
              const nativeFindBtn = findNativeFindButton(toolbar);
              if (nativeFindBtn) {
                const shouldHide = (customEnabled !== false) ? 'none' : '';
                if (nativeFindBtn.style.display !== shouldHide) {
                  nativeFindBtn.style.display = shouldHide;
                }
              }
              
              // Check custom button
              if (customEnabled !== false) {
                const toolbarMiddle = toolbar.querySelector('.middle');
                const buttonExists = toolbarMiddle?.querySelector('[data-researchopia-custom-search]');
                if (!buttonExists && toolbarMiddle) {
                  // Button missing, re-inserting
                  const manager = SearchManager.getInstance();
                  if (typeof (manager as any).registerToolbarButton === 'function') {
                    (manager as any).registerToolbarButton(editor, toolbar);
                  }
                }
              }
            }
          }
        });
      });
      observer.observe(editorBody, { childList: true, subtree: true });
      // Toolbar monitor installed
    }

  } catch (error) {
    logger.error("[EditorToolbar] ❌ Error initializing toolbar:", error);
  }
}

/**
 * 更新单个编辑器的工具栏状态（用于偏好设置变更时）
 */
async function updateEditorToolbarState(editor: Zotero.EditorInstance) {
  const _document = editor._iframeWindow?.document;
  if (!_document) return;

  const toolbar = _document.querySelector(".toolbar") as HTMLDivElement;
  if (!toolbar) return;

  logger.log("[EditorToolbar] Updating toolbar state for editor:", editor.instanceID);

  // 更新自定义搜索按钮和原生搜索按钮（完全绑定）
  const customSearchEnabled = getPref("customSearch");
  const nativeFindButton = findNativeFindButton(toolbar);
  const toolbarMiddle = toolbar.querySelector('.middle');
  const existingSearchBtn = toolbarMiddle?.querySelector('[data-researchopia-custom-search]');
  
  // 原生搜索按钮与自定义搜索完全绑定
  if (nativeFindButton) {
    nativeFindButton.style.display = (customSearchEnabled !== false) ? 'none' : '';
    logger.log("[EditorToolbar] Native search button display:", (customSearchEnabled !== false) ? 'hidden' : 'visible');
  }
  
  if (customSearchEnabled !== false) {
    // 应该显示自定义搜索按钮
    if (!existingSearchBtn && toolbarMiddle) {
      // 添加自定义搜索按钮
      const manager = SearchManager.getInstance();
      if (typeof (manager as any).registerToolbarButton === 'function') {
        (manager as any).registerToolbarButton(editor, toolbar);
        logger.log("[EditorToolbar] Custom search button added");
      }
    }
  } else {
    // 应该隐藏自定义搜索按钮
    if (existingSearchBtn) {
      existingSearchBtn.remove();
      logger.log("[EditorToolbar] Custom search button removed");
    }
  }

  // 更新统计功能
  const wordCountEnabled = getPref("wordCount");
  if (wordCountEnabled !== false) {
    await initWordCount(editor);
  } else {
    removeWordCount(editor);
  }

  // 更新行号功能
  const lineNumbersEnabled = getPref("lineNumbers");
  if (lineNumbersEnabled !== false) {
    await initLineNumbers(editor);
  } else {
    removeLineNumbers(editor);
  }

  // 更新颜色选择器功能
  const colorPickerEnabled = getPref("colorPicker");
  if (colorPickerEnabled !== false) {
    await initColorPicker(editor);
  } else {
    removeColorPicker(editor);
  }
}

/**
 * Fallback: directly create search button
 */
function createSearchButton(editor: Zotero.EditorInstance, toolbar: HTMLDivElement, doc: Document): void {
  const searchButton = doc.createElement("button");
  searchButton.className = "toolbar-button";
  searchButton.title = "自定义搜索 (Ctrl+Shift+F)";
  searchButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
    </svg>
  `;

  searchButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Search button clicked
    
    try {
      const searchManager = SearchManager.getInstance();
      searchManager.toggle(editor);
      // Search toggled
    } catch (error) {
      logger.error("[EditorToolbar] ❌ Error toggling search:", error);
    }
  });

  // Editor will be registered lazily when search is triggered

  // Insert button
  const toolbarStart = toolbar.querySelector(".start");
  if (toolbarStart) {
    toolbarStart.appendChild(searchButton);
    // Search button added (fallback)
  }
}
