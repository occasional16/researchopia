/**
 * Inline Findbar - Native-like search UI embedded in editor
 * Features: Real-time search, highlight, prev/next navigation, replace
 * Based on zotero-better-notes implementation with CSS overlays
 */

import { logger } from "../../../utils/logger";

// Global storage for search queries per note item ID
// This ensures each note has its own search history even when editor instances are reused
const noteSearchQueries = new Map<number, { search: string; replace: string }>();

// Global storage for findbar open/close state per note item ID
const noteFindbarState = new Map<number, boolean>();

/**
 * InlineFindbar class
 * Creates inline search bar in note editor using CSS overlays (no DOM modification)
 */
export class InlineFindbar {
  private editor: Zotero.EditorInstance;
  private doc: Document;
  private findbar: HTMLDivElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private replaceInput: HTMLInputElement | null = null;
  private replaceRow: HTMLDivElement | null = null;
  private statusSpan: HTMLSpanElement | null = null;
  
  // Store match positions without modifying DOM
  private matches: Array<{ node: Text; start: number; length: number }> = [];
  private currentIndex = -1;
  private highlightOverlays: HTMLElement[] = [];
  private searchDebounceTimer: number | null = null;
  
  // Performance: Only render visible overlays + buffer zone
  private readonly MAX_OVERLAYS = 200; // Limit to prevent lag
  
  // Track current note ID to detect note switching
  private currentNoteId: number | null = null;

  constructor(editor: Zotero.EditorInstance) {
    this.editor = editor;
    this.doc = editor._iframeWindow!.document;
    this.currentNoteId = this.getNoteItemId();
  }

  /**
   * Get current note's item ID for storing search queries
   */
  private getNoteItemId(): number | null {
    try {
      return (this.editor as any).itemID || (this.editor as any)._item?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Get search query for current note
   */
  private get searchQuery(): string {
    const itemId = this.currentNoteId; // Use tracked note ID instead of re-fetching
    if (itemId) {
      const saved = noteSearchQueries.get(itemId);
      return saved?.search || '';
    }
    return '';
  }  /**
   * Set search query for current note
   */
  private set searchQuery(value: string) {
    const itemId = this.currentNoteId; // Use tracked note ID instead of re-fetching
    if (itemId) {
      const existing = noteSearchQueries.get(itemId) || { search: '', replace: '' };
      noteSearchQueries.set(itemId, { ...existing, search: value });
    }
  }

  /**
   * Get replace query for current note
   */
  private get replaceQuery(): string {
    const itemId = this.currentNoteId; // Use tracked note ID instead of re-fetching
    if (itemId) {
      return noteSearchQueries.get(itemId)?.replace || '';
    }
    return '';
  }

  /**
   * Set replace query for current note
   */
  private set replaceQuery(value: string) {
    const itemId = this.currentNoteId; // Use tracked note ID instead of re-fetching
    if (itemId) {
      const existing = noteSearchQueries.get(itemId) || { search: '', replace: '' };
      noteSearchQueries.set(itemId, { ...existing, replace: value });
    }
  }

  /**
   * Toggle findbar visibility
   */
  show(): void {
    // Check if note has changed (editor instance reused for different note)
    const newNoteId = this.getNoteItemId();
    if (newNoteId !== this.currentNoteId) {
      // Save current note's findbar state before switching
      if (this.currentNoteId !== null) {
        noteFindbarState.set(this.currentNoteId, this.findbar !== null);
      }
      
      // Close existing findbar first (clean slate for new note)
      if (this.findbar) {
        this.hideInternal(); // Use internal hide to avoid saving state again
      }
      
      this.currentNoteId = newNoteId;
      
      // Restore new note's findbar state
      if (newNoteId !== null) {
        const savedState = noteFindbarState.get(newNoteId);
        if (savedState === true) {
          // Note had findbar open before, restore it
          this.showInternal();
          return;
        }
      }
      // If new note had no saved state or was closed, don't show findbar (user just triggered show)
    }
    
    if (this.findbar) {
      // If already shown, hide it (toggle behavior)
      this.hide();
      return;
    }

    this.showInternal();
  }
  
  /**
   * Internal show method (doesn't check note change)
   */
  private showInternal(): void {
    this.createFindbarUI();
    this.searchInput?.focus();
    
    // Update state storage
    if (this.currentNoteId !== null) {
      noteFindbarState.set(this.currentNoteId, true);
    }
    
    // If there's a previous query for THIS note, re-execute search and highlight
    if (this.searchQuery) {
      this.performSearch();
    }
    
    // Monitor editor content changes to update highlights
    this.setupContentChangeListener();
  }

  /**
   * Hide and remove findbar
   */
  hide(): void {
    // Save closed state for current note
    if (this.currentNoteId !== null) {
      noteFindbarState.set(this.currentNoteId, false);
    }
    this.hideInternal();
  }

  /**
   * Check if this findbar should restore state for the current note
   * Used by SearchManager to auto-restore findbar during editor initialization
   */
  shouldRestoreState(): boolean {
    if (this.currentNoteId === null) return false;
    const savedState = noteFindbarState.get(this.currentNoteId);
    return savedState === true;
  }
  
  /**
   * Internal hide method (doesn't save state - used during note switching)
   */
  private hideInternal(): void {
    this.clearHighlights();
    
    // Cleanup content observer
    const observer = (this as any).contentObserver;
    if (observer) {
      observer.disconnect();
      (this as any).contentObserver = null;
    }
    
    // Force repaint by triggering editor update
    const editorBody = this.doc.querySelector('.ProseMirror');
    if (editorBody) {
      // Trigger reflow
      void (editorBody as HTMLElement).offsetHeight;
    }
    
    this.findbar?.remove();
    this.findbar = null;
    // Keep searchQuery for next show() (native behavior)
    // this.searchQuery = '';
    this.matches = [];
    this.currentIndex = -1;
  }

  /**
   * Toggle method (alias for show)
   */
  toggle(): void {
    this.show();
  }

  /**
   * Remove findbar (cleanup)
   */
  remove(): void {
    this.hide();
  }

  /**
   * Called when note item changes (editor reused for different note)
   * Saves current note's state and restores new note's state
   */
  onNoteItemChange(newNoteId: number): void {
    if (newNoteId !== this.currentNoteId) {
      // Save current note's findbar state
      if (this.currentNoteId !== null) {
        const wasOpen = this.findbar !== null;
        noteFindbarState.set(this.currentNoteId, wasOpen);
      }
      
      // Close current findbar (clean slate for new note)
      if (this.findbar) {
        this.hideInternal();
      }
      
      // Update current note ID
      this.currentNoteId = newNoteId;
      
      // Restore new note's findbar state
      const savedState = noteFindbarState.get(newNoteId);
      
      if (savedState === true) {
        // Note had findbar open before, restore it
        this.showInternal();
      }
    }
  }

  /**
   * Get current tracked note ID (for external checks)
   */
  getCurrentNoteId(): number | null {
    return this.currentNoteId;
  }

  /**
   * Create findbar HTML structure (CSS Grid-based, like better-notes)
   */
  private createFindbarUI(): void {
    const editorBody = this.doc.querySelector('.primary-editor') || this.doc.body;
    
    // Create findbar container
    this.findbar = this.doc.createElement('div');
    this.findbar.className = 'custom-findbar';
    this.findbar.style.cssText = `
      position: sticky;
      top: 0;
      z-index: 99;
      display: grid;
      grid-template-columns: 1fr auto auto auto auto auto;
      grid-template-rows: auto auto;
      gap: 8px;
      align-items: center;
      padding: 8px 12px;
      background-color: #f0f0f0;
      border-bottom: 1px solid var(--material-border, #ddd);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
      font-size: 13px;
      width: 100%;
      box-sizing: border-box;
    `;

    // Search input
    this.searchInput = this.doc.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Find';
    this.searchInput.value = this.searchQuery || ''; // Restore previous query
    this.searchInput.style.cssText = `
      width: 100%;
      padding: 4px 8px;
      border: 1px solid var(--material-border);
      border-radius: 3px;
      font-size: 13px;
    `;
    this.searchInput.addEventListener('input', () => this.onSearchInput());
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.shiftKey ? this.findPrevious() : this.findNext();
      } else if (e.key === 'Escape') {
        this.hide();
      }
    });

    // Status (e.g., "2/5")
    this.statusSpan = this.doc.createElement('span');
    this.statusSpan.style.cssText = `
      color: var(--fill-secondary);
      font-size: 12px;
      min-width: 40px;
      flex-shrink: 0;
    `;

    // Previous button
    const prevBtn = this.createButton('Previous', `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor">
        <path d="M2.884 14 2 13.116l8-8 8 8-.884.884L10 6.884z"/>
      </svg>
    `);
    prevBtn.addEventListener('click', () => this.findPrevious());

    // Next button
    const nextBtn = this.createButton('Next', `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor">
        <path d="m17.116 6 .884.884-8 8-8-8L2.884 6 10 13.116z"/>
      </svg>
    `);
    nextBtn.addEventListener('click', () => this.findNext());

    // Replace checkbox
    const replaceCheckbox = this.doc.createElement('input');
    replaceCheckbox.type = 'checkbox';
    replaceCheckbox.id = 'custom-findbar-replace-toggle';
    replaceCheckbox.style.cssText = 'flex-shrink: 0;';
    const replaceLabel = this.doc.createElement('label');
    replaceLabel.htmlFor = 'custom-findbar-replace-toggle';
    replaceLabel.textContent = 'Replace';
    replaceLabel.style.cssText = 'cursor: pointer; user-select: none; white-space: nowrap; flex-shrink: 0; margin: 0 8px 0 4px;';
    replaceCheckbox.addEventListener('change', () => this.toggleReplaceUI());

    // Replace input (initially hidden)
    this.replaceInput = this.doc.createElement('input');
    this.replaceInput.type = 'text';
    this.replaceInput.placeholder = 'Replace';
    this.replaceInput.value = this.replaceQuery || ''; // Restore previous replace text
    this.replaceInput.style.cssText = `
      flex: 1 1 auto;
      min-width: 0;
      padding: 4px 8px;
      border: 1px solid var(--material-border);
      border-radius: 3px;
      font-size: 13px;
    `;
    // Save replace text on input
    this.replaceInput.addEventListener('input', () => {
      this.replaceQuery = this.replaceInput?.value || '';
    });

    // Replace button
    const replaceBtn = this.createTextButton('Replace');
    replaceBtn.addEventListener('click', () => this.replaceOne());

    // Replace All button
    const replaceAllBtn = this.createTextButton('Replace All');
    replaceAllBtn.addEventListener('click', () => this.replaceAll());

    // Close button
    const closeBtn = this.createButton('Close', `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor">
        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
      </svg>
    `);
    closeBtn.style.marginLeft = 'auto';
    closeBtn.addEventListener('click', () => this.hide());

    // Create replace row container
    this.replaceRow = this.doc.createElement('div');
    this.replaceRow.style.cssText = `
      grid-column: 1 / -1;
      display: none;
      gap: 8px;
      align-items: center;
    `;

    // Assemble UI
    this.findbar.appendChild(this.searchInput);
    this.findbar.appendChild(this.statusSpan);
    this.findbar.appendChild(prevBtn);
    this.findbar.appendChild(nextBtn);
    this.findbar.appendChild(replaceCheckbox);
    this.findbar.appendChild(replaceLabel);
    
    // Add replace elements to row container
    this.replaceRow.appendChild(this.replaceInput);
    this.replaceRow.appendChild(replaceBtn);
    this.replaceRow.appendChild(replaceAllBtn);
    this.findbar.appendChild(this.replaceRow);

    // Insert before editor body
    editorBody.parentElement?.insertBefore(this.findbar, editorBody);
    
    // Apply dark mode background if needed
    const isDarkMode = this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)')?.matches || false;
    if (isDarkMode) {
      if (this.findbar) {
        this.findbar.style.backgroundColor = '#2a2a2a';
        this.findbar.style.borderBottomColor = '#555';
      }
      if (this.replaceRow) {
        this.replaceRow.style.backgroundColor = '#2a2a2a';
      }
    }
  }

  /**
   * Create icon button
   */
  private createButton(title: string, svg: string): HTMLButtonElement {
    const btn = this.doc.createElement('button');
    btn.className = 'toolbar-button';
    btn.title = title;
    btn.innerHTML = svg;
    btn.style.cssText = `
      padding: 4px;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: 3px;
      display: flex;
      align-items: center;
      flex-shrink: 0;
    `;
    btn.addEventListener('mouseenter', () => btn.style.background = 'var(--fill-quinary)');
    btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
    return btn;
  }

  /**
   * Create text button
   */
  private createTextButton(text: string): HTMLButtonElement {
    const btn = this.doc.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 4px 12px;
      border: 1px solid var(--material-border);
      background: var(--material-background);
      cursor: pointer;
      border-radius: 3px;
      font-size: 12px;
      flex-shrink: 0;
    `;
    btn.addEventListener('mouseenter', () => btn.style.background = 'var(--fill-quinary)');
    btn.addEventListener('mouseleave', () => btn.style.background = 'var(--material-background)');
    return btn;
  }

  /**
   * Toggle replace UI visibility
   */
  private toggleReplaceUI(): void {
    const show = (this.findbar?.querySelector('#custom-findbar-replace-toggle') as HTMLInputElement)?.checked || false;
    
    // Show/hide the entire replace row (flex container)
    if (this.replaceRow) {
      this.replaceRow.style.display = show ? 'flex' : 'none';
    }
    
    // Recalculate highlight positions after layout change
    if (this.searchQuery && this.matches.length > 0) {
      this.performSearch(true); // Preserve current index, recalculate positions
    }
  }

  /**
   * Handle search input change with debounce
   */
  private onSearchInput(): void {
    const newQuery = this.searchInput?.value || '';
    
    // Clear previous debounce timer
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    
    // Debounce search to avoid lag on fast typing
    this.searchDebounceTimer = setTimeout(() => {
      // Clear highlights if query changed
      if (newQuery !== this.searchQuery) {
        this.clearHighlights();
      }
      
      this.searchQuery = newQuery;
      
      if (this.searchQuery.length === 0) {
        this.updateStatus();
        return;
      }

      this.performSearch();
      this.searchDebounceTimer = null;
    }, 300) as unknown as number; // 300ms debounce
  }

  /**
   * Perform search and highlight matches
   * @param preserveIndex Whether to preserve current match index (for navigation)
   * @param useFadeIn Whether to use fade-in animation when creating highlights
   */
  private performSearch(preserveIndex = false, useFadeIn = false): void {
    const savedIndex = this.currentIndex;
    
    this.clearHighlights();
    this.matches = [];
    this.currentIndex = -1;

    if (!this.searchQuery) {
      this.updateStatus();
      return;
    }

    const editorBody = this.doc.querySelector('.ProseMirror');
    if (!editorBody) return;

    // Use TreeWalker to find text nodes
    // NodeFilter.SHOW_TEXT = 4 (constant value)
    const walker = this.doc.createTreeWalker(
      editorBody,
      4, // NodeFilter.SHOW_TEXT
      null
    );

    const textNodes: Text[] = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    // Search in each text node and store positions
    const regex = new RegExp(this.searchQuery, 'gi');
    textNodes.forEach((textNode) => {
      const text = textNode.textContent || '';
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        this.matches.push({
          node: textNode,
          start: match.index,
          length: match[0].length
        });
      }
    });

    // Create visual highlights (CSS overlays, not DOM modification)
    this.createHighlightOverlays(useFadeIn);
    
    // Set current index
    if (this.matches.length > 0) {
      if (preserveIndex && savedIndex >= 0 && savedIndex < this.matches.length) {
        this.currentIndex = savedIndex;
      } else {
        this.currentIndex = 0;
      }
      this.scrollToMatch(this.currentIndex);
    }

    this.updateStatus();
  }

  /**
   * Create CSS overlay highlights (no DOM modification)
   * @param useFadeIn Whether to use fade-in animation (for content updates)
   */
  private createHighlightOverlays(useFadeIn = false): void {
    // Remove old overlays
    this.highlightOverlays.forEach(el => el.remove());
    this.highlightOverlays = [];
    
    const editorBody = this.doc.querySelector('.ProseMirror') as HTMLElement;
    if (!editorBody) {
      logger.error('[InlineFindbar] Cannot find .ProseMirror element');
      return;
    }
    
    // Create or get overlay container (outside ProseMirror to prevent clearing)
    let container = this.doc.getElementById('custom-search-overlay-container') as HTMLElement;
    if (!container) {
      container = this.doc.createElement('div');
      container.id = 'custom-search-overlay-container';
      container.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 10;
      `;
      
      // Insert container as sibling of editor (not child)
      const editorContainer = editorBody.parentElement;
      if (editorContainer) {
        editorContainer.style.position = 'relative'; // Ensure relative positioning
        editorContainer.appendChild(container);
      } else {
        logger.error('[InlineFindbar] Cannot find editor parent');
        return;
      }
    }
    
    // Performance: Only render visible overlays + buffer
    const renderStart = Math.max(0, this.currentIndex - 50);
    const renderEnd = Math.min(this.matches.length, this.currentIndex + 150);
    
    for (let index = renderStart; index < renderEnd && this.highlightOverlays.length < this.MAX_OVERLAYS; index++) {
      const match = this.matches[index];
      const { node, start, length } = match;
      
      // Create Range to get bounding rect
      const range = this.doc.createRange();
      try {
        range.setStart(node, start);
        range.setEnd(node, start + length);
        
        const rects = range.getClientRects();
        if (!rects || rects.length === 0) {
          continue;
        }
        
        const editorRect = editorBody.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Create overlay for each rect (handles multi-line matches)
        for (let i = 0; i < rects.length; i++) {
          const rect = rects[i];
          const overlay = this.doc.createElement('div');
          overlay.className = 'custom-search-overlay';
          overlay.dataset.matchIndex = String(index);
          overlay.style.cssText = `
            position: absolute;
            left: ${rect.left - containerRect.left + container.scrollLeft}px;
            top: ${rect.top - containerRect.top + container.scrollTop}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            background: yellow;
            opacity: ${useFadeIn ? '0' : '0.6'};
            pointer-events: none;
            z-index: 1;
            ${useFadeIn ? 'transition: opacity 150ms ease-in;' : ''}
          `;
          
          container.appendChild(overlay);
          this.highlightOverlays.push(overlay);
          
          // Fade in for content-change rebuilds (smoother appearance)
          if (useFadeIn) {
            requestAnimationFrame(() => {
              overlay.style.opacity = '0.6';
            });
          }
          
          // Safety limit
          if (this.highlightOverlays.length >= this.MAX_OVERLAYS) {
            break;
          }
        }
        } catch (e) {
        // Ignore range errors
      }
    }
  }  /**
   * Clear all highlight overlays
   */
  private clearHighlights(): void {
    // Save reference to old overlays before clearing array
    const oldOverlays = [...this.highlightOverlays];
    
    // Clear array immediately to allow new highlights to be added
    this.highlightOverlays = [];
    this.matches = [];
    this.currentIndex = -1;
    
    // Fade out old overlays before removing (smoother visual effect)
    oldOverlays.forEach(el => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 100ms ease-out';
    });
    
    // Remove old overlays after fade animation
    setTimeout(() => {
      oldOverlays.forEach(el => el.remove());
    }, 100);
  }

  /**
   * Find next match
   */
  private findNext(): void {
    if (this.matches.length === 0) return;
    
    this.currentIndex = (this.currentIndex + 1) % this.matches.length;
    
    // Re-perform search to rebuild highlights (ProseMirror clears manual DOM changes)
    this.performSearch(true); // Pass true to preserve currentIndex
  }

  /**
   * Find previous match
   */
  private findPrevious(): void {
    if (this.matches.length === 0) return;
    
    this.currentIndex = (this.currentIndex - 1 + this.matches.length) % this.matches.length;
    
    // Re-perform search to rebuild highlights
    this.performSearch(true); // Pass true to preserve currentIndex
  }

  /**
   * Scroll to specific match
   */
  private scrollToMatch(index: number): void {
    // Reset all overlays to yellow
    this.doc.querySelectorAll('.custom-search-overlay').forEach((el) => {
      (el as HTMLElement).style.background = 'yellow';
    });

    // Highlight current match in orange
    const currentOverlays = this.doc.querySelectorAll(`[data-match-index="${index}"]`);
    currentOverlays.forEach((el) => {
      (el as HTMLElement).style.background = 'orange';
    });
    
    // Scroll to match - use native scrollIntoView
    if (this.matches[index] && currentOverlays.length > 0) {
      const firstOverlay = currentOverlays[0] as HTMLElement;
      
      // Use smooth scrolling to first overlay of current match
      firstOverlay.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  }

  /**
   * Update status text (e.g., "2/5")
   */
  private updateStatus(): void {
    if (!this.statusSpan) return;
    
    if (this.matches.length === 0) {
      this.statusSpan.textContent = this.searchQuery ? 'No results' : '';
    } else {
      this.statusSpan.textContent = `${this.currentIndex + 1}/${this.matches.length}`;
    }
  }

  /**
   * Replace current match
   */
  private replaceOne(): void {
    if (this.currentIndex < 0 || this.currentIndex >= this.matches.length) return;
    
    const replaceText = this.replaceInput?.value || '';
    const match = this.matches[this.currentIndex];
    const { node, start, length } = match;
    
    // Replace text in node
    const text = node.textContent || '';
    node.textContent = text.slice(0, start) + replaceText + text.slice(start + length);
    
    // Re-search to update highlights
    this.performSearch();
  }

  /**
   * Replace all matches
   */
  private replaceAll(): void {
    if (this.matches.length === 0) return;
    
    const replaceText = this.replaceInput?.value || '';
    
    // Replace in reverse order to maintain indices
    for (let i = this.matches.length - 1; i >= 0; i--) {
      const match = this.matches[i];
      const { node, start, length } = match;
      
      const text = node.textContent || '';
      node.textContent = text.slice(0, start) + replaceText + text.slice(start + length);
    }
    
    // Re-search to update highlights
    this.performSearch();
  }

  /**
   * Setup listener for editor content changes
   * Re-execute search when editor content changes
   */
  private setupContentChangeListener(): void {
    const editorBody = this.doc.querySelector('.ProseMirror') as HTMLElement;
    if (!editorBody) return;

    const MutationObserver = (this.editor._iframeWindow as any)?.MutationObserver as typeof window.MutationObserver;
    if (!MutationObserver) return;

    // Debounce update to avoid excessive re-rendering
    let updateTimer: number | null = null;
    
    const observer = new MutationObserver(() => {
      // Immediately clear highlights when content changes (better UX during editing)
      if (this.highlightOverlays.length > 0) {
        const oldOverlays = [...this.highlightOverlays];
        this.highlightOverlays = [];
        oldOverlays.forEach(el => el.remove()); // Instant removal, no fade
      }
      
      // Restart debounce timer to rebuild highlights after editing stops
      if (updateTimer) {
        clearTimeout(updateTimer);
      }
      
      updateTimer = setTimeout(() => {
        // Re-execute search with current query
        if (this.searchQuery) {
          this.performSearch(true); // Use fade-in for content-change rebuilds
        }
      }, 200) as unknown as number; // 200ms debounce
    });

    observer.observe(editorBody, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Store observer for cleanup
    (this as any).contentObserver = observer;
  }

}
