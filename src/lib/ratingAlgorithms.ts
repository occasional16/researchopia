/**
 * Advanced Rating Algorithms and Analytics
 * 
 * This module provides sophisticated rating calculation algorithms
 * including weighted averages, confidence intervals, and anti-spam measures.
 */

import type { Rating, User } from './supabase'

export interface RatingAnalytics {
  average: {
    innovation: number
    methodology: number
    practicality: number
    overall: number
  }
  weighted: {
    innovation: number
    methodology: number
    practicality: number
    overall: number
  }
  distribution: {
    [key: number]: number // star -> count
  }
  confidence: {
    level: number // 0-1
    interval: {
      lower: number
      upper: number
    }
  }
  count: number
  qualityScore: number // Overall quality indicator (0-100)
}

export interface UserRatingWeight {
  userId: string
  weight: number
  factors: {
    experience: number // Based on number of ratings given
    expertise: number // Based on academic background (future enhancement)
    consistency: number // Based on rating patterns
    reputation: number // Based on community feedback (future enhancement)
  }
}

/**
 * Calculate user weight based on their rating history and behavior
 */
export function calculateUserWeight(user: User, userRatings: Rating[]): UserRatingWeight {
  const experienceFactor = Math.min(userRatings.length / 10, 1) // Max at 10 ratings
  const consistencyFactor = calculateConsistencyFactor(userRatings)
  
  // Base weight factors
  const factors = {
    experience: experienceFactor * 0.3,
    expertise: 0.25, // Placeholder for future academic credential integration
    consistency: consistencyFactor * 0.25,
    reputation: 0.2, // Placeholder for community reputation system
  }
  
  const totalWeight = Object.values(factors).reduce((sum, factor) => sum + factor, 0)
  
  return {
    userId: user.id,
    weight: Math.max(0.1, Math.min(1.0, totalWeight)), // Weight between 0.1 and 1.0
    factors
  }
}

/**
 * Calculate consistency factor based on rating variance
 */
function calculateConsistencyFactor(ratings: Rating[]): number {
  if (ratings.length < 3) return 0.5 // Default for new users
  
  const overallScores = ratings.map(r => r.overall_score)
  const mean = overallScores.reduce((sum, score) => sum + score, 0) / overallScores.length
  const variance = overallScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / overallScores.length
  const standardDeviation = Math.sqrt(variance)
  
  // Lower standard deviation = higher consistency
  // Normalize to 0-1 scale (assuming max reasonable SD is 2)
  return Math.max(0, 1 - (standardDeviation / 2))
}

/**
 * Calculate advanced rating analytics with weighted averages
 */
export function calculateAdvancedRatingAnalytics(
  ratings: Rating[],
  userWeights?: UserRatingWeight[]
): RatingAnalytics {
  if (ratings.length === 0) {
    return {
      average: { innovation: 0, methodology: 0, practicality: 0, overall: 0 },
      weighted: { innovation: 0, methodology: 0, practicality: 0, overall: 0 },
      distribution: {},
      confidence: { level: 0, interval: { lower: 0, upper: 0 } },
      count: 0,
      qualityScore: 0
    }
  }

  // Calculate simple averages
  const average = calculateSimpleAverage(ratings)
  
  // Calculate weighted averages if weights are provided
  const weighted = userWeights ? calculateWeightedAverage(ratings, userWeights) : average
  
  // Calculate rating distribution
  const distribution = calculateRatingDistribution(ratings)
  
  // Calculate confidence interval
  const confidence = calculateConfidenceInterval(ratings)
  
  // Calculate overall quality score
  const qualityScore = calculateQualityScore(ratings, userWeights)
  
  return {
    average,
    weighted,
    distribution,
    confidence,
    count: ratings.length,
    qualityScore
  }
}

/**
 * Calculate simple arithmetic average
 */
function calculateSimpleAverage(ratings: Rating[]) {
  const totals = ratings.reduce(
    (acc, rating) => ({
      innovation: acc.innovation + (rating.innovation_score || 0),
      methodology: acc.methodology + (rating.methodology_score || 0),
      practicality: acc.practicality + (rating.practicality_score || 0),
      overall: acc.overall + (rating.overall_score || 0),
    }),
    { innovation: 0, methodology: 0, practicality: 0, overall: 0 }
  )

  const count = ratings.length
  return {
    innovation: Math.round((totals.innovation / count) * 10) / 10,
    methodology: Math.round((totals.methodology / count) * 10) / 10,
    practicality: Math.round((totals.practicality / count) * 10) / 10,
    overall: Math.round((totals.overall / count) * 10) / 10,
  }
}

/**
 * Calculate weighted average based on user weights
 */
function calculateWeightedAverage(ratings: Rating[], userWeights: UserRatingWeight[]) {
  const weightMap = new Map(userWeights.map(w => [w.userId, w.weight]))
  
  const totals = ratings.reduce(
    (acc, rating) => {
      const weight = weightMap.get(rating.user_id) || 0.5 // Default weight for unknown users
      return {
        innovation: acc.innovation + ((rating.innovation_score || 0) * weight),
        methodology: acc.methodology + ((rating.methodology_score || 0) * weight),
        practicality: acc.practicality + ((rating.practicality_score || 0) * weight),
        overall: acc.overall + ((rating.overall_score || 0) * weight),
        totalWeight: acc.totalWeight + weight
      }
    },
    { innovation: 0, methodology: 0, practicality: 0, overall: 0, totalWeight: 0 }
  )

  if (totals.totalWeight === 0) return calculateSimpleAverage(ratings)

  return {
    innovation: Math.round((totals.innovation / totals.totalWeight) * 10) / 10,
    methodology: Math.round((totals.methodology / totals.totalWeight) * 10) / 10,
    practicality: Math.round((totals.practicality / totals.totalWeight) * 10) / 10,
    overall: Math.round((totals.overall / totals.totalWeight) * 10) / 10,
  }
}

/**
 * Calculate rating distribution across 1-10 scale
 */
function calculateRatingDistribution(ratings: Rating[]) {
  const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 }
  
  ratings.forEach(rating => {
    const roundedScore = Math.round(rating.overall_score)
    if (roundedScore >= 1 && roundedScore <= 10) {
      distribution[roundedScore] = (distribution[roundedScore] || 0) + 1
    }
  })
  
  return distribution
}

/**
 * Calculate confidence interval for ratings (1-10 scale)
 */
function calculateConfidenceInterval(ratings: Rating[]) {
  if (ratings.length < 2) {
    return { level: 0, interval: { lower: 1, upper: 10 } }
  }
  
  const scores = ratings.map(r => r.overall_score)
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / (scores.length - 1)
  const standardError = Math.sqrt(variance / scores.length)
  
  // 95% confidence interval (t-distribution approximation)
  const tValue = 1.96 // For large samples; could be improved with actual t-table lookup
  const marginOfError = tValue * standardError
  
  const level = Math.min(0.95, Math.max(0, 1 - (standardError / mean)))
  
  return {
    level,
    interval: {
      lower: Math.max(1, mean - marginOfError),
      upper: Math.min(10, mean + marginOfError)
    }
  }
}

/**
 * Calculate overall quality score (0-100)
 */
function calculateQualityScore(ratings: Rating[], userWeights?: UserRatingWeight[]): number {
  if (ratings.length === 0) return 0
  
  // Base score from average rating (0-100 scale)
  const averageScore = ratings.reduce((sum, r) => sum + r.overall_score, 0) / ratings.length
  const baseScore = (averageScore / 5) * 100
  
  // Confidence bonus based on number of ratings
  const confidenceMultiplier = Math.min(1, ratings.length / 10) // Max confidence at 10+ ratings
  
  // Quality bonus for consistent ratings
  const scores = ratings.map(r => r.overall_score)
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) / scores.length
  const consistencyBonus = Math.max(0, 10 - variance * 2) // Bonus for low variance
  
  // Weight quality bonus if weights are provided
  const weightBonus = userWeights ? calculateWeightQualityBonus(ratings, userWeights) : 0
  
  return Math.min(100, Math.max(0, baseScore * confidenceMultiplier + consistencyBonus + weightBonus))
}

/**
 * Calculate quality bonus based on user weights
 */
function calculateWeightQualityBonus(ratings: Rating[], userWeights: UserRatingWeight[]): number {
  const weightMap = new Map(userWeights.map(w => [w.userId, w.weight]))
  const averageWeight = ratings.reduce((sum, r) => sum + (weightMap.get(r.user_id) || 0.5), 0) / ratings.length
  
  // Bonus for high-quality reviewers (max 5 points)
  return Math.min(5, averageWeight * 10)
}

/**
 * Detect potential spam or abuse in ratings
 */
export interface SpamDetectionResult {
  isSpam: boolean
  confidence: number
  reasons: string[]
  riskFactors: {
    rapidSubmission: boolean
    extremeRatings: boolean
    duplicatePattern: boolean
    suspiciousUser: boolean
  }
}

export function detectSpam(
  rating: Rating,
  userRatingHistory: Rating[],
  recentRatings: Rating[]
): SpamDetectionResult {
  const reasons: string[] = []
  const riskFactors = {
    rapidSubmission: false,
    extremeRatings: false,
    duplicatePattern: false,
    suspiciousUser: false
  }
  
  // Check for rapid submission
  const recentUserRatings = recentRatings.filter(r => r.user_id === rating.user_id)
  if (recentUserRatings.length > 5) { // More than 5 ratings in recent period
    riskFactors.rapidSubmission = true
    reasons.push('异常频繁的评分提交')
  }
  
  // Check for extreme ratings pattern
  const userScores = userRatingHistory.map(r => r.overall_score)
  const extremeCount = userScores.filter(s => s <= 1 || s >= 5).length
  if (extremeCount / userScores.length > 0.8 && userScores.length > 3) {
    riskFactors.extremeRatings = true
    reasons.push('评分模式过于极端')
  }
  
  // Check for duplicate patterns
  const duplicateScores = userRatingHistory.filter(r => 
    r.innovation_score === rating.innovation_score &&
    r.methodology_score === rating.methodology_score &&
    r.practicality_score === rating.practicality_score &&
    r.overall_score === rating.overall_score
  )
  if (duplicateScores.length > 2) {
    riskFactors.duplicatePattern = true
    reasons.push('重复的评分模式')
  }
  
  // Calculate overall spam confidence
  const activeRiskFactors = Object.values(riskFactors).filter(Boolean).length
  const confidence = activeRiskFactors / 4 // 0-1 scale
  
  return {
    isSpam: confidence > 0.5,
    confidence,
    reasons,
    riskFactors
  }
}

/**
 * Get rating recommendations based on paper characteristics
 */
export interface RatingRecommendation {
  suggestedRange: {
    min: number
    max: number
  }
  factors: string[]
  confidence: number
}

export function getRatingRecommendation(
  paperMetrics: {
    citationCount?: number
    publicationYear?: number
    journalImpactFactor?: number
    authorHIndex?: number
  }
): RatingRecommendation {
  const factors: string[] = []
  let baseRange = { min: 2, max: 4 } // Default range
  
  // Adjust based on citations
  if (paperMetrics.citationCount !== undefined) {
    if (paperMetrics.citationCount > 100) {
      baseRange = { min: Math.max(baseRange.min, 3), max: Math.max(baseRange.max, 4.5) }
      factors.push('高引用数表明较高影响力')
    } else if (paperMetrics.citationCount < 5) {
      baseRange = { ...baseRange, max: Math.min(baseRange.max, 3.5) }
      factors.push('引用数较低，可能影响评分')
    }
  }
  
  // Adjust based on publication recency
  if (paperMetrics.publicationYear !== undefined) {
    const currentYear = new Date().getFullYear()
    const yearsOld = currentYear - paperMetrics.publicationYear
    
    if (yearsOld < 2) {
      factors.push('近期发表，评价需考虑时间因素')
    } else if (yearsOld > 10) {
      factors.push('发表时间较久，需考虑时代背景')
    }
  }
  
  // Adjust based on journal impact factor
  if (paperMetrics.journalImpactFactor !== undefined) {
    if (paperMetrics.journalImpactFactor > 10) {
      baseRange = { ...baseRange, min: Math.max(baseRange.min, 3) }
      factors.push('顶级期刊发表，质量较高')
    } else if (paperMetrics.journalImpactFactor < 1) {
      baseRange = { ...baseRange, max: Math.min(baseRange.max, 3.5) }
      factors.push('期刊影响因子较低')
    }
  }
  
  const confidence = factors.length > 0 ? Math.min(0.8, factors.length * 0.2) : 0.3
  
  return {
    suggestedRange: baseRange,
    factors,
    confidence
  }
}
