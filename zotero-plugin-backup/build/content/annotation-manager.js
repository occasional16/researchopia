/**
 * 标注管理器 - 处理标注提取、上传和同步
 */
class AnnotationManager {
  constructor(authManager) {
    this.authManager = authManager;
    this.supabaseUrl = 'https://obcblvdtqhwrihoddlez.supabase.co';
    this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4';
    this.cache = new Map(); // 缓存标注数据
  }

  /**
   * 从Zotero项目提取标注
   */
  async extractAnnotationsFromItem(item) {
    try {
      if (!item || !item.isRegularItem()) {
        throw new Error('Invalid item');
      }

      // 获取DOI
      const doi = item.getField('DOI');
      if (!doi) {
        throw new Error('Item has no DOI');
      }

      // 获取附件中的PDF
      const attachments = item.getAttachments();
      const pdfAttachments = attachments.filter(id => {
        const attachment = Zotero.Items.get(id);
        return attachment && attachment.isPDFAttachment();
      });

      if (pdfAttachments.length === 0) {
        throw new Error('No PDF attachments found');
      }

      const annotations = [];
      
      // 遍历所有PDF附件的标注
      for (const attachmentID of pdfAttachments) {
        const attachment = Zotero.Items.get(attachmentID);
        const itemAnnotations = attachment.getAnnotations();
        
        for (const annotationItem of itemAnnotations) {
          const annotation = await this.processAnnotation(annotationItem, item, doi);
          if (annotation) {
            annotations.push(annotation);
          }
        }
      }

      return {
        item,
        doi,
        annotations,
        paperInfo: this.extractPaperInfo(item)
      };

    } catch (error) {
      console.error('Failed to extract annotations:', error);
      throw error;
    }
  }

  /**
   * 处理单个标注
   */
  async processAnnotation(annotationItem, parentItem, doi) {
    try {
      const annotationData = {
        zotero_key: annotationItem.key,
        annotation_type: annotationItem.annotationType,
        text_content: annotationItem.annotationText || '',
        comment: annotationItem.annotationComment || '',
        color: annotationItem.annotationColor || '#ffd400',
        page_number: annotationItem.annotationPageLabel ? parseInt(annotationItem.annotationPageLabel) : null,
        page_label: annotationItem.annotationPageLabel || '',
        position_data: annotationItem.annotationPosition || {},
        created_at: annotationItem.dateAdded || new Date().toISOString(),
        updated_at: annotationItem.dateModified || new Date().toISOString()
      };

      // 提取上下文信息用于精确定位
      if (annotationData.text_content) {
        const context = await this.extractTextContext(annotationItem, parentItem);
        annotationData.text_before = context.before;
        annotationData.text_after = context.after;
        annotationData.paragraph_hash = context.paragraphHash;
        annotationData.sentence_index = context.sentenceIndex;
      }

      return annotationData;

    } catch (error) {
      console.error('Failed to process annotation:', error);
      return null;
    }
  }

  /**
   * 提取文本上下文信息
   */
  async extractTextContext(annotationItem, parentItem) {
    try {
      // 获取标注周围的文本上下文
      const position = annotationItem.annotationPosition;
      const textContent = annotationItem.annotationText || '';
      
      // 简单的上下文提取（实际实现需要更复杂的PDF文本解析）
      const contextLength = 100;
      const before = ''; // TODO: 实现PDF文本提取
      const after = '';
      
      // 生成段落哈希用于匹配
      const paragraphText = before + textContent + after;
      const paragraphHash = await this.generateTextHash(paragraphText);
      
      // 计算句子索引
      const sentenceIndex = this.calculateSentenceIndex(before, textContent);

      return {
        before: before.slice(-contextLength),
        after: after.slice(0, contextLength),
        paragraphHash,
        sentenceIndex
      };

    } catch (error) {
      console.error('Failed to extract text context:', error);
      return {
        before: '',
        after: '',
        paragraphHash: '',
        sentenceIndex: 0
      };
    }
  }

  /**
   * 生成文本哈希
   */
  async generateTextHash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text.trim().toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }

  /**
   * 计算句子索引
   */
  calculateSentenceIndex(beforeText, targetText) {
    const sentences = beforeText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.length;
  }

  /**
   * 提取论文信息
   */
  extractPaperInfo(item) {
    return {
      title: item.getField('title') || '',
      authors: item.getCreators().map(creator => 
        `${creator.firstName || ''} ${creator.lastName || ''}`.trim()
      ),
      journal: item.getField('publicationTitle') || '',
      year: parseInt(item.getField('date')) || new Date().getFullYear(),
      abstract: item.getField('abstractNote') || '',
      pdf_url: '' // TODO: 获取PDF URL
    };
  }

  /**
   * 上传标注到Supabase
   */
  async uploadAnnotations(extractedData) {
    try {
      if (!this.authManager.isAuthenticated) {
        throw new Error('User not authenticated');
      }

      const { doi, annotations, paperInfo } = extractedData;
      
      // 1. 确保论文记录存在
      const paper = await this.ensurePaperExists(doi, paperInfo);
      
      // 2. 上传标注
      const uploadedAnnotations = [];
      for (const annotation of annotations) {
        try {
          const uploaded = await this.uploadSingleAnnotation(paper.id, annotation);
          if (uploaded) {
            uploadedAnnotations.push(uploaded);
          }
        } catch (error) {
          console.error('Failed to upload annotation:', error);
        }
      }

      return {
        paper,
        annotations: uploadedAnnotations,
        success: uploadedAnnotations.length,
        total: annotations.length
      };

    } catch (error) {
      console.error('Failed to upload annotations:', error);
      throw error;
    }
  }

  /**
   * 确保论文记录存在
   */
  async ensurePaperExists(doi, paperInfo) {
    try {
      // 首先尝试获取现有论文
      const response = await fetch(`${this.supabaseUrl}/rest/v1/papers?doi=eq.${encodeURIComponent(doi)}`, {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.authManager.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const papers = await response.json();
      
      if (papers.length > 0) {
        return papers[0];
      }

      // 创建新论文记录
      const createResponse = await fetch(`${this.supabaseUrl}/rest/v1/papers`, {
        method: 'POST',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.authManager.authToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          doi,
          ...paperInfo
        })
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create paper: HTTP ${createResponse.status}`);
      }

      const newPapers = await createResponse.json();
      return newPapers[0];

    } catch (error) {
      console.error('Failed to ensure paper exists:', error);
      throw error;
    }
  }

  /**
   * 上传单个标注
   */
  async uploadSingleAnnotation(paperId, annotation) {
    try {
      const annotationData = {
        user_id: this.authManager.currentUser.id,
        paper_id: paperId,
        ...annotation
      };

      const response = await fetch(`${this.supabaseUrl}/rest/v1/annotations`, {
        method: 'POST',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.authManager.authToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(annotationData)
      });

      if (!response.ok) {
        if (response.status === 409) {
          // 标注已存在，尝试更新
          return await this.updateExistingAnnotation(paperId, annotation);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result[0];

    } catch (error) {
      console.error('Failed to upload single annotation:', error);
      throw error;
    }
  }

  /**
   * 更新现有标注
   */
  async updateExistingAnnotation(paperId, annotation) {
    try {
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/annotations?user_id=eq.${this.authManager.currentUser.id}&paper_id=eq.${paperId}&zotero_key=eq.${annotation.zotero_key}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.authManager.authToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            ...annotation,
            updated_at: new Date().toISOString()
          })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result[0];

    } catch (error) {
      console.error('Failed to update existing annotation:', error);
      throw error;
    }
  }

  /**
   * 获取论文的共享标注
   */
  async getSharedAnnotations(doi, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        sortBy = 'likes_count',
        sortOrder = 'desc',
        userId = null
      } = options;

      // 构建查询URL
      let url = `${this.supabaseUrl}/rest/v1/annotations?select=*,users(username,display_name,avatar_url),papers(title,authors)&papers.doi=eq.${encodeURIComponent(doi)}&is_public=eq.true&is_deleted=eq.false`;
      
      if (userId) {
        url += `&user_id=eq.${userId}`;
      }
      
      url += `&order=${sortBy}.${sortOrder}&limit=${limit}&offset=${offset}`;

      const response = await fetch(url, {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': this.authManager.authToken ? `Bearer ${this.authManager.authToken}` : '',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const annotations = await response.json();
      
      // 缓存结果
      const cacheKey = `annotations_${doi}_${JSON.stringify(options)}`;
      this.cache.set(cacheKey, {
        data: annotations,
        timestamp: Date.now()
      });

      return annotations;

    } catch (error) {
      console.error('Failed to get shared annotations:', error);
      throw error;
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * 获取缓存的标注数据
   */
  getCachedAnnotations(doi, options = {}) {
    const cacheKey = `annotations_${doi}_${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5分钟缓存
      return cached.data;
    }
    
    return null;
  }
}

// 导出供其他模块使用 - 兼容Zotero插件环境
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnnotationManager;
} else {
  // 在Zotero插件环境中，直接定义为全局变量
  this.AnnotationManager = AnnotationManager;
}
