'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

interface StarRatingProps {
  /** Value from 1-10 (supports 0.5 increments) */
  value: number
  onChange?: (value: number) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
  label?: string
  description?: string
  showValue?: boolean
  /** Max score (default 10 for 5-star 10-point system) */
  maxScore?: number
  /** Compact mode for tight layouts */
  compact?: boolean
}

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
}

const compactSizeMap = {
  sm: 12,
  md: 18,
  lg: 24,
}

/**
 * 5-Star 10-Point Rating Component
 * 
 * - Displays 5 stars representing scores 1-10
 * - Supports half-star precision (click left/right half of star)
 * - Score 1-2 = 1st star, 3-4 = 2nd star, etc.
 * - Half star = odd number (1, 3, 5, 7, 9)
 * - Full star = even number (2, 4, 6, 8, 10)
 */
export default function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
  label,
  description,
  showValue = true,
  maxScore = 10,
  compact = false,
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const starSize = compact ? compactSizeMap[size] : sizeMap[size]

  // Convert score (1-10) to star display value
  const getStarFill = (starIndex: number, score: number) => {
    const starScore = starIndex * 2  // Each star represents 2 points
    if (score >= starScore) return 'full'
    if (score >= starScore - 1) return 'half'
    return 'empty'
  }

  const handleClick = (starIndex: number, isLeftHalf: boolean) => {
    if (readonly || !onChange) return
    // Left half = odd (1, 3, 5, 7, 9), Right half = even (2, 4, 6, 8, 10)
    const newScore = starIndex * 2 - (isLeftHalf ? 1 : 0)
    onChange(newScore)
  }

  const handleMouseMove = (e: React.MouseEvent, starIndex: number) => {
    if (readonly) return
    const rect = e.currentTarget.getBoundingClientRect()
    const isLeftHalf = e.clientX - rect.left < rect.width / 2
    const previewScore = starIndex * 2 - (isLeftHalf ? 1 : 0)
    setHovered(previewScore)
  }

  const displayScore = hovered ?? value

  return (
    <div className={compact ? "space-y-0.5" : "space-y-1"}>
      {(label || description) && (
        <div>
          {label && (
            <h4 className={`font-medium text-gray-900 dark:text-gray-100 ${compact ? 'text-xs' : ''}`}>
              {label}
            </h4>
          )}
          {description && !compact && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
      )}
      
      <div className="flex items-center space-x-0.5">
        {[1, 2, 3, 4, 5].map((starIndex) => {
          const fill = getStarFill(starIndex, displayScore)

          return (
            <button
              key={starIndex}
              type="button"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const isLeftHalf = e.clientX - rect.left < rect.width / 2
                handleClick(starIndex, isLeftHalf)
              }}
              onMouseMove={(e) => handleMouseMove(e, starIndex)}
              onMouseLeave={() => setHovered(null)}
              disabled={readonly}
              className={`p-0.5 relative transition-all duration-150 ${
                readonly 
                  ? 'cursor-default' 
                  : 'cursor-pointer hover:scale-110 active:scale-95'
              }`}
              aria-label={`Rate ${starIndex * 2} points`}
            >
              {/* Background star (empty) */}
              <Star
                size={starSize}
                className="text-gray-300 dark:text-gray-600"
              />
              
              {/* Filled star overlay */}
              {fill !== 'empty' && (
                <div 
                  className="absolute inset-0 flex items-center justify-center overflow-hidden"
                  style={{ 
                    width: fill === 'half' ? '50%' : '100%',
                    paddingLeft: '2px',
                    paddingTop: '2px',
                  }}
                >
                  <Star
                    size={starSize}
                    className="text-yellow-400 fill-yellow-400 flex-shrink-0"
                  />
                </div>
              )}
            </button>
          )
        })}
        
        {showValue && (
          <span className={`ml-2 text-gray-600 dark:text-gray-400 font-medium ${compact ? 'text-xs min-w-[48px]' : 'text-sm min-w-[60px]'}`}>
            {value > 0 ? `${value} 分` : '未评分'}
          </span>
        )}
      </div>
    </div>
  )
}
