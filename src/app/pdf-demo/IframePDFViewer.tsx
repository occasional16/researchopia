'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Share2, Highlighter, Edit3, Bookmark, RotateCw, Loader } from 'lucide-react';

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
}

interface IframePDFViewerProps {
  pdfUrl: string;
  documentId: string;
  onAnnotationCreate?: (annotation: Omit<Annotation, 'id' | 'created_at' | 'updated_at' | 'users' | 'interactions'>) => Promise<void>;
  onAnnotationUpdate?: (id: string, updates: Partial<Annotation>) => Promise<void>;
  onAnnotationDelete?: (id: string) => Promise<void>;
  initialAnnotations?: Annotation[];
  userId?: string;
}

export default function IframePDFViewer({
  pdfUrl,
  documentId,
  onAnnotationCreate,
  onAnnotationUpdate,
  onAnnotationDelete,
  initialAnnotations = [],
  userId = 'demo-user'
}: IframePDFViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [selectedText, setSelectedText] = useState<string>('');
  const [showAnnotationToolbar, setShowAnnotationToolbar] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // 构建PDF.js viewer URL
  const buildViewerUrl = (url: string) => {
    // 使用PDF.js的在线viewer
    const encodedUrl = encodeURIComponent(url);
    return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodedUrl}`;
  };

  // 处理iframe加载
  const handleIframeLoad = () => {
    setLoading(false);
    setError(null);
  };

  const handleIframeError = () => {
    setError('PDF加载失败，请检查文件URL或网络连接');
    setLoading(false);
  };

  // 监听iframe中的消息（如果PDF.js支持的话）
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 处理来自PDF.js viewer的消息
      if (event.origin === 'https://mozilla.github.io') {
        try {
          const data = event.data;
          if (data.type === 'pageChange') {
            setCurrentPage(data.pageNumber || 1);
          }
        } catch (error) {
          console.log('消息处理错误:', error);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 模拟文本选择（由于iframe限制，这里使用简化的实现）
  const handleTextSelectionSimulation = () => {
    const text = prompt('请输入要标注的文本内容:');
    if (text && text.trim()) {
      setSelectedText(text.trim());
      setShowAnnotationToolbar(true);
    }
  };

  // 创建标注
  const createAnnotation = async (annotationType: Annotation['annotation_type'], content?: string) => {
    if (!selectedText) {
      alert('请先选择要标注的文本');
      return;
    }

    const annotation: Omit<Annotation, 'id' | 'created_at' | 'updated_at' | 'users' | 'interactions'> = {
      pdf_document_id: documentId,
      user_id: userId,
      page_number: currentPage,
      annotation_type: annotationType,
      position_data: {
        x: Math.random() * 400 + 50, // 随机位置，实际应用中需要更精确的定位
        y: Math.random() * 300 + 50,
        width: 200,
        height: 20,
        bounds: { left: 50, top: 50, right: 250, bottom: 70 }
      },
      content,
      selected_text: selectedText,
      color: annotationType === 'highlight' ? '#ffff00' :
             annotationType === 'note' ? '#ff9500' :
             annotationType === 'bookmark' ? '#00ff00' : '#ff0000',
      opacity: 0.3,
      tags: [],
      is_private: false
    };

    try {
      await onAnnotationCreate?.(annotation);
      console.log('✅ 标注创建成功');
      
      // 添加到本地状态
      const newAnnotation: Annotation = {
        ...annotation,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setAnnotations(prev => [...prev, newAnnotation]);
      
      // 清除选择
      setSelectedText('');
      setShowAnnotationToolbar(false);
    } catch (error) {
      console.error('❌ 创建标注失败:', error);
      alert('创建标注失败');
    }
  };

  // 处理下载
  const handleDownload = () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = pdfUrl.split('/').pop() || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // 处理分享
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PDF文档',
          url: pdfUrl,
        });
      } catch (error) {
        console.log('分享失败:', error);
      }
    } else {
      // 复制到剪贴板
      navigator.clipboard.writeText(pdfUrl).then(() => {
        alert('PDF链接已复制到剪贴板');
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900">PDF文档查看器</h3>
          <div className="text-sm text-gray-600">
            第 {currentPage} 页
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* 标注工具 */}
          <button
            onClick={handleTextSelectionSimulation}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            title="添加标注"
          >
            <Highlighter className="w-4 h-4" />
            <span>标注</span>
          </button>

          {/* 文档操作 */}
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-gray-200"
            title="下载"
          >
            <Download className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleShare}
            className="p-2 rounded-lg hover:bg-gray-200"
            title="分享"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF查看区域 */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <div className="text-center">
              <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">正在加载PDF文档...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-10">
            <div className="text-center">
              <p className="text-red-600 mb-4">❌ {error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  if (iframeRef.current) {
                    iframeRef.current.src = buildViewerUrl(pdfUrl);
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                重新加载
              </button>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={buildViewerUrl(pdfUrl)}
          className="w-full h-[700px] border-0"
          title="PDF Viewer"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-scripts allow-same-origin allow-downloads"
        />
      </div>

      {/* 标注工具栏 */}
      {showAnnotationToolbar && selectedText && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white border shadow-lg rounded-lg p-4 max-w-md">
          <div className="text-sm text-gray-600 mb-3">
            选中文本: "<span className="font-medium">{selectedText}</span>"
          </div>
          <div className="flex items-center space-x-2 mb-3">
            <button
              onClick={() => createAnnotation('highlight')}
              className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600 flex items-center space-x-1"
            >
              <Highlighter className="w-4 h-4" />
              <span>高亮</span>
            </button>
            <button
              onClick={() => createAnnotation('note', prompt('请输入笔记内容:') || undefined)}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 flex items-center space-x-1"
            >
              <Edit3 className="w-4 h-4" />
              <span>笔记</span>
            </button>
            <button
              onClick={() => createAnnotation('bookmark', prompt('添加书签备注:') || undefined)}
              className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 flex items-center space-x-1"
            >
              <Bookmark className="w-4 h-4" />
              <span>书签</span>
            </button>
          </div>
          <button
            onClick={() => {
              setSelectedText('');
              setShowAnnotationToolbar(false);
            }}
            className="w-full px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
          >
            取消
          </button>
        </div>
      )}

      {/* 标注列表 */}
      {annotations.length > 0 && (
        <div className="border-t bg-gray-50 p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">文档标注 ({annotations.length})</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {annotations.map((annotation) => (
              <div key={annotation.id} className="text-xs bg-white p-2 rounded border">
                <div className="flex items-center justify-between mb-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    annotation.annotation_type === 'highlight' ? 'bg-yellow-100 text-yellow-800' :
                    annotation.annotation_type === 'note' ? 'bg-blue-100 text-blue-800' :
                    annotation.annotation_type === 'bookmark' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {annotation.annotation_type === 'highlight' ? '高亮' :
                     annotation.annotation_type === 'note' ? '笔记' :
                     annotation.annotation_type === 'bookmark' ? '书签' : '标注'}
                  </span>
                  <span className="text-gray-500">第{annotation.page_number}页</span>
                </div>
                <div className="text-gray-700">"{annotation.selected_text}"</div>
                {annotation.content && (
                  <div className="text-gray-600 mt-1">{annotation.content}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}