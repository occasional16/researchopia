/**
 * 环境配置模块
 * 负责环境变量、配置项管理等功能
 */

interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  enablePerformanceMonitoring: boolean;
  enableDetailedLogging: boolean;
  maxCacheSize: number;
  maxErrorLogSize: number;
}

const defaultConfig: EnvironmentConfig = {
  isDevelopment: true,
  isProduction: false,
  logLevel: 'debug',
  // 🔧 本地开发使用localhost，生产环境使用vercel
  apiBaseUrl: 'http://localhost:3000',
  supabaseUrl: 'https://obcblvdtqhwrihoddlez.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4',
  enablePerformanceMonitoring: true,
  enableDetailedLogging: true,
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
          if (customApiUrl && typeof customApiUrl === 'string') {
            return customApiUrl;
          }
        }
      } catch (e) {
        // 忽略错误
      }
      // 回退到默认值: 生产环境用正式域名,开发环境用localhost
      return env === 'production' ? 'https://www.researchopia.com' : 'http://localhost:3000';
    },
    get supabaseUrl() { return defaultConfig.supabaseUrl; },
    get supabaseAnonKey() { return defaultConfig.supabaseAnonKey; },
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