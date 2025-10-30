import { logger } from "../utils/logger";
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";

export interface SupabaseAnnotation {
  id: string;
  document_id: string;
  user_id: string;
  type: string;
  content: string | null;
  comment: string | null;
  color: string;
  position: any;
  tags: string[];
  visibility: 'private' | 'shared' | 'public';
  show_author_name: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  platform: string;
  original_id: string | null;
}

export interface DocumentInfo {
  id: string;
  doi?: string;
  title: string;
  authors: string[];
  abstract?: string;
}

/**
 * Supabase数据库集成管理器
 */
export class SupabaseManager {
  private baseUrl: string;
  private apiKey: string;
  
  constructor() {
    // 从环境变量获取配置，在插件环境中可能需要硬编码或通过其他方式配置
    this.baseUrl = 'https://obcblvdtqhwrihoddlez.supabase.co';
    this.apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4';
  }

  /**
   * 发起API请求
   */
  private async apiRequest(endpoint: string, options: any = {}, retryCount = 0): Promise<any> {
    try {
      const url = `${this.baseUrl}/rest/v1/${endpoint}`;
      
      // 尝试从AuthManager获取用户token
      let authToken = this.apiKey; // 默认使用匿名key
      const method = options.method || 'GET';
      
      // 所有请求都尝试使用用户token(包括GET请求)
      try {
        const { AuthManager } = await import('./auth');
        
        // 检查登录状态
        const isLoggedIn = await AuthManager.isLoggedIn();
        if (isLoggedIn) {
          const session = AuthManager.getSession();
          if (session && session.access_token) {
            authToken = session.access_token;
            logger.log('[SupabaseManager] Using user access_token for request');
          } else {
            logger.warn('[SupabaseManager] User logged in but no access_token available');
          }
        } else {
          logger.log('[SupabaseManager] User not logged in, using anonymous token');
        }
      } catch (authError) {
        logger.warn('[SupabaseManager] Error getting auth token:', authError);
      }
      
      const headers = {
        'apikey': this.apiKey,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...options.headers
      };

      logger.log(`[SupabaseManager] API Request: ${method} ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers
      });

      // 处理401错误 - JWT过期
      if (response.status === 401 && retryCount === 0) {
        logger.warn('[SupabaseManager] ⚠️ 401 Unauthorized - JWT已过期,尝试刷新token');
        
        try {
          const { AuthManager } = await import('./auth');
          const authInstance = AuthManager.getInstance();
          const refreshed = await authInstance.refreshSession();
          
          if (refreshed) {
            logger.log('[SupabaseManager] ✅ Token刷新成功,重试请求');
            return this.apiRequest(endpoint, options, retryCount + 1); // 重试一次
          } else {
            logger.error('[SupabaseManager] ❌ Token刷新失败,需要重新登录');
            // 清除登录状态
            await AuthManager.signOut();
            throw new Error('会话已过期,请重新登录');
          }
        } catch (refreshError) {
          logger.error('[SupabaseManager] ❌ 刷新token时出错:', refreshError);
          throw new Error('会话已过期,请重新登录');
        }
      }

      if (!response.ok) {
        // 尝试获取错误详情
        let errorDetail = '';
        try {
          const errorBody = await response.text();
          errorDetail = errorBody ? ` - ${errorBody}` : '';
        } catch (e) {
          // 忽略解析错误
        }
        throw new Error(`Supabase API error: ${response.status} ${response.statusText}${errorDetail}`);
      }

      const data = await response.json();
      logger.log(`[SupabaseManager] API Response:`, data);
      return data;

    } catch (error) {
      if (error instanceof Error) {
        logger.error('[SupabaseManager] API Request failed:', error.message, 'Stack:', error.stack);
      } else {
        logger.error('[SupabaseManager] API Request failed:', String(error));
      }
      throw error;
    }
  }

  /**
   * 根据DOI查找或创建文档记录
   */
  async findOrCreateDocument(item: any): Promise<DocumentInfo> {
    try {
      const doi = item.getField('DOI') || null;
      const title = item.getDisplayTitle ? item.getDisplayTitle() : item.getField('title');
      const authors = item.getCreators ? item.getCreators().map((c: any) => c.name || `${c.firstName} ${c.lastName}`) : [];

      // 如果有DOI，先尝试查找
      if (doi) {
        const existingDocs = await this.apiRequest(`documents?doi=eq.${doi}&select=*`);
        if (existingDocs && existingDocs.length > 0) {
          logger.log('[SupabaseManager] Found existing document by DOI:', existingDocs[0]);
          return existingDocs[0];
        }
      }

      // 创建新文档记录
      const newDoc = {
        doi: doi,
        title: title,
        authors: authors,
        document_type: 'pdf',
        created_at: new Date().toISOString()
      };

      const result = await this.apiRequest('documents', {
        method: 'POST',
        body: JSON.stringify(newDoc)
      });

      logger.log('[SupabaseManager] Created new document:', result);
      return result[0];

    } catch (error) {
      logger.error('[SupabaseManager] Error finding/creating document:', error);
      throw error;
    }
  }

  /**
   * 上传标注到Supabase
   */
  async uploadAnnotations(documentId: string, annotations: any[], userId?: string): Promise<void> {
    try {
      if (!annotations || annotations.length === 0) {
        logger.log('[SupabaseManager] No annotations to upload');
        return;
      }

      // 转换Zotero标注格式为Supabase格式
      const supabaseAnnotations = annotations.map(ann => ({
        document_id: documentId,
        user_id: userId || 'anonymous-user', // 需要实际的用户ID
        type: ann.type || 'highlight',
        content: ann.text || ann.content || null,
        comment: ann.comment || null,
        color: ann.color || '#ffd400',
        position: ann.position || {},
        tags: ann.tags || [],
        visibility: 'private', // 默认私有
        platform: 'zotero',
        original_id: ann.id?.toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const result = await this.apiRequest('annotations', {
        method: 'POST',
        body: JSON.stringify(supabaseAnnotations)
      });

      logger.log(`[SupabaseManager] Successfully uploaded ${supabaseAnnotations.length} annotations`);
      return result;

    } catch (error) {
      logger.error('[SupabaseManager] Error uploading annotations:', error);
      throw error;
    }
  }

  /**
   * 获取文档的共享标注
   */
  async getSharedAnnotations(documentId: string): Promise<SupabaseAnnotation[]> {
    try {
      const response = await apiGet(`/api/proxy/annotations?document_id=${encodeURIComponent(documentId)}&type=shared`);
      
      if (!response.success) {
        throw new Error(response.error || '获取共享标注失败');
      }

      const annotations = response.data || [];
      logger.log(`[SupabaseManager] Retrieved ${annotations.length} shared annotations`);
      return annotations;

    } catch (error) {
      logger.error('[SupabaseManager] Error getting shared annotations:', error);
      return [];
    }
  }

  /**
   * 获取用户在指定文档的标注
   */
  async getAnnotationsForDocument(documentId: string, userId?: string): Promise<SupabaseAnnotation[]> {
    try {
      const type = userId ? 'my' : 'all';
      const response = await apiGet(`/api/proxy/annotations?document_id=${encodeURIComponent(documentId)}&type=${type}`);
      
      if (!response.success) {
        throw new Error(response.error || '获取文档标注失败');
      }

      const annotations = response.data || [];
      logger.log(`[SupabaseManager] Retrieved ${annotations.length} annotations for document ${documentId}`);
      return annotations;

    } catch (error) {
      logger.error('[SupabaseManager] Error getting document annotations:', error);
      return [];
    }
  }

  /**
   * 更新标注的共享状态
   */
  async updateAnnotationSharing(annotationId: string, visibility: 'private' | 'shared' | 'public', showAuthorName: boolean): Promise<void> {
    try {
      const updateData = {
        visibility: visibility,
        show_author_name: showAuthorName,
        updated_at: new Date().toISOString()
      };

      await this.apiRequest(`annotations?id=eq.${annotationId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      logger.log(`[SupabaseManager] Updated annotation ${annotationId} sharing status`);

    } catch (error) {
      logger.error('[SupabaseManager] Error updating annotation sharing:', error);
      throw error;
    }
  }

  /**
   * 批量更新标注的共享状态
   */
  async batchUpdateAnnotationSharing(annotationIds: string[], visibility: 'private' | 'shared' | 'public', showAuthorName: boolean): Promise<void> {
    try {
      const updateData = {
        visibility: visibility,
        show_author_name: showAuthorName,
        updated_at: new Date().toISOString()
      };

      // 使用in操作符批量更新
      await this.apiRequest(`annotations?id=in.(${annotationIds.join(',')})`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      logger.log(`[SupabaseManager] Batch updated ${annotationIds.length} annotations sharing status`);

    } catch (error) {
      logger.error('[SupabaseManager] Error batch updating annotation sharing:', error);
      throw error;
    }
  }

  /**
   * 获取用户的标注统计
   */
  async getUserAnnotationStats(userId: string): Promise<any> {
    try {
      const stats = await this.apiRequest(`rpc/get_user_annotation_stats`, {
        method: 'POST',
        body: JSON.stringify({ user_uuid: userId })
      });

      logger.log('[SupabaseManager] User annotation stats:', stats);
      return stats;

    } catch (error) {
      logger.error('[SupabaseManager] Error getting user stats:', error);
      return null;
    }
  }

  /**
   * 创建单个标注
   */
  async createAnnotation(annotation: any): Promise<any> {
    try {
      logger.log('[SupabaseManager] Creating annotation with data:', JSON.stringify(annotation).substring(0, 200));
      const response = await apiPost('/api/proxy/annotations', annotation);

      if (!response.success) {
        throw new Error(response.error || '创建标注失败');
      }

      logger.log('[SupabaseManager] Created annotation:', response.data);
      return response.data;

    } catch (error) {
      if (error instanceof Error) {
        logger.error('[SupabaseManager] Error creating annotation:', error.message);
      } else {
        logger.error('[SupabaseManager] Error creating annotation:', String(error));
      }
      throw error;
    }
  }

  /**
   * 更新标注
   */
  async updateAnnotation(annotationId: string, updateData: any): Promise<any> {
    try {
      const data = {
        id: annotationId,
        ...updateData
      };

      const response = await apiPatch('/api/proxy/annotations', data);

      if (!response.success) {
        throw new Error(response.error || '更新标注失败');
      }

      logger.log(`[SupabaseManager] Updated annotation ${annotationId}:`, response.data);
      return response.data;

    } catch (error) {
      logger.error('[SupabaseManager] Error updating annotation:', error);
      throw error;
    }
  }

  /**
   * 检查与Supabase的连接
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.apiRequest('users?select=id&limit=1');
      logger.log('[SupabaseManager] Connection test successful');
      return true;
    } catch (error) {
      logger.error('[SupabaseManager] Connection test failed:', error);
      return false;
    }
  }

  /**
   * 删除标注
   */
  async deleteAnnotation(annotationId: string): Promise<void> {
    try {
      const response = await apiDelete(`/api/proxy/annotations?id=${annotationId}`);

      if (!response.success) {
        throw new Error(response.error || '删除标注失败');
      }

      logger.log(`[SupabaseManager] Deleted annotation ${annotationId}`);
    } catch (error) {
      logger.error(`[SupabaseManager] Error deleting annotation ${annotationId}:`, error);
      throw error;
    }
  }

  /**
   * 点赞标注
   */
  async likeAnnotation(annotationId: string, userId: string): Promise<boolean> {
    try {
      // 检查是否已点赞
      const existing = await this.apiRequest(
        `annotation_likes?annotation_id=eq.${annotationId}&user_id=eq.${userId}`
      );

      if (existing && existing.length > 0) {
        // 取消点赞
        await this.apiRequest(
          `annotation_likes?annotation_id=eq.${annotationId}&user_id=eq.${userId}`,
          { method: 'DELETE' }
        );
        logger.log(`[SupabaseManager] Unliked annotation ${annotationId}`);
        return false;
      } else {
        // 添加点赞
        await this.apiRequest('annotation_likes', {
          method: 'POST',
          body: JSON.stringify({
            annotation_id: annotationId,
            user_id: userId,
            created_at: new Date().toISOString()
          })
        });
        logger.log(`[SupabaseManager] Liked annotation ${annotationId}`);
        return true;
      }
    } catch (error) {
      logger.error(`[SupabaseManager] Error liking annotation:`, error);
      throw error;
    }
  }

  /**
   * 检查用户是否点赞了标注
   */
  async checkUserLiked(annotationId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.apiRequest(
        `annotation_likes?annotation_id=eq.${annotationId}&user_id=eq.${userId}&select=id`
      );
      return result && result.length > 0;
    } catch (error) {
      logger.error(`[SupabaseManager] Error checking like status:`, error);
      return false;
    }
  }

  /**
   * 获取标注的所有点赞记录
   */
  async getAnnotationLikes(annotationId: string): Promise<any[]> {
    try {
      const result = await this.apiRequest(
        `annotation_likes?annotation_id=eq.${annotationId}&select=id,user_id,created_at`
      );
      return result || [];
    } catch (error) {
      logger.error(`[SupabaseManager] Error getting annotation likes:`, error);
      return [];
    }
  }

  /**
   * 批量查询用户对多个标注的点赞状态
   * @returns Map<annotationId, boolean>
   */
  async batchCheckUserLikes(annotationIds: string[], userId: string): Promise<Map<string, boolean>> {
    try {
      const likeMap = new Map<string, boolean>();
      
      if (annotationIds.length === 0) {
        return likeMap;
      }

      // 一次性查询所有点赞记录
      const idsQuery = annotationIds.map(id => `"${id}"`).join(',');
      const result = await this.apiRequest(
        `annotation_likes?annotation_id=in.(${idsQuery})&user_id=eq.${userId}&select=annotation_id`
      );

      // 初始化所有为false
      annotationIds.forEach(id => likeMap.set(id, false));

      // 标记已点赞的
      if (result && result.length > 0) {
        result.forEach((like: any) => {
          likeMap.set(like.annotation_id, true);
        });
      }

      logger.log(`[SupabaseManager] Batch checked ${annotationIds.length} annotations, found ${result?.length || 0} likes`);
      return likeMap;
    } catch (error) {
      logger.error(`[SupabaseManager] Error batch checking likes:`, error);
      return new Map();
    }
  }

  /**
   * 添加评论
   */
  async addComment(
    annotationId: string,
    userId: string,
    content: string,
    parentId: string | null = null,
    isAnonymous: boolean = false
  ): Promise<any> {
    try {
      const result = await this.apiRequest('annotation_comments', {
        method: 'POST',
        body: JSON.stringify({
          annotation_id: annotationId,
          user_id: userId,
          content: content,
          parent_id: parentId,
          is_anonymous: isAnonymous,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });

      logger.log(`[SupabaseManager] Added comment to annotation ${annotationId}`);
      return result[0];
    } catch (error) {
      logger.error(`[SupabaseManager] Error adding comment:`, error);
      throw error;
    }
  }

  /**
   * 获取标注的评论
   */
  async getAnnotationComments(annotationId: string): Promise<any[]> {
    try {
      const comments = await this.apiRequest(
        `annotation_comments?annotation_id=eq.${annotationId}&select=*,users(username,avatar_url)&order=created_at.asc`
      );
      
      logger.log(`[SupabaseManager] Retrieved ${comments.length} comments for annotation ${annotationId}`);
      return comments;
    } catch (error) {
      logger.error(`[SupabaseManager] Error getting comments:`, error);
      return [];
    }
  }

  /**
   * 更新评论
   */
  async updateComment(commentId: string, content: string, isAnonymous?: boolean): Promise<void> {
    try {
      logger.log(`[SupabaseManager] updateComment called with commentId: ${commentId}, isAnonymous: ${isAnonymous}`);
      
      const body: any = {
        content: content,
        updated_at: new Date().toISOString()
      };
      
      // 🆕 如果提供了匿名状态参数,则包含在更新中
      if (isAnonymous !== undefined) {
        body.is_anonymous = isAnonymous;
        logger.log(`[SupabaseManager] Including is_anonymous in update: ${isAnonymous}`);
      } else {
        logger.log(`[SupabaseManager] isAnonymous is undefined, not including in update`);
      }
      
      logger.log(`[SupabaseManager] Update body:`, JSON.stringify(body));
      
      await this.apiRequest(`annotation_comments?id=eq.${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
      logger.log(`[SupabaseManager] Updated comment ${commentId}`);
    } catch (error) {
      logger.error(`[SupabaseManager] Error updating comment:`, error);
      throw error;
    }
  }

  /**
   * 删除评论
   */
  async deleteComment(commentId: string): Promise<void> {
    try {
      await this.apiRequest(`annotation_comments?id=eq.${commentId}`, {
        method: 'DELETE'
      });
      logger.log(`[SupabaseManager] Deleted comment ${commentId}`);
    } catch (error) {
      logger.error(`[SupabaseManager] Error deleting comment:`, error);
      throw error;
    }
  }

  // ========== 论文评分和评论 API ==========

  /**
   * 获取论文评分列表
   */
  async getPaperRatings(paperId: string): Promise<any[]> {
    try {
      logger.log(`[SupabaseManager] Getting ratings for paper ${paperId}`);
      const result = await this.apiRequest(
        `ratings?paper_id=eq.${paperId}&select=*,users(username,avatar_url)&order=created_at.desc`
      );
      logger.log(`[SupabaseManager] Retrieved ${result?.length || 0} ratings`);
      return result || [];
    } catch (error) {
      logger.error(`[SupabaseManager] Error getting paper ratings:`, error);
      throw error;
    }
  }

  /**
   * 获取当前用户对论文的评分
   */
  async getUserPaperRating(paperId: string, userId: string): Promise<any | null> {
    try {
      const result = await this.apiRequest(
        `ratings?paper_id=eq.${paperId}&user_id=eq.${userId}`
      );
      return result?.[0] || null;
    } catch (error) {
      logger.error(`[SupabaseManager] Error getting user rating:`, error);
      return null;
    }
  }

  /**
   * 提交或更新论文评分
   */
  async submitPaperRating(ratingData: {
    paper_id: string;
    user_id: string;
    innovation_score: number;
    methodology_score: number;
    practicality_score: number;
    overall_score: number;
    is_anonymous?: boolean; // 🆕 匿名选项
    show_username?: boolean; // 🆕 显示用户名选项
  }): Promise<any> {
    try {
      // 检查是否已有评分
      const existing = await this.getUserPaperRating(ratingData.paper_id, ratingData.user_id);
      
      if (existing) {
        // 更新现有评分
        const result = await this.apiRequest(
          `ratings?id=eq.${existing.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              innovation_score: ratingData.innovation_score,
              methodology_score: ratingData.methodology_score,
              practicality_score: ratingData.practicality_score,
              overall_score: ratingData.overall_score,
              is_anonymous: ratingData.is_anonymous, // 🆕
              show_username: ratingData.show_username, // 🆕
              updated_at: new Date().toISOString()
            })
          }
        );
        logger.log(`[SupabaseManager] Updated rating ${existing.id}`);
        return result?.[0];
      } else {
        // 创建新评分
        const result = await this.apiRequest('ratings', {
          method: 'POST',
          body: JSON.stringify({
            ...ratingData,
            created_at: new Date().toISOString()
          })
        });
        logger.log(`[SupabaseManager] Created new rating`);
        return result?.[0];
      }
    } catch (error) {
      logger.error(`[SupabaseManager] Error submitting rating:`, error);
      throw error;
    }
  }

  /**
   * 获取论文评论列表
   */
  async getPaperComments(paperId: string): Promise<any[]> {
    try {
      logger.log(`[SupabaseManager] Getting comments for paper ${paperId}`);
      const result = await this.apiRequest(
        `comments?paper_id=eq.${paperId}&select=*,users(username,avatar_url)&order=created_at.desc`
      );
      logger.log(`[SupabaseManager] Retrieved ${result?.length || 0} comments`);
      return result || [];
    } catch (error) {
      logger.error(`[SupabaseManager] Error getting paper comments:`, error);
      throw error;
    }
  }

  /**
   * 提交论文评论
   */
  async submitPaperComment(paperId: string, userId: string, content: string, isAnonymous: boolean = false): Promise<any> {
    try {
      const result = await this.apiRequest('comments', {
        method: 'POST',
        body: JSON.stringify({
          paper_id: paperId,
          user_id: userId,
          content: content,
          is_anonymous: isAnonymous,
          created_at: new Date().toISOString()
        })
      });
      logger.log(`[SupabaseManager] Submitted paper comment`);
      return result?.[0];
    } catch (error) {
      logger.error(`[SupabaseManager] Error submitting comment:`, error);
      throw error;
    }
  }

  /**
   * 更新论文评论
   */
  async updatePaperComment(commentId: string, content: string, isAnonymous?: boolean): Promise<void> {
    try {
      logger.log(`[SupabaseManager] updatePaperComment called with commentId: ${commentId}, isAnonymous: ${isAnonymous}`);
      
      const body: any = {
        content: content,
        updated_at: new Date().toISOString()
      };
      
      // 🆕 如果提供了匿名状态参数,则包含在更新中
      if (isAnonymous !== undefined) {
        body.is_anonymous = isAnonymous;
        logger.log(`[SupabaseManager] Including is_anonymous in update: ${isAnonymous}`);
      } else {
        logger.log(`[SupabaseManager] isAnonymous is undefined, not including in update`);
      }
      
      logger.log(`[SupabaseManager] Update body:`, JSON.stringify(body));
      
      await this.apiRequest(`comments?id=eq.${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
      logger.log(`[SupabaseManager] Updated paper comment ${commentId}`);
    } catch (error) {
      logger.error(`[SupabaseManager] Error updating paper comment:`, error);
      throw error;
    }
  }

  /**
   * 删除论文评论
   */
  async deletePaperComment(commentId: string): Promise<void> {
    try {
      await this.apiRequest(`comments?id=eq.${commentId}`, {
        method: 'DELETE'
      });
      logger.log(`[SupabaseManager] Deleted paper comment ${commentId}`);
    } catch (error) {
      logger.error(`[SupabaseManager] Error deleting paper comment:`, error);
      throw error;
    }
  }

  // ========== 嵌套评论API ==========

  /**
   * 获取标注的完整评论树(支持嵌套)
   */
  async getAnnotationCommentTree(annotationId: string): Promise<any[]> {
    try {
      logger.log(`[SupabaseManager] Getting comment tree for annotation ${annotationId}`);
      
      // 调用数据库函数获取评论树
      const result = await this.apiRequest(
        `rpc/get_annotation_comment_tree`,
        {
          method: 'POST',
          body: JSON.stringify({ p_annotation_id: annotationId })
        }
      );
      
      logger.log(`[SupabaseManager] Retrieved ${result?.length || 0} comments in tree`);
      return this.buildCommentTree(result || []);
    } catch (error) {
      logger.error(`[SupabaseManager] Error getting comment tree:`, error);
      // 如果RPC函数不存在,回退到扁平查询
      return this.getAnnotationComments(annotationId);
    }
  }

  /**
   * 获取论文的完整评论树(用于网站)
   */
  async getPaperCommentTree(paperId: string): Promise<any[]> {
    try {
      logger.log(`[SupabaseManager] Getting comment tree for paper ${paperId}`);
      
      const result = await this.apiRequest(
        `rpc/get_paper_comment_tree`,
        {
          method: 'POST',
          body: JSON.stringify({ p_paper_id: paperId })
        }
      );
      
      logger.log(`[SupabaseManager] Retrieved ${result?.length || 0} paper comments in tree`);
      return this.buildCommentTree(result || []);
    } catch (error) {
      logger.error(`[SupabaseManager] Error getting paper comment tree:`, error);
      // 回退到扁平查询
      return this.getPaperComments(paperId);
    }
  }

  /**
   * 将扁平的评论列表转换为树形结构
   */
  private buildCommentTree(flatComments: any[]): any[] {
    if (!flatComments || flatComments.length === 0) return [];

    const commentMap = new Map<string, any>();
    const rootComments: any[] = [];

    // 第一遍:创建所有节点
    flatComments.forEach(comment => {
      commentMap.set(comment.id, {
        ...comment,
        children: []
      });
    });

    // 第二遍:构建树形结构
    flatComments.forEach(comment => {
      const node = commentMap.get(comment.id);
      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.children.push(node);
        } else {
          // 父节点不存在,作为根节点
          rootComments.push(node);
        }
      } else {
        // 没有父节点,是根评论
        rootComments.push(node);
      }
    });

    return rootComments;
  }

  /**
   * 回复评论(添加嵌套评论)
   */
  async replyToAnnotationComment(
    annotationId: string,
    parentId: string,
    userId: string,
    content: string,
    isAnonymous: boolean = false // 🆕 匿名参数
  ): Promise<any> {
    try {
      logger.log(`[SupabaseManager] Replying to comment ${parentId} (anonymous: ${isAnonymous})`);
      
      const result = await this.apiRequest('annotation_comments', {
        method: 'POST',
        body: JSON.stringify({
          annotation_id: annotationId,
          parent_id: parentId,
          user_id: userId,
          content: content,
          is_anonymous: isAnonymous, // 🆕 添加匿名字段
          created_at: new Date().toISOString()
        })
      });
      
      logger.log(`[SupabaseManager] Created reply comment`);
      return result?.[0];
    } catch (error) {
      logger.error(`[SupabaseManager] Error replying to comment:`, error);
      throw error;
    }
  }

  /**
   * 回复论文评论
   */
  async replyToPaperComment(
    paperId: string,
    parentId: string,
    userId: string,
    content: string,
    isAnonymous: boolean = false // 🆕 匿名参数
  ): Promise<any> {
    try {
      logger.log(`[SupabaseManager] Replying to paper comment ${parentId} (anonymous: ${isAnonymous})`);
      
      const result = await this.apiRequest('comments', {
        method: 'POST',
        body: JSON.stringify({
          paper_id: paperId,
          parent_id: parentId,
          user_id: userId,
          content: content,
          is_anonymous: isAnonymous, // 🆕 添加匿名字段
          created_at: new Date().toISOString()
        })
      });
      
      logger.log(`[SupabaseManager] Created paper reply comment`);
      return result?.[0];
    } catch (error) {
      logger.error(`[SupabaseManager] Error replying to paper comment:`, error);
      throw error;
    }
  }

  /**
   * 检查标注的关联数据(用于删除前确认)
   */
  async getAnnotationRelatedData(annotationId: string): Promise<{
    likes_count: number;
    comments_count: number;
    has_nested_comments: boolean;
  }> {
    try {
      // 获取标注信息
      const annotations = await this.apiRequest(
        `annotations?id=eq.${annotationId}&select=likes_count,comments_count`
      );
      
      if (!annotations || annotations.length === 0) {
        return { likes_count: 0, comments_count: 0, has_nested_comments: false };
      }

      const annotation = annotations[0];
      
      // 检查是否有嵌套评论
      const comments = await this.apiRequest(
        `annotation_comments?annotation_id=eq.${annotationId}&select=id,parent_id`
      );
      
      const hasNested = comments && comments.some((c: any) => c.parent_id !== null);

      return {
        likes_count: annotation.likes_count || 0,
        comments_count: annotation.comments_count || 0,
        has_nested_comments: hasNested
      };
    } catch (error) {
      logger.error(`[SupabaseManager] Error getting related data:`, error);
      return { likes_count: 0, comments_count: 0, has_nested_comments: false };
    }
  }
}