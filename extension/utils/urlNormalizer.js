// URL Normalizer for Extension
// URL规范化工具

class URLNormalizer {
  // 追踪参数列表
  static TRACKING_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'fbclid', 'gclid', 'msclkid', 'dclid', 'mc_cid', 'mc_eid',
    'ref', 'source', 'from', 'via', '_ga', '__twitter_impression',
    'share_source', 'share_medium', 'timestamp', 's_cid', 'affiliate'
  ];

  // 规范化URL
  static normalize(url) {
    if (!url) return null;

    try {
      const urlObj = new URL(url);

      // 1. 剔除追踪参数
      this.TRACKING_PARAMS.forEach(param => {
        urlObj.searchParams.delete(param);
      });

      // 2. 移除会话参数
      const sessionParams = ['sessionid', 'session_id', 'sid', 'PHPSESSID', 'jsessionid'];
      sessionParams.forEach(param => {
        urlObj.searchParams.delete(param);
      });

      // 3. 移除hash片段（可选，某些网站hash有意义）
      // urlObj.hash = '';

      // 4. 统一协议为https（如果原本是http且域名支持https）
      if (urlObj.protocol === 'http:') {
        urlObj.protocol = 'https:';
      }

      // 5. 移除末尾斜杠（除了根路径）
      let normalized = urlObj.toString();
      if (normalized.endsWith('/') && urlObj.pathname !== '/') {
        normalized = normalized.slice(0, -1);
      }

      // 6. 小写化域名
      const lowerHost = urlObj.host.toLowerCase();
      normalized = normalized.replace(urlObj.host, lowerHost);

      return normalized;
    } catch (error) {
      console.warn('URL normalization failed:', error);
      return url;
    }
  }

  // 提取域名
  static extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return null;
    }
  }

  // 判断是否为学术网站
  static isAcademicSite(url) {
    const academicDomains = [
      'doi.org', 'dx.doi.org',
      'arxiv.org',
      'biorxiv.org', 'medrxiv.org',
      'pubmed.gov', 'ncbi.nlm.nih.gov',
      'nature.com', 'sciencedirect.com', 'springer.com', 'wiley.com',
      'ieee.org', 'acm.org', 'aps.org', 'rsc.org', 'acs.org',
      'cell.com', 'pnas.org', 'science.org', 'plos.org',
      'researchgate.net', 'academia.edu',
      'ssrn.com', 'semanticscholar.org',
      'scholar.google.com', 'google.com/scholar'
    ];

    const domain = this.extractDomain(url);
    if (!domain) return false;

    return academicDomains.some(d => domain.includes(d));
  }

  // 判断是否为视频网站
  static isVideoSite(url) {
    const videoDomains = [
      'youtube.com', 'youtu.be',
      'bilibili.com', 'b23.tv',
      'vimeo.com',
      'ted.com',
      'coursera.org', 'edx.org', 'udemy.com', 'khan'
    ];

    const domain = this.extractDomain(url);
    if (!domain) return false;

    return videoDomains.some(d => domain.includes(d));
  }

  // 推断知识单元类型
  static inferType(url, doi) {
    if (doi) return 'paper';
    if (this.isVideoSite(url)) return 'video';
    return 'webpage';
  }
}
