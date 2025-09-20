/**
 * Researchopia DOI Annotation Display
 * 在Item Pane中显示基于DOI的共享标注
 */

const DOIAnnotationDisplay = {
  /**
   * 初始化
   */
  init() {
    this.log("Initializing DOI Annotation Display");
    this.cache = new Map(); // 缓存标注数据
    return this;
  },

  /**
   * 日志记录
   */
  log(message, level = 'info') {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] Researchopia-DOIDisplay [${level.toUpperCase()}]: ${message}`;

      if (typeof Zotero !== 'undefined' && Zotero.debug) {
        Zotero.debug(logMessage, level === 'error' ? 1 : 3);
      } else if (typeof console !== 'undefined') {
        console.log(logMessage);
      }
    } catch (e) {
      // 静默处理日志错误
    }
  },

  /**
   * 为Item Pane创建共享标注区域
   */
  createSharedAnnotationsSection(container, item) {
    try {
      if (!container || !item) {
        this.log("Missing container or item for shared annotations section", 'warn');
        return;
      }

      // 获取DOI
      const doi = this.extractDOI(item);
      if (!doi) {
        this.log("No DOI found for item, skipping shared annotations", 'info');
        return;
      }

      this.log(`Creating shared annotations section for DOI: ${doi}`);

      // 获取正确的document对象
      const doc = container.ownerDocument;
      if (!doc) {
        this.log("No document found for container", 'warn');
        return;
      }

      // 创建共享标注区域
      const sharedSection = doc.createElement('div');
      sharedSection.id = 'researchopia-shared-annotations';
      sharedSection.className = 'researchopia-section';

      // 添加标题（使用纯DOM API）
      const header = doc.createElement('div');
      header.className = 'researchopia-section-header';

      const title = doc.createElement('h3');
      title.textContent = '🌍 社区标注';
      header.appendChild(title);

      const loadingIndicator = doc.createElement('div');
      loadingIndicator.className = 'loading-indicator';
      loadingIndicator.style.display = 'none';
      loadingIndicator.textContent = '加载中...';
      header.appendChild(loadingIndicator);

      sharedSection.appendChild(header);

      // 添加内容区域（使用纯DOM API）
      const content = doc.createElement('div');
      content.className = 'shared-annotations-content';

      const placeholder = doc.createElement('p');
      placeholder.className = 'placeholder';
      placeholder.textContent = '正在加载社区标注...';
      content.appendChild(placeholder);

      sharedSection.appendChild(content);

      // 添加到容器
      container.appendChild(sharedSection);

      // 异步加载标注数据
      this.loadSharedAnnotations(doi, content);

      return sharedSection;
    } catch (error) {
      this.log(`Error creating shared annotations section: ${error.message}`, 'error');
    }
  },

  /**
   * 提取DOI
   */
  extractDOI(item) {
    try {
      if (!item) return null;

      // 尝试从DOI字段获取
      const doi = item.getField('DOI');
      if (doi) {
        return doi.replace(/^doi:/, '').trim();
      }

      // 尝试从URL字段获取
      const url = item.getField('url');
      if (url) {
        const doiMatch = url.match(/doi\.org\/(.+)$/);
        if (doiMatch) {
          return doiMatch[1];
        }
      }

      // 尝试从extra字段获取
      const extra = item.getField('extra');
      if (extra) {
        const doiMatch = extra.match(/DOI:\s*(.+)/i);
        if (doiMatch) {
          return doiMatch[1].trim();
        }
      }

      return null;
    } catch (error) {
      this.log(`Error extracting DOI: ${error.message}`, 'error');
      return null;
    }
  },

  /**
   * 加载共享标注
   */
  async loadSharedAnnotations(doi, contentContainer) {
    try {
      this.log(`Loading shared annotations for DOI: ${doi}`);

      // 确保缓存已初始化
      if (!this.cache) {
        this.cache = new Map();
      }

      // 检查缓存
      if (this.cache.has(doi)) {
        this.log("Using cached annotations");
        this.displayAnnotations(this.cache.get(doi), contentContainer);
        return;
      }

      // 显示加载状态（使用纯DOM API）
      this.clearContainer(contentContainer);
      const loadingMsg = contentContainer.ownerDocument.createElement('p');
      loadingMsg.className = 'loading';
      loadingMsg.textContent = '🔄 正在加载社区标注...';
      contentContainer.appendChild(loadingMsg);

      // 获取API基址
      const apiBase = await this.getApiBase();
      if (!apiBase) {
        this.clearContainer(contentContainer);
        const errorMsg = contentContainer.ownerDocument.createElement('p');
        errorMsg.className = 'error';
        errorMsg.textContent = '❌ 无法连接到服务器';
        contentContainer.appendChild(errorMsg);
        return;
      }

      // 请求标注数据
      const annotations = await this.fetchAnnotations(apiBase, doi);
      
      // 缓存结果
      this.cache.set(doi, annotations);

      // 显示标注
      this.displayAnnotations(annotations, contentContainer);

    } catch (error) {
      this.log(`Error loading shared annotations: ${error.message}`, 'error');
      this.clearContainer(contentContainer);
      const errorMsg = contentContainer.ownerDocument.createElement('p');
      errorMsg.className = 'error';
      errorMsg.textContent = `❌ 加载失败: ${error.message}`;
      contentContainer.appendChild(errorMsg);
    }
  },

  /**
   * 获取API基址
   */
  async getApiBase() {
    try {
      const hosts = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'https://researchopia.com'
      ];

      for (const host of hosts) {
        try {
          const response = await this.httpGet(`${host}/api/v1/health`, { timeout: 3000 });
          if (response) {
            this.log(`Found API server at: ${host}`);
            return `${host}/api/v1`;
          }
        } catch (e) {
          // 继续尝试下一个
        }
      }

      throw new Error("No API server found");
    } catch (error) {
      this.log(`Error getting API base: ${error.message}`, 'error');
      return null;
    }
  },

  /**
   * 获取标注数据
   */
  async fetchAnnotations(apiBase, doi) {
    try {
      const url = `${apiBase}/annotations/by-doi/${encodeURIComponent(doi)}`;
      const response = await this.httpGet(url, { timeout: 10000 });
      
      if (response && response.annotations) {
        this.log(`Fetched ${response.annotations.length} annotations for DOI: ${doi}`);
        return response.annotations;
      } else {
        this.log(`No annotations found for DOI: ${doi}`);
        return [];
      }
    } catch (error) {
      this.log(`Error fetching annotations: ${error.message}`, 'error');
      throw error;
    }
  },

  /**
   * 显示标注
   */
  displayAnnotations(annotations, container) {
    try {
      this.clearContainer(container);
      const doc = container.ownerDocument;

      if (!annotations || annotations.length === 0) {
        const noAnnotationsDiv = doc.createElement('div');
        noAnnotationsDiv.className = 'no-annotations';

        const mainText = doc.createElement('p');
        mainText.textContent = '📝 暂无社区标注';
        noAnnotationsDiv.appendChild(mainText);

        const hintText = doc.createElement('p');
        hintText.className = 'hint';
        hintText.textContent = '成为第一个分享标注的用户！';
        noAnnotationsDiv.appendChild(hintText);

        container.appendChild(noAnnotationsDiv);
        return;
      }

      // 按热度排序（点赞数 + 评论数）
      const sortedAnnotations = annotations.sort((a, b) => {
        const scoreA = (a.social?.likes || 0) + (a.social?.comments || 0);
        const scoreB = (b.social?.likes || 0) + (b.social?.comments || 0);
        return scoreB - scoreA;
      });

      // 只显示前5个最热门的标注
      const topAnnotations = sortedAnnotations.slice(0, 5);

      // 创建统计信息
      const summaryDiv = doc.createElement('div');
      summaryDiv.className = 'annotations-summary';
      const statsP = doc.createElement('p');
      statsP.className = 'stats';
      statsP.textContent = `共 ${annotations.length} 个标注，显示最热门的 ${topAnnotations.length} 个`;
      summaryDiv.appendChild(statsP);
      container.appendChild(summaryDiv);

      // 创建标注列表
      const listDiv = doc.createElement('div');
      listDiv.className = 'annotations-list';

      topAnnotations.forEach(annotation => {
        const annotationElement = this.createAnnotationElement(annotation, doc);
        if (annotationElement) {
          listDiv.appendChild(annotationElement);
        }
      });

      container.appendChild(listDiv);

      // 如果有更多标注，添加查看全部按钮
      if (annotations.length > 5) {
        const viewMoreDiv = doc.createElement('div');
        viewMoreDiv.className = 'view-more';

        const viewAllBtn = doc.createElement('button');
        viewAllBtn.className = 'view-all-btn';
        viewAllBtn.textContent = `查看全部 ${annotations.length} 个标注`;
        viewAllBtn.addEventListener('click', () => {
          const url = `http://localhost:3000/paper/${encodeURIComponent(annotations[0].documentId)}`;
          if (typeof Zotero !== 'undefined' && Zotero.launchURL) {
            Zotero.launchURL(url);
          } else {
            window.open(url);
          }
        });

        viewMoreDiv.appendChild(viewAllBtn);
        container.appendChild(viewMoreDiv);
      }
    } catch (error) {
      this.log(`Error displaying annotations: ${error.message}`, 'error');
      this.clearContainer(container);
      const errorMsg = doc.createElement('p');
      errorMsg.className = 'error';
      errorMsg.textContent = '❌ 显示标注时出错';
      container.appendChild(errorMsg);
    }
  },

  /**
   * 创建单个标注元素（使用纯DOM API）
   */
  createAnnotationElement(annotation, doc) {
    try {
      const annotationDiv = doc.createElement('div');
      annotationDiv.className = 'annotation-item';

      // 创建标注头部
      const headerDiv = doc.createElement('div');
      headerDiv.className = 'annotation-header';

      const userName = doc.createElement('span');
      userName.className = 'user-name';
      userName.textContent = `👤 ${annotation.user?.name || '匿名用户'}`;
      headerDiv.appendChild(userName);

      const typeSpan = doc.createElement('span');
      typeSpan.className = 'annotation-type';
      typeSpan.textContent = this.getTypeIcon(annotation.type);
      headerDiv.appendChild(typeSpan);

      annotationDiv.appendChild(headerDiv);

      // 创建标注内容
      const contentDiv = doc.createElement('div');
      contentDiv.className = 'annotation-content';

      const textP = doc.createElement('p');
      textP.className = 'annotation-text';
      const text = annotation.content?.text || annotation.text || '';
      const preview = text.length > 100 ? text.substring(0, 100) + '...' : text;
      textP.textContent = preview;
      contentDiv.appendChild(textP);

      annotationDiv.appendChild(contentDiv);

      // 创建标注底部
      const footerDiv = doc.createElement('div');
      footerDiv.className = 'annotation-footer';

      const socialStats = doc.createElement('span');
      socialStats.className = 'social-stats';
      const social = annotation.social || {};
      socialStats.textContent = `👍 ${social.likes || 0} 💬 ${social.comments || 0}`;
      footerDiv.appendChild(socialStats);

      const timestamp = doc.createElement('span');
      timestamp.className = 'timestamp';
      timestamp.textContent = this.formatTime(annotation.createdAt);
      footerDiv.appendChild(timestamp);

      annotationDiv.appendChild(footerDiv);

      return annotationDiv;
    } catch (error) {
      this.log(`Error creating annotation element: ${error.message}`, 'error');
      const errorDiv = doc.createElement('div');
      errorDiv.className = 'annotation-item error';
      errorDiv.textContent = '渲染错误';
      return errorDiv;
    }
  },

  /**
   * 渲染单个标注（已弃用，保留用于兼容性）
   */
  renderAnnotation(annotation) {
    try {
      const user = annotation.user || { name: '匿名用户' };
      const content = annotation.content || {};
      const social = annotation.social || {};
      const text = content.text || annotation.text || '';
      const preview = text.length > 100 ? text.substring(0, 100) + '...' : text;

      return `
        <div class="annotation-item">
          <div class="annotation-header">
            <span class="user-name">👤 ${this.escapeHtml(user.name)}</span>
            <span class="annotation-type">${this.getTypeIcon(annotation.type)}</span>
          </div>
          <div class="annotation-content">
            <p class="annotation-text">${this.escapeHtml(preview)}</p>
          </div>
          <div class="annotation-footer">
            <span class="social-stats">
              👍 ${social.likes || 0} 
              💬 ${social.comments || 0}
            </span>
            <span class="timestamp">${this.formatTime(annotation.createdAt)}</span>
          </div>
        </div>
      `;
    } catch (error) {
      this.log(`Error rendering annotation: ${error.message}`, 'error');
      return '<div class="annotation-item error">渲染错误</div>';
    }
  },

  /**
   * 获取类型图标
   */
  getTypeIcon(type) {
    const icons = {
      'highlight': '🖍️',
      'note': '📝',
      'image': '🖼️'
    };
    return icons[type] || '📄';
  },

  /**
   * 格式化时间
   */
  formatTime(timestamp) {
    try {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
      return `${Math.floor(diff / 86400000)}天前`;
    } catch (error) {
      return '';
    }
  },

  /**
   * HTTP GET请求
   */
  httpGet(url, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.timeout = options.timeout || 8000;
        xhr.open('GET', url, true);
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText || '{}');
              resolve(data);
            } catch (e) {
              resolve(null);
            }
          } else {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Timeout'));
        xhr.send();
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * 清空容器
   */
  clearContainer(container) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  },

  /**
   * 获取标注类型图标
   */
  getTypeIcon(type) {
    switch (type) {
      case 'highlight': return '🖍️';
      case 'note': return '📝';
      case 'comment': return '💬';
      default: return '📄';
    }
  },

  /**
   * 格式化时间
   */
  formatTime(timestamp) {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;

      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
      if (diff < 2592000000) return `${Math.floor(diff / 86400000)}天前`;

      return date.toLocaleDateString('zh-CN');
    } catch (error) {
      return '未知时间';
    }
  },

  /**
   * HTML转义
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DOIAnnotationDisplay;
}
