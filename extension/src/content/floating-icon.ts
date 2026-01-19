/**
 * Floating Icon Module
 * Handles the floating icon display, dragging, and click interactions
 * 
 * Features:
 * 1. Compact circular icon (40x40px)
 * 2. Hover to expand with text
 * 3. Right-click context menu
 * 4. DOI tooltip on hover
 * 5. Auto-hide on scroll
 * 6. Draggable with edge snapping
 */

import type { IconPosition } from '../types/storage';

export interface FloatingIconConfig {
  detectedDOI: string | null;
  enabled: boolean;
  savedPosition: IconPosition | null;
  logoUrl: string;
  onClick: () => void;
  onBookmark?: () => void;
  onCopyDOI?: () => void;
  onHide?: () => void;
  onPositionChange?: () => void;
}

export interface DragState {
  isDragging: boolean;
  offset: { x: number; y: number };
  startPosition: { x: number; y: number };
  startTime: number;
}

const DRAG_THRESHOLD = 5;
const SCROLL_HIDE_DELAY = 150;
const SCROLL_RESTORE_DELAY = 800;

// Icon dimensions
const ICON_SIZE_COMPACT = 40;
const ICON_SIZE_EXPANDED_WIDTH = 120;
const ICON_SIZE_EXPANDED_HEIGHT = 40;

export class FloatingIcon {
  private element: HTMLDivElement | null = null;
  private contextMenu: HTMLDivElement | null = null;
  private tooltip: HTMLDivElement | null = null;
  private config: FloatingIconConfig;
  private isExpanded = false;
  private isScrollHidden = false;
  private scrollTimeout: number | null = null;
  private restoreTimeout: number | null = null;

  private dragState: DragState = {
    isDragging: false,
    offset: { x: 0, y: 0 },
    startPosition: { x: 0, y: 0 },
    startTime: 0,
  };

  constructor(config: FloatingIconConfig) {
    this.config = config;
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
  }

  /**
   * Create and show the floating icon
   */
  create(): HTMLDivElement | null {
    if (!this.config.enabled) {
      console.log('🙈 Floating icon disabled, skipping creation');
      return null;
    }

    // Remove existing icon
    this.remove();

    this.element = document.createElement('div');
    this.element.id = 'researchopia-floating-icon';
    this.element.innerHTML = this.getIconHTML();

    this.applyStyles();
    this.applyPosition();
    this.bindEvents();

    document.body.appendChild(this.element);
    console.log('✅ Floating icon created', this.config.detectedDOI ? '(DOI detected)' : '(No DOI)');

    return this.element;
  }

  /**
   * Remove the floating icon from DOM
   */
  remove(): void {
    const existing = document.getElementById('researchopia-floating-icon');
    if (existing) {
      existing.remove();
    }
    this.hideContextMenu();
    this.hideTooltip();
    this.element = null;
  }

  /**
   * Show the floating icon
   */
  show(): void {
    if (!this.element) {
      this.create();
    } else {
      this.element.style.display = 'flex';
    }
  }

  /**
   * Hide the floating icon
   */
  hide(): void {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  /**
   * Update DOI state and refresh display
   */
  updateDOI(doi: string | null): void {
    this.config.detectedDOI = doi;
    if (this.element) {
      // Update indicator
      const indicator = this.element.querySelector('.doi-indicator') as HTMLElement;
      if (doi && !indicator) {
        const indicatorEl = document.createElement('div');
        indicatorEl.className = 'doi-indicator';
        this.applyDOIIndicatorStyles(indicatorEl);
        this.element.appendChild(indicatorEl);
      } else if (!doi && indicator) {
        indicator.remove();
      }

      // Update border color based on DOI detection
      this.element.style.border = doi ? '2px solid #8b5cf6' : '2px solid #e5e7eb';
    }
  }

  /**
   * Get current position
   */
  getPosition(): IconPosition | null {
    if (!this.element) return null;

    return {
      left: this.element.style.left,
      right: this.element.style.right,
      top: this.element.style.top,
      timestamp: Date.now(),
    };
  }

  /**
   * Set icon position
   */
  setPosition(side: 'left' | 'right', x: number, y: number | string): void {
    if (!this.element) return;

    if (side === 'right') {
      this.element.style.right = `${x}px`;
      this.element.style.left = 'auto';
    } else {
      this.element.style.left = `${x}px`;
      this.element.style.right = 'auto';
    }

    if (y === '50%') {
      this.element.style.top = '50%';
      this.element.style.transform = 'translateY(-50%)';
    } else {
      this.element.style.top = `${y}px`;
      this.element.style.transform = 'none';
    }

    // Notify position change for persistence
    if (this.config.onPositionChange) {
      this.config.onPositionChange();
    }
  }

  // ============================================================================
  // Private Methods - HTML & Styles
  // ============================================================================

  /**
   * Get the inline SVG logo for the floating icon
   * Based on logo-main.svg, without the brand text at the bottom
   */
  private getLogoSVG(): string {
    return `<svg viewBox="0 0 128 100" xmlns="http://www.w3.org/2000/svg">
      <!-- Wave patterns -->
      <path d="M10 96 Q30 90 64 96 T118 96" fill="none" stroke="#a855f7" stroke-width="3" opacity="0.6"/>
      <path d="M10 102 Q30 96 64 102 T118 102" fill="none" stroke="#a855f7" stroke-width="2" opacity="0.4"/>
      
      <!-- Main document/book -->
      <rect x="32" y="42" width="64" height="36" rx="4" fill="#7c3aed"/>
      <rect x="33" y="43" width="62" height="34" rx="3" fill="#8b5cf6"/>
      
      <!-- Document content lines -->
      <line x1="42" y1="52" x2="86" y2="52" stroke="white" stroke-width="2"/>
      <line x1="42" y1="59" x2="86" y2="59" stroke="white" stroke-width="2"/>
      <line x1="42" y1="66" x2="74" y2="66" stroke="white" stroke-width="2"/>
      <line x1="42" y1="73" x2="82" y2="73" stroke="white" stroke-width="2"/>
      
      <!-- Vertical divider -->
      <line x1="64" y1="43" x2="64" y2="77" stroke="#6d28d9" stroke-width="1"/>
      
      <!-- Light bulb -->
      <circle cx="96" cy="26" r="10" fill="#fbbf24"/>
      <rect x="92" y="35" width="8" height="10" fill="#f59e0b"/>
      <!-- Light rays -->
      <g stroke="#fbbf24" stroke-width="3" opacity="0.7">
        <line x1="74" y1="26" x2="68" y2="26"/>
        <line x1="118" y1="26" x2="124" y2="26"/>
        <line x1="96" y1="4" x2="96" y2="-2"/>
        <line x1="82" y1="12" x2="77" y2="7"/>
        <line x1="110" y1="12" x2="115" y2="7"/>
        <line x1="82" y1="40" x2="77" y2="45"/>
        <line x1="110" y1="40" x2="115" y2="45"/>
      </g>
    </svg>`;
  }

  private getIconHTML(): string {
    return `
      <div class="icon-main">
        <div class="icon-logo">${this.getLogoSVG()}</div>
      </div>
      <div class="icon-expanded-text">
        <span class="icon-cn">研学港</span>
        <span class="icon-en">Researchopia</span>
      </div>
      ${this.config.detectedDOI ? '<div class="doi-indicator"></div>' : ''}
    `;
  }

  private applyStyles(): void {
    if (!this.element) return;

    // Main container - compact circular by default
    // Use white background to show SVG clearly, DOI indicator shows detection status
    this.element.style.cssText = `
      position: fixed !important;
      width: ${ICON_SIZE_COMPACT}px !important;
      height: ${ICON_SIZE_COMPACT}px !important;
      background: white !important;
      color: #374151 !important;
      border-radius: ${ICON_SIZE_COMPACT / 2}px !important;
      cursor: grab !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Microsoft YaHei', sans-serif !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05) !important;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
      user-select: none !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      border: ${this.config.detectedDOI ? '2px solid #8b5cf6' : '2px solid #e5e7eb'} !important;
      overflow: hidden !important;
      padding: 0 8px !important;
      box-sizing: border-box !important;
    `;

    this.applyChildStyles();
  }

  private applyChildStyles(): void {
    if (!this.element) return;

    const iconMain = this.element.querySelector('.icon-main') as HTMLElement;
    if (iconMain) {
      iconMain.style.cssText = `
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex-shrink: 0 !important;
      `;
    }

    const logoEl = this.element.querySelector('.icon-logo') as HTMLElement;
    if (logoEl) {
      logoEl.style.cssText = `
        width: 24px !important;
        height: 24px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      `;

      // Style the SVG inside
      const svg = logoEl.querySelector('svg');
      if (svg) {
        svg.style.cssText = `
          width: 100% !important;
          height: 100% !important;
        `;
      }
    }

    const expandedText = this.element.querySelector('.icon-expanded-text') as HTMLElement;
    if (expandedText) {
      expandedText.style.cssText = `
        display: none !important;
        flex-direction: column !important;
        line-height: 1.1 !important;
        margin-left: 8px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
      `;
    }

    const cn = this.element.querySelector('.icon-cn') as HTMLElement;
    if (cn) {
      cn.style.cssText = `
        font-size: 12px !important;
        font-weight: 600 !important;
        letter-spacing: 0.5px !important;
        color: #7c3aed !important;
      `;
    }

    const en = this.element.querySelector('.icon-en') as HTMLElement;
    if (en) {
      en.style.cssText = `
        font-size: 9px !important;
        opacity: 0.7 !important;
        color: #6b7280 !important;
      `;
    }

    const doiIndicator = this.element.querySelector('.doi-indicator') as HTMLElement;
    if (doiIndicator) {
      this.applyDOIIndicatorStyles(doiIndicator);
    }
  }

  private applyDOIIndicatorStyles(el: HTMLElement): void {
    el.style.cssText = `
      position: absolute !important;
      top: 2px !important;
      right: 2px !important;
      width: 10px !important;
      height: 10px !important;
      background: #22c55e !important;
      border-radius: 50% !important;
      border: 2px solid white !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important;
    `;
  }

  private applyPosition(): void {
    if (!this.element) return;

    if (this.config.savedPosition) {
      this.element.style.left = this.config.savedPosition.left || 'auto';
      this.element.style.right = this.config.savedPosition.right || 'auto';
      this.element.style.top = this.config.savedPosition.top || '20px';
    } else {
      // Default: top-right corner
      this.setPosition('right', 16, 80);
    }
  }

  // ============================================================================
  // Private Methods - Events
  // ============================================================================

  private bindEvents(): void {
    if (!this.element) return;

    // Mouse events on icon
    this.element.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.element.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
    this.element.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.element.addEventListener('contextmenu', this.handleContextMenu.bind(this));

    // Global events
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('click', this.handleDocumentClick);
    window.addEventListener('scroll', this.handleScroll, { passive: true });
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0 || !this.element) return;

    this.dragState.startTime = Date.now();
    this.dragState.startPosition = { x: e.clientX, y: e.clientY };
    this.dragState.isDragging = false;

    this.element.style.cursor = 'grabbing';

    const rect = this.element.getBoundingClientRect();
    this.dragState.offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    e.preventDefault();
    e.stopPropagation();
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.element) return;

    // Check if we should start dragging
    if (!this.dragState.isDragging && this.dragState.startPosition.x !== 0) {
      const dx = Math.abs(e.clientX - this.dragState.startPosition.x);
      const dy = Math.abs(e.clientY - this.dragState.startPosition.y);
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > DRAG_THRESHOLD) {
        this.dragState.isDragging = true;
        this.collapseIcon(); // Collapse while dragging
      }
    }

    if (!this.dragState.isDragging) return;

    const x = e.clientX - this.dragState.offset.x;
    const y = e.clientY - this.dragState.offset.y;

    // Constrain within viewport
    const maxX = window.innerWidth - this.element.offsetWidth;
    const maxY = window.innerHeight - this.element.offsetHeight;

    const constrainedX = Math.max(0, Math.min(maxX, x));
    const constrainedY = Math.max(0, Math.min(maxY, y));

    this.element.style.left = `${constrainedX}px`;
    this.element.style.right = 'auto';
    this.element.style.top = `${constrainedY}px`;
    this.element.style.transform = 'scale(1.05)';
    this.element.style.transition = 'transform 0.1s';

    e.preventDefault();
  }

  private handleMouseUp(_e: MouseEvent): void {
    if (!this.element) return;

    const wasMouseDown = this.dragState.startPosition.x !== 0;
    this.dragState.startPosition = { x: 0, y: 0 };

    if (!wasMouseDown) return;

    this.element.style.cursor = 'grab';
    this.element.style.transform = 'scale(1)';
    this.element.style.transition = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)';

    if (this.dragState.isDragging) {
      this.snapToEdge();
      this.dragState.isDragging = false;
    } else {
      // Click detection
      const clickDuration = Date.now() - this.dragState.startTime;
      if (clickDuration < 300) {
        this.config.onClick();
      }
    }
  }

  private handleMouseEnter(): void {
    if (!this.element || this.dragState.isDragging) return;

    this.expandIcon();
    
    // Show DOI tooltip if available
    if (this.config.detectedDOI) {
      this.showTooltip(`DOI: ${this.config.detectedDOI}`);
    }
  }

  private handleMouseLeave(): void {
    if (!this.element || this.dragState.isDragging) return;

    this.collapseIcon();
    this.hideTooltip();
  }

  private handleContextMenu(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.showContextMenu(e.clientX, e.clientY);
  }

  private handleDocumentClick(e: MouseEvent): void {
    // Hide context menu when clicking outside
    if (this.contextMenu && !this.contextMenu.contains(e.target as Node)) {
      this.hideContextMenu();
    }
  }

  private handleScroll(): void {
    if (!this.element) return;

    // Clear previous timeouts
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    if (this.restoreTimeout) {
      clearTimeout(this.restoreTimeout);
    }

    // Fade out on scroll
    if (!this.isScrollHidden) {
      this.scrollTimeout = window.setTimeout(() => {
        if (this.element) {
          this.element.style.opacity = '0.3';
          this.element.style.transform = 'scale(0.8)';
          this.isScrollHidden = true;
        }
      }, SCROLL_HIDE_DELAY);
    }

    // Restore after scroll stops
    this.restoreTimeout = window.setTimeout(() => {
      if (this.element) {
        this.element.style.opacity = '1';
        this.element.style.transform = 'scale(1)';
        this.isScrollHidden = false;
      }
    }, SCROLL_RESTORE_DELAY);
  }

  // ============================================================================
  // Private Methods - Expand/Collapse
  // ============================================================================

  private expandIcon(): void {
    if (!this.element || this.isExpanded) return;

    this.isExpanded = true;
    this.element.style.width = `${ICON_SIZE_EXPANDED_WIDTH}px`;
    this.element.style.height = `${ICON_SIZE_EXPANDED_HEIGHT}px`;
    this.element.style.borderRadius = `${ICON_SIZE_EXPANDED_HEIGHT / 2}px`;
    this.element.style.transform = 'scale(1.02)';

    const expandedText = this.element.querySelector('.icon-expanded-text') as HTMLElement;
    if (expandedText) {
      expandedText.style.display = 'flex';
    }
  }

  private collapseIcon(): void {
    if (!this.element || !this.isExpanded) return;

    this.isExpanded = false;
    this.element.style.width = `${ICON_SIZE_COMPACT}px`;
    this.element.style.height = `${ICON_SIZE_COMPACT}px`;
    this.element.style.borderRadius = `${ICON_SIZE_COMPACT / 2}px`;
    this.element.style.transform = 'scale(1)';

    const expandedText = this.element.querySelector('.icon-expanded-text') as HTMLElement;
    if (expandedText) {
      expandedText.style.display = 'none';
    }
  }

  // ============================================================================
  // Private Methods - Context Menu
  // ============================================================================

  private showContextMenu(x: number, y: number): void {
    this.hideContextMenu();

    this.contextMenu = document.createElement('div');
    this.contextMenu.id = 'researchopia-context-menu';
    this.contextMenu.innerHTML = this.getContextMenuHTML();
    this.applyContextMenuStyles(x, y);
    this.bindContextMenuEvents();

    document.body.appendChild(this.contextMenu);
  }

  private getContextMenuHTML(): string {
    const items = [
      { id: 'open-sidebar', icon: '📊', text: '打开侧边栏' },
    ];

    if (this.config.detectedDOI) {
      items.push({ id: 'copy-doi', icon: '📋', text: `复制 DOI` });
    }

    items.push(
      { id: 'divider', icon: '', text: '' },
      { id: 'hide-icon', icon: '👁️', text: '隐藏悬浮图标' }
    );

    return items.map(item => {
      if (item.id === 'divider') {
        return '<div class="menu-divider"></div>';
      }
      return `
        <div class="menu-item" data-action="${item.id}">
          <span class="menu-icon">${item.icon}</span>
          <span class="menu-text">${item.text}</span>
        </div>
      `;
    }).join('');
  }

  private applyContextMenuStyles(x: number, y: number): void {
    if (!this.contextMenu) return;

    // Adjust position to keep menu in viewport
    const menuWidth = 180;
    const menuHeight = 160;
    const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
    const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

    this.contextMenu.style.cssText = `
      position: fixed !important;
      left: ${adjustedX}px !important;
      top: ${adjustedY}px !important;
      width: ${menuWidth}px !important;
      background: white !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05) !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Microsoft YaHei', sans-serif !important;
      padding: 6px 0 !important;
      animation: fadeIn 0.15s ease !important;
    `;

    // Style menu items
    const items = this.contextMenu.querySelectorAll('.menu-item');
    items.forEach(item => {
      (item as HTMLElement).style.cssText = `
        display: flex !important;
        align-items: center !important;
        padding: 10px 14px !important;
        cursor: pointer !important;
        transition: background 0.15s !important;
        color: #374151 !important;
        font-size: 13px !important;
      `;
    });

    const dividers = this.contextMenu.querySelectorAll('.menu-divider');
    dividers.forEach(divider => {
      (divider as HTMLElement).style.cssText = `
        height: 1px !important;
        background: #e5e7eb !important;
        margin: 6px 0 !important;
      `;
    });

    const icons = this.contextMenu.querySelectorAll('.menu-icon');
    icons.forEach(icon => {
      (icon as HTMLElement).style.cssText = `
        margin-right: 10px !important;
        font-size: 14px !important;
      `;
    });
  }

  private bindContextMenuEvents(): void {
    if (!this.contextMenu) return;

    // Hover effect
    const items = this.contextMenu.querySelectorAll('.menu-item');
    items.forEach(item => {
      item.addEventListener('mouseenter', () => {
        (item as HTMLElement).style.background = '#f3f4f6';
      });
      item.addEventListener('mouseleave', () => {
        (item as HTMLElement).style.background = 'transparent';
      });
      item.addEventListener('click', (e) => {
        const action = (item as HTMLElement).dataset.action;
        this.handleContextMenuAction(action || '');
        e.stopPropagation();
      });
    });
  }

  private handleContextMenuAction(action: string): void {
    this.hideContextMenu();

    switch (action) {
      case 'open-sidebar':
        this.config.onClick();
        break;
      case 'bookmark':
        if (this.config.onBookmark) {
          this.config.onBookmark();
        } else {
          // Fallback: open sidebar which has bookmark functionality
          this.config.onClick();
        }
        break;
      case 'copy-doi':
        if (this.config.detectedDOI) {
          navigator.clipboard.writeText(this.config.detectedDOI).then(() => {
            this.showToast('DOI 已复制到剪贴板');
          }).catch(() => {
            this.showToast('复制失败', true);
          });
        }
        break;
      case 'hide-icon':
        // Always hide the icon first, then call onHide callback
        this.hide();
        this.showToast('悬浮图标已隐藏，可在扩展设置中重新启用');
        if (this.config.onHide) {
          this.config.onHide();
        }
        break;
    }
  }

  private hideContextMenu(): void {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
  }

  // ============================================================================
  // Private Methods - Tooltip
  // ============================================================================

  private showTooltip(text: string): void {
    if (!this.element) return;

    this.hideTooltip();

    const rect = this.element.getBoundingClientRect();
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'researchopia-tooltip';
    this.tooltip.textContent = text;

    // Position below the icon
    const tooltipY = rect.bottom + 8;
    const tooltipX = rect.left + rect.width / 2;

    this.tooltip.style.cssText = `
      position: fixed !important;
      left: ${tooltipX}px !important;
      top: ${tooltipY}px !important;
      transform: translateX(-50%) !important;
      background: rgba(31, 41, 55, 0.95) !important;
      color: white !important;
      padding: 6px 12px !important;
      border-radius: 6px !important;
      font-size: 12px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Microsoft YaHei', monospace !important;
      white-space: nowrap !important;
      z-index: 2147483647 !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
      animation: fadeIn 0.15s ease !important;
      max-width: 300px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    `;

    document.body.appendChild(this.tooltip);
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }

  // ============================================================================
  // Private Methods - Toast
  // ============================================================================

  private showToast(message: string, isError = false): void {
    const toast = document.createElement('div');
    toast.id = 'researchopia-toast';
    toast.textContent = message;

    toast.style.cssText = `
      position: fixed !important;
      bottom: 24px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: ${isError ? '#ef4444' : '#22c55e'} !important;
      color: white !important;
      padding: 12px 24px !important;
      border-radius: 8px !important;
      font-size: 14px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Microsoft YaHei', sans-serif !important;
      z-index: 2147483647 !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
      animation: fadeIn 0.2s ease !important;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ============================================================================
  // Private Methods - Edge Snapping
  // ============================================================================

  private snapToEdge(): void {
    if (!this.element) return;

    const rect = this.element.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const iconCenterX = rect.left + rect.width / 2;
    const margin = 16;

    if (iconCenterX < windowWidth / 2) {
      this.setPosition('left', margin, rect.top);
    } else {
      this.setPosition('right', margin, rect.top);
    }
  }

  /**
   * Cleanup event listeners
   */
  destroy(): void {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('click', this.handleDocumentClick);
    window.removeEventListener('scroll', this.handleScroll);

    if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
    if (this.restoreTimeout) clearTimeout(this.restoreTimeout);

    this.hideContextMenu();
    this.hideTooltip();
    this.remove();
  }
}
