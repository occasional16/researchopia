/**
 * 标注共享模块 - 统一导出
 * 
 * 此模块包含所有标注共享相关的功能：
 * - PopupSharing: PDF文本选择弹窗的共享按钮
 * - SidebarEnhancer: Sidebar标注卡片的共享按钮
 * - SharedAnnotationsTab: Sidebar独立的共享标注Tab
 */

// 类型定义
export * from './types';

// 常量配置
export * from './constants';

// 缓存管理
export { AnnotationSharingCache, annotationSharingCache } from './cache';

// 功能模块
export { AnnotationSharingPopup, ShareMode } from './popupSharing';
export { SidebarAnnotationEnhancer } from './sidebarEnhancer';
export { SidebarSharedView } from './sharedAnnotationsTab';
