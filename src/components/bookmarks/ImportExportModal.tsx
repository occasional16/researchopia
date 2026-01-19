'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Download, X, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface ImportExportModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'import' | 'export'
  getAccessToken: () => Promise<string | null>
  onImportSuccess?: () => void
}

interface ImportResult {
  success: boolean
  stats?: {
    parsed: {
      folders: number
      bookmarks: number
    }
    imported: {
      foldersCreated: number
      foldersSkipped: number
      bookmarksCreated: number
      bookmarksSkipped: number
    }
    errors: string[]
  }
  error?: string
}

export default function ImportExportModal({
  isOpen,
  onClose,
  mode,
  getAccessToken,
  onImportSuccess
}: ImportExportModalProps) {
  // Import state
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Export state
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'html' | 'json'>('html')

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Check file type
      if (!selectedFile.name.endsWith('.html') && !selectedFile.name.endsWith('.htm')) {
        alert('请选择 HTML 格式的书签文件')
        return
      }
      setFile(selectedFile)
      setImportResult(null)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      if (!droppedFile.name.endsWith('.html') && !droppedFile.name.endsWith('.htm')) {
        alert('请选择 HTML 格式的书签文件')
        return
      }
      setFile(droppedFile)
      setImportResult(null)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    setImportResult(null)

    try {
      const token = await getAccessToken()
      if (!token) {
        setImportResult({ success: false, error: '请先登录' })
        return
      }

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/bookmarks/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setImportResult({ success: true, stats: data.stats })
        onImportSuccess?.()
      } else {
        setImportResult({ success: false, error: data.error || '导入失败' })
      }
    } catch (error) {
      console.error('Import error:', error)
      setImportResult({ success: false, error: '导入过程中发生错误' })
    } finally {
      setImporting(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)

    try {
      const token = await getAccessToken()
      if (!token) {
        alert('请先登录')
        return
      }

      const response = await fetch(`/api/bookmarks/export?format=${exportFormat}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('导出失败')
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `bookmarks-${new Date().toISOString().split('T')[0]}.${exportFormat}`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/)
        if (match) filename = match[1]
      }

      // Download file
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      onClose()
    } catch (error) {
      console.error('Export error:', error)
      alert('导出失败，请稍后重试')
    } finally {
      setExporting(false)
    }
  }

  const resetState = () => {
    setFile(null)
    setImportResult(null)
    setImporting(false)
    setExporting(false)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            {mode === 'import' ? (
              <>
                <Upload size={20} />
                导入书签
              </>
            ) : (
              <>
                <Download size={20} />
                导出书签
              </>
            )}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {mode === 'import' ? (
            <>
              {/* File drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                  transition-colors
                  ${file 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".html,.htm"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText size={24} className="text-blue-500" />
                    <span className="text-gray-700 dark:text-gray-300">{file.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setFile(null)
                        setImportResult(null)
                      }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                      <X size={16} className="text-gray-500" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 dark:text-gray-400">
                      拖放文件到这里，或点击选择
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      支持 Chrome、Edge、Firefox 导出的 HTML 格式
                    </p>
                  </>
                )}
              </div>

              {/* Import rules explanation */}
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong className="text-gray-700 dark:text-gray-300">导入规则：</strong>
                </p>
                <ul className="text-sm text-gray-500 dark:text-gray-400 mt-2 space-y-1 list-disc list-inside">
                  <li>导入的书签将放入新建的"导入"文件夹</li>
                  <li>保留原有目录结构，您可自行整理</li>
                  <li>不会影响您现有的收藏夹内容</li>
                </ul>
              </div>

              {/* Import result */}
              {importResult && (
                <div className={`mt-4 p-3 rounded-lg ${
                  importResult.success 
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                  {importResult.success ? (
                    <>
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                        <CheckCircle size={18} />
                        导入成功
                      </div>
                      <div className="mt-2 text-sm text-green-600 dark:text-green-500 space-y-1">
                        <p>新建文件夹：{importResult.stats?.imported.foldersCreated} 个</p>
                        <p>导入书签：{importResult.stats?.imported.bookmarksCreated} 个</p>
                        {(importResult.stats?.imported.bookmarksSkipped || 0) > 0 && (
                          <p>跳过书签：{importResult.stats?.imported.bookmarksSkipped} 个（重复）</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                      <AlertCircle size={18} />
                      {importResult.error}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Export format selection */}
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  选择导出格式：
                </p>
                
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  exportFormat === 'html' 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="format"
                    value="html"
                    checked={exportFormat === 'html'}
                    onChange={() => setExportFormat('html')}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">HTML 格式</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      标准书签格式，可导入到其他浏览器
                    </div>
                  </div>
                </label>

                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  exportFormat === 'json' 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="format"
                    value="json"
                    checked={exportFormat === 'json'}
                    onChange={() => setExportFormat('json')}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">JSON 格式</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      结构化数据，便于编程处理
                    </div>
                  </div>
                </label>
              </div>

              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                将导出您的所有书签和文件夹结构
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {importResult?.success ? '完成' : '取消'}
          </button>
          
          {mode === 'import' ? (
            <button
              onClick={handleImport}
              disabled={!file || importing || importResult?.success}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  导入中...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  开始导入
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  导出中...
                </>
              ) : (
                <>
                  <Download size={16} />
                  开始导出
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
