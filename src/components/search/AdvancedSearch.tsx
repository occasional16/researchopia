/*
  Advanced Search Component for Annotations
  Provides comprehensive search and filtering interface
*/

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SearchFilters, AnnotationSearchService } from '@/lib/annotation-search';
import { PlatformType } from '@/types/annotation-protocol';

interface AdvancedSearchProps {
  searchService: AnnotationSearchService;
  onFiltersChange: (filters: SearchFilters) => void;
  initialFilters?: SearchFilters;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  searchService,
  onFiltersChange,
  initialFilters = {}
}) => {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [isExpanded, setIsExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [popularTags, setPopularTags] = useState<Array<{ tag: string; count: number }>>([]);

  // 获取热门标签
  useEffect(() => {
    setPopularTags(searchService.getPopularTags(20));
  }, [searchService]);

  // 搜索建议
  const handleQueryChange = useCallback(async (query: string) => {
    setFilters(prev => ({ ...prev, query }));
    
    if (query.length >= 2) {
      const newSuggestions = searchService.getSuggestions(query, 8);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchService]);

  // 应用过滤器
  const applyFilters = useCallback(() => {
    onFiltersChange(filters);
  }, [filters, onFiltersChange]);

  // 重置过滤器
  const resetFilters = useCallback(() => {
    setFilters({});
    onFiltersChange({});
  }, [onFiltersChange]);

  // 检查是否有活动过滤器
  const hasActiveFilters = useMemo(() => {
    const { query, ...otherFilters } = filters;
    return Object.keys(otherFilters).length > 0 || (query && query.trim().length > 0);
  }, [filters]);

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      {/* 基础搜索栏 */}
      <div className="p-4">
        <div className="relative">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="搜索标注内容、标签、作者..."
                value={filters.query || ''}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => setShowSuggestions(suggestions.length > 0)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              {/* 搜索建议下拉 */}
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 first:rounded-t-md last:rounded-b-md"
                      onClick={() => {
                        setFilters(prev => ({ ...prev, query: suggestion }));
                        setShowSuggestions(false);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              {isExpanded ? '收起筛选' : '展开筛选'}
            </button>
            
            <button
              onClick={applyFilters}
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              搜索
            </button>
          </div>
        </div>
      </div>

      {/* 高级筛选面板 */}
      {isExpanded && (
        <div className="border-t bg-gray-50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            
            {/* 平台筛选 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                平台
              </label>
              <select
                multiple
                value={Array.isArray(filters.platform) ? filters.platform : filters.platform ? [filters.platform] : []}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value as PlatformType);
                  setFilters(prev => ({ ...prev, platform: values.length === 1 ? values[0] : values }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                size={4}
              >
                <option value="zotero">Zotero</option>
                <option value="mendeley">Mendeley</option>
                <option value="hypothesis">Hypothesis</option>
                <option value="adobe-reader">Adobe Reader</option>
              </select>
            </div>

            {/* 标注类型筛选 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                标注类型
              </label>
              <div className="space-y-2">
                {['highlight', 'note', 'underline', 'ink', 'image'].map(type => (
                  <label key={type} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={Array.isArray(filters.type) ? filters.type.includes(type) : filters.type === type}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const currentTypes = Array.isArray(filters.type) ? filters.type : filters.type ? [filters.type] : [];
                          setFilters(prev => ({ ...prev, type: [...currentTypes, type] }));
                        } else {
                          const currentTypes = Array.isArray(filters.type) ? filters.type : filters.type ? [filters.type] : [];
                          const newTypes = currentTypes.filter(t => t !== type);
                          setFilters(prev => ({ ...prev, type: newTypes.length === 1 ? newTypes[0] : newTypes }));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">{getTypeDisplayName(type)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 时间范围筛选 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                时间范围
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  placeholder="开始日期"
                  value={filters.dateRange?.start ? filters.dateRange.start.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const start = e.target.value ? new Date(e.target.value) : undefined;
                    setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start }
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="date"
                  placeholder="结束日期"
                  value={filters.dateRange?.end ? filters.dateRange.end.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const end = e.target.value ? new Date(e.target.value) : undefined;
                    setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end }
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>

            {/* 可见性筛选 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                可见性
              </label>
              <select
                value={filters.visibility || ''}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  visibility: e.target.value as 'public' | 'private' | 'shared' | undefined
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">全部</option>
                <option value="public">公开</option>
                <option value="private">私有</option>
                <option value="shared">共享</option>
              </select>
            </div>
          </div>

          {/* 颜色筛选 */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              标注颜色
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { color: '#ffd400', name: '黄色' },
                { color: '#ff6b6b', name: '红色' },
                { color: '#4ecdc4', name: '青色' },
                { color: '#45b7d1', name: '蓝色' },
                { color: '#96ceb4', name: '绿色' },
                { color: '#feca57', name: '橙色' },
                { color: '#ff9ff3', name: '粉色' },
                { color: '#a8e6cf', name: '淡绿' }
              ].map(({ color, name }) => (
                <button
                  key={color}
                  onClick={() => {
                    const currentColors = filters.colors || [];
                    const newColors = currentColors.includes(color)
                      ? currentColors.filter(c => c !== color)
                      : [...currentColors, color];
                    setFilters(prev => ({ ...prev, colors: newColors }));
                  }}
                  className={`flex items-center px-3 py-2 rounded-md border transition-colors ${
                    filters.colors?.includes(color)
                      ? 'border-gray-800 bg-gray-100'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  title={name}
                >
                  <div
                    className="w-4 h-4 rounded mr-2 border border-gray-300"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm">{name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 热门标签 */}
          {popularTags.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                热门标签
              </label>
              <div className="flex flex-wrap gap-2">
                {popularTags.slice(0, 15).map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => {
                      const currentTags = filters.tags || [];
                      const newTags = currentTags.includes(tag)
                        ? currentTags.filter(t => t !== tag)
                        : [...currentTags, tag];
                      setFilters(prev => ({ ...prev, tags: newTags }));
                    }}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      filters.tags?.includes(tag)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {tag} ({count})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 其他选项 */}
          <div className="mt-4">
            <div className="flex items-center space-x-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.hasComment === true}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    hasComment: e.target.checked ? true : undefined 
                  }))}
                  className="mr-2"
                />
                <span className="text-sm">仅显示有评论的标注</span>
              </label>

              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">排序:</label>
                <select
                  value={filters.sortBy || 'createdAt'}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    sortBy: e.target.value as 'createdAt' | 'modifiedAt' | 'author' | 'relevance'
                  }))}
                  className="px-3 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="createdAt">创建时间</option>
                  <option value="modifiedAt">修改时间</option>
                  <option value="author">作者</option>
                  <option value="relevance">相关性</option>
                </select>
                
                <select
                  value={filters.sortOrder || 'desc'}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    sortOrder: e.target.value as 'asc' | 'desc'
                  }))}
                  className="px-3 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="desc">降序</option>
                  <option value="asc">升序</option>
                </select>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="mt-4 flex justify-between">
            <button
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-400"
            >
              重置筛选条件
            </button>
            
            <div className="space-x-2">
              <button
                onClick={() => setIsExpanded(false)}
                className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                收起
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                应用筛选
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 活动筛选条件显示 */}
      {hasActiveFilters && (
        <div className="border-t bg-blue-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-blue-800">筛选条件:</span>
            
            {filters.query && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                搜索: "{filters.query}"
                <button
                  onClick={() => setFilters(prev => ({ ...prev, query: undefined }))}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            )}
            
            {filters.platform && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                平台: {Array.isArray(filters.platform) ? filters.platform.join(', ') : filters.platform}
                <button
                  onClick={() => setFilters(prev => ({ ...prev, platform: undefined }))}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            )}
            
            {filters.tags && filters.tags.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                标签: {filters.tags.join(', ')}
                <button
                  onClick={() => setFilters(prev => ({ ...prev, tags: undefined }))}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            )}
            
            {/* 清除所有筛选条件 */}
            <button
              onClick={resetFilters}
              className="ml-2 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 underline"
            >
              清除所有
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 获取标注类型显示名称
 */
function getTypeDisplayName(type: string): string {
  const typeNames: Record<string, string> = {
    highlight: '高亮',
    note: '笔记',
    underline: '下划线',
    ink: '手绘',
    image: '图像'
  };
  return typeNames[type] || type;
}