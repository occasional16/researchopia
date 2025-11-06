/**
 * 错误管理模块
 * 负责错误处理、日志记录、报告等功能
 */

import { logger } from "../utils/logger";

export class ErrorManager {
  private static instance: ErrorManager | null = null;
  private errorLog: any[] = [];
  private maxLogSize = 1000;
  private errorHandlers: Map<string, Function[]> = new Map();

  public static getInstance(): ErrorManager {
    if (!ErrorManager.instance) {
      ErrorManager.instance = new ErrorManager();
    }
    return ErrorManager.instance;
  }

  public static logError(
    error: Error | string,
    context?: string,
    details?: any
  ): void {
    const instance = ErrorManager.getInstance();
    instance.recordError(error, context, details);
  }

  public static logWarning(
    message: string,
    context?: string,
    details?: any
  ): void {
    const instance = ErrorManager.getInstance();
    instance.recordWarning(message, context, details);
  }

  public static logInfo(
    message: string,
    context?: string,
    details?: any
  ): void {
    const instance = ErrorManager.getInstance();
    instance.recordInfo(message, context, details);
  }

  public static getErrorLog(): any[] {
    const instance = ErrorManager.getInstance();
    return [...instance.errorLog];
  }

  public static getRecentErrors(limit: number = 10): any[] {
    const instance = ErrorManager.getInstance();
    return instance.errorLog.slice(-limit);
  }

  public static clearLog(): void {
    const instance = ErrorManager.getInstance();
    instance.errorLog = [];
    logger.log("[ErrorManager] Error log cleared");
  }

  public static addEventListener(
    eventType: string,
    handler: Function
  ): void {
    const instance = ErrorManager.getInstance();
    
    if (!instance.errorHandlers.has(eventType)) {
      instance.errorHandlers.set(eventType, []);
    }
    
    instance.errorHandlers.get(eventType)!.push(handler);
  }

  public static removeEventListener(
    eventType: string,
    handler: Function
  ): void {
    const instance = ErrorManager.getInstance();
    
    const handlers = instance.errorHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  public static exportErrorLog(format: 'json' | 'text' = 'json'): string {
    const instance = ErrorManager.getInstance();
    
    if (format === 'text') {
      return instance.exportAsText();
    } else {
      return JSON.stringify(instance.errorLog, null, 2);
    }
  }

  private recordError(
    error: Error | string,
    context?: string,
    details?: any
  ): void {
    try {
      const errorEntry = {
        type: 'error',
        message: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        context: context || 'unknown',
        details: details || {},
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        zoteroVersion: (Zotero as any).version || 'unknown'
      };

      this.addToLog(errorEntry);
      
      // 触发错误事件
      this.triggerEvent('error', errorEntry);
      
      // 输出到控制台
      logger.error(`[ErrorManager] ${context || 'Error'}:`, error, details);
    } catch (logError) {
      logger.error("[ErrorManager] Failed to record error:", logError);
    }
  }

  private recordWarning(
    message: string,
    context?: string,
    details?: any
  ): void {
    try {
      const warningEntry = {
        type: 'warning',
        message,
        context: context || 'unknown',
        details: details || {},
        timestamp: new Date().toISOString()
      };

      this.addToLog(warningEntry);
      
      // 触发警告事件
      this.triggerEvent('warning', warningEntry);
      
      // 输出到控制台
      logger.warn(`[ErrorManager] ${context || 'Warning'}:`, message, details);
    } catch (logError) {
      logger.error("[ErrorManager] Failed to record warning:", logError);
    }
  }

  private recordInfo(
    message: string,
    context?: string,
    details?: any
  ): void {
    try {
      const infoEntry = {
        type: 'info',
        message,
        context: context || 'unknown',
        details: details || {},
        timestamp: new Date().toISOString()
      };

      this.addToLog(infoEntry);
      
      // 触发信息事件
      this.triggerEvent('info', infoEntry);
      
      // 输出到控制台
      logger.info(`[ErrorManager] ${context || 'Info'}:`, message, details);
    } catch (logError) {
      logger.error("[ErrorManager] Failed to record info:", logError);
    }
  }

  private addToLog(entry: any): void {
    this.errorLog.push(entry);
    
    // 维护日志大小限制
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }
  }

  private triggerEvent(eventType: string, data: any): void {
    try {
      const handlers = this.errorHandlers.get(eventType);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(data);
          } catch (handlerError) {
            logger.error(`[ErrorManager] Error in ${eventType} handler:`, handlerError);
          }
        }
      }
    } catch (triggerError) {
      logger.error("[ErrorManager] Error triggering event:", triggerError);
    }
  }

  private exportAsText(): string {
    try {
      const lines = this.errorLog.map(entry => {
        const timestamp = new Date(entry.timestamp).toLocaleString();
        const contextStr = entry.context ? `[${entry.context}] ` : '';
        const detailsStr = Object.keys(entry.details).length > 0 
          ? ` | Details: ${JSON.stringify(entry.details)}` 
          : '';
        const stackStr = entry.stack ? `\nStack: ${entry.stack}` : '';
        
        return `${timestamp} [${entry.type.toUpperCase()}] ${contextStr}${entry.message}${detailsStr}${stackStr}`;
      });
      
      return lines.join('\n\n');
    } catch (exportError) {
      logger.error("[ErrorManager] Error exporting as text:", exportError);
      return 'Error exporting log as text';
    }
  }

  public static getErrorStats(): any {
    const instance = ErrorManager.getInstance();
    
    const stats = {
      total: instance.errorLog.length,
      errors: 0,
      warnings: 0,
      info: 0,
      recent24h: 0
    };
    
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    for (const entry of instance.errorLog) {
      stats[entry.type as keyof typeof stats]++;
      
      const entryTime = new Date(entry.timestamp).getTime();
      if (entryTime > oneDayAgo) {
        stats.recent24h++;
      }
    }
    
    return stats;
  }

  public static setupGlobalErrorHandler(): void {
    // 设置全局错误处理器
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        ErrorManager.logError(
          new Error(event.message),
          'Global Error Handler',
          {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        );
      });

      window.addEventListener('unhandledrejection', (event) => {
        ErrorManager.logError(
          new Error(`Unhandled Promise Rejection: ${event.reason}`),
          'Global Promise Handler',
          {
            reason: event.reason
          }
        );
      });
    }
  }

  public static cleanup(): void {
    const instance = ErrorManager.getInstance();
    
    try {
      // 保存重要错误到Zotero首选项
      const importantErrors = instance.errorLog
        .filter(entry => entry.type === 'error')
        .slice(-10); // 保留最近10个错误
      
      if (importantErrors.length > 0) {
        Zotero.Prefs.set(
          'extensions.zotero.researchopia.lastErrors',
          JSON.stringify(importantErrors),
          true
        );
      }
      
      instance.errorLog = [];
      instance.errorHandlers.clear();
      ErrorManager.instance = null;
      
      logger.log("[ErrorManager] Cleanup completed");
    } catch (error) {
      logger.error("[ErrorManager] Error during cleanup:", error);
    }
  }
}