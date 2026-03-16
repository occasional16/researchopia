/**
 * Format Painter Enhancement
 * Word-style format painter for Zotero note editor.
 * Single-click = one-shot; Double-click = locked mode (continuous painting).
 * Injects "Format Painter" button at the bottom of .text-dropdown .popup
 */

import { logger } from "../../../utils/logger";

// ─── Types ───────────────────────────────────────────────────────────

interface BlockFormat {
  leafNodeName: string;         // innermost textblock: "paragraph", "heading", "code_block"
  leafAttrs: Record<string, any>;
  wrappers: Array<{             // ancestor wrappers from outermost to innermost
    nodeName: string;           // "bulletList", "orderedList", "blockquote"
    attrs: Record<string, any>;
  }>;
}

interface FormatPainterState {
  active: boolean;
  locked: boolean;
  marks: any[] | null;
  blockFormat: BlockFormat | null;
}

// ─── Per-editor state ────────────────────────────────────────────────

const fpObservers = new WeakMap<Zotero.EditorInstance, MutationObserver>();
const painterState = new WeakMap<Zotero.EditorInstance, FormatPainterState>();
const fpCleanups = new WeakMap<Zotero.EditorInstance, Array<() => void>>();

// ─── CSS ─────────────────────────────────────────────────────────────

const FORMAT_PAINTER_STYLES = `
  /* Menu button */
  .researchopia-format-painter-btn {
    display: flex !important;
    align-items: center !important;
    width: 100% !important;
    height: 28px !important;
    border-radius: 5px !important;
    padding-inline-start: 22px !important;
    padding-inline-end: 10px !important;
    gap: 6px !important;
    cursor: pointer !important;
    background: none !important;
    border: none !important;
    font-size: 12px !important;
    color: var(--fill-primary, #333) !important;
  }
  .researchopia-format-painter-btn:hover {
    background-color: var(--fill-quinary, #f0f0f0) !important;
  }
  .researchopia-format-painter-btn .icon {
    width: 16px !important;
    height: 16px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  .researchopia-format-painter-btn .name {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  /* Toolbar indicator when format painter is active */
  .text-dropdown.researchopia-fp-active > .toolbar-button {
    background-color: var(--fill-quinary, #e0e0e0) !important;
    box-shadow: inset 0 0 0 1.5px var(--fill-tertiary, #bbb) !important;
    border-radius: 4px !important;
  }
  .text-dropdown.researchopia-fp-locked > .toolbar-button {
    background-color: var(--color-accent, #5b9dd9) !important;
    color: white !important;
    box-shadow: none !important;
  }

  /* Cursor change in editor area */
  .ProseMirror.researchopia-fp-cursor {
    cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='22' viewBox='0 0 18 22'%3E%3Cpath d='M12 1H4C3.45 1 3 1.45 3 2V6.5C3 7.05 3.45 7.5 4 7.5H5V9H6.5V7.5H9.5V9H11V7.5H12C12.55 7.5 13 7.05 13 6.5V2C13 1.45 12.55 1 12 1ZM11.5 6H4.5V2.5H11.5V6Z' fill='%23333'/%3E%3Cpath d='M9.5 9H6.5V12L4 20H7L9.5 12V9Z' fill='%23333'/%3E%3C/svg%3E") 3 20, crosshair !important;
  }
`;

// Brush SVG icon for menu button
const BRUSH_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M11 1H4C3.45 1 3 1.45 3 2V5.5C3 6.05 3.45 6.5 4 6.5H5V7.5H6V6.5H9V7.5H10V6.5H11C11.55 6.5 12 6.05 12 5.5V2C12 1.45 11.55 1 11 1ZM11 5.5H4V2H11V5.5Z" fill="currentColor"/>
  <path d="M9 7.5H6V10L4.5 14.5H7L9 10V7.5Z" fill="currentColor"/>
</svg>`;

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Get ProseMirror EditorView from editor instance
 */
function getEditorView(editor: Zotero.EditorInstance): any | null {
  try {
    const iframeWindow = editor._iframeWindow as any;
    const unwrapped = iframeWindow?.wrappedJSObject || iframeWindow;
    return unwrapped?._currentEditorInstance?._editorCore?.view ?? null;
  } catch {
    return null;
  }
}

/**
 * Capture inline marks from the current selection.
 * Follows Word behaviour: uses marks at the start of the selection.
 * Filters out `link` marks.
 */
function captureMarks(view: any): any[] | null {
  try {
    const { state } = view;
    const { from, to, empty } = state.selection;

    let marks: any[];
    if (empty) {
      marks = state.storedMarks || state.selection.$from.marks();
    } else {
      // Take marks at the first character of the selection (Word behaviour)
      marks = state.doc.resolve(from).marksAcross(state.doc.resolve(to))
        || state.selection.$from.marks();
    }

    // Filter out link
    return (marks || []).filter((m: any) => m.type.name !== "link");
  } catch (err) {
    logger.error("[FormatPainter] captureMarks error:", err);
    return null;
  }
}

/**
 * Capture block-level format from the selection start position.
 * Walks up the node tree to collect:
 * - The innermost textblock type (paragraph, heading, code_block)
 * - Any ancestor wrappers (bulletList, orderedList, blockquote)
 */
function captureBlockFormat(view: any): BlockFormat | null {
  try {
    const { state } = view;
    const $from = state.selection.$from;

    // The innermost textblock (direct parent of text)
    const leafNode = $from.parent;
    if (!leafNode) return null;

    const leafNodeName = leafNode.type.name;
    const leafAttrs = { ...leafNode.attrs };

    // Walk up ancestors to find wrapping nodes
    const WRAPPER_TYPES = new Set(["bulletList", "orderedList", "blockquote"]);
    const wrappers: BlockFormat["wrappers"] = [];

    for (let d = $from.depth - 1; d > 0; d--) {
      const ancestor = $from.node(d);
      const name = ancestor.type.name;
      if (WRAPPER_TYPES.has(name)) {
        // Prepend so order is outermost → innermost
        wrappers.unshift({ nodeName: name, attrs: { ...ancestor.attrs } });
      }
      // Skip listItem — it's an implicit structural node, not user-facing format
    }
    return { leafNodeName, leafAttrs, wrappers };
  } catch (err) {
    logger.error("[FormatPainter] captureBlockFormat error:", err);
    return null;
  }
}

/**
 * Apply captured marks to the current selection.
 * Clears all existing inline marks first, then adds the captured ones.
 */
function applyMarks(view: any, marks: any[]): void {
  try {
    const { state } = view;
    const { from, to } = state.selection;
    if (from === to) return; // no selection

    let tr = state.tr;

    // Remove all existing inline marks except link
    for (const markType of Object.values(state.schema.marks) as any[]) {
      if (markType.name === "link") continue;
      tr = tr.removeMark(from, to, markType);
    }

    // Add captured marks
    for (const mark of marks) {
      if (mark.type.name === "link") continue;
      tr = tr.addMark(from, to, mark);
    }

    view.dispatch(tr);
    logger.log(`[FormatPainter] Applied ${marks.length} marks to range [${from},${to}]`);
  } catch (err) {
    logger.error("[FormatPainter] applyMarks error:", err);
  }
}

/**
 * Apply captured block format to all blocks covered by the current selection.
 * Three phases:
 *   1. Lift target out of any existing wrappers (list, blockquote)
 *   2. Set textblock type (paragraph ↔ heading ↔ code_block)
 *   3. Wrap in captured wrappers (blockquote, bulletList, orderedList)
 *
 * Each phase dispatches separately so positions are recalculated.
 */
function applyBlockFormat(view: any, blockFormat: BlockFormat, editor: Zotero.EditorInstance): void {
  try {
    const schema = view.state.schema;

    // ── Phase 1: Lift out of existing wrappers ──
    liftOutOfWrappers(view);

    // ── Phase 2: Set textblock type ──
    const targetType = schema.nodes[blockFormat.leafNodeName];
    if (targetType && targetType.isTextblock) {
      const { from, to } = view.state.selection;
      const tr = view.state.tr.setBlockType(from, to, targetType, blockFormat.leafAttrs);
      view.dispatch(tr);
    }

    // ── Phase 3: Wrap in captured wrappers (outermost → innermost) ──
    for (const wrapper of blockFormat.wrappers) {
      wrapSelection(view, wrapper.nodeName, wrapper.attrs, editor);
    }

    logger.log(
      `[FormatPainter] Applied block format: ${blockFormat.leafNodeName}, wrappers=[${blockFormat.wrappers.map((w) => w.nodeName).join(",")}]`
    );
  } catch (err) {
    logger.error("[FormatPainter] applyBlockFormat error:", err);
  }
}

/**
 * Repeatedly lift the selection out of wrapping nodes (blockquote, list)
 * until it sits directly under the doc root.
 */
function liftOutOfWrappers(view: any): void {
  const WRAPPER_TYPES = new Set(["bulletList", "orderedList", "blockquote", "listItem"]);
  const MAX_ITERATIONS = 10;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const { state } = view;
    const { from, to } = state.selection;
    const $from = state.doc.resolve(from);
    const $to = state.doc.resolve(to);

    // Find an ancestor wrapper to lift out of
    let lifted = false;
    for (let d = $from.depth - 1; d > 0; d--) {
      const node = $from.node(d);
      if (!WRAPPER_TYPES.has(node.type.name)) continue;

      const range = $from.blockRange($to);
      if (!range) break;

      // Find a valid lift target depth
      const target = findLiftTarget(range);
      if (target == null) break;

      try {
        view.dispatch(state.tr.lift(range, target));
        lifted = true;
        break; // re-resolve after dispatch
      } catch {
        break; // lift failed structurally
      }
    }

    if (!lifted) break;
  }
}

/**
 * Find the lift target depth for a range.
 * Reimplements ProseMirror's liftTarget:
 * walks up ancestors and returns the first depth where content is allowed.
 */
function findLiftTarget(range: any): number | null {
  const parent = range.$from.node(range.depth);
  for (let d = range.depth - 1; d >= 0; d--) {
    const ancestor = range.$from.node(d);
    const index = range.$from.index(d);
    if (ancestor.canReplace(index, index, parent.content)) {
      return d;
    }
  }
  return null;
}

/**
 * Wrap the current selection in a wrapper node.
 * Uses ProseMirror's ContentMatch.findWrapping for proper wrapping computation,
 * replicating the logic of prosemirror-commands' wrapIn().
 *
 * CRITICAL: Due to XUL security wrappers, the wrapping array MUST be created
 * in the iframe's content world. Chrome-world arrays passed to content-world
 * ProseMirror code cause "Permission denied to access property 'length'".
 */
function wrapSelection(view: any, nodeName: string, attrs: Record<string, any>, editor: Zotero.EditorInstance): void {
  const { state } = view;
  const schema = state.schema;
  const wrapperType = schema.nodes[nodeName];
  if (!wrapperType) {
    logger.warn(`[FormatPainter] Wrapper type "${nodeName}" not in schema`);
    return;
  }

  const { from, to } = state.selection;
  const $from = state.doc.resolve(from);
  const $to = state.doc.resolve(to);
  const range = $from.blockRange($to);
  if (!range) {
    logger.warn(`[FormatPainter] No valid block range for wrapping`);
    return;
  }

  // Compute wrapping using ProseMirror's ContentMatch API
  const wrapping = computeWrapping(range, wrapperType, attrs);
  if (!wrapping) {
    logger.warn(
      `[FormatPainter] No valid wrapping for "${nodeName}" at depth=${range.depth}, parent=${range.parent.type.name}`
    );
    return;
  }

  // CRITICAL: Create the wrapping array in the iframe's content world
  // to avoid XUL security wrapper "Permission denied" errors.
  const contentWrapping = cloneWrappingToContentWorld(wrapping, editor);
  if (!contentWrapping) {
    logger.warn(`[FormatPainter] Failed to clone wrapping to content world`);
    return;
  }

  try {
    const tr = state.tr.wrap(range, contentWrapping);
    view.dispatch(tr);
    logger.log(`[FormatPainter] Successfully wrapped selection in "${nodeName}"`);
  } catch (err: any) {
    const msg = err?.message || err?.failed || String(err);
    logger.warn(`[FormatPainter] wrap(${nodeName}) failed: ${msg}`);
  }
}

/**
 * Clone a wrapping array into the iframe's content world.
 * Uses the iframe window's Array/Object constructors to create objects
 * that ProseMirror (running in content world) can access without security issues.
 */
function cloneWrappingToContentWorld(
  wrapping: Array<{ type: any; attrs?: Record<string, any> }>,
  editor: Zotero.EditorInstance
): any {
  try {
    const iframeWindow = editor._iframeWindow as any;
    // Get the content world's constructors via wrappedJSObject
    const contentWindow = iframeWindow?.wrappedJSObject || iframeWindow;
    const ContentArray = contentWindow.Array;
    const ContentObject = contentWindow.Object;

    if (!ContentArray || !ContentObject) {
      logger.warn("[FormatPainter] Cannot access content world constructors");
      return null;
    }

    const arr = new ContentArray();
    for (const w of wrapping) {
      const obj = new ContentObject();
      obj.type = w.type; // NodeType is already in content world
      if (w.attrs) {
        // Clone attrs into content world object
        const attrsObj = new ContentObject();
        for (const [key, val] of Object.entries(w.attrs)) {
          attrsObj[key] = val; // primitive values cross the boundary fine
        }
        obj.attrs = attrsObj;
      }
      arr.push(obj);
    }
    return arr;
  } catch (err: any) {
    logger.error("[FormatPainter] cloneWrappingToContentWorld error:", err?.message || String(err));
    return null;
  }
}

/**
 * Compute the correct wrapping array for Transform.wrap(), exactly replicating
 * ProseMirror's findWrapping() from prosemirror-transform.
 *
 * Returns an array of {type, attrs?} describing wrapper nodes from outermost to innermost,
 * or null if wrapping is impossible.
 *
 * Logic:
 *  1. outerWrapping = what nodes are needed between range's parent content and our wrapper
 *  2. innerWrapping = what nodes are needed between our wrapper and the range content
 *  3. Verify all children in the range are compatible with the innermost wrapper
 */
function computeWrapping(
  range: any,
  wrapperType: any,
  attrs?: Record<string, any>
): Array<{ type: any; attrs?: Record<string, any> }> | null {
  try {
    // Outer: nodes needed between range parent and our wrapper type
    const outerMatch = range.parent.contentMatchAt(range.startIndex);
    const outerTypes = outerMatch.findWrapping(wrapperType);
    if (!outerTypes) {
      logger.warn(`[FormatPainter] computeWrapping: outer findWrapping failed for ${wrapperType.name} (parent: ${range.parent.type.name})`);
      return null;
    }

    // Inner: nodes needed between our wrapper and the first child of the range
    const firstChild = range.parent.child(range.startIndex);
    const innerTypes = wrapperType.contentMatch.findWrapping(firstChild.type);
    if (!innerTypes) {
      logger.warn(
        `[FormatPainter] computeWrapping: inner findWrapping failed: ${wrapperType.name} → ${firstChild.type.name}`
      );
      return null;
    }

    // Verify all children in the range are compatible with the innermost type
    const innermostType = innerTypes.length > 0 ? innerTypes[innerTypes.length - 1] : wrapperType;
    for (let i = range.startIndex; i < range.endIndex; i++) {
      const child = range.parent.child(i);
      if (!innermostType.contentMatch.matchType(child.type)) {
        return null;
      }
    }

    // Build the full wrapping array
    return [
      ...outerTypes.map((t: any) => ({ type: t })),
      { type: wrapperType, attrs },
      ...innerTypes.map((t: any) => ({ type: t })),
    ];
  } catch (err: any) {
    logger.error("[FormatPainter] computeWrapping error:", err?.message || String(err));
    return null;
  }
}

// ─── Activation / Deactivation ───────────────────────────────────────

function activateFormatPainter(editor: Zotero.EditorInstance, locked: boolean): void {
  const view = getEditorView(editor);
  if (!view) {
    logger.warn("[FormatPainter] Cannot activate: no EditorView");
    return;
  }

  const marks = captureMarks(view);
  if (marks === null) {
    logger.warn("[FormatPainter] Cannot activate: failed to capture marks");
    return;
  }

  const blockFormat = captureBlockFormat(view);

  painterState.set(editor, { active: true, locked, marks, blockFormat });
  logger.log(`[FormatPainter] Activated (locked=${locked}, marks=${marks.length}, block=${blockFormat?.leafNodeName || 'none'}, wrappers=${blockFormat?.wrappers.length || 0})`);

  // Visual feedback
  setVisualState(editor, true, locked);

  // Install event listeners on the ProseMirror editor element
  installEditorListeners(editor);
}

function deactivateFormatPainter(editor: Zotero.EditorInstance): void {
  const state = painterState.get(editor);
  if (!state?.active) return;

  painterState.set(editor, { active: false, locked: false, marks: null, blockFormat: null });

  // Remove visual feedback
  setVisualState(editor, false, false);

  // Remove event listeners
  removeEditorListeners(editor);

  logger.log("[FormatPainter] Deactivated");
}

// ─── Visual state ────────────────────────────────────────────────────

function setVisualState(editor: Zotero.EditorInstance, active: boolean, locked: boolean): void {
  const doc = editor._iframeWindow?.document;
  if (!doc) return;

  const textDropdown = doc.querySelector(".text-dropdown");
  const prosemirror = doc.querySelector(".ProseMirror") as HTMLElement | null;

  if (active) {
    textDropdown?.classList.add("researchopia-fp-active");
    if (locked) textDropdown?.classList.add("researchopia-fp-locked");
    prosemirror?.classList.add("researchopia-fp-cursor");
  } else {
    textDropdown?.classList.remove("researchopia-fp-active", "researchopia-fp-locked");
    prosemirror?.classList.remove("researchopia-fp-cursor");
  }
}

// ─── Editor event listeners ──────────────────────────────────────────

function installEditorListeners(editor: Zotero.EditorInstance): void {
  // Clean up any previous listeners first
  removeEditorListeners(editor);

  const doc = editor._iframeWindow?.document;
  if (!doc) return;

  const prosemirror = doc.querySelector(".ProseMirror") as HTMLElement | null;
  if (!prosemirror) return;

  const cleanups: Array<() => void> = [];

  // mouseup → detect new selection and apply
  const onMouseUp = () => {
    // Use setTimeout to let ProseMirror update selection first
    // (requestAnimationFrame doesn't work reliably in XUL/Zotero environment)
    setTimeout(() => {
      const state = painterState.get(editor);
      if (!state?.active || !state.marks) return;

      const view = getEditorView(editor);
      if (!view) return;

      const { from, to } = view.state.selection;
      if (from === to) return; // no selection yet

      // Apply block-level format first, then inline marks
      if (state.blockFormat) {
        applyBlockFormat(view, state.blockFormat, editor);
      }
      applyMarks(view, state.marks);

      if (!state.locked) {
        deactivateFormatPainter(editor);
      }
    });
  };

  // keydown → Esc to exit
  const onKeyDown = (e: Event) => {
    if ((e as KeyboardEvent).key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      deactivateFormatPainter(editor);
    }
  };

  prosemirror.addEventListener("mouseup", onMouseUp);
  cleanups.push(() => prosemirror.removeEventListener("mouseup", onMouseUp));

  doc.addEventListener("keydown", onKeyDown, true);
  cleanups.push(() => doc.removeEventListener("keydown", onKeyDown, true));

  fpCleanups.set(editor, cleanups);
}

function removeEditorListeners(editor: Zotero.EditorInstance): void {
  const cleanups = fpCleanups.get(editor);
  if (cleanups) {
    for (const fn of cleanups) fn();
    fpCleanups.delete(editor);
  }
}

// ─── Dropdown button injection ───────────────────────────────────────

function injectFormatPainterButton(
  popup: HTMLElement,
  editor: Zotero.EditorInstance,
  doc: Document
): void {
  if (popup.querySelector(".researchopia-format-painter-btn")) return;

  // Separator
  const separator = doc.createElement("div");
  separator.className = "separator";
  separator.style.cssText = "height:1px;background-color:var(--color-panedivider,#e0e0e0);margin:4px 9px;";

  // Button
  const btn = doc.createElement("button");
  btn.className = "option researchopia-format-painter-btn";
  btn.setAttribute("role", "menuitem");
  btn.innerHTML = `
    <div class="icon">${BRUSH_ICON_SVG}</div>
    <div class="name">Format Painter</div>
  `;

  // Single-click / double-click detection
  let clickTimer: ReturnType<typeof setTimeout> | null = null;

  btn.addEventListener("mousedown", (e) => {
    e.preventDefault(); // prevent dropdown from closing & losing editor focus
  });

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (clickTimer !== null) {
      // Double-click → locked mode
      clearTimeout(clickTimer);
      clickTimer = null;
      activateFormatPainter(editor, true);
      closeDropdown(popup.closest(".text-dropdown") as HTMLElement);
    } else {
      clickTimer = setTimeout(() => {
        clickTimer = null;
        activateFormatPainter(editor, false);
        closeDropdown(popup.closest(".text-dropdown") as HTMLElement);
      }, 250);
    }
  });

  popup.appendChild(separator);
  popup.appendChild(btn);

  logger.log("[FormatPainter] Button injected into text-dropdown popup");
}

/**
 * Close a dropdown by blurring its button
 */
function closeDropdown(dropdown: HTMLElement | null): void {
  if (!dropdown) return;
  const btn = dropdown.querySelector("button.toolbar-button") as HTMLElement;
  if (btn) {
    setTimeout(() => {
      btn.blur();
      dropdown.classList.remove("active");
      const popup = dropdown.querySelector(".popup") as HTMLElement;
      if (popup) popup.style.display = "none";
    }, 50);
  }
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Initialize format painter for an editor instance
 */
export async function initFormatPainter(editor: Zotero.EditorInstance): Promise<void> {
  try {
    await editor._initPromise;

    const iframeWindow = editor._iframeWindow;
    const doc = iframeWindow?.document;
    if (!doc) {
      logger.warn("[FormatPainter] No iframe document available");
      return;
    }

    logger.log("[FormatPainter] Starting initialization for editor:", editor.instanceID);

    // Inject styles
    if (!doc.getElementById("researchopia-format-painter-styles")) {
      const head = doc.head || doc.getElementsByTagName("head")[0];
      if (head) {
        const style = doc.createElement("style");
        style.id = "researchopia-format-painter-styles";
        style.textContent = FORMAT_PAINTER_STYLES;
        head.appendChild(style);
      }
    }

    // Clean up previous observer if any
    const existing = fpObservers.get(editor);
    if (existing) existing.disconnect();

    const toolbar = doc.querySelector(".toolbar");
    if (!toolbar) {
      logger.warn("[FormatPainter] Toolbar not found");
      return;
    }

    const IframeMutationObserver = (iframeWindow as any).MutationObserver;
    if (!IframeMutationObserver) {
      logger.warn("[FormatPainter] MutationObserver not available in iframe");
      return;
    }

    const IframeElement = (iframeWindow as any).Element;

    const observer = new IframeMutationObserver((mutations: MutationRecord[]) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (IframeElement && node instanceof IframeElement) {
              const el = node as Element;
              const popups = el.matches(".text-dropdown .popup")
                ? [el]
                : Array.from(el.querySelectorAll(".text-dropdown .popup"));
              popups.forEach((p) => injectFormatPainterButton(p as HTMLElement, editor, doc));
            }
          });
        }
      }
    });

    observer.observe(toolbar, { childList: true, subtree: true });
    fpObservers.set(editor, observer);

    logger.log("[FormatPainter] Initialized for editor:", editor.instanceID);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : "";
    logger.error("[FormatPainter] Error initializing:", msg, stack);
  }
}

/**
 * Remove format painter from an editor instance
 */
export function removeFormatPainter(editor: Zotero.EditorInstance): void {
  deactivateFormatPainter(editor);

  const observer = fpObservers.get(editor);
  if (observer) {
    observer.disconnect();
    fpObservers.delete(editor);
  }

  const doc = editor._iframeWindow?.document;
  if (doc) {
    doc.getElementById("researchopia-format-painter-styles")?.remove();
    // Remove any injected buttons
    doc.querySelectorAll(".researchopia-format-painter-btn").forEach((el) => el.remove());
  }

  logger.log("[FormatPainter] Removed for editor:", editor.instanceID);
}
