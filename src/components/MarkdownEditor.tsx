'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import 'easymde/dist/easymde.min.css'

// Dynamically import SimpleMDE to avoid SSR issues
const SimpleMDE = dynamic(() => import('react-simplemde-editor'), { ssr: false })

export interface MarkdownEditorProps {
  /** Current value of the editor */
  value: string
  /** Callback when value changes */
  onChange: (value: string) => void
  /** Placeholder text for the editor */
  placeholder?: string
  /** Label for the editor field */
  label?: string
  /** Maximum character limit */
  maxLength?: number
  /** Minimum height of the editor */
  minHeight?: string
  /** Whether to show the character count */
  showCharCount?: boolean
  /** Whether to show toolbar */
  showToolbar?: boolean
  /** Custom class name for the container */
  className?: string
  /** Helper text below the editor */
  helperText?: string
}

/**
 * Reusable Markdown Editor Component
 * 
 * Features:
 * - SimpleMDE editor with preview toggle
 * - Character count display
 * - Markdown preview with GitHub Flavored Markdown support
 * - Customizable toolbar and appearance
 * 
 * Usage:
 * ```tsx
 * <MarkdownEditor
 *   value={content}
 *   onChange={setContent}
 *   label="内容"
 *   placeholder="支持 Markdown 格式..."
 *   maxLength={5000}
 * />
 * ```
 */
export default function MarkdownEditor({
  value,
  onChange,
  placeholder = '支持 Markdown 格式...\n\n常用语法:\n# 标题\n**粗体** *斜体*\n- 列表项\n[链接](url)',
  label,
  maxLength,
  minHeight = '200px',
  showCharCount = true,
  showToolbar = true,
  className = '',
  helperText,
}: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(false)

  // SimpleMDE configuration
  const editorOptions = useMemo(() => ({
    spellChecker: false,
    placeholder,
    maxHeight: minHeight,
    minHeight: minHeight,
    status: false,
    toolbar: showToolbar 
      ? ['bold', 'italic', 'heading', '|', 'quote', 'unordered-list', 'ordered-list', '|', 'link', 'image', '|', 'preview', 'guide'] as any
      : false,
  }), [placeholder, minHeight, showToolbar])

  return (
    <div className={className}>
      {/* Label and Preview Toggle */}
      {(label || showCharCount) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
            </label>
          )}
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {showPreview ? '✏️ 编辑' : '👁️ 预览'}
          </button>
        </div>
      )}
      
      {/* Editor or Preview */}
      {showPreview ? (
        <div 
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 prose prose-sm dark:prose-invert max-w-none overflow-auto"
          style={{ minHeight }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {value || '*没有内容*'}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="markdown-editor-wrapper">
          <SimpleMDE
            value={value}
            onChange={onChange}
            options={editorOptions}
          />
        </div>
      )}
      
      {/* Character Count and Helper Text */}
      <div className="mt-1 flex justify-between text-sm text-gray-500 dark:text-gray-400">
        {helperText && <span>{helperText}</span>}
        {showCharCount && maxLength && (
          <span className={value.length > maxLength ? 'text-red-500' : ''}>
            {value.length}/{maxLength} 字符
          </span>
        )}
        {showCharCount && !maxLength && (
          <span>{value.length} 字符</span>
        )}
      </div>

      {/* Custom styles to ensure dark mode compatibility */}
      <style jsx global>{`
        .markdown-editor-wrapper .EasyMDEContainer {
          border-radius: 0.5rem;
        }
        .markdown-editor-wrapper .EasyMDEContainer .CodeMirror {
          border-radius: 0.5rem;
          font-size: 14px;
        }
        .markdown-editor-wrapper .editor-toolbar {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
        }
        .dark .markdown-editor-wrapper .EasyMDEContainer .CodeMirror {
          background-color: #1f2937;
          color: #e5e7eb;
          border-color: #4b5563;
        }
        .dark .markdown-editor-wrapper .editor-toolbar {
          background-color: #374151;
          border-color: #4b5563;
        }
        .dark .markdown-editor-wrapper .editor-toolbar button {
          color: #e5e7eb !important;
        }
        .dark .markdown-editor-wrapper .editor-toolbar button:hover {
          background-color: #4b5563;
        }
        .dark .markdown-editor-wrapper .CodeMirror-cursor {
          border-left-color: #e5e7eb;
        }
      `}</style>
    </div>
  )
}
