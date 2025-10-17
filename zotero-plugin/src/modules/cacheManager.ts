/**
 * 缓存管理模块
 * 负责数据缓存、清理、优化等功能
 */

export class CacheManager {
  private static instance: CacheManager | null = null;
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private maxCacheSize = 100; // 最大缓存条目数
  private defaultTTL = 300000; // 默认5分钟TTL

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  public static set(key: string, value: any, ttl?: number): void {
    const instance = CacheManager.getInstance();
    instance.setItem(key, value, ttl);
  }

  public static get(key: string): any | null {
    const instance = CacheManager.getInstance();
    return instance.getItem(key);
  }

  public static has(key: string): boolean {
    const instance = CacheManager.getInstance();
    return instance.hasItem(key);
  }

  public static delete(key: string): boolean {
    const instance = CacheManager.getInstance();
    return instance.deleteItem(key);
  }

  public static clear(): void {
    const instance = CacheManager.getInstance();
    instance.clearCache();
  }

  public static size(): number {
    const instance = CacheManager.getInstance();
    return instance.cache.size;
  }

  public static getStats(): any {
    const instance = CacheManager.getInstance();
    return {
      size: instance.cache.size,
      maxSize: instance.maxCacheSize,
      keys: Array.from(instance.cache.keys()),
      memoryUsage: instance.getMemoryUsage()
    };
  }

  private setItem(key: string, value: any, ttl?: number): void {
    try {
      // 检查缓存大小限制
      if (this.cache.size >= this.maxCacheSize && !this.cache.has(key)) {
        this.evictOldest();
      }

      // 设置过期时间
      const expiryTime = Date.now() + (ttl || this.defaultTTL);
      this.cacheExpiry.set(key, expiryTime);
      
      // 存储数据
      this.cache.set(key, {
        value,
        timestamp: Date.now(),
        accessCount: 0
      });
      
      console.log(`[CacheManager] Set cache item: ${key}`);
    } catch (error) {
      console.error(`[CacheManager] Error setting cache item ${key}:`, error);
    }
  }

  private getItem(key: string): any | null {
    try {
      // 检查是否存在
      if (!this.cache.has(key)) {
        return null;
      }

      // 检查是否过期
      const expiryTime = this.cacheExpiry.get(key);
      if (expiryTime && Date.now() > expiryTime) {
        this.deleteItem(key);
        return null;
      }

      // 更新访问统计
      const item = this.cache.get(key);
      if (item) {
        item.accessCount++;
        item.lastAccess = Date.now();
        return item.value;
      }

      return null;
    } catch (error) {
      console.error(`[CacheManager] Error getting cache item ${key}:`, error);
      return null;
    }
  }

  private hasItem(key: string): boolean {
    if (!this.cache.has(key)) {
      return false;
    }

    // 检查是否过期
    const expiryTime = this.cacheExpiry.get(key);
    if (expiryTime && Date.now() > expiryTime) {
      this.deleteItem(key);
      return false;
    }

    return true;
  }

  private deleteItem(key: string): boolean {
    try {
      const deleted = this.cache.delete(key);
      this.cacheExpiry.delete(key);
      
      if (deleted) {
        console.log(`[CacheManager] Deleted cache item: ${key}`);
      }
      
      return deleted;
    } catch (error) {
      console.error(`[CacheManager] Error deleting cache item ${key}:`, error);
      return false;
    }
  }

  private clearCache(): void {
    try {
      const size = this.cache.size;
      this.cache.clear();
      this.cacheExpiry.clear();
      console.log(`[CacheManager] Cleared cache (${size} items)`);
    } catch (error) {
      console.error("[CacheManager] Error clearing cache:", error);
    }
  }

  private evictOldest(): void {
    try {
      let oldestKey: string | null = null;
      let oldestTime = Date.now();

      // 找到最旧的条目
      for (const [key, item] of this.cache.entries()) {
        if (item.timestamp < oldestTime) {
          oldestTime = item.timestamp;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.deleteItem(oldestKey);
        console.log(`[CacheManager] Evicted oldest cache item: ${oldestKey}`);
      }
    } catch (error) {
      console.error("[CacheManager] Error evicting oldest cache item:", error);
    }
  }

  private getMemoryUsage(): number {
    try {
      // 粗略估算内存使用量
      let totalSize = 0;
      
      for (const [key, item] of this.cache.entries()) {
        totalSize += key.length * 2; // 字符串长度 * 2 (UTF-16)
        totalSize += JSON.stringify(item.value).length * 2;
        totalSize += 64; // 对象开销估算
      }
      
      return totalSize;
    } catch (error) {
      console.error("[CacheManager] Error calculating memory usage:", error);
      return 0;
    }
  }

  public static startPeriodicCleanup(intervalMs: number = 60000): void {
    const instance = CacheManager.getInstance();
    
    setInterval(() => {
      try {
        instance.cleanupExpired();
      } catch (error) {
        console.error("[CacheManager] Error in periodic cleanup:", error);
      }
    }, intervalMs);
    
    console.log(`[CacheManager] Started periodic cleanup (${intervalMs}ms interval)`);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    // 查找过期的key
    for (const [key, expiryTime] of this.cacheExpiry.entries()) {
      if (now > expiryTime) {
        expiredKeys.push(key);
      }
    }
    
    // 删除过期条目
    for (const key of expiredKeys) {
      this.deleteItem(key);
    }
    
    if (expiredKeys.length > 0) {
      console.log(`[CacheManager] Cleaned up ${expiredKeys.length} expired cache items`);
    }
  }

  public static cleanup(): void {
    const instance = CacheManager.getInstance();
    instance.clearCache();
    CacheManager.instance = null;
    console.log("[CacheManager] Cleanup completed");
  }
}