'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UniversalAnnotation, AnnotationType, VisibilityLevel } from '@/types/annotation-protocol';

interface AnnotationViewerProps {
  documentId: string;
  userId?: string;
  showFilters?: boolean;
  onAnnotationSelect?: (annotation: UniversalAnnotation) => void;
  onAnnotationEdit?: (annotation: UniversalAnnotation) => void;
  onAnnotationDelete?: (annotationId: string) => void;
}

interface FilterOptions {
  type: AnnotationType[];
  visibility: VisibilityLevel[];
  author: string[];
  dateRange: {
    start: string;
    end: string;
  };
  search: string;
}

const AnnotationViewer: React.FC<AnnotationViewerProps> = ({
  documentId,
  userId,
  showFilters = true,
  onAnnotationSelect,
  onAnnotationEdit,
  onAnnotationDelete
}) => {
  const [annotations, setAnnotations] = useState<UniversalAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'compact' | 'list'>('card');
  const [sortBy, setSortBy] = useState<'date' | 'likes' | 'comments' | 'author'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [filters, setFilters] = useState<FilterOptions>({
    type: [],
    visibility: ['public', 'shared'],
    author: [],
    dateRange: { start: '', end: '' },
    search: ''
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  // 获取标注数据
  const fetchAnnotations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        documentId,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder
      });

      // 添加过滤条件
      if (userId) params.append('userId', userId);
      if (filters.type.length > 0) params.append('type', filters.type.join(','));
      if (filters.visibility.length > 0) params.append('visibility', filters.visibility.join(','));
      if (filters.author.length > 0) params.append('author', filters.author.join(','));
      if (filters.search) params.append('search', filters.search);
      if (filters.dateRange.start) params.append('dateStart', filters.dateRange.start);
      if (filters.dateRange.end) params.append('dateEnd', filters.dateRange.end);

      const response = await fetch(`/api/v1/annotations?${params}`);
      const result = await response.json();

      if (result.success) {
        setAnnotations(result.data.annotations);
        setPagination(prev => ({
          ...prev,
          total: result.data.pagination.total,
          totalPages: result.data.pagination.totalPages
        }));
      } else {
        setError(result.error?.message || 'Failed to fetch annotations');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [documentId, userId, pagination.page, pagination.limit, sortBy, sortOrder, filters]);

  // 初始加载
  useEffect(() => {
    fetchAnnotations();
  }, [fetchAnnotations]);

  // 处理标注选择
  const handleAnnotationSelect = (annotation: UniversalAnnotation) => {
    setSelectedAnnotation(annotation.id);
    onAnnotationSelect?.(annotation);
  };

  // 处理标注点赞
  const handleAnnotationLike = async (annotationId: string) => {
    try {
      const response = await fetch(`/api/v1/annotations/${annotationId}/like`, {
        method: 'POST'
      });
      
      if (response.ok) {
        // 更新本地状态
        setAnnotations(prev => prev.map(ann => 
          ann.id === annotationId 
            ? { ...ann, metadata: { ...ann.metadata, likesCount: (ann.metadata as any).likesCount + 1 } }
            : ann
        ));
      }
    } catch (err) {
      console.error('Failed to like annotation:', err);
    }
  };

  // 处理标注评论
  const handleAnnotationComment = async (annotationId: string, comment: string) => {
    try {
      const response = await fetch(`/api/v1/annotations/${annotationId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: comment })
      });
      
      if (response.ok) {
        // 更新本地状态
        setAnnotations(prev => prev.map(ann => 
          ann.id === annotationId 
            ? { ...ann, metadata: { ...ann.metadata, commentsCount: (ann.metadata as any).commentsCount + 1 } }
            : ann
        ));
      }
    } catch (err) {
      console.error('Failed to comment on annotation:', err);
    }
  };

  // 处理标注分享
  const handleAnnotationShare = async (annotationId: string, visibility: VisibilityLevel) => {
    try {
      const response = await fetch(`/api/v1/annotations/${annotationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: { visibility }
        })
      });
      
      if (response.ok) {
        // 更新本地状态
        setAnnotations(prev => prev.map(ann => 
          ann.id === annotationId 
            ? { ...ann, metadata: { ...ann.metadata, visibility } }
            : ann
        ));
      }
    } catch (err) {
      console.error('Failed to share annotation:', err);
    }
  };

  // 渲染标注卡片
  const renderAnnotationCard = (annotation: UniversalAnnotation) => (
    <div
      key={annotation.id}
      className={`bg-white rounded-lg shadow-md p-4 border-l-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
        selectedAnnotation === annotation.id ? 'ring-2 ring-blue-500' : ''
      }`}
      style={{ borderLeftColor: annotation.content?.color || '#ffd400' }}
      onClick={() => handleAnnotationSelect(annotation)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
            {annotation.type}
          </span>
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
            {annotation.metadata.visibility}
          </span>
        </div>
        <div className="flex items-center space-x-1 text-sm text-gray-500">
          <span>{new Date(annotation.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {annotation.content?.text && (
        <div className="mb-3">
          <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
            "{annotation.content.text}"
          </p>
        </div>
      )}

      {annotation.content?.comment && (
        <div className="mb-3">
          <p className="text-sm text-gray-800">{annotation.content.comment}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAnnotationLike(annotation.id);
            }}
            className="flex items-center space-x-1 hover:text-red-500"
          >
            <span>❤️</span>
            <span>{(annotation.metadata as any).likesCount || 0}</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              // 打开评论对话框
            }}
            className="flex items-center space-x-1 hover:text-blue-500"
          >
            <span>💬</span>
            <span>{(annotation.metadata as any).commentsCount || 0}</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              // 打开分享对话框
            }}
            className="flex items-center space-x-1 hover:text-green-500"
          >
            <span>📤</span>
            <span>分享</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <img
              src={annotation.metadata.author.avatar || '/default-avatar.png'}
              alt={annotation.metadata.author.name}
              className="w-6 h-6 rounded-full"
            />
            <span className="text-sm text-gray-600">{annotation.metadata.author.name}</span>
          </div>
        </div>
      </div>

      {annotation.metadata.tags && annotation.metadata.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {annotation.metadata.tags.map((tag, index) => (
            <span
              key={index}
              className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  // 渲染紧凑视图
  const renderCompactView = (annotation: UniversalAnnotation) => (
    <div
      key={annotation.id}
      className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
      onClick={() => handleAnnotationSelect(annotation)}
    >
      <div
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: annotation.content?.color || '#ffd400' }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">
          {annotation.content?.text || annotation.content?.comment || 'No content'}
        </p>
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <span>{annotation.metadata.author.name}</span>
          <span>•</span>
          <span>{new Date(annotation.createdAt).toLocaleDateString()}</span>
          <span>•</span>
          <span>{annotation.type}</span>
        </div>
      </div>
      <div className="flex items-center space-x-2 text-xs text-gray-500">
        <span>❤️ {(annotation.metadata as any).likesCount || 0}</span>
        <span>💬 {(annotation.metadata as any).commentsCount || 0}</span>
      </div>
    </div>
  );

  // 渲染列表视图
  const renderListView = (annotation: UniversalAnnotation) => (
    <tr
      key={annotation.id}
      className="hover:bg-gray-50 cursor-pointer"
      onClick={() => handleAnnotationSelect(annotation)}
    >
      <td className="px-4 py-3">
        <div
          className="w-4 h-4 rounded"
          style={{ backgroundColor: annotation.content?.color || '#ffd400' }}
        />
      </td>
      <td className="px-4 py-3 text-sm text-gray-800">
        {annotation.content?.text || annotation.content?.comment || 'No content'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{annotation.type}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{annotation.metadata.author.name}</td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {new Date(annotation.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        <div className="flex items-center space-x-2">
          <span>❤️ {(annotation.metadata as any).likesCount || 0}</span>
          <span>💬 {(annotation.metadata as any).commentsCount || 0}</span>
        </div>
      </td>
    </tr>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchAnnotations}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">标注 ({pagination.total})</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded ${viewMode === 'card' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}
            >
              📋
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={`p-2 rounded ${viewMode === 'compact' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}
            >
              📝
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}
            >
              📊
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="date">按日期</option>
            <option value="likes">按点赞数</option>
            <option value="comments">按评论数</option>
            <option value="author">按作者</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1 text-gray-500 hover:text-gray-700"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* 过滤选项 */}
      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="搜索标注内容..."
                className="w-full px-3 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
              <select
                multiple
                value={filters.type}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  type: Array.from(e.target.selectedOptions, option => option.value) as AnnotationType[]
                }))}
                className="w-full px-3 py-1 border rounded text-sm"
              >
                <option value="highlight">高亮</option>
                <option value="underline">下划线</option>
                <option value="note">便笺</option>
                <option value="text">文本框</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">可见性</label>
              <select
                multiple
                value={filters.visibility}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  visibility: Array.from(e.target.selectedOptions, option => option.value) as VisibilityLevel[]
                }))}
                className="w-full px-3 py-1 border rounded text-sm"
              >
                <option value="public">公开</option>
                <option value="shared">共享</option>
                <option value="private">私有</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 标注列表 */}
      <div className="space-y-2">
        {annotations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无标注数据
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid gap-4">
            {annotations.map(renderAnnotationCard)}
          </div>
        ) : viewMode === 'compact' ? (
          <div className="space-y-1">
            {annotations.map(renderCompactView)}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">颜色</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">内容</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">作者</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">互动</th>
              </tr>
            </thead>
            <tbody>
              {annotations.map(renderListView)}
            </tbody>
          </table>
        )}
      </div>

      {/* 分页 */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一页
          </button>
          <span className="text-sm text-gray-600">
            第 {pagination.page} 页，共 {pagination.totalPages} 页
          </span>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page === pagination.totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
};

export default AnnotationViewer;
