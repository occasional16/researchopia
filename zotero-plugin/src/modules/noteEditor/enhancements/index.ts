/**
 * Note Editor Enhancements Module Entry Point
 * 
 * Exports all editor enhancement features:
 * - Line Numbers
 * - Word Count
 * - Scroll Preserver (multi-window scroll position preservation)
 * - Heading Collapse (H1-H3 collapsible sections)
 * - Color Picker (rich color selection beyond 8 presets)
 */

export { initLineNumbers, removeLineNumbers } from "./lineNumbers";
export { initWordCount, removeWordCount } from "./wordCount";
export { 
  initScrollPreserverSystem, 
  destroyScrollPreserverSystem,
  registerEditorForScrollPreservation,
  unregisterEditorFromScrollPreservation
} from "./scrollPreserver";
export {
  initHeadingCollapseSystem,
  destroyHeadingCollapseSystem
} from "./headingCollapse";
export {
  initColorPicker,
  removeColorPicker
} from "./colorPicker";
