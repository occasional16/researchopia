/**
 * 精细化标注追踪系统
 * 实现段落级和句子级的标注定位，类似微信读书的精确追踪功能
 */

export interface TextPosition {
  page: number;
  paragraph: number;
  sentence?: number;
  startOffset: number;
  endOffset: number;
  textContent: string;
  context: string; // 上下文文本，用于更准确的匹配
}

export interface PreciseAnnotation {
  id: string;
  originalText: string;
  comment?: string;
  position: TextPosition;
  type: 'highlight' | 'note' | 'underline';
  color: string;
  author: string;
  timestamp: Date;
  confidence: number; // 位置匹配的置信度 0-1
}

export class PreciseTrackingEngine {
  private static readonly CONTEXT_LENGTH = 100; // 上下文长度
  private static readonly MIN_CONFIDENCE = 0.7; // 最小置信度阈值

  /**
   * 从PDF文档中提取文本结构
   */
  static async extractTextStructure(pdfDocument: any): Promise<TextPosition[]> {
    const textPositions: TextPosition[] = [];
    
    try {
      const numPages = pdfDocument.numPages;
      
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        let pageText = '';
        const textItems = textContent.items;
        
        // 构建页面文本
        for (const item of textItems) {
          if ('str' in item) {
            pageText += item.str + ' ';
          }
        }
        
        // 分割段落和句子
        const paragraphs = this.splitIntoParagraphs(pageText);
        
        paragraphs.forEach((paragraph, paragraphIndex) => {
          const sentences = this.splitIntoSentences(paragraph.text);
          
          sentences.forEach((sentence, sentenceIndex) => {
            if (sentence.text.trim().length > 10) { // 过滤太短的句子
              const position: TextPosition = {
                page: pageNum,
                paragraph: paragraphIndex,
                sentence: sentenceIndex,
                startOffset: sentence.startOffset,
                endOffset: sentence.endOffset,
                textContent: sentence.text,
                context: this.extractContext(pageText, sentence.startOffset, sentence.endOffset)
              };
              
              textPositions.push(position);
            }
          });
        });
      }
    } catch (error) {
      ztoolkit.log("Error extracting text structure:", error);
    }
    
    return textPositions;
  }

  /**
   * 将文本分割为段落
   */
  private static splitIntoParagraphs(text: string): Array<{text: string, startOffset: number, endOffset: number}> {
    const paragraphs: Array<{text: string, startOffset: number, endOffset: number}> = [];
    
    // 使用双换行符或特定模式分割段落
    const paragraphRegex = /\n\s*\n|\.\s+[A-Z]|\d+\.\s+/g;
    let lastIndex = 0;
    let match;
    
    while ((match = paragraphRegex.exec(text)) !== null) {
      const paragraphText = text.slice(lastIndex, match.index).trim();
      if (paragraphText.length > 20) {
        paragraphs.push({
          text: paragraphText,
          startOffset: lastIndex,
          endOffset: match.index
        });
      }
      lastIndex = match.index + match[0].length;
    }
    
    // 添加最后一个段落
    const lastParagraph = text.slice(lastIndex).trim();
    if (lastParagraph.length > 20) {
      paragraphs.push({
        text: lastParagraph,
        startOffset: lastIndex,
        endOffset: text.length
      });
    }
    
    return paragraphs;
  }

  /**
   * 将段落分割为句子
   */
  private static splitIntoSentences(text: string): Array<{text: string, startOffset: number, endOffset: number}> {
    const sentences: Array<{text: string, startOffset: number, endOffset: number}> = [];
    
    // 改进的句子分割正则表达式
    const sentenceRegex = /[.!?]+\s+(?=[A-Z])|[.!?]+$/g;
    let lastIndex = 0;
    let match;
    
    while ((match = sentenceRegex.exec(text)) !== null) {
      const sentenceText = text.slice(lastIndex, match.index + match[0].length).trim();
      if (sentenceText.length > 10) {
        sentences.push({
          text: sentenceText,
          startOffset: lastIndex,
          endOffset: match.index + match[0].length
        });
      }
      lastIndex = match.index + match[0].length;
    }
    
    // 如果没有找到句子分隔符，将整个文本作为一个句子
    if (sentences.length === 0 && text.trim().length > 10) {
      sentences.push({
        text: text.trim(),
        startOffset: 0,
        endOffset: text.length
      });
    }
    
    return sentences;
  }

  /**
   * 提取上下文文本
   */
  private static extractContext(fullText: string, startOffset: number, endOffset: number): string {
    const contextStart = Math.max(0, startOffset - this.CONTEXT_LENGTH);
    const contextEnd = Math.min(fullText.length, endOffset + this.CONTEXT_LENGTH);
    return fullText.slice(contextStart, contextEnd);
  }

  /**
   * 匹配标注到精确位置
   */
  static matchAnnotationToPosition(
    annotation: any,
    textPositions: TextPosition[]
  ): PreciseAnnotation | null {
    const annotationText = annotation.annotationText || annotation.text || '';
    if (!annotationText.trim()) return null;

    let bestMatch: { position: TextPosition; confidence: number } | null = null;

    for (const position of textPositions) {
      const confidence = this.calculateMatchConfidence(annotationText, position);
      
      if (confidence > this.MIN_CONFIDENCE && 
          (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { position, confidence };
      }
    }

    if (!bestMatch) return null;

    return {
      id: annotation.id || this.generateId(),
      originalText: annotationText,
      comment: annotation.annotationComment || annotation.comment,
      position: bestMatch.position,
      type: annotation.annotationType || annotation.type || 'highlight',
      color: annotation.annotationColor || annotation.color || '#ffff00',
      author: annotation.author || 'Unknown',
      timestamp: annotation.dateAdded || annotation.timestamp || new Date(),
      confidence: bestMatch.confidence
    };
  }

  /**
   * 计算文本匹配置信度
   */
  private static calculateMatchConfidence(annotationText: string, position: TextPosition): number {
    const normalizedAnnotation = this.normalizeText(annotationText);
    const normalizedPosition = this.normalizeText(position.textContent);
    const normalizedContext = this.normalizeText(position.context);

    // 1. 直接文本匹配
    if (normalizedPosition.includes(normalizedAnnotation)) {
      return 1.0;
    }

    // 2. 上下文匹配
    if (normalizedContext.includes(normalizedAnnotation)) {
      return 0.9;
    }

    // 3. 模糊匹配（使用编辑距离）
    const similarity = this.calculateTextSimilarity(normalizedAnnotation, normalizedPosition);
    if (similarity > 0.8) {
      return similarity * 0.8;
    }

    // 4. 关键词匹配
    const keywordMatch = this.calculateKeywordMatch(normalizedAnnotation, normalizedContext);
    if (keywordMatch > 0.6) {
      return keywordMatch * 0.7;
    }

    return 0;
  }

  /**
   * 标准化文本（去除标点、转小写等）
   */
  private static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 计算文本相似度
   */
  private static calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.split(' ');
    const words2 = text2.split(' ');
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  /**
   * 计算关键词匹配度
   */
  private static calculateKeywordMatch(annotation: string, context: string): number {
    const annotationWords = annotation.split(' ').filter(word => word.length > 3);
    const contextWords = context.split(' ');
    
    const matches = annotationWords.filter(word => contextWords.includes(word));
    return matches.length / annotationWords.length;
  }

  /**
   * 生成唯一ID
   */
  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * 获取当前阅读位置的相关标注
   */
  static getAnnotationsForPosition(
    currentPage: number,
    currentParagraph: number,
    annotations: PreciseAnnotation[]
  ): PreciseAnnotation[] {
    return annotations.filter(annotation => {
      const pos = annotation.position;
      
      // 当前页面的标注
      if (pos.page === currentPage) {
        // 当前段落及相邻段落的标注
        return Math.abs(pos.paragraph - currentParagraph) <= 1;
      }
      
      return false;
    }).sort((a, b) => {
      // 按段落和句子顺序排序
      if (a.position.paragraph !== b.position.paragraph) {
        return a.position.paragraph - b.position.paragraph;
      }
      return (a.position.sentence || 0) - (b.position.sentence || 0);
    });
  }

  /**
   * 实时追踪阅读位置
   */
  static trackReadingPosition(readerWindow: Window): void {
    try {
      const iframe = readerWindow.document.querySelector('iframe');
      if (!iframe || !iframe.contentDocument) return;

      const pdfViewer = iframe.contentDocument;
      
      // 监听滚动事件
      pdfViewer.addEventListener('scroll', () => {
        const currentPosition = this.getCurrentReadingPosition(pdfViewer);
        if (currentPosition) {
          this.updateAnnotationDisplay(currentPosition);
        }
      });

      // 监听页面变化
      const observer = new MutationObserver(() => {
        const currentPosition = this.getCurrentReadingPosition(pdfViewer);
        if (currentPosition) {
          this.updateAnnotationDisplay(currentPosition);
        }
      });

      observer.observe(pdfViewer.body, {
        childList: true,
        subtree: true
      });

    } catch (error) {
      ztoolkit.log("Error setting up reading position tracking:", error);
    }
  }

  /**
   * 获取当前阅读位置
   */
  private static getCurrentReadingPosition(pdfDocument: Document): {page: number, paragraph: number} | null {
    try {
      // 这里需要根据Zotero PDF阅读器的具体实现来获取当前位置
      // 这是一个简化的示例
      const visiblePages = pdfDocument.querySelectorAll('.page[data-page-number]');
      
      for (let i = 0; i < visiblePages.length; i++) {
        const page = visiblePages[i] as HTMLElement;
        const rect = page.getBoundingClientRect();
        if (rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2) {
          const pageNumber = parseInt(page.getAttribute('data-page-number') || '1');
          // 简化的段落检测
          const paragraph = Math.floor(Math.random() * 10); // 实际应该基于滚动位置计算
          return { page: pageNumber, paragraph };
        }
      }
    } catch (error) {
      ztoolkit.log("Error getting current reading position:", error);
    }
    
    return null;
  }

  /**
   * 更新标注显示
   */
  private static updateAnnotationDisplay(position: {page: number, paragraph: number}): void {
    // 触发UI更新事件
    const event = new CustomEvent('researchopia-position-change', {
      detail: position
    });
    window.dispatchEvent(event);
  }
}
