/*
  Annotation Display Component
  Renders individual annotations with interactive features
*/

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UniversalAnnotation } from '@/types/annotation-protocol';

interface AnnotationCardProps {
  annotation: UniversalAnnotation;
  isSelected?: boolean;
  isEditing?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  showDocument?: boolean;
  onSelect?: (annotation: UniversalAnnotation) => void;
  onEdit?: (annotation: UniversalAnnotation) => void;
  onDelete?: (annotation: UniversalAnnotation) => void;
  onSave?: (annotation: UniversalAnnotation, changes: any) => void;
  onCancel?: () => void;
  onComment?: (annotation: UniversalAnnotation, comment: string) => void;
  onTag?: (annotation: UniversalAnnotation, tags: string[]) => void;
}

export const AnnotationCard: React.FC<AnnotationCardProps> = ({
  annotation,
  isSelected = false,
  isEditing = false,
  canEdit = false,
  canDelete = false,
  showDocument = true,
  onSelect,
  onEdit,
  onDelete,
  onSave,
  onCancel,
  onComment,
  onTag
}) => {
  const [editText, setEditText] = useState(annotation.content?.text || '');
  const [editComment, setEditComment] = useState(annotation.content?.comment || '');
  const [editTags, setEditTags] = useState<string[]>(annotation.metadata.tags || []);
  const [newTag, setNewTag] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // 编辑模式时聚焦到文本框
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // 处理保存
  const handleSave = () => {
    const changes = {
      content: {
        ...annotation.content,
        text: editText,
        comment: editComment
      },
      metadata: {
        ...annotation.metadata,
        tags: editTags
      }
    };
    onSave?.(annotation, changes);
  };

  // 处理取消
  const handleCancel = () => {
    setEditText(annotation.content?.text || '');
    setEditComment(annotation.content?.comment || '');
    setEditTags(annotation.metadata.tags || []);
    onCancel?.();
  };

  // 添加标签
  const addTag = () => {
    if (newTag.trim() && !editTags.includes(newTag.trim())) {
      setEditTags([...editTags, newTag.trim()]);
      setNewTag('');
    }
  };

  // 移除标签
  const removeTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(tag => tag !== tagToRemove));
  };

  // 提交评论
  const handleCommentSubmit = () => {
    if (newComment.trim()) {
      onComment?.(annotation, newComment.trim());
      setNewComment('');
    }
  };

  // 获取平台图标
  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      zotero: '🦓',
      mendeley: '🔴',
      hypothesis: '📝',
      'adobe-reader': '📄'
    };
    return icons[platform] || '📋';
  };

  // 获取类型图标
  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      highlight: '🟨',
      note: '📝',
      underline: '📏',
      ink: '✏️',
      image: '🖼️'
    };
    return icons[type] || '📄';
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes === 0 ? '刚刚' : `${minutes}分钟前`;
      }
      return `${hours}小时前`;
    }
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    if (days < 30) return `${Math.floor(days / 7)}周前`;
    if (days < 365) return `${Math.floor(days / 30)}个月前`;
    return `${Math.floor(days / 365)}年前`;
  };

  return (
    <div
      ref={cardRef}
      className={`bg-white border rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${
        isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200'
      } ${isEditing ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
      onClick={() => !isEditing && onSelect?.(annotation)}
    >
      {/* 头部 */}
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span title={`平台: ${annotation.metadata.platform}`}>
              {getPlatformIcon(annotation.metadata.platform)}
            </span>
            <span title={`类型: ${annotation.type}`}>
              {getTypeIcon(annotation.type)}
            </span>
            <span>{annotation.metadata.author.name}</span>
            <span>•</span>
            <span title={new Date(annotation.createdAt).toLocaleString()}>
              {formatTime(annotation.createdAt)}
            </span>
            {annotation.modifiedAt !== annotation.createdAt && (
              <>
                <span>•</span>
                <span 
                  className="text-orange-600"
                  title={`修改时间: ${new Date(annotation.modifiedAt).toLocaleString()}`}
                >
                  已修改
                </span>
              </>
            )}
          </div>
          
          {/* 操作按钮 */}
          <div className="flex items-center space-x-1">
            {canEdit && !isEditing && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(annotation);
                }}
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                title="编辑"
              >
                ✏️
              </button>
            )}
            {canDelete && !isEditing && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('确定要删除这个标注吗？')) {
                    onDelete?.(annotation);
                  }
                }}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                title="删除"
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="px-4 pb-2">
        {isEditing ? (
          <div className="space-y-3">
            {/* 编辑文本内容 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                标注内容
              </label>
              <textarea
                ref={textareaRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="输入标注内容..."
              />
            </div>

            {/* 编辑评论 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                备注
              </label>
              <textarea
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={2}
                placeholder="添加备注..."
              />
            </div>

            {/* 编辑标签 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                标签
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {editTags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                  placeholder="添加标签..."
                />
                <button
                  onClick={addTag}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  添加
                </button>
              </div>
            </div>

            {/* 编辑操作按钮 */}
            <div className="flex space-x-2 pt-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
              >
                保存
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* 标注内容 */}
            {annotation.content?.text && (
              <div className="text-gray-800">
                <div className="relative">
                  {annotation.content.color && (
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 rounded"
                      style={{ backgroundColor: annotation.content.color }}
                    />
                  )}
                  <div className="pl-3">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {annotation.content.text}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 评论 */}
            {annotation.content?.comment && (
              <div className="bg-gray-50 p-3 rounded border-l-4 border-gray-300">
                <p className="text-sm text-gray-700 italic">
                  {annotation.content.comment}
                </p>
              </div>
            )}

            {/* 文档信息 */}
            {showDocument && annotation.documentId && (
              <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                文档: {annotation.documentId}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 标签和元信息 */}
      {!isEditing && (
        <div className="px-4 pb-3">
          {/* 标签 */}
          {annotation.metadata.tags && annotation.metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {annotation.metadata.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-block px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    // 可以触发按标签筛选
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* 底部操作栏 */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-3">
              {/* 评论数量 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowComments(!showComments);
                }}
                className="flex items-center space-x-1 hover:text-blue-600"
              >
                <span>💬</span>
                <span>评论</span>
              </button>

              {/* 分享按钮 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // 实现分享功能
                  navigator.clipboard.writeText(
                    `${annotation.content?.text}\n\n来自: ${annotation.metadata.author.name}`
                  );
                }}
                className="flex items-center space-x-1 hover:text-blue-600"
                title="复制到剪贴板"
              >
                <span>📋</span>
                <span>复制</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {/* 可见性指示 */}
              <span className="flex items-center space-x-1">
                <span>
                  {annotation.metadata.visibility === 'public' ? '🌐' : 
                   annotation.metadata.visibility === 'shared' ? '👥' : '🔒'}
                </span>
                <span>
                  {annotation.metadata.visibility === 'public' ? '公开' : 
                   annotation.metadata.visibility === 'shared' ? '共享' : '私有'}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 评论区域 */}
      {showComments && !isEditing && (
        <div className="border-t bg-gray-50 p-4">
          <div className="space-y-2">
            {/* 这里可以显示现有评论 */}
            <p className="text-sm text-gray-500">暂无评论</p>
            
            {/* 添加评论 */}
            <div className="flex space-x-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="添加评论..."
                className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCommentSubmit();
                  }
                }}
              />
              <button
                onClick={handleCommentSubmit}
                disabled={!newComment.trim()}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:bg-gray-300"
              >
                评论
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};