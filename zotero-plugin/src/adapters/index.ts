/**
 * 适配器统一导出
 * 提供Zotero 7/8兼容层的所有工具
 */

export { ZoteroVersionDetector } from '../utils/version-detector';
export { ModuleAdapter } from './module-adapter';
export { ServicesAdapter } from './services-adapter';
export { UIAdapter, PanelOptions, ButtonOptions, TextboxOptions } from './ui-adapter';
