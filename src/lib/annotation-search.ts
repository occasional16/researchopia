/*
  Annotation Search and Filter Service
  Provides advanced search, filtering, and sorting capabilities for annotations
*/

import { UniversalAnnotation, PlatformType } from '@/types/annotation-protocol';

export interface SearchFilters {
  // 文本搜索
  query?: string;
  
  // 基础过滤
  documentId?: string;
  authorId?: string;
  platform?: PlatformType | PlatformType[];
  type?: string | string[];
  tags?: string[];
  
  // 时间范围
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  
  // 可见性
  visibility?: 'public' | 'private' | 'shared';
  
  // 颜色
  colors?: string[];
  
  // 有无评论
  hasComment?: boolean;
  
  // 排序
  sortBy?: 'createdAt' | 'modifiedAt' | 'author' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  
  // 分页
  page?: number;
  limit?: number;
}

export interface SearchResult {
  annotations: UniversalAnnotation[];
  total: number;
  page: number;
  totalPages: number;
  facets: SearchFacets;
}

export interface SearchFacets {
  platforms: Array<{ platform: PlatformType; count: number }>;
  types: Array<{ type: string; count: number }>;
  authors: Array<{ authorId: string; authorName: string; count: number }>;
  tags: Array<{ tag: string; count: number }>;
  colors: Array<{ color: string; count: number }>;
  dateRanges: Array<{ range: string; count: number }>;
}

export class AnnotationSearchService {
  private annotations: UniversalAnnotation[] = [];
  private searchIndex: Map<string, Set<string>> = new Map();
  
  /**
   * 初始化搜索服务
   */
  constructor(annotations: UniversalAnnotation[] = []) {
    this.setAnnotations(annotations);
  }
  
  /**
   * 设置标注数据并构建索引
   */
  setAnnotations(annotations: UniversalAnnotation[]): void {
    this.annotations = annotations;
    this.buildSearchIndex();
  }
  
  /**
   * 添加标注
   */
  addAnnotation(annotation: UniversalAnnotation): void {
    this.annotations.push(annotation);
    this.addToSearchIndex(annotation);
  }
  
  /**
   * 更新标注
   */
  updateAnnotation(updatedAnnotation: UniversalAnnotation): void {
    const index = this.annotations.findIndex(ann => ann.id === updatedAnnotation.id);
    if (index !== -1) {
      this.annotations[index] = updatedAnnotation;
      this.buildSearchIndex(); // 重建索引以确保准确性
    }
  }
  
  /**
   * 删除标注
   */
  removeAnnotation(annotationId: string): void {
    this.annotations = this.annotations.filter(ann => ann.id !== annotationId);
    this.buildSearchIndex();
  }
  
  /**
   * 搜索标注
   */
  search(filters: SearchFilters = {}): SearchResult {
    let filteredAnnotations = [...this.annotations];
    
    // 文本搜索
    if (filters.query) {
      filteredAnnotations = this.performTextSearch(filteredAnnotations, filters.query);
    }
    
    // 应用过滤器
    filteredAnnotations = this.applyFilters(filteredAnnotations, filters);
    
    // 排序
    filteredAnnotations = this.applySorting(filteredAnnotations, filters);
    
    // 计算分页
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const total = filteredAnnotations.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedAnnotations = filteredAnnotations.slice(startIndex, endIndex);
    
    // 生成分面统计
    const facets = this.generateFacets(this.annotations, filters);
    
    return {
      annotations: paginatedAnnotations,
      total,
      page,
      totalPages,
      facets
    };
  }
  
  /**
   * 获取搜索建议
   */
  getSuggestions(query: string, limit: number = 5): string[] {
    if (!query || query.length < 2) return [];
    
    const suggestions = new Set<string>();
    const queryLower = query.toLowerCase();
    
    // 从文本内容中提取建议
    for (const annotation of this.annotations) {
      const text = annotation.content?.text || '';
      const comment = annotation.content?.comment || '';
      const allText = (text + ' ' + comment).toLowerCase();
      
      // 查找包含查询词的短语
      const words = allText.split(/\s+/);
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (word.includes(queryLower)) {
          suggestions.add(word);
          if (suggestions.size >= limit) break;
        }
        
        // 查找短语
        if (i < words.length - 1) {
          const phrase = `${word} ${words[i + 1]}`;
          if (phrase.includes(queryLower)) {
            suggestions.add(phrase);
            if (suggestions.size >= limit) break;
          }
        }
      }
      
      if (suggestions.size >= limit) break;
    }
    
    // 从标签中提取建议
    for (const annotation of this.annotations) {
      const tags = annotation.metadata.tags || [];
      for (const tag of tags) {
        if (tag.toLowerCase().includes(queryLower)) {
          suggestions.add(tag);
          if (suggestions.size >= limit) break;
        }
      }
      if (suggestions.size >= limit) break;
    }
    
    return Array.from(suggestions).slice(0, limit);
  }
  
  /**
   * 获取热门标签
   */
  getPopularTags(limit: number = 20): Array<{ tag: string; count: number }> {
    const tagCounts = new Map<string, number>();
    
    for (const annotation of this.annotations) {
      const tags = annotation.metadata.tags || [];
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
  
  /**
   * 构建搜索索引
   */
  private buildSearchIndex(): void {
    this.searchIndex.clear();
    
    for (const annotation of this.annotations) {
      this.addToSearchIndex(annotation);
    }
  }
  
  /**
   * 添加标注到搜索索引
   */
  private addToSearchIndex(annotation: UniversalAnnotation): void {
    const words = this.extractSearchableWords(annotation);
    
    for (const word of words) {
      if (!this.searchIndex.has(word)) {
        this.searchIndex.set(word, new Set());
      }
      this.searchIndex.get(word)!.add(annotation.id);
    }
  }
  
  /**
   * 提取可搜索的词汇
   */
  private extractSearchableWords(annotation: UniversalAnnotation): string[] {
    const words: string[] = [];
    
    // 标注文本
    if (annotation.content?.text) {
      words.push(...this.tokenize(annotation.content.text));
    }
    
    // 评论内容
    if (annotation.content?.comment) {
      words.push(...this.tokenize(annotation.content.comment));
    }
    
    // 标签
    if (annotation.metadata.tags) {
      words.push(...annotation.metadata.tags);
    }
    
    // 作者名称
    if (annotation.metadata.author.name) {
      words.push(...this.tokenize(annotation.metadata.author.name));
    }
    
    return words;
  }
  
  /**
   * 文本分词
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // 保留中文字符
      .split(/\s+/)
      .filter(word => word.length > 1);
  }
  
  /**
   * 执行文本搜索
   */
  private performTextSearch(annotations: UniversalAnnotation[], query: string): UniversalAnnotation[] {
    const queryWords = this.tokenize(query);
    if (queryWords.length === 0) return annotations;
    
    const matchedIds = new Set<string>();
    
    // 查找包含查询词的标注ID
    for (const word of queryWords) {
      const ids = this.searchIndex.get(word);
      if (ids) {
        for (const id of ids) {
          matchedIds.add(id);
        }
      }
    }
    
    // 按相关性排序
    const scored = annotations
      .filter(ann => matchedIds.has(ann.id))
      .map(annotation => ({
        annotation,
        score: this.calculateRelevanceScore(annotation, queryWords)
      }))
      .sort((a, b) => b.score - a.score);
    
    return scored.map(item => item.annotation);
  }
  
  /**
   * 计算相关性得分
   */
  private calculateRelevanceScore(annotation: UniversalAnnotation, queryWords: string[]): number {
    let score = 0;
    
    const text = (annotation.content?.text || '').toLowerCase();
    const comment = (annotation.content?.comment || '').toLowerCase();
    const tags = (annotation.metadata.tags || []).join(' ').toLowerCase();
    
    for (const word of queryWords) {
      // 标题匹配权重最高
      if (text.includes(word)) {
        score += 3;
      }
      
      // 评论匹配
      if (comment.includes(word)) {
        score += 2;
      }
      
      // 标签匹配
      if (tags.includes(word)) {
        score += 1;
      }
    }
    
    return score;
  }
  
  /**
   * 应用过滤器
   */
  private applyFilters(annotations: UniversalAnnotation[], filters: SearchFilters): UniversalAnnotation[] {
    return annotations.filter(annotation => {
      // 文档ID过滤
      if (filters.documentId && annotation.documentId !== filters.documentId) {
        return false;
      }
      
      // 作者过滤
      if (filters.authorId && annotation.metadata.author.id !== filters.authorId) {
        return false;
      }
      
      // 平台过滤
      if (filters.platform) {
        const platforms = Array.isArray(filters.platform) ? filters.platform : [filters.platform];
        if (!platforms.includes(annotation.metadata.platform)) {
          return false;
        }
      }
      
      // 类型过滤
      if (filters.type) {
        const types = Array.isArray(filters.type) ? filters.type : [filters.type];
        if (!types.includes(annotation.type)) {
          return false;
        }
      }
      
      // 标签过滤
      if (filters.tags && filters.tags.length > 0) {
        const annotationTags = annotation.metadata.tags || [];
        const hasAllTags = filters.tags.every(tag => annotationTags.includes(tag));
        if (!hasAllTags) {
          return false;
        }
      }
      
      // 时间范围过滤
      if (filters.dateRange) {
        const createdAt = new Date(annotation.createdAt);
        
        if (filters.dateRange.start && createdAt < filters.dateRange.start) {
          return false;
        }
        
        if (filters.dateRange.end && createdAt > filters.dateRange.end) {
          return false;
        }
      }
      
      // 可见性过滤
      if (filters.visibility && annotation.metadata.visibility !== filters.visibility) {
        return false;
      }
      
      // 颜色过滤
      if (filters.colors && filters.colors.length > 0) {
        const annotationColor = annotation.content?.color || '#ffd400';
        if (!filters.colors.includes(annotationColor)) {
          return false;
        }
      }
      
      // 评论过滤
      if (filters.hasComment !== undefined) {
        const hasComment = !!(annotation.content?.comment && annotation.content.comment.trim());
        if (filters.hasComment !== hasComment) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * 应用排序
   */
  private applySorting(annotations: UniversalAnnotation[], filters: SearchFilters): UniversalAnnotation[] {
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    
    return annotations.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'modifiedAt':
          comparison = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
          break;
        case 'author':
          comparison = a.metadata.author.name.localeCompare(b.metadata.author.name);
          break;
        case 'relevance':
          // 相关性排序已在文本搜索中处理
          return 0;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }
  
  /**
   * 生成分面统计
   */
  private generateFacets(annotations: UniversalAnnotation[], filters: SearchFilters): SearchFacets {
    const platforms = new Map<PlatformType, number>();
    const types = new Map<string, number>();
    const authors = new Map<string, { name: string; count: number }>();
    const tags = new Map<string, number>();
    const colors = new Map<string, number>();
    const dateRanges = new Map<string, number>();
    
    for (const annotation of annotations) {
      // 平台统计
      const platform = annotation.metadata.platform;
      platforms.set(platform, (platforms.get(platform) || 0) + 1);
      
      // 类型统计
      types.set(annotation.type, (types.get(annotation.type) || 0) + 1);
      
      // 作者统计
      const authorId = annotation.metadata.author.id;
      const authorName = annotation.metadata.author.name;
      if (!authors.has(authorId)) {
        authors.set(authorId, { name: authorName, count: 0 });
      }
      authors.get(authorId)!.count++;
      
      // 标签统计
      for (const tag of annotation.metadata.tags || []) {
        tags.set(tag, (tags.get(tag) || 0) + 1);
      }
      
      // 颜色统计
      const color = annotation.content?.color || '#ffd400';
      colors.set(color, (colors.get(color) || 0) + 1);
      
      // 时间范围统计
      const createdAt = new Date(annotation.createdAt);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      let range: string;
      if (daysDiff === 0) range = '今天';
      else if (daysDiff <= 7) range = '本周';
      else if (daysDiff <= 30) range = '本月';
      else if (daysDiff <= 90) range = '三个月内';
      else if (daysDiff <= 365) range = '一年内';
      else range = '一年前';
      
      dateRanges.set(range, (dateRanges.get(range) || 0) + 1);
    }
    
    return {
      platforms: Array.from(platforms.entries())
        .map(([platform, count]) => ({ platform, count }))
        .sort((a, b) => b.count - a.count),
        
      types: Array.from(types.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
        
      authors: Array.from(authors.entries())
        .map(([authorId, { name, count }]) => ({ authorId, authorName: name, count }))
        .sort((a, b) => b.count - a.count),
        
      tags: Array.from(tags.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50), // 限制标签数量
        
      colors: Array.from(colors.entries())
        .map(([color, count]) => ({ color, count }))
        .sort((a, b) => b.count - a.count),
        
      dateRanges: Array.from(dateRanges.entries())
        .map(([range, count]) => ({ range, count }))
    };
  }
}