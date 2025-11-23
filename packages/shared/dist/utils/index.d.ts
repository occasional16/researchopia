/**
 * DOI工具函数
 * 提供DOI验证、标准化、提取等功能
 */
/**
 * 验证DOI格式
 */
declare function validateDOI(doi: string): boolean;
/**
 * 标准化DOI格式
 */
declare function normalizeDOI(doi: string): string;
/**
 * 从文本中提取DOI
 */
declare function extractDOI(text: string): string | null;
/**
 * 从URL提取DOI
 */
declare function extractDOIFromURL(url: string): string | null;
/**
 * 生成DOI的URL
 */
declare function getDOIUrl(doi: string): string;

export { extractDOI, extractDOIFromURL, getDOIUrl, normalizeDOI, validateDOI };
