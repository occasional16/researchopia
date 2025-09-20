/*
  Web Annotation Viewer
  Complete web interface for viewing and managing shared annotations
*/

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UniversalAnnotation } from '@/types/annotation-protocol';
import { AdvancedSearch } from '@/components/search/AdvancedSearch';
import { AnnotationList } from '@/components/annotations/AnnotationList';
import { AnnotationSearchService, SearchFilters } from '@/lib/annotation-search';

interface WebAnnotationViewerProps {
  initialAnnotations?: UniversalAnnotation[];
  currentUserId?: string;
  collaborationRoomId?: string;
  canCreateAnnotations?: boolean;
  canModerate?: boolean;
  onAnnotationCreate?: (annotation: Partial<UniversalAnnotation>) => Promise<UniversalAnnotation>;
  onAnnotationUpdate?: (id: string, changes: Partial<UniversalAnnotation>) => Promise<UniversalAnnotation>;
  onAnnotationDelete?: (id: string) => Promise<void>;
}

interface ViewState {
  searchTerm: string;
  filters: {
    platforms: string[];
    types: string[];
    authors: string[];
    tags: string[];
    colors: string[];
    dateRange: { start: Date | undefined; end: Date | undefined };
    visibility: 'public' | 'private' | 'shared' | undefined;
  };
  sortBy: 'newest' | 'oldest' | 'relevance' | 'author';
  groupBy: 'none' | 'document' | 'date' | 'author' | 'platform';
  viewMode: 'card' | 'compact' | 'list';
  showFilters: boolean;
}

export const WebAnnotationViewer: React.FC<WebAnnotationViewerProps> = ({
  initialAnnotations = [],
  currentUserId,
  collaborationRoomId,
  canCreateAnnotations = false,
  canModerate = false,
  onAnnotationCreate,
  onAnnotationUpdate,
  onAnnotationDelete
}) => {
  // 基础状态
  const [annotations, setAnnotations] = useState<UniversalAnnotation[]>(initialAnnotations);
  const [filteredAnnotations, setFilteredAnnotations] = useState<UniversalAnnotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // 视图状态
  const [viewState, setViewState] = useState<ViewState>({
    searchTerm: '',
    filters: {
      platforms: [],
      types: [],
      authors: [],
      tags: [],
      colors: [],
      dateRange: { start: undefined, end: undefined },
      visibility: undefined
    },
    sortBy: 'newest',
    groupBy: 'none',
    viewMode: 'card',
    showFilters: false
  });

  // 分页状态
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    hasMore: true
  });

  // 搜索服务
  const searchService = new AnnotationSearchService();

  // 协作功能 - 暂时禁用
  const collaboration = {
    isConnected: false,
    users: [] as Array<{ id: string; name: string }>,
    sendOperation: (_operation: any) => {},
    onOperation: undefined as ((operation: any) => void) | undefined
  };

  // 搜索和筛选
  const searchAnnotations = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const searchService = new AnnotationSearchService(annotations);
      
      const searchParams = {
        query: viewState.searchTerm,
        filters: {
          ...viewState.filters,
          dateRange: viewState.filters.dateRange
        },
        sortBy: (viewState.sortBy === 'newest' ? 'createdAt' : viewState.sortBy === 'oldest' ? 'modifiedAt' : viewState.sortBy) as 'author' | 'createdAt' | 'modifiedAt' | 'relevance',
        page: pagination.page,
        limit: pagination.limit
      };

      const results = await searchService.search(searchParams);
      
      if (pagination.page === 1) {
        setFilteredAnnotations(results.annotations);
      } else {
        setFilteredAnnotations(prev => [...prev, ...results.annotations]);
      }

      setPagination(prev => ({
        ...prev,
        total: results.total,
        hasMore: results.annotations.length === pagination.limit
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
    } finally {
      setLoading(false);
    }
  }, [viewState.searchTerm, viewState.filters, viewState.sortBy, pagination.page, pagination.limit, annotations]);

  // 初始化和搜索
  useEffect(() => {
    searchAnnotations();
  }, [searchAnnotations]);

  // 处理搜索变化
  const handleSearchChange = useCallback((filters: SearchFilters) => {
    setViewState(prev => ({
      ...prev,
      searchTerm: filters.query || '',
      filters: {
        platforms: Array.isArray(filters.platform) ? filters.platform : filters.platform ? [filters.platform] : [],
        types: Array.isArray(filters.type) ? filters.type : filters.type ? [filters.type] : [],
        authors: [],
        tags: filters.tags || [],
        colors: filters.colors || [],
        dateRange: {
          start: filters.dateRange?.start || undefined,
          end: filters.dateRange?.end || undefined
        },
        visibility: filters.visibility
      }
    }));
    setPagination(prev => ({
      ...prev,
      page: 1
    }));
  }, []);

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (!loading && pagination.hasMore) {
      setPagination(prev => ({
        ...prev,
        page: prev.page + 1
      }));
    }
  }, [loading, pagination.hasMore]);

  // 处理标注选择
  const handleAnnotationSelect = useCallback((annotation: UniversalAnnotation) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(annotation.id)) {
        newSet.delete(annotation.id);
      } else {
        newSet.add(annotation.id);
      }
      return newSet;
    });
  }, []);

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
      
      // 更新本地状态
      setAnnotations(prev => 
        prev.map(a => a.id === annotation.id ? updatedAnnotation : a)
      );
      setFilteredAnnotations(prev => 
        prev.map(a => a.id === annotation.id ? updatedAnnotation : a)
      );
      
      // 同步到协作系统
      if (collaboration?.isConnected) {
        collaboration.sendOperation({
          type: 'update',
          annotationId: annotation.id,
          changes: changes,
          userId: currentUserId || 'anonymous'
        });
      }
      
      setIsEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setLoading(false);
    }
  }, [onAnnotationUpdate, collaboration, currentUserId]);

  // 处理标注删除
  const handleAnnotationDelete = useCallback(async (annotationId: string) => {
    if (!onAnnotationDelete) return;

    try {
      setLoading(true);
      await onAnnotationDelete(annotationId);
      
      // 更新本地状态
      setAnnotations(prev => prev.filter(a => a.id !== annotationId));
      setFilteredAnnotations(prev => prev.filter(a => a.id !== annotationId));
      
      // 同步到协作系统
      if (collaboration.isConnected) {
        collaboration.sendOperation({
          type: 'delete',
          annotationId: annotationId,
          userId: currentUserId || 'anonymous'
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setLoading(false);
    }
  }, [onAnnotationDelete, collaboration, currentUserId]);

  // 处理批量删除
  const handleBulkDelete = useCallback(async (ids: string[]) => {
    if (!onAnnotationDelete) return;

    try {
      setLoading(true);
      await Promise.all(ids.map(id => onAnnotationDelete(id)));
      
      // 更新本地状态
      setAnnotations(prev => prev.filter(a => !ids.includes(a.id)));
      setFilteredAnnotations(prev => prev.filter(a => !ids.includes(a.id)));
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量删除失败');
    } finally {
      setLoading(false);
    }
  }, [onAnnotationDelete]);

  // 处理导出
  const handleExport = useCallback((annotations: UniversalAnnotation[], format: string) => {
    const exportData = {
      annotations,
      metadata: {
        exportedAt: new Date().toISOString(),
        format: format,
        total: annotations.length,
        version: '1.0.0'
      }
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `annotations-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }, []);

  // 协作事件处理
  useEffect(() => {
    if (!collaboration.isConnected) return;

    const handleCollaborationUpdate = (operation: any) => {
      switch (operation.type) {
        case 'create':
          setAnnotations(prev => [...prev, operation.annotation]);
          setFilteredAnnotations(prev => [...prev, operation.annotation]);
          break;
        case 'update':
          setAnnotations(prev => 
            prev.map(a => a.id === operation.annotationId 
              ? { ...a, ...operation.changes } 
              : a
            )
          );
          setFilteredAnnotations(prev => 
            prev.map(a => a.id === operation.annotationId 
              ? { ...a, ...operation.changes } 
              : a
            )
          );
          break;
        case 'delete':
          setAnnotations(prev => prev.filter(a => a.id !== operation.annotationId));
          setFilteredAnnotations(prev => prev.filter(a => a.id !== operation.annotationId));
          break;
      }
    };

    collaboration.onOperation = handleCollaborationUpdate;

    return () => {
      collaboration.onOperation = undefined;
    };
  }, [collaboration]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 头部 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">标注管理器</h1>
            <p className="text-sm text-gray-600 mt-1">
              {filteredAnnotations.length} 个标注
              {collaboration.isConnected && (
                <span className="ml-2 inline-flex items-center text-green-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1" />
                  协作模式
                </span>
              )}
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

            {/* 筛选器切换 */}
            <button
              onClick={() => setViewState(prev => ({ ...prev, showFilters: !prev.showFilters }))}
              className={`px-4 py-2 rounded-lg border ${
                viewState.showFilters
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              筛选器
            </button>

            {/* 排序和分组 */}
            <div className="flex space-x-2">
              <select
                value={viewState.sortBy}
                onChange={(e) => setViewState(prev => ({ 
                  ...prev, 
                  sortBy: e.target.value as any 
                }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="newest">最新</option>
                <option value="oldest">最早</option>
                <option value="relevance">相关性</option>
                <option value="author">作者</option>
              </select>

              <select
                value={viewState.groupBy}
                onChange={(e) => setViewState(prev => ({ 
                  ...prev, 
                  groupBy: e.target.value as any 
                }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="none">无分组</option>
                <option value="document">按文档</option>
                <option value="date">按日期</option>
                <option value="author">按作者</option>
                <option value="platform">按平台</option>
              </select>
            </div>
          </div>
        </div>

        {/* 协作用户显示 */}
        {collaboration.isConnected && collaboration.users.length > 1 && (
          <div className="mt-3 flex items-center space-x-2">
            <span className="text-sm text-gray-600">在线用户:</span>
            <div className="flex space-x-1">
              {collaboration.users.map(user => (
                <div
                  key={user.id}
                  className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                  title={user.name}
                >
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-1" />
                  {user.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 搜索和筛选区域 */}
      {viewState.showFilters && (
        <div className="bg-white border-b border-gray-200 p-6">
          <AdvancedSearch
            searchService={searchService}
            onFiltersChange={handleSearchChange}
            initialFilters={viewState.filters}
          />
        </div>
      )}

      {/* 主内容区域 */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full px-6 py-4">
          <AnnotationList
            annotations={filteredAnnotations}
            loading={loading}
            error={error}
            hasMore={pagination.hasMore}
            isEditing={isEditing}
            selectedIds={selectedIds}
            searchTerm={viewState.searchTerm}
            sortBy={viewState.sortBy}
            groupBy={viewState.groupBy}
            viewMode={viewState.viewMode}
            showBulkActions={canModerate}
            currentUserId={currentUserId}
            onLoadMore={handleLoadMore}
            onSelect={handleAnnotationSelect}
            onBulkSelect={setSelectedIds}
            onEdit={handleAnnotationEdit}
            onSave={handleAnnotationSave}
            onCancel={() => setIsEditing(null)}
            onDelete={handleAnnotationDelete}
            onBulkDelete={handleBulkDelete}
            onExport={handleExport}
          />
        </div>
      </div>
    </div>
  );
};