/**
 * Zotero兼容的日志工具
 * 替代console对象，在Zotero环境中正常工作
 */

export class ZoteroLogger {
  private static prefix = '[Researchopia]';

  public static debug(...args: any[]): void {
    const message = ZoteroLogger.formatMessage('DEBUG', ...args);
    (Zotero as any).debug(message);
  }

  public static info(...args: any[]): void {
    const message = ZoteroLogger.formatMessage('INFO', ...args);
    (Zotero as any).debug(message);
  }

  public static warn(...args: any[]): void {
    const message = ZoteroLogger.formatMessage('WARN', ...args);
    (Zotero as any).debug(message);
    // 也输出到Zotero的错误控制台
    if ((globalThis as any).Components?.utils?.reportError) {
      (globalThis as any).Components.utils.reportError(message);
    }
  }

  public static error(...args: any[]): void {
    const message = ZoteroLogger.formatMessage('ERROR', ...args);
    (Zotero as any).debug(message);
    // 输出到Zotero的错误控制台
    if ((globalThis as any).Components?.utils?.reportError) {
      (globalThis as any).Components.utils.reportError(message);
    }
  }

  public static log(...args: any[]): void {
    ZoteroLogger.info(...args);
  }

  private static formatMessage(level: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    return `${ZoteroLogger.prefix} [${level}] ${timestamp} ${formattedArgs}`;
  }
}

// 创建全局的console替代对象
export const logger = {
  debug: ZoteroLogger.debug,
  info: ZoteroLogger.info,
  log: ZoteroLogger.log,
  warn: ZoteroLogger.warn,
  error: ZoteroLogger.error
};

// 为了向后兼容，也导出console风格的接口
export const console = logger;