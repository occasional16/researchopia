import { logger } from "../../utils/logger";
import { AuthManager } from "../auth";
import { resolveCommentDisplayInfo, createToggleSwitch } from "./helpers";
import { UserHoverCardManager } from "./userHoverCard";
import type { BaseViewContext, PaperInfo } from "./types";
import { containerPadding } from "./styles";
import { ServicesAdapter } from '../../adapters';

/**
 * 论文评价视图
 * 负责渲染和管理论文评价功能
 */
export class PaperEvaluationView {
  private userHoverCardManager: UserHoverCardManager;
  
  constructor(private readonly context: BaseViewContext) {
    this.userHoverCardManager = new UserHoverCardManager(context);
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.userHoverCardManager.cleanup();
  }

  /**
   * 渲染论文评价视图
   */
  public async render(container: HTMLElement, paperInfo: PaperInfo): Promise<void> {
    const doc = container.ownerDocument;
    const user = AuthManager.getCurrentUser();

    if (!user) {
      const message = doc.createElement('div');
      message.style.cssText = 'padding: 20px; text-align: center; color: #6c757d;';
      message.textContent = '请先登录以评价论文';
      container.appendChild(message);
      return;
    }

    const currentUserId = user.id;

    // 获取论文ID (通过papers表的doi字段查询)
    let paperId: string | null = null;
    if (paperInfo.doi) {
      try {
        const response = await fetch(
          `${this.context.supabaseManager['baseUrl']}/rest/v1/papers?doi=eq.${paperInfo.doi}&select=id`,
          {
            headers: {
              'apikey': this.context.supabaseManager['apiKey'],
              'Authorization': `Bearer ${this.context.supabaseManager['apiKey']}`
            }
          }
        );
        const papers = await response.json() as unknown as { id: string }[];
        if (papers && papers.length > 0) {
          paperId = papers[0].id;
        }
      } catch (error) {
        logger.error('[PaperEvaluationView] Error getting paper ID:', error);
      }
    }

    // 如果找不到论文记录,显示提示
    if (!paperId) {
      container.innerHTML = '';
      const message = doc.createElement('div');
      message.style.cssText = 'padding: 20px; text-align: center; color: #6c757d;';
      message.innerHTML = `
        <div style="margin-bottom: 8px;">📋 该论文尚未在Researchopia注册</div>
        <div style="font-size: 11px; color: #9ca3af;">
          请先在网站上添加该论文,才能进行评价
        </div>
      `;
      container.appendChild(message);
      return;
    }

    try {
      // 获取所有评分
      const ratingsResponse = await fetch(
        `${this.context.supabaseManager['baseUrl']}/rest/v1/paper_ratings?paper_id=eq.${paperId}&select=*,users(username,avatar_url)`,
        {
          headers: {
            'apikey': this.context.supabaseManager['apiKey'],
            'Authorization': `Bearer ${this.context.supabaseManager['apiKey']}`
          }
        }
      );
      const ratingsData = await ratingsResponse.json();
      const ratings = Array.isArray(ratingsData) ? ratingsData : [];

      // 获取当前用户的评分
      const userRating = ratings.find((r: any) => r.user_id === currentUserId);

      // 获取评论树
      const commentTree = await this.context.supabaseManager.getPaperCommentTree(paperId);

      // 清空容器（移除UIManager添加的loading indicator）
      container.innerHTML = '';
      
      // 重置容器样式,确保布局一致(垂直排列,优化窄窗口)
      container.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 0;
        padding: ${containerPadding.content};
        overflow-y: auto;
        overflow-x: hidden;
        box-sizing: border-box;
        background: #f9fafb;
        border-radius: 10px;
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
      `;

      // 创建评分区域
      const ratingSection = this.createRatingSection(doc, ratings, userRating, paperId, currentUserId);
      container.appendChild(ratingSection);

      // 创建评论区域
      const commentSection = this.createCommentSection(doc, commentTree, paperId, currentUserId);
      container.appendChild(commentSection);

    } catch (error) {
      container.innerHTML = '';
      logger.error('[PaperEvaluationView] Error loading paper evaluation:', error);
      logger.error('[PaperEvaluationView] Error details:', error instanceof Error ? error.message : String(error));
      logger.error('[PaperEvaluationView] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

      const errorDiv = doc.createElement('div');
      errorDiv.style.cssText = 'padding: 20px; text-align: center; color: #ef4444;';
      errorDiv.textContent = '加载失败: ' + (error instanceof Error ? error.message : String(error));
      container.appendChild(errorDiv);

      this.context.showMessage('加载失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
    }
  }

  /**
   * 创建评分区域
   */
  private createRatingSection(
    doc: Document,
    ratings: any[],
    userRating: any | null,
    paperId: string,
    userId: string
  ): HTMLElement {
    const section = doc.createElement('div');
    section.style.cssText = `
      display: block;
      width: 100%;
      padding: 16px;
      border-bottom: 1px solid #e9ecef;
      box-sizing: border-box;
    `;

    const title = doc.createElement('h3');
    title.style.cssText = 'margin: 0 0 12px 0; font-size: 14px; color: #212529;';
    title.textContent = '📊 论文评分';
    section.appendChild(title);

    // 显示平均分
    if (ratings.length > 0) {
      const avgScores = {
        innovation: 0,
        methodology: 0,
        results: 0,
        writing: 0,
        practical: 0
      };

      ratings.forEach((r: any) => {
        avgScores.innovation += r.innovation_score || 0;
        avgScores.methodology += r.methodology_score || 0;
        avgScores.results += r.results_score || 0;
        avgScores.writing += r.writing_score || 0;
        avgScores.practical += r.practical_score || 0;
      });

      Object.keys(avgScores).forEach(key => {
        avgScores[key as keyof typeof avgScores] /= ratings.length;
      });

      const avgDiv = doc.createElement('div');
      avgDiv.style.cssText = 'margin-bottom: 12px; padding: 8px; background: #6c757d; border-radius: 4px;';
      avgDiv.innerHTML = `
        <div style="font-size: 11px; color: #6c757d; margin-bottom: 4px;">平均分 (${ratings.length}人评价)</div>
        <div style="font-size: 12px; color: #212529;">
          创新性: ${avgScores.innovation.toFixed(1)} | 
          方法论: ${avgScores.methodology.toFixed(1)} | 
          结果质量: ${avgScores.results.toFixed(1)} | 
          写作质量: ${avgScores.writing.toFixed(1)} | 
          实用价值: ${avgScores.practical.toFixed(1)}
        </div>
      `;
      section.appendChild(avgDiv);
    }

    // 创建评分表单
    const form = this.createRatingForm(doc, userRating, paperId, userId);
    section.appendChild(form);

    return section;
  }

  /**
   * 创建评分表单（星星评分+匿名选项）
   */
  private createRatingForm(
    doc: Document,
    userRating: any | null,
    paperId: string,
    userId: string
  ): HTMLElement {
    const form = doc.createElement('div');
    form.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

    const scores = {
      innovation_score: userRating?.innovation_score || 0,
      methodology_score: userRating?.methodology_score || 0,
      practicality_score: userRating?.practicality_score || 0,
      overall_score: userRating?.overall_score || 0
    };

    const categories = [
      { key: 'innovation_score', label: '创新性', icon: '💡' },
      { key: 'methodology_score', label: '方法论', icon: '🔬' },
      { key: 'practicality_score', label: '实用性', icon: '⚙️' },
      { key: 'overall_score', label: '总体评价', icon: '⭐' }
    ];

    categories.forEach(cat => {
      const row = doc.createElement('div');
      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
      `;

      const label = doc.createElement('span');
      label.textContent = `${cat.icon} ${cat.label}:`;
      label.style.cssText = 'min-width: 90px; color: #212529;';
      row.appendChild(label);

      // 星星评分
      const stars = doc.createElement('div');
      stars.style.cssText = 'display: flex; gap: 2px;';
      stars.setAttribute('data-score-key', cat.key);

      for (let i = 1; i <= 5; i++) {
        const star = doc.createElement('span');
        const isFilled = i <= scores[cat.key];
        star.textContent = isFilled ? '⭐' : '☆';
        star.style.cssText = `
          cursor: pointer;
          font-size: 16px;
          transition: transform 0.1s;
          color: ${isFilled ? '#ffc107' : '#9ca3af'};
        `;
        star.setAttribute('data-star-value', i.toString());

        star.addEventListener('mouseenter', () => {
          star.style.transform = 'scale(1.2)';
        });
        star.addEventListener('mouseleave', () => {
          star.style.transform = 'scale(1)';
        });
        star.addEventListener('click', () => {
          scores[cat.key] = i;
          // 重新渲染星星
          const parent = star.parentElement;
          if (parent) {
            Array.from(parent.children).forEach((child, index) => {
              const isFilled = index < i;
              (child as HTMLElement).textContent = isFilled ? '⭐' : '☆';
              (child as HTMLElement).style.color = isFilled ? '#ffc107' : '#9ca3af';
            });
          }
          // 更新评分文本
          const scoreText = row.querySelector('.score-text') as HTMLElement;
          if (scoreText) {
            scoreText.textContent = `${i}/5`;
          }
        });
        stars.appendChild(star);
      }
      row.appendChild(stars);

      const scoreText = doc.createElement('span');
      scoreText.className = 'score-text';
      scoreText.textContent = scores[cat.key] > 0 ? `${scores[cat.key]}/5` : '未评分';
      scoreText.style.cssText = 'color: #6c757d; font-size: 11px; margin-left: 4px;';
      row.appendChild(scoreText);

      form.appendChild(row);
    });

    // 匿名选项
    let isAnonymous = userRating?.is_anonymous || false;

    const anonymousContainer = doc.createElement('div');
    anonymousContainer.style.cssText = `
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e9ecef;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    const anonymousRow = doc.createElement('div');
    anonymousRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const anonymousSwitch = createToggleSwitch(
      doc,
      'rating-anonymous-switch',
      isAnonymous,
      "#8b5cf6"
    );

    // 获取开关内部的checkbox
    const anonymousCheckbox = anonymousSwitch.querySelector('input[type="checkbox"]') as HTMLInputElement;

    // 监听匿名开关变化
    if (anonymousCheckbox) {
      anonymousCheckbox.addEventListener('change', () => {
        isAnonymous = anonymousCheckbox.checked;
      });
    }

    const anonymousLabel = doc.createElement('label');
    anonymousLabel.textContent = '匿名评分';
    anonymousLabel.style.cssText = 'font-size: 12px; color: #212529; cursor: pointer;';

    anonymousRow.appendChild(anonymousSwitch);
    anonymousRow.appendChild(anonymousLabel);
    anonymousContainer.appendChild(anonymousRow);

    form.appendChild(anonymousContainer);

    // 提交按钮
    const submitBtn = doc.createElement('button');
    submitBtn.textContent = userRating ? '更新评分' : '提交评分';
    submitBtn.style.cssText = `
      padding: 8px 12px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      margin-top: 8px;
      transition: background 0.2s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;
    `;
    submitBtn.addEventListener('mouseenter', () => {
      submitBtn.style.background = '#2563eb';
    });
    submitBtn.addEventListener('mouseleave', () => {
      submitBtn.style.background = '#3b82f6';
    });
    submitBtn.addEventListener('click', async () => {
      if (Object.values(scores).some(s => s === 0)) {
        this.context.showMessage('请为所有维度评分', 'error');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = '提交中...';

        await this.context.supabaseManager.submitPaperRating({
          paper_id: paperId,
          user_id: userId,
          ...scores,
          is_anonymous: isAnonymous,
          show_username: !isAnonymous,
        });

        this.context.showMessage('评分已提交', 'info');
        setTimeout(() => {
          this.context.handleButtonClick('paper-evaluation');
        }, 500);
      } catch (error) {
        logger.error('[PaperEvaluationView] Error submitting rating:', error);
        this.context.showMessage('提交失败', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = userRating ? '更新评分' : '提交评分';
      }
    });
    form.appendChild(submitBtn);

    return form;
  }

  /**
   * 创建评论区域
   */
  private createCommentSection(
    doc: Document,
    commentTree: any[],
    paperId: string,
    userId: string
  ): HTMLElement {
    const section = doc.createElement('div');
    section.style.cssText = `
      display: block;
      width: 100%;
      padding: 16px;
      box-sizing: border-box;
    `;

    const title = doc.createElement('h3');
    title.style.cssText = 'margin: 0 0 12px 0; font-size: 14px; color: #212529;';
    title.textContent = `💬 论文评论 (${commentTree.length})`;
    section.appendChild(title);

    // 显示现有评论
    if (commentTree.length > 0) {
      const commentsList = doc.createElement('div');
      commentsList.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;';
      
      // 递归渲染评论树
      commentTree.forEach(rootComment => {
        const commentNode = this.renderPaperCommentNode(
          rootComment,
          0,
          doc,
          userId,
          paperId,
          section
        );
        commentsList.appendChild(commentNode);
      });
      
      section.appendChild(commentsList);
    }

    // 添加评论输入框
    const form = doc.createElement('div');
    form.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-top: 12px;';

    const textarea = doc.createElement('textarea');
    textarea.placeholder = '发表你的评论...';
    textarea.style.cssText = `
      padding: 8px;
      border: 1px solid #e9ecef;
      border-radius: 3px;
      font-size: 12px;
      font-family: inherit;
      resize: vertical;
      min-height: 80px;
      background: #ffffff;
      color: #212529;
    `;

    // 匿名选项
    const anonymousContainer = doc.createElement('div');
    anonymousContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const anonymousSwitch = createToggleSwitch(
      doc,
      'paper-comment-anonymous-switch',
      false,
      "#8b5cf6"
    );

    const anonymousLabel = doc.createElement('label');
    anonymousLabel.textContent = '匿名评论';
    anonymousLabel.style.cssText = 'font-size: 12px; color: #6c757d; cursor: pointer;';

    anonymousContainer.appendChild(anonymousSwitch);
    anonymousContainer.appendChild(anonymousLabel);

    const submitBtn = doc.createElement('button');
    submitBtn.textContent = '发表评论';
    submitBtn.style.cssText = `
      padding: 6px 12px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      align-self: flex-end;
      transition: background 0.2s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;
    `;
    submitBtn.addEventListener('mouseenter', () => {
      submitBtn.style.background = '#2563eb';
    });
    submitBtn.addEventListener('mouseleave', () => {
      submitBtn.style.background = '#3b82f6';
    });

    submitBtn.addEventListener('click', async () => {
      const content = textarea.value.trim();
      if (!content) {
        this.context.showMessage('请输入评论内容', 'error');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = '发表中...';

        // 从开关中获取checkbox状态
        const switchCheckbox = anonymousSwitch.querySelector('input[type="checkbox"]') as HTMLInputElement;
        const isAnonymous = switchCheckbox ? switchCheckbox.checked : false;

        await this.context.supabaseManager.submitPaperComment(paperId, userId, content, isAnonymous);

        this.context.showMessage('评论已发表', 'info');
        textarea.value = '';

        // 重置开关状态
        if (switchCheckbox) {
          switchCheckbox.checked = false;
          const track = anonymousSwitch.querySelector('.switch-track') as HTMLElement;
          const thumb = track?.querySelector('.switch-thumb') as HTMLElement;
          if (track && thumb) {
            track.style.background = '#d1d5db';
            thumb.style.left = '2px';
          }
        }

        // 刷新评论列表
        setTimeout(() => {
          this.context.handleButtonClick('paper-evaluation');
        }, 500);
      } catch (error) {
        logger.error('[PaperEvaluationView] Error submitting comment:', error);
        this.context.showMessage('发表失败', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '发表评论';
      }
    });

    form.appendChild(textarea);
    form.appendChild(anonymousContainer);
    form.appendChild(submitBtn);
    section.appendChild(form);

    // 如果没有评论，显示提示
    if (commentTree.length === 0) {
      const emptyMessage = doc.createElement('div');
      emptyMessage.style.cssText = `
        text-align: center;
        padding: 20px;
        color: #9ca3af;
        font-size: 12px;
      `;
      emptyMessage.textContent = '暂无评论,快来发表第一条评论吧!';
      section.insertBefore(emptyMessage, form);
    }

    return section;
  }

  /**
   * 递归渲染论文评论节点 (支持嵌套)
   */
  private renderPaperCommentNode(
    comment: any,
    depth: number,
    doc: Document,
    currentUserId: string,
    paperId: string,
    sectionElement: HTMLElement
  ): HTMLElement {
    const container = doc.createElement('div');
    container.className = 'paper-comment-node';
    container.setAttribute('data-comment-id', comment.id);
    container.setAttribute('data-depth', depth.toString());
    container.style.cssText = `
      margin-left: ${depth * 20}px;
      ${depth > 0 ? 'border-left: 2px solid #e9ecef; padding-left: 8px;' : ''}
      margin-bottom: ${depth > 0 ? '4px' : '8px'};
    `;

    // 评论主体
    const commentBody = doc.createElement('div');
    commentBody.className = 'paper-comment-body';
    commentBody.style.cssText = `
      padding: 12px;
      background: #ffffff;
      border-radius: 8px;
      font-size: 13px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      border: 1px solid #e5e7eb;
    `;

    // 头部
    const header = doc.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 4px;';

    const userInfo = doc.createElement('div');
    userInfo.style.cssText = 'color: #6c757d; display: flex; gap: 6px; align-items: center; font-size: 11px;';

    const { name: userName, isAnonymous } = resolveCommentDisplayInfo(comment);
    const replyCount = comment.reply_count || comment.children?.length || 0;

    // 使用UserHoverCardManager创建用户元素(支持hover和点击)
    const userElement = this.userHoverCardManager.createUserElement(
      doc,
      comment.username || comment.user?.username || '',
      userName,
      {
        isAnonymous,
        clickable: !isAnonymous
      }
    );
    userInfo.appendChild(userElement);

    // 添加匿名锁图标和其他信息
    const extraInfo = doc.createElement('span');
    extraInfo.innerHTML = `
      ${isAnonymous ? '<span style="color: #ced4da; font-size: 10px; margin-left: 2px;">🔒</span>' : ''}
      <span style="color: #ced4da;">·</span>
      <span>${this.formatDate(comment.created_at)}</span>
      ${replyCount > 0 ? `<span style="color: #0d6efd;">· ${replyCount} 回复</span>` : ''}
    `;
    userInfo.appendChild(extraInfo);

    header.appendChild(userInfo);

    // 操作按钮
    const actions = doc.createElement('div');
    actions.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';

    // 回复按钮
    const replyBtn = doc.createElement('button');
    replyBtn.textContent = '💬 回复';
    replyBtn.style.cssText = `
      padding: 2px 8px;
      background: transparent;
      color: #0d6efd;
      border: 1px solid currentColor;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;
    `;
    replyBtn.addEventListener('click', () => {
      this.togglePaperCommentReplyBox(container, comment, paperId, currentUserId, sectionElement);
    });
    actions.appendChild(replyBtn);

    // 编辑删除按钮 (自己的评论可编辑删除, 管理员可删除所有评论)
    const isOwnComment = comment.user_id === currentUserId;
    const currentUser = AuthManager.getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';
    const canDelete = isOwnComment || isAdmin;

    if (isOwnComment) {
      const editBtn = doc.createElement('button');
      editBtn.textContent = '编辑';
      editBtn.style.cssText = `
        padding: 2px 8px;
        background: transparent;
        color: #0d6efd;
        border: 1px solid currentColor;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-sizing: border-box;
      `;
      editBtn.addEventListener('click', () => {
        const contentDiv = commentBody.querySelector('.comment-content') as HTMLElement;
        if (contentDiv) {
          this.togglePaperCommentEditMode(contentDiv, comment, sectionElement, paperId, currentUserId);
        }
      });
      actions.appendChild(editBtn);
    }

    if (canDelete) {
      const deleteBtn = doc.createElement('button');
      deleteBtn.textContent = isAdmin && !isOwnComment ? '删除(管理员)' : '删除';
      deleteBtn.style.cssText = `
        padding: 2px 8px;
        background: transparent;
        color: #ef4444;
        border: 1px solid currentColor;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-sizing: border-box;
      `;
      deleteBtn.addEventListener('click', async () => {
        const confirmed = ServicesAdapter.confirm(
          '确认删除',
          '确定要删除这条评论吗? 所有回复也会被删除。'
        );

        if (confirmed) {
          try {
            await this.context.supabaseManager.deletePaperComment(comment.id);
            this.context.showMessage('评论已删除', 'info');

            // 刷新评论区域
            setTimeout(() => {
              this.context.handleButtonClick('paper-evaluation');
            }, 500);
          } catch (error) {
            logger.error('[PaperEvaluationView] Error deleting comment:', error);
            this.context.showMessage('删除失败', 'error');
          }
        }
      });
      actions.appendChild(deleteBtn);
    }

    header.appendChild(actions);
    commentBody.appendChild(header);

    // 内容
    const content = doc.createElement('div');
    content.className = 'comment-content';
    content.style.cssText = 'color: #212529; line-height: 1.5; word-wrap: break-word;';
    content.textContent = comment.content;
    commentBody.appendChild(content);

    container.appendChild(commentBody);

    // 回复框容器
    const replyBoxContainer = doc.createElement('div');
    replyBoxContainer.className = 'reply-box-container';
    replyBoxContainer.style.display = 'none';
    container.appendChild(replyBoxContainer);

    // 递归渲染子评论
    if (comment.children && comment.children.length > 0) {
      comment.children.forEach((child: any) => {
        const childNode = this.renderPaperCommentNode(
          child,
          depth + 1,
          doc,
          currentUserId,
          paperId,
          sectionElement
        );
        container.appendChild(childNode);
      });
    }

    return container;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;

    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  private togglePaperCommentReplyBox(
    container: HTMLElement,
    parentComment: any,
    paperId: string,
    userId: string,
    sectionElement: HTMLElement
  ): void {
    const doc = container.ownerDocument;
    const replyBoxContainer = container.querySelector('.reply-box-container') as HTMLElement;

    if (!replyBoxContainer) return;

    // 切换显示/隐藏
    if (replyBoxContainer.style.display !== 'none') {
      replyBoxContainer.style.display = 'none';
      return;
    }

    // 创建回复输入框
    replyBoxContainer.innerHTML = '';
    replyBoxContainer.style.display = 'block';
    replyBoxContainer.style.cssText = `
      display: block;
      margin-top: 8px;
      padding: 8px;
      background: #ffffff;
      border-radius: 4px;
    `;

    const textarea = doc.createElement('textarea');
    const { name: displayName } = resolveCommentDisplayInfo(parentComment);
    textarea.placeholder = `回复 @${displayName}...`;
    textarea.style.cssText = `
      width: 100%;
      padding: 6px;
      border: 1px solid #3b82f6;
      border-radius: 3px;
      resize: vertical;
      min-height: 50px;
      font-size: 11px;
      font-family: inherit;
      background: #ffffff;
      color: #212529;
      box-sizing: border-box;
    `;

    // 匿名选项
    const anonymousContainer = doc.createElement('div');
    anonymousContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 11px; color: #6c757d;';

    const anonymousSwitch = createToggleSwitch(
      doc,
      `anonymous-paper-reply-${parentComment.id}`,
      false,
      "#8b5cf6"
    );

    const anonymousLabel = doc.createElement('label');
    anonymousLabel.htmlFor = `anonymous-paper-reply-${parentComment.id}`;
    anonymousLabel.textContent = '匿名回复（将显示为"匿名用户"）';
    anonymousLabel.style.cssText = 'cursor: pointer; user-select: none;';

    anonymousContainer.appendChild(anonymousSwitch);
    anonymousContainer.appendChild(anonymousLabel);

    const btnContainer = doc.createElement('div');
    btnContainer.style.cssText = 'display: flex; gap: 6px; margin-top: 6px; justify-content: flex-end;';

    const cancelBtn = doc.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
      padding: 4px 10px;
      background: transparent;
      color: #6c757d;
      border: 1px solid #e9ecef;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `;
    cancelBtn.addEventListener('click', () => {
      replyBoxContainer.style.display = 'none';
    });

    const submitBtn = doc.createElement('button');
    submitBtn.textContent = '发表回复';
    submitBtn.style.cssText = `
      padding: 4px 10px;
      background: #0d6efd;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `;

    submitBtn.addEventListener('click', async () => {
      const content = textarea.value.trim();
      if (!content) {
        this.context.showMessage('请输入回复内容', 'error');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = '发表中...';

        // 从开关中获取checkbox状态
        const switchCheckbox = anonymousSwitch.querySelector('input[type="checkbox"]') as HTMLInputElement;
        const isAnonymous = switchCheckbox ? switchCheckbox.checked : false;

        await this.context.supabaseManager.replyToPaperComment(
          paperId,
          parentComment.id,
          userId,
          content,
          isAnonymous
        );

        this.context.showMessage('回复已发表', 'info');
        replyBoxContainer.style.display = 'none';

        // 刷新评论区域
        setTimeout(() => {
          this.context.handleButtonClick('paper-evaluation');
        }, 500);
      } catch (error) {
        logger.error('[PaperEvaluationView] Error submitting reply:', error);
        this.context.showMessage('发表失败', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '发表回复';
      }
    });

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(submitBtn);

    replyBoxContainer.appendChild(textarea);
    replyBoxContainer.appendChild(anonymousContainer);
    replyBoxContainer.appendChild(btnContainer);

    textarea.focus();
  }

  private togglePaperCommentEditMode(
    contentDiv: HTMLElement,
    comment: any,
    sectionElement: HTMLElement,
    paperId: string,
    userId: string
  ): void {
    const doc = contentDiv.ownerDocument;

    // 创建编辑界面
    const textarea = doc.createElement('textarea');
    textarea.value = comment.content;
    textarea.style.cssText = `
      width: 100%;
      padding: 6px;
      border: 1px solid #3b82f6;
      border-radius: 3px;
      resize: vertical;
      min-height: 50px;
      font-size: 11px;
      font-family: inherit;
      background: #ffffff;
      color: #212529;
      box-sizing: border-box;
    `;

    // 创建匿名开关容器
    const anonymousContainer = doc.createElement('div');
    anonymousContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-top: 6px;';

    const anonymousSwitch = createToggleSwitch(
      doc,
      `toggle-paper-edit-anonymous-${comment.id}`,
      comment.is_anonymous || false,
      "#8b5cf6"
    );

    const anonymousLabel = doc.createElement('label');
    anonymousLabel.htmlFor = `toggle-paper-edit-anonymous-${comment.id}`;
    anonymousLabel.textContent = '匿名显示';
    anonymousLabel.style.cssText = 'font-size: 11px; color: #6c757d; cursor: pointer;';

    const anonymousHint = doc.createElement('span');
    anonymousHint.textContent = '(将显示为"匿名用户")';
    anonymousHint.style.cssText = 'font-size: 11px; color: #3b82f6; margin-left: 4px;';
    anonymousHint.style.display = (comment.is_anonymous || false) ? 'inline' : 'none';

    // 监听开关变化
    const switchCheckbox = anonymousSwitch.querySelector('input[type="checkbox"]') as HTMLInputElement;
    if (switchCheckbox) {
      switchCheckbox.addEventListener('change', () => {
        anonymousHint.style.display = switchCheckbox.checked ? 'inline' : 'none';
      });
    }

    anonymousContainer.appendChild(anonymousSwitch);
    anonymousContainer.appendChild(anonymousLabel);
    anonymousContainer.appendChild(anonymousHint);

    const btnContainer = doc.createElement('div');
    btnContainer.style.cssText = 'display: flex; gap: 6px; margin-top: 6px; justify-content: flex-end;';

    const cancelBtn = doc.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
      padding: 4px 10px;
      background: transparent;
      color: #6c757d;
      border: 1px solid #e9ecef;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `;
    cancelBtn.addEventListener('click', () => {
      // 恢复原始内容
      contentDiv.textContent = comment.content;
    });

    const saveBtn = doc.createElement('button');
    saveBtn.textContent = '保存';
    saveBtn.style.cssText = `
      padding: 4px 10px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `;
    saveBtn.addEventListener('click', async () => {
      const newContent = textarea.value.trim();
      // 从开关中获取checkbox状态
      const switchCheckbox = anonymousSwitch.querySelector('input[type="checkbox"]') as HTMLInputElement;
      const isAnonymous = switchCheckbox ? switchCheckbox.checked : false;

      if (!newContent) {
        this.context.showMessage('评论内容不能为空', 'error');
        return;
      }

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';

        await this.context.supabaseManager.updatePaperComment(comment.id, newContent, isAnonymous);

        this.context.showMessage('评论已更新', 'info');

        // 刷新评论区域
        setTimeout(() => {
          this.context.handleButtonClick('paper-evaluation');
        }, 500);
      } catch (error) {
        logger.error('[PaperEvaluationView] Error updating paper comment:', error);
        this.context.showMessage('更新失败', 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = '保存';
      }
    });

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(saveBtn);

    // 替换内容为编辑界面
    contentDiv.innerHTML = '';
    contentDiv.appendChild(textarea);
    contentDiv.appendChild(anonymousContainer);
    contentDiv.appendChild(btnContainer);

    textarea.focus();
  }
}

