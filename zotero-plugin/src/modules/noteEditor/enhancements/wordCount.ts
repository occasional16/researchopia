/**
 * Word Count Module for Zotero Note Editor
 * 
 * Adds a status bar in the bottom-right corner of the note editor
 * showing lines, words, and characters count (similar to Obsidian).
 * 
 * @module wordCount
 */

import { logger } from "../../../utils/logger";

interface WordCountStats {
  words: number;
  characters: number;
}

// Store observers per editor to avoid memory leaks
const observerMap = new WeakMap<Element, MutationObserver>();

/**
 * Count statistics from text content
 */
function countStats(text: string): WordCountStats {
  // Count words (split by whitespace, filter empty strings)
  // Support both Latin and CJK characters
  const latinWords = text.match(/[a-zA-Z0-9]+(?:[-'][a-zA-Z0-9]+)*/g) || [];
  // CJK characters (Chinese, Japanese, Korean) are counted individually
  const cjkChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g) || [];
  const words = latinWords.length + cjkChars.length;
  
  // Count characters (excluding whitespace for a cleaner count)
  const characters = text.replace(/\s/g, '').length;
  
  return { words, characters };
}

/**
 * Count block-level elements as lines in ProseMirror
 */
function countLinesFromDOM(editorBody: Element): number {
  // Count direct block-level children (p, h1-h6, blockquote, pre, ul, ol, etc.)
  const blockElements = editorBody.querySelectorAll(':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > blockquote, :scope > pre, :scope > ul, :scope > ol, :scope > math-display');
  
  let lineCount = 0;
  blockElements.forEach(el => {
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      // Count each list item as a line
      lineCount += el.querySelectorAll('li').length;
    } else {
      lineCount += 1;
    }
  });
  
  return lineCount || 1;
}

/**
 * Initialize word count status bar for an editor
 * @param editor - Zotero editor instance
 */
export async function initWordCount(editor: Zotero.EditorInstance): Promise<void> {
  await editor._initPromise;

  const doc = editor._iframeWindow?.document;
  if (!doc) {
    logger.warn("[WordCount] No iframe document");
    return;
  }

  const editorBody = doc.querySelector('.ProseMirror') as HTMLElement;
  if (!editorBody) {
    logger.warn("[WordCount] No .ProseMirror element");
    return;
  }

  // Clean up any existing observer for this editor body
  const existingObserver = observerMap.get(editorBody);
  if (existingObserver) {
    existingObserver.disconnect();
    observerMap.delete(editorBody);
  }

  logger.log("[WordCount] Initializing word count status bar");

  // Remove existing status bar if any (for re-initialization)
  const existingStatusBar = doc.getElementById('researchopia-word-count');
  if (existingStatusBar) {
    existingStatusBar.remove();
  }

  // Create status bar element
  const statusBar = doc.createElement('div');
  statusBar.id = 'researchopia-word-count';
  doc.body.appendChild(statusBar);

  // Create/inject styles
  let styleEl = doc.getElementById('researchopia-word-count-style');
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = 'researchopia-word-count-style';
    doc.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    #researchopia-word-count {
      position: fixed;
      bottom: 8px;
      right: 12px;
      display: flex;
      gap: 12px;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: var(--fill-tertiary, #666);
      background: var(--material-background, rgba(255, 255, 255, 0.9));
      padding: 4px 10px;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      user-select: none;
      pointer-events: auto;
      opacity: 0.85;
      transition: opacity 0.15s ease;
    }
    
    #researchopia-word-count:hover {
      opacity: 1;
    }
    
    #researchopia-word-count .stat-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    #researchopia-word-count .stat-value {
      font-weight: 500;
      color: var(--fill-secondary, #444);
    }
    
    #researchopia-word-count .stat-label {
      color: var(--fill-tertiary, #888);
    }
    
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      #researchopia-word-count {
        background: var(--material-background, rgba(40, 40, 40, 0.95));
        color: var(--fill-tertiary, #aaa);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }
      
      #researchopia-word-count .stat-value {
        color: var(--fill-secondary, #ddd);
      }
      
      #researchopia-word-count .stat-label {
        color: var(--fill-tertiary, #999);
      }
    }
    
    /* Zotero dark theme detection */
    :root[data-color-scheme="dark"] #researchopia-word-count,
    .theme-dark #researchopia-word-count {
      background: var(--material-background, rgba(40, 40, 40, 0.95));
      color: var(--fill-tertiary, #aaa);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
    
    :root[data-color-scheme="dark"] #researchopia-word-count .stat-value,
    .theme-dark #researchopia-word-count .stat-value {
      color: var(--fill-secondary, #ddd);
    }
    
    :root[data-color-scheme="dark"] #researchopia-word-count .stat-label,
    .theme-dark #researchopia-word-count .stat-label {
      color: var(--fill-tertiary, #999);
    }
  `;

  // Update function
  const updateStats = () => {
    const currentStatusBar = doc.getElementById('researchopia-word-count');
    if (!currentStatusBar) return;
    
    const text = editorBody.textContent || '';
    const lines = countLinesFromDOM(editorBody);
    const { words, characters } = countStats(text);
    
    currentStatusBar.innerHTML = `
      <span class="stat-item">
        <span class="stat-value">${lines}</span>
        <span class="stat-label">lines</span>
      </span>
      <span class="stat-item">
        <span class="stat-value">${words}</span>
        <span class="stat-label">words</span>
      </span>
      <span class="stat-item">
        <span class="stat-value">${characters}</span>
        <span class="stat-label">chars</span>
      </span>
    `;
  };

  // Initial update
  updateStats();

  // Get MutationObserver from the iframe window
  const MutationObserver = (editor._iframeWindow as any)?.MutationObserver as typeof window.MutationObserver;
  if (!MutationObserver) {
    logger.warn("[WordCount] MutationObserver not available");
    return;
  }

  // Set up MutationObserver to watch for content changes
  let updateTimeout: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    // Debounce updates
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(updateStats, 150);
  });

  observer.observe(editorBody, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Store observer reference for cleanup
  observerMap.set(editorBody, observer);

  logger.log("[WordCount] Observer started");
}

/**
 * Remove word count status bar from an editor
 * @param editor - Zotero editor instance
 */
export function removeWordCount(editor: Zotero.EditorInstance): void {
  const doc = editor._iframeWindow?.document;
  if (!doc) return;

  // Remove status bar
  const statusBar = doc.getElementById('researchopia-word-count');
  if (statusBar) {
    statusBar.remove();
    logger.log("[WordCount] Status bar removed");
  }

  // Remove style element
  const styleEl = doc.getElementById('researchopia-word-count-style');
  if (styleEl) {
    styleEl.remove();
  }

  // Clean up observer
  const editorBody = doc.querySelector('.ProseMirror') as HTMLElement;
  if (editorBody) {
    const observer = observerMap.get(editorBody);
    if (observer) {
      observer.disconnect();
      observerMap.delete(editorBody);
      logger.log("[WordCount] Observer cleaned up");
    }
  }
}
