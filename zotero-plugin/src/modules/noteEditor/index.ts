/**
 * Note Editor Module
 * 
 * Unified module for all Zotero Note Editor enhancements:
 * - Custom Search (Ctrl+F inline findbar with highlight)
 * - Line Numbers (CSS Counter based)
 * - Word Count (Status bar with lines/words/chars)
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

// Re-export enhancements
export { 
  initLineNumbers, 
  removeLineNumbers,
  initWordCount 
} from "./enhancements";
