import { config } from '../../package.json'
import { envConfig } from '../config/env'
import { AuthManager } from './auth'

import { logger } from "../utils/logger";
/**
 * 关注管理器
 * 处理用户关注相关的操作
 */
export class FollowManager {
  private static get webUrl(): string {
    return envConfig.apiBaseUrl;
  }

  /**
   * 获取访问令牌
   */
  private static getAccessToken(): string | null {
    const session = AuthManager.getSession()
    return session?.access_token || null
  }

  /**
   * 关注用户
   */
  static async followUser(username: string): Promise<boolean> {
    try {
      const token = this.getAccessToken()
      if (!token) {
        throw new Error('未登录')
      }

      const response = await fetch(`${this.webUrl}/api/users/${username}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'follow' })
      })

      if (!response.ok) {
        const error = await response.json() as unknown as { error?: string }
        throw new Error(error.error || '关注失败')
      }

      const data = await response.json() as unknown as { success: boolean }
      return data.success
    } catch (error) {
      logger.error('Follow user error:', error)
      throw error
    }
  }

  /**
   * 取消关注用户
   */
  static async unfollowUser(username: string): Promise<boolean> {
    try {
      const token = this.getAccessToken()
      if (!token) {
        throw new Error('未登录')
      }

      const response = await fetch(`${this.webUrl}/api/users/${username}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'unfollow' })
      })

      if (!response.ok) {
        const error = await response.json() as unknown as { error?: string }
        throw new Error(error.error || '取消关注失败')
      }

      const data = await response.json() as unknown as { success: boolean }
      return data.success
    } catch (error) {
      logger.error('Unfollow user error:', error)
      throw error
    }
  }

  /**
   * 检查是否关注某用户
   */
  static async isFollowing(username: string): Promise<boolean> {
    try {
      const token = this.getAccessToken()
      if (!token) {
        return false
      }

      const response = await fetch(`${this.webUrl}/api/users/${username}/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json() as { isFollowing?: boolean }
      return data.isFollowing || false
    } catch (error) {
      logger.error('Check following status error:', error)
      return false
    }
  }

  /**
   * 获取关注者列表
   */
  static async getFollowers(username: string, page: number = 1, limit: number = 20) {
    try {
      const response = await fetch(
        `${this.webUrl}/api/users/${username}/followers?page=${page}&limit=${limit}`
      )

      if (!response.ok) {
        throw new Error('获取关注者列表失败')
      }

      return await response.json()
    } catch (error) {
      logger.error('Get followers error:', error)
      throw error
    }
  }

  /**
   * 获取关注列表
   */
  static async getFollowing(username: string, page: number = 1, limit: number = 20) {
    try {
      const response = await fetch(
        `${this.webUrl}/api/users/${username}/following?page=${page}&limit=${limit}`
      )

      if (!response.ok) {
        throw new Error('获取关注列表失败')
      }

      return await response.json()
    } catch (error) {
      logger.error('Get following error:', error)
      throw error
    }
  }

  /**
   * 在浏览器中打开用户主页
   */
  static openUserProfile(username: string) {
    const url = `${this.webUrl}/profile/${username}`
    ;(Zotero as any).launchURL(url)
  }

  /**
   * 在浏览器中打开关注者列表
   */
  static openFollowersList(username: string) {
    const url = `${this.webUrl}/profile/${username}/followers`
    ;(Zotero as any).launchURL(url)
  }

  /**
   * 在浏览器中打开关注列表
   */
  static openFollowingList(username: string) {
    const url = `${this.webUrl}/profile/${username}/following`
    ;(Zotero as any).launchURL(url)
  }
}

