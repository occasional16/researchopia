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
        `${this.context.supabaseManager['baseUrl']}/rest/v1/ratings?paper_id=eq.${paperId}&select=*,users(username,avatar_url)`,
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
      const ratingSection = this.createRatingSection(doc, ratings, userRating, paperId, currentUserId, paperInfo.doi);
      container.appendChild(ratingSection);

      // 创建评论区域
      const commentSection = this.createCommentSection(doc, commentTree, paperId, currentUserId, paperInfo.doi);
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
   * 创建评分区域 (UI aligned with browser extension)
   */
  private createRatingSection(
    doc: Document,
    ratings: any[],
    userRating: any | null,
    paperId: string,
    userId: string,
    paperDoi?: string
  ): HTMLElement {
    const section = doc.createElement('div');
    section.style.cssText = `
      display: block;
      width: 100%;
      padding: 16px;
      border-bottom: 1px solid #e9ecef;
      box-sizing: border-box;
      background: #ffffff;
      border-radius: 8px;
      margin-bottom: 12px;
    `;

    // Section header with title and detail button
    const headerRow = doc.createElement('div');
    headerRow.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    `;

    const title = doc.createElement('h3');
    title.style.cssText = 'margin: 0; font-size: 14px; color: #212529; display: flex; align-items: center; gap: 6px;';
    title.innerHTML = `<span style="color: #f59e0b;">★</span> 论文评分`;
    headerRow.appendChild(title);

    // Detail button (link to website)
    if (paperDoi) {
      const detailBtn = doc.createElement('button');
      detailBtn.textContent = '详情 →';
      detailBtn.style.cssText = `
        background: #3b82f6;
        border: none;
        padding: 4px 10px;
        border-radius: 4px;
        color: white;
        font-size: 11px;
        cursor: pointer;
        transition: background 0.2s;
      `;
      detailBtn.addEventListener('mouseenter', () => {
        detailBtn.style.background = '#2563eb';
      });
      detailBtn.addEventListener('mouseleave', () => {
        detailBtn.style.background = '#3b82f6';
      });
      detailBtn.addEventListener('click', () => {
        const url = `https://www.researchopia.com/papers/${encodeURIComponent(paperDoi)}`;
        Zotero.launchURL(url);
      });
      headerRow.appendChild(detailBtn);
    }

    section.appendChild(headerRow);

    // Rating stats overview (like browser extension)
    if (ratings.length > 0) {
      const avgScores = {
        innovation: 0,
        methodology: 0,
        practicality: 0,
        overall: 0
      };

      ratings.forEach((r: any) => {
        avgScores.innovation += r.innovation_score || 0;
        avgScores.methodology += r.methodology_score || 0;
        avgScores.practicality += r.practicality_score || 0;
        avgScores.overall += r.overall_score || 0;
      });

      Object.keys(avgScores).forEach(key => {
        avgScores[key as keyof typeof avgScores] /= ratings.length;
      });

      const statsRow = doc.createElement('div');
      statsRow.style.cssText = `
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
        padding: 12px;
        background: #f8fafc;
        border-radius: 8px;
      `;

      // Overall score stat
      const overallStat = doc.createElement('div');
      overallStat.style.cssText = 'text-align: center; flex: 1;';
      overallStat.innerHTML = `
        <div style="font-size: 24px; font-weight: 600; color: #f59e0b;">${avgScores.overall.toFixed(1)}</div>
        <div style="font-size: 11px; color: #6b7280;">总评</div>
      `;
      statsRow.appendChild(overallStat);

      // Rating count stat
      const countStat = doc.createElement('div');
      countStat.style.cssText = 'text-align: center; flex: 1;';
      countStat.innerHTML = `
        <div style="font-size: 24px; font-weight: 600; color: #3b82f6;">${ratings.length}</div>
        <div style="font-size: 11px; color: #6b7280;">评价数</div>
      `;
      statsRow.appendChild(countStat);

      section.appendChild(statsRow);

      // Detailed scores (collapsible)
      const detailDiv = doc.createElement('div');
      detailDiv.style.cssText = `
        margin-bottom: 12px;
        padding: 8px;
        background: #f3f4f6;
        border-radius: 4px;
        font-size: 12px;
        color: #374151;
      `;
      detailDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
          <span>💡 创新性: ${avgScores.innovation.toFixed(1)}</span>
          <span>🔬 方法论: ${avgScores.methodology.toFixed(1)}</span>
          <span>⚙️ 实用性: ${avgScores.practicality.toFixed(1)}</span>
          <span>⭐ 总体: ${avgScores.overall.toFixed(1)}</span>
        </div>
      `;
      section.appendChild(detailDiv);
    }

    // Create rating form
    const form = this.createRatingForm(doc, userRating, paperId, userId);
    section.appendChild(form);

    return section;
  }

  /**
   * Old createRatingSection implementation (preserved for reference)
   */
  private createRatingSectionOld(
    doc: Document,
    ratings: any[],
    userRating: any | null,
    paperId: string,
    userId: string
  ): HTMLElement {
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
      { key: 'innovation_score', label: '创新性', icon: '💡', tooltip: '研究思路和方法的新颖程度' },
      { key: 'methodology_score', label: '方法论', icon: '🔬', tooltip: '研究方法的科学性和严谨性' },
      { key: 'practicality_score', label: '实用性', icon: '⚙️', tooltip: '研究成果的实际应用价值' },
      { key: 'overall_score', label: '总体评价', icon: '⭐', tooltip: '对论文的综合评价' }
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
      label.style.cssText = 'min-width: 90px; color: #212529; cursor: help;';
      label.title = cat.tooltip;
      row.appendChild(label);

      // 10分制星星评分（5个星星，支持半星）
      const stars = doc.createElement('div');
      stars.style.cssText = 'display: flex; gap: 0;';
      stars.setAttribute('data-score-key', cat.key);

      // Helper to render star fill state
      const renderStars = (value: number) => {
        Array.from(stars.children).forEach((starContainer, index) => {
          const starIndex = index + 1;
          const leftHalf = starContainer.querySelector('.star-left') as HTMLElement;
          const rightHalf = starContainer.querySelector('.star-right') as HTMLElement;
          
          // Each star represents 2 points (e.g., star 1 = points 1-2)
          const leftPoint = starIndex * 2 - 1; // 1, 3, 5, 7, 9
          const rightPoint = starIndex * 2;    // 2, 4, 6, 8, 10
          
          if (leftHalf) {
            leftHalf.style.color = value >= leftPoint ? '#ffc107' : 'transparent';
          }
          if (rightHalf) {
            rightHalf.style.color = value >= rightPoint ? '#ffc107' : 'transparent';
          }
        });
      };

      // Track current score for hover reset
      let currentScore = scores[cat.key];

      for (let i = 1; i <= 5; i++) {
        const starContainer = doc.createElement('span');
        starContainer.style.cssText = `
          position: relative;
          display: inline-block;
          width: 20px;
          height: 20px;
          cursor: pointer;
          font-size: 18px;
          transition: transform 0.1s;
        `;

        // Background star (gray, full width) - always visible
        const bgStar = doc.createElement('span');
        bgStar.textContent = '★';
        bgStar.style.cssText = `
          position: absolute;
          left: 0;
          top: 0;
          color: #9ca3af;
        `;

        // Right half foreground (colored when score >= rightPoint)
        const rightHalf = doc.createElement('span');
        rightHalf.className = 'star-right';
        const rightPoint = i * 2;
        rightHalf.textContent = '★';
        rightHalf.style.cssText = `
          position: absolute;
          left: 0;
          top: 0;
          color: ${scores[cat.key] >= rightPoint ? '#ffc107' : 'transparent'};
          transition: color 0.1s;
        `;
        rightHalf.setAttribute('data-point', rightPoint.toString());

        // Left half foreground (colored when score >= leftPoint)
        const leftHalf = doc.createElement('span');
        leftHalf.className = 'star-left';
        const leftPoint = i * 2 - 1;
        leftHalf.textContent = '★';
        leftHalf.style.cssText = `
          position: absolute;
          left: 0;
          top: 0;
          width: 50%;
          overflow: hidden;
          color: ${scores[cat.key] >= leftPoint ? '#ffc107' : 'transparent'};
          transition: color 0.1s;
        `;
        leftHalf.setAttribute('data-point', leftPoint.toString());

        starContainer.appendChild(bgStar);
        starContainer.appendChild(rightHalf);
        starContainer.appendChild(leftHalf);

        // Hover effect with fill preview
        starContainer.addEventListener('mouseenter', () => {
          starContainer.style.transform = 'scale(1.15)';
          // Preview: fill up to full star on hover
          renderStars(rightPoint);
        });
        starContainer.addEventListener('mouseleave', () => {
          starContainer.style.transform = 'scale(1)';
          // Restore actual score on leave
          renderStars(currentScore);
        });

        // Click handler - detect left/right half
        starContainer.addEventListener('click', (e: MouseEvent) => {
          const rect = starContainer.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const isLeftHalf = clickX < rect.width / 2;
          
          const newScore = isLeftHalf ? leftPoint : rightPoint;
          scores[cat.key] = newScore;
          currentScore = newScore;
          
          renderStars(newScore);
          
          // Update score text
          const scoreText = row.querySelector('.score-text') as HTMLElement;
          if (scoreText) {
            scoreText.textContent = `${newScore}/10`;
          }
        });

        stars.appendChild(starContainer);
      }
      row.appendChild(stars);

      const scoreText = doc.createElement('span');
      scoreText.className = 'score-text';
      scoreText.textContent = scores[cat.key] > 0 ? `${scores[cat.key]}/10` : '未评分';
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
    userId: string,
    paperDoi?: string
  ): HTMLElement {
    const section = doc.createElement('div');
    section.style.cssText = `
      display: block;
      width: 100%;
      padding: 16px;
      box-sizing: border-box;
    `;

    // Section Header - Title row
    const headerRow = doc.createElement('div');
    headerRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    `;

    const title = doc.createElement('h3');
    title.style.cssText = 'margin: 0; font-size: 14px; color: #212529; display: flex; align-items: center;';
    title.textContent = `💬 论文评论`;
    
    // Comment count badge
    const countBadge = doc.createElement('span');
    countBadge.id = 'paper-comment-count';
    countBadge.style.cssText = `
      display: inline-block;
      background: #e5e7eb;
      color: #374151;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
      margin-left: 8px;
    `;
    countBadge.textContent = String(commentTree.length);
    title.appendChild(countBadge);

    // Detail button with blue background (in title row)
    const detailBtn = doc.createElement('button');
    detailBtn.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: #3b82f6;
      border: none;
      border-radius: 4px;
      font-size: 11px;
      color: white;
      cursor: pointer;
      transition: background 0.2s;
    `;
    detailBtn.innerHTML = '<span>详情</span><span>→</span>';
    detailBtn.addEventListener('mouseenter', () => {
      detailBtn.style.background = '#2563eb';
    });
    detailBtn.addEventListener('mouseleave', () => {
      detailBtn.style.background = '#3b82f6';
    });
    detailBtn.addEventListener('click', () => {
      if (paperDoi) {
        Zotero.launchURL(`https://www.researchopia.com/papers/${encodeURIComponent(paperDoi)}`);
      }
    });

    headerRow.appendChild(title);
    headerRow.appendChild(detailBtn);
    section.appendChild(headerRow);

    // Actions row - filter dropdown
    const actionsRow = doc.createElement('div');
    actionsRow.style.cssText = 'display: flex; align-items: center; margin-bottom: 12px;';

    // Comment filter dropdown
    const filterSelect = doc.createElement('select');
    filterSelect.id = 'paper-comment-filter';
    filterSelect.style.cssText = `
      padding: 4px 8px;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      font-size: 11px;
      background: white;
      cursor: pointer;
      color: #374151;
      -webkit-appearance: auto;
      appearance: auto;
    `;
    
    const optionAll = doc.createElement('option');
    optionAll.value = 'all';
    optionAll.textContent = '所有评论';
    
    const optionMine = doc.createElement('option');
    optionMine.value = 'mine';
    optionMine.textContent = '我的评论';
    
    filterSelect.appendChild(optionAll);
    filterSelect.appendChild(optionMine);

    actionsRow.appendChild(filterSelect);
    section.appendChild(actionsRow);

    // Comment list container with max height for collapse
    const commentsList = doc.createElement('div');
    commentsList.id = 'paper-comments-list';
    commentsList.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;';

    // Track expand/collapse state
    let isExpanded = false;
    const MAX_VISIBLE_COMMENTS = 3;

    // Expand/collapse button (will be added/removed dynamically)
    let expandBtn: HTMLButtonElement | null = null;

    // Function to render filtered comments
    const renderFilteredComments = (filter: string) => {
      commentsList.innerHTML = '';
      isExpanded = false;
      
      const filteredTree = filter === 'mine'
        ? commentTree.filter(c => c.user_id === userId)
        : commentTree;

      // Update count badge
      countBadge.textContent = String(filteredTree.length);

      if (filteredTree.length === 0) {
        const emptyMsg = doc.createElement('div');
        emptyMsg.style.cssText = `
          padding: 20px;
          text-align: center;
          color: #9ca3af;
          font-size: 12px;
        `;
        emptyMsg.textContent = filter === 'mine' ? '你还没有发表评论' : '暂无评论，来发表第一条评论吧！';
        commentsList.appendChild(emptyMsg);
        // Remove expand button if exists
        if (expandBtn && expandBtn.parentNode) {
          expandBtn.parentNode.removeChild(expandBtn);
          expandBtn = null;
        }
      } else {
        // Render only first MAX_VISIBLE_COMMENTS or all if expanded
        const visibleComments = filteredTree.slice(0, MAX_VISIBLE_COMMENTS);
        const hiddenComments = filteredTree.slice(MAX_VISIBLE_COMMENTS);
        
        visibleComments.forEach(rootComment => {
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

        // Add expand button if there are more comments
        if (hiddenComments.length > 0) {
          if (!expandBtn) {
            expandBtn = doc.createElement('button');
            expandBtn.style.cssText = `
              padding: 8px 12px;
              background: #f3f4f6;
              border: 1px solid #e5e7eb;
              border-radius: 4px;
              font-size: 12px;
              color: #374151;
              cursor: pointer;
              text-align: center;
              transition: background 0.2s;
              margin-top: 4px;
              width: 100%;
            `;
            expandBtn.addEventListener('mouseenter', () => {
              if (expandBtn) expandBtn.style.background = '#e5e7eb';
            });
            expandBtn.addEventListener('mouseleave', () => {
              if (expandBtn) expandBtn.style.background = '#f3f4f6';
            });
          }
          expandBtn.textContent = `展开更多 (${hiddenComments.length}条)`;
          expandBtn.onclick = () => {
            if (!isExpanded) {
              // Expand: show all comments
              // Remove the expand button first
              if (expandBtn && expandBtn.parentNode) {
                expandBtn.parentNode.removeChild(expandBtn);
              }
              hiddenComments.forEach(rootComment => {
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
              // Re-append expand button at the end
              if (expandBtn) {
                expandBtn.textContent = '收起';
                commentsList.appendChild(expandBtn);
              }
              isExpanded = true;
            } else {
              // Collapse: re-render only visible comments
              renderFilteredComments(filter);
            }
          };
          // Append expand button at the end of commentsList
          commentsList.appendChild(expandBtn);
        } else {
          // Remove expand button if no hidden comments
          if (expandBtn && expandBtn.parentNode) {
            expandBtn.parentNode.removeChild(expandBtn);
            expandBtn = null;
          }
        }
      }
    };

    // Initial render
    renderFilteredComments('all');

    // Filter change handler
    filterSelect.addEventListener('change', () => {
      renderFilteredComments(filterSelect.value);
    });

    section.appendChild(commentsList);

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
      margin-left: ${depth * 12}px;
      ${depth > 0 ? 'border-left: 2px solid #e9ecef; padding-left: 6px;' : ''}
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

