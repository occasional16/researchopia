/**
 * Researchopia Plugin Version Configuration
 * 统一版本管理
 */

const PLUGIN_VERSION = '0.1.95';
const PLUGIN_ID = 'researchopia@zotero.plugin';
const PLUGIN_NAME = 'Researchopia';

// 导出版本信息
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    version: PLUGIN_VERSION,
    id: PLUGIN_ID,
    name: PLUGIN_NAME
  };
} else {
  // 浏览器/Zotero环境
  if (typeof globalThis !== 'undefined') {
    globalThis.RESEARCHOPIA_VERSION = PLUGIN_VERSION;
    globalThis.RESEARCHOPIA_ID = PLUGIN_ID;
    globalThis.RESEARCHOPIA_NAME = PLUGIN_NAME;
  }
}
