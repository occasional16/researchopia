/**
 * Scroll Position Preserver for Note Editor
 * 
 * Fixes the issue where editing a note in one window causes other windows
 * with the same note open to jump to the first line.
 * 
 * Root Cause Analysis:
 * - Zotero's noteEditor element (XUL custom element) has a notify() method
 * - When item.modify event is triggered, noteEditor.notify() calls initEditor()
 * - initEditor() rebuilds the ProseMirror EditorCore, resetting scroll to 0
 * 
 * Solution (Inspired by zotero-better-notes PR #1463):
 * - DIRECTLY iterate all windows (main + standalone note windows)
 * - PATCH each noteEditor.initEditor() method found in those windows
 * - This works regardless of EditorInstance matching or iframe.frameElement issues
 * 
 * Key Insight:
 * - Multiple windows can have noteEditors for the SAME note item:
 *   1. Item Pane noteEditor (in main Zotero window)
 *   2. Separate Window noteEditor (standalone window via "Edit in a Separate Window")
 * - Each noteEditor is a SEPARATE XUL element in DIFFERENT windows
 * - We must patch BOTH noteEditors to preserve scroll in both when the other edits
 * 
 * @module noteEditor/enhancements/scrollPreserver
 */

import { logger } from "../../../utils/logger";

/**
 * Saved scroll AND selection state for a note editor element
 * Maps noteEditor XUL element to its complete state
 */
interface ScrollState {
  scrollTop: number;
  itemID: number;
  timestamp: number;  // When this was saved
  // ProseMirror selection state
  selectionFrom?: number;
  selectionTo?: number;
  selectionEmpty?: boolean;
}

/**
 * ScrollPreserver singleton class
 * Patches noteEditor.initEditor() to preserve scroll positions
 * 
 * Key Design:
 * - WeakMap to track scroll positions per noteEditor element
 * - Patch initEditor() to save scroll BEFORE and restore AFTER
 * - Periodic scan of ALL windows to find and patch new noteEditors
 */
export class ScrollPreserver {
  static _instance: ScrollPreserver | null = null;
  
  // Map: noteEditor element -> saved scroll position
  private scrollStates: WeakMap<any, ScrollState> = new WeakMap();
  
  // Track which noteEditor elements we've patched
  private patchedEditors: WeakSet<any> = new WeakSet();
  
  // Interval ID for periodic window scanning
  private scanIntervalId: ReturnType<typeof setInterval> | null = null;
  
  // Original initEditor method (stored for cleanup)
  private originalInitEditor: ((this: any, state?: any, reloaded?: boolean) => Promise<void>) | null = null;

  /**
   * Get singleton instance
   */
  static getInstance(): ScrollPreserver {
    if (!ScrollPreserver._instance) {
      ScrollPreserver._instance = new ScrollPreserver();
    }
    return ScrollPreserver._instance;
  }

  /**
   * Initialize the scroll preserver
   * Must be called once during plugin startup
   */
  init(): void {
    // Start periodic scanning for new noteEditors in all windows
    this.startWindowScanning();
  }
  
  /**
   * Start periodic scanning of all windows for new noteEditors
   * This catches newly opened standalone note windows and Better Notes windows
   */
  private startWindowScanning(): void {
    // Scan immediately on init
    this.scanAllWindowsForNoteEditors();
    
    // Then scan every 500ms to catch new windows
    this.scanIntervalId = setInterval(() => {
      this.scanAllWindowsForNoteEditors();
    }, 500);
  }
  
  /**
   * Stop the periodic window scanning
   */
  private stopWindowScanning(): void {
    if (this.scanIntervalId !== null) {
      clearInterval(this.scanIntervalId);
      this.scanIntervalId = null;
    }
  }
  
  /**
   * Scan ALL windows (main + standalone + better-notes) for noteEditor elements and patch them
   * This is the KEY method that ensures multi-window support works!
   * 
   * KEY DISCOVERY: In Zotero 8.0-beta, use Services.wm.getEnumerator to enumerate windows:
   * - 'zotero:note' for Zotero's native standalone note windows
   * - null for ALL windows (to catch Better Notes and other plugin windows)
   */
  private scanAllWindowsForNoteEditors(): void {
    try {
      let totalFound = 0;
      let newlyPatched = 0;
      let standaloneWindowCount = 0;
      let otherWindowCount = 0;
      
      const wm = (Services as any).wm;
      if (!wm) {
        logger.warn("[ScrollPreserver] ⚠️ Services.wm not available");
        return;
      }
      
      // 1. 🔥 CRITICAL: Scan ALL windows using null windowtype
      // This catches Better Notes workspace windows and any other plugin windows
      try {
        const enumerator = wm.getEnumerator(null); // null = all windows
        while (enumerator.hasMoreElements()) {
          const win = enumerator.getNext() as Window;
          
          if (!win?.document) continue;
          
          // Skip the main Zotero windows (we'll scan them separately)
          const docURI = win.document?.documentURI || '';
          const isMainZoteroWindow = docURI.includes('chrome://zotero/content/zoteroPane.xhtml');
          
          if (isMainZoteroWindow) continue;
          
          // Check if this is a standalone note window
          const isStandaloneNoteWindow = docURI.includes('chrome://zotero/content/note.xhtml');
          
          // Check if this is a Better Notes workspace window
          const isBetterNotesWindow = docURI.includes('chrome://betternotes/content/workspaceWindow.xhtml');
          
          // Find note-editor elements in this window
          const noteEditors = win.document.querySelectorAll('note-editor');
          for (const ne of Array.from(noteEditors)) {
            totalFound++;
            const noteEditor = ne as any;
            if (!this.patchedEditors.has(noteEditor)) {
              let windowType = 'other';
              if (isStandaloneNoteWindow) {
                windowType = 'standalone';
                standaloneWindowCount++;
              } else if (isBetterNotesWindow) {
                windowType = 'better-notes';
                otherWindowCount++;
              } else {
                otherWindowCount++;
              }
              this.patchNoteEditorInstance(noteEditor, windowType);
              newlyPatched++;
            }
          }
        }
      } catch (err) {
        logger.warn(`[ScrollPreserver] Error enumerating all windows: ${err}`);
      }
      
      // 2. Scan main Zotero windows
      const hasGetMainWindows = typeof (Zotero as any).getMainWindows === 'function';
      if (hasGetMainWindows) {
        const mainWindows = ((Zotero as any).getMainWindows() || []) as Window[];
        for (const win of mainWindows) {
          if (!win?.document) continue;
          const noteEditors = win.document.querySelectorAll('note-editor');
          for (const ne of Array.from(noteEditors)) {
            totalFound++;
            const noteEditor = ne as any;
            if (!this.patchedEditors.has(noteEditor)) {
              this.patchNoteEditorInstance(noteEditor, 'main');
              newlyPatched++;
            }
          }
        }
      }
      
      // Silent operation - no logging on scan
    } catch (error) {
      logger.warn(`[ScrollPreserver] Error during window scan: ${error}`);
    }
  }
  
  /**
   * Patch a single noteEditor instance's initEditor method
   * @param noteEditor - The noteEditor XUL element
   * @param windowType - 'main' or 'standalone' for logging
   */
  private patchNoteEditorInstance(noteEditor: any, windowType: string): void {
    // Verify this is a valid noteEditor element
    if (!noteEditor || !noteEditor.initEditor || typeof noteEditor.initEditor !== 'function') {
      logger.warn(`[ScrollPreserver] ⚠️ Invalid noteEditor in ${windowType} window - no initEditor method`);
      return;
    }

    // Check if this specific instance is already patched
    if (this.patchedEditors.has(noteEditor)) {
      return; // Already patched
    }
    
    // Save original instance method
    const original = noteEditor.initEditor.bind(noteEditor);
    const self = this;
    const itemId = noteEditor._item?.id || 'unknown';

    // Patch the INSTANCE method
    noteEditor.initEditor = async function(this: any, state?: any, reloaded?: boolean): Promise<void> {
      // STEP 0: Try to save CURRENT editor state BEFORE reinit
      let savedScrollState: ScrollState | null = null;
      
      try {
        const iframeWindow = this._editorInstance?._iframeWindow || this._iframeWindow;
        
        if (iframeWindow && iframeWindow.document) {
          const editorCoreElement = iframeWindow.document.querySelector(".editor-core") as HTMLElement | null;
          
          if (editorCoreElement) {
            const scrollTop = editorCoreElement.scrollTop;
            
            // Create basic scroll state
            savedScrollState = {
              scrollTop,
              itemID: this._item?.id || 0,
              timestamp: Date.now()
            };
            
            // Try to also save selection (if ProseMirror is available)
            try {
              const currentEditorInstance = iframeWindow._currentEditorInstance;
              if (currentEditorInstance && currentEditorInstance._editorCore) {
                const view = currentEditorInstance._editorCore.view;
                if (view && view.state) {
                  const { from, to, empty } = view.state.selection;
                  savedScrollState.selectionFrom = from;
                  savedScrollState.selectionTo = to;
                  savedScrollState.selectionEmpty = empty;
                }
              }
            } catch (selectionErr) {
              // Selection save failed, scroll will still be preserved
            }
            
            // Store in WeakMap
            self.scrollStates.set(this, savedScrollState);
          }
        }
      } catch (err) {
        logger.warn(`[ScrollPreserver] Error saving state in ${windowType}: ${err}`);
      }

      // STEP 1: Call original initEditor (this will rebuild EditorCore)
      await original.call(this, state, reloaded);

      // STEP 2: Restore scroll position AND selection AFTER initEditor
      if (savedScrollState && savedScrollState.scrollTop > 0) {
        self.restoreScrollPosition(this, savedScrollState.scrollTop);
      }
    };

    // Mark instance as patched
    this.patchedEditors.add(noteEditor);
  }

  /**
   * Uninitialize and cleanup
   * Must be called during plugin shutdown
   */
  uninit(): void {
    // Stop window scanning
    this.stopWindowScanning();
    
    // Clear all saved states
    this.scrollStates = new WeakMap();
    this.patchedEditors = new WeakSet();
  }

  /**
   * Alias for uninit() for backward compatibility
   */
  destroy(): void {
    this.uninit();
  }

  /**
   * Register a noteEditor element for scroll preservation
   * This is an ALTERNATIVE path - noteEditors are also found via periodic window scanning
   * 
   * Use cases:
   * 1. Immediate patching when a noteEditor is known (via EditorInstance hook)
   * 2. Ensures patching happens BEFORE first initEditor() call
   * 
   * @param noteEditor - The noteEditor XUL element (NOT EditorInstance!)
   */
  registerNoteEditor(noteEditor: any): void {
    // Delegate to the patching method (which handles duplicate checking)
    this.patchNoteEditorInstance(noteEditor, 'explicit');
  }

  /**
   * Unregister a noteEditor element
   * Called when noteEditor is destroyed
   */
  unregisterNoteEditor(noteEditor: any): void {
    // WeakMap/WeakSet will automatically clean up when noteEditor is garbage collected
    // No need to manually remove entries
    
    // Only restore original method if we have it stored
    if (this.originalInitEditor && this.patchedEditors.has(noteEditor)) {
      noteEditor.initEditor = this.originalInitEditor;
    }
  }

  /**
   * Save current scroll position AND cursor/selection state
   * Returns the saved scroll position, or null if not available
   */
  private saveScrollPosition(noteEditor: any): number | null {
    try {
      const editorInstance = noteEditor._editorInstance;
      if (!editorInstance || !editorInstance._iframeWindow) {
        return null;
      }

      const iframeWindow = editorInstance._iframeWindow;
      const editorCore = iframeWindow.document?.querySelector(".editor-core") as HTMLElement | null;
      
      if (editorCore) {
        const scrollState: ScrollState = {
          scrollTop: editorCore.scrollTop,
          itemID: noteEditor._item?.id || 0,
          timestamp: Date.now()
        };
        
        // Save ProseMirror selection state if available
        try {
          const editorInstanceFromNoteEditor = editorInstance;
          
          if (editorInstanceFromNoteEditor && editorInstanceFromNoteEditor._editorCore) {
            const editorCoreObj = editorInstanceFromNoteEditor._editorCore;
            
            const view = editorCoreObj.view;
            if (view && view.state) {
              const { from, to, empty } = view.state.selection;
              scrollState.selectionFrom = from;
              scrollState.selectionTo = to;
              scrollState.selectionEmpty = empty;
            }
          }
        } catch (err) {
          // Selection save failed, scroll will still be preserved
        }
        
        this.scrollStates.set(noteEditor, scrollState);
        return scrollState.scrollTop;
      }
    } catch (error) {
      logger.warn(`[ScrollPreserver] Error saving scroll position: ${error}`);
    }
    
    return null;
  }

  /**
   * Restore scroll position AND cursor/selection to a noteEditor
   * Uses a robust waiting strategy to handle large documents
   */
  private restoreScrollPosition(noteEditor: any, targetScroll: number): void {
    const editorInstance = noteEditor._editorInstance;
    if (!editorInstance) {
      logger.warn("[ScrollPreserver] Cannot restore scroll - no editorInstance");
      return;
    }

    // Retrieve saved state (including selection)
    const savedState = this.scrollStates.get(noteEditor);

    // Wait for editorInstance to be fully initialized
    editorInstance._initPromise.then(() => {
      this.hideAndRestoreScroll(editorInstance, targetScroll, savedState);
    }).catch((error: Error) => {
      logger.error(`[ScrollPreserver] Error waiting for editor init: ${error}`);
    });
  }

  /**
   * Hide editor content, restore scroll position AND selection, then show
   * This prevents the "jump to top then back" visual glitch
   */
  private hideAndRestoreScroll(editorInstance: any, scrollTop: number, savedState?: ScrollState): void {
    const instanceID = editorInstance.instanceID;
    
    // Phase 1: Wait for editor-core element to appear
    const waitForEditorCore = (retries: number) => {
      const iframeWindow = editorInstance._iframeWindow;
      const editorCore = iframeWindow?.document?.querySelector(".editor-core") as HTMLElement | null;
      
      if (!editorCore && retries > 0) {
        setTimeout(() => waitForEditorCore(retries - 1), 20);
        return;
      }
      
      if (!editorCore) {
        return;
      }
      
      // Hide immediately to prevent visual glitch
      editorCore.style.visibility = "hidden";
      
      // Phase 2: Wait for content to be rendered
      waitForStableContent(editorCore, scrollTop, 0, 0, 0);
    };
    
    // Helper: Restore ProseMirror selection WITHOUT triggering scrollIntoView
    const restoreSelectionState = () => {
      if (!savedState || savedState.selectionFrom === undefined) {
        return;
      }

      try {
        // Use editorInstance directly, not iframeWindow._currentEditorInstance
        if (!editorInstance || !editorInstance._editorCore) {
          return;
        }

        const editorCore = editorInstance._editorCore;
        const view = editorCore.view;
        if (!view || !view.state) {
          return;
        }

        const { doc, tr } = view.state;
        const from = Math.min(savedState.selectionFrom, doc.content.size);
        const to = Math.min(savedState.selectionTo || from, doc.content.size);

        // Use tr.setSelection WITHOUT .scrollIntoView()
        // This prevents cursor from jumping to visible area
        const TextSelection = view.state.selection.constructor;
        const newSelection = TextSelection.create(doc, from, to);
        const newTr = tr.setSelection(newSelection);
        
        // Set meta to prevent scrollIntoView
        newTr.setMeta('addToHistory', false);  // Don't add to undo history
        newTr.setMeta('preventScrollIntoView', true);  // Custom meta flag
        
        view.dispatch(newTr);
      } catch (err) {
        // Selection restore failed silently
      }
    };
    
    // Phase 2: Wait for content to be rendered and stable
    const waitForStableContent = (
      editorCore: HTMLElement, 
      targetScroll: number, 
      lastScrollHeight: number, 
      stableCount: number,
      totalWaitTime: number
    ) => {
      const currentScrollHeight = editorCore.scrollHeight;
      const clientHeight = editorCore.clientHeight;
      const maxScroll = currentScrollHeight - clientHeight;
      
      // Check if scrollHeight is stable
      const isStable = currentScrollHeight === lastScrollHeight;
      const newStableCount = isStable ? stableCount + 1 : 0;
      
      // Content is ready if stable for 2 checks OR target is reachable OR timeout
      const isReady = newStableCount >= 2 || targetScroll <= maxScroll || totalWaitTime > 2000;
      
      if (isReady) {
        // Restore scroll position
        const actualTarget = Math.min(targetScroll, maxScroll);
        editorCore.scrollTop = actualTarget;
        
        // 🔥 NEW: Restore ProseMirror selection state (CRITICAL!)
        restoreSelectionState();
        
        // Small documents: show immediately
        if (currentScrollHeight < 10000) {
          editorCore.style.visibility = "";
        } else {
          // Large documents: use maintenance period
          maintainScrollPosition(editorCore, actualTarget, 15, 0);
        }
      } else {
        // Not ready, wait and retry
        setTimeout(() => waitForStableContent(editorCore, targetScroll, currentScrollHeight, newStableCount, totalWaitTime + 20), 20);
      }
    };
    
    // Phase 3: Maintain scroll position for large documents
    const maintainScrollPosition = (
      editorCore: HTMLElement, 
      targetScroll: number, 
      remainingChecks: number,
      stableCount: number
    ) => {
      const currentScroll = editorCore.scrollTop;
      const maxScroll = editorCore.scrollHeight - editorCore.clientHeight;
      const actualTarget = Math.min(targetScroll, maxScroll);
      
      const isDrifted = Math.abs(currentScroll - actualTarget) > 5;
      
      if (isDrifted) {
        editorCore.scrollTop = actualTarget;
        setTimeout(() => maintainScrollPosition(editorCore, targetScroll, remainingChecks - 1, 0), 100);
      } else if (remainingChecks > 0 && stableCount < 2) {
        setTimeout(() => maintainScrollPosition(editorCore, targetScroll, remainingChecks - 1, stableCount + 1), 100);
      } else {
        editorCore.style.visibility = "";
      }
    };
    
    // Start Phase 1
    waitForEditorCore(100);
  }
}

// ============================================
// Public API Functions (Use Singleton Instance)
// ============================================

/**
 * Initialize the scroll preserver system (singleton)
 */
export function initScrollPreserverSystem(): void {
  const instance = ScrollPreserver.getInstance();
  instance.init();
}

/**
 * Register a note editor element for scroll preservation
 * @param noteEditor - The note-editor XUL element
 */
export function registerEditorForScrollPreservation(noteEditor: any): void {
  const instance = ScrollPreserver.getInstance();
  instance.registerNoteEditor(noteEditor);
}

/**
 * Unregister a note editor element (cleanup)
 * @param noteEditor - The note-editor XUL element
 */
export function unregisterEditorFromScrollPreservation(noteEditor: any): void {
  const instance = ScrollPreserver.getInstance();
  instance.unregisterNoteEditor(noteEditor);
}

/**
 * Destroy the scroll preserver system (cleanup)
 */
export function destroyScrollPreserverSystem(): void {
  const instance = ScrollPreserver.getInstance();
  instance.destroy();
  // Reset singleton instance
  ScrollPreserver._instance = null;
}
