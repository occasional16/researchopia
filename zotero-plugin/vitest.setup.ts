/**
 * Vitest测试环境设置
 * Mock Zotero API和全局对象
 */

import { vi } from 'vitest';

// Mock Zotero全局对象
const mockZotero = {
  debug: vi.fn(),
  log: vi.fn(),
  logError: vi.fn(),
  warn: vi.fn(),
  Prefs: {
    get: vi.fn(),
    set: vi.fn(),
  },
  ItemTypes: {
    getName: vi.fn((id) => 'journalArticle'),
  },
  ItemPaneManager: {
    registerSection: vi.fn(),
  },
  Reader: {
    getByTabID: vi.fn(),
  },
  Items: {
    get: vi.fn(),
    getAll: vi.fn(() => []),
  },
  getActiveZoteroPane: vi.fn(() => ({
    document: global.document,
  })),
};

// 挂载到全局
(global as any).Zotero = mockZotero;
(global as any).ztoolkit = {
  log: vi.fn(),
  getGlobal: vi.fn(() => global),
};

// Mock ChromeUtils（Zotero插件环境）
(global as any).ChromeUtils = {
  import: vi.fn(),
  defineModuleGetter: vi.fn(),
};

// Mock Services
(global as any).Services = {
  scriptloader: {
    loadSubScript: vi.fn(),
  },
  prefs: {
    getBoolPref: vi.fn(),
    getCharPref: vi.fn(),
  },
};

console.log('[Vitest Setup] Zotero mock environment initialized');
