/**
 * 段落级标注追踪器 - Paragraph Tracker
 * 实现类似微信读书的段落/句子级标注共享功能
 */

class ParagraphTracker {
  constructor() {
    this.initialized = false;
    this.documentCache = new Map(); // documentId -> documentData
    this.paragraphAnnotations = new Map(); // documentId -> Map<paragraphId, annotations[]>
    this.sentenceAnnotations = new Map(); // documentId -> Map<sentenceId, annotations[]>
    this.textHashes = new Map(); // documentId -> Map<textHash, position>
    this.observers = new Map(); // documentId -> MutationObserver
    
    // 配置参数
    this.config = {
      minParagraphLength: 50, // 最小段落长度
      maxSentenceLength: 200, // 最大句子长度
      hashLength: 16, // 文本哈希长度
      trackingGranularity: 'both' // 'paragraph', 'sentence', 'both'
    };
    
    Researchopia.log('ParagraphTracker initialized');
  }

  /**
   * 初始化段落追踪器
   */
  async initialize() {
    try {
      this.initialized = true;
      
      // 监听文档变化
      this.setupDocumentObserver();
      
      // 监听阅读器事件
      this.setupReaderEventListeners();
      
      Researchopia.log('ParagraphTracker initialization completed');
    } catch (error) {
      Researchopia.handleError(error, 'ParagraphTracker.initialize');
    }
  }

  /**
   * 设置文档观察器
   */
  setupDocumentObserver() {
    try {
      // 监听Zotero阅读器的变化
      const readerWindows = Zotero.Reader.getByTabID ? Zotero.Reader._readers : [];
      
      for (const reader of readerWindows) {
        this.observeReaderDocument(reader);
      }
      
      // 监听新阅读器的打开
      Zotero.Reader.onReaderOpen = (reader) => {
        this.observeReaderDocument(reader);
      };
      
    } catch (error) {
      Researchopia.handleError(error, 'ParagraphTracker.setupDocumentObserver');
    }
  }

  /**
   * 观察阅读器文档
   * @param {Object} reader - Zotero阅读器实例
   */
  observeReaderDocument(reader) {
    try {
      if (!reader || !reader._iframeWindow) return;
      
      const document = reader._iframeWindow.document;
      const documentId = this.getDocumentId(reader);
      
      if (!documentId) return;
      
      // 创建文档缓存
      this.documentCache.set(documentId, {
        reader: reader,
        document: document,
        lastUpdate: Date.now(),
        paragraphs: new Map(),
        sentences: new Map()
      });
      
      // 初始解析文档结构
      this.parseDocumentStructure(documentId);
      
      // 设置变化观察器
      const observer = new MutationObserver((mutations) => {
        this.handleDocumentMutation(documentId, mutations);
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
      
      this.observers.set(documentId, observer);
      
      Researchopia.log(`Document observer set up for: ${documentId}`);
    } catch (error) {
      Researchopia.handleError(error, 'ParagraphTracker.observeReaderDocument');
    }
  }

  /**
   * 解析文档结构
   * @param {string} documentId - 文档ID
   */
  parseDocumentStructure(documentId) {
    try {
      const docData = this.documentCache.get(documentId);
      if (!docData) return;
      
      const document = docData.document;
      
      // 查找文本内容元素
      const textElements = this.findTextElements(document);
      
      let paragraphIndex = 0;
      let sentenceIndex = 0;
      
      for (const element of textElements) {
        const text = element.textContent.trim();
        if (text.length < this.config.minParagraphLength) continue;
        
        // 处理段落
        const paragraphId = `p_${paragraphIndex++}`;
        const paragraphHash = this.generateTextHash(text);
        
        const paragraphData = {
          id: paragraphId,
          element: element,
          text: text,
          hash: paragraphHash,
          position: this.getElementPosition(element),
          sentences: []
        };
        
        // 分割句子
        const sentences = this.splitIntoSentences(text);
        let sentenceOffset = 0;
        
        for (const sentenceText of sentences) {
          if (sentenceText.trim().length === 0) continue;
          
          const sentenceId = `s_${sentenceIndex++}`;
          const sentenceHash = this.generateTextHash(sentenceText);
          
          const sentenceData = {
            id: sentenceId,
            paragraphId: paragraphId,
            text: sentenceText.trim(),
            hash: sentenceHash,
            offset: sentenceOffset,
            length: sentenceText.length
          };
          
          paragraphData.sentences.push(sentenceData);
          docData.sentences.set(sentenceId, sentenceData);
          
          sentenceOffset += sentenceText.length;
        }
        
        docData.paragraphs.set(paragraphId, paragraphData);
      }
      
      Researchopia.log(`Parsed document structure: ${docData.paragraphs.size} paragraphs, ${docData.sentences.size} sentences`);
    } catch (error) {
      Researchopia.handleError(error, 'ParagraphTracker.parseDocumentStructure');
    }
  }

  /**
   * 查找文本元素
   * @param {Document} document - 文档对象
   * @returns {Array} 文本元素数组
   */
  findTextElements(document) {
    try {
      // 常见的PDF文本元素选择器
      const selectors = [
        '.textLayer div',
        '.textLayer span',
        '[data-canvas-width] div',
        '.page div[style*="position"]',
        'div[dir="ltr"]'
      ];
      
      const elements = [];
      
      for (const selector of selectors) {
        const found = document.querySelectorAll(selector);
        if (found.length > 0) {
          elements.push(...Array.from(found));
          break; // 找到一种类型就够了
        }
      }
      
      // 过滤和排序
      return elements
        .filter(el => el.textContent.trim().length > 10)
        .sort((a, b) => {
          const rectA = a.getBoundingClientRect();
          const rectB = b.getBoundingClientRect();
          
          // 按页面位置排序（从上到下，从左到右）
          if (Math.abs(rectA.top - rectB.top) > 10) {
            return rectA.top - rectB.top;
          }
          return rectA.left - rectB.left;
        });
    } catch (error) {
      Researchopia.handleError(error, 'ParagraphTracker.findTextElements');
      return [];
    }
  }

  /**
   * 分割句子
   * @param {string} text - 文本内容
   * @returns {Array} 句子数组
   */
  splitIntoSentences(text) {
    try {
      // 简单的句子分割规则
      const sentences = text.split(/[.!?。！？]+\s+/)
        .filter(s => s.trim().length > 0)
        .map(s => s.trim());
      
      return sentences;
    } catch (error) {
      Researchopia.handleError(error, 'ParagraphTracker.splitIntoSentences');
      return [text];
    }
  }

  /**
   * 获取元素位置信息
   * @param {Element} element - DOM元素
   * @returns {Object} 位置信息
   */
  getElementPosition(element) {
    try {
      const rect = element.getBoundingClientRect();
      
      return {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        page: this.getPageNumber(element)
      };
    } catch (error) {
      Researchopia.handleError(error, 'ParagraphTracker.getElementPosition');
      return { top: 0, left: 0, width: 0, height: 0, page: 1 };
    }
  }

  /**
   * 获取页码
   * @param {Element} element - DOM元素
   * @returns {number} 页码
   */
  getPageNumber(element) {
    try {
      // 查找父级页面元素
      let current = element;
      while (current && current.parentElement) {
        if (current.dataset && current.dataset.pageNumber) {
          return parseInt(current.dataset.pageNumber);
        }
        if (current.className && current.className.includes('page')) {
          const match = current.className.match(/page[^\d]*(\d+)/);
          if (match) {
            return parseInt(match[1]);
          }
        }
        current = current.parentElement;
      }
      
      return 1; // 默认第一页
    } catch (error) {
      Researchopia.handleError(error, 'ParagraphTracker.getPageNumber');
      return 1;
    }
  }

  /**
   * 生成文本哈希
   * @param {string} text - 文本内容
   * @returns {string} 哈希值
   */
  generateTextHash(text) {
    try {
      // 简单的哈希算法
      let hash = 0;
      const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();
      
      for (let i = 0; i < normalizedText.length; i++) {
        const char = normalizedText.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
      }
      
      return Math.abs(hash).toString(16).substring(0, this.config.hashLength);
    } catch (error) {
      Researchopia.handleError(error, 'ParagraphTracker.generateTextHash');
      return 'unknown';
    }
  }

  /**
   * 获取文档ID
   * @param {Object} reader - 阅读器实例
   * @returns {string} 文档ID
   */
  getDocumentId(reader) {
    try {
      if (reader && reader._item) {
        return reader._item.key || reader._item.id;
      }
      return null;
    } catch (error) {
      Researchopia.handleError(error, 'ParagraphTracker.getDocumentId');
      return null;
    }
  }

  /**
   * 处理文档变化
   * @param {string} documentId - 文档ID
   * @param {Array} mutations - 变化列表
   */
  handleDocumentMutation(documentId, mutations) {
    try {
      // 检查是否需要重新解析文档结构
      let needsReparse = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          needsReparse = true;
          break;
        }
      }
      
      if (needsReparse) {
        // 延迟重新解析，避免频繁操作
        setTimeout(() => {
          this.parseDocumentStructure(documentId);
        }, 500);
      }
    } catch (error) {
      Researchopia.handleError(error, 'ParagraphTracker.handleDocumentMutation');
    }
  }

  /**
   * 设置阅读器事件监听器
   */
  setupReaderEventListeners() {
    try {
      // 监听滚动事件，用于实时显示标注
      document.addEventListener('scroll', (event) => {
        this.handleScroll(event);
      }, { passive: true });
      
      // 监听选择事件
      document.addEventListener('selectionchange', (event) => {
        this.handleSelection(event);
      });
      
    } catch (error) {
      Researchopia.handleError(error, 'ParagraphTracker.setupReaderEventListeners');
    }
  }

  /**
   * 处理滚动事件
   * @param {Event} event - 滚动事件
   */
  handleScroll(event) {
    try {
      // 获取当前可见的段落
      const visibleParagraphs = this.getVisibleParagraphs();
      
      // 显示相关标注
      this.showRelevantAnnotations(visibleParagraphs);
    } catch (error) {
      Researchopia.handleError(error, 'ParagraphTracker.handleScroll');
    }
  }

  /**
   * 处理文本选择事件
   * @param {Event} event - 选择事件
   */
  handleSelection(event) {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      const range = selection.getRangeAt(0);
      const selectedText = range.toString().trim();
      
      if (selectedText.length > 0) {
        // 查找选中文本对应的段落/句子
        const context = this.findTextContext(selectedText, range);
        if (context) {
          // 显示相关标注
          this.showContextAnnotations(context);
        }
      }
    } catch (error) {
      Researchopia.handleError(error, 'ParagraphTracker.handleSelection');
    }
  }

  /**
   * 获取可见段落
   * @returns {Array} 可见段落列表
   */
  getVisibleParagraphs() {
    try {
      const visibleParagraphs = [];
      
      for (const [documentId, docData] of this.documentCache) {
        for (const [paragraphId, paragraphData] of docData.paragraphs) {
          if (this.isElementVisible(paragraphData.element)) {
            visibleParagraphs.push({
              documentId,
              paragraphId,
              paragraphData
            });
          }
        }
      }
      
      return visibleParagraphs;
    } catch (error) {
      Researchopia.handleError(error, 'ParagraphTracker.getVisibleParagraphs');
      return [];
    }
  }

  /**
   * 检查元素是否可见
   * @param {Element} element - DOM元素
   * @returns {boolean} 是否可见
   */
  isElementVisible(element) {
    try {
      if (!element) return false;
      
      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      
      return (
        rect.top < windowHeight &&
        rect.bottom > 0 &&
        rect.left < windowWidth &&
        rect.right > 0
      );
    } catch (error) {
      Researchopia.handleError(error, 'ParagraphTracker.isElementVisible');
      return false;
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 清理观察器
    for (const [documentId, observer] of this.observers) {
      observer.disconnect();
    }
    
    // 清理缓存
    this.documentCache.clear();
    this.paragraphAnnotations.clear();
    this.sentenceAnnotations.clear();
    this.textHashes.clear();
    this.observers.clear();
    
    this.initialized = false;
    Researchopia.log('ParagraphTracker cleaned up');
  }
}
