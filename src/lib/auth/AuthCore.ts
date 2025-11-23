/**
 * AuthCore - 核心认证类
 * 提供登录、注册、登出等核心认证功能
 */

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SessionManager } from './SessionManager';
import { TokenManager } from './TokenManager';
import type { User, Session, SignInCredentials, SignUpCredentials, AuthError } from './types';

export class AuthCore {
  private client: SupabaseClient;

  constructor() {
    this.client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  /**
   * 登录
   */
  async signIn(credentials: SignInCredentials): Promise<{ session: Session | null; error: AuthError | null }> {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        return {
          session: null,
          error: { code: error.name, message: error.message },
        };
      }

      if (data.session) {
        const session: Session = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + 3600000,
          user: this.mapSupabaseUser(data.session.user),
        };

        SessionManager.saveSession(session);
        return { session, error: null };
      }

      return { session: null, error: { code: 'NO_SESSION', message: 'No session returned' } };
    } catch (error) {
      return {
        session: null,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * 注册
   */
  async signUp(credentials: SignUpCredentials): Promise<{ user: User | null; error: AuthError | null }> {
    try {
      const { data, error } = await this.client.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            display_name: credentials.display_name,
          },
        },
      });

      if (error) {
        return {
          user: null,
          error: { code: error.name, message: error.message },
        };
      }

      if (data.user) {
        return {
          user: this.mapSupabaseUser(data.user),
          error: null,
        };
      }

      return { user: null, error: { code: 'NO_USER', message: 'No user returned' } };
    } catch (error) {
      return {
        user: null,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * 登出
   */
  async signOut(): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await this.client.auth.signOut();

      SessionManager.clearSession();

      if (error) {
        return { error: { code: error.name, message: error.message } };
      }

      return { error: null };
    } catch (error) {
      return {
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * 获取当前用户
   */
  async getCurrentUser(): Promise<{ user: User | null; error: AuthError | null }> {
    try {
      const { data, error } = await this.client.auth.getUser();

      if (error) {
        return {
          user: null,
          error: { code: error.name, message: error.message },
        };
      }

      if (data.user) {
        return {
          user: this.mapSupabaseUser(data.user),
          error: null,
        };
      }

      return { user: null, error: null };
    } catch (error) {
      return {
        user: null,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * 刷新会话
   */
  async refreshSession(): Promise<{ session: Session | null; error: AuthError | null }> {
    try {
      const { data, error } = await this.client.auth.refreshSession();

      if (error) {
        return {
          session: null,
          error: { code: error.name, message: error.message },
        };
      }

      if (data.session) {
        const session: Session = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + 3600000,
          user: this.mapSupabaseUser(data.session.user),
        };

        SessionManager.saveSession(session);
        return { session, error: null };
      }

      return { session: null, error: { code: 'NO_SESSION', message: 'No session returned' } };
    } catch (error) {
      return {
        session: null,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * 映射Supabase用户到内部User类型
   */
  private mapSupabaseUser(supabaseUser: any): User {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      display_name: supabaseUser.user_metadata?.display_name,
      avatar_url: supabaseUser.user_metadata?.avatar_url,
      created_at: supabaseUser.created_at,
    };
  }

  /**
   * 检查当前会话是否有效
   */
  isSessionValid(): boolean {
    return SessionManager.isSessionValid();
  }

  /**
   * 获取访问令牌
   */
  getAccessToken(): string | null {
    return SessionManager.getAccessToken();
  }
}

// 导出单例实例
export const authCore = new AuthCore();
