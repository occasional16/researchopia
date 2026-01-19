'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, FileText } from 'lucide-react'

interface AbstractSectionProps {
  abstract?: string | null
  /** Maximum characters before showing "expand" button */
  maxLength?: number
  className?: string
}

/**
 * Abstract section with expand/collapse functionality for long abstracts
 */
export default function AbstractSection({ 
  abstract, 
  maxLength = 300,
  className = '' 
}: AbstractSectionProps) {
  const [expanded, setExpanded] = useState(false)

  if (!abstract) {
    return null
  }

  const isLong = abstract.length > maxLength
  const displayText = expanded || !isLong ? abstract : abstract.substring(0, maxLength) + '...'

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm p-4 ${className}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <FileText size={14} className="text-gray-500 dark:text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          摘要
        </h2>
      </div>
      
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap text-xs md:text-sm">
        {displayText}
      </p>
      
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp size={14} />
              收起
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              展开全文
            </>
          )}
        </button>
      )}
    </div>
  )
}
