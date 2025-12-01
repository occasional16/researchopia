/**
 * Rich Color Picker Enhancement
 * Inject custom color picker into note-editor toolbar color dropdowns
 * Allows selecting any color beyond the 8 presets
 */

import { logger } from "../../../utils/logger";

// Store observers per editor to clean up properly
const editorObservers = new WeakMap<Zotero.EditorInstance, MutationObserver>();

// CSS styles for custom color picker elements
const CUSTOM_COLOR_STYLES = `
  .researchopia-color-picker-btn {
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
  .researchopia-color-picker-btn:hover {
    background-color: var(--fill-quinary, #f0f0f0) !important;
  }
  .researchopia-color-picker-btn .icon {
    width: 16px !important;
    height: 16px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  .researchopia-color-picker-btn .name {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  .researchopia-color-input {
    position: absolute !important;
    opacity: 0 !important;
    pointer-events: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  .researchopia-color-preview {
    width: 14px !important;
    height: 14px !important;
    border-radius: 3px !important;
    border: 1px solid rgba(0,0,0,0.2) !important;
    background: linear-gradient(135deg, 
      #ff0000, #ff8000, #ffff00, #80ff00, 
      #00ff00, #00ff80, #00ffff, #0080ff, 
      #0000ff, #8000ff, #ff00ff, #ff0080) !important;
  }
`;

/**
 * Initialize color picker enhancement for an editor
 */
export async function initColorPicker(editor: Zotero.EditorInstance): Promise<void> {
  try {
    await editor._initPromise;
    
    const iframeWindow = editor._iframeWindow;
    const doc = iframeWindow?.document;
    if (!doc) {
      logger.warn("[ColorPicker] No iframe document available");
      return;
    }
    
    logger.log("[ColorPicker] Starting initialization for editor:", editor.instanceID);
    
    // Inject styles if not already present
    const existingStyles = doc.getElementById("researchopia-color-picker-styles");
    if (!existingStyles) {
      const head = doc.head || doc.getElementsByTagName('head')[0];
      if (head) {
        const styleEl = doc.createElement("style");
        styleEl.id = "researchopia-color-picker-styles";
        styleEl.textContent = CUSTOM_COLOR_STYLES;
        head.appendChild(styleEl);
        logger.log("[ColorPicker] Styles injected");
      } else {
        logger.warn("[ColorPicker] No head element found");
      }
    }
    
    // Set up mutation observer to inject buttons when dropdowns appear
    const existingObserver = editorObservers.get(editor);
    if (existingObserver) {
      existingObserver.disconnect();
    }
    
    const toolbar = doc.querySelector(".toolbar");
    if (!toolbar) {
      logger.warn("[ColorPicker] Toolbar not found");
      return;
    }
    
    // Get MutationObserver from the iframe window context
    const IframeMutationObserver = (iframeWindow as any).MutationObserver;
    if (!IframeMutationObserver) {
      logger.warn("[ColorPicker] MutationObserver not available in iframe");
      return;
    }
    
    // Get Element class from iframe window context (important for instanceof check)
    const IframeElement = (iframeWindow as any).Element;
    
    const observer = new IframeMutationObserver((mutations: MutationRecord[]) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          // Check for added popup elements
          mutation.addedNodes.forEach((node) => {
            // Use IframeElement from iframe context for instanceof check
            if (IframeElement && node instanceof IframeElement) {
              const el = node as Element;
              // Check if it's a color dropdown popup or contains one
              const popups = el.matches(".color-dropdown .popup") 
                ? [el] 
                : Array.from(el.querySelectorAll(".color-dropdown .popup"));
              
              popups.forEach((popup) => {
                injectColorPickerButton(popup as HTMLElement, editor, doc);
              });
            }
          });
        }
      }
    });
    
    observer.observe(toolbar, { childList: true, subtree: true });
    editorObservers.set(editor, observer);
    
    logger.log("[ColorPicker] Initialized for editor:", editor.instanceID);
  } catch (error) {
    // Properly log the error with message
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : '';
    logger.error("[ColorPicker] Error initializing:", errMsg, errStack);
  }
}

/**
 * Clean up color picker for an editor
 */
export function removeColorPicker(editor: Zotero.EditorInstance): void {
  const observer = editorObservers.get(editor);
  if (observer) {
    observer.disconnect();
    editorObservers.delete(editor);
  }
  
  const doc = editor._iframeWindow?.document;
  if (doc) {
    const styleEl = doc.getElementById("researchopia-color-picker-styles");
    if (styleEl) {
      styleEl.remove();
    }
  }
  
  logger.log("[ColorPicker] Removed for editor:", editor.instanceID);
}

/**
 * Inject custom color picker button into a dropdown popup
 */
function injectColorPickerButton(
  popup: HTMLElement, 
  editor: Zotero.EditorInstance,
  doc: Document
): void {
  // Skip if already injected
  if (popup.querySelector(".researchopia-color-picker-btn")) {
    return;
  }
  
  // Determine if this is a text color or highlight color dropdown
  const dropdown = popup.closest(".color-dropdown");
  if (!dropdown) return;
  
  // Check dropdown type by looking at the icon
  const iconSvg = dropdown.querySelector("button > svg");
  const isHighlight = iconSvg?.querySelector("path[fill-rule]")?.getAttribute("d")?.includes("M13.3839");
  const colorType = isHighlight ? "highlight" : "text";
  
  // Create separator
  const separator = doc.createElement("div");
  separator.className = "separator";
  separator.style.height = "1px";
  separator.style.backgroundColor = "var(--color-panedivider, #e0e0e0)";
  separator.style.margin = "4px 9px";
  
  // Create the custom color button
  const btn = doc.createElement("button");
  btn.className = "option researchopia-color-picker-btn";
  btn.setAttribute("role", "menuitem");
  btn.innerHTML = `
    <div class="icon">
      <div class="researchopia-color-preview"></div>
    </div>
    <div class="name">More Colors...</div>
  `;
  
  // Create hidden color input
  const colorInput = doc.createElement("input");
  colorInput.type = "color";
  colorInput.className = "researchopia-color-input";
  colorInput.value = "#ff0000";
  
  // Handle color selection
  colorInput.addEventListener("input", (e) => {
    const selectedColor = (e.target as HTMLInputElement).value;
    applyColor(editor, selectedColor, colorType);
  });
  
  colorInput.addEventListener("change", (e) => {
    const selectedColor = (e.target as HTMLInputElement).value;
    applyColor(editor, selectedColor, colorType);
    // Close dropdown after selection
    closeDropdown(dropdown as HTMLElement);
  });
  
  // Click button to open color picker
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    colorInput.click();
  });
  
  btn.addEventListener("mousedown", (e) => {
    e.preventDefault(); // Prevent dropdown from closing
  });
  
  // Append elements
  popup.appendChild(separator);
  popup.appendChild(btn);
  popup.appendChild(colorInput);
  
  logger.log(`[ColorPicker] Button injected for ${colorType} color dropdown`);
}

/**
 * Apply selected color to the editor
 * Uses the proper pluginState API from note-editor
 */
function applyColor(
  editor: Zotero.EditorInstance, 
  hexColor: string, 
  colorType: "text" | "highlight"
): void {
  try {
    // Validate hexColor
    logger.log("[ColorPicker] Attempting to apply color:", hexColor, "type:", colorType);
    
    if (!hexColor || typeof hexColor !== 'string') {
      logger.error("[ColorPicker] Invalid hexColor:", hexColor);
      return;
    }
    
    // Access the ProseMirror view through iframe window's _currentEditorInstance
    const iframeWindow = editor._iframeWindow as any;
    
    // In Zotero's XUL environment, we need to use wrappedJSObject to access the window object
    const unwrappedWindow = iframeWindow?.wrappedJSObject || iframeWindow;
    const currentEditorInstance = unwrappedWindow?._currentEditorInstance;
    const editorCore = currentEditorInstance?._editorCore;
    
    if (!editorCore) {
      logger.warn("[ColorPicker] EditorCore not found via _currentEditorInstance");
      return;
    }
    
    // Use the pluginState method which is the proper way to set colors
    // See: note-editor/src/core/plugins/text-color.js and highlight-color.js
    if (colorType === "text") {
      // textColor plugin exposes setColor method via pluginState
      const textColorPlugin = editorCore.pluginState?.textColor;
      if (textColorPlugin?.setColor) {
        textColorPlugin.setColor(hexColor);
        logger.log(`[ColorPicker] Applied text color via pluginState: ${hexColor}`);
      } else {
        logger.error("[ColorPicker] textColor pluginState not found, available:", Object.keys(editorCore.pluginState || {}));
      }
    } else {
      // highlightColor plugin exposes setColor method via pluginState  
      const highlightColorPlugin = editorCore.pluginState?.highlightColor;
      if (highlightColorPlugin?.setColor) {
        // Add 50% opacity for highlight colors (same as native behavior)
        const colorWithOpacity = hexColor + "80";
        highlightColorPlugin.setColor(colorWithOpacity);
        logger.log(`[ColorPicker] Applied highlight color via pluginState: ${colorWithOpacity}`);
      } else {
        logger.error("[ColorPicker] highlightColor pluginState not found, available:", Object.keys(editorCore.pluginState || {}));
      }
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error("[ColorPicker] Error applying color:", errMsg);
  }
}

/**
 * Close the dropdown
 */
function closeDropdown(dropdown: HTMLElement): void {
  // Find the button that opens the dropdown and simulate click to close
  const btn = dropdown.querySelector("button.toolbar-button") as HTMLElement;
  if (btn) {
    // Simulate blur to close
    setTimeout(() => {
      btn.blur();
      // Force close by removing active class if present
      dropdown.classList.remove("active");
      const popup = dropdown.querySelector(".popup") as HTMLElement;
      if (popup) {
        popup.style.display = "none";
      }
    }, 100);
  }
}
