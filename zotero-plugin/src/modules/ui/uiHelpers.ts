/**
 * UI辅助工具函数
 * 提供通用的UI元素创建功能
 */

import { colors, spacing, fontSize, borderRadius, buttonStyles, inputStyle } from './styles';

/**
 * 创建按钮
 */
export function createButton(
  doc: Document,
  text: string,
  variant: 'primary' | 'success' | 'danger' | 'warning' | 'secondary' = 'primary',
  options?: {
    fullWidth?: boolean;
    disabled?: boolean;
  }
): HTMLButtonElement {
  const button = doc.createElement('button');
  button.textContent = text;
  button.style.cssText = buttonStyles[variant];
  
  if (options?.fullWidth) {
    button.style.width = '100%';
  }
  
  if (options?.disabled) {
    button.disabled = true;
    button.style.opacity = '0.6';
    button.style.cursor = 'not-allowed';
  }
  
  // 悬停效果
  button.addEventListener('mouseenter', () => {
    if (!options?.disabled) {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = `0 4px 8px ${colors.shadow}`;
    }
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = 'none';
  });
  
  return button;
}

/**
 * 创建返回按钮
 */
export function createBackButton(
  doc: Document,
  onClick: () => void
): HTMLButtonElement {
  const button = doc.createElement('button');
  button.textContent = '← 返回';
  button.style.cssText = `
    position: absolute;
    top: ${spacing.sm};
    left: ${spacing.sm};
    padding: 6px 14px;
    background: rgba(108, 117, 125, 0.1);
    color: ${colors.secondary};
    border: 1px solid ${colors.border};
    border-radius: ${borderRadius.round};
    cursor: pointer;
    font-size: ${fontSize.sm};
    font-weight: 500;
    transition: all 0.2s;
    z-index: 10;
  `;
  
  button.addEventListener('mouseenter', () => {
    button.style.background = 'rgba(108, 117, 125, 0.2)';
    button.style.borderColor = '#adb5bd';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.background = 'rgba(108, 117, 125, 0.1)';
    button.style.borderColor = colors.border;
  });
  
  button.addEventListener('click', onClick);
  
  return button;
}

/**
 * 创建输入框
 */
export function createInput(
  doc: Document,
  type: 'text' | 'number' | 'email' = 'text',
  placeholder?: string,
  defaultValue?: string
): HTMLInputElement {
  const input = doc.createElement('input');
  input.type = type;
  input.style.cssText = inputStyle;
  
  if (placeholder) {
    input.placeholder = placeholder;
  }
  
  if (defaultValue) {
    input.value = defaultValue;
  }
  
  // 聚焦效果
  input.addEventListener('focus', () => {
    input.style.borderColor = colors.primary;
    input.style.outline = `2px solid ${colors.primary}33`;
  });
  
  input.addEventListener('blur', () => {
    input.style.borderColor = colors.border;
    input.style.outline = 'none';
  });
  
  return input;
}

/**
 * 创建文本域
 */
export function createTextarea(
  doc: Document,
  placeholder?: string,
  rows: number = 3
): HTMLTextAreaElement {
  const textarea = doc.createElement('textarea');
  textarea.rows = rows;
  textarea.style.cssText = `
    ${inputStyle}
    resize: vertical;
    min-height: 60px;
  `;
  
  if (placeholder) {
    textarea.placeholder = placeholder;
  }
  
  // 聚焦效果
  textarea.addEventListener('focus', () => {
    textarea.style.borderColor = colors.primary;
    textarea.style.outline = `2px solid ${colors.primary}33`;
  });
  
  textarea.addEventListener('blur', () => {
    textarea.style.borderColor = colors.border;
    textarea.style.outline = 'none';
  });
  
  return textarea;
}

/**
 * 创建选择框
 */
export function createSelect(
  doc: Document,
  options: Array<{ value: string; label: string }>,
  defaultValue?: string
): HTMLSelectElement {
  const select = doc.createElement('select');
  select.style.cssText = inputStyle;
  
  options.forEach(opt => {
    const option = doc.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (defaultValue === opt.value) {
      option.selected = true;
    }
    select.appendChild(option);
  });
  
  return select;
}

/**
 * 创建标签
 */
export function createLabel(
  doc: Document,
  text: string,
  required: boolean = false
): HTMLLabelElement {
  const label = doc.createElement('label');
  label.textContent = text;
  label.style.cssText = `
    display: block;
    font-weight: 600;
    font-size: ${fontSize.md};
    color: ${colors.dark};
    margin-bottom: ${spacing.xs};
  `;
  
  if (required) {
    const asterisk = doc.createElement('span');
    asterisk.textContent = ' *';
    asterisk.style.color = colors.danger;
    label.appendChild(asterisk);
  }
  
  return label;
}

/**
 * 创建空状态提示
 */
export function createEmptyState(
  doc: Document,
  icon: string,
  message: string,
  subMessage?: string
): HTMLElement {
  const container = doc.createElement('div');
  container.style.cssText = `
    padding: ${spacing.xxl};
    text-align: center;
    color: ${colors.gray};
  `;
  
  const iconDiv = doc.createElement('div');
  iconDiv.textContent = icon;
  iconDiv.style.cssText = `
    font-size: 48px;
    margin-bottom: ${spacing.lg};
  `;
  container.appendChild(iconDiv);
  
  const messageDiv = doc.createElement('div');
  messageDiv.textContent = message;
  messageDiv.style.fontSize = fontSize.base;
  container.appendChild(messageDiv);
  
  if (subMessage) {
    const subDiv = doc.createElement('div');
    subDiv.textContent = subMessage;
    subDiv.style.cssText = `
      font-size: ${fontSize.sm};
      color: ${colors.grayLight};
      margin-top: ${spacing.sm};
    `;
    container.appendChild(subDiv);
  }
  
  return container;
}

/**
 * 创建加载提示
 */
export function createLoadingState(doc: Document, message: string = '加载中...'): HTMLElement {
  const container = doc.createElement('div');
  container.style.cssText = `
    text-align: center;
    padding: ${spacing.xxl};
    color: ${colors.gray};
  `;
  container.textContent = message;
  return container;
}

/**
 * 创建错误提示
 */
export function createErrorState(doc: Document, message: string): HTMLElement {
  const container = doc.createElement('div');
  container.style.cssText = `
    text-align: center;
    padding: ${spacing.xxl};
    color: ${colors.danger};
  `;
  container.textContent = `❌ ${message}`;
  return container;
}
