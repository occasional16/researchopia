/**
 * Zotero 8 UI渲染器 (现代HTML组件)
 * 保持现有HTML元素创建方式
 */

import { IUIRenderer, PanelOptions, ButtonOptions, TextboxOptions } from './ui-types';

export class ModernUIRenderer implements IUIRenderer {
  createPanel(options: PanelOptions): HTMLElement {
    const panel = document.createElement('div');
    if (options.id) panel.id = options.id;
    if (options.className) panel.className = options.className;
    if (options.styles) this.applyStyles(panel, options.styles);
    
    if (options.children) {
      options.children.forEach(child => {
        if (typeof child === 'string') {
          panel.appendChild(document.createTextNode(child));
        } else {
          panel.appendChild(child);
        }
      });
    }
    
    return panel;
  }

  createButton(options: ButtonOptions): HTMLElement {
    const button = document.createElement('button');
    button.textContent = options.label;
    button.onclick = options.onClick;
    if (options.id) button.id = options.id;
    if (options.className) button.className = options.className;
    if (options.disabled) button.disabled = true;
    if (options.styles) this.applyStyles(button, options.styles);
    return button;
  }

  createTextbox(options: TextboxOptions): HTMLElement {
    const textbox = options.multiline 
      ? document.createElement('textarea') 
      : document.createElement('input');
    
    if (!options.multiline) {
      (textbox as HTMLInputElement).type = 'text';
    } else if (options.rows) {
      (textbox as HTMLTextAreaElement).rows = options.rows;
    }
    
    if (options.id) textbox.id = options.id;
    if (options.value) (textbox as any).value = options.value;
    if (options.placeholder) (textbox as any).placeholder = options.placeholder;
    if (options.styles) this.applyStyles(textbox, options.styles);
    
    return textbox;
  }

  applyStyles(element: HTMLElement, styles: Record<string, string>): void {
    Object.assign(element.style, styles);
  }
}
