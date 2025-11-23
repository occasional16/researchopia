/**
 * CommentRenderer - 评论渲染工具类
 * 职责: 渲染标注评论列表 (支持嵌套)
 * 从 PDFReaderCoordinator.ts 重构提取,供多处复用
 */

import { logger } from "../../../utils/logger";

export interface Comment {
  id: string;
  content: string;
  created_at: string;
  username?: string;        // 🔑 直接在根级别
  user_name?: string;       // 兼容旧格式
  users?: {                 // 兼容join格式
    username: string;
    avatar_url?: string | null;
  };
  children?: Comment[];
}

export interface CommentRenderOptions {
  maxDepth?: number;      // 最大嵌套层级 (默认3)
  maxComments?: number;   // 最多显示评论数 (默认无限制)
  showTime?: boolean;     // 是否显示时间 (默认true)
}

export class CommentRenderer {
  /**
   * 渲染评论列表 (支持嵌套)
   * @param comments 评论列表 (树形结构)
   * @param container 目标容器元素
   * @param doc Document对象 (用于createElement)
   * @param options 渲染选项
   * @param depth 当前嵌套深度 (内部使用,默认0)
   */
  public static renderCommentList(
    comments: Comment[],
    container: HTMLElement,
    doc: Document,
    options: CommentRenderOptions = {},
    depth: number = 0
  ): void {
    const {
      maxDepth = 3,
      maxComments,
      showTime = true
    } = options;

    // 深度限制
    if (depth > maxDepth) {
      return;
    }

    // 数量限制
    const commentsToRender = maxComments ? comments.slice(0, maxComments) : comments;

    for (const comment of commentsToRender) {
      const commentDiv = doc.createElement('div');
      commentDiv.style.cssText = `
        margin-left: ${depth * 16}px;
        margin-bottom: 8px;
        padding: 8px;
        background: ${depth === 0 ? '#f9f9f9' : '#ffffff'};
        border-left: 2px solid ${depth === 0 ? '#007bff' : '#e0e0e0'};
        border-radius: 3px;
      `;

      // 评论作者
      const authorDiv = doc.createElement('div');
      authorDiv.style.cssText = `
        font-weight: 600;
        color: #333;
        font-size: 11px;
        margin-bottom: 4px;
      `;
      // 🔑 优先使用 username (根级别), 然后 users.username (join格式), 最后 user_name (兼容)
      authorDiv.textContent = comment.username || comment.users?.username || comment.user_name || '匿名用户';
      commentDiv.appendChild(authorDiv);

      // 评论内容
      const contentDiv = doc.createElement('div');
      contentDiv.style.cssText = `
        color: #444;
        font-size: 11px;
        line-height: 1.4;
        white-space: pre-wrap;
        word-wrap: break-word;
      `;
      contentDiv.textContent = comment.content;
      commentDiv.appendChild(contentDiv);

      // 评论时间
      if (showTime && comment.created_at) {
        const timeDiv = doc.createElement('div');
        timeDiv.style.cssText = `
          color: #999;
          font-size: 10px;
          margin-top: 4px;
        `;
        const date = new Date(comment.created_at);
        timeDiv.textContent = date.toLocaleString('zh-CN');
        commentDiv.appendChild(timeDiv);
      }

      container.appendChild(commentDiv);

      // 递归渲染子评论
      if (comment.children && comment.children.length > 0) {
        this.renderCommentList(comment.children, container, doc, options, depth + 1);
      }
    }
  }

  /**
   * 计算总评论数 (包括嵌套子评论)
   * @param comments 评论列表 (树形结构)
   * @returns 总评论数
   */
  public static countTotalComments(comments: Comment[]): number {
    return comments.reduce((total, comment) => {
      return total + 1 + (comment.children ? this.countTotalComments(comment.children) : 0);
    }, 0);
  }
}
