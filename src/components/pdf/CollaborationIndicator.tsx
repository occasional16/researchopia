'use client';

import React from 'react';
import { User, Users, Wifi, WifiOff } from 'lucide-react';

interface CollaborationUser {
  connectionId: string;
  userId: string;
  cursor?: {
    page: number;
    x: number;
    y: number;
  };
  isTyping?: boolean;
}

interface CollaborationIndicatorProps {
  isConnected: boolean;
  connectionError: string | null;
  collaborationUsers: CollaborationUser[];
  currentUserId: string;
  onReconnect?: () => void;
}

export default function CollaborationIndicator({
  isConnected,
  connectionError,
  collaborationUsers,
  currentUserId,
  onReconnect
}: CollaborationIndicatorProps) {
  // 获取用户头像颜色
  const getUserColor = (userId: string): string => {
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#eab308',
      '#84cc16', '#22c55e', '#10b981', '#14b8a6',
      '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
      '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'
    ];
    
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash;
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  // 获取用户显示名称
  const getUserDisplayName = (userId: string): string => {
    if (userId === currentUserId) return '我';
    return userId.startsWith('demo-') ? 
      `用户${userId.slice(-3)}` : 
      userId.length > 8 ? `${userId.slice(0, 8)}...` : userId;
  };

  const otherUsers = collaborationUsers.filter(user => user.userId !== currentUserId);
  const typingUsers = otherUsers.filter(user => user.isTyping);

  return (
    <div className="flex items-center space-x-3 p-3 bg-gray-50 border-b">
      {/* 连接状态 */}
      <div className="flex items-center space-x-2">
        {isConnected ? (
          <div className="flex items-center space-x-1 text-green-600">
            <Wifi className="w-4 h-4" />
            <span className="text-sm">已连接</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1 text-red-600">
            <WifiOff className="w-4 h-4" />
            <span className="text-sm">
              {connectionError ? '连接失败' : '连接中...'}
            </span>
            {onReconnect && (
              <button
                onClick={onReconnect}
                className="text-xs underline hover:no-underline"
              >
                重试
              </button>
            )}
          </div>
        )}
      </div>

      {/* 在线用户 */}
      {isConnected && (
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">
            {otherUsers.length + 1} 人在线
          </span>
          
          {/* 用户头像列表 */}
          <div className="flex -space-x-2">
            {/* 当前用户 */}
            <div
              className="w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-xs font-medium"
              style={{ backgroundColor: getUserColor(currentUserId) }}
              title="我"
            >
              <User className="w-4 h-4" />
            </div>
            
            {/* 其他用户 */}
            {otherUsers.slice(0, 5).map((user) => (
              <div
                key={user.connectionId}
                className="w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-xs font-medium relative"
                style={{ backgroundColor: getUserColor(user.userId) }}
                title={getUserDisplayName(user.userId)}
              >
                {getUserDisplayName(user.userId).charAt(0).toUpperCase()}
                
                {/* 输入指示器 */}
                {user.isTyping && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-white">
                    <div className="w-full h-full bg-green-500 rounded-full animate-pulse" />
                  </div>
                )}
              </div>
            ))}
            
            {/* 更多用户指示 */}
            {otherUsers.length > 5 && (
              <div
                className="w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center bg-gray-400 text-white text-xs font-medium"
                title={`还有 ${otherUsers.length - 5} 人在线`}
              >
                +{otherUsers.length - 5}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 用户输入状态 */}
      {typingUsers.length > 0 && (
        <div className="flex items-center space-x-1 text-gray-500">
          <div className="flex space-x-1">
            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs">
            {typingUsers.length === 1
              ? `${getUserDisplayName(typingUsers[0].userId)} 正在输入`
              : `${typingUsers.length} 人正在输入`
            }
          </span>
        </div>
      )}

      {/* 错误信息 */}
      {connectionError && (
        <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
          {connectionError}
        </div>
      )}
    </div>
  );
}