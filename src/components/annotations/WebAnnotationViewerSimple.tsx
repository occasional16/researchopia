/*
  Simplified Web Annotation Viewer
  Basic web interface for viewing and managing annotations
*/

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UniversalAnnotation } from '@/types/annotation-protocol';
import { AnnotationCard } from './AnnotationCard';
import LoadingSpinner from '@/components/LoadingSpinner';

interface WebAnnotationViewerProps {
  initialAnnotations?: UniversalAnnotation[];
  currentUserId?: string;
  canCreateAnnotations?: boolean;
  canModerate?: boolean;
  onAnnotationUpdate?: (id: string, changes: Partial<UniversalAnnotation>) => Promise<UniversalAnnotation>;
  onAnnotationDelete?: (id: string) => Promise<void>;
}

interface ViewState {
  searchTerm: string;
  filterPlatform: string;
  filterAuthor: string;
  sortBy: 'newest' | 'oldest' | 'author';
  viewMode: 'card' | 'compact' | 'list';
}

export const WebAnnotationViewer: React.FC<WebAnnotationViewerProps> = ({
  initialAnnotations = [],
  currentUserId,
  canCreateAnnotations = false,
  canModerate = false,
  onAnnotationUpdate,
  onAnnotationDelete
}) => {
  const [annotations, setAnnotations] = useState<UniversalAnnotation[]>(initialAnnotations);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  
  const [viewState, setViewState] = useState<ViewState>({
    searchTerm: '',
    filterPlatform: '',
    filterAuthor: '',
    sortBy: 'newest',
    viewMode: 'card'
  });

  // 过滤和排序
  const filteredAnnotations = useMemo(() => {
    let filtered = [...annotations];

    // 搜索过滤
    if (viewState.searchTerm) {
      const term = viewState.searchTerm.toLowerCase();
      filtered = filtered.filter(ann => 
        ann.content?.text?.toLowerCase().includes(term) ||
        ann.content?.comment?.toLowerCase().includes(term) ||
        ann.metadata.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }

    // 平台过滤
    if (viewState.filterPlatform) {
      filtered = filtered.filter(ann => ann.metadata.platform === viewState.filterPlatform);
    }

    // 作者过滤
    if (viewState.filterAuthor) {
      filtered = filtered.filter(ann => ann.metadata.author.name === viewState.filterAuthor);
    }

    // 排序
    switch (viewState.sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'author':
        filtered.sort((a, b) => a.metadata.author.name.localeCompare(b.metadata.author.name));
        break;
    }

    return filtered;
  }, [annotations, viewState]);

  // 获取唯一值用于筛选器
  const uniquePlatforms = useMemo(() => 
    Array.from(new Set(annotations.map(ann => ann.metadata.platform))),
    [annotations]
  );

  const uniqueAuthors = useMemo(() => 
    Array.from(new Set(annotations.map(ann => ann.metadata.author.name))),
    [annotations]
  );

  // 处理标注编辑
  const handleAnnotationEdit = useCallback((annotationId: string) => {
    setIsEditing(annotationId);
  }, []);

  // 处理标注保存
  const handleAnnotationSave = useCallback(async (annotation: UniversalAnnotation, changes: any) => {
    if (!onAnnotationUpdate) return;

    try {
      setLoading(true);
      const updatedAnnotation = await onAnnotationUpdate(annotation.id, changes);
      
      setAnnotations(prev => 
        prev.map(a => a.id === annotation.id ? updatedAnnotation : a)
      );
      
      setIsEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setLoading(false);
    }
  }, [onAnnotationUpdate]);

  // 处理标注删除
  const handleAnnotationDelete = useCallback(async (annotationId: string) => {
    if (!onAnnotationDelete) return;

    try {
      setLoading(true);
      await onAnnotationDelete(annotationId);
      
      setAnnotations(prev => prev.filter(a => a.id !== annotationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setLoading(false);
    }
  }, [onAnnotationDelete]);

  // 检查权限
  const canEditAnnotation = (annotation: UniversalAnnotation): boolean => {
    if (!currentUserId) return false;
    return annotation.metadata.author.id === currentUserId;
  };

  const canDeleteAnnotation = (annotation: UniversalAnnotation): boolean => {
    if (!currentUserId) return false;
    return annotation.metadata.author.id === currentUserId || canModerate;
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 头部 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">标注查看器</h1>
            <p className="text-sm text-gray-600 mt-1">
              共 {filteredAnnotations.length} 个标注
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* 视图模式切换 */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['card', 'compact', 'list'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewState(prev => ({ ...prev, viewMode: mode }))}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    viewState.viewMode === mode
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {mode === 'card' ? '卡片' : mode === 'compact' ? '紧凑' : '列表'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-4">
          {/* 搜索框 */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索标注内容、评论或标签..."
              value={viewState.searchTerm}
              onChange={(e) => setViewState(prev => ({ ...prev, searchTerm: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 平台筛选 */}
          <select
            value={viewState.filterPlatform}
            onChange={(e) => setViewState(prev => ({ ...prev, filterPlatform: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">所有平台</option>
            {uniquePlatforms.map(platform => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>

          {/* 作者筛选 */}
          <select
            value={viewState.filterAuthor}
            onChange={(e) => setViewState(prev => ({ ...prev, filterAuthor: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">所有作者</option>
            {uniqueAuthors.map(author => (
              <option key={author} value={author}>
                {author}
              </option>
            ))}
          </select>

          {/* 排序 */}
          <select
            value={viewState.sortBy}
            onChange={(e) => setViewState(prev => ({ 
              ...prev, 
              sortBy: e.target.value as ViewState['sortBy']
            }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="newest">最新</option>
            <option value="oldest">最早</option>
            <option value="author">作者</option>
          </select>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-6 mt-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400">⚠️</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto">
              <button
                onClick={() => setError('')}
                className="text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 主内容区域 */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-4">
          {loading && (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {!loading && filteredAnnotations.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="text-gray-400 text-4xl mb-4">📝</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无标注</h3>
                <p className="text-gray-500">
                  {viewState.searchTerm || viewState.filterPlatform || viewState.filterAuthor 
                    ? '没有找到匹配的标注' 
                    : '还没有任何标注'
                  }
                </p>
              </div>
            </div>
          )}

          {!loading && filteredAnnotations.length > 0 && (
            <div className="space-y-4">
              {filteredAnnotations.map(annotation => (
                <AnnotationCard
                  key={annotation.id}
                  annotation={annotation}
                  isEditing={isEditing === annotation.id}
                  canEdit={canEditAnnotation(annotation)}
                  canDelete={canDeleteAnnotation(annotation)}
                  onEdit={() => handleAnnotationEdit(annotation.id)}
                  onSave={handleAnnotationSave}
                  onCancel={() => setIsEditing(null)}
                  onDelete={() => {
                    if (confirm('确定要删除这个标注吗？')) {
                      handleAnnotationDelete(annotation.id);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebAnnotationViewer;