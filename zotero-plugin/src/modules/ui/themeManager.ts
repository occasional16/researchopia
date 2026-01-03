/**
 * 主题管理器
 * 负责检测和应用深色/浅色模式
 */

import { logger } from "../../utils/logger";

export interface ThemeColors {
  // Background colors
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHover: string;
  bgActive: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  
  // Border colors
  borderPrimary: string;
  borderSecondary: string;
  
  // Accent colors (保持不变,品牌色)
  primary: string;
  secondary: string;
  success: string;
  successDark: string;
  warning: string;
  danger: string;
  info: string;
  
  // Additional feature colors
  pink: string;
  pinkDark: string;
  orange: string;
  orangeDark: string;
  
  // Shadows
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
}

// 浅色模式颜色方案
const lightTheme: ThemeColors = {
  bgPrimary: '#ffffff',
  bgSecondary: '#f8f9fa',
  bgTertiary: '#e9ecef',
  bgHover: '#f1f3f5',
  bgActive: '#dee2e6',
  
  textPrimary: '#212529',
  textSecondary: '#495057',
  textMuted: '#6c757d',
  textInverse: '#ffffff',
  
  borderPrimary: '#dee2e6',
  borderSecondary: '#e9ecef',
  
  primary: '#8b5cf6',
  secondary: '#3b82f6',
  success: '#10b981',
  successDark: '#059669',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#0ea5e9',
  
  pink: '#ec4899',
  pinkDark: '#db2777',
  orange: '#f97316',
  orangeDark: '#ea580c',
  
  shadowSm: 'rgba(0, 0, 0, 0.05)',
  shadowMd: 'rgba(0, 0, 0, 0.1)',
  shadowLg: 'rgba(0, 0, 0, 0.15)',
};

// 深色模式颜色方案
const darkTheme: ThemeColors = {
  bgPrimary: '#1a1a1a',
  bgSecondary: '#2d2d2d',
  bgTertiary: '#3d3d3d',
  bgHover: '#404040',
  bgActive: '#4d4d4d',
  
  textPrimary: '#e5e5e5',
  textSecondary: '#b4b4b4',
  textMuted: '#8a8a8a',
  textInverse: '#1a1a1a',
  
  borderPrimary: '#404040',
  borderSecondary: '#333333',
  
  primary: '#a78bfa',
  secondary: '#60a5fa',
  success: '#34d399',
  successDark: '#10b981',
  warning: '#fbbf24',
  danger: '#f87171',
  info: '#38bdf8',
  
  pink: '#f472b6',
  pinkDark: '#ec4899',
  orange: '#fb923c',
  orangeDark: '#f97316',
  
  shadowSm: 'rgba(0, 0, 0, 0.3)',
  shadowMd: 'rgba(0, 0, 0, 0.4)',
  shadowLg: 'rgba(0, 0, 0, 0.5)',
};

export class ThemeManager {
  private static instance: ThemeManager;
  private isDarkMode: boolean = false;
  private mediaQuery: MediaQueryList | null = null;
  private listeners: Set<(isDark: boolean) => void> = new Set();
  
  private constructor() {
    this.detectTheme();
    this.setupListener();
  }
  
  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }
  
  /**
   * 检测当前主题模式
   */
  private detectTheme(): void {
    try {
      // 优先检查Zotero的主题设置
      const zoteroTheme = this.getZoteroTheme();
      if (zoteroTheme !== null) {
        this.isDarkMode = zoteroTheme === 'dark';
        logger.log('[ThemeManager] Detected Zotero theme:', zoteroTheme);
        return;
      }
      
      // 回退到系统主题
      if (typeof window !== 'undefined' && window.matchMedia) {
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.isDarkMode = this.mediaQuery?.matches ?? false;
        logger.log('[ThemeManager] Detected system theme:', this.isDarkMode ? 'dark' : 'light');
      }
    } catch (error) {
      logger.warn('[ThemeManager] Failed to detect theme:', error);
      this.isDarkMode = false; // 默认浅色模式
    }
  }
  
  /**
   * 获取Zotero的主题设置
   */
  private getZoteroTheme(): 'light' | 'dark' | null {
    try {
      // Zotero 7/8可能通过不同方式存储主题
      // 尝试多种可能的方式
      
      // 方法1: 检查Zotero.Prefs
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        const theme = Zotero.Prefs.get('theme', true) as string;
        if (theme === 'dark' || theme === 'light') {
          return theme;
        }
      }
      
      // 方法2: 检查document的data-theme属性
      if (typeof document !== 'undefined') {
        const docTheme = document.documentElement.getAttribute('data-theme');
        if (docTheme === 'dark' || docTheme === 'light') {
          return docTheme as 'light' | 'dark';
        }
      }
      
      // 方法3: 检查window.matchMedia (Zotero可能设置了custom media query)
      if (typeof window !== 'undefined' && window.matchMedia) {
        const zoteroPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        if (zoteroPrefersDark?.matches) {
          return 'dark';
        }
      }
      
      return null;
    } catch (error) {
      logger.warn('[ThemeManager] Failed to get Zotero theme:', error);
      return null;
    }
  }
  
  /**
   * 设置主题监听器
   */
  private setupListener(): void {
    try {
      if (this.mediaQuery) {
        this.mediaQuery.addEventListener('change', (e) => {
          this.isDarkMode = e.matches;
          logger.log('[ThemeManager] Theme changed to:', this.isDarkMode ? 'dark' : 'light');
          this.notifyListeners();
        });
      }
    } catch (error) {
      logger.warn('[ThemeManager] Failed to setup theme listener:', error);
    }
  }
  
  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback(this.isDarkMode);
      } catch (error) {
        logger.error('[ThemeManager] Error in theme listener:', error);
      }
    });
  }
  
  /**
   * 添加主题变化监听器
   */
  public onThemeChange(callback: (isDark: boolean) => void): () => void {
    this.listeners.add(callback);
    
    // 返回移除监听器的函数
    return () => {
      this.listeners.delete(callback);
    };
  }
  
  /**
   * 获取当前是否为深色模式
   */
  public isDark(): boolean {
    return this.isDarkMode;
  }
  
  /**
   * 获取当前主题的颜色方案
   * @param forceLight - 是否强制使用浅色模式（用于插件主面板）
   */
  public getColors(forceLight: boolean = false): ThemeColors {
    if (forceLight) {
      return lightTheme;
    }
    return this.isDarkMode ? darkTheme : lightTheme;
  }
  
  /**
   * 手动切换主题(用于测试或用户手动切换)
   */
  public toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    logger.log('[ThemeManager] Theme toggled to:', this.isDarkMode ? 'dark' : 'light');
    this.notifyListeners();
  }
  
  /**
   * 手动设置主题
   */
  public setTheme(theme: 'light' | 'dark'): void {
    this.isDarkMode = theme === 'dark';
    logger.log('[ThemeManager] Theme set to:', theme);
    this.notifyListeners();
  }
}

// 导出单例实例
export const themeManager = ThemeManager.getInstance();
