/**
 * UI适配器
 * 为Zotero 7/8提供统一的UI创建接口
 */

import { ZoteroVersionDetector } from '../utils/version-detector';
import { ModernUIRenderer } from './ui-modern';
import { LegacyUIRenderer } from './ui-legacy';
import { IUIRenderer, PanelOptions, ButtonOptions, TextboxOptions } from './ui-types';

export class UIAdapter {
  private static renderer: IUIRenderer | null = null;

  /**
   * 获取UI渲染器
   */
  static getRenderer(): IUIRenderer {
    if (this.renderer) {
      return this.renderer;
    }

    if (ZoteroVersionDetector.isZotero8()) {
      console.log('[UI Adapter] Using ModernUIRenderer for Zotero 8');
      this.renderer = new ModernUIRenderer();
    } else {
      console.log('[UI Adapter] Using LegacyUIRenderer for Zotero 7');
      this.renderer = new LegacyUIRenderer();
    }

    return this.renderer;
  }

  /**
   * 创建面板容器
   */
  static createPanel(options: PanelOptions): HTMLElement | any {
    return this.getRenderer().createPanel(options);
  }

  /**
   * 创建按钮
   */
  static createButton(options: ButtonOptions): HTMLElement | any {
    return this.getRenderer().createButton(options);
  }

  /**
   * 创建文本框
   */
  static createTextbox(options: TextboxOptions): HTMLElement | any {
    return this.getRenderer().createTextbox(options);
  }

  /**
   * 应用样式 (统一接口)
   */
  static applyStyles(element: any, styles: Record<string, string>): void {
    this.getRenderer().applyStyles(element, styles);
  }
}

// 重新导出类型
export { PanelOptions, ButtonOptions, TextboxOptions } from './ui-types';
