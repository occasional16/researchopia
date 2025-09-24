/**
 * Supabase API 管理器
 * 处理标注的在线存储、点赞、评论等功能
 */

// 安全的日志函数
function safeLog(message) {
  if (typeof log === 'function') {
    log(message);
  } else if (typeof console !== 'undefined' && console.log) {
    console.log(message);
  }
}

class SupabaseAnnotationAPI {
  constructor(authManager) {
    this.authManager = authManager;
    this.baseUrl = 'https://ixjqvqvqkqkqvqvq.supabase.co'; // 将被实际配置替换
    this.apiKey = 'your-anon-key'; // 将被实际配置替换
    this.cache = new Map(); // 简单缓存
  }

  /**
   * 初始化API配置
   */
  async initialize() {
    try {
      safeLog('🔄 Initializing Supabase API...');

      // 从环境配置中读取Supabase配置
      const config = await this.loadSupabaseConfig();
      if (config && config.url && config.anonKey) {
        this.baseUrl = config.url;
        this.apiKey = config.anonKey;
        safeLog('✅ Supabase API initialized successfully');
        safeLog('📍 URL: ' + config.url);
        safeLog('🔑 Key: ' + config.anonKey.substring(0, 20) + '...');
        return true;
      } else {
        safeLog('❌ Invalid Supabase configuration');
        return false;
      }
    } catch (error) {
      safeLog('❌ Failed to initialize Supabase API: ' + error.message);
      return false;
    }
  }

  /**
   * 加载Supabase配置
   */
  async loadSupabaseConfig() {
    try {
      safeLog('🔄 Loading Supabase configuration...');

      // 暂时直接使用硬编码配置，避免文件读取问题
      const config = {
        url: 'https://obcblvdtqhwrihoddlez.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4'
      };

      safeLog('✅ Using hardcoded Supabase config');
      return config;
    } catch (error) {
      safeLog('❌ Failed to load Supabase config: ' + error.message);
      return null;
    }
  }

  /**
   * 发送HTTP请求到Supabase
   */
  async request(method, endpoint, data = null) {
    try {
      const url = `${this.baseUrl}/rest/v1/${endpoint}`;
      const headers = {
        'apikey': this.apiKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      // 添加认证头
      if (this.authManager.isAuthenticated && this.authManager.accessToken) {
        headers['Authorization'] = `Bearer ${this.authManager.accessToken}`;
      }

      const options = {
        method: method,
        headers: headers
      };

      if (data && (method === 'POST' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
      }

      safeLog(`🌐 Supabase ${method} ${endpoint}`);

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      safeLog(`✅ Supabase response: ${result.length || 1} items`);

      return result;
    } catch (error) {
      safeLog(`❌ Supabase request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 确保论文存在于数据库中
   */
  async ensurePaper(item) {
    try {
      const doi = item.getField('DOI');
      if (!doi) throw new Error('No DOI found');

      // 检查缓存
      const cacheKey = `paper_${doi}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // 查询是否已存在
      let papers = await this.request('GET', `papers?doi=eq.${encodeURIComponent(doi)}`);
      
      if (papers.length > 0) {
        this.cache.set(cacheKey, papers[0]);
        return papers[0];
      }

      // 创建新论文记录
      const paperData = {
        doi: doi,
        title: item.getField('title') || 'Unknown Title',
        authors: this.extractAuthors(item),
        journal: item.getField('publicationTitle') || null,
        year: item.getField('date') ? new Date(item.getField('date')).getFullYear() : null,
        abstract: item.getField('abstractNote') || null
      };

      const newPapers = await this.request('POST', 'papers', paperData);
      const paper = newPapers[0];
      
      this.cache.set(cacheKey, paper);
      safeLog(`✅ Paper created: ${paper.title}`);

      return paper;
    } catch (error) {
      safeLog(`❌ Failed to ensure paper: ${error.message}`);
      throw error;
    }
  }

  /**
   * 提取作者信息
   */
  extractAuthors(item) {
    try {
      const creators = item.getCreators();
      return creators
        .filter(creator => creator.creatorType === 'author')
        .map(creator => {
          if (creator.firstName && creator.lastName) {
            return `${creator.firstName} ${creator.lastName}`;
          }
          return creator.lastName || creator.name || 'Unknown Author';
        });
    } catch (error) {
      return ['Unknown Author'];
    }
  }

  /**
   * 上传标注到Supabase
   */
  async uploadAnnotations(item, annotations) {
    try {
      if (!this.authManager.isAuthenticated) {
        throw new Error('User not authenticated');
      }

      // 确保论文存在
      const paper = await this.ensurePaper(item);
      
      // 获取当前用户ID
      const userId = this.authManager.user?.id;
      if (!userId) {
        throw new Error('User ID not found');
      }

      // 准备标注数据
      const annotationData = annotations.map(annotation => ({
        user_id: userId,
        paper_id: paper.id,
        zotero_key: annotation.key,
        annotation_type: annotation.type,
        text_content: annotation.text || null,
        comment: annotation.comment || null,
        color: annotation.color || '#ffd400',
        page_number: annotation.page || null,
        page_label: annotation.pageLabel || null,
        position_data: annotation.position || null,
        text_before: annotation.textBefore || null,
        text_after: annotation.textAfter || null,
        paragraph_hash: annotation.paragraphHash || null,
        sentence_index: annotation.sentenceIndex || null,
        is_public: true
      }));

      // 批量上传（使用upsert避免重复）
      const result = await this.request('POST', 'annotations', annotationData);

      safeLog(`✅ Uploaded ${result.length} annotations`);
      return result;
    } catch (error) {
      safeLog(`❌ Failed to upload annotations: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取论文的共享标注
   */
  async getSharedAnnotations(item, options = {}) {
    try {
      const doi = item.getField('DOI');
      if (!doi) throw new Error('No DOI found');

      // 确保论文存在
      const paper = await this.ensurePaper(item);

      // 构建查询参数
      let query = `annotations?paper_id=eq.${paper.id}&is_public=eq.true&is_deleted=eq.false`;
      
      // 添加用户信息的连接查询
      query += '&select=*,users(id,username,display_name,avatar_url)';
      
      // 排序选项
      const sortBy = options.sortBy || 'likes_count';
      const sortOrder = options.sortOrder || 'desc';
      query += `&order=${sortBy}.${sortOrder},created_at.desc`;
      
      // 分页
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      query += `&limit=${limit}&offset=${offset}`;

      const annotations = await this.request('GET', query);

      safeLog(`✅ Retrieved ${annotations.length} shared annotations`);
      return annotations;
    } catch (error) {
      safeLog(`❌ Failed to get shared annotations: ${error.message}`);
      throw error;
    }
  }

  /**
   * 点赞标注
   */
  async likeAnnotation(annotationId) {
    try {
      if (!this.authManager.isAuthenticated) {
        throw new Error('User not authenticated');
      }

      const userId = this.authManager.user?.id;
      if (!userId) {
        throw new Error('User ID not found');
      }

      // 检查是否已经点赞
      const existingLikes = await this.request('GET', 
        `annotation_likes?user_id=eq.${userId}&annotation_id=eq.${annotationId}`);
      
      if (existingLikes.length > 0) {
        // 取消点赞
        await this.request('DELETE',
          `annotation_likes?user_id=eq.${userId}&annotation_id=eq.${annotationId}`);
        safeLog('✅ Annotation unliked');
        return { liked: false };
      } else {
        // 添加点赞
        await this.request('POST', 'annotation_likes', {
          user_id: userId,
          annotation_id: annotationId
        });
        safeLog('✅ Annotation liked');
        return { liked: true };
      }
    } catch (error) {
      safeLog(`❌ Failed to like annotation: ${error.message}`);
      throw error;
    }
  }

  /**
   * 添加评论
   */
  async addComment(annotationId, content, parentId = null) {
    try {
      if (!this.authManager.isAuthenticated) {
        throw new Error('User not authenticated');
      }

      const userId = this.authManager.user?.id;
      if (!userId) {
        throw new Error('User ID not found');
      }

      const commentData = {
        user_id: userId,
        annotation_id: annotationId,
        content: content.trim(),
        parent_id: parentId
      };

      const result = await this.request('POST', 'annotation_comments', commentData);

      safeLog('✅ Comment added');
      return result[0];
    } catch (error) {
      safeLog(`❌ Failed to add comment: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取标注的评论
   */
  async getComments(annotationId) {
    try {
      const query = `annotation_comments?annotation_id=eq.${annotationId}&is_deleted=eq.false&select=*,users(id,username,display_name,avatar_url)&order=created_at.asc`;
      
      const comments = await this.request('GET', query);

      safeLog(`✅ Retrieved ${comments.length} comments`);
      return comments;
    } catch (error) {
      safeLog(`❌ Failed to get comments: ${error.message}`);
      throw error;
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear();
    safeLog('✅ Cache cleared');
  }
}

// 导出到全局作用域
this.SupabaseAnnotationAPI = SupabaseAnnotationAPI;

// 添加加载确认日志
safeLog('✅ SupabaseAnnotationAPI class loaded and exported');
