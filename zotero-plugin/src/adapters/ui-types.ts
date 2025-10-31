/**
 * UI适配器接口定义
 * 为Zotero 7/8提供统一的UI创建接口
 */

// ============ 选项类型定义 ============

export interface PanelOptions {
  id?: string;
  className?: string;
  styles?: Record<string, string>;
  children?: Array<HTMLElement | any | string>; // any for XUL compatibility
}

export interface ButtonOptions {
  label: string;
  onClick: () => void;
  styles?: Record<string, string>;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export interface TextboxOptions {
  value?: string;
  placeholder?: string;
  multiline?: boolean;
  styles?: Record<string, string>;
  id?: string;
  rows?: number;
}

// ============ UI渲染器接口 ============

export interface IUIRenderer {
  /**
   * 创建面板容器
   */
  createPanel(options: PanelOptions): HTMLElement | any;

  /**
   * 创建按钮
   */
  createButton(options: ButtonOptions): HTMLElement | any;

  /**
   * 创建文本框
   */
  createTextbox(options: TextboxOptions): HTMLElement | any;

  /**
   * 应用样式
   */
  applyStyles(element: any, styles: Record<string, string>): void;
}
