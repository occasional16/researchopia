/**
 * 论文路由工具函数
 * 用于生成论文详情页的URL
 */

/**
 * 获取论文详情页的路由
 * @param paperId - 论文ID或DOI
 * @returns 论文详情页的路径
 */
export function getPaperRoute(paperId: string): string {
  if (!paperId) {
    return '/papers'
  }
  
  // Both UUID and DOI can be used directly in the path
  // Catch-all route /papers/[...id] handles DOIs like "10.1038/xxx"
  return `/papers/${paperId}`
}

/**
 * 从路由参数中解析论文ID或DOI
 * @param param - 路由参数 (数组或字符串)
 * @returns 解码后的论文ID或DOI
 */
export function parsePaperParam(param: string | string[]): string {
  if (Array.isArray(param)) {
    return param.join('/')
  }
  return decodeURIComponent(param)
}
