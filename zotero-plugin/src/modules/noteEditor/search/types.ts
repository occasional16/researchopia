/**
 * Custom Search 类型定义
 */

/**
 * 编辑器元素接口
 */
export interface EditorElement extends HTMLElement {
  _bnScrollHooked?: boolean;
  notify?: (
    event: string,
    type: string,
    ids: number[],
    extraData: any
  ) => Promise<void>;
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  useRegex?: boolean;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  element: HTMLElement;
  index: number;
  text: string;
}
