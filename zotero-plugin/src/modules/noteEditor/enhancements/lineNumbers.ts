/**
 * Line Numbers Module
 * Adds line numbers to the note editor
 */

import { logger } from "../../../utils/logger";

/**
 * Initialize line numbers for an editor
 * Uses CSS Counters for high performance and perfect scrolling sync
 * @param editor - Zotero editor instance
 */
export async function initLineNumbers(editor: Zotero.EditorInstance) {
  await editor._initPromise;
  
  const doc = editor._iframeWindow?.document;
  if (!doc) {
    logger.warn("[LineNumbers] No iframe document");
    return;
  }

  logger.log("[LineNumbers] Document URL:", doc.location.href);
  logger.log("[LineNumbers] Document Title:", doc.title);

  const editorBody = doc.querySelector('.ProseMirror') as HTMLElement;
  if (!editorBody) {
    logger.warn("[LineNumbers] No .ProseMirror element");
    // Try to find body
    logger.log("[LineNumbers] Body classes:", doc.body.className);
    return;
  }

  // Debug: Log DOM structure
  logger.log("[LineNumbers] Editor body found. Children tags:");
  const children = Array.from(editorBody.children).map(c => c.tagName);
  logger.log("[LineNumbers] " + JSON.stringify(children));

  // Cleanup any existing JS-based implementation
  const oldContainer = doc.getElementById('researchopia-line-numbers');
  if (oldContainer) {
    logger.log("[LineNumbers] Removing legacy JS implementation container");
    oldContainer.remove();
  }

  // Inject CSS for line numbers
  const styleId = 'researchopia-line-numbers-style';
  let styleEl = doc.getElementById(styleId) as HTMLStyleElement;
  
  if (!styleEl) {
    logger.log("[LineNumbers] Creating style element");
    styleEl = doc.createElement('style');
    styleEl.id = styleId;
    // Try head, fallback to body or documentElement
    (doc.head || doc.body || doc.documentElement).appendChild(styleEl);
  } else {
    logger.log("[LineNumbers] Updating existing style element");
  }

  // STRATEGY: Use ::after pseudo-element instead of ::before
  // REASON: Zotero's note-editor already uses ::before on p, h1-h6, pre, blockquote
  //         for drag handle area (see _core.scss: .primary-editor > p, h1... &:before)
  // KEY INSIGHT: padding-left on container creates space, but ::after is positioned
  //              relative to the element's content box. We need negative left.
  // 
  // DOM Structure Analysis:
  // - .ProseMirror is also .primary-editor (has both classes)
  // - Elements like p, h1 are direct children with position: relative already
  // - ul/ol need explicit position: relative
  // - blockquote has margin-left: 1em and padding-left: .75em
  // - IMPORTANT: Zotero uses li::after with content: "" for selection styling
  //   We need to override this with higher specificity
  
  styleEl.textContent = `
    /* Container setup - create space for line numbers on the left */
    .ProseMirror {
      counter-reset: researchopia-line-number !important;
      padding-left: 45px !important;
      position: relative !important;
    }

    /* Ensure all direct children have position relative for ::after positioning */
    /* For non-list elements */
    .ProseMirror > p,
    .ProseMirror > h1,
    .ProseMirror > h2,
    .ProseMirror > h3,
    .ProseMirror > h4,
    .ProseMirror > h5,
    .ProseMirror > h6,
    .ProseMirror > pre,
    .ProseMirror > blockquote,
    .ProseMirror > math-display {
      position: relative !important;
      counter-increment: researchopia-line-number !important;
    }
    
    /* Lists: only set position relative on the container, don't increment counter here */
    .ProseMirror > ul,
    .ProseMirror > ol {
      position: relative !important;
      /* Do NOT increment counter on list container - we'll count items instead */
    }
    
    /* Each list item (including nested) increments counter */
    .ProseMirror li {
      counter-increment: researchopia-line-number !important;
    }

    /* Base line number styling - common properties */
    /* Light mode colors (default) */
    .ProseMirror > p::after,
    .ProseMirror > h1::after,
    .ProseMirror > h2::after,
    .ProseMirror > h3::after,
    .ProseMirror > h4::after,
    .ProseMirror > h5::after,
    .ProseMirror > h6::after,
    .ProseMirror > pre::after,
    .ProseMirror > math-display::after {
      content: counter(researchopia-line-number) !important;
      position: absolute !important;
      left: -45px !important;
      width: 40px !important;
      text-align: right !important;
      padding-right: 5px !important;
      /* Production styling */
      color: var(--fill-tertiary, #999) !important;
      background: transparent !important;
      font-size: 12px !important;
      font-weight: normal !important;
      font-family: monospace !important;
      line-height: inherit !important;
      user-select: none !important;
      pointer-events: none !important;
      top: 0 !important;
      z-index: 9999 !important;
      box-sizing: border-box !important;
    }
    
    /* List items: Override Zotero's li::after which has content: "" */
    /* Use higher specificity: .primary-editor ul li::after, .primary-editor ol li::after */
    .primary-editor ul li::after,
    .primary-editor ol li::after {
      content: counter(researchopia-line-number) !important;
      position: absolute !important;
      /* Reset Zotero's default margin-left: -100px and width: 100px */
      margin-left: 0 !important;
      /* ul/ol has padding-left: 2rem. Position line number in container's padding area */
      left: calc(-2rem - 45px) !important;
      width: 40px !important;
      height: auto !important;
      text-align: right !important;
      padding-right: 5px !important;
      /* Production styling */
      color: var(--fill-tertiary, #999) !important;
      background: transparent !important;
      font-size: 12px !important;
      font-weight: normal !important;
      font-family: monospace !important;
      line-height: 1.5 !important;
      user-select: none !important;
      pointer-events: none !important;
      top: 0 !important;
      z-index: 9999 !important;
      box-sizing: border-box !important;
    }
    
    /* Nested lists: li > ul/ol > li need more negative offset */
    /* Each nesting level adds another 2rem of indent */
    .primary-editor ul li li::after,
    .primary-editor ol li li::after,
    .primary-editor ul ul li::after,
    .primary-editor ol ol li::after {
      left: calc(-4rem - 45px) !important;
    }
    
    .primary-editor ul li li li::after,
    .primary-editor ol li li li::after,
    .primary-editor ul ul ul li::after,
    .primary-editor ol ol ol li::after {
      left: calc(-6rem - 45px) !important;
    }
    
    .primary-editor ul li li li li::after,
    .primary-editor ol li li li li::after {
      left: calc(-8rem - 45px) !important;
    }
    
    /* blockquote has margin-left: 1em, padding-left: .75em */
    /* Adjusted: was left about 4.2px too far left, so reduce the offset slightly */
    .ProseMirror > blockquote::after {
      content: counter(researchopia-line-number) !important;
      position: absolute !important;
      /* Original: calc(-45px - 1em - 0.75em), adjusted to move right by ~4px */
      left: calc(-45px - 1em - 0.75em + 4px) !important;
      width: 40px !important;
      text-align: right !important;
      padding-right: 5px !important;
      /* Production styling */
      color: var(--fill-tertiary, #999) !important;
      background: transparent !important;
      font-size: 12px !important;
      font-weight: normal !important;
      font-family: monospace !important;
      line-height: inherit !important;
      user-select: none !important;
      pointer-events: none !important;
      top: 0 !important;
      z-index: 9999 !important;
      box-sizing: border-box !important;
    }
  `;
  
  logger.log("[LineNumbers] CSS injected. Style connected:", styleEl.isConnected);
}

/**
 * Remove line numbers from an editor
 * @param editor - Zotero editor instance
 */
export function removeLineNumbers(editor: Zotero.EditorInstance) {
  const doc = editor._iframeWindow?.document;
  if (!doc) return;

  // Remove CSS
  const styleEl = doc.getElementById('researchopia-line-numbers-style');
  if (styleEl) {
    styleEl.remove();
  }

  // Remove legacy JS container if exists
  const container = doc.getElementById('researchopia-line-numbers');
  if (container) {
    if ((container as any)._observer) {
      (container as any)._observer.disconnect();
    }
    container.remove();
  }
  
  // Restore editor padding (if it was set inline by legacy code)
  const editorBody = doc.querySelector('.ProseMirror') as HTMLElement;
  if (editorBody) {
    editorBody.style.paddingLeft = '';
  }
}
