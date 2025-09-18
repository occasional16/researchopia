/*
  Hypothesis Annotation Converter
  Converts annotations between Hypothesis format and Universal Annotation Protocol
*/

import { UniversalAnnotation, AnnotationConverter } from '@/types/annotation-protocol';

interface HypothesisAnnotation {
  id: string;
  created: string;
  updated: string;
  user: string;
  uri: string;
  text: string;
  tags: string[];
  target: Array<{
    source: string;
    selector?: Array<{
      type: string;
      exact?: string;
      prefix?: string;
      suffix?: string;
      start?: number;
      end?: number;
      startContainer?: string;
      endContainer?: string;
      startOffset?: number;
      endOffset?: number;
    }>;
  }>;
  permissions: {
    read: string[];
    admin: string[];
    update: string[];
    delete: string[];
  };
  user_info: {
    display_name: string;
  };
  hidden: boolean;
  flagged: boolean;
  references?: string[]; // For replies/threading
  group: string;
}

interface HypothesisUser {
  userid: string;
  username: string;
  display_name: string;
  authority: string;
}

export class HypothesisAnnotationConverter implements AnnotationConverter<HypothesisAnnotation> {
  platform = 'hypothesis' as const;

  /**
   * 将Hypothesis标注转换为通用格式
   */
  async fromPlatform(
    hypothesisAnnotation: HypothesisAnnotation, 
    user?: HypothesisUser
  ): Promise<UniversalAnnotation> {
    // 解析选择器信息
    let selectedText = '';
    let position: any = undefined;

    if (hypothesisAnnotation.target && hypothesisAnnotation.target.length > 0) {
      const target = hypothesisAnnotation.target[0];
      
      if (target.selector) {
        for (const selector of target.selector) {
          if (selector.type === 'TextQuoteSelector' && selector.exact) {
            selectedText = selector.exact;
            break;
          }
          if (selector.type === 'TextPositionSelector' && selector.start && selector.end) {
            position = {
              start: { x: selector.start, y: 0 },
              end: { x: selector.end, y: 0 }
            };
          }
        }
      }
    }

    // 确定标注类型
    let annotationType: UniversalAnnotation['type'];
    if (hypothesisAnnotation.text && hypothesisAnnotation.text.trim()) {
      annotationType = 'note'; // 有评论内容
    } else if (selectedText) {
      annotationType = 'highlight'; // 只是高亮
    } else {
      annotationType = 'note'; // 默认为笔记
    }

    // 确定可见性
    let visibility: UniversalAnnotation['metadata']['visibility'];
    const isPublic = hypothesisAnnotation.permissions.read.includes('group:__world__');
    const isGroupShared = hypothesisAnnotation.group !== '__world__' && 
                          hypothesisAnnotation.permissions.read.length > 1;
    
    if (isPublic) {
      visibility = 'public';
    } else if (isGroupShared) {
      visibility = 'shared';
    } else {
      visibility = 'private';
    }

    // 提取用户信息
    const displayName = user?.display_name || hypothesisAnnotation.user_info?.display_name || hypothesisAnnotation.user;
    const userId = user?.userid || hypothesisAnnotation.user;

    const universalAnnotation: UniversalAnnotation = {
      id: hypothesisAnnotation.id,
      type: annotationType,
      documentId: hypothesisAnnotation.uri,
      content: {
        text: selectedText || undefined,
        comment: hypothesisAnnotation.text || undefined,
        color: '#ffeb3b', // Hypothesis默认黄色
        position: position
      },
      metadata: {
        platform: 'hypothesis',
        author: {
          id: userId,
          name: displayName,
          platform: 'hypothesis'
        },
        tags: hypothesisAnnotation.tags,
        visibility: visibility,
        permissions: {
          canEdit: hypothesisAnnotation.permissions.update,
          canView: hypothesisAnnotation.permissions.read
        },
        documentInfo: {
          title: hypothesisAnnotation.uri,
          url: hypothesisAnnotation.uri
        },
        originalData: {
          group: hypothesisAnnotation.group,
          references: hypothesisAnnotation.references,
          hidden: hypothesisAnnotation.hidden,
          flagged: hypothesisAnnotation.flagged
        }
      },
      createdAt: hypothesisAnnotation.created,
      modifiedAt: hypothesisAnnotation.updated,
      version: '1.0.0'
    };

    return universalAnnotation;
  }

  /**
   * 将通用格式转换为Hypothesis标注
   */
  async toPlatform(universalAnnotation: UniversalAnnotation): Promise<HypothesisAnnotation> {
    // 构建选择器
    const selectors: any[] = [];

    if (universalAnnotation.content?.text) {
      selectors.push({
        type: 'TextQuoteSelector',
        exact: universalAnnotation.content.text
      });
    }

    if (universalAnnotation.content?.position) {
      const pos = universalAnnotation.content.position;
      if (pos.start && pos.end) {
        selectors.push({
          type: 'TextPositionSelector',
          start: pos.start.x,
          end: pos.end.x
        });
      }
    }

    // 构建目标
    const target = [{
      source: universalAnnotation.documentId,
      selector: selectors.length > 0 ? selectors : undefined
    }];

    // 构建权限
    const permissions = {
      read: universalAnnotation.metadata.permissions?.canView || ['self'],
      admin: [universalAnnotation.metadata.author.id],
      update: universalAnnotation.metadata.permissions?.canEdit || [universalAnnotation.metadata.author.id],
      delete: [universalAnnotation.metadata.author.id]
    };

    // 处理公开可见性
    if (universalAnnotation.metadata.visibility === 'public') {
      permissions.read = ['group:__world__'];
    }

    // 构建群组信息
    let group = '__world__'; // 默认公开群组
    if (universalAnnotation.metadata.visibility === 'private') {
      group = universalAnnotation.metadata.author.id;
    } else if (universalAnnotation.metadata.originalData?.group) {
      group = universalAnnotation.metadata.originalData.group;
    }

    const hypothesisAnnotation: HypothesisAnnotation = {
      id: universalAnnotation.id,
      created: universalAnnotation.createdAt,
      updated: universalAnnotation.modifiedAt,
      user: universalAnnotation.metadata.author.id,
      uri: universalAnnotation.documentId,
      text: universalAnnotation.content?.comment || '',
      tags: universalAnnotation.metadata.tags || [],
      target: target,
      permissions: permissions,
      user_info: {
        display_name: universalAnnotation.metadata.author.name
      },
      hidden: universalAnnotation.metadata.originalData?.hidden || false,
      flagged: universalAnnotation.metadata.originalData?.flagged || false,
      references: universalAnnotation.metadata.originalData?.references,
      group: group
    };

    return hypothesisAnnotation;
  }

  /**
   * 验证Hypothesis标注格式
   */
  validate(annotation: unknown): annotation is HypothesisAnnotation {
    if (!annotation || typeof annotation !== 'object') {
      return false;
    }

    const ann = annotation as any;

    return (
      typeof ann.id === 'string' &&
      typeof ann.created === 'string' &&
      typeof ann.updated === 'string' &&
      typeof ann.user === 'string' &&
      typeof ann.uri === 'string' &&
      typeof ann.text === 'string' &&
      Array.isArray(ann.tags) &&
      Array.isArray(ann.target) &&
      typeof ann.permissions === 'object' &&
      Array.isArray(ann.permissions.read) &&
      typeof ann.user_info === 'object' &&
      typeof ann.user_info.display_name === 'string' &&
      typeof ann.group === 'string'
    );
  }

  /**
   * 从Hypothesis API导出数据
   */
  async exportFromAPI(options?: {
    apiToken?: string;
    user?: string;
    uri?: string;
    group?: string;
    tags?: string;
    limit?: number;
    offset?: number;
  }): Promise<HypothesisAnnotation[]> {
    const baseUrl = 'https://api.hypothes.is/api';
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.hypothesis.v1+json',
      'Content-Type': 'application/json'
    };

    if (options?.apiToken) {
      headers['Authorization'] = `Bearer ${options.apiToken}`;
    }

    try {
      let url = `${baseUrl}/search`;
      const params = new URLSearchParams();

      if (options?.user) params.append('user', options.user);
      if (options?.uri) params.append('uri', options.uri);
      if (options?.group) params.append('group', options.group);
      if (options?.tags) params.append('tags', options.tags);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`Hypothesis API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.rows || !Array.isArray(data.rows)) {
        throw new Error('Invalid response format from Hypothesis API');
      }

      return data.rows.filter((ann: any) => this.validate(ann));
    } catch (error) {
      console.error('Error fetching Hypothesis annotations:', error);
      throw error;
    }
  }

  /**
   * 批量转换Hypothesis标注
   */
  async convertBatch(
    hypothesisAnnotations: HypothesisAnnotation[],
    users?: Record<string, HypothesisUser>
  ): Promise<UniversalAnnotation[]> {
    const converted: UniversalAnnotation[] = [];

    for (const annotation of hypothesisAnnotations) {
      try {
        const user = users?.[annotation.user];
        const universalAnnotation = await this.fromPlatform(annotation, user);
        converted.push(universalAnnotation);
      } catch (error) {
        console.error(`Error converting Hypothesis annotation ${annotation.id}:`, error);
      }
    }

    return converted;
  }

  /**
   * 获取支持的导出格式
   */
  getSupportedFormats(): string[] {
    return ['json', 'csv', 'markdown'];
  }

  /**
   * 导出为指定格式
   */
  async exportToFormat(annotations: HypothesisAnnotation[], format: string): Promise<string> {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(annotations, null, 2);
        
      case 'csv':
        if (annotations.length === 0) return '';
        
        const headers = [
          'id', 'created', 'user', 'uri', 'text', 'selected_text', 
          'tags', 'group', 'visibility', 'updated'
        ];
        
        const rows = annotations.map(ann => {
          const selectedText = ann.target?.[0]?.selector?.find(s => s.exact)?.exact || '';
          const visibility = ann.permissions.read.includes('group:__world__') ? 'public' : 
                           ann.group === '__world__' ? 'shared' : 'private';
          
          return [
            ann.id,
            ann.created,
            ann.user_info.display_name,
            ann.uri,
            ann.text,
            selectedText,
            ann.tags.join('; '),
            ann.group,
            visibility,
            ann.updated
          ];
        });
        
        const csvContent = [headers, ...rows]
          .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          .join('\n');
        
        return csvContent;
        
      case 'markdown':
        let markdown = '# Hypothesis Annotations\n\n';
        
        for (const ann of annotations) {
          const selectedText = ann.target?.[0]?.selector?.find(s => s.exact)?.exact || '';
          const date = new Date(ann.created).toLocaleDateString();
          
          markdown += `## ${ann.user_info.display_name} - ${date}\n\n`;
          markdown += `**URL:** ${ann.uri}\n\n`;
          
          if (selectedText) {
            markdown += `**Selected Text:**\n> ${selectedText}\n\n`;
          }
          
          if (ann.text) {
            markdown += `**Comment:**\n${ann.text}\n\n`;
          }
          
          if (ann.tags.length > 0) {
            markdown += `**Tags:** ${ann.tags.map(tag => `#${tag}`).join(' ')}\n\n`;
          }
          
          markdown += '---\n\n';
        }
        
        return markdown;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * 创建Hypothesis群组标注
   */
  async createGroupAnnotation(
    annotation: Omit<HypothesisAnnotation, 'id' | 'created' | 'updated'>,
    apiToken: string
  ): Promise<HypothesisAnnotation> {
    const url = 'https://api.hypothes.is/api/annotations';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.hypothesis.v1+json'
      },
      body: JSON.stringify(annotation)
    });

    if (!response.ok) {
      throw new Error(`Failed to create Hypothesis annotation: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 更新Hypothesis标注
   */
  async updateAnnotation(
    id: string,
    updates: Partial<HypothesisAnnotation>,
    apiToken: string
  ): Promise<HypothesisAnnotation> {
    const url = `https://api.hypothes.is/api/annotations/${id}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.hypothesis.v1+json'
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error(`Failed to update Hypothesis annotation: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}