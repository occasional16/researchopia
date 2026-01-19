/**
 * Comment UI module for the browser extension
 * Handles comment rendering and interaction
 */

import type { SidebarComment } from '../types';
import { formatRelativeTime, escapeHtml, showToast, setHidden, getElement } from '../utils';

// ============================================================================
// Types
// ============================================================================

export interface CommentActions {
  onSubmit: (content: string, parentId?: string | null, isAnonymous?: boolean) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onLoadMore: () => Promise<void>;
  onLike: (commentId: string) => Promise<void>;
}

// ============================================================================
// Comment UI Manager Class
// ============================================================================

export class CommentUIManager {
  private comments: SidebarComment[] = [];
  private currentUserId: string | null = null;
  private hasMore: boolean = false;
  private actions: CommentActions;
  private filter: 'all' | 'mine' = 'all';
  private total: number = 0;

  constructor(actions: CommentActions) {
    this.actions = actions;
  }

  // ==================== Setters ====================

  setComments(comments: SidebarComment[], hasMore: boolean, total?: number): void {
    this.comments = comments;
    this.hasMore = hasMore;
    this.total = total || comments.length;
    
    this.updateCommentCount();
    this.render();
  }

  appendComments(newComments: SidebarComment[], hasMore: boolean): void {
    this.comments = [...this.comments, ...newComments];
    this.hasMore = hasMore;
    this.render();
  }

  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
  }
  
  setFilter(filter: 'all' | 'mine'): void {
    this.filter = filter;
    this.updateCommentCount();
    this.render();
  }
  
  private updateCommentCount(): void {
    const commentCount = document.getElementById('commentCount');
    if (commentCount) {
      const filtered = this.getFilteredComments();
      if (this.filter === 'mine' && filtered.length !== this.total) {
        commentCount.textContent = `${filtered.length} / ${this.total}`;
      } else {
        commentCount.textContent = String(this.total);
      }
    }
  }
  
  private getFilteredComments(): SidebarComment[] {
    if (this.filter === 'mine' && this.currentUserId) {
      return this.comments.filter(c => 
        (c.user_id || c.userId) === this.currentUserId
      );
    }
    return this.comments;
  }

  // ==================== Loading State ====================

  showLoading(): void {
    setHidden(document.getElementById('commentsLoading'), false);
  }

  hideLoading(): void {
    setHidden(document.getElementById('commentsLoading'), true);
  }
  
  // ==================== Helper Methods ====================
  
  /**
   * Build avatar HTML (image or initial letter)
   */
  private buildAvatarHtml(avatarUrl: string | null | undefined, authorName: string, isAnonymous: boolean): string {
    if (isAnonymous) {
      return `<div class="comment-avatar comment-avatar-anon">?</div>`;
    }
    
    if (avatarUrl) {
      // Use image with fallback to initial on error
      const initial = authorName.charAt(0).toUpperCase();
      return `<img class="comment-avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(authorName)}" onerror="this.outerHTML='<div class=\\'comment-avatar\\'>${initial}</div>'">`;
    }
    
    // Fallback to initial letter
    const initial = authorName.charAt(0).toUpperCase();
    return `<div class="comment-avatar">${initial}</div>`;
  }
  
  /**
   * Format full timestamp for tooltip
   */
  private formatFullTime(timestamp: string | undefined): string {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '';
    }
  }

  // ==================== Render ====================

  /**
   * Maximum nesting depth for replies
   */
  private readonly MAX_DEPTH = 3;

  /**
   * Render all comments
   */
  render(): void {
    const container = document.getElementById('commentList');
    const noComments = document.getElementById('noComments');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    
    if (!container) return;

    // Clear existing comments
    container.querySelectorAll('.comment-item').forEach(el => el.remove());

    // Get filtered comments
    const filteredComments = this.getFilteredComments();
    
    // Get top-level comments (no parent) - API returns nested structure via children
    const topLevelComments = filteredComments.filter(c => !c.parent_id && !c.parentId);

    // Render each comment with its nested replies recursively
    topLevelComments.forEach(comment => {
      const commentEl = this.createCommentElement(comment, 0);
      container.appendChild(commentEl);
    });

    // Toggle empty state and load more button
    setHidden(noComments, filteredComments.length > 0);
    setHidden(loadMoreBtn, !this.hasMore && this.filter === 'all');
  }

  /**
   * Create a comment element with support for nested replies
   * @param comment The comment to render
   * @param depth Current nesting depth (0 = top level)
   */
  private createCommentElement(comment: SidebarComment, depth: number = 0): HTMLDivElement {
    const div = document.createElement('div');
    div.className = depth > 0 ? 'reply-item' : 'comment-item';
    if (depth > 0) {
      div.classList.add(`depth-${Math.min(depth, this.MAX_DEPTH)}`);
    }
    div.dataset.commentId = comment.id;

    const timeStr = formatRelativeTime(comment.createdAt || comment.created_at);
    const fullTimeStr = this.formatFullTime(comment.createdAt || comment.created_at);
    
    // Use username from users table, fallback to email prefix
    let authorName: string;
    const isAnonymous = comment.is_anonymous || comment.isAnonymous;
    if (isAnonymous) {
      authorName = '匿名用户';
    } else if (comment.user?.username) {
      authorName = comment.user.username;
    } else if (comment.user?.email) {
      authorName = comment.user.email.split('@')[0];
    } else if (comment.user_email) {
      authorName = comment.user_email.split('@')[0];
    } else {
      authorName = '用户';
    }
    
    const isOwner = (comment.user_id || comment.userId) === this.currentUserId;
    
    // Get like count and liked state
    const likeCount = comment.likesCount || comment.likes_count || 0;
    const hasLiked = comment.hasLiked || comment.has_liked || false;
    const likeClass = hasLiked ? 'liked' : '';
    
    // Build avatar HTML
    const avatarUrl = comment.user?.avatarUrl || comment.user?.avatar_url;
    const avatarHtml = this.buildAvatarHtml(avatarUrl, authorName, isAnonymous);
    
    // Show "(你)" badge for user's own anonymous comments
    const ownAnonymousBadge = (isAnonymous && isOwner) 
      ? '<span class="own-anonymous-badge">(你)</span>' 
      : '';
    
    // Can reply if depth < MAX_DEPTH
    const canReply = depth < this.MAX_DEPTH;

    div.innerHTML = `
      <div class="comment-header">
        ${avatarHtml}
        <span class="comment-author">${escapeHtml(authorName)}${ownAnonymousBadge}</span>
        <span class="comment-time" title="${fullTimeStr}">${timeStr}</span>
      </div>
      <div class="comment-content">${escapeHtml(comment.content)}</div>
      <div class="comment-footer">
        <button class="comment-action-btn like-btn ${likeClass}" data-id="${comment.id}" title="点赞">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="${hasLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>
          <span class="like-count">${likeCount > 0 ? likeCount : ''}</span>
        </button>
        ${canReply ? `<button class="comment-action-btn reply-btn" data-id="${comment.id}">回复</button>` : ''}
        ${isOwner ? `<button class="comment-action-btn delete-btn" data-id="${comment.id}">删除</button>` : ''}
      </div>
    `;

    // Attach event listeners
    const likeBtn = div.querySelector('.like-btn');
    if (likeBtn) {
      likeBtn.addEventListener('click', () => this.handleLike(comment.id, div));
    }

    const replyBtn = div.querySelector('.reply-btn');
    if (replyBtn) {
      replyBtn.addEventListener('click', () => this.showReplyForm(comment.id, div));
    }

    const deleteBtn = div.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.handleDelete(comment.id));
    }

    // Recursively render nested children (from API nested=true response)
    if (comment.children && comment.children.length > 0) {
      const repliesContainer = document.createElement('div');
      repliesContainer.className = 'replies';
      comment.children.forEach(child => {
        repliesContainer.appendChild(this.createCommentElement(child, depth + 1));
      });
      div.appendChild(repliesContainer);
    }

    return div;
  }

  /**
   * Show inline reply form under a comment
   */
  private showReplyForm(parentId: string, parentElement: HTMLElement): void {
    // Remove any existing reply forms
    document.querySelectorAll('.reply-form').forEach(el => el.remove());

    const form = document.createElement('div');
    form.className = 'reply-form';
    form.innerHTML = `
      <textarea class="reply-textarea" placeholder="写下您的回复..." maxlength="2000"></textarea>
      <div class="reply-actions">
        <label class="reply-anonymous-option">
          <input type="checkbox" class="reply-anonymous-checkbox">
          <span>匿名</span>
        </label>
        <button class="reply-cancel-btn">取消</button>
        <button class="reply-submit-btn">回复</button>
      </div>
    `;

    const footer = parentElement.querySelector('.comment-footer');
    footer?.after(form);

    const textarea = form.querySelector('.reply-textarea') as HTMLTextAreaElement | null;
    const anonymousCheckbox = form.querySelector('.reply-anonymous-checkbox') as HTMLInputElement | null;
    textarea?.focus();

    form.querySelector('.reply-cancel-btn')?.addEventListener('click', () => form.remove());
    form.querySelector('.reply-submit-btn')?.addEventListener('click', () => {
      const content = textarea?.value.trim();
      const isAnonymous = anonymousCheckbox?.checked || false;
      if (content) {
        this.actions.onSubmit(content, parentId, isAnonymous);
        form.remove();
      }
    });
  }

  /**
   * Handle comment deletion with confirmation
   */
  private async handleDelete(commentId: string): Promise<void> {
    if (!confirm('确定要删除这条评论吗？')) return;
    await this.actions.onDelete(commentId);
  }

  /**
   * Handle like button click
   */
  private async handleLike(commentId: string, element: HTMLElement): Promise<void> {
    const likeBtn = element.querySelector('.like-btn') as HTMLElement;
    if (!likeBtn || likeBtn.classList.contains('loading')) return;

    // Add loading state
    likeBtn.classList.add('loading');
    
    try {
      await this.actions.onLike(commentId);
    } finally {
      likeBtn.classList.remove('loading');
    }
  }

  /**
   * Update like state for a specific comment
   */
  updateCommentLike(commentId: string, hasLiked: boolean, likeCount: number): void {
    // Update local state
    const comment = this.comments.find(c => c.id === commentId);
    if (comment) {
      comment.hasLiked = hasLiked;
      comment.likesCount = likeCount;
    }

    // Update UI
    const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`);
    if (commentEl) {
      const likeBtn = commentEl.querySelector('.like-btn') as HTMLElement;
      const likeSvg = commentEl.querySelector('.like-btn svg');
      const likeCountEl = commentEl.querySelector('.like-count');

      if (likeBtn) {
        likeBtn.classList.toggle('liked', hasLiked);
      }
      if (likeSvg) {
        likeSvg.setAttribute('fill', hasLiked ? 'currentColor' : 'none');
      }
      if (likeCountEl) {
        likeCountEl.textContent = likeCount > 0 ? String(likeCount) : '';
      }
    }
  }

  // ==================== Event Listeners ====================

  /**
   * Setup comment-related event listeners
   */
  setupEventListeners(): void {
    // Main comment submit button
    document.getElementById('submitCommentBtn')?.addEventListener('click', () => {
      const commentInput = getElement<HTMLTextAreaElement>('commentInput');
      const content = commentInput?.value;
      if (content) {
        this.actions.onSubmit(content);
      }
    });

    // Load more button
    document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
      this.actions.onLoadMore();
    });
  }

  /**
   * Clear the main comment input
   */
  clearInput(): void {
    const commentInput = getElement<HTMLTextAreaElement>('commentInput');
    if (commentInput) commentInput.value = '';
  }
}
