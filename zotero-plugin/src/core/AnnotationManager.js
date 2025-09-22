/**
 * 标注管理器 - 核心标注处理模块
 */
class AnnotationManager {
  constructor() {
    this.annotations = new Map();
    this.syncQueue = [];
  }

  /**
   * 获取指定文献的所有标注
   * @param {Object} item - Zotero文献项目
   * @returns {Array} 标注数组
   */
  async getItemAnnotations(item) {
    try {
      Zotero.debug(`AnnotationManager: Getting annotations for item ${item.id}`);

      const attachments = item.getAttachments();
      const allAnnotations = [];

      for (const attachmentID of attachments) {
        const attachment = Zotero.Items.get(attachmentID);
        if (attachment && attachment.isPDFAttachment()) {
          Zotero.debug(`AnnotationManager: Processing PDF attachment ${attachmentID}`);

          const annotations = attachment.getAnnotations();
          Zotero.debug(`AnnotationManager: Found ${annotations.length} annotations in attachment`);

          for (const annotation of annotations) {
            const processedAnnotation = this.processAnnotation(annotation, item);
            if (processedAnnotation) {
              allAnnotations.push(processedAnnotation);
            }
          }
        }
      }

      Zotero.debug(`AnnotationManager: Total processed annotations: ${allAnnotations.length}`);
      return allAnnotations;
    } catch (error) {
      Zotero.debug(`AnnotationManager: Error getting annotations: ${error.message}`);
      return [];
    }
  }

  /**
   * 处理单个标注，标准化数据格式
   * @param {Object} annotation - Zotero标注对象
   * @param {Object} item - 文献项目
   * @returns {Object} 处理后的标注数据
   */
  processAnnotation(annotation, item) {
    try {
      // 获取基本信息
      const doi = item.getField('DOI') || '';
      const title = item.getField('title') || '';

      // 处理标注文本
      const annotationText = annotation.annotationText || '';
      const annotationComment = annotation.annotationComment || '';

      // 获取标注位置信息
      const position = this.extractPosition(annotation);

      // 构建标注数据对象
      const annotationData = {
        // 基本标识
        id: annotation.key,
        itemId: item.id,
        doi: doi,
        title: title,

        // 标注内容
        type: annotation.annotationType || 'highlight',
        text: annotationText,
        comment: annotationComment,
        color: annotation.annotationColor || '#ffd400',

        // 位置信息
        pageLabel: annotation.annotationPageLabel || '1',
        position: position,
        sortIndex: annotation.annotationSortIndex || 0,

        // 时间信息
        dateAdded: annotation.dateAdded || new Date().toISOString(),
        dateModified: annotation.dateModified || new Date().toISOString(),

        // 标签
        tags: this.extractTags(annotation),

        // 上下文信息（用于精确定位）
        contextBefore: this.extractContext(annotation, 'before'),
        contextAfter: this.extractContext(annotation, 'after'),

        // 用户信息
        userId: this.getCurrentUserId(),
        userName: this.getCurrentUserName(),

        // 元数据
        isPublic: false, // 默认私有
        likes: 0,
        replies: [],

        // 计算的辅助信息
        textLength: annotationText.length,
        hasComment: annotationComment.length > 0,
        paragraphIndex: this.calculateParagraphIndex(position),
        sentenceIndex: this.calculateSentenceIndex(position)
      };

      Zotero.debug(`AnnotationManager: Processed annotation ${annotation.key}: "${annotationText.substring(0, 50)}..."`);
      return annotationData;
    } catch (error) {
      Zotero.debug(`AnnotationManager: Error processing annotation: ${error.message}`);
      return null;
    }
  }

  /**
   * 提取标注位置信息
   * @param {Object} annotation - 标注对象
   * @returns {Object} 位置信息
   */
  extractPosition(annotation) {
    try {
      const positionStr = annotation.annotationPosition || '{}';
      const position = JSON.parse(positionStr);

      return {
        pageIndex: position.pageIndex || 0,
        rects: position.rects || [],
        // 添加文本选择范围信息
        startOffset: position.startOffset || 0,
        endOffset: position.endOffset || 0,
        // 原始位置数据
        raw: position,
        // 计算的辅助信息
        hasValidRects: Array.isArray(position.rects) && position.rects.length > 0,
        boundingBox: this.calculateBoundingBox(position.rects || [])
      };
    } catch (error) {
      Zotero.debug(`AnnotationManager: Error extracting position: ${error.message}`);
      return {
        pageIndex: 0,
        rects: [],
        startOffset: 0,
        endOffset: 0,
        raw: {},
        hasValidRects: false,
        boundingBox: null
      };
    }
  }

  /**
   * 计算边界框
   * @param {Array} rects - 矩形数组
   * @returns {Object|null} 边界框
   */
  calculateBoundingBox(rects) {
    if (!Array.isArray(rects) || rects.length === 0) {
      return null;
    }

    try {
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      for (const rect of rects) {
        if (Array.isArray(rect) && rect.length >= 4) {
          const [x1, y1, x2, y2] = rect;
          minX = Math.min(minX, x1, x2);
          minY = Math.min(minY, y1, y2);
          maxX = Math.max(maxX, x1, x2);
          maxY = Math.max(maxY, y1, y2);
        }
      }

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
    } catch (error) {
      Zotero.debug(`AnnotationManager: Error calculating bounding box: ${error.message}`);
      return null;
    }
  }

  /**
   * 提取标注标签
   * @param {Object} annotation - 标注对象
   * @returns {Array} 标签数组
   */
  extractTags(annotation) {
    try {
      const tags = annotation.getTags ? annotation.getTags() : [];
      return tags.map(tag => ({
        name: tag.tag || tag.name || tag,
        type: tag.type || 0
      }));
    } catch (error) {
      Zotero.debug(`AnnotationManager: Error extracting tags: ${error.message}`);
      return [];
    }
  }

  /**
   * 提取标注上下文文本
   * @param {Object} annotation - 标注对象
   * @param {string} direction - 'before' 或 'after'
   * @returns {string} 上下文文本
   */
  extractContext(annotation, direction) {
    // TODO: 实现上下文提取逻辑
    // 这将帮助在不同版本的PDF中精确定位标注
    return '';
  }

  /**
   * 计算段落索引
   * @param {Object} position - 位置信息
   * @returns {number} 段落索引
   */
  calculateParagraphIndex(position) {
    // TODO: 实现段落索引计算
    return 0;
  }

  /**
   * 计算句子索引
   * @param {Object} position - 位置信息
   * @returns {number} 句子索引
   */
  calculateSentenceIndex(position) {
    // TODO: 实现句子索引计算
    return 0;
  }

  /**
   * 获取当前用户ID
   * @returns {string} 用户ID
   */
  getCurrentUserId() {
    // TODO: 从认证模块获取用户ID
    return 'anonymous';
  }

  /**
   * 获取当前用户名
   * @returns {string} 用户名
   */
  getCurrentUserName() {
    // TODO: 从认证模块获取用户名
    return 'Anonymous User';
  }

  /**
   * 批量上传标注到服务器
   * @param {Array} annotations - 标注数组
   * @returns {Promise<Object>} 上传结果
   */
  async uploadAnnotations(annotations) {
    try {
      Zotero.debug(`AnnotationManager: Starting upload of ${annotations.length} annotations`);

      if (!annotations || annotations.length === 0) {
        return { success: true, uploaded: 0, errors: [] };
      }

      // 过滤出有效的标注
      const validAnnotations = annotations.filter(ann =>
        ann && ann.doi && (ann.text || ann.comment)
      );

      Zotero.debug(`AnnotationManager: ${validAnnotations.length} valid annotations to upload`);

      // 分批上传（每批10个）
      const batchSize = 10;
      const results = {
        success: true,
        uploaded: 0,
        errors: [],
        total: validAnnotations.length
      };

      for (let i = 0; i < validAnnotations.length; i += batchSize) {
        const batch = validAnnotations.slice(i, i + batchSize);

        try {
          const batchResult = await this.uploadAnnotationBatch(batch);
          results.uploaded += batchResult.uploaded;
          results.errors.push(...batchResult.errors);
        } catch (batchError) {
          Zotero.debug(`AnnotationManager: Batch upload failed: ${batchError.message}`);
          results.errors.push({
            batch: i / batchSize + 1,
            error: batchError.message
          });
        }
      }

      results.success = results.errors.length === 0;
      Zotero.debug(`AnnotationManager: Upload completed. ${results.uploaded}/${results.total} successful`);

      return results;
    } catch (error) {
      Zotero.debug(`AnnotationManager: Upload failed: ${error.message}`);
      return { success: false, uploaded: 0, errors: [error.message] };
    }
  }

  /**
   * 上传单批标注
   * @param {Array} batch - 标注批次
   * @returns {Promise<Object>} 批次上传结果
   */
  async uploadAnnotationBatch(batch) {
    // TODO: 实现实际的API调用
    // 这里暂时模拟上传过程
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          uploaded: batch.length,
          errors: []
        });
      }, 100);
    });
  }

  /**
   * 从服务器获取共享标注
   * @param {string} doi - 文献DOI
   * @returns {Promise<Array>} 共享标注数组
   */
  async fetchSharedAnnotations(doi) {
    try {
      Zotero.debug(`AnnotationManager: Fetching shared annotations for DOI: ${doi}`);

      if (!doi) {
        return [];
      }

      // TODO: 实现实际的API调用
      // 这里暂时返回模拟数据
      const mockAnnotations = this.generateMockAnnotations(doi);

      Zotero.debug(`AnnotationManager: Fetched ${mockAnnotations.length} shared annotations`);
      return mockAnnotations;
    } catch (error) {
      Zotero.debug(`AnnotationManager: Fetch failed: ${error.message}`);
      return [];
    }
  }

  /**
   * 生成模拟标注数据（用于开发测试）
   * @param {string} doi - 文献DOI
   * @returns {Array} 模拟标注数组
   */
  generateMockAnnotations(doi) {
    const mockData = [
      {
        id: 'mock-1',
        doi: doi,
        type: 'highlight',
        text: '这是一个重要的研究发现，为后续研究提供了重要基础。',
        comment: '这个发现很有意思，值得深入研究。',
        color: '#ffd400',
        pageLabel: '3',
        userName: '研究者A',
        userId: 'user-1',
        dateAdded: new Date(Date.now() - 86400000).toISOString(),
        likes: 5,
        replies: [
          {
            id: 'reply-1',
            userId: 'user-2',
            userName: '研究者B',
            content: '我同意这个观点，这确实是一个突破性的发现。',
            dateAdded: new Date(Date.now() - 43200000).toISOString()
          }
        ]
      },
      {
        id: 'mock-2',
        doi: doi,
        type: 'note',
        text: '',
        comment: '这里的方法论需要进一步完善，建议参考最新的研究标准。',
        color: '#ff6666',
        pageLabel: '7',
        userName: '专家C',
        userId: 'user-3',
        dateAdded: new Date(Date.now() - 172800000).toISOString(),
        likes: 3,
        replies: []
      },
      {
        id: 'mock-3',
        doi: doi,
        type: 'highlight',
        text: '实验结果表明，该方法在处理大规模数据时具有显著优势。',
        comment: '',
        color: '#5fb3d4',
        pageLabel: '12',
        userName: '学者D',
        userId: 'user-4',
        dateAdded: new Date(Date.now() - 259200000).toISOString(),
        likes: 8,
        replies: []
      }
    ];

    return mockData;
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnnotationManager;
} else if (typeof window !== 'undefined') {
  window.AnnotationManager = AnnotationManager;
}
