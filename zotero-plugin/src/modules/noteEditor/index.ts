/**
 * Note Editor Module
 * 
 * Unified module for all Zotero Note Editor enhancements:
 * - Custom Search (Ctrl+F inline findbar with highlight)
 * - Line Numbers (CSS Counter based)
 * - Word Count (Status bar with lines/words/chars)
 * - Scroll Position Preserver (Multi-window editing support)
 * - Heading Collapse (Collapsible H1-H3 headings)
 * 
 * @module noteEditor
 */

// Re-export from toolbar (main entry point)
export { initEditorToolbar } from "./toolbar";

// Re-export search module
export { 
  CustomSearchModule,
  SearchManager,
  InlineFindbar 
} from "./search";

// Re-export all enhancements (including scrollPreserver and headingCollapse)
export { 
  initLineNumbers, 
  removeLineNumbers,
  initWordCount,
  initScrollPreserverSystem,
  registerEditorForScrollPreservation,
  unregisterEditorFromScrollPreservation,
  destroyScrollPreserverSystem,
  initHeadingCollapseSystem,
  destroyHeadingCollapseSystem
} from "./enhancements";

// Re-export classes for direct access (if needed)
export { ScrollPreserver } from "./enhancements/scrollPreserver";
export { HeadingCollapse } from "./enhancements/headingCollapse";
