/*
  Annotation List Container
  Manages multiple annotations with virtual scrolling and pagination
*/

'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UniversalAnnotation } from '@/types/annotation-protocol';
import { AnnotationCard } from './AnnotationCard';
import LoadingSpinner from '@/components/LoadingSpinner';

interface AnnotationListProps {
  annotations: UniversalAnnotation[];
  loading?: boolean;
  error?: string;
  hasMore?: boolean;
  isEditing?: string | null; // 正在编辑的标注ID
  selectedIds?: Set<string>;
  searchTerm?: string;
  sortBy?: 'newest' | 'oldest' | 'relevance' | 'author';
  groupBy?: 'none' | 'document' | 'date' | 'author' | 'platform';
  viewMode?: 'card' | 'compact' | 'list';
  showBulkActions?: boolean;
  currentUserId?: string;
  onLoadMore?: () => void;
  onSelect?: (annotation: UniversalAnnotation) => void;
  onBulkSelect?: (ids: Set<string>) => void;
  onEdit?: (annotationId: string) => void;
  onSave?: (annotation: UniversalAnnotation, changes: any) => Promise<void>;
  onCancel?: () => void;
  onDelete?: (annotationId: string) => Promise<void>;
  onBulkDelete?: (ids: string[]) => Promise<void>;
  onComment?: (annotation: UniversalAnnotation, comment: string) => Promise<void>;
  onTag?: (annotation: UniversalAnnotation, tags: string[]) => Promise<void>;
  onExport?: (annotations: UniversalAnnotation[], format: string) => void;
}

interface GroupedAnnotations {
  [key: string]: UniversalAnnotation[];
}

export const AnnotationList: React.FC<AnnotationListProps> = ({
  annotations,
  loading = false,
  error,
  hasMore = false,
  isEditing = null,
  selectedIds = new Set(),
  searchTerm = '',
  sortBy = 'newest',
  groupBy = 'none',
  viewMode = 'card',
  showBulkActions = false,
  currentUserId,
  onLoadMore,
  onSelect,
  onBulkSelect,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onBulkDelete,
  onComment,
  onTag,
  onExport
}) => {
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(selectedIds);
  const [virtualStart, setVirtualStart] = useState(0);
  const [virtualEnd, setVirtualEnd] = useState(20);
  
  const listRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<HTMLDivElement>(null);

  // 虚拟滚动参数
  const ITEM_HEIGHT = viewMode === 'compact' ? 120 : viewMode === 'card' ? 200 : 150;
  const BUFFER = 5;

  // 排序和分组逻辑
  const processedAnnotations = useMemo(() => {
    let processed = [...annotations];

    // 排序
    switch (sortBy) {
      case 'newest':
        processed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        processed.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'author':
        processed.sort((a, b) => a.metadata.author.name.localeCompare(b.metadata.author.name));
        break;
      case 'relevance':
        // 基于搜索相关性排序（简化版）
        if (searchTerm) {
          processed.sort((a, b) => {
            const aRelevance = calculateRelevance(a, searchTerm);
            const bRelevance = calculateRelevance(b, searchTerm);
            return bRelevance - aRelevance;
          });
        }
        break;
    }

    return processed;
  }, [annotations, sortBy, searchTerm]);

  // 分组逻辑
  const groupedAnnotations = useMemo<GroupedAnnotations>(() => {
    if (groupBy === 'none') {
      return { all: processedAnnotations };
    }

    const groups: GroupedAnnotations = {};

    processedAnnotations.forEach(annotation => {
      let groupKey: string;

      switch (groupBy) {
        case 'document':
          groupKey = annotation.documentId || '未知文档';
          break;
        case 'date':
          const date = new Date(annotation.createdAt);
          groupKey = date.toLocaleDateString('zh-CN', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
          break;
        case 'author':
          groupKey = annotation.metadata.author.name;
          break;
        case 'platform':
          groupKey = annotation.metadata.platform;
          break;
        default:
          groupKey = 'all';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(annotation);
    });

    return groups;
  }, [processedAnnotations, groupBy]);

  // 计算搜索相关性（简化版）
  const calculateRelevance = (annotation: UniversalAnnotation, term: string): number => {
    const lowerTerm = term.toLowerCase();
    let score = 0;

    if (annotation.content?.text?.toLowerCase().includes(lowerTerm)) {
      score += 10;
    }
    if (annotation.content?.comment?.toLowerCase().includes(lowerTerm)) {
      score += 5;
    }
    if (annotation.metadata.tags?.some(tag => tag.toLowerCase().includes(lowerTerm))) {
      score += 8;
    }
    if (annotation.metadata.author.name.toLowerCase().includes(lowerTerm)) {
      score += 3;
    }

    return score;
  };

  // 处理批量选择
  const handleBulkSelect = (annotationId: string, selected: boolean) => {
    const newSelectedIds = new Set(localSelectedIds);
    if (selected) {
      newSelectedIds.add(annotationId);
    } else {
      newSelectedIds.delete(annotationId);
    }
    setLocalSelectedIds(newSelectedIds);
    onBulkSelect?.(newSelectedIds);
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    const allIds = processedAnnotations.map(a => a.id);
    const newSelectedIds = localSelectedIds.size === allIds.length ? new Set() : new Set(allIds);
    setLocalSelectedIds(newSelectedIds);
    onBulkSelect?.(newSelectedIds);
  };

  // 检查用户权限
  const canEditAnnotation = (annotation: UniversalAnnotation): boolean => {
    if (!currentUserId) return false;
    return annotation.metadata.author.id === currentUserId;
  };

  const canDeleteAnnotation = (annotation: UniversalAnnotation): boolean => {
    if (!currentUserId) return false;
    return annotation.metadata.author.id === currentUserId;
  };

  // 无限滚动
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          onLoadMore?.();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observer.unobserve(observerRef.current);
      }
    };
  }, [hasMore, loading, onLoadMore]);

  // 虚拟滚动（当数据量大时）
  const handleScroll = () => {
    if (!listRef.current || processedAnnotations.length < 100) return;

    const scrollTop = listRef.current.scrollTop;
    const start = Math.floor(scrollTop / ITEM_HEIGHT);
    const end = Math.min(start + Math.ceil(window.innerHeight / ITEM_HEIGHT) + BUFFER * 2, processedAnnotations.length);

    setVirtualStart(Math.max(0, start - BUFFER));
    setVirtualEnd(end);
  };

  // 渲染单个标注
  const renderAnnotation = (annotation: UniversalAnnotation, index: number) => {
    const isSelected = localSelectedIds.has(annotation.id);
    const isCurrentlyEditing = isEditing === annotation.id;

    return (
      <div
        key={annotation.id}
        className={`relative ${viewMode === 'compact' ? 'mb-2' : 'mb-4'} ${
          bulkSelectMode ? 'pl-8' : ''
        }`}
        style={processedAnnotations.length >= 100 ? { 
          minHeight: ITEM_HEIGHT,
          transform: `translateY(${virtualStart * ITEM_HEIGHT}px)` 
        } : undefined}
      >
        {/* 批量选择复选框 */}
        {bulkSelectMode && (
          <div className="absolute left-0 top-4 z-10">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => handleBulkSelect(annotation.id, e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>
        )}

        <AnnotationCard
          annotation={annotation}
          isSelected={isSelected && !bulkSelectMode}
          isEditing={isCurrentlyEditing}
          canEdit={canEditAnnotation(annotation)}
          canDelete={canDeleteAnnotation(annotation)}
          showDocument={groupBy !== 'document'}
          onSelect={bulkSelectMode ? undefined : onSelect}
          onEdit={() => onEdit?.(annotation.id)}
          onDelete={() => onDelete?.(annotation.id)}
          onSave={onSave}
          onCancel={onCancel}
          onComment={onComment}
          onTag={onTag}
        />
      </div>
    );
  };

  // 渲染分组
  const renderGroup = (groupKey: string, groupAnnotations: UniversalAnnotation[]) => {
    const visibleAnnotations = processedAnnotations.length >= 100 
      ? groupAnnotations.slice(virtualStart, virtualEnd)
      : groupAnnotations;

    return (
      <div key={groupKey} className="mb-6">
        {groupBy !== 'none' && (
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-800 flex items-center">
              {groupKey}
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({groupAnnotations.length})
              </span>
            </h3>
            {showBulkActions && (
              <button
                onClick={() => {
                  const groupIds = groupAnnotations.map(a => a.id);
                  const allSelected = groupIds.every(id => localSelectedIds.has(id));
                  const newSelectedIds = new Set(localSelectedIds);
                  
                  if (allSelected) {
                    groupIds.forEach((id: string) => newSelectedIds.delete(id));
                  } else {
                    groupIds.forEach((id: string) => newSelectedIds.add(id));
                  }
                  
                  setLocalSelectedIds(newSelectedIds as Set<string>);
                  onBulkSelect?.(newSelectedIds as Set<string>);
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {groupAnnotations.every(a => localSelectedIds.has(a.id)) ? '取消选择' : '全选'}
              </button>
            )}
          </div>
        )}
        
        <div className="space-y-0">
          {visibleAnnotations.map((annotation, index) => renderAnnotation(annotation, index))}
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!loading && processedAnnotations.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无标注</h3>
          <p className="text-gray-500">
            {searchTerm ? '没有找到匹配的标注' : '还没有任何标注'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 批量操作工具栏 */}
      {showBulkActions && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setBulkSelectMode(!bulkSelectMode)}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  bulkSelectMode 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white text-gray-700 border border-gray-300'
                }`}
              >
                {bulkSelectMode ? '退出选择' : '批量选择'}
              </button>
              
              {bulkSelectMode && (
                <>
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {localSelectedIds.size === processedAnnotations.length ? '取消全选' : '全选'}
                  </button>
                  
                  {localSelectedIds.size > 0 && (
                    <span className="text-sm text-gray-600">
                      已选择 {localSelectedIds.size} 项
                    </span>
                  )}
                </>
              )}
            </div>
            
            {localSelectedIds.size > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onExport?.(
                    processedAnnotations.filter(a => localSelectedIds.has(a.id)),
                    'json'
                  )}
                  className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                >
                  导出
                </button>
                <button
                  onClick={() => {
                    if (confirm(`确定要删除选中的 ${localSelectedIds.size} 个标注吗？`)) {
                      onBulkDelete?.(Array.from(localSelectedIds));
                    }
                  }}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  删除
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 标注列表 */}
      <div
        ref={listRef}
        className="space-y-0"
        onScroll={handleScroll}
        style={processedAnnotations.length >= 100 ? { 
          height: '70vh',
          overflowY: 'auto' 
        } : undefined}
      >
        {Object.entries(groupedAnnotations).map(([groupKey, groupAnnotations]) =>
          renderGroup(groupKey, groupAnnotations)
        )}
        
        {/* 加载指示器 */}
        {loading && (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        )}
        
        {/* 无限滚动监听元素 */}
        {hasMore && !loading && (
          <div ref={observerRef} className="h-20" />
        )}
      </div>
    </div>
  );
};