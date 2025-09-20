/*
  Enhanced Annotation Sharing for DOI-based Items
  Focused implementation for items with DOI identifiers
*/

Zotero.Researchopia.DOIAnnotationSharing = {
  
  /**
   * 初始化DOI标注分享功能
   */
  init() {
    this.log("Initializing DOI-based annotation sharing");
  },
  
  /**
   * 检查当前条目是否支持DOI分享
   */
  canShareItem(item) {
    if (!item) return false;
    
    // 检查是否有有效DOI
    if (!Zotero.Researchopia.DOIHandler.hasValidDOI(item)) {
      this.log(`Item "${item.getField('title')}" does not have a valid DOI`);
      return false;
    }
    
    return true;
  },
  
  /**
   * 分享当前条目的所有标注
   */
  async shareItemAnnotations(item) {
    try {
      if (!this.canShareItem(item)) {
        this.showMessage('此条目没有有效的DOI，暂不支持分享', 'warning');
        return false;
      }
      
      // 获取条目信息
      const itemInfo = Zotero.Researchopia.DOIHandler.generateItemInfo(item);
      this.log(`Sharing annotations for DOI: ${itemInfo.identifier.value}`);
      
      // 获取标注
      const annotations = await this.getItemAnnotations(item);
      if (!annotations || annotations.length === 0) {
        this.showMessage('此条目暂无标注可分享', 'info');
        return false;
      }
      
      // 转换为通用格式
      const universalAnnotations = this.convertToUniversalFormat(annotations, itemInfo);
      
      // 上传到服务器
      const result = await this.uploadAnnotations(universalAnnotations, itemInfo);
      
      if (result.success) {
        this.showMessage(`成功分享 ${annotations.length} 个标注`, 'success');
        return true;
      } else {
        this.showMessage(`分享失败: ${result.error}`, 'error');
        return false;
      }
      
    } catch (error) {
      this.log(`Error sharing annotations: ${error.message}`);
      this.showMessage(`分享时出错: ${error.message}`, 'error');
      return false;
    }
  },
  
  /**
   * 获取条目的所有标注
   */
  async getItemAnnotations(item) {
    const attachments = Zotero.Items.get(item.getAttachments());
    const annotations = [];
    
    for (const attachment of attachments) {
      if (attachment.isPDFAttachment()) {
        const attachmentAnnotations = attachment.getAnnotations();
        for (const annotationID of attachmentAnnotations) {
          const annotation = Zotero.Items.get(annotationID);
          if (annotation && annotation.isAnnotation()) {
            annotations.push(annotation);
          }
        }
      }
    }
    
    this.log(`Found ${annotations.length} annotations for item`);
    return annotations;
  },
  
  /**
   * 转换为通用标注格式
   */
  convertToUniversalFormat(annotations, itemInfo) {
    return annotations.map(annotation => {
      const annotationJSON = annotation.toJSON();
      
      return {
        id: annotation.key,
        type: this.mapAnnotationType(annotationJSON.annotationType),
        documentId: `doi_${itemInfo.identifier.value.replace(/[^a-zA-Z0-9]/g, '_')}`,
        createdAt: annotation.dateAdded,
        modifiedAt: annotation.dateModified,
        version: '1.0',
        content: {
          text: annotationJSON.annotationText || '',
          comment: annotationJSON.annotationComment || '',
          color: annotationJSON.annotationColor || '#ffff00',
          position: this.extractPosition(annotationJSON)
        },
        metadata: {
          platform: 'zotero',
          author: {
            name: 'Zotero User',
            id: 'zotero-user',
            isAuthoritative: false
          },
          tags: annotation.getTags().map(tag => tag.tag),
          visibility: 'public',
          permissions: {
            canEdit: ['zotero-user'],
            canView: ['public']
          },
          documentInfo: {
            title: itemInfo.title,
            doi: itemInfo.identifier.type === 'doi' ? itemInfo.identifier.value : null,
            url: itemInfo.identifier.type === 'doi' ? `https://doi.org/${itemInfo.identifier.value}` : null
          },
          originalData: {
            zoteroKey: annotation.key,
            parentItem: itemInfo.identifier.value,
            pageLabel: annotationJSON.annotationPageLabel
          }
        }
      };
    });
  },
  
  /**
   * 映射标注类型
   */
  mapAnnotationType(zoteroType) {
    const typeMap = {
      'highlight': 'highlight',
      'note': 'note', 
      'image': 'image',
      'ink': 'drawing'
    };
    
    return typeMap[zoteroType] || 'note';
  },
  
  /**
   * 提取位置信息
   */
  extractPosition(annotationJSON) {
    if (annotationJSON.annotationPosition) {
      try {
        const position = JSON.parse(annotationJSON.annotationPosition);
        return {
          pageIndex: position.pageIndex || 0,
          rects: position.rects || []
        };
      } catch (e) {
        this.log(`Error parsing position: ${e.message}`);
      }
    }
    
    return {
      pageIndex: 0,
      rects: []
    };
  },
  
  /**
   * 上传标注到服务器
   */
  async uploadAnnotations(annotations, itemInfo) {
    try {
      const apiUrl = Zotero.Researchopia.Config.get('apiBase') || 'http://localhost:3000/api/v1';
      
      const payload = {
        documentInfo: {
          identifier: itemInfo.identifier,
          title: itemInfo.title,
          authors: itemInfo.authors,
          publication: itemInfo.publication,
          year: itemInfo.year
        },
        annotations: annotations,
        source: 'zotero',
        version: '1.0'
      };
      
      this.log(`Uploading ${annotations.length} annotations to ${apiUrl}`);
      
      // 使用Zotero的HTTP客户端
      const request = await Zotero.HTTP.request(
        'POST',
        `${apiUrl}/annotations/doi-batch`,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );
      
      if (request.status === 200 || request.status === 201) {
        const response = JSON.parse(request.responseText);
        return { success: true, data: response };
      } else {
        return { 
          success: false, 
          error: `HTTP ${request.status}: ${request.statusText}` 
        };
      }
      
    } catch (error) {
      this.log(`Upload error: ${error.message}`);
      return { 
        success: false, 
        error: error.message 
      };
    }
  },
  
  /**
   * 显示消息给用户
   */
  showMessage(message, type = 'info') {
    const icons = {
      success: '✅',
      error: '❌', 
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const icon = icons[type] || icons.info;
    const fullMessage = `${icon} Researchopia: ${message}`;
    
    // 使用Zotero的通知系统
    if (typeof Zotero.alert === 'function') {
      Zotero.alert(null, 'Researchopia', fullMessage);
    } else {
      // 备用方案
      Components.classes["@mozilla.org/alerts-service;1"]
        .getService(Components.interfaces.nsIAlertsService)
        .showAlertNotification(null, "Researchopia", fullMessage, false, "", null);
    }
    
    this.log(`Message: ${message} (${type})`);
  },
  
  /**
   * 创建简化的分享界面
   */
  createShareDialog(item) {
    const itemInfo = Zotero.Researchopia.DOIHandler.generateItemInfo(item);
    
    const dialog = `
      <dialog>
        <h2>分享标注到研学港</h2>
        <div class="item-info">
          <h3>${itemInfo.title}</h3>
          <p><strong>DOI:</strong> ${itemInfo.identifier.value}</p>
          <p><strong>作者:</strong> ${itemInfo.authors.map(a => a.name).join(', ')}</p>
        </div>
        <div class="share-options">
          <label>
            <input type="checkbox" id="sharePublic" checked> 公开分享
          </label>
          <label>
            <input type="checkbox" id="includeComments" checked> 包含评论
          </label>
        </div>
        <div class="actions">
          <button id="shareBtn">分享标注</button>
          <button id="cancelBtn">取消</button>
        </div>
      </dialog>
    `;
    
    return dialog;
  },
  
  /**
   * 日志记录
   */
  log(message) {
    Zotero.debug(`Researchopia DOI Annotation Sharing: ${message}`);
  }
};