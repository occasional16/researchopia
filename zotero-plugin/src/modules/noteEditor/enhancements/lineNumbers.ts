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

  // STRATEGY: Use ::before pseudo-element for li items to fix counter timing issue
  // REASON 1: Zotero's note-editor uses ::before on p, h1-h6, pre, blockquote for drag handle,
  //           but NOT on li elements - so we can use ::before for li
  // REASON 2: For nested lists, using ::after causes counter to show the FINAL value
  //           because CSS counters evaluate at render time from top-to-bottom.
  //           With nested li, when parent li's ::after renders, the counter already
  //           includes increments from child li elements.
  // SOLUTION: Use ::before for li (counter-increment happens AFTER the ::before displays)
  //           This ensures each li shows its own counter value, not the nested total.
  // 
  // For non-list elements (p, h1-h6, etc.), we still use ::after because:
  // - Zotero uses ::before for drag handles on these elements
  // - These elements don't have nested structures, so ::after works fine
  // 
  // DOM Structure Analysis:
  // - .ProseMirror is also .primary-editor (has both classes)
  // - Elements like p, h1 are direct children with position: relative already
  // - ul/ol need explicit position: relative
  // - blockquote has margin-left: 1em and padding-left: .75em
  
  styleEl.textContent = `
    /* Container setup - create space for line numbers on the left */
    .ProseMirror {
      counter-reset: researchopia-line-number !important;
      padding-left: 45px !important;
      position: relative !important;
    }

    /* Ensure all direct children have position relative for pseudo-element positioning */
    /* For non-list elements - use counter-increment here */
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
    
    /* Each list item - use ::before which displays BEFORE counter-increment */
    .ProseMirror li {
      position: relative !important;
    }

    /* Base line number styling for non-list elements - using ::after */
    /* These don't have nesting, so ::after works fine */
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
    
    /* List items: Use ::before to fix nested list counter issue */
    /* ::before displays BEFORE the counter-increment takes effect for this element */
    /* So we use counter-increment on ::before itself to increment then display */
    .primary-editor ul li::before,
    .primary-editor ol li::before {
      counter-increment: researchopia-line-number !important;
      content: counter(researchopia-line-number) !important;
      position: absolute !important;
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
    .primary-editor ul li li::before,
    .primary-editor ol li li::before,
    .primary-editor ul ul li::before,
    .primary-editor ol ol li::before {
      left: calc(-4rem - 45px) !important;
    }
    
    .primary-editor ul li li li::before,
    .primary-editor ol li li li::before,
    .primary-editor ul ul ul li::before,
    .primary-editor ol ol ol li::before {
      left: calc(-6rem - 45px) !important;
    }
    
    .primary-editor ul li li li li::before,
    .primary-editor ol li li li li::before {
      left: calc(-8rem - 45px) !important;
    }
    
    /* ============================================ */
    /* Blockquote - complex cases                  */
    /* ============================================ */
    
    /* Blockquote direct ::after - only for simple single-line blockquote */
    /* For blockquote with multiple p children or lists, we handle differently */
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
    
    /* ============================================ */
    /* Blockquote with multiple paragraphs         */
    /* ============================================ */
    
    /* Blockquote with child p elements should NOT show its own ::after line number */
    /* Each p inside will have its own line number */
    .ProseMirror > blockquote:has(> p)::after {
      content: none !important;
    }
    
    /* Blockquote with p children should NOT increment counter itself */
    .ProseMirror > blockquote:has(> p) {
      counter-increment: none !important;
    }
    
    /* p elements inside blockquote need line numbers */
    .ProseMirror > blockquote > p {
      position: relative !important;
      counter-increment: researchopia-line-number !important;
    }
    
    .ProseMirror > blockquote > p::after {
      content: counter(researchopia-line-number) !important;
      position: absolute !important;
      /* blockquote has margin-left: 1em, padding-left: 0.75em */
      /* User feedback: need to move left by about 11.2px more */
      left: calc(-45px - 1em - 0.75em + 4px - 11.2px) !important;
      width: 40px !important;
      text-align: right !important;
      padding-right: 5px !important;
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
    
    /* ============================================ */
    /* Blockquote containing lists - special case  */
    /* ============================================ */
    
    /* Blockquote with nested lists should NOT show its own line number */
    /* when it contains lists (the lists will have their own line numbers) */
    .ProseMirror > blockquote:has(> ul)::after,
    .ProseMirror > blockquote:has(> ol)::after {
      content: none !important;
    }
    
    /* Blockquote with nested lists should NOT increment counter itself */
    /* The list items will handle counting */
    .ProseMirror > blockquote:has(> ul),
    .ProseMirror > blockquote:has(> ol) {
      counter-increment: none !important;
    }
    
    /* Lists inside blockquote: position relative */
    .ProseMirror > blockquote > ul,
    .ProseMirror > blockquote > ol {
      position: relative !important;
    }
    
    /* List items inside blockquote: need special offset calculation */
    /* blockquote has margin-left: 1em, padding-left: 0.75em */
    /* ul/ol inside has padding-left: 2rem */
    .ProseMirror > blockquote ul li::before,
    .ProseMirror > blockquote ol li::before {
      counter-increment: researchopia-line-number !important;
      content: counter(researchopia-line-number) !important;
      position: absolute !important;
      /* Offset: 2rem (ul padding) + 1em (blockquote margin) + 0.75em (blockquote padding) + 45px (line number area) */
      /* User feedback: need to move left by about 7.2px more */
      left: calc(-2rem - 1em - 0.75em - 45px - 7.2px) !important;
      width: 40px !important;
      height: auto !important;
      text-align: right !important;
      padding-right: 5px !important;
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
    
    /* Nested lists inside blockquote */
    .ProseMirror > blockquote ul li li::before,
    .ProseMirror > blockquote ol li li::before,
    .ProseMirror > blockquote ul ul li::before,
    .ProseMirror > blockquote ol ol li::before {
      left: calc(-4rem - 1em - 0.75em - 45px - 7.2px) !important;
    }
    
    .ProseMirror > blockquote ul li li li::before,
    .ProseMirror > blockquote ol li li li::before {
      left: calc(-6rem - 1em - 0.75em - 45px - 7.2px) !important;
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
