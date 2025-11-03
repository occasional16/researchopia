/**
 * 环境配置模块
 * 负责环境变量、配置项管理等功能
 */

interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  apiBaseUrl: string;
  /** @deprecated 不再直接使用,所有API请求通过Next.js代理 */
  supabaseUrl: string;
  /** @deprecated 不再直接使用,所有API请求通过Next.js代理 */
  supabaseAnonKey: string;
  enablePerformanceMonitoring: boolean;
  enableDetailedLogging: boolean;
  maxCacheSize: number;
  maxErrorLogSize: number;
}

const defaultConfig: EnvironmentConfig = {
  isDevelopment: false,
  isProduction: true,
  logLevel: 'warn',
  // 默认使用生产环境,用户勾选"使用开发环境API"时才切换到localhost
  apiBaseUrl: 'https://www.researchopia.com',
  
  // ⚠️ 已弃用: 所有API请求现在通过Next.js代理(/api/proxy/*),不再直接调用Supabase
  // 保留这些配置仅用于向后兼容,实际使用中应通过Next.js API进行所有数据库操作
  supabaseUrl: '',  // 留空,强制使用API代理
  supabaseAnonKey: '',  // 留空,强制使用API代理
  
  enablePerformanceMonitoring: false,
  enableDetailedLogging: false,
  maxCacheSize: 100,
  maxErrorLogSize: 1000
};

// 根据环境变量确定配置
const getEnvironmentConfig = (): EnvironmentConfig => {
  const env = (globalThis as any).__env__ || 'development';
  
  const config: EnvironmentConfig = { ...defaultConfig };
  
  if (env === 'production') {
    config.isDevelopment = false;
    config.isProduction = true;
    config.logLevel = 'warn';
    config.enableDetailedLogging = false;
    config.enablePerformanceMonitoring = false;
    config.apiBaseUrl = 'https://www.researchopia.com'; // 生产环境使用正式域名
  }
  
  // 开发环境可以通过环境变量覆盖API地址
  try {
    // 尝试从prefs读取自定义API地址
    if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
      const customApiUrl = Zotero.Prefs.get('extensions.researchopia.apiBaseUrl');
      if (customApiUrl) {
        config.apiBaseUrl = customApiUrl as string;
        console.log('[Researchopia] Using custom API URL:', customApiUrl);
      }
    }
  } catch (e) {
    // 忽略错误，使用默认配置
  }
  
  return config;
};

// 创建动态配置对象,通过getter实时读取apiBaseUrl
const createDynamicConfig = (): EnvironmentConfig => {
  const env = (globalThis as any).__env__ || 'development';
  
  return {
    get isDevelopment() { return env !== 'production'; },
    get isProduction() { return env === 'production'; },
    get logLevel() { return env === 'production' ? 'warn' : 'debug'; },
    get apiBaseUrl() {
      // 每次访问时动态读取,确保获取最新设置
      try {
        if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
          const customApiUrl = Zotero.Prefs.get('extensions.researchopia.apiBaseUrl', true);
          // 只有当用户明确设置为开发环境时才使用localhost
          if (customApiUrl && typeof customApiUrl === 'string') {
            return customApiUrl;
          }
        }
      } catch (e) {
        // 忽略错误
      }
      // 默认始终使用生产环境
      return 'https://www.researchopia.com';
    },
    /** @deprecated 不再使用,所有API通过Next.js代理 */
    get supabaseUrl() { 
      console.warn('[Researchopia] supabaseUrl已弃用,请使用API代理');
      return defaultConfig.supabaseUrl; 
    },
    /** @deprecated 不再使用,所有API通过Next.js代理 */
    get supabaseAnonKey() { 
      console.warn('[Researchopia] supabaseAnonKey已弃用,请使用API代理');
      return defaultConfig.supabaseAnonKey; 
    },
    get enablePerformanceMonitoring() { return env !== 'production'; },
    get enableDetailedLogging() { return env !== 'production'; },
    get maxCacheSize() { return defaultConfig.maxCacheSize; },
    get maxErrorLogSize() { return defaultConfig.maxErrorLogSize; }
  };
};

export const envConfig = createDynamicConfig();

// 导出config别名,方便导入使用
export const config = envConfig;

export const logConfig = (): void => {
  console.group('[Researchopia] Environment Configuration');
  console.log('Environment:', envConfig.isDevelopment ? 'Development' : 'Production');
  console.log('Log Level:', envConfig.logLevel);
  console.log('Performance Monitoring:', envConfig.enablePerformanceMonitoring);
  console.log('Detailed Logging:', envConfig.enableDetailedLogging);
  console.log('API Base URL:', envConfig.apiBaseUrl);
  console.groupEnd();
};

export const getApiUrl = (endpoint: string): string => {
  return `${envConfig.apiBaseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
};

export const shouldLog = (level: 'debug' | 'info' | 'warn' | 'error'): boolean => {
  const levels = ['debug', 'info', 'warn', 'error'];
  const configLevel = levels.indexOf(envConfig.logLevel);
  const requestedLevel = levels.indexOf(level);
  
  return requestedLevel >= configLevel;
};

export const logger = {
  debug: (...args: any[]) => {
    if (shouldLog('debug')) {
      console.debug('[Researchopia]', ...args);
    }
  },
  
  info: (...args: any[]) => {
    if (shouldLog('info')) {
      console.info('[Researchopia]', ...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (shouldLog('warn')) {
      console.warn('[Researchopia]', ...args);
    }
  },
  
  error: (...args: any[]) => {
    if (shouldLog('error')) {
      console.error('[Researchopia]', ...args);
    }
  }
};

// 导出默认配置供其他模块使用
export default envConfig;