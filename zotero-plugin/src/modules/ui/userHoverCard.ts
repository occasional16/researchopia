import { logger } from "../../utils/logger";
import { AuthManager } from "../auth";
import { envConfig } from "../../config/env";
import type { BaseViewContext } from "./types";

/**
 * 获取网站基础URL
 */
function getWebsiteBaseUrl(): string {
  // 直接使用环境配置中的apiBaseUrl
  return envConfig.apiBaseUrl;
}

/**
 * 用户预览数据接口
 */
interface UserPreviewData {
  username: string;
  real_name?: string;
  avatar_url?: string;
  institution?: string;
  position?: string;
  bio?: string;
  location?: string;
  website?: string;
  email?: string;
  orcid?: string;
  google_scholar_id?: string;
  researchgate_id?: string;
  research_fields?: string[];
  stats: {
    followers_count: number;
    following_count: number;
    papers_count: number;
  };
  isFollowing: boolean;
}

/**
 * 用户悬浮卡片管理�?
 * 负责显示用户预览信息和关注功�?
 */
export class UserHoverCardManager {
  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentCard: HTMLElement | null = null;
  private currentAnchor: HTMLElement | null = null;
  private readonly hoverDelay = 500; // 500ms延迟显示
  private readonly hideDelay = 200; // 200ms延迟隐藏
  
  constructor(private readonly context: BaseViewContext) {}

  /**
   * 创建可hover的用户元�?
   * @param doc Document对象
   * @param username 用户�?
   * @param displayName 显示名称
   * @param options 配置选项
   * @returns 包装后的用户元素
   */
  public createUserElement(
    doc: Document,
    username: string,
    displayName: string,
    options: {
      isAnonymous?: boolean;
      showAvatar?: boolean;
      avatarUrl?: string;
      clickable?: boolean;
      className?: string;
    } = {}
  ): HTMLElement {
    const {
      isAnonymous = false,
      showAvatar = true, // 默认显示头像
      avatarUrl,
      clickable = true,
      className = ''
    } = options;

    const container = doc.createElement('span');
    container.className = `user-display ${className}`;
    container.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      ${clickable && !isAnonymous ? 'cursor: pointer;' : ''}
    `;

    // 匿名用户特殊处理
    if (isAnonymous) {
      container.innerHTML = `
        <span style="color: var(--fill-secondary); font-size: 11px;">
          🔒 匿名用户
        </span>
      `;
      return container;
    }

    // 头像(如果需�?
    if (showAvatar) {
      const avatar = doc.createElement('div');
      avatar.className = 'user-avatar';
      avatar.style.cssText = `
        width: 18px;
        height: 18px;
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      if (avatarUrl) {
        const img = doc.createElement('img');
        img.src = avatarUrl;
        img.alt = displayName;
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        avatar.appendChild(img);
      } else {
        // 使用emoji代替SVG避免解析问题
        const iconSpan = doc.createElement('span');
        iconSpan.textContent = 'U';
        iconSpan.style.cssText = 'font-size: 10px;';
        avatar.appendChild(iconSpan);
      }
      
      container.appendChild(avatar);
    }

    // 用户�?
    const nameSpan = doc.createElement('strong');
    nameSpan.textContent = displayName;
    nameSpan.style.cssText = `
      color: ${clickable ? 'var(--accent-blue)' : 'var(--fill-primary)'};
      font-weight: 500;
      ${clickable ? 'text-decoration: underline; text-decoration-color: transparent; transition: text-decoration-color 0.2s;' : ''}
    `;
    container.appendChild(nameSpan);

    // 如果可点�?添加hover和click事件
    if (clickable && !isAnonymous) {
      logger.log(`[UserHoverCard] Setting up hover for username: ${username}`);
      
      // Hover显示卡片
      container.addEventListener('mouseenter', () => {
        logger.log(`[UserHoverCard] Mouse enter on ${username}`);
        
        // 取消隐藏计时�?
        if (this.hideTimeout) {
          clearTimeout(this.hideTimeout);
          this.hideTimeout = null;
        }
        
        // 如果已经有卡片显�?不需要重新创�?
        if (this.currentCard && this.currentAnchor === container) {
          return;
        }
        
        // 清除之前的hover timeout
        if (this.hoverTimeout) {
          clearTimeout(this.hoverTimeout);
        }
        
        this.hoverTimeout = setTimeout(() => {
          logger.log(`[UserHoverCard] Showing hover card for ${username}`);
          this.currentAnchor = container;
          this.showHoverCard(container, username);
        }, this.hoverDelay) as any;
        
        nameSpan.style.textDecorationColor = 'currentColor';
      });

      container.addEventListener('mouseleave', () => {
        logger.log(`[UserHoverCard] Mouse leave from ${username}`);
        
        // 清除hover timeout
        if (this.hoverTimeout) {
          clearTimeout(this.hoverTimeout);
          this.hoverTimeout = null;
        }
        
        // 延迟隐藏卡片,给用户时间移动到卡片�?
        if (this.currentCard) {
          this.hideTimeout = setTimeout(() => {
            this.hideHoverCard();
          }, this.hideDelay) as any;
        }
        
        nameSpan.style.textDecorationColor = 'transparent';
      });

      // Click跳转到profile页面
      container.addEventListener('click', (e) => {
        e.stopPropagation();
        logger.log(`[UserHoverCard] Click on ${username}, opening profile`);
        this.openUserProfile(username);
      });
    }

    return container;
  }

  /**
   * 显示悬浮卡片
   */
  private async showHoverCard(
    anchorElement: HTMLElement,
    username: string
  ): Promise<void> {
    try {
      logger.log(`[UserHoverCard] showHoverCard called for ${username}`);
      
      // 移除已存在的卡片
      this.hideHoverCard();

      const doc = anchorElement.ownerDocument;
      
      // 检查文档环�?
      if (!doc || !doc.documentElement) {
        logger.error('[UserHoverCard] Invalid document environment');
        return;
      }
      
      logger.log(`[UserHoverCard] Creating card element`);
      
      // 创建卡片容器
      const card = doc.createElement('div');
      card.className = 'user-hover-card';
      card.style.cssText = `
        position: absolute;
        z-index: 10000;
        width: 240px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 6px 24px rgba(0,0,0,0.12);
        border: 1px solid #e5e7eb;
        padding: 12px;
        margin-top: 4px;
        opacity: 0;
        transform: translateY(-8px);
        transition: opacity 0.2s ease-out, transform 0.2s ease-out;
        font-size: 12px;
      `;

      logger.log(`[UserHoverCard] Calculating position`);
      
      // 计算位置
      const rect = anchorElement.getBoundingClientRect();
      const scrollTop = (doc.documentElement && doc.documentElement.scrollTop) || 
                       (doc.body && doc.body.scrollTop) || 0;
      const scrollLeft = (doc.documentElement && doc.documentElement.scrollLeft) || 
                        (doc.body && doc.body.scrollLeft) || 0;
      
      card.style.top = `${rect.bottom + scrollTop}px`;
      card.style.left = `${rect.left + scrollLeft}px`;

      logger.log(`[UserHoverCard] Position: top=${card.style.top}, left=${card.style.left}`);

      // 显示加载状�?
      const loadingDiv = doc.createElement('div');
      loadingDiv.style.cssText = 'display: flex; align-items: center; justify-content: center; padding: 40px 0;';
      
      const loadingSpinner = doc.createElement('div');
      loadingSpinner.className = 'loading-spinner';
      loadingSpinner.style.cssText = 'width: 24px; height: 24px; border: 3px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%;';
      
      loadingDiv.appendChild(loadingSpinner);
      card.appendChild(loadingDiv);

      logger.log(`[UserHoverCard] Appending card to document`);
      
      // 尝试找到合适的父元�?
      const parentElement = doc.body || doc.documentElement;
      if (!parentElement) {
        logger.error('[UserHoverCard] No suitable parent element found');
        return;
      }
      
      parentElement.appendChild(card);
      this.currentCard = card;
      
      // 应用动画样式(延迟执行以触发transition)
      setTimeout(() => {
        if (card.parentNode) {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }
      }, 10);
      
      // 启动加载动画
      const spinner = card.querySelector('.loading-spinner') as HTMLElement;
      if (spinner) {
        let rotation = 0;
        const spinInterval = setInterval(() => {
          if (!card.parentNode) {
            clearInterval(spinInterval);
            return;
          }
          rotation += 45;
          spinner.style.transform = `rotate(${rotation}deg)`;
        }, 50);
      }

      // 卡片hover保持显示
      card.addEventListener('mouseenter', () => {
        logger.log(`[UserHoverCard] Mouse enter on card`);
        // 取消隐藏计时�?
        if (this.hideTimeout) {
          clearTimeout(this.hideTimeout);
          this.hideTimeout = null;
        }
      });

      card.addEventListener('mouseleave', () => {
        logger.log(`[UserHoverCard] Mouse leave from card`);
        // 延迟隐藏卡片
        this.hideTimeout = setTimeout(() => {
          this.hideHoverCard();
        }, this.hideDelay) as any;
      });

      // 加载用户数据
      logger.log(`[UserHoverCard] Loading user data for ${username}`);
      const userData = await this.loadUserPreview(username);
      
      logger.log(`[UserHoverCard] User data loaded:`, userData);
      
      if (this.currentCard === card) {
        this.renderHoverCardContent(card, userData);
      }

    } catch (error) {
      logger.error('[UserHoverCard] Error showing hover card:', error);
      logger.error('[UserHoverCard] Error details:', error instanceof Error ? error.message : String(error));
      logger.error('[UserHoverCard] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      this.hideHoverCard();
    }
  }

  /**
   * 隐藏悬浮卡片
   */
  private hideHoverCard(): void {
    logger.log(`[UserHoverCard] Hiding hover card`);
    
    if (this.currentCard) {
      this.currentCard.remove();
      this.currentCard = null;
    }
    
    this.currentAnchor = null;
    
    // 清理所有计时器
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  /**
   * 加载用户预览数据
   */
  private async loadUserPreview(username: string): Promise<UserPreviewData> {
    const session = AuthManager.getSession();
    const webUrl = getWebsiteBaseUrl();
    
    const response = await fetch(`${webUrl}/api/users/${username}/profile`, {
      headers: session?.access_token 
        ? { 'Authorization': `Bearer ${session.access_token}` }
        : {}
    });

    if (!response.ok) {
      throw new Error('Failed to load user profile');
    }

    const data = await response.json();
    return data.profile || data;
  }

  /**
   * 渲染卡片内容
   */
  private renderHoverCardContent(
    card: HTMLElement,
    userData: UserPreviewData
  ): void {
    const session = AuthManager.getSession();
    const currentUser = AuthManager.getCurrentUser();
    const isOwnProfile = currentUser?.username === userData.username;

    card.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
        
        <div style="display: flex; align-items: start; gap: 8px;">
          <div style="
            width: 44px;
            height: 44px;
            border-radius: 50%;
            overflow: hidden;
            flex-shrink: 0;
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ${userData.avatar_url 
              ? `<img src="${userData.avatar_url}" alt="${userData.username}" style="width: 100%; height: 100%; object-fit: cover;" />`
              : `<span style="font-size: 20px; color: white;">U</span>`
            }
          </div>
          
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 13px; color: #111827; margin-bottom: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${userData.real_name || userData.username}
            </div>
            <div style="font-size: 11px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              @${userData.username}
            </div>
          </div>
        </div>

        
        ${userData.position || userData.institution ? `
          <div style="display: flex; align-items: center; gap: 4px; color: #374151; font-size: 11px;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${userData.position ? `<strong>${userData.position}</strong>` : ''}
              ${userData.position && userData.institution ? ' @ ' : ''}
              ${userData.institution || ''}
            </span>
          </div>
        ` : ''}

        
        ${userData.bio ? `
          <div style="font-size: 11px; color: #4b5563; line-height: 1.3; max-height: 42px; overflow: hidden;">
            ${userData.bio}
          </div>
        ` : ''}

        
        ${userData.research_fields && userData.research_fields.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 3px;">
            ${userData.research_fields.slice(0, 2).map(field => `
              <span style="
                background: #eff6ff;
                color: #1e40af;
                padding: 1px 6px;
                border-radius: 8px;
                font-size: 10px;
                font-weight: 500;
              ">${field}</span>
            `).join('')}
            ${userData.research_fields.length > 2 ? `
              <span style="color: #9ca3af; font-size: 10px;">+${userData.research_fields.length - 2}</span>
            ` : ''}
          </div>
        ` : ''}

        
        <div style="display: flex; gap: 12px; padding-top: 8px; border-top: 1px solid #f3f4f6; font-size: 11px;">
          <div style="display: flex; align-items: center; gap: 2px;">
            <span style="font-weight: 600; color: #111827;">${userData.stats.followers_count}</span>
            <span style="color: #6b7280;">关注者</span>
          </div>
          <div style="display: flex; align-items: center; gap: 2px;">
            <span style="font-weight: 600; color: #111827;">${userData.stats.following_count}</span>
            <span style="color: #6b7280;">关注中</span>
          </div>
          <div style="display: flex; align-items: center; gap: 2px;">
            <span style="font-weight: 600; color: #111827;">${userData.stats.papers_count}</span>
            <span style="color: #6b7280;">论文</span>
          </div>
        </div>

        
        <div style="display: flex; gap: 6px; padding-top: 4px;">
          ${!isOwnProfile && session ? `
            <button id="btn-follow-user" style="
              flex: 1;
              padding: 6px 12px;
              background: ${userData.isFollowing ? '#f3f4f6' : '#3b82f6'};
              color: ${userData.isFollowing ? '#374151' : 'white'};
              border: none;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s;
            ">
              ${userData.isFollowing ? '已关注' : '+ 关注'}
            </button>
          ` : ''}
          <button id="btn-view-profile" style="
            flex: 1;
            padding: 6px 12px;
            background: white;
            color: #374151;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          ">
            查看主页
          </button>
        </div>
      </div>
    `;
    // 绑定事件
    this.bindCardEvents(card, userData);
  }

  /**
   * 绑定卡片事件
   */
  private bindCardEvents(card: HTMLElement, userData: UserPreviewData): void {
    // 关注按钮
    const followBtn = card.querySelector('#btn-follow-user') as HTMLButtonElement;
    if (followBtn) {
      followBtn.addEventListener('click', async () => {
        await this.handleFollow(userData, followBtn);
      });
      
      followBtn.addEventListener('mouseenter', () => {
        if (userData.isFollowing) {
          followBtn.style.background = '#fee2e2';
          followBtn.style.color = '#dc2626';
          followBtn.textContent = '取消关注';
        } else {
          followBtn.style.background = '#2563eb';
        }
      });
      
      followBtn.addEventListener('mouseleave', () => {
        if (userData.isFollowing) {
          followBtn.style.background = '#f3f4f6';
          followBtn.style.color = '#374151';
          followBtn.textContent = '已关注';
        } else {
          followBtn.style.background = '#3b82f6';
        }
      });
    }

    // 查看主页按钮
    const viewBtn = card.querySelector('#btn-view-profile') as HTMLButtonElement;
    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        this.openUserProfile(userData.username);
      });
      
      viewBtn.addEventListener('mouseenter', () => {
        viewBtn.style.background = '#e5e7eb';
      });
      
      viewBtn.addEventListener('mouseleave', () => {
        viewBtn.style.background = '#f3f4f6';
      });
    }
  }

  /**
   * 处理关注/取消关注
   */
  private async handleFollow(
    userData: UserPreviewData,
    button: HTMLButtonElement
  ): Promise<void> {
    try {
      const session = AuthManager.getSession();
      if (!session?.access_token) {
        this.context.showMessage('请先登录', 'error');
        return;
      }

      const action = userData.isFollowing ? 'unfollow' : 'follow';
      button.disabled = true;
      button.textContent = '处理�?..';

      const webUrl = getWebsiteBaseUrl();
      const response = await fetch(`${webUrl}/api/users/${userData.username}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        throw new Error('操作失败');
      }

      const data = await response.json();
      userData.isFollowing = data.isFollowing;
      userData.stats.followers_count = data.followersCount;

      // 更新按钮
      button.disabled = false;
      button.textContent = data.isFollowing ? '已关注' : '关注';
      button.style.background = data.isFollowing ? '#f3f4f6' : '#3b82f6';
      button.style.color = data.isFollowing ? '#374151' : 'white';

      this.context.showMessage(data.isFollowing ? '已关注' : '已取消关注', 'info');

    } catch (error) {
      logger.error('[UserHoverCard] Error following/unfollowing:', error);
      this.context.showMessage('操作失败', 'error');
      button.disabled = false;
      button.textContent = userData.isFollowing ? '已关注' : '关注';
    }
  }

  /**
   * 打开用户主页
   */
  private openUserProfile(username: string): void {
    const webUrl = getWebsiteBaseUrl();
    const profileUrl = `${webUrl}/profile/${username}`;
    
    // 使用Zotero的launchURL在默认浏览器中打开
    (Zotero as any).launchURL(profileUrl);
    
    this.hideHoverCard();
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    this.hideHoverCard();
  }
}
