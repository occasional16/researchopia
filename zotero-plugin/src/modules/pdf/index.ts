/**
 * PDF模块索引文件
 * 从 pdf/ 子目录导出所有模块
 */

// 主控制器（向后兼容）
export { PDFReaderCoordinator, PDFReaderManager } from "./PDFReaderCoordinator";

// 子模块（供高级用户使用）
export { HighlightRenderer, type IHighlightRenderer, type SharedAnnotation } from "./HighlightRenderer";
export { ReaderEventSystem, type IReaderEventSystem } from "./ReaderEventSystem";
export { ResponsiveLayoutHandler, type IResponsiveLayoutHandler } from "./ResponsiveLayoutHandler";
