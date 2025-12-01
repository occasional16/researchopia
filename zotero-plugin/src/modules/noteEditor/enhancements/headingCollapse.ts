/**
 * Heading Collapse Module
 * 
 * Adds collapsible heading functionality to Zotero note editor.
 * Supports H1, H2, H3 headings with fold/unfold capability.
 * 
 * Implementation Strategy:
 * - Container placed OUTSIDE editor-core (as sibling in iframe body)
 * - Use position: fixed for buttons (relative to viewport)
 * - Listen to scroll events on editor-core to update button positions
 * - Use requestAnimationFrame for smooth performance
 * - Use dynamic CSS with nth-child selectors to hide collapsed content
 *   (because ProseMirror overwrites direct DOM style changes)
 * 
 * Compatible with:
 * - Item Pane (main window)
 * - Edit in Separate Window (zotero:note)
 * - Better Notes workspace windows
 * 
 * @module noteEditor/enhancements/headingCollapse
 */

import { logger } from "../../../utils/logger";

// CSS styles for collapse buttons and overlays
const COLLAPSE_STYLES = `
/* Container for collapse buttons - fixed position in viewport */
.heading-collapse-container {
  position: fixed;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  overflow: visible;
  pointer-events: none;
  z-index: 1000;
}

/* Individual collapse button - fixed position relative to viewport */
.heading-collapse-btn {
  position: fixed;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  cursor: pointer;
  user-select: none;
  opacity: 0.4;
  font-size: 10px;
  color: #666;
  border: none;
  background: rgba(200, 200, 200, 0.3);
  border-radius: 3px;
  padding: 0;
  pointer-events: auto;
  /* GPU acceleration hints for smoother scrolling */
  will-change: top, left;
  contain: layout style;
}

.heading-collapse-btn:hover {
  opacity: 1;
  background: rgba(200, 200, 200, 0.6);
}

.heading-collapse-btn.collapsed {
  transform: rotate(-90deg);
}

/* Collapse overlay - covers folded content */
.heading-collapse-overlay {
  position: fixed;
  background: var(--material-background, #ffffff);
  pointer-events: none;
  z-index: 100;
  display: none;
}

.heading-collapse-overlay.active {
  display: block;
}

/* Placeholder text showing folded content indicator */
.heading-collapse-placeholder {
  position: fixed;
  color: #999;
  font-size: 12px;
  font-style: italic;
  pointer-events: none;
  z-index: 101;
  display: none;
}

.heading-collapse-placeholder.active {
  display: block;
}
`;

// Collapse state storage: itemID -> Set of collapsed heading indices
const collapseStates = new Map<number, Set<number>>();

// Store editor state for each document
interface EditorState {
  container: HTMLElement;
  scrollHandler: () => void;
  rafId: number | null;
}
const editorStates = new WeakMap<Document, EditorState>();

/**
 * HeadingCollapse singleton class
 */
export class HeadingCollapse {
  static _instance: HeadingCollapse | null = null;
  private scanIntervalId: ReturnType<typeof setInterval> | null = null;
  private processedDocs: WeakSet<Document> = new WeakSet();
  
  static getInstance(): HeadingCollapse {
    if (!HeadingCollapse._instance) {
      HeadingCollapse._instance = new HeadingCollapse();
    }
    return HeadingCollapse._instance;
  }
  
  /**
   * Initialize the heading collapse system
   */
  init(): void {
    this.startWindowScanning();
  }
  
  /**
   * Start periodic scanning for editors
   */
  private startWindowScanning(): void {
    this.scanAllWindowsForEditors();
    
    // Scan every 500ms for new editors
    this.scanIntervalId = setInterval(() => {
      this.scanAllWindowsForEditors();
    }, 500);
  }
  
  /**
   * Stop scanning
   */
  private stopWindowScanning(): void {
    if (this.scanIntervalId !== null) {
      clearInterval(this.scanIntervalId);
      this.scanIntervalId = null;
    }
  }
  
  /**
   * Scan all windows for note editors
   */
  private scanAllWindowsForEditors(): void {
    try {
      const wm = (Services as any).wm;
      if (!wm) return;
      
      // Scan all windows
      const enumerator = wm.getEnumerator(null);
      while (enumerator.hasMoreElements()) {
        const win = enumerator.getNext() as Window;
        if (!win?.document) continue;
        
        const docURI = win.document?.documentURI || '';
        if (docURI.includes('chrome://zotero/content/zoteroPane.xhtml')) continue;
        
        this.processWindowEditors(win);
      }
      
      // Scan main windows
      const hasGetMainWindows = typeof (Zotero as any).getMainWindows === 'function';
      if (hasGetMainWindows) {
        const mainWindows = ((Zotero as any).getMainWindows() || []) as Window[];
        for (const win of mainWindows) {
          if (!win?.document) continue;
          this.processWindowEditors(win);
        }
      }
    } catch {
      // Silent error handling
    }
  }
  
  /**
   * Process all note editors in a window
   */
  private processWindowEditors(win: Window): void {
    const noteEditors = win.document.querySelectorAll('note-editor');
    for (const ne of Array.from(noteEditors)) {
      const noteEditor = ne as any;
      this.setupEditor(noteEditor);
    }
  }
  
  /**
   * Setup collapse functionality for a note editor
   */
  private setupEditor(noteEditor: any): void {
    const editorInstance = noteEditor._editorInstance;
    if (!editorInstance) return;
    
    const iframeWindow = editorInstance._iframeWindow;
    if (!iframeWindow?.document) return;
    
    const doc = iframeWindow.document;
    const itemID = noteEditor._item?.id;
    
    const proseMirror = doc.querySelector('.ProseMirror') as HTMLElement;
    if (!proseMirror) return;
    
    const editorCore = doc.querySelector('.editor-core') as HTMLElement;
    if (!editorCore) return;
    
    // Check if this document was previously processed with a different itemID
    // This handles note switching where the same iframe is reused
    const existingState = editorStates.get(doc);
    const needsRebind = !this.processedDocs.has(doc) || 
                        (existingState && (existingState as any).lastItemID !== itemID);
    
    if (!needsRebind) {
      // Document already set up for this item, just update positions
      this.updateButtonPositions(noteEditor, doc);
      return;
    }
    
    // Mark as processed
    this.processedDocs.add(doc);
    
    // Inject styles (only once per doc)
    this.injectStyles(doc);
    
    // Get or create container
    let container = doc.getElementById('heading-collapse-container');
    if (!container) {
      container = doc.createElement('div');
      container.id = 'heading-collapse-container';
      container.className = 'heading-collapse-container';
      doc.body.appendChild(container);
    }
    
    // Remove old scroll handler if exists
    if (existingState?.scrollHandler) {
      editorCore.removeEventListener('scroll', existingState.scrollHandler);
    }
    
    // Setup new scroll handler - captures current noteEditor reference
    const scrollHandler = () => {
      this.updateButtonPositions(noteEditor, doc);
    };
    
    // Listen to scroll events on editor-core with high priority
    editorCore.addEventListener('scroll', scrollHandler, { passive: true });
    
    // Store state for cleanup, including itemID for tracking
    editorStates.set(doc, { 
      container, 
      scrollHandler, 
      rafId: null,
      lastItemID: itemID  // Track which item this was set up for
    } as any);
    
    // Initial button creation and positioning
    this.createButtons(noteEditor, doc, proseMirror, container);
    this.updateButtonPositions(noteEditor, doc);
  }
  
  /**
   * Inject CSS styles into document
   */
  private injectStyles(doc: Document): void {
    if (doc.getElementById('heading-collapse-styles')) return;
    
    const style = doc.createElement('style');
    style.id = 'heading-collapse-styles';
    style.textContent = COLLAPSE_STYLES;
    doc.head.appendChild(style);
  }
  
  /**
   * Create collapse buttons for headings (called once per editor setup)
   */
  private createButtons(noteEditor: any, doc: Document, proseMirror: HTMLElement, container: HTMLElement): void {
    const itemID = noteEditor._item?.id;
    const headings = proseMirror.querySelectorAll('h1, h2, h3');
    
    // Clear existing buttons
    container.innerHTML = '';
    
    // Create a button for each heading
    Array.from(headings).forEach((heading, index) => {
      const btn = doc.createElement('button');
      btn.className = 'heading-collapse-btn';
      btn.textContent = '▼';
      btn.dataset.headingIndex = String(index);
      container.appendChild(btn);
      
      // Add click handler
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleCollapse(index, noteEditor, proseMirror, btn, doc);
      });
      
      // Restore collapsed state
      const isCollapsed = itemID && collapseStates.get(itemID)?.has(index);
      btn.classList.toggle('collapsed', !!isCollapsed);
    });
  }
  
  /**
   * Update button positions based on current scroll
   * Called on scroll and periodically
   * 
   * Optimization: Only calculate positions for potentially visible headings
   * to improve performance on large documents (500k+ characters)
   */
  private updateButtonPositions(noteEditor: any, doc: Document): void {
    const proseMirror = doc.querySelector('.ProseMirror') as HTMLElement;
    const editorCore = doc.querySelector('.editor-core') as HTMLElement;
    const container = doc.getElementById('heading-collapse-container');
    
    if (!proseMirror || !editorCore || !container) return;
    
    const headings = proseMirror.querySelectorAll('h1, h2, h3');
    const buttons = container.querySelectorAll('.heading-collapse-btn');
    
    // If heading count changed, recreate buttons and update CSS
    if (headings.length !== buttons.length) {
      this.createButtons(noteEditor, doc, proseMirror, container);
      const itemID = noteEditor._item?.id;
      this.updateCollapseCSS(doc, proseMirror, itemID);
      return;
    }
    
    // Get editor-core's viewport rect (only once)
    const editorCoreRect = editorCore.getBoundingClientRect();
    const itemID = noteEditor._item?.id;
    
    // Optimization: For large documents, first do a quick scan to find 
    // which headings might be visible, then only calculate precise positions for those
    const headingCount = headings.length;
    const viewportTop = editorCoreRect.top - 50;  // Add buffer
    const viewportBottom = editorCoreRect.bottom + 50;
    
    // Use binary search to find first potentially visible heading
    // (headings are in document order, so their top positions are roughly sorted)
    let firstVisibleIndex = 0;
    let lastVisibleIndex = headingCount - 1;
    
    // For small documents (< 50 headings), just process all
    const isLargeDocument = headingCount > 50;
    
    if (isLargeDocument) {
      // Find first potentially visible heading with binary search
      let low = 0;
      let high = headingCount - 1;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const rect = (headings[mid] as HTMLElement).getBoundingClientRect();
        if (rect.bottom < viewportTop) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
      firstVisibleIndex = Math.max(0, low - 2); // Start a bit earlier to be safe
      
      // Find last potentially visible heading
      low = firstVisibleIndex;
      high = headingCount - 1;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        const rect = (headings[mid] as HTMLElement).getBoundingClientRect();
        if (rect.top > viewportBottom) {
          high = mid - 1;
        } else {
          low = mid;
        }
      }
      lastVisibleIndex = Math.min(headingCount - 1, high + 2); // End a bit later to be safe
    }
    
    // Update all buttons
    Array.from(headings).forEach((heading, index) => {
      const btn = buttons[index] as HTMLElement;
      if (!btn) return;
      
      // For headings outside the visible range, just hide the button without calculating position
      if (isLargeDocument && (index < firstVisibleIndex || index > lastVisibleIndex)) {
        btn.style.display = 'none';
        return;
      }
      
      const headingEl = heading as HTMLElement;
      
      // Get heading's position in viewport
      const headingRect = headingEl.getBoundingClientRect();
      
      // Calculate button position (fixed, relative to viewport)
      const btnTop = headingRect.top + (headingRect.height - 18) / 2;
      const btnLeft = headingRect.left - 42;
      
      // Check if heading is visible in the editor-core viewport
      const isVisible = (
        headingRect.top >= editorCoreRect.top - 20 &&
        headingRect.bottom <= editorCoreRect.bottom + 20
      );
      
      // Position button using top/left (with will-change for GPU hints)
      btn.style.top = `${btnTop}px`;
      btn.style.left = `${btnLeft}px`;
      btn.style.display = isVisible ? 'flex' : 'none';
      
      // Update collapsed state
      const isCollapsed = itemID && collapseStates.get(itemID)?.has(index);
      btn.classList.toggle('collapsed', !!isCollapsed);
    });
    
    // Update collapse placeholders (do this every position update)
    this.updateCollapseOverlays(doc, proseMirror, editorCore, container, itemID);
  }
  
  /**
   * Toggle collapse state of a heading
   */
  private toggleCollapse(index: number, noteEditor: any, proseMirror: HTMLElement, btn: HTMLElement, doc: Document): void {
    const itemID = noteEditor._item?.id;
    const headings = proseMirror.querySelectorAll('h1, h2, h3');
    const heading = headings[index] as HTMLElement;
    const container = doc.getElementById('heading-collapse-container');
    const editorCore = doc.querySelector('.editor-core') as HTMLElement;
    
    if (!heading || !container || !editorCore) return;
    
    const isCollapsed = btn.classList.contains('collapsed');
    const newState = !isCollapsed;
    
    btn.classList.toggle('collapsed', newState);
    
    // Persist state
    if (itemID) {
      if (!collapseStates.has(itemID)) {
        collapseStates.set(itemID, new Set());
      }
      const states = collapseStates.get(itemID)!;
      if (newState) {
        states.add(index);
      } else {
        states.delete(index);
      }
    }
    
    // Apply visual collapse using dynamic CSS
    this.updateCollapseCSS(doc, proseMirror, itemID);
    
    logger.log(`[HeadingCollapse] ${newState ? 'Collapsed' : 'Expanded'} heading ${index}`);
  }
  
  /**
   * Update collapse CSS rules based on current collapse states
   * Uses nth-child selectors to target specific elements
   */
  private updateCollapseCSS(doc: Document, proseMirror: HTMLElement, itemID: number | undefined): void {
    // Get or create dynamic style element
    let dynamicStyle = doc.getElementById('heading-collapse-dynamic-styles') as HTMLStyleElement;
    if (!dynamicStyle) {
      dynamicStyle = doc.createElement('style');
      dynamicStyle.id = 'heading-collapse-dynamic-styles';
      doc.head.appendChild(dynamicStyle);
    }
    
    if (!itemID || !collapseStates.has(itemID)) {
      dynamicStyle.textContent = '';
      return;
    }
    
    const collapsedIndices = collapseStates.get(itemID)!;
    if (collapsedIndices.size === 0) {
      dynamicStyle.textContent = '';
      return;
    }
    
    // Get all direct children of ProseMirror
    const children = Array.from(proseMirror.children);
    const headings = proseMirror.querySelectorAll('h1, h2, h3');
    
    // Build CSS rules for each collapsed heading
    const cssRules: string[] = [];
    
    collapsedIndices.forEach(headingIndex => {
      const heading = headings[headingIndex] as HTMLElement;
      if (!heading) return;
      
      const headingLevel = parseInt(heading.tagName.charAt(1));
      
      // Find the child index of this heading in proseMirror
      const headingChildIndex = children.indexOf(heading);
      if (headingChildIndex === -1) return;
      
      // Find range of children to collapse
      let endChildIndex = children.length;
      
      for (let i = headingIndex + 1; i < headings.length; i++) {
        const nextHeading = headings[i] as HTMLElement;
        const nextLevel = parseInt(nextHeading.tagName.charAt(1));
        if (nextLevel <= headingLevel) {
          endChildIndex = children.indexOf(nextHeading);
          break;
        }
      }
      
      // Generate CSS rules to hide elements between headingChildIndex+1 and endChildIndex-1
      // Using :nth-child selector
      for (let i = headingChildIndex + 1; i < endChildIndex; i++) {
        const childIndex = i + 1; // nth-child is 1-based
        cssRules.push(
          `.ProseMirror.primary-editor > :nth-child(${childIndex}) {
            display: none !important;
          }`
        );
      }
    });
    
    dynamicStyle.textContent = cssRules.join('\n');
    
    logger.log(`[HeadingCollapse] Updated dynamic CSS with ${cssRules.length} rules`);
  }
  
  /**
   * Update all collapse overlays based on current collapse states
   * Now creates indicator placeholders instead of hiding overlays
   */
  private updateCollapseOverlays(doc: Document, proseMirror: HTMLElement, editorCore: HTMLElement, container: HTMLElement, itemID: number | undefined): void {
    // Remove existing placeholders
    const existingPlaceholders = container.querySelectorAll('.heading-collapse-placeholder');
    existingPlaceholders.forEach(el => el.remove());
    
    if (!itemID || !collapseStates.has(itemID)) return;
    
    const collapsedIndices = collapseStates.get(itemID)!;
    if (collapsedIndices.size === 0) return;
    
    const headings = proseMirror.querySelectorAll('h1, h2, h3');
    const editorCoreRect = editorCore.getBoundingClientRect();
    const children = Array.from(proseMirror.children);
    
    // For each collapsed heading, count hidden lines and show indicator
    collapsedIndices.forEach(index => {
      const heading = headings[index] as HTMLElement;
      if (!heading) return;
      
      const headingLevel = parseInt(heading.tagName.charAt(1));
      const headingRect = heading.getBoundingClientRect();
      
      // Check if heading is visible in viewport
      if (headingRect.bottom < editorCoreRect.top || headingRect.top > editorCoreRect.bottom) {
        return; // Heading not visible, skip
      }
      
      // Count hidden elements (lines)
      const headingChildIndex = children.indexOf(heading);
      let endChildIndex = children.length;
      
      for (let i = index + 1; i < headings.length; i++) {
        const nextHeading = headings[i] as HTMLElement;
        const nextLevel = parseInt(nextHeading.tagName.charAt(1));
        if (nextLevel <= headingLevel) {
          endChildIndex = children.indexOf(nextHeading);
          break;
        }
      }
      
      // Calculate actual line count (not just element count)
      // For lists (ul/ol), count their li children; for other elements, count as 1
      let lineCount = 0;
      for (let i = headingChildIndex + 1; i < endChildIndex; i++) {
        const child = children[i] as HTMLElement;
        if (!child) continue;
        
        const tagName = child.tagName.toUpperCase();
        if (tagName === 'UL' || tagName === 'OL') {
          // For lists, count all li elements (including nested ones)
          const listItems = child.querySelectorAll('li');
          lineCount += listItems.length;
        } else if (tagName === 'BLOCKQUOTE') {
          // For blockquote, count content intelligently
          // Check what's inside: p elements, lists, or raw text
          const directChildren = Array.from(child.children);
          
          if (directChildren.length === 0) {
            // Empty blockquote or text-only, count as 1
            lineCount += 1;
          } else {
            // Count each direct child appropriately
            for (const blockChild of directChildren) {
              const childTag = blockChild.tagName.toUpperCase();
              if (childTag === 'P') {
                lineCount += 1;
              } else if (childTag === 'UL' || childTag === 'OL') {
                // Count list items in this list only
                const listItems = blockChild.querySelectorAll('li');
                lineCount += listItems.length;
              } else {
                // Other elements (h1-h6, etc.) count as 1
                lineCount += 1;
              }
            }
          }
        } else {
          // For p, h1-h6, pre, etc., count as 1 line
          lineCount += 1;
        }
      }
      
      if (lineCount <= 0) return;
      
      // Create placeholder text
      const placeholder = doc.createElement('div');
      placeholder.className = 'heading-collapse-placeholder active';
      placeholder.textContent = `... (${lineCount} lines folded)`;
      placeholder.style.top = `${headingRect.bottom + 2}px`;
      placeholder.style.left = `${headingRect.left + 20}px`;
      container.appendChild(placeholder);
    });
  }
  
  /**
   * Re-apply collapse state - now just updates CSS
   * Called from updateButtonPositions
   */
  private applyCollapseState(_index: number, _heading: HTMLElement, _collapsed: boolean): void {
    // CSS is now updated via updateCollapseCSS
    // This method is kept for compatibility but does nothing directly
  }
  
  /**
   * Cleanup
   */
  uninit(): void {
    this.stopWindowScanning();
    this.processedDocs = new WeakSet();
    collapseStates.clear();
  }
}

// ============================================
// Public API Functions
// ============================================

export function initHeadingCollapseSystem(): void {
  const instance = HeadingCollapse.getInstance();
  instance.init();
}

export function destroyHeadingCollapseSystem(): void {
  const instance = HeadingCollapse.getInstance();
  instance.uninit();
  HeadingCollapse._instance = null;
}
