/**
 * 智能论文路由系统
 * 
 * 路由规则：
 * - 有DOI的论文：/doi/[doi] 
 * - 无DOI的论文：/papers/[id]
 */

export interface PaperRoute {
  href: string
  type: 'doi' | 'id'
}

export function getPaperRoute(paper: { id: string; doi?: string }): PaperRoute {
  if (paper.doi && paper.doi.trim()) {
    return {
      href: `/doi/${encodeURIComponent(paper.doi)}`,
      type: 'doi'
    }
  } else {
    return {
      href: `/papers/${paper.id}`,
      type: 'id'
    }
  }
}

export function getExternalDOILink(doi: string): string {
  return `https://doi.org/${doi}`
}

/**
 * 获取论文的标准URL（用于分享、SEO等）
 */
export function getPaperCanonicalURL(paper: { id: string; doi?: string }, baseURL: string = ''): string {
  const route = getPaperRoute(paper)
  return `${baseURL}${route.href}`
}

/**
 * 从路径解析论文标识符
 */
export function parsePaperRoute(pathname: string): { type: 'doi' | 'id'; value: string } | null {
  // /doi/[doi] 格式
  const doiMatch = pathname.match(/^\/doi\/(.+)$/)
  if (doiMatch) {
    return {
      type: 'doi',
      value: decodeURIComponent(doiMatch[1])
    }
  }
  
  // /papers/[id] 格式
  const idMatch = pathname.match(/^\/papers\/([a-f0-9-]+)$/)
  if (idMatch) {
    return {
      type: 'id',
      value: idMatch[1]
    }
  }
  
  return null
}