/**
 * 批量处理器 - Batch Processor
 * 负责批量处理标注的导入、导出和转换
 */

class BatchProcessor {
  constructor() {
    this.initialized = false;
    this.processingQueue = [];
    this.isProcessing = false;
    this.maxBatchSize = 50;
    this.processingStats = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: []
    };
    
    Researchopia.log('BatchProcessor initialized');
  }

  /**
   * 初始化批量处理器
   */
  async initialize() {
    try {
      this.initialized = true;
      Researchopia.log('BatchProcessor initialization completed');
    } catch (error) {
      Researchopia.handleError(error, 'BatchProcessor.initialize');
    }
  }

  /**
   * 批量导出用户的所有标注
   * @param {Object} options - 导出选项
   * @returns {Array} 导出的标注数组
   */
  async exportAllAnnotations(options = {}) {
    try {
      const {
        includePrivate = true,
        includeShared = true,
        format = 'universal',
        dateRange = null,
        itemTypes = ['attachment']
      } = options;

      Researchopia.log('Starting batch export of all annotations');
      
      // 重置统计信息
      this.resetStats();
      
      // 获取所有PDF附件
      const allItems = await Zotero.Items.getAll(Zotero.Libraries.userLibraryID);
      const pdfItems = allItems.filter(item => 
        item.isPDFAttachment() && itemTypes.includes('attachment')
      );

      this.processingStats.total = pdfItems.length;
      const exportedAnnotations = [];

      for (const item of pdfItems) {
        try {
          // 获取该文档的所有标注
          const annotations = await this.getAnnotationsForItem(item.id);
          
          for (const annotation of annotations) {
            // 应用过滤条件
            if (!this.shouldIncludeAnnotation(annotation, { includePrivate, includeShared, dateRange })) {
              continue;
            }

            // 转换格式
            const exportedAnnotation = await this.convertAnnotationForExport(annotation, format);
            if (exportedAnnotation) {
              exportedAnnotations.push(exportedAnnotation);
              this.processingStats.successful++;
            }
          }

          this.processingStats.processed++;
          
          // 更新进度
          this.notifyProgress();
          
        } catch (error) {
          this.processingStats.failed++;
          this.processingStats.errors.push({
            itemId: item.id,
            error: error.message
          });
          Researchopia.handleError(error, `BatchProcessor.exportAllAnnotations.item.${item.id}`);
        }
      }

      Researchopia.log(`Batch export completed: ${exportedAnnotations.length} annotations exported`);
      return exportedAnnotations;
      
    } catch (error) {
      Researchopia.handleError(error, 'BatchProcessor.exportAllAnnotations');
      throw error;
    }
  }

  /**
   * 批量导入标注到指定文档
   * @param {Array} annotations - 标注数组
   * @param {string} targetItemId - 目标文档ID
   * @param {Object} options - 导入选项
   * @returns {Object} 导入结果
   */
  async importAnnotationsBatch(annotations, targetItemId, options = {}) {
    try {
      const {
        skipDuplicates = true,
        mergeStrategy = 'keep-both',
        validateFormat = true
      } = options;

      Researchopia.log(`Starting batch import of ${annotations.length} annotations`);
      
      // 重置统计信息
      this.resetStats();
      this.processingStats.total = annotations.length;

      const importResults = [];
      const batches = this.createBatches(annotations, this.maxBatchSize);

      for (const batch of batches) {
        try {
          const batchResult = await this.processBatch(batch, targetItemId, {
            skipDuplicates,
            mergeStrategy,
            validateFormat
          });
          
          importResults.push(...batchResult);
          
          // 更新统计
          batchResult.forEach(result => {
            if (result.success) {
              this.processingStats.successful++;
            } else {
              this.processingStats.failed++;
              this.processingStats.errors.push({
                annotationId: result.id,
                error: result.error
              });
            }
          });

          this.processingStats.processed += batch.length;
          this.notifyProgress();
          
          // 批次间短暂延迟，避免过载
          await this.delay(100);
          
        } catch (error) {
          Researchopia.handleError(error, 'BatchProcessor.importAnnotationsBatch.batch');
          
          // 记录整个批次失败
          batch.forEach(annotation => {
            importResults.push({
              id: annotation.id,
              success: false,
              error: error.message
            });
            this.processingStats.failed++;
          });
        }
      }

      const summary = {
        total: this.processingStats.total,
        successful: this.processingStats.successful,
        failed: this.processingStats.failed,
        errors: this.processingStats.errors
      };

      Researchopia.log(`Batch import completed: ${summary.successful}/${summary.total} successful`);
      
      return {
        results: importResults,
        summary: summary
      };
      
    } catch (error) {
      Researchopia.handleError(error, 'BatchProcessor.importAnnotationsBatch');
      throw error;
    }
  }

  /**
   * 批量同步标注到服务器
   * @param {Array} annotations - 标注数组
   * @returns {Object} 同步结果
   */
  async syncAnnotationsBatch(annotations) {
    try {
      if (!annotations || annotations.length === 0) {
        return { results: [], summary: { total: 0, successful: 0, failed: 0 } };
      }

      Researchopia.log(`Starting batch sync of ${annotations.length} annotations`);
      
      // 重置统计信息
      this.resetStats();
      this.processingStats.total = annotations.length;

      const syncResults = [];
      const batches = this.createBatches(annotations, this.maxBatchSize);

      for (const batch of batches) {
        try {
          // 使用同步管理器进行批量同步
          const batchResult = await Researchopia.modules.syncManager?.syncAnnotationsBatch(batch);
          
          if (batchResult && batchResult.results) {
            syncResults.push(...batchResult.results);
            
            // 更新统计
            batchResult.results.forEach(result => {
              if (result.success) {
                this.processingStats.successful++;
              } else {
                this.processingStats.failed++;
                this.processingStats.errors.push({
                  annotationId: result.id,
                  error: result.error
                });
              }
            });
          }

          this.processingStats.processed += batch.length;
          this.notifyProgress();
          
          // 批次间延迟
          await this.delay(200);
          
        } catch (error) {
          Researchopia.handleError(error, 'BatchProcessor.syncAnnotationsBatch.batch');
          
          // 记录整个批次失败
          batch.forEach(annotation => {
            syncResults.push({
              id: annotation.id,
              success: false,
              error: error.message
            });
            this.processingStats.failed++;
          });
        }
      }

      const summary = {
        total: this.processingStats.total,
        successful: this.processingStats.successful,
        failed: this.processingStats.failed,
        errors: this.processingStats.errors
      };

      Researchopia.log(`Batch sync completed: ${summary.successful}/${summary.total} successful`);
      
      return {
        results: syncResults,
        summary: summary
      };
      
    } catch (error) {
      Researchopia.handleError(error, 'BatchProcessor.syncAnnotationsBatch');
      throw error;
    }
  }

  /**
   * 处理单个批次
   * @param {Array} batch - 批次数据
   * @param {string} targetItemId - 目标文档ID
   * @param {Object} options - 处理选项
   * @returns {Array} 处理结果
   */
  async processBatch(batch, targetItemId, options) {
    const results = [];
    
    for (const annotation of batch) {
      try {
        // 验证格式
        if (options.validateFormat && !this.validateAnnotationFormat(annotation)) {
          results.push({
            id: annotation.id,
            success: false,
            error: 'Invalid annotation format'
          });
          continue;
        }

        // 检查重复
        if (options.skipDuplicates && await this.isDuplicateAnnotation(annotation, targetItemId)) {
          results.push({
            id: annotation.id,
            success: false,
            error: 'Duplicate annotation skipped'
          });
          continue;
        }

        // 导入标注
        const importResult = await Researchopia.modules.annotationManager?.importAnnotations(
          [annotation], 
          targetItemId
        );
        
        if (importResult && importResult.length > 0) {
          results.push({
            id: annotation.id,
            success: importResult[0].success,
            error: importResult[0].error,
            zoteroId: importResult[0].zoteroId
          });
        } else {
          results.push({
            id: annotation.id,
            success: false,
            error: 'Import failed'
          });
        }
        
      } catch (error) {
        results.push({
          id: annotation.id,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  // 辅助方法
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  async getAnnotationsForItem(itemId) {
    return Researchopia.modules.annotationManager?.getAnnotationsForItem(itemId) || [];
  }

  shouldIncludeAnnotation(annotation, filters) {
    // 应用各种过滤条件
    if (!filters.includePrivate && annotation.metadata?.visibility === 'private') {
      return false;
    }
    
    if (!filters.includeShared && annotation.metadata?.visibility !== 'private') {
      return false;
    }
    
    if (filters.dateRange) {
      const annotationDate = new Date(annotation.createdAt);
      if (annotationDate < filters.dateRange.start || annotationDate > filters.dateRange.end) {
        return false;
      }
    }
    
    return true;
  }

  async convertAnnotationForExport(annotation, format) {
    switch (format) {
      case 'universal':
        return annotation; // 已经是通用格式
      case 'zotero':
        return Researchopia.modules.annotationManager?.converter?.fromUniversal(annotation);
      default:
        return annotation;
    }
  }

  validateAnnotationFormat(annotation) {
    return !!(annotation.id && annotation.type && annotation.documentId);
  }

  async isDuplicateAnnotation(annotation, targetItemId) {
    // 简单的重复检测逻辑
    const existingAnnotations = await this.getAnnotationsForItem(targetItemId);
    return existingAnnotations.some(existing => 
      existing.content?.text === annotation.content?.text &&
      existing.content?.position?.page === annotation.content?.position?.page
    );
  }

  resetStats() {
    this.processingStats = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: []
    };
  }

  notifyProgress() {
    const progress = {
      total: this.processingStats.total,
      processed: this.processingStats.processed,
      successful: this.processingStats.successful,
      failed: this.processingStats.failed,
      percentage: this.processingStats.total > 0 ? 
        Math.round((this.processingStats.processed / this.processingStats.total) * 100) : 0
    };

    // 通知UI更新进度
    if (Researchopia.modules.uiManager) {
      Researchopia.modules.uiManager.updateBatchProgress?.(progress);
    }

    Researchopia.log(`Batch progress: ${progress.processed}/${progress.total} (${progress.percentage}%)`);
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getProcessingStats() {
    return { ...this.processingStats };
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.processingQueue = [];
    this.isProcessing = false;
    this.resetStats();
    this.initialized = false;
    
    Researchopia.log('BatchProcessor cleaned up');
  }
}
