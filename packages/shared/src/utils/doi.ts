/**
 * DOI工具函数
 * 提供DOI验证、标准化、提取等功能
 */

/**
 * 验证DOI格式
 */
export function validateDOI(doi: string): boolean {
  if (!doi) return false;
  const normalized = normalizeDOI(doi);
  return /^10\.\d{4,}\/[^\s]+$/.test(normalized);
}

/**
 * 标准化DOI格式
 */
export function normalizeDOI(doi: string): string {
  return doi
    .replace(/^doi:/i, '')
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .trim();
}

/**
 * 从文本中提取DOI
 */
export function extractDOI(text: string): string | null {
  if (!text) return null;

  const patterns = [
    /\b(10\.\d{4,}\/[^\s]+)/gi,
    /doi:\s*(10\.\d{4,}\/[^\s]+)/gi,
    /dx\.doi\.org\/(10\.\d{4,}\/[^\s]+)/gi,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return normalizeDOI(match[1] || match[0]);
    }
  }

  return null;
}

/**
 * 从URL提取DOI
 */
export function extractDOIFromURL(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('doi.org')) {
      return normalizeDOI(urlObj.pathname.slice(1));
    }
  } catch {
    return null;
  }
  return extractDOI(url);
}

/**
 * 生成DOI的URL
 */
export function getDOIUrl(doi: string): string {
  const normalized = normalizeDOI(doi);
  return `https://doi.org/${normalized}`;
}
