/*
  Web Annotation Viewer Demo Page
  Demonstrates the annotation viewer with sample data
*/

'use client';

import React, { useState, useEffect } from 'react';
import { UniversalAnnotation, PlatformType } from '@/types/annotation-protocol';
import WebAnnotationViewer from '@/components/annotations/WebAnnotationViewerSimple';

// 示例标注数据
const generateSampleAnnotations = (): UniversalAnnotation[] => {
  const platforms = ['zotero', 'mendeley', 'hypothesis', 'adobe-reader'];
  const types = ['highlight', 'note', 'underline', 'ink'];
  const colors = ['#ffeb3b', '#4caf50', '#2196f3', '#ff9800', '#e91e63'];
  const authors = [
    { id: 'user1', name: '张三', email: 'zhangsan@example.com' },
    { id: 'user2', name: '李四', email: 'lisi@example.com' },
    { id: 'user3', name: '王五', email: 'wangwu@example.com' },
    { id: 'user4', name: '赵六', email: 'zhaoliu@example.com' }
  ];

  const sampleTexts = [
    '人工智能技术的快速发展为学术研究带来了新的机遇和挑战。',
    '深度学习在自然语言处理领域取得了突破性进展。',
    '跨学科研究方法在解决复杂问题中发挥着重要作用。',
    '开放科学运动促进了学术资源的共享和协作。',
    '数字化转型正在重塑学术研究的方式和流程。',
    '机器学习算法的可解释性是当前研究的热点问题。',
    '学术评价体系需要适应新的研究范式和发表模式。',
    '数据科学在社会科学研究中的应用越来越广泛。',
    '云计算为大规模科学计算提供了强有力的支撑。',
    '区块链技术在学术诚信保障方面具有潜在应用价值。'
  ];

  const sampleComments = [
    '这个观点很有启发性，值得深入思考。',
    '需要更多的实证研究来支撑这个结论。',
    '与之前的研究发现存在一定的矛盾。',
    '这个方法在实际应用中可能面临一些挑战。',
    '建议结合最新的研究成果进行分析。',
    '这个案例很好地说明了理论的实用性。',
    '可以考虑从不同角度来验证这个假设。',
    '这个发现对未来的研究方向有重要指导意义。'
  ];

  const tags = [
    ['人工智能', '深度学习', '机器学习'],
    ['自然语言处理', 'NLP', '文本分析'],
    ['跨学科', '复杂系统', '系统思维'],
    ['开放科学', '学术合作', '知识共享'],
    ['数字化', '信息化', '技术创新'],
    ['可解释性', '算法透明', 'XAI'],
    ['学术评价', '同行评议', '影响因子'],
    ['数据科学', '统计分析', '大数据'],
    ['云计算', '分布式计算', '高性能计算'],
    ['区块链', '学术诚信', '去中心化']
  ];

  return Array.from({ length: 25 }, (_, i) => {
    const author = authors[i % authors.length];
    const platform = platforms[i % platforms.length] as PlatformType;
    const type = types[i % types.length];
    const color = colors[i % colors.length];
    const text = sampleTexts[i % sampleTexts.length];
    const comment = i % 3 === 0 ? sampleComments[i % sampleComments.length] : undefined;
    const annotationTags = tags[i % tags.length];

    const baseDate = new Date('2024-01-01');
    const createdAt = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
    const modifiedAt = i % 5 === 0 
      ? new Date(createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000)
      : createdAt;

    return {
      id: `annotation-${i + 1}`,
      type: type as any,
      documentId: `document-${Math.floor(i / 5) + 1}`,
      content: {
        text: text,
        comment: comment,
        color: color,
        position: {
          page: Math.floor(i / 3) + 1,
          start: { x: 100 + (i % 3) * 150, y: 200 + (i % 5) * 100 },
          end: { x: 300 + (i % 3) * 150, y: 220 + (i % 5) * 100 }
        }
      },
      metadata: {
        platform: platform,
        author: author,
        tags: annotationTags,
        visibility: i % 3 === 0 ? 'public' : i % 3 === 1 ? 'shared' : 'private',
        permissions: {
          canEdit: [author.id],
          canView: ['public']
        }
      },
      createdAt: createdAt.toISOString(),
      modifiedAt: modifiedAt.toISOString(),
      version: '1.0.0'
    };
  });
};

export default function WebAnnotationDemo() {
  const [annotations, setAnnotations] = useState<UniversalAnnotation[]>([]);
  const [currentUser] = useState('user1'); // 模拟当前用户

  useEffect(() => {
    // 模拟加载标注数据
    const loadAnnotations = () => {
      setTimeout(() => {
        setAnnotations(generateSampleAnnotations());
      }, 500);
    };

    loadAnnotations();
  }, []);

  // 模拟更新标注
  const handleAnnotationUpdate = async (id: string, changes: Partial<UniversalAnnotation>) => {
    return new Promise<UniversalAnnotation>((resolve) => {
      setTimeout(() => {
        const updatedAnnotation = {
          ...annotations.find(a => a.id === id)!,
          ...changes,
          modifiedAt: new Date().toISOString()
        };
        
        setAnnotations(prev => 
          prev.map(a => a.id === id ? updatedAnnotation : a)
        );
        
        resolve(updatedAnnotation);
      }, 300);
    });
  };

  // 模拟删除标注
  const handleAnnotationDelete = async (id: string) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setAnnotations(prev => prev.filter(a => a.id !== id));
        resolve();
      }, 300);
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 演示说明 */}
      <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">
            🚀 Web标注查看器演示
          </h2>
          <p className="text-blue-700 text-sm">
            这是一个功能完整的Web标注查看器演示。您可以：
            <span className="ml-2 space-x-4">
              <span>🔍 搜索和筛选标注</span>
              <span>✏️ 编辑标注内容</span>
              <span>🗑️ 删除标注</span>
              <span>🔄 切换视图模式</span>
            </span>
          </p>
          <div className="mt-2 text-sm text-blue-600">
            <strong>当前用户:</strong> 张三 (可以编辑自己创建的标注)
          </div>
        </div>
      </div>

      {/* 标注查看器 */}
      <WebAnnotationViewer
        initialAnnotations={annotations}
        currentUserId={currentUser}
        canCreateAnnotations={true}
        canModerate={false}
        onAnnotationUpdate={handleAnnotationUpdate}
        onAnnotationDelete={handleAnnotationDelete}
      />
    </div>
  );
}