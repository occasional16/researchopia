/**
 * Unified Evaluation Components
 * 
 * Shared components for rating and commenting on both papers and webpages.
 * Uses v2 unified API endpoints that support Cookie and Bearer Token authentication.
 * 
 * Usage:
 * 
 * // For paper evaluation
 * import { EvaluationForm, CommentList, PAPER_DIMENSIONS } from '@/components/evaluation/shared'
 * 
 * <EvaluationForm
 *   targetType="paper"
 *   targetId={paperId}
 *   dimensions={PAPER_DIMENSIONS}
 * />
 * 
 * <CommentList
 *   targetType="paper"
 *   targetId={paperId}
 * />
 * 
 * // For webpage evaluation
 * import { EvaluationForm, CommentList, WEBPAGE_DIMENSIONS } from '@/components/evaluation/shared'
 * 
 * <EvaluationForm
 *   targetType="webpage"
 *   targetId={urlHash}
 *   dimensions={WEBPAGE_DIMENSIONS}
 *   url={fullUrl}
 *   title={pageTitle}
 * />
 * 
 * <CommentList
 *   targetType="webpage"
 *   targetId={urlHash}
 *   url={fullUrl}
 *   title={pageTitle}
 * />
 */

// Core components
export { default as StarRating } from './StarRating'
export { default as EvaluationForm, PAPER_DIMENSIONS, WEBPAGE_DIMENSIONS } from './EvaluationForm'
export { default as CommentForm } from './CommentForm'
export { default as CommentList } from './CommentList'
export { 
  default as RatingDisplay, 
  PAPER_DISPLAY_DIMENSIONS, 
  WEBPAGE_DISPLAY_DIMENSIONS 
} from './RatingDisplay'

// Types
export type { TargetType, DimensionConfig, RatingScores, EvaluationFormProps } from './EvaluationForm'
export type { RatingDisplayProps } from './RatingDisplay'
