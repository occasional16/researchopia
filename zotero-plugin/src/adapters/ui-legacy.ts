/**
 * Zotero 7 UI渲染器 (XUL组件降级)
 * 使用XUL元素或简化的HTML
 */

import { IUIRenderer, PanelOptions, ButtonOptions, TextboxOptions } from './ui-types';

import { logger } from "../utils/logger";
export class LegacyUIRenderer implements IUIRenderer {
  createPanel(options: PanelOptions): any {
    // Zotero 7 优先尝试创建HTML div (更好的样式支持)
    // 如果失败则降级到XUL vbox
    try {
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
    } catch (error) {
      // 降级到XUL
      logger.warn('[Legacy UI] Falling back to XUL vbox:', error);
      // @ts-ignore - XUL elements
      const panel = document.createXULElement('vbox') as any;
      if (options.id) panel.id = options.id;
      if (options.className) panel.className = options.className;
      if (options.styles) this.applyStyles(panel, options.styles);
      
      if (options.children) {
        options.children.forEach(child => {
          if (typeof child === 'string') {
            // @ts-ignore
            const label = document.createXULElement('label');
            label.setAttribute('value', child);
            panel.appendChild(label);
          } else {
            panel.appendChild(child);
          }
        });
      }
      
      return panel;
    }
  }

  createButton(options: ButtonOptions): any {
    // 尝试HTML button (更好的样式)
    try {
      const button = document.createElement('button');
      button.textContent = options.label;
      button.onclick = options.onClick;
      if (options.id) button.id = options.id;
      if (options.className) button.className = options.className;
      if (options.disabled) button.disabled = true;
      if (options.styles) this.applyStyles(button, options.styles);
      return button;
    } catch (error) {
      // 降级到XUL button
      logger.warn('[Legacy UI] Falling back to XUL button:', error);
      // @ts-ignore
      const button = document.createXULElement('button') as any;
      button.setAttribute('label', options.label);
      button.addEventListener('command', options.onClick);
      if (options.id) button.id = options.id;
      if (options.className) button.className = options.className;
      if (options.disabled) button.setAttribute('disabled', 'true');
      if (options.styles) this.applyStyles(button, options.styles);
      return button;
    }
  }

  createTextbox(options: TextboxOptions): any {
    // 尝试HTML input/textarea
    try {
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
    } catch (error) {
      // 降级到XUL textbox
      logger.warn('[Legacy UI] Falling back to XUL textbox:', error);
      // @ts-ignore
      const textbox = document.createXULElement('textbox') as any;
      if (options.multiline) {
        textbox.setAttribute('multiline', 'true');
        textbox.setAttribute('rows', String(options.rows || 5));
      }
      if (options.id) textbox.id = options.id;
      if (options.value) textbox.setAttribute('value', options.value);
      if (options.placeholder) textbox.setAttribute('placeholder', options.placeholder);
      if (options.styles) this.applyStyles(textbox, options.styles);
      
      return textbox;
    }
  }

  applyStyles(element: any, styles: Record<string, string>): void {
    // 尝试直接设置style对象 (HTML元素)
    if (element.style && typeof element.style === 'object') {
      Object.assign(element.style, styles);
    } else {
      // 降级到style属性字符串 (XUL元素)
      const styleStr = Object.entries(styles)
        .map(([key, value]) => `${this.camelToKebab(key)}: ${value}`)
        .join('; ');
      element.setAttribute('style', styleStr);
    }
  }

  private camelToKebab(str: string): string {
    return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  }
}
