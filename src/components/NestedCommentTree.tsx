'use client'

import { useState } from 'react'
import { MessageCircle, Edit, Trash2, ThumbsUp } from 'lucide-react'
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
  is_anonymous?: boolean;
  like_count?: number;
  has_liked?: boolean;
  children?: Comment[];
}

interface NestedCommentTreeProps {
  comments: Comment[];
  currentUserId?: string;
  currentUserRole?: string;
  accessToken?: string;
  onReply?: (parentId: string, content: string, isAnonymous?: boolean) => Promise<void>;
  onEdit?: (commentId: string, content: string, isAnonymous?: boolean) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onLike?: (commentId: string) => Promise<void>;
  maxDepth?: number;
}

interface CommentNodeProps {
  comment: Comment;
  depth: number;
  maxDepth: number;
  currentUserId?: string;
  currentUserRole?: string;
  accessToken?: string;
  onReply?: (parentId: string, content: string, isAnonymous?: boolean) => Promise<void>;
  onEdit?: (commentId: string, content: string, isAnonymous?: boolean) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onLike?: (commentId: string) => Promise<void>;
}

function CommentNode({
  comment,
  depth,
  maxDepth,
  currentUserId,
  currentUserRole,
  accessToken,
  onReply,
  onEdit,
  onDelete,
  onLike,
}: CommentNodeProps) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replyIsAnonymous, setReplyIsAnonymous] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [editIsAnonymous, setEditIsAnonymous] = useState(comment.is_anonymous || false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.like_count || 0);
  const [hasLiked, setHasLiked] = useState(comment.has_liked || false);
  const [isLiking, setIsLiking] = useState(false);

  const isOwner = currentUserId === comment.user_id;
  const canReply = depth < maxDepth;

  const handleLike = async () => {
    if (!currentUserId || !accessToken) {
      alert('请先登录');
      return;
    }
    
    if (isLiking) return;
    
    setIsLiking(true);
    try {
      const response = await fetch('/api/paper-comments/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ commentId: comment.id })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setLikeCount(data.likeCount);
        setHasLiked(data.hasLiked);
      }
    } catch (error) {
      console.error('Failed to vote:', error);
    } finally {
      setIsLiking(false);
    }
  };

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
        marginLeft: depth > 0 ? '12px' : '0',
        borderLeft: depth > 0 ? '2px solid #e5e7eb' : 'none',
        paddingLeft: depth > 0 ? '8px' : '0',
        marginTop: '8px',
      }}
    >
      {/* 评论头部 */}
      <div className="flex items-start gap-2">
        {/* 使用 UserDisplay 组件 */}
        <UserDisplay
          username={comment.username || 'anonymous'}
          avatarUrl={comment.avatar_url}
          isAnonymous={comment.is_anonymous}
          avatarSize="xs"
          showHoverCard={!comment.is_anonymous}
        />

        {/* 评论内容 */}
        <div className="flex-1 min-w-0">
          {/* 时间和回复数 */}
          <div className="flex items-center gap-1.5 text-[10px] text-gray-600 dark:text-gray-400 mb-0.5">
            <span>{formatTimeAgo(comment.created_at)}</span>
            {comment.reply_count > 0 && (
              <>
                <span>·</span>
                <span className="text-blue-600 dark:text-blue-400">
                  {comment.reply_count} 条回复
                </span>
              </>
            )}
          </div>

          {/* 评论文本 */}
          {isEditing ? (
            <div className="space-y-1.5">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                rows={2}
                disabled={isSubmitting}
              />
              {/* 🆕 编辑时的匿名选项 */}
              <div className="flex items-center space-x-1.5">
                <input
                  type="checkbox"
                  id={`edit-anonymous-${comment.id}`}
                  checked={editIsAnonymous}
                  onChange={(e) => setEditIsAnonymous(e.target.checked)}
                  className="w-3 h-3 text-blue-600 dark:text-blue-500 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <label 
                  htmlFor={`edit-anonymous-${comment.id}`} 
                  className="text-[10px] text-gray-600 dark:text-gray-400 cursor-pointer select-none"
                >
                  匿名显示
                  {editIsAnonymous && (
                    <span className="ml-0.5 text-blue-600 dark:text-blue-400">（将显示为"匿名用户"）</span>
                  )}
                </label>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={handleEdit}
                  disabled={isSubmitting || !editContent.trim()}
                  className="px-2 py-0.5 text-[10px] bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="px-2 py-0.5 text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
              {comment.content}
            </p>
          )}

          {/* 操作按钮 */}
          {!isEditing && (
            <div className="flex items-center gap-2.5 mt-1 text-[10px]">
              {/* 点赞按钮 */}
              <button
                onClick={handleLike}
                disabled={isLiking}
                className={`flex items-center gap-0.5 transition-colors ${
                  hasLiked 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
                } disabled:opacity-50`}
                title={currentUserId ? (hasLiked ? '取消点赞' : '点赞') : '登录后可点赞'}
              >
                <ThumbsUp size={10} className={hasLiked ? 'fill-current' : ''} />
                <span>{likeCount > 0 ? likeCount : ''}</span>
              </button>
              
              {canReply && onReply && (
                <button
                  onClick={() => setShowReplyBox(!showReplyBox)}
                  className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  回复
                </button>
              )}
              {isOwner && onEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300"
                >
                  编辑
                </button>
              )}
              {/* 管理员可以删除任意评论,普通用户只能删除自己的 */}
              {((isOwner || currentUserRole === 'admin') && onDelete) && (
                <button
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50"
                >
                  {currentUserRole === 'admin' && !isOwner ? '删除(管理员)' : '删除'}
                </button>
              )}
            </div>
          )}

          {/* 回复框 */}
          {showReplyBox && (
            <div className="mt-2 space-y-1.5">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={`回复 @${comment.is_anonymous ? '匿名用户' : (comment.username || '用户')}...`}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                rows={2}
                disabled={isSubmitting}
              />
              {/* 🆕 匿名选项 */}
              <div className="flex items-center space-x-1.5">
                <input
                  type="checkbox"
                  id={`anonymous-reply-${comment.id}`}
                  checked={replyIsAnonymous}
                  onChange={(e) => setReplyIsAnonymous(e.target.checked)}
                  className="w-3 h-3 text-blue-600 dark:text-blue-500 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <label 
                  htmlFor={`anonymous-reply-${comment.id}`} 
                  className="text-[10px] text-gray-600 dark:text-gray-400 cursor-pointer select-none"
                >
                  匿名回复
                  {replyIsAnonymous && (
                    <span className="ml-0.5 text-blue-600 dark:text-blue-400">（将显示为"匿名用户"）</span>
                  )}
                </label>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={handleReply}
                  disabled={isSubmitting || !replyContent.trim()}
                  className="px-2 py-0.5 text-[10px] bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="px-2 py-0.5 text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
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
        <div className="mt-1">
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
              accessToken={accessToken}
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
  currentUserRole,
  onReply,
  onEdit,
  onDelete,
  maxDepth = 5,
  accessToken,
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
      <div className="text-center py-4 text-xs text-gray-500 dark:text-gray-400">
        暂无评论,来发表第一条评论吧!
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {commentTree.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          depth={0}
          maxDepth={maxDepth}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          accessToken={accessToken}
        />
      ))}
    </div>
  );
}
