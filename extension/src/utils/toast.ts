/**
 * Toast Notification Utility
 * Unified toast display across popup, sidebar, and content script
 */

import type { ToastType, ToastOptions } from '../types/dom';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_DURATION = 3000;
const TOAST_ID = 'toast';

// Style configurations for different toast types
const TOAST_STYLES: Record<ToastType, { background: string; color: string }> = {
  info: { background: '#333', color: '#fff' },
  success: { background: '#10b981', color: '#fff' },
  error: { background: '#ef4444', color: '#fff' },
  warning: { background: '#f59e0b', color: '#fff' },
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Show a toast notification
 */
export function showToast(options: ToastOptions): void;
export function showToast(message: string, type?: ToastType): void;
export function showToast(
  messageOrOptions: string | ToastOptions,
  typeArg?: ToastType
): void {
  const options: ToastOptions = typeof messageOrOptions === 'string'
    ? { message: messageOrOptions, type: typeArg }
    : messageOrOptions;

  const {
    message,
    type = 'info',
    duration = DEFAULT_DURATION,
    position = 'bottom',
  } = options;

  const toast = document.getElementById(TOAST_ID);
  if (!toast) {
    console.warn('Toast element not found. Make sure you have <div id="toast"></div> in your HTML.');
    return;
  }

  // Set content and styles
  toast.textContent = message;
  
  const styles = TOAST_STYLES[type];
  toast.style.backgroundColor = styles.background;
  toast.style.color = styles.color;

  // Position
  toast.style.position = 'fixed';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  
  switch (position) {
    case 'top':
      toast.style.top = '20px';
      toast.style.bottom = 'auto';
      break;
    case 'center':
      toast.style.top = '50%';
      toast.style.transform = 'translate(-50%, -50%)';
      break;
    case 'bottom':
    default:
      toast.style.top = 'auto';
      toast.style.bottom = '20px';
      break;
  }

  // Base styles
  Object.assign(toast.style, {
    padding: '10px 20px',
    borderRadius: '6px',
    zIndex: '10000',
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    transition: 'opacity 0.3s ease',
  });

  // Show
  toast.style.display = 'block';
  toast.style.opacity = '1';

  // Auto-hide
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 300);
  }, duration);
}

/**
 * Hide the toast immediately
 */
export function hideToast(): void {
  const toast = document.getElementById(TOAST_ID);
  if (toast) {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 300);
  }
}

/**
 * Show success toast
 */
export function showSuccess(message: string, duration?: number): void {
  showToast({ message, type: 'success', duration });
}

/**
 * Show error toast
 */
export function showError(message: string, duration?: number): void {
  showToast({ message, type: 'error', duration });
}

/**
 * Show warning toast
 */
export function showWarning(message: string, duration?: number): void {
  showToast({ message, type: 'warning', duration });
}

/**
 * Show info toast
 */
export function showInfo(message: string, duration?: number): void {
  showToast({ message, type: 'info', duration });
}

// ============================================================================
// Content Script Toast (Floating)
// ============================================================================

/**
 * Create a temporary floating toast (for content scripts)
 * This creates its own element instead of relying on an existing one
 */
export function showFloatingToast(message: string, type: ToastType = 'info', duration = 3000): void {
  // Remove existing
  const existing = document.getElementById('researchopia-toast');
  if (existing) existing.remove();

  // Create new
  const toast = document.createElement('div');
  toast.id = 'researchopia-toast';
  
  const styles = TOAST_STYLES[type];
  
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: ${styles.background};
    color: ${styles.color};
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 2147483648;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Microsoft YaHei', sans-serif;
    transition: opacity 0.3s ease;
  `;

  document.body.appendChild(toast);

  // Auto-remove
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
