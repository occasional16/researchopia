/**
 * 性能管理模块
 * 负责性能监控、指标收集、优化建议等功能
 */

export class PerformanceManager {
  private static instance: PerformanceManager | null = null;
  private timings: Map<string, number> = new Map();
  private metrics: any[] = [];
  private isMonitoring = false;
  private maxMetricsCount = 500;

  public static getInstance(): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager();
    }
    return PerformanceManager.instance;
  }

  public static startTiming(label: string): string {
    const instance = PerformanceManager.getInstance();
    const timingId = `${label}_${Date.now()}_${Math.random()}`;
    instance.timings.set(timingId, performance.now());
    console.log(`[PerformanceManager] Started timing: ${label} (${timingId})`);
    return timingId;
  }

  public static endTiming(
    timingId: string, 
    success: boolean = true, 
    errorMessage?: string
  ): number {
    const instance = PerformanceManager.getInstance();
    
    const startTime = instance.timings.get(timingId);
    if (!startTime) {
      console.warn(`[PerformanceManager] No start time found for timing ID: ${timingId}`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // 记录性能指标
    const metric = {
      id: timingId,
      label: timingId.split('_')[0],
      duration,
      success,
      errorMessage,
      timestamp: new Date().toISOString(),
      memoryUsage: instance.getMemoryUsage()
    };
    
    instance.addMetric(metric);
    instance.timings.delete(timingId);
    
    const status = success ? 'SUCCESS' : 'FAILED';
    console.log(`[PerformanceManager] ${status} timing: ${metric.label} - ${duration.toFixed(2)}ms`);
    
    return duration;
  }

  public static measureFunction<T>(
    label: string,
    fn: () => T | Promise<T>
  ): T | Promise<T> {
    const timingId = PerformanceManager.startTiming(label);
    
    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result
          .then(value => {
            PerformanceManager.endTiming(timingId, true);
            return value;
          })
          .catch(error => {
            PerformanceManager.endTiming(timingId, false, error.message);
            throw error;
          });
      } else {
        PerformanceManager.endTiming(timingId, true);
        return result;
      }
    } catch (error) {
      PerformanceManager.endTiming(timingId, false, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  public static startMonitoring(intervalMs: number = 60000): void {
    const instance = PerformanceManager.getInstance();
    
    if (instance.isMonitoring) {
      console.log("[PerformanceManager] Monitoring already started");
      return;
    }

    instance.isMonitoring = true;
    
    const monitoringInterval = setInterval(() => {
      try {
        instance.collectSystemMetrics();
      } catch (error) {
        console.error("[PerformanceManager] Error in monitoring interval:", error);
      }
    }, intervalMs);

    // 清理函数
    (instance as any).monitoringInterval = monitoringInterval;
    
    console.log(`[PerformanceManager] Started performance monitoring (${intervalMs}ms interval)`);
  }

  public static stopMonitoring(): void {
    const instance = PerformanceManager.getInstance();
    
    if (!instance.isMonitoring) {
      return;
    }

    instance.isMonitoring = false;
    
    if ((instance as any).monitoringInterval) {
      clearInterval((instance as any).monitoringInterval);
      delete (instance as any).monitoringInterval;
    }
    
    console.log("[PerformanceManager] Stopped performance monitoring");
  }

  public static getPerformanceReport(timeRange?: number): any {
    const instance = PerformanceManager.getInstance();
    
    let metrics = instance.metrics;
    
    // 如果指定了时间范围，过滤指标
    if (timeRange) {
      const cutoffTime = Date.now() - timeRange;
      metrics = metrics.filter(metric => 
        new Date(metric.timestamp).getTime() > cutoffTime
      );
    }

    return {
      totalMetrics: metrics.length,
      timeRange: timeRange || 'all',
      statistics: instance.calculateStatistics(metrics),
      slowOperations: instance.getSlowOperations(metrics),
      failedOperations: instance.getFailedOperations(metrics),
      memoryTrends: instance.getMemoryTrends(metrics)
    };
  }

  public static exportMetrics(format: 'json' | 'csv' = 'json'): string {
    const instance = PerformanceManager.getInstance();
    
    if (format === 'csv') {
      return instance.exportToCSV();
    } else {
      return JSON.stringify(instance.metrics, null, 2);
    }
  }

  public static getMetricsSummary(): any {
    const instance = PerformanceManager.getInstance();
    
    const summary = {
      total: instance.metrics.length,
      avgDuration: 0,
      maxDuration: 0,
      minDuration: Infinity,
      successRate: 0,
      mostCommonOperations: new Map<string, number>()
    };

    let totalDuration = 0;
    let successCount = 0;
    
    for (const metric of instance.metrics) {
      totalDuration += metric.duration;
      summary.maxDuration = Math.max(summary.maxDuration, metric.duration);
      summary.minDuration = Math.min(summary.minDuration, metric.duration);
      
      if (metric.success) {
        successCount++;
      }
      
      const count = summary.mostCommonOperations.get(metric.label) || 0;
      summary.mostCommonOperations.set(metric.label, count + 1);
    }

    if (instance.metrics.length > 0) {
      summary.avgDuration = totalDuration / instance.metrics.length;
      summary.successRate = (successCount / instance.metrics.length) * 100;
    }

    if (summary.minDuration === Infinity) {
      summary.minDuration = 0;
    }

    return summary;
  }

  private addMetric(metric: any): void {
    this.metrics.push(metric);
    
    // 维护指标数量限制
    if (this.metrics.length > this.maxMetricsCount) {
      this.metrics = this.metrics.slice(-this.maxMetricsCount);
    }
  }

  private collectSystemMetrics(): void {
    try {
      const systemMetric = {
        id: `system_${Date.now()}`,
        label: 'system_monitoring',
        duration: 0,
        success: true,
        timestamp: new Date().toISOString(),
        memoryUsage: this.getMemoryUsage(),
        systemInfo: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          onLine: navigator.onLine,
          cookieEnabled: navigator.cookieEnabled
        }
      };
      
      this.addMetric(systemMetric);
    } catch (error) {
      console.error("[PerformanceManager] Error collecting system metrics:", error);
    }
  }

  private getMemoryUsage(): any {
    try {
      if ('memory' in performance) {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private calculateStatistics(metrics: any[]): any {
    if (metrics.length === 0) {
      return { avgDuration: 0, medianDuration: 0, maxDuration: 0, minDuration: 0 };
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const total = durations.reduce((sum, d) => sum + d, 0);
    
    return {
      avgDuration: total / durations.length,
      medianDuration: durations[Math.floor(durations.length / 2)],
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      p95Duration: durations[Math.floor(durations.length * 0.95)],
      p99Duration: durations[Math.floor(durations.length * 0.99)]
    };
  }

  private getSlowOperations(metrics: any[], threshold: number = 1000): any[] {
    return metrics
      .filter(metric => metric.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
  }

  private getFailedOperations(metrics: any[]): any[] {
    return metrics
      .filter(metric => !metric.success)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }

  private getMemoryTrends(metrics: any[]): any[] {
    return metrics
      .filter(metric => metric.memoryUsage)
      .map(metric => ({
        timestamp: metric.timestamp,
        memoryUsage: metric.memoryUsage.usedJSHeapSize
      }))
      .slice(-50); // 最近50个数据点
  }

  private exportToCSV(): string {
    if (this.metrics.length === 0) {
      return 'id,label,duration,success,errorMessage,timestamp,memoryUsage\n';
    }

    const headers = ['id', 'label', 'duration', 'success', 'errorMessage', 'timestamp', 'memoryUsage'];
    const csvContent = headers.join(',') + '\n';
    
    const rows = this.metrics.map(metric => {
      return [
        metric.id,
        metric.label,
        metric.duration,
        metric.success,
        metric.errorMessage || '',
        metric.timestamp,
        metric.memoryUsage ? JSON.stringify(metric.memoryUsage).replace(/,/g, ';') : ''
      ].join(',');
    }).join('\n');
    
    return csvContent + rows;
  }

  public static cleanup(): void {
    const instance = PerformanceManager.getInstance();
    
    try {
      PerformanceManager.stopMonitoring();
      
      // 保存关键性能指标到首选项
      const summary = PerformanceManager.getMetricsSummary();
      Zotero.Prefs.set(
        'extensions.zotero.researchopia.lastPerformanceStats',
        JSON.stringify(summary),
        true
      );
      
      instance.timings.clear();
      instance.metrics = [];
      instance.isMonitoring = false;
      
      PerformanceManager.instance = null;
      console.log("[PerformanceManager] Cleanup completed");
    } catch (error) {
      console.error("[PerformanceManager] Error during cleanup:", error);
    }
  }
}