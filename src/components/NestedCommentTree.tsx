'use client'

import { useState } from 'react'
import { MessageCircle, Edit, Trash2 } from 'lucide-react'
import { UserDisplay } from '@/components/user'

// 简单的时间格式化函数
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}天前`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}个月前`;
  return `${Math.floor(seconds / 31536000)}年前`;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  reply_count: number;
  username?: string;
  avatar_url?: string | null;
  is_anonymous?: boolean; // 🆕 匿名标志
  children?: Comment[];
}

interface NestedCommentTreeProps {
  comments: Comment[];
  currentUserId?: string;
  currentUserRole?: string; // 🆕 用户角色
  onReply?: (parentId: string, content: string, isAnonymous?: boolean) => Promise<void>; // 🆕 添加匿名参数
  onEdit?: (commentId: string, content: string, isAnonymous?: boolean) => Promise<void>; // 🆕 添加匿名参数
  onDelete?: (commentId: string) => Promise<void>;
  maxDepth?: number;
}

interface CommentNodeProps {
  comment: Comment;
  depth: number;
  maxDepth: number;
  currentUserId?: string;
  currentUserRole?: string; // 🆕 用户角色
  onReply?: (parentId: string, content: string, isAnonymous?: boolean) => Promise<void>; // 🆕 添加匿名参数
  onEdit?: (commentId: string, content: string, isAnonymous?: boolean) => Promise<void>; // 🆕 添加匿名参数
  onDelete?: (commentId: string) => Promise<void>;
}

function CommentNode({
  comment,
  depth,
  maxDepth,
  currentUserId,
  currentUserRole, // 🆕 接收角色参数
  onReply,
  onEdit,
  onDelete,
}: CommentNodeProps) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replyIsAnonymous, setReplyIsAnonymous] = useState(false); // 🆕 回复匿名选项
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [editIsAnonymous, setEditIsAnonymous] = useState(comment.is_anonymous || false); // 🆕 编辑时的匿名状态
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = currentUserId === comment.user_id;
  const canReply = depth < maxDepth;
  
  // 🔍 调试日志
  console.log('[NestedCommentTree] CommentNode render:', {
    commentId: comment.id,
    currentUserId,
    currentUserRole,
    isOwner,
    canDelete: isOwner || currentUserRole === 'admin'
  });

  const handleReply = async () => {
    if (!replyContent.trim() || !onReply) return;

    setIsSubmitting(true);
    try {
      await onReply(comment.id, replyContent.trim(), replyIsAnonymous); // 🆕 传递匿名参数
      setReplyContent('');
      setReplyIsAnonymous(false); // 🆕 重置匿名选项
      setShowReplyBox(false);
    } catch (error) {
      console.error('Reply failed:', error);
      alert('回复失败,请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editContent.trim() || !onEdit) return;

    setIsSubmitting(true);
    try {
      await onEdit(comment.id, editContent.trim(), editIsAnonymous); // 🆕 传递匿名状态
      setIsEditing(false);
    } catch (error) {
      console.error('Edit failed:', error);
      alert('编辑失败,请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    const confirmMessage =
      comment.reply_count > 0
        ? `此评论有 ${comment.reply_count} 条回复,删除后将一并删除。确认删除?`
        : '确认删除此评论?';

    if (!confirm(confirmMessage)) return;

    setIsSubmitting(true);
    try {
      await onDelete(comment.id);
    } catch (error) {
      console.error('Delete failed:', error);
      alert('删除失败,请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="comment-node"
      style={{
        marginLeft: depth > 0 ? '20px' : '0',
        borderLeft: depth > 0 ? '2px solid #e5e7eb' : 'none',
        paddingLeft: depth > 0 ? '12px' : '0',
        marginTop: '12px',
      }}
    >
      {/* 评论头部 */}
      <div className="flex items-start gap-3">
        {/* 使用 UserDisplay 组件 */}
        <UserDisplay
          username={comment.username || 'anonymous'}
          avatarUrl={comment.avatar_url}
          isAnonymous={comment.is_anonymous}
          avatarSize="sm"
          showHoverCard={!comment.is_anonymous}
        />

        {/* 评论内容 */}
        <div className="flex-1 min-w-0">
          {/* 时间和回复数 */}
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <span>{formatTimeAgo(comment.created_at)}</span>
            {comment.reply_count > 0 && (
              <>
                <span>·</span>
                <span className="text-blue-600">
                  {comment.reply_count} 条回复
                </span>
              </>
            )}
          </div>

          {/* 评论文本 */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                disabled={isSubmitting}
              />
              {/* 🆕 编辑时的匿名选项 */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`edit-anonymous-${comment.id}`}
                  checked={editIsAnonymous}
                  onChange={(e) => setEditIsAnonymous(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <label 
                  htmlFor={`edit-anonymous-${comment.id}`} 
                  className="text-xs text-gray-600 cursor-pointer select-none"
                >
                  匿名显示
                  {editIsAnonymous && (
                    <span className="ml-1 text-blue-600">（将显示为"匿名用户"）</span>
                  )}
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  disabled={isSubmitting || !editContent.trim()}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                    setEditIsAnonymous(comment.is_anonymous || false);
                  }}
                  disabled={isSubmitting}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-800 whitespace-pre-wrap break-words">
              {comment.content}
            </p>
          )}

          {/* 操作按钮 */}
          {!isEditing && (
            <div className="flex gap-4 mt-2 text-sm">
              {canReply && onReply && (
                <button
                  onClick={() => setShowReplyBox(!showReplyBox)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  回复
                </button>
              )}
              {isOwner && onEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-gray-600 hover:text-gray-800"
                >
                  编辑
                </button>
              )}
              {/* 🔑 管理员可以删除任意评论,普通用户只能删除自己的 */}
              {((isOwner || currentUserRole === 'admin') && onDelete) && (
                <button
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  {currentUserRole === 'admin' && !isOwner ? '删除(管理员)' : '删除'}
                </button>
              )}
            </div>
          )}

          {/* 回复框 */}
          {showReplyBox && (
            <div className="mt-3 space-y-2">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={`回复 @${comment.is_anonymous ? '匿名用户' : (comment.username || '用户')}...`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                disabled={isSubmitting}
              />
              {/* 🆕 匿名选项 */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`anonymous-reply-${comment.id}`}
                  checked={replyIsAnonymous}
                  onChange={(e) => setReplyIsAnonymous(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <label 
                  htmlFor={`anonymous-reply-${comment.id}`} 
                  className="text-xs text-gray-600 cursor-pointer select-none"
                >
                  匿名回复
                  {replyIsAnonymous && (
                    <span className="ml-1 text-blue-600">（将显示为"匿名用户"）</span>
                  )}
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReply}
                  disabled={isSubmitting || !replyContent.trim()}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? '发送中...' : '发送'}
                </button>
                <button
                  onClick={() => {
                    setShowReplyBox(false);
                    setReplyContent('');
                    setReplyIsAnonymous(false); // 🆕 重置匿名选项
                  }}
                  disabled={isSubmitting}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 递归渲染子评论 */}
      {comment.children && comment.children.length > 0 && (
        <div className="mt-2">
          {comment.children.map((child) => (
            <CommentNode
              key={child.id}
              comment={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NestedCommentTree({
  comments,
  currentUserId,
  currentUserRole, // 🆕 解构currentUserRole参数
  onReply,
  onEdit,
  onDelete,
  maxDepth = 5,
}: NestedCommentTreeProps) {
  // 构建评论树结构
  const buildTree = (flatComments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    // 第一遍:创建所有评论的副本并建立映射
    flatComments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, children: [] });
    });

    // 第二遍:建立父子关系
    flatComments.forEach((comment) => {
      const node = commentMap.get(comment.id)!;
      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        } else {
          // 父评论不存在,作为根评论
          rootComments.push(node);
        }
      } else {
        rootComments.push(node);
      }
    });

    return rootComments;
  };

  const commentTree = buildTree(comments);

  if (commentTree.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        暂无评论,来发表第一条评论吧!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {commentTree.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          depth={0}
          maxDepth={maxDepth}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole} // 🆕 传递currentUserRole
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
