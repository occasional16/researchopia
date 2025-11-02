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
  
  // 如果是DOI格式,编码后使用
  if (paperId.includes('/')) {
    return `/papers/${encodeURIComponent(paperId)}`
  }
  
  // 否则直接使用ID
  return `/papers/${paperId}`
}

/**
 * 从路由参数中解析论文ID或DOI
 * @param param - 路由参数
 * @returns 解码后的论文ID或DOI
 */
export function parsePaperParam(param: string): string {
  return decodeURIComponent(param)
}
