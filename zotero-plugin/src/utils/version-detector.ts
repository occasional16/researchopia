/**
 * Zotero版本检测工具
 * 用于判断当前运行环境并提供版本信息
 */

export class ZoteroVersionDetector {
  private static cachedVersion: number | null = null;

  /**
   * 获取Zotero主版本号 (7 or 8)
   */
  static getMajorVersion(): number {
    if (this.cachedVersion !== null) {
      return this.cachedVersion;
    }

    try {
      // @ts-ignore - Zotero.version exists at runtime but not in type definitions
      const fullVersion = Zotero.version as string; // e.g., "8.0-beta.13+d1f478fc4" or "7.0.5"
      const majorVersion = parseInt(fullVersion.split('.')[0]);
      this.cachedVersion = majorVersion;
      return majorVersion;
    } catch (error) {
      // 降级到Zotero 7
      console.warn('[Version Detector] Failed to detect version, assuming Zotero 7:', error);
      this.cachedVersion = 7;
      return 7;
    }
  }

  /**
   * 检查是否为Zotero 8
   */
  static isZotero8(): boolean {
    return this.getMajorVersion() >= 8;
  }

  /**
   * 检查是否为Zotero 7
   */
  static isZotero7(): boolean {
    return this.getMajorVersion() === 7;
  }

  /**
   * 获取完整版本字符串
   */
  static getFullVersion(): string {
    // @ts-ignore - Zotero.version exists at runtime
    return Zotero.version as string;
  }

  /**
   * 日志输出当前版本信息
   */
  static logVersionInfo(): void {
    console.log(`[Researchopia] Running on Zotero ${this.getFullVersion()} (Major: ${this.getMajorVersion()})`);
  }

  /**
   * 检查版本是否受支持
   */
  static isSupportedVersion(): boolean {
    const major = this.getMajorVersion();
    return major >= 7 && major <= 8;
  }
}
