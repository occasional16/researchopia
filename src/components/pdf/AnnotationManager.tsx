'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  Tag, 
  Calendar,
  User,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Highlighter,
  FileText,
  Palette
} from 'lucide-react';

interface Annotation {
  id: string;
  pdf_document_id: string;
  user_id: string;
  page_number: number;
  annotation_type: 'highlight' | 'note' | 'bookmark' | 'drawing';
  position_data: {
    x: number;
    y: number;
    width: number;
    height: number;
    bounds?: { left: number; top: number; right: number; bottom: number };
  };
  content?: string;
  selected_text?: string;
  color: string;
  opacity: number;
  tags: string[];
  is_private: boolean;
  reply_to?: string;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    name: string;
    avatar?: string;
  };
  interactions?: {
    likes: number;
    replies: number;
  };
}

interface AnnotationManagerProps {
  documentId: string;
  annotations: Annotation[];
  onAnnotationUpdate: (id: string, updates: Partial<Annotation>) => Promise<void>;
  onAnnotationDelete: (id: string) => Promise<void>;
  onAnnotationReply?: (parentId: string, content: string) => Promise<void>;
  onPageJump?: (pageNumber: number) => void;
  currentUserId?: string;
}

export default function AnnotationManager({
  documentId,
  annotations,
  onAnnotationUpdate,
  onAnnotationDelete,
  onAnnotationReply,
  onPageJump,
  currentUserId = 'demo-user'
}: AnnotationManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'highlight' | 'note' | 'bookmark' | 'drawing'>('all');
  const [filterAuthor, setFilterAuthor] = useState<'all' | 'mine' | 'others'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'page' | 'type'>('date');
  const [expandedAnnotations, setExpandedAnnotations] = useState<Set<string>>(new Set());
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // 过滤和排序标注
  const filteredAnnotations = annotations.filter(annotation => {
    // 搜索过滤
    const matchesSearch = !searchQuery || 
      annotation.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      annotation.selected_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      annotation.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    // 类型过滤
    const matchesType = filterType === 'all' || annotation.annotation_type === filterType;

    // 作者过滤
    const matchesAuthor = filterAuthor === 'all' || 
      (filterAuthor === 'mine' && annotation.user_id === currentUserId) ||
      (filterAuthor === 'others' && annotation.user_id !== currentUserId);

    return matchesSearch && matchesType && matchesAuthor;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'page':
        return a.page_number - b.page_number;
      case 'type':
        return a.annotation_type.localeCompare(b.annotation_type);
      case 'date':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  // 获取注解类型图标和颜色
  const getAnnotationIcon = (type: Annotation['annotation_type'], color: string) => {
    const iconProps = { className: "w-4 h-4", style: { color } };
    
    switch (type) {
      case 'highlight':
        return <Highlighter {...iconProps} />;
      case 'note':
        return <FileText {...iconProps} />;
      case 'bookmark':
        return <Bookmark {...iconProps} />;
      case 'drawing':
        return <Palette {...iconProps} />;
      default:
        return <MessageCircle {...iconProps} />;
    }
  };

  // 获取注解类型标签
  const getAnnotationTypeLabel = (type: Annotation['annotation_type']) => {
    switch (type) {
      case 'highlight': return '高亮';
      case 'note': return '笔记';
      case 'bookmark': return '书签';
      case 'drawing': return '绘图';
      default: return '标注';
    }
  };

  // 切换标注展开状态
  const toggleAnnotation = (id: string) => {
    const newExpanded = new Set(expandedAnnotations);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedAnnotations(newExpanded);
  };

  // 开始编辑
  const startEdit = (annotation: Annotation) => {
    setEditingAnnotation(annotation.id);
    setEditContent(annotation.content || '');
  };

  // 保存编辑
  const saveEdit = async () => {
    if (!editingAnnotation) return;
    
    try {
      await onAnnotationUpdate(editingAnnotation, { content: editContent });
      setEditingAnnotation(null);
      setEditContent('');
    } catch (error) {
      console.error('更新标注失败:', error);
    }
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingAnnotation(null);
    setEditContent('');
  };

  // 开始回复
  const startReply = (annotationId: string) => {
    setReplyingTo(annotationId);
    setReplyContent('');
  };

  // 发送回复
  const sendReply = async () => {
    if (!replyingTo || !replyContent.trim()) return;
    
    try {
      await onAnnotationReply?.(replyingTo, replyContent);
      setReplyingTo(null);
      setReplyContent('');
    } catch (error) {
      console.error('回复失败:', error);
    }
  };

  // 格式化时间
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      {/* 标题和统计 */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">
            标注管理 ({annotations.length})
          </h3>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>{filteredAnnotations.length} 项显示</span>
          </div>
        </div>

        {/* 搜索和过滤栏 */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* 搜索框 */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索标注内容、文本或标签..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 过滤器 */}
          <div className="flex items-center space-x-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">所有类型</option>
              <option value="highlight">高亮</option>
              <option value="note">笔记</option>
              <option value="bookmark">书签</option>
              <option value="drawing">绘图</option>
            </select>

            <select
              value={filterAuthor}
              onChange={(e) => setFilterAuthor(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">所有作者</option>
              <option value="mine">我的</option>
              <option value="others">他人的</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date">按时间</option>
              <option value="page">按页码</option>
              <option value="type">按类型</option>
            </select>
          </div>
        </div>
      </div>

      {/* 标注列表 */}
      <div className="max-h-96 overflow-y-auto">
        {filteredAnnotations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>暂无符合条件的标注</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredAnnotations.map((annotation) => (
              <div key={annotation.id} className="p-4 hover:bg-gray-50">
                {/* 标注头部 */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    {getAnnotationIcon(annotation.annotation_type, annotation.color)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          {getAnnotationTypeLabel(annotation.annotation_type)}
                        </span>
                        <span className="text-xs text-gray-500">
                          第{annotation.page_number}页
                        </span>
                        {onPageJump && (
                          <button
                            onClick={() => onPageJump(annotation.page_number)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            跳转
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(annotation.created_at)}
                        {annotation.author && (
                          <span className="ml-2">
                            by {annotation.author.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center space-x-1">
                    {annotation.user_id === currentUserId && (
                      <>
                        <button
                          onClick={() => startEdit(annotation)}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded"
                          title="编辑"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onAnnotationDelete(annotation.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => toggleAnnotation(annotation.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                      {expandedAnnotations.has(annotation.id) ? 
                        <ChevronUp className="w-4 h-4" /> : 
                        <ChevronDown className="w-4 h-4" />
                      }
                    </button>
                  </div>
                </div>

                {/* 选中的文本 */}
                {annotation.selected_text && (
                  <div className="mb-2 p-2 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                    <p className="text-sm text-gray-700 italic">
                      "{annotation.selected_text}"
                    </p>
                  </div>
                )}

                {/* 标注内容 */}
                {annotation.content && (
                  <div className="mb-2">
                    {editingAnnotation === annotation.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={3}
                        />
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={saveEdit}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                          >
                            保存
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700">
                        {annotation.content}
                      </p>
                    )}
                  </div>
                )}

                {/* 标签 */}
                {annotation.tags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {annotation.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* 扩展信息 */}
                {expandedAnnotations.has(annotation.id) && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    {/* 交互统计 */}
                    {annotation.interactions && (
                      <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                        <span>{annotation.interactions.likes} 个赞</span>
                        <span>{annotation.interactions.replies} 条回复</span>
                      </div>
                    )}

                    {/* 回复功能 */}
                    {onAnnotationReply && (
                      <div className="mt-2">
                        {replyingTo === annotation.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder="写下你的回复..."
                              className="w-full p-2 border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              rows={2}
                            />
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={sendReply}
                                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                              >
                                回复
                              </button>
                              <button
                                onClick={() => setReplyingTo(null)}
                                className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => startReply(annotation.id)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            添加回复
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}