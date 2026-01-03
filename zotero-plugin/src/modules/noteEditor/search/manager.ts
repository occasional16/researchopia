/**
 * Custom Search Manager for Researchopia
 * Provides enhanced note search with inline findbar
 * Based on zotero-better-notes implementation
 */

import { InlineFindbar } from './findbar';
import { logger } from '../../../utils/logger';

export class CustomSearchManager {
  private findbarMap: WeakMap<Zotero.EditorInstance, InlineFindbar> = new WeakMap();
  // Track last known note ID per editor to detect note switching
  private lastNoteIdMap: WeakMap<Zotero.EditorInstance, number> = new WeakMap();

  constructor() {
    // Findbar instances are created per-editor
  }

  /**
   * Get note item ID from editor
   */
  private getNoteItemIdFromEditor(editor: Zotero.EditorInstance): number | null {
    try {
      return (editor as any).itemID || (editor as any)._item?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Notify that note item has changed for an editor
   * Should be called when note switching is detected
   */
  notifyNoteItemChange(editor: Zotero.EditorInstance, newNoteId: number): void {
    const findbar = this.findbarMap.get(editor);
    if (findbar) {
      findbar.onNoteItemChange(newNoteId);
    }
    this.lastNoteIdMap.set(editor, newNoteId);
  }

  /**
   * Register editor toolbar button (called by toolbar.ts)
   */
  registerToolbarButton(editor: Zotero.EditorInstance, toolbar: HTMLDivElement): void {
    const doc = editor._iframeWindow?.document;
    if (!doc) {
      logger.warn('[CustomSearch] No iframe document');
      return;
    }

    // Find toolbar middle section
    const toolbarMiddle = toolbar.querySelector('.middle');
    if (!toolbarMiddle) {
      logger.warn('[CustomSearch] Toolbar .middle element not found');
      return;
    }

    // Check if button already exists in THIS toolbar (prevent duplicates)
    const existingBtn = toolbarMiddle.querySelector('[data-researchopia-custom-search]') as HTMLElement;
    if (existingBtn) {
      // Update the editor instanceID in existing button
      existingBtn.setAttribute('data-editor-id', editor.instanceID || '');
      return;
    }

    // Create search button
    const searchBtn = doc.createElement('button');
    searchBtn.className = 'toolbar-button';
    searchBtn.title = 'Custom Search (Ctrl+F)'; // Changed from Ctrl+Shift+F
    searchBtn.setAttribute('aria-label', 'Custom Search');
    searchBtn.setAttribute('data-researchopia-custom-search', 'true'); // Add marker for duplicate detection
    searchBtn.setAttribute('data-editor-id', editor.instanceID || ''); // Store editor ID for lookup
    searchBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
    </svg>`;
    
    // Store manager reference for click handler
    const manager = this;
    
    searchBtn.addEventListener('click', () => {
      // Get current editor from stored instanceID (dynamically resolved)
      const editorId = searchBtn.getAttribute('data-editor-id');
      const currentEditor = manager.getCurrentEditorFromButton(editorId);
      if (currentEditor) {
        manager.triggerSearch(currentEditor);
      } else {
        // Fallback: try to find any active editor
        const fallbackEditor = manager.findActiveEditor();
        if (fallbackEditor) {
          // Update button with new editor ID
          searchBtn.setAttribute('data-editor-id', fallbackEditor.instanceID || '');
          manager.triggerSearch(fallbackEditor);
        }
      }
    });

    // Insert at the beginning of toolbar middle area (before Format Text)
    toolbarMiddle.insertBefore(searchBtn, toolbarMiddle.firstChild);

    // Add keyboard shortcut
    this.addKeyboardShortcut(editor);
  }

  /**
   * Get editor instance from button's stored ID
   */
  private getCurrentEditorFromButton(editorId: string | null): Zotero.EditorInstance | null {
    if (!editorId) return null;
    
    // Try to find editor in Zotero's editor instances
    const instances = (Zotero.Notes as any)?._editorInstances;
    if (instances) {
      for (const instance of instances) {
        if (instance?.instanceID === editorId) {
          return instance;
        }
      }
    }
    
    return null;
  }

  /**
   * Find any active editor (fallback when stored ID doesn't match)
   */
  private findActiveEditor(): Zotero.EditorInstance | null {
    const instances = (Zotero.Notes as any)?._editorInstances;
    if (instances && instances.length > 0) {
      // Return the last (most recent) editor instance
      return instances[instances.length - 1];
    }
    return null;
  }

  /**
   * Add Ctrl+F keyboard shortcut (override native find)
   */
  private addKeyboardShortcut(editor: Zotero.EditorInstance): void {
    const doc = editor._iframeWindow?.document;
    if (!doc) return;

    // Add Ctrl+F listener - always prevent default and stop propagation
    doc.addEventListener('keydown', (event: KeyboardEvent) => {
      // Ctrl+F - override native find
      if (event.ctrlKey && !event.shiftKey && !event.altKey && event.key === 'f') {
        // Check if this iframe has focus
        const iframeDoc = editor._iframeWindow?.document;
        if (iframeDoc && iframeDoc.hasFocus()) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          this.triggerSearch(editor);
        }
      }
    }, true); // Use capture phase
  }

  /**
   * Trigger inline findbar (public API for external calls)
   */
  triggerSearch(editor: Zotero.EditorInstance): void {
    // Check if note has changed since last interaction
    const currentNoteId = this.getNoteItemIdFromEditor(editor);
    const lastNoteId = this.lastNoteIdMap.get(editor);
    
    // For existing editors: detect note change
    if (currentNoteId !== null && lastNoteId !== undefined && currentNoteId !== lastNoteId) {
      this.notifyNoteItemChange(editor, currentNoteId);
    }
    
    // Update last known note ID
    if (currentNoteId !== null) {
      this.lastNoteIdMap.set(editor, currentNoteId);
    }
    
    let findbar = this.findbarMap.get(editor);
    
    if (!findbar) {
      // New editor - create findbar
      findbar = new InlineFindbar(editor);
      this.findbarMap.set(editor, findbar);
    }
    
    findbar.show();
  }

  /**
   * Check and restore findbar state for an editor (called during editor init)
   * Returns true if findbar was restored
   */
  checkAndRestoreFindbarState(editor: Zotero.EditorInstance): boolean {
    const currentNoteId = this.getNoteItemIdFromEditor(editor);
    if (currentNoteId === null) return false;
    
    // Import the global state map from findbar module
    // Note: We need to access the noteFindbarState from findbar.ts
    let findbar = this.findbarMap.get(editor);
    
    if (!findbar) {
      findbar = new InlineFindbar(editor);
      this.findbarMap.set(editor, findbar);
    }
    
    // Check if this note had findbar open before
    const shouldRestore = findbar.shouldRestoreState?.() ?? false;
    if (shouldRestore) {
      findbar.show();
      return true;
    }
    
    return false;
  }

  /**
   * Toggle search (alias for triggerSearch)
   */
  toggle(editor: Zotero.EditorInstance): void {
    this.triggerSearch(editor);
  }
}

// Singleton pattern (for external access from toolbar.ts)
let managerInstance: CustomSearchManager | null = null;

// Export SearchManager class with same interface (for backward compatibility)
export class SearchManager extends CustomSearchManager {
  static getInstance(): SearchManager {
    if (!managerInstance) {
      managerInstance = new CustomSearchManager();
    }
    return managerInstance as SearchManager;
  }

  // For backward compatibility - create findbar on demand
  registerEditor(_editor: Zotero.EditorInstance): void {
    // Findbar created lazily in triggerSearch
  }

  // Cleanup all instances
  cleanup(): void {
    // WeakMap automatically garbage collects, no explicit cleanup needed
  }
}
