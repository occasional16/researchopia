/*
  DOI Handler for Researchopia Zotero Plugin
  Specialized handling for DOI-based items
*/

Zotero.Researchopia.DOIHandler = {
  
  /**
   * 检查条目是否有有效的DOI
   */
  hasValidDOI(item) {
    if (!item) return false;
    
    const doi = this.extractDOI(item);
    return doi && this.validateDOI(doi);
  },
  
  /**
   * 从条目中提取DOI
   */
  extractDOI(item) {
    if (!item) return null;
    
    // 优先从DOI字段获取
    let doi = item.getField('DOI');
    if (doi) {
      doi = this.cleanDOI(doi);
      if (this.validateDOI(doi)) return doi;
    }
    
    // 从URL字段中尝试提取DOI
    const url = item.getField('url');
    if (url) {
      const extractedDOI = this.extractDOIFromURL(url);
      if (extractedDOI && this.validateDOI(extractedDOI)) {
        return extractedDOI;
      }
    }
    
    // 从额外字段中查找
    const extra = item.getField('extra');
    if (extra) {
      const match = extra.match(/DOI:\s*(10\.\d+\/[^\s]+)/i);
      if (match) {
        const extractedDOI = this.cleanDOI(match[1]);
        if (this.validateDOI(extractedDOI)) {
          return extractedDOI;
        }
      }
    }
    
    return null;
  },
  
  /**
   * 从URL中提取DOI
   */
  extractDOIFromURL(url) {
    const doiPatterns = [
      /doi\.org\/(.+)/,
      /dx\.doi\.org\/(.+)/,
      /doi:\s*(10\.\d+\/[^\s]+)/i,
      /\/doi\/abs\/(.+)/,
      /\/doi\/full\/(.+)/
    ];
    
    for (const pattern of doiPatterns) {
      const match = url.match(pattern);
      if (match) {
        return this.cleanDOI(match[1]);
      }
    }
    
    return null;
  },
  
  /**
   * 清理DOI字符串
   */
  cleanDOI(doi) {
    if (!doi) return null;
    
    // 移除常见前缀
    doi = doi.replace(/^doi:\s*/i, '');
    doi = doi.replace(/^https?:\/\/doi\.org\//i, '');
    doi = doi.replace(/^https?:\/\/dx\.doi\.org\//i, '');
    
    // 移除尾部的标点符号和空白
    doi = doi.replace(/[.,;:\s]+$/, '');
    
    return doi.trim();
  },
  
  /**
   * 验证DOI格式
   */
  validateDOI(doi) {
    if (!doi || typeof doi !== 'string') return false;
    
    // DOI必须以10.开头
    if (!doi.startsWith('10.')) return false;
    
    // 基本格式验证：10.数字/其他字符
    const doiRegex = /^10\.\d+\/[^\s]+$/;
    return doiRegex.test(doi);
  },
  
  /**
   * 获取条目的标准化标识符
   */
  getItemIdentifier(item) {
    const doi = this.extractDOI(item);
    if (doi) {
      return {
        type: 'doi',
        value: doi,
        normalized: doi.toLowerCase()
      };
    }
    
    // 如果没有DOI，使用其他标识符
    const isbn = item.getField('ISBN');
    if (isbn) {
      return {
        type: 'isbn',
        value: isbn,
        normalized: isbn.replace(/[-\s]/g, '')
      };
    }
    
    const pmid = item.getField('extra')?.match(/PMID:\s*(\d+)/i)?.[1];
    if (pmid) {
      return {
        type: 'pmid',
        value: pmid,
        normalized: pmid
      };
    }
    
    // 最后使用Zotero的内部key
    return {
      type: 'zotero',
      value: item.key,
      normalized: item.key
    };
  },
  
  /**
   * 生成DOI条目的完整信息
   */
  generateItemInfo(item) {
    const identifier = this.getItemIdentifier(item);
    
    return {
      identifier: identifier,
      title: item.getField('title') || 'Untitled',
      authors: this.getAuthors(item),
      publication: this.getPublicationInfo(item),
      year: item.getField('date')?.match(/\d{4}/)?.[0] || null,
      abstract: item.getField('abstractNote') || null,
      tags: item.getTags().map(tag => tag.tag),
      itemType: item.itemType,
      dateAdded: item.dateAdded,
      dateModified: item.dateModified
    };
  },
  
  /**
   * 获取作者信息
   */
  getAuthors(item) {
    const creators = item.getCreators();
    return creators.map(creator => ({
      firstName: creator.firstName || '',
      lastName: creator.lastName || '',
      name: `${creator.firstName || ''} ${creator.lastName || ''}`.trim(),
      creatorType: creator.creatorType
    }));
  },
  
  /**
   * 获取出版信息
   */
  getPublicationInfo(item) {
    return {
      journal: item.getField('publicationTitle') || null,
      volume: item.getField('volume') || null,
      issue: item.getField('issue') || null,
      pages: item.getField('pages') || null,
      publisher: item.getField('publisher') || null,
      place: item.getField('place') || null
    };
  },
  
  /**
   * 检查两个条目是否为同一文献（基于DOI）
   */
  isSameDocument(item1, item2) {
    const id1 = this.getItemIdentifier(item1);
    const id2 = this.getItemIdentifier(item2);
    
    // 如果都有DOI，比较DOI
    if (id1.type === 'doi' && id2.type === 'doi') {
      return id1.normalized === id2.normalized;
    }
    
    // 如果都有相同类型的其他标识符
    if (id1.type === id2.type && id1.type !== 'zotero') {
      return id1.normalized === id2.normalized;
    }
    
    // 其他情况认为不同
    return false;
  },
  
  /**
   * 获取DOI的在线链接
   */
  getDOILink(doi) {
    if (!this.validateDOI(doi)) return null;
    return `https://doi.org/${doi}`;
  },
  
  /**
   * 日志输出
   */
  log(message) {
    Zotero.debug(`Researchopia DOI Handler: ${message}`);
  }
};