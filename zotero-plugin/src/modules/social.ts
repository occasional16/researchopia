import { SupabaseAPI } from "../api/supabase";
import { AuthManager } from "./auth";

export interface UserProfile {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
  stats: {
    annotations_count: number;
    likes_received: number;
    comments_received: number;
    followers_count: number;
    following_count: number;
  };
}

export interface NotificationData {
  id: string;
  user_id: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
}

export class SocialManager {
  static initialize() {
    ztoolkit.log("SocialManager initialized");
  }

  // User Profile Management
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      // Get basic user info from auth.users
      const { data: userData, error: userError } = await SupabaseAPI.getClient()
        .from('auth.users')
        .select('id, email, created_at')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        ztoolkit.log("Error fetching user data:", userError);
        return null;
      }

      // Get user statistics
      const stats = await this.getUserStats(userId);

      return {
        id: userData.id,
        email: userData.email,
        created_at: userData.created_at,
        stats: stats || {
          annotations_count: 0,
          likes_received: 0,
          comments_received: 0,
          followers_count: 0,
          following_count: 0,
        }
      };
    } catch (error) {
      ztoolkit.log("Error getting user profile:", error);
      return null;
    }
  }

  static async getUserStats(userId: string) {
    try {
      const client = SupabaseAPI.getClient();
      
      // Get annotations count
      const { count: annotationsCount } = await client
        .from('shared_annotations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Get likes received
      const { count: likesReceived } = await client
        .from('annotation_likes')
        .select('shared_annotations!inner(*)', { count: 'exact', head: true })
        .eq('shared_annotations.user_id', userId);

      // Get comments received (excluding own comments)
      const { count: commentsReceived } = await client
        .from('annotation_comments')
        .select('shared_annotations!inner(*)', { count: 'exact', head: true })
        .eq('shared_annotations.user_id', userId)
        .neq('user_id', userId);

      // Get followers count
      const { count: followersCount } = await client
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);

      // Get following count
      const { count: followingCount } = await client
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);

      return {
        annotations_count: annotationsCount || 0,
        likes_received: likesReceived || 0,
        comments_received: commentsReceived || 0,
        followers_count: followersCount || 0,
        following_count: followingCount || 0,
      };
    } catch (error) {
      ztoolkit.log("Error getting user stats:", error);
      return null;
    }
  }

  // Social Actions
  static async likeAnnotation(annotationId: string): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) return false;
    return await SupabaseAPI.likeAnnotation(annotationId);
  }

  static async unlikeAnnotation(annotationId: string): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) return false;
    return await SupabaseAPI.unlikeAnnotation(annotationId);
  }

  static async addComment(annotationId: string, commentText: string): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) return false;
    const result = await SupabaseAPI.addComment(annotationId, commentText);
    return result !== null;
  }

  static async followUser(userId: string): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) return false;
    return await SupabaseAPI.followUser(userId);
  }

  static async unfollowUser(userId: string): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) return false;
    return await SupabaseAPI.unfollowUser(userId);
  }

  static async isFollowing(userId: string): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) return false;
    return await SupabaseAPI.isFollowing(userId);
  }

  // Get user's social connections
  static async getFollowing(userId?: string): Promise<UserProfile[]> {
    const targetUserId = userId || AuthManager.getCurrentUser()?.id;
    if (!targetUserId) return [];

    try {
      const { data, error } = await SupabaseAPI.getClient()
        .from('user_follows')
        .select(`
          following_id,
          created_at
        `)
        .eq('follower_id', targetUserId);

      if (error || !data) return [];

      // Get profiles for followed users
      const profiles: UserProfile[] = [];
      for (const follow of data) {
        const profile = await this.getUserProfile(follow.following_id);
        if (profile) {
          profiles.push(profile);
        }
      }

      return profiles;
    } catch (error) {
      ztoolkit.log("Error getting following list:", error);
      return [];
    }
  }

  static async getFollowers(userId?: string): Promise<UserProfile[]> {
    const targetUserId = userId || AuthManager.getCurrentUser()?.id;
    if (!targetUserId) return [];

    try {
      const { data, error } = await SupabaseAPI.getClient()
        .from('user_follows')
        .select(`
          follower_id,
          created_at
        `)
        .eq('following_id', targetUserId);

      if (error || !data) return [];

      // Get profiles for followers
      const profiles: UserProfile[] = [];
      for (const follow of data) {
        const profile = await this.getUserProfile(follow.follower_id);
        if (profile) {
          profiles.push(profile);
        }
      }

      return profiles;
    } catch (error) {
      ztoolkit.log("Error getting followers list:", error);
      return [];
    }
  }

  // Trending and Discovery
  static async getTrendingAnnotations(days: number = 7, limit: number = 20) {
    try {
      const { data, error } = await SupabaseAPI.getClient()
        .rpc('get_trending_annotations', { days_back: days })
        .limit(limit);

      if (error) {
        ztoolkit.log("Error getting trending annotations:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      ztoolkit.log("Error getting trending annotations:", error);
      return [];
    }
  }

  static async getRecommendedUsers(limit: number = 10): Promise<UserProfile[]> {
    try {
      // Get users with most annotations and followers
      const { data, error } = await SupabaseAPI.getClient()
        .from('shared_annotations')
        .select(`
          user_id,
          user_name,
          created_at
        `)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(limit * 2);

      if (error || !data) return [];

      // Count annotations per user
      const userCounts = new Map<string, number>();
      data.forEach(annotation => {
        const count = userCounts.get(annotation.user_id) || 0;
        userCounts.set(annotation.user_id, count + 1);
      });

      // Sort by annotation count and get top users
      const sortedUsers = Array.from(userCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      // Get profiles for recommended users
      const profiles: UserProfile[] = [];
      for (const [userId] of sortedUsers) {
        const profile = await this.getUserProfile(userId);
        if (profile) {
          profiles.push(profile);
        }
      }

      return profiles;
    } catch (error) {
      ztoolkit.log("Error getting recommended users:", error);
      return [];
    }
  }

  // Activity Feed
  static async getActivityFeed(limit: number = 50) {
    if (!AuthManager.isLoggedIn()) return [];

    try {
      const currentUser = AuthManager.getCurrentUser();
      if (!currentUser) return [];

      // Get following list
      const following = await this.getFollowing();
      const followingIds = following.map(user => user.id);
      followingIds.push(currentUser.id); // Include own activities

      // Get recent annotations from followed users
      const { data: annotations, error: annotationsError } = await SupabaseAPI.getClient()
        .from('shared_annotations')
        .select(`
          *,
          likes:annotation_likes(count),
          comments:annotation_comments(count)
        `)
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (annotationsError) {
        ztoolkit.log("Error getting activity feed:", annotationsError);
        return [];
      }

      return annotations || [];
    } catch (error) {
      ztoolkit.log("Error getting activity feed:", error);
      return [];
    }
  }

  // Search and Discovery
  static async searchUsers(query: string, limit: number = 20): Promise<UserProfile[]> {
    try {
      // Search by email or display name
      const { data, error } = await SupabaseAPI.getClient()
        .from('shared_annotations')
        .select('user_id, user_name')
        .ilike('user_name', `%${query}%`)
        .limit(limit * 2);

      if (error || !data) return [];

      // Get unique users
      const uniqueUsers = new Map<string, string>();
      data.forEach(annotation => {
        uniqueUsers.set(annotation.user_id, annotation.user_name);
      });

      // Get profiles
      const profiles: UserProfile[] = [];
      for (const [userId] of uniqueUsers) {
        const profile = await this.getUserProfile(userId);
        if (profile) {
          profiles.push(profile);
        }
      }

      return profiles.slice(0, limit);
    } catch (error) {
      ztoolkit.log("Error searching users:", error);
      return [];
    }
  }

  // Utility methods
  static formatUserDisplayName(user: UserProfile): string {
    return user.display_name || user.email.split('@')[0] || 'Anonymous';
  }

  static getUserAvatarUrl(user: UserProfile): string {
    return user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.formatUserDisplayName(user))}&background=007acc&color=fff`;
  }
}
