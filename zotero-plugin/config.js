/*
  Researchopia Annotation Sharing Configuration
  Manages plugin settings and preferences
*/

Zotero.Researchopia.Config = {
  
  /**
   * 默认配置
   */
  defaults: {
    // API设置
    apiBase: 'http://localhost:3003/api/v1',
    apiTimeout: 10000,
    
    // 用户界面设置
    showAnnotationCount: true,
    autoShareNewAnnotations: false,
    confirmBeforeSharing: true,
    
    // 标注设置
    includePrivateAnnotations: false,
    defaultVisibility: 'private',
    syncHighlights: true,
    syncNotes: true,
    syncInkAnnotations: true,
    
    // 平台集成
    enableMendeleyImport: true,
    enableHypothesisImport: true,
    enableAdobeImport: false,
    
    // 高级设置
    batchSize: 50,
    retryAttempts: 3,
    enableDebugLogging: false
  },
  
  /**
   * 获取配置值
   */
  get(key, defaultValue = null) {
    try {
      const prefKey = `extensions.researchopia.${key}`;
      const stored = Zotero.Prefs.get(prefKey, true);
      
      if (stored !== undefined) {
        return stored;
      }
      
      if (defaultValue !== null) {
        return defaultValue;
      }
      
      return this.defaults[key];
    } catch (error) {
      Zotero.Researchopia.log(`Config get error for ${key}: ${error}`);
      return defaultValue !== null ? defaultValue : this.defaults[key];
    }
  },
  
  /**
   * 设置配置值
   */
  set(key, value) {
    try {
      const prefKey = `extensions.researchopia.${key}`;
      Zotero.Prefs.set(prefKey, value, true);
      return true;
    } catch (error) {
      Zotero.Researchopia.log(`Config set error for ${key}: ${error}`);
      return false;
    }
  },
  
  /**
   * 获取API配置
   */
  getApiConfig() {
    return {
      baseUrl: this.get('apiBase'),
      timeout: this.get('apiTimeout'),
      retryAttempts: this.get('retryAttempts')
    };
  },
  
  /**
   * 获取用户界面配置
   */
  getUIConfig() {
    return {
      showCount: this.get('showAnnotationCount'),
      autoShare: this.get('autoShareNewAnnotations'),
      confirmShare: this.get('confirmBeforeSharing')
    };
  },
  
  /**
   * 获取标注同步配置
   */
  getSyncConfig() {
    return {
      includePrivate: this.get('includePrivateAnnotations'),
      defaultVisibility: this.get('defaultVisibility'),
      syncHighlights: this.get('syncHighlights'),
      syncNotes: this.get('syncNotes'),
      syncInk: this.get('syncInkAnnotations'),
      batchSize: this.get('batchSize')
    };
  },
  
  /**
   * 获取平台集成配置
   */
  getPlatformConfig() {
    return {
      mendeley: this.get('enableMendeleyImport'),
      hypothesis: this.get('enableHypothesisImport'),
      adobe: this.get('enableAdobeImport')
    };
  },
  
  /**
   * 重置为默认配置
   */
  resetToDefaults() {
    try {
      Object.keys(this.defaults).forEach(key => {
        this.set(key, this.defaults[key]);
      });
      return true;
    } catch (error) {
      Zotero.Researchopia.log(`Config reset error: ${error}`);
      return false;
    }
  },
  
  /**
   * 导出配置
   */
  exportConfig() {
    const config = {};
    Object.keys(this.defaults).forEach(key => {
      config[key] = this.get(key);
    });
    return config;
  },
  
  /**
   * 导入配置
   */
  importConfig(config) {
    try {
      let imported = 0;
      Object.keys(config).forEach(key => {
        if (this.defaults.hasOwnProperty(key)) {
          if (this.set(key, config[key])) {
            imported++;
          }
        }
      });
      return { success: true, imported };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  /**
   * 验证配置
   */
  validate() {
    const errors = [];
    
    // 验证API URL
    const apiBase = this.get('apiBase');
    try {
      new URL(apiBase);
    } catch {
      errors.push(`Invalid API base URL: ${apiBase}`);
    }
    
    // 验证数值配置
    const numericConfigs = ['apiTimeout', 'batchSize', 'retryAttempts'];
    numericConfigs.forEach(key => {
      const value = this.get(key);
      if (!Number.isInteger(value) || value <= 0) {
        errors.push(`Invalid ${key}: must be a positive integer`);
      }
    });
    
    // 验证字符串配置
    const visibility = this.get('defaultVisibility');
    if (!['public', 'private', 'shared'].includes(visibility)) {
      errors.push(`Invalid defaultVisibility: must be public, private, or shared`);
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
};