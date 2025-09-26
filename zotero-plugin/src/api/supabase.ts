import { SupabaseClient } from "@supabase/supabase-js";
import { AuthManager } from "../modules/auth";

export interface DatabaseAnnotation {
  id: string;
  doi: string;
  user_id: string;
  user_name: string;
  annotation_text: string;
  annotation_comment: string;
  page_number?: number;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
    pageIndex?: number;
  };
  annotation_type: string;
  annotation_color: string;
  created_at: string;
  updated_at: string;
}

export interface AnnotationLike {
  id: string;
  annotation_id: string;
  user_id: string;
  created_at: string;
}

export interface AnnotationComment {
  id: string;
  annotation_id: string;
  user_id: string;
  user_name: string;
  comment_text: string;
  created_at: string;
}

export interface UserFollow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export class SupabaseAPI {
  private static client: SupabaseClient | null = null;

  static initialize(client: SupabaseClient) {
    this.client = client;
  }

  static getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('SupabaseAPI not initialized');
    }
    return this.client;
  }

  // Annotation operations
  static async createAnnotation(annotation: Omit<DatabaseAnnotation, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseAnnotation | null> {
    if (!this.client) return null;

    try {
      const { data, error } = await this.client
        .from('shared_annotations')
        .insert([annotation])
        .select()
        .single();

      if (error) {
        ztoolkit.log('Error creating annotation:', error);
        return null;
      }

      return data;
    } catch (error) {
      ztoolkit.log('Error creating annotation:', error);
      return null;
    }
  }

  static async getAnnotationsByDOI(doi: string): Promise<DatabaseAnnotation[]> {
    if (!this.client) return [];

    try {
      const { data, error } = await this.client
        .from('shared_annotations')
        .select('*')
        .eq('doi', doi)
        .order('created_at', { ascending: false });

      if (error) {
        ztoolkit.log('Error fetching annotations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      ztoolkit.log('Error fetching annotations:', error);
      return [];
    }
  }

  static async getAnnotationsByUser(userId: string): Promise<DatabaseAnnotation[]> {
    if (!this.client) return [];

    try {
      const { data, error } = await this.client
        .from('shared_annotations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        ztoolkit.log('Error fetching user annotations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      ztoolkit.log('Error fetching user annotations:', error);
      return [];
    }
  }

  static async updateAnnotation(id: string, updates: Partial<DatabaseAnnotation>): Promise<boolean> {
    if (!this.client) return false;

    try {
      const { error } = await this.client
        .from('shared_annotations')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        ztoolkit.log('Error updating annotation:', error);
        return false;
      }

      return true;
    } catch (error) {
      ztoolkit.log('Error updating annotation:', error);
      return false;
    }
  }

  static async deleteAnnotation(id: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const { error } = await this.client
        .from('shared_annotations')
        .delete()
        .eq('id', id);

      if (error) {
        ztoolkit.log('Error deleting annotation:', error);
        return false;
      }

      return true;
    } catch (error) {
      ztoolkit.log('Error deleting annotation:', error);
      return false;
    }
  }

  // Like operations
  static async likeAnnotation(annotationId: string): Promise<boolean> {
    if (!this.client) return false;

    const user = AuthManager.getCurrentUser();
    if (!user) return false;

    try {
      const { error } = await this.client
        .from('annotation_likes')
        .insert([{
          annotation_id: annotationId,
          user_id: user.id,
        }]);

      if (error) {
        ztoolkit.log('Error liking annotation:', error);
        return false;
      }

      return true;
    } catch (error) {
      ztoolkit.log('Error liking annotation:', error);
      return false;
    }
  }

  static async unlikeAnnotation(annotationId: string): Promise<boolean> {
    if (!this.client) return false;

    const user = AuthManager.getCurrentUser();
    if (!user) return false;

    try {
      const { error } = await this.client
        .from('annotation_likes')
        .delete()
        .eq('annotation_id', annotationId)
        .eq('user_id', user.id);

      if (error) {
        ztoolkit.log('Error unliking annotation:', error);
        return false;
      }

      return true;
    } catch (error) {
      ztoolkit.log('Error unliking annotation:', error);
      return false;
    }
  }

  static async getAnnotationLikes(annotationId: string): Promise<AnnotationLike[]> {
    if (!this.client) return [];

    try {
      const { data, error } = await this.client
        .from('annotation_likes')
        .select('*')
        .eq('annotation_id', annotationId);

      if (error) {
        ztoolkit.log('Error fetching likes:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      ztoolkit.log('Error fetching likes:', error);
      return [];
    }
  }

  // Comment operations
  static async addComment(annotationId: string, commentText: string): Promise<AnnotationComment | null> {
    if (!this.client) return null;

    const user = AuthManager.getCurrentUser();
    if (!user) return null;

    try {
      const { data, error } = await this.client
        .from('annotation_comments')
        .insert([{
          annotation_id: annotationId,
          user_id: user.id,
          user_name: user.email || 'Anonymous',
          comment_text: commentText,
        }])
        .select()
        .single();

      if (error) {
        ztoolkit.log('Error adding comment:', error);
        return null;
      }

      return data;
    } catch (error) {
      ztoolkit.log('Error adding comment:', error);
      return null;
    }
  }

  static async getAnnotationComments(annotationId: string): Promise<AnnotationComment[]> {
    if (!this.client) return [];

    try {
      const { data, error } = await this.client
        .from('annotation_comments')
        .select('*')
        .eq('annotation_id', annotationId)
        .order('created_at', { ascending: true });

      if (error) {
        ztoolkit.log('Error fetching comments:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      ztoolkit.log('Error fetching comments:', error);
      return [];
    }
  }

  static async deleteComment(commentId: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const { error } = await this.client
        .from('annotation_comments')
        .delete()
        .eq('id', commentId);

      if (error) {
        ztoolkit.log('Error deleting comment:', error);
        return false;
      }

      return true;
    } catch (error) {
      ztoolkit.log('Error deleting comment:', error);
      return false;
    }
  }

  // Follow operations
  static async followUser(userId: string): Promise<boolean> {
    if (!this.client) return false;

    const currentUser = AuthManager.getCurrentUser();
    if (!currentUser) return false;

    try {
      const { error } = await this.client
        .from('user_follows')
        .insert([{
          follower_id: currentUser.id,
          following_id: userId,
        }]);

      if (error) {
        ztoolkit.log('Error following user:', error);
        return false;
      }

      return true;
    } catch (error) {
      ztoolkit.log('Error following user:', error);
      return false;
    }
  }

  static async unfollowUser(userId: string): Promise<boolean> {
    if (!this.client) return false;

    const currentUser = AuthManager.getCurrentUser();
    if (!currentUser) return false;

    try {
      const { error } = await this.client
        .from('user_follows')
        .delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', userId);

      if (error) {
        ztoolkit.log('Error unfollowing user:', error);
        return false;
      }

      return true;
    } catch (error) {
      ztoolkit.log('Error unfollowing user:', error);
      return false;
    }
  }

  static async isFollowing(userId: string): Promise<boolean> {
    if (!this.client) return false;

    const currentUser = AuthManager.getCurrentUser();
    if (!currentUser) return false;

    try {
      const { data, error } = await this.client
        .from('user_follows')
        .select('id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        ztoolkit.log('Error checking follow status:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      ztoolkit.log('Error checking follow status:', error);
      return false;
    }
  }
}
