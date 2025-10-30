/**
 * 个人主页预览视图
 * 在Zotero插件中显示用户的个人主页信息
 */

import { logger } from "../../utils/logger";
import { envConfig } from "../../config/env";
import { AuthManager } from "../auth";
import type { BaseViewContext } from "./types";

export interface UserProfile {
  id: string
  username: string
  real_name?: string
  avatar_url?: string
  institution?: string
  department?: string
  position?: string
  research_fields?: string[]
  bio?: string
  website?: string
  location?: string
  orcid?: string
  google_scholar_id?: string
  stats: {
    followers_count: number
    following_count: number
    papers_count: number
    annotations_count: number
    comments_count: number
    ratings_count: number
  }
  isFollowing?: boolean
}

export class ProfilePreviewView {
  private context: BaseViewContext

  constructor(context: BaseViewContext) {
    this.context = context
  }
  
  private get webUrl(): string {
    return envConfig.apiBaseUrl;
  }

  /**
   * 获取用户资料
   */
  async fetchProfile(username: string): Promise<UserProfile | null> {
    try {
      const session = AuthManager.getSession()
      if (!session?.access_token) {
        throw new Error('未登录')
      }

      const response = await fetch(`${this.webUrl}/api/users/${username}/profile`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('获取用户资料失败')
      }

      const data = await response.json()
      return data
    } catch (error) {
      logger.error('Fetch profile error:', error)
      return null
    }
  }

  /**
   * 渲染个人主页预览
   */
  render(container: HTMLElement, profile: UserProfile): void {
    container.innerHTML = `
      <div style="padding: 16px; background: white;">
        <!-- 用户头像和基本信息 -->
        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
          <div style="flex-shrink: 0;">
            ${profile.avatar_url 
              ? `<img src="${profile.avatar_url}" alt="${profile.username}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">`
              : `<div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center;">
                   <span style="color: white; font-size: 32px; font-weight: bold;">${profile.username.charAt(0).toUpperCase()}</span>
                 </div>`
            }
          </div>
          <div style="flex: 1; min-width: 0;">
            <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #1f2937;">
              ${profile.real_name || profile.username}
            </h3>
            <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">
              @${profile.username}
            </div>
            ${profile.position || profile.institution ? `
              <div style="color: #6b7280; font-size: 13px;">
                ${profile.position ? profile.position : ''}
                ${profile.position && profile.institution ? ' · ' : ''}
                ${profile.institution ? profile.institution : ''}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- 个人简介 -->
        ${profile.bio ? `
          <div style="margin-bottom: 16px; padding: 12px; background: #f9fafb; border-radius: 8px; font-size: 13px; color: #374151; line-height: 1.5;">
            ${profile.bio}
          </div>
        ` : ''}

        <!-- 研究领域 -->
        ${profile.research_fields && profile.research_fields.length > 0 ? `
          <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">研究领域</div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${profile.research_fields.map(field => `
                <span style="padding: 4px 10px; background: #ede9fe; color: #7c3aed; border-radius: 12px; font-size: 12px;">
                  ${field}
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 统计数据 -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
          <div style="text-align: center; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <div style="font-size: 20px; font-weight: 600; color: #1f2937;">${this.formatNumber(profile.stats.followers_count)}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">关注者</div>
          </div>
          <div style="text-align: center; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <div style="font-size: 20px; font-weight: 600; color: #1f2937;">${this.formatNumber(profile.stats.papers_count)}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">论文</div>
          </div>
          <div style="text-align: center; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <div style="font-size: 20px; font-weight: 600; color: #1f2937;">${this.formatNumber(profile.stats.annotations_count)}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">标注</div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div style="display: flex; gap: 8px;">
          <button id="btn-follow-user" style="flex: 1; padding: 10px; background: ${profile.isFollowing ? '#f3f4f6' : '#3b82f6'}; color: ${profile.isFollowing ? '#374151' : 'white'}; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s;">
            ${profile.isFollowing ? '已关注' : '关注'}
          </button>
          <button id="btn-view-full-profile" style="flex: 1; padding: 10px; background: #f3f4f6; color: #374151; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s;">
            查看完整主页
          </button>
        </div>

        <!-- 学术标识 -->
        ${profile.orcid || profile.google_scholar_id ? `
          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; font-weight: 500;">学术标识</div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${profile.orcid ? `
                <a href="https://orcid.org/${profile.orcid}" target="_blank" style="font-size: 12px; color: #3b82f6; text-decoration: none; display: flex; align-items: center; gap: 4px;">
                  <span>🆔</span>
                  <span>ORCID: ${profile.orcid}</span>
                </a>
              ` : ''}
              ${profile.google_scholar_id ? `
                <a href="https://scholar.google.com/citations?user=${profile.google_scholar_id}" target="_blank" style="font-size: 12px; color: #3b82f6; text-decoration: none; display: flex; align-items: center; gap: 4px;">
                  <span>🎓</span>
                  <span>Google Scholar</span>
                </a>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    `

    // 绑定事件
    this.bindEvents(container, profile)
  }

  /**
   * 绑定事件
   */
  private bindEvents(container: HTMLElement, profile: UserProfile): void {
    // 关注按钮
    const followBtn = container.querySelector('#btn-follow-user') as HTMLButtonElement
    if (followBtn) {
      followBtn.addEventListener('click', async () => {
        await this.handleFollow(profile, followBtn)
      })
    }

    // 查看完整主页按钮
    const viewBtn = container.querySelector('#btn-view-full-profile') as HTMLButtonElement
    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        (Zotero as any).launchURL(`${this.webUrl}/profile/${profile.username}`)
      })
    }
  }

  /**
   * 处理关注/取消关注
   */
  private async handleFollow(profile: UserProfile, button: HTMLButtonElement): Promise<void> {
    try {
      const session = AuthManager.getSession()
      if (!session?.access_token) {
        this.context.showMessage('请先登录', 'error')
        return
      }

      const action = profile.isFollowing ? 'unfollow' : 'follow'
      button.disabled = true
      button.textContent = '处理中...'

      const response = await fetch(`${this.webUrl}/api/users/${profile.username}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        throw new Error('操作失败')
      }

      const data = await response.json()
      profile.isFollowing = data.isFollowing
      profile.stats.followers_count = data.followersCount

      // 更新按钮状态
      button.disabled = false
      button.textContent = data.isFollowing ? '已关注' : '关注'
      button.style.background = data.isFollowing ? '#f3f4f6' : '#3b82f6'
      button.style.color = data.isFollowing ? '#374151' : 'white'

      this.context.showMessage(data.isFollowing ? '关注成功' : '取消关注成功', 'info')
    } catch (error) {
      logger.error('Follow error:', error)
      button.disabled = false
      button.textContent = profile.isFollowing ? '已关注' : '关注'
      this.context.showMessage('操作失败', 'error')
    }
  }

  /**
   * 格式化数字
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }
}

