/*
  Collaborative Annotation Viewer Component
  Demonstrates real-time collaborative annotation features
*/

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCollaboration, CollaborationStatus, ActiveUsers } from '@/hooks/useCollaboration';
import { UniversalAnnotation } from '@/types/annotation-protocol';

interface CollaborativeAnnotationViewerProps {
  documentId: string;
  userId: string;
  serverUrl?: string;
  token?: string;
  initialAnnotations?: UniversalAnnotation[];
}

export const CollaborativeAnnotationViewer: React.FC<CollaborativeAnnotationViewerProps> = ({
  documentId,
  userId,
  serverUrl,
  token,
  initialAnnotations = []
}) => {
  const [annotations, setAnnotations] = useState<UniversalAnnotation[]>(initialAnnotations);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [newAnnotationText, setNewAnnotationText] = useState('');
  const [conflicts, setConflicts] = useState<Array<{
    id: string;
    currentVersion: number;
    expectedVersion: number;
    currentAnnotation: any;
  }>>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const collaboration = useCollaboration({
    serverUrl: serverUrl || 'ws://localhost:8080',
    documentId,
    userId,
    token,
    enableCursorTracking: true,
    enableLocking: true,
    autoConnect: true
  });

  // 注册协作事件处理器
  useEffect(() => {
    collaboration.onAnnotationCreated((annotation, fromUserId) => {
      if (fromUserId !== userId) {
        setAnnotations(prev => [...prev, annotation]);
        showNotification(`${fromUserId} 添加了一个标注`, 'info');
      }
    });

    collaboration.onAnnotationUpdated((id, changes, version, fromUserId) => {
      if (fromUserId !== userId) {
        setAnnotations(prev => prev.map(ann => 
          ann.id === id 
            ? { ...ann, ...changes, metadata: { ...ann.metadata, version } }
            : ann
        ));
        showNotification(`${fromUserId} 更新了标注`, 'info');
      }
    });

    collaboration.onAnnotationDeleted((id, fromUserId) => {
      if (fromUserId !== userId) {
        setAnnotations(prev => prev.filter(ann => ann.id !== id));
        showNotification(`${fromUserId} 删除了标注`, 'warning');
        
        if (selectedAnnotation === id) {
          setSelectedAnnotation(null);
        }
        if (editingAnnotation === id) {
          setEditingAnnotation(null);
        }
      }
    });

    collaboration.onConflict((id, currentVersion, expectedVersion, currentAnnotation) => {
      setConflicts(prev => [...prev, {
        id,
        currentVersion,
        expectedVersion,
        currentAnnotation
      }]);
      showNotification(`标注 "${currentAnnotation.content.text}" 发生冲突`, 'error');
    });
  }, [collaboration, userId, selectedAnnotation, editingAnnotation]);

  // 创建新标注
  const handleCreateAnnotation = async () => {
    if (!newAnnotationText.trim()) return;

    const newAnnotation: Partial<UniversalAnnotation> = {
      type: 'note',
      documentId,
      position: {
        documentType: 'text',
        text: {
          startOffset: 0,
          endOffset: newAnnotationText.length,
          context: newAnnotationText
        }
      },
      content: {
        text: newAnnotationText,
        comment: '',
        color: '#ffd400'
      },
      metadata: {
        platform: 'zotero' as const,
        version: '1.0',
        author: {
          id: userId,
          name: userId,
          platform: 'zotero' as const,
          isAuthoritative: true
        },
        tags: [],
        visibility: 'shared'
      },
      extensions: {}
    };

    const success = await collaboration.createAnnotation(newAnnotation);
    if (success) {
      // 乐观更新：立即添加到本地状态
      const optimisticAnnotation: UniversalAnnotation = {
        ...newAnnotation,
        id: generateTempId(),
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      } as UniversalAnnotation;
      
      setAnnotations(prev => [...prev, optimisticAnnotation]);
      setNewAnnotationText('');
      showNotification('标注已创建', 'success');
    } else {
      showNotification('创建标注失败', 'error');
    }
  };

  // 更新标注
  const handleUpdateAnnotation = async (id: string, changes: any) => {
    const annotation = annotations.find(ann => ann.id === id);
    if (!annotation) return;

    // 尝试获取锁
    const lockAcquired = await collaboration.acquireLock(id, 'edit');
    if (!lockAcquired) {
      const lockInfo = collaboration.state.locks[id];
      if (lockInfo) {
        showNotification(`标注正在被 ${lockInfo.userId} 编辑`, 'warning');
        return;
      }
    }

    const expectedVersion = typeof annotation.metadata?.version === 'number' ? annotation.metadata.version : 1;
    const success = await collaboration.updateAnnotation(id, changes, expectedVersion);
    
    if (success) {
      // 乐观更新
      setAnnotations(prev => prev.map(ann => 
        ann.id === id 
          ? { 
              ...ann, 
              ...changes, 
              modifiedAt: new Date().toISOString(),
              metadata: {
                ...ann.metadata,
                version: (typeof ann.metadata?.version === 'number' ? ann.metadata.version : 1) + 1
              }
            }
          : ann
      ));
      
      // 释放锁
      await collaboration.releaseLock(id);
      setEditingAnnotation(null);
      showNotification('标注已更新', 'success');
    } else {
      showNotification('更新标注失败', 'error');
    }
  };

  // 删除标注
  const handleDeleteAnnotation = async (id: string) => {
    if (!confirm('确定要删除这个标注吗？')) return;

    const success = await collaboration.deleteAnnotation(id);
    if (success) {
      // 乐观更新
      setAnnotations(prev => prev.filter(ann => ann.id !== id));
      if (selectedAnnotation === id) setSelectedAnnotation(null);
      showNotification('标注已删除', 'success');
    } else {
      showNotification('删除标注失败', 'error');
    }
  };

  // 开始编辑标注
  const startEditing = async (id: string) => {
    const lockAcquired = await collaboration.acquireLock(id, 'edit');
    if (lockAcquired) {
      setEditingAnnotation(id);
      // 聚焦到编辑框
      setTimeout(() => textareaRef.current?.focus(), 0);
    } else {
      const lockInfo = collaboration.state.locks[id];
      if (lockInfo) {
        showNotification(`标注正在被 ${lockInfo.userId} 编辑`, 'warning');
      }
    }
  };

  // 取消编辑
  const cancelEditing = async () => {
    if (editingAnnotation) {
      await collaboration.releaseLock(editingAnnotation);
    }
    setEditingAnnotation(null);
  };

  // 解决冲突
  const resolveConflict = (conflictIndex: number, useCurrentVersion: boolean) => {
    const conflict = conflicts[conflictIndex];
    if (!conflict) return;

    if (useCurrentVersion) {
      // 使用服务器上的当前版本
      setAnnotations(prev => prev.map(ann =>
        ann.id === conflict.id ? conflict.currentAnnotation : ann
      ));
    }
    // 如果使用本地版本，不需要做任何操作

    // 移除冲突
    setConflicts(prev => prev.filter((_, index) => index !== conflictIndex));
  };

  // 显示通知
  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    // 这里可以集成实际的通知系统
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // 简单的浏览器通知（如果允许）
    if (Notification.permission === 'granted' && type !== 'success') {
      new Notification(`研学港标注`, { body: message });
    }
  };

  // 生成临时ID
  const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 头部状态栏 */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold">协作标注</h2>
          <CollaborationStatus state={collaboration.state} />
        </div>
        <ActiveUsers 
          users={collaboration.state.activeUsers}
          currentUserId={userId}
        />
      </div>

      {/* 冲突提示 */}
      {conflicts.length > 0 && (
        <div className="p-4 bg-red-50 border-b">
          <h3 className="text-sm font-medium text-red-800 mb-2">发现冲突</h3>
          {conflicts.map((conflict, index) => (
            <div key={`${conflict.id}-${index}`} className="mb-2 p-2 bg-white rounded border">
              <p className="text-sm text-gray-700 mb-2">
                标注 "{conflict.currentAnnotation.content?.text || 'Untitled'}" 版本冲突
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => resolveConflict(index, true)}
                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  使用服务器版本
                </button>
                <button
                  onClick={() => resolveConflict(index, false)}
                  className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  保留本地版本
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 主要内容区域 */}
      <div className="flex-1 flex">
        {/* 标注列表 */}
        <div className="w-1/2 border-r">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-medium">标注列表 ({annotations.length})</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {annotations.map(annotation => {
              const isSelected = selectedAnnotation === annotation.id;
              const isEditing = editingAnnotation === annotation.id;
              const isLocked = collaboration.state.locks[annotation.id];
              const isLockedByOthers = isLocked && isLocked.userId !== userId;
              
              return (
                <div
                  key={annotation.id}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                    isSelected ? 'bg-blue-50 border-blue-200' : ''
                  } ${isLockedByOthers ? 'bg-yellow-50' : ''}`}
                  onClick={() => setSelectedAnnotation(annotation.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {annotation.content?.text || 'Untitled'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        由 {annotation.metadata.author.name} 创建
                        {annotation.modifiedAt !== annotation.createdAt && ' (已修改)'}
                      </p>
                      {isLockedByOthers && (
                        <p className="text-xs text-yellow-600 mt-1">
                          🔒 {isLocked.userId} 正在编辑
                        </p>
                      )}
                    </div>
                    
                    <div className="flex space-x-1 ml-2">
                      {annotation.metadata.author.id === userId && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isEditing) {
                                cancelEditing();
                              } else {
                                startEditing(annotation.id);
                              }
                            }}
                            disabled={isLockedByOthers}
                            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
                          >
                            {isEditing ? '取消' : '编辑'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAnnotation(annotation.id);
                            }}
                            disabled={isLockedByOthers}
                            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300"
                          >
                            删除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 标注详情/编辑区域 */}
        <div className="w-1/2 flex flex-col">
          {selectedAnnotation ? (
            <div className="flex-1 flex flex-col">
              {(() => {
                const annotation = annotations.find(ann => ann.id === selectedAnnotation);
                if (!annotation) return <div className="p-4">标注未找到</div>;
                
                const isEditing = editingAnnotation === selectedAnnotation;
                
                return (
                  <div className="flex-1 flex flex-col">
                    <div className="p-4 border-b bg-gray-50">
                      <h3 className="font-medium">标注详情</h3>
                    </div>
                    
                    <div className="flex-1 p-4">
                      {isEditing ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              标注内容
                            </label>
                            <textarea
                              ref={textareaRef}
                              className="w-full p-3 border rounded-md resize-none"
                              rows={6}
                              defaultValue={annotation.content?.text || ''}
                              placeholder="输入标注内容..."
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              备注
                            </label>
                            <textarea
                              className="w-full p-3 border rounded-md resize-none"
                              rows={3}
                              defaultValue={annotation.content?.comment || ''}
                              placeholder="添加备注..."
                            />
                          </div>
                          
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                const textContent = textareaRef.current?.value || '';
                                handleUpdateAnnotation(selectedAnnotation, {
                                  content: {
                                    ...annotation.content,
                                    text: textContent
                                  }
                                });
                              }}
                              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              保存
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">内容</h4>
                            <p className="text-gray-700 bg-gray-50 p-3 rounded">
                              {annotation.content?.text || '无内容'}
                            </p>
                          </div>
                          
                          {annotation.content?.comment && (
                            <div>
                              <h4 className="font-medium mb-2">备注</h4>
                              <p className="text-gray-700 bg-gray-50 p-3 rounded">
                                {annotation.content.comment}
                              </p>
                            </div>
                          )}
                          
                          <div>
                            <h4 className="font-medium mb-2">元信息</h4>
                            <div className="text-sm text-gray-600 space-y-1">
                              <p>创建者: {annotation.metadata.author.name}</p>
                              <p>创建时间: {new Date(annotation.createdAt).toLocaleString()}</p>
                              {annotation.modifiedAt !== annotation.createdAt && (
                                <p>修改时间: {new Date(annotation.modifiedAt).toLocaleString()}</p>
                              )}
                              <p>版本: {annotation.metadata.version || 1}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              选择一个标注查看详情
            </div>
          )}
        </div>
      </div>

      {/* 底部新建标注区域 */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newAnnotationText}
            onChange={(e) => setNewAnnotationText(e.target.value)}
            placeholder="添加新标注..."
            className="flex-1 px-3 py-2 border rounded-md"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleCreateAnnotation();
              }
            }}
          />
          <button
            onClick={handleCreateAnnotation}
            disabled={!newAnnotationText.trim() || !collaboration.state.isConnected}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );
};