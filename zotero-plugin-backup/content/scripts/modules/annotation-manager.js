/**
 * 标注管理器 - Annotation Manager
 * 负责Zotero标注的提取、转换和管理
 */

class AnnotationManager {
  constructor() {
    this.initialized = false;
    this.annotationCache = new Map();
    this.pendingSync = new Set();
    this.converter = new ZoteroAnnotationConverter();
    
    Researchopia.log('AnnotationManager initialized');
  }

  /**
   * 初始化标注管理器
   */
  async initialize() {
    try {
      this.initialized = true;
      await this.loadExistingAnnotations();
      Researchopia.log('AnnotationManager initialization completed');
    } catch (error) {
      Researchopia.handleError(error, 'AnnotationManager.initialize');
    }
  }

  /**
   * 处理标注变化事件
   * @param {string} event - 事件类型 (add, modify, delete)
   * @param {Array} ids - 标注ID数组
   * @param {Object} extraData - 额外数据
   */
  async handleAnnotationChange(event, ids, extraData) {
    try {
      Researchopia.log(`Handling annotation change: ${event}, IDs: ${ids.join(', ')}`);
      
      for (const id of ids) {
        switch (event) {
          case 'add':
            await this.handleAnnotationAdd(id);
            break;
          case 'modify':
            await this.handleAnnotationModify(id);
            break;
          case 'delete':
            await this.handleAnnotationDelete(id);
            break;
        }
      }
    } catch (error) {
      Researchopia.handleError(error, 'AnnotationManager.handleAnnotationChange');
    }
  }

  /**
   * 处理新增标注
   * @param {string} annotationId - 标注ID
   */
  async handleAnnotationAdd(annotationId) {
    try {
      const annotation = await Zotero.Annotations.getAsync(annotationId);
      if (!annotation) return;

      // 转换为通用格式
      const universalAnnotation = await this.converter.toUniversal(annotation);
      
      // 缓存标注
      this.annotationCache.set(annotationId, universalAnnotation);
      
      // 标记为待同步
      this.pendingSync.add(annotationId);
      
      // 触发同步
      if (Researchopia.modules.syncManager) {
        await Researchopia.modules.syncManager.syncAnnotation(universalAnnotation);
      }
      
      // 更新UI
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.updateAnnotationDisplay();
      }
      
      Researchopia.log(`Annotation added: ${annotationId}`);
    } catch (error) {
      Researchopia.handleError(error, 'AnnotationManager.handleAnnotationAdd');
    }
  }

  /**
   * 处理标注修改
   * @param {string} annotationId - 标注ID
   */
  async handleAnnotationModify(annotationId) {
    try {
      const annotation = await Zotero.Annotations.getAsync(annotationId);
      if (!annotation) return;

      // 转换为通用格式
      const universalAnnotation = await this.converter.toUniversal(annotation);
      
      // 更新缓存
      this.annotationCache.set(annotationId, universalAnnotation);
      
      // 标记为待同步
      this.pendingSync.add(annotationId);
      
      // 触发同步
      if (Researchopia.modules.syncManager) {
        await Researchopia.modules.syncManager.syncAnnotation(universalAnnotation);
      }
      
      // 更新UI
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.updateAnnotationDisplay();
      }
      
      Researchopia.log(`Annotation modified: ${annotationId}`);
    } catch (error) {
      Researchopia.handleError(error, 'AnnotationManager.handleAnnotationModify');
    }
  }

  /**
   * 处理标注删除
   * @param {string} annotationId - 标注ID
   */
  async handleAnnotationDelete(annotationId) {
    try {
      // 从缓存中移除
      this.annotationCache.delete(annotationId);
      this.pendingSync.delete(annotationId);
      
      // 同步删除到服务器
      if (Researchopia.modules.syncManager) {
        await Researchopia.modules.syncManager.deleteAnnotation(annotationId);
      }
      
      // 更新UI
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.updateAnnotationDisplay();
      }
      
      Researchopia.log(`Annotation deleted: ${annotationId}`);
    } catch (error) {
      Researchopia.handleError(error, 'AnnotationManager.handleAnnotationDelete');
    }
  }

  /**
   * 获取指定文档的所有标注
   * @param {string} itemId - 文档ID
   * @returns {Array} 标注数组
   */
  async getAnnotationsForItem(itemId) {
    try {
      const item = await Zotero.Items.getAsync(itemId);
      if (!item || !item.isPDFAttachment()) {
        return [];
      }

      // 获取Zotero标注
      const zoteroAnnotations = item.getAnnotations();
      const universalAnnotations = [];

      for (const annotation of zoteroAnnotations) {
        try {
          const universal = await this.converter.toUniversal(annotation);
          universalAnnotations.push(universal);
        } catch (error) {
          Researchopia.handleError(error, 'AnnotationManager.getAnnotationsForItem.convert');
        }
      }

      return universalAnnotations;
    } catch (error) {
      Researchopia.handleError(error, 'AnnotationManager.getAnnotationsForItem');
      return [];
    }
  }

  /**
   * 批量导入标注
   * @param {Array} annotations - 通用格式标注数组
   * @param {string} itemId - 目标文档ID
   */
  async importAnnotations(annotations, itemId) {
    try {
      const item = await Zotero.Items.getAsync(itemId);
      if (!item || !item.isPDFAttachment()) {
        throw new Error('Invalid PDF attachment item');
      }

      const importResults = [];

      for (const annotation of annotations) {
        try {
          // 转换为Zotero格式
          const zoteroAnnotation = await this.converter.fromUniversal(annotation);
          
          // 创建Zotero标注对象
          const newAnnotation = new Zotero.Item('annotation');
          newAnnotation.parentID = item.id;
          
          // 设置标注属性
          newAnnotation.annotationType = zoteroAnnotation.type;
          newAnnotation.annotationText = zoteroAnnotation.text || '';
          newAnnotation.annotationComment = zoteroAnnotation.comment || '';
          newAnnotation.annotationColor = zoteroAnnotation.color || '#ffd400';
          newAnnotation.annotationPosition = JSON.stringify(zoteroAnnotation.position);
          
          // 保存标注
          await newAnnotation.saveTx();
          
          importResults.push({
            id: annotation.id,
            success: true,
            zoteroId: newAnnotation.id
          });
          
        } catch (error) {
          importResults.push({
            id: annotation.id,
            success: false,
            error: error.message
          });
          Researchopia.handleError(error, 'AnnotationManager.importAnnotations.single');
        }
      }

      Researchopia.log(`Imported ${importResults.filter(r => r.success).length}/${annotations.length} annotations`);
      return importResults;
      
    } catch (error) {
      Researchopia.handleError(error, 'AnnotationManager.importAnnotations');
      return [];
    }
  }

  /**
   * 加载现有标注到缓存
   */
  async loadExistingAnnotations() {
    try {
      // 获取所有PDF附件
      const items = await Zotero.Items.getAll(Zotero.Libraries.userLibraryID);
      const pdfItems = items.filter(item => item.isPDFAttachment());

      for (const item of pdfItems) {
        const annotations = await this.getAnnotationsForItem(item.id);
        for (const annotation of annotations) {
          this.annotationCache.set(annotation.id, annotation);
        }
      }

      Researchopia.log(`Loaded ${this.annotationCache.size} existing annotations`);
    } catch (error) {
      Researchopia.handleError(error, 'AnnotationManager.loadExistingAnnotations');
    }
  }

  /**
   * 获取待同步的标注
   * @returns {Array} 待同步标注数组
   */
  getPendingSyncAnnotations() {
    const pending = [];
    for (const id of this.pendingSync) {
      const annotation = this.annotationCache.get(id);
      if (annotation) {
        pending.push(annotation);
      }
    }
    return pending;
  }

  /**
   * 清除同步标记
   * @param {string} annotationId - 标注ID
   */
  clearSyncPending(annotationId) {
    this.pendingSync.delete(annotationId);
  }

  /**
   * 获取缓存的标注
   * @param {string} annotationId - 标注ID
   * @returns {Object|null} 标注对象
   */
  getCachedAnnotation(annotationId) {
    return this.annotationCache.get(annotationId) || null;
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.annotationCache.clear();
    this.pendingSync.clear();
    this.initialized = false;
    Researchopia.log('AnnotationManager cleaned up');
  }
}

/**
 * Zotero标注转换器
 * 实现Zotero格式与UniversalAnnotation格式的相互转换
 */
class ZoteroAnnotationConverter {
  constructor() {
    this.platform = 'zotero';
    this.version = '1.0.0';
  }

  /**
   * 将Zotero标注转换为通用格式
   * @param {Object} zoteroAnnotation - Zotero标注对象
   * @returns {Object} UniversalAnnotation格式
   */
  async toUniversal(zoteroAnnotation) {
    try {
      const parentItem = await zoteroAnnotation.parentItem;
      const doi = parentItem ? this.extractDOI(parentItem) : null;

      // 获取当前用户信息
      const currentUser = Researchopia.modules.authManager?.getCurrentUser();

      // 解析详细位置信息
      const positionData = await this.parseDetailedPosition(zoteroAnnotation);

      // 提取页面信息
      const pageInfo = await this.extractPageInfo(zoteroAnnotation, parentItem);

      return {
        id: zoteroAnnotation.key,
        type: this.mapAnnotationType(zoteroAnnotation.annotationType),
        documentId: doi || parentItem?.key || 'unknown',
        createdAt: zoteroAnnotation.dateAdded.toISOString(),
        modifiedAt: zoteroAnnotation.dateModified.toISOString(),
        version: this.version,

        content: {
          text: zoteroAnnotation.annotationText || undefined,
          comment: zoteroAnnotation.annotationComment || undefined,
          color: zoteroAnnotation.annotationColor || '#ffd400',
          position: positionData
        },

        metadata: {
          platform: this.platform,
          author: {
            id: currentUser?.id || 'anonymous',
            name: currentUser?.name || 'Anonymous User',
            email: currentUser?.email || undefined,
            platform: this.platform
          },
          tags: zoteroAnnotation.getTags().map(tag => tag.tag),
          visibility: 'private', // 默认私有，可通过UI修改
          documentInfo: {
            title: parentItem?.getDisplayTitle() || 'Unknown',
            doi: doi,
            url: parentItem?.getField('url') || undefined,
            authors: this.extractAuthors(parentItem),
            year: parentItem?.getField('date')?.match(/\d{4}/)?.[0] || undefined,
            journal: parentItem?.getField('publicationTitle') || undefined
          },
          originalData: {
            id: zoteroAnnotation.id,
            key: zoteroAnnotation.key,
            sortIndex: zoteroAnnotation.annotationSortIndex,
            pageLabel: zoteroAnnotation.annotationPageLabel,
            pageInfo: pageInfo
          }
        }
      };
    } catch (error) {
      Researchopia.handleError(error, 'ZoteroAnnotationConverter.toUniversal');
      throw error;
    }
  }

  /**
   * 将通用格式转换为Zotero标注
   * @param {Object} universalAnnotation - UniversalAnnotation格式
   * @returns {Object} Zotero标注格式
   */
  async fromUniversal(universalAnnotation) {
    try {
      return {
        type: universalAnnotation.type,
        text: universalAnnotation.content?.text || '',
        comment: universalAnnotation.content?.comment || '',
        color: universalAnnotation.content?.color || '#ffd400',
        position: universalAnnotation.content?.position || {},
        tags: universalAnnotation.metadata?.tags || [],
        sortIndex: universalAnnotation.metadata?.originalData?.sortIndex || '00000',
        pageLabel: universalAnnotation.metadata?.originalData?.pageLabel || ''
      };
    } catch (error) {
      Researchopia.handleError(error, 'ZoteroAnnotationConverter.fromUniversal');
      throw error;
    }
  }

  /**
   * 映射标注类型
   * @param {string} zoteroType - Zotero标注类型
   * @returns {string} 通用标注类型
   */
  mapAnnotationType(zoteroType) {
    const typeMap = {
      'highlight': 'highlight',
      'underline': 'underline',
      'note': 'note',
      'image': 'image',
      'ink': 'ink'
    };
    return typeMap[zoteroType] || 'highlight';
  }

  /**
   * 解析详细位置信息
   * @param {Object} zoteroAnnotation - Zotero标注对象
   * @returns {Object} 详细位置信息
   */
  async parseDetailedPosition(zoteroAnnotation) {
    try {
      const positionJson = zoteroAnnotation.annotationPosition;
      if (!positionJson) return {};

      const position = JSON.parse(positionJson);

      // 基础位置信息
      const positionData = {
        documentType: 'pdf',
        pdf: {
          pageIndex: position.pageIndex || 0,
          rects: position.rects || [],
          paths: position.paths || [],
          rotation: position.rotation || 0
        }
      };

      // 如果有文本选择，添加文本位置信息
      if (zoteroAnnotation.annotationText) {
        positionData.text = {
          startOffset: position.startOffset || 0,
          endOffset: position.endOffset || 0,
          context: this.extractTextContext(zoteroAnnotation.annotationText)
        };
      }

      // 添加段落级定位信息（用于实现类似微信读书的功能）
      positionData.paragraph = await this.extractParagraphInfo(zoteroAnnotation, position);

      return positionData;
    } catch (error) {
      Researchopia.handleError(error, 'ZoteroAnnotationConverter.parseDetailedPosition');
      return {};
    }
  }

  /**
   * 提取页面信息
   * @param {Object} zoteroAnnotation - Zotero标注对象
   * @param {Object} parentItem - 父文档对象
   * @returns {Object} 页面信息
   */
  async extractPageInfo(zoteroAnnotation, parentItem) {
    try {
      const pageInfo = {
        pageNumber: 0,
        pageLabel: zoteroAnnotation.annotationPageLabel || '',
        totalPages: 0
      };

      // 尝试从位置信息获取页码
      const positionJson = zoteroAnnotation.annotationPosition;
      if (positionJson) {
        const position = JSON.parse(positionJson);
        pageInfo.pageNumber = (position.pageIndex || 0) + 1; // 转换为1基索引
      }

      // 尝试获取文档总页数
      if (parentItem && parentItem.isPDFAttachment()) {
        try {
          const pdfPath = await parentItem.getFilePathAsync();
          if (pdfPath) {
            // 这里可以添加PDF页数检测逻辑
            // 由于Zotero API限制，暂时使用估算值
            pageInfo.totalPages = await this.estimatePDFPages(parentItem);
          }
        } catch (error) {
          // 忽略文件访问错误
        }
      }

      return pageInfo;
    } catch (error) {
      Researchopia.handleError(error, 'ZoteroAnnotationConverter.extractPageInfo');
      return { pageNumber: 0, pageLabel: '', totalPages: 0 };
    }
  }

  /**
   * 提取文本上下文
   * @param {string} text - 标注文本
   * @returns {string} 上下文信息
   */
  extractTextContext(text) {
    try {
      // 简单的上下文提取，实际可以更复杂
      const words = text.split(/\s+/);
      if (words.length > 10) {
        return words.slice(0, 5).join(' ') + '...' + words.slice(-5).join(' ');
      }
      return text;
    } catch (error) {
      return text;
    }
  }

  /**
   * 提取段落信息（用于段落级标注追踪）
   * @param {Object} zoteroAnnotation - Zotero标注对象
   * @param {Object} position - 位置信息
   * @returns {Object} 段落信息
   */
  async extractParagraphInfo(zoteroAnnotation, position) {
    try {
      const paragraphInfo = {
        id: null,
        startChar: 0,
        endChar: 0,
        text: zoteroAnnotation.annotationText || '',
        hash: null
      };

      // 生成段落哈希用于唯一标识
      if (paragraphInfo.text) {
        paragraphInfo.hash = await this.generateTextHash(paragraphInfo.text);
      }

      // 尝试从位置信息推断段落边界
      if (position.rects && position.rects.length > 0) {
        const firstRect = position.rects[0];
        const lastRect = position.rects[position.rects.length - 1];

        paragraphInfo.startChar = firstRect[0] || 0;
        paragraphInfo.endChar = lastRect[2] || 0;

        // 生成段落ID（基于页面和位置）
        paragraphInfo.id = `p_${position.pageIndex || 0}_${Math.round(firstRect[1] || 0)}`;
      }

      return paragraphInfo;
    } catch (error) {
      Researchopia.handleError(error, 'ZoteroAnnotationConverter.extractParagraphInfo');
      return { id: null, startChar: 0, endChar: 0, text: '', hash: null };
    }
  }

  /**
   * 生成文本哈希
   * @param {string} text - 文本内容
   * @returns {string} 哈希值
   */
  async generateTextHash(text) {
    try {
      // 简单的哈希算法，实际可以使用更强的算法
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
      }
      return Math.abs(hash).toString(36);
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 估算PDF页数
   * @param {Object} pdfItem - PDF条目
   * @returns {number} 估算页数
   */
  async estimatePDFPages(pdfItem) {
    try {
      // 由于Zotero API限制，这里使用简单的估算
      // 实际实现可能需要调用PDF解析库
      const fileSize = pdfItem.attachmentFileSize || 0;

      // 粗略估算：平均每页50KB
      const estimatedPages = Math.max(1, Math.round(fileSize / (50 * 1024)));

      return Math.min(estimatedPages, 1000); // 限制最大页数
    } catch (error) {
      return 1;
    }
  }

  /**
   * 提取作者信息
   * @param {Object} item - Zotero条目
   * @returns {Array} 作者数组
   */
  extractAuthors(item) {
    try {
      if (!item) return [];

      const creators = item.getCreators();
      return creators.map(creator => ({
        firstName: creator.firstName || '',
        lastName: creator.lastName || '',
        name: creator.firstName ? `${creator.firstName} ${creator.lastName}` : creator.lastName,
        creatorType: creator.creatorType || 'author'
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * 提取DOI
   * @param {Object} item - Zotero条目
   * @returns {string|null} DOI字符串
   */
  extractDOI(item) {
    try {
      const doi = item.getField('DOI');
      if (doi) {
        return doi.replace(/^doi:/, '').trim();
      }

      const url = item.getField('url');
      if (url) {
        const doiMatch = url.match(/doi\.org\/(.+)$/);
        if (doiMatch) {
          return doiMatch[1];
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}
