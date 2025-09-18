'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Upload, Link, Loader } from 'lucide-react';
import AnnotationManager from '@/components/pdf/AnnotationManager';
import CollaborationIndicator from '@/components/pdf/CollaborationIndicator';
import { useWebSocketCollaboration } from '@/hooks/useWebSocketCollaboration';

// 动态导入PDF查看器，避免SSR问题
const IframePDFViewer = dynamic(
  () => import('./IframePDFViewer'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 animate-spin" />
        <span className="ml-2">加载PDF查看器...</span>
      </div>
    )
  }
);

export default function PDFDemoPage() {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [documentId, setDocumentId] = useState<string>('demo-doc-001');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [collaborationEnabled, setCollaborationEnabled] = useState<boolean>(true);

  // 实时协作功能
  const collaboration = useWebSocketCollaboration({
    documentId,
    userId: 'demo-user',
    enabled: collaborationEnabled,
    onAnnotationCreated: (annotation) => {
      console.log('🔄 收到新标注:', annotation);
      setAnnotations(prev => [...prev, annotation]);
    },
    onAnnotationUpdated: (annotation) => {
      console.log('🔄 标注已更新:', annotation);
      setAnnotations(prev => 
        prev.map(ann => ann.id === annotation.id ? { ...ann, ...annotation } : ann)
      );
    },
    onAnnotationDeleted: (annotationId) => {
      console.log('🔄 标注已删除:', annotationId);
      setAnnotations(prev => prev.filter(ann => ann.id !== annotationId));
    },
    onUserJoined: (user) => {
      console.log('👤 用户加入:', user.userId);
    },
    onUserLeft: (userId) => {
      console.log('👋 用户离开:', userId);
    },
    onCursorMove: (userId, cursor) => {
      console.log('🖱️ 用户光标移动:', userId, cursor);
    },
    onUserTyping: (userId, isTyping) => {
      console.log('⌨️ 用户输入状态:', userId, isTyping);
    }
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('请选择PDF文件');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setFileName(file.name);
    } catch (err) {
      console.error('文件上传错误:', err);
      setError('文件上传失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUrlSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const url = formData.get('pdfUrl') as string;

    if (!url) return;

    setLoading(true);
    setError(null);

    try {
      setPdfUrl(url);
      setFileName(url.split('/').pop() || 'PDF文档');
    } catch (err) {
      console.error('URL加载错误:', err);
      setError('URL加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadExamplePDF = (url: string, name: string) => {
    setLoading(true);
    setError(null);
    
    try {
      setPdfUrl(url);
      setFileName(name);
    } catch (err) {
      console.error('示例PDF加载错误:', err);
      setError('示例PDF加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 示例PDF列表
  const examplePDFs = [
    {
      name: 'Sample Academic Paper',
      url: 'https://arxiv.org/pdf/2301.00001.pdf'
    },
    {
      name: 'PDF.js Test Document',
      url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf'
    }
  ];

  // 创建标注的函数
  const handleCreateAnnotation = async (annotation: any) => {
    try {
      const response = await fetch('/api/pdf/annotations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(annotation)
      });

      if (!response.ok) {
        throw new Error('创建标注失败');
      }

      const newAnnotation = await response.json();
      console.log('✅ 标注创建成功:', newAnnotation);
      
      // 更新本地标注列表
      setAnnotations(prev => [...prev, newAnnotation.annotation]);
      
      // 通知其他协作者
      collaboration.notifyAnnotationCreated(newAnnotation.annotation);
    } catch (error) {
      console.error('❌ 创建标注失败:', error);
      throw error;
    }
  };

  // 更新标注
  const handleUpdateAnnotation = async (id: string, updates: any) => {
    try {
      const response = await fetch(`/api/pdf/annotations`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, ...updates })
      });

      if (!response.ok) {
        throw new Error('更新标注失败');
      }

      const updatedAnnotation = await response.json();
      console.log('✅ 标注更新成功:', updatedAnnotation);
      
      // 更新本地标注列表
      const updatedData = { id, ...updates };
      setAnnotations(prev => 
        prev.map(ann => ann.id === id ? { ...ann, ...updatedData } : ann)
      );
      
      // 通知其他协作者
      collaboration.notifyAnnotationUpdated(updatedData);
    } catch (error) {
      console.error('❌ 更新标注失败:', error);
      throw error;
    }
  };

  // 删除标注
  const handleDeleteAnnotation = async (id: string) => {
    try {
      const response = await fetch(`/api/pdf/annotations`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id })
      });

      if (!response.ok) {
        throw new Error('删除标注失败');
      }

      console.log('✅ 标注删除成功');
      
      // 更新本地标注列表
      setAnnotations(prev => prev.filter(ann => ann.id !== id));
      
      // 通知其他协作者
      collaboration.notifyAnnotationDeleted(id);
    } catch (error) {
      console.error('❌ 删除标注失败:', error);
      throw error;
    }
  };

  // 回复标注
  const handleReplyAnnotation = async (parentId: string, content: string) => {
    // 创建回复标注
    const replyAnnotation = {
      pdf_document_id: documentId,
      user_id: 'demo-user',
      page_number: currentPage,
      annotation_type: 'note' as const,
      position_data: {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      },
      content,
      color: '#0066cc',
      opacity: 0.3,
      tags: ['回复'],
      is_private: false,
      reply_to: parentId
    };

    await handleCreateAnnotation(replyAnnotation);
  };

  // 跳转到指定页面
  const handlePageJump = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    // 这里可以添加与PDF查看器的通信逻辑
  };

  // 加载标注列表
  const loadAnnotations = async () => {
    try {
      const response = await fetch(`/api/pdf/annotations?document_id=${documentId}`);
      if (response.ok) {
        const result = await response.json();
        setAnnotations(result.annotations || []);
      }
    } catch (error) {
      console.error('加载标注失败:', error);
    }
  };

  // 当文档改变时加载标注
  useEffect(() => {
    if (documentId) {
      loadAnnotations();
    }
  }, [documentId]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            智能PDF阅读器
          </h1>
          <p className="text-gray-600">
            支持PDF文档阅读、标注和协作
          </p>
        </div>

        {/* 文件上传和URL输入区域 */}
        {!pdfUrl && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 文件上传 */}
              <div className="space-y-4">
                <h2 className="text-lg font-medium flex items-center">
                  <Upload className="w-5 h-5 mr-2" />
                  上传PDF文件
                </h2>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label
                    htmlFor="pdf-upload"
                    className="cursor-pointer block"
                  >
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">
                      点击选择PDF文件或拖拽到此处
                    </p>
                    <p className="text-sm text-gray-500">
                      支持PDF格式，最大50MB
                    </p>
                  </label>
                </div>
              </div>

              {/* URL输入 */}
              <div className="space-y-4">
                <h2 className="text-lg font-medium flex items-center">
                  <Link className="w-5 h-5 mr-2" />
                  从URL加载
                </h2>
                <form onSubmit={handleUrlSubmit} className="space-y-4">
                  <div>
                    <input
                      type="url"
                      name="pdfUrl"
                      placeholder="请输入PDF文档URL"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin mr-2" />
                        加载中...
                      </>
                    ) : (
                      '加载PDF'
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* 示例PDF */}
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-4">示例PDF文档</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {examplePDFs.map((pdf, index) => (
                  <button
                    key={index}
                    onClick={() => loadExamplePDF(pdf.url, pdf.name)}
                    disabled={loading}
                    className="p-4 border border-gray-300 rounded-lg text-left hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="font-medium text-gray-900">{pdf.name}</div>
                    <div className="text-sm text-gray-500 truncate">{pdf.url}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 错误消息 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* PDF查看器 */}
        {pdfUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* PDF查看器主区域 */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                {/* 协作指示器 */}
                <CollaborationIndicator
                  isConnected={collaboration.isConnected}
                  connectionError={collaboration.connectionError}
                  collaborationUsers={collaboration.collaborationUsers}
                  currentUserId="demo-user"
                  onReconnect={collaboration.reconnect}
                />
                
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium truncate">{fileName}</h2>
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={collaborationEnabled}
                          onChange={(e) => setCollaborationEnabled(e.target.checked)}
                          className="rounded"
                        />
                        <span>实时协作</span>
                      </label>
                      <button
                        onClick={() => {
                          setPdfUrl('');
                          setFileName('');
                          setError(null);
                          setAnnotations([]);
                        }}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                      >
                        选择其他文件
                      </button>
                    </div>
                  </div>
                  <IframePDFViewer 
                    pdfUrl={pdfUrl}
                    documentId={documentId}
                    onAnnotationCreate={handleCreateAnnotation}
                    userId="demo-user"
                  />
                </div>
              </div>
            </div>

            {/* 标注管理侧边栏 */}
            <div className="lg:col-span-1">
              <AnnotationManager
                documentId={documentId}
                annotations={annotations}
                onAnnotationUpdate={handleUpdateAnnotation}
                onAnnotationDelete={handleDeleteAnnotation}
                onAnnotationReply={handleReplyAnnotation}
                onPageJump={handlePageJump}
                currentUserId="demo-user"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}