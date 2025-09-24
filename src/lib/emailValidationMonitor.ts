// Email validation monitoring and logging system
export interface EmailValidationLog {
  id: string
  email: string
  timestamp: Date
  isValid: boolean
  isDeliverable: boolean
  isDisposable: boolean
  riskScore: number
  provider: string
  userAgent?: string
  ip?: string
  error?: string
  processingTime: number
}

export interface EmailValidationStats {
  totalValidations: number
  successfulValidations: number
  failedValidations: number
  averageRiskScore: number
  disposableEmailAttempts: number
  providerStats: Record<string, number>
  recentValidations: EmailValidationLog[]
}

class EmailValidationMonitor {
  private logs: EmailValidationLog[] = []
  private maxLogs = 1000 // Keep last 1000 validations in memory

  /**
   * Log an email validation attempt
   */
  logValidation(log: Omit<EmailValidationLog, 'id' | 'timestamp'>): void {
    const validationLog: EmailValidationLog = {
      id: this.generateId(),
      timestamp: new Date(),
      ...log
    }

    this.logs.push(validationLog)

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // Log to console for debugging
    console.log(`📧 Email validation: ${log.email} - Valid: ${log.isValid} - Provider: ${log.provider} - Time: ${log.processingTime}ms`)
  }

  /**
   * Get validation statistics
   */
  getStats(): EmailValidationStats {
    const totalValidations = this.logs.length
    const successfulValidations = this.logs.filter(log => log.isValid).length
    const failedValidations = totalValidations - successfulValidations
    const disposableEmailAttempts = this.logs.filter(log => log.isDisposable).length

    const averageRiskScore = totalValidations > 0 
      ? this.logs.reduce((sum, log) => sum + log.riskScore, 0) / totalValidations 
      : 0

    const providerStats: Record<string, number> = {}
    this.logs.forEach(log => {
      providerStats[log.provider] = (providerStats[log.provider] || 0) + 1
    })

    return {
      totalValidations,
      successfulValidations,
      failedValidations,
      averageRiskScore,
      disposableEmailAttempts,
      providerStats,
      recentValidations: this.logs.slice(-10) // Last 10 validations
    }
  }

  /**
   * Get suspicious validation attempts
   */
  getSuspiciousAttempts(): EmailValidationLog[] {
    return this.logs.filter(log => 
      log.riskScore > 0.7 || 
      log.isDisposable || 
      log.error
    )
  }

  /**
   * Check if email has been validated recently
   */
  hasRecentValidation(email: string, withinMinutes: number = 5): boolean {
    const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000)
    return this.logs.some(log => 
      log.email.toLowerCase() === email.toLowerCase() && 
      log.timestamp > cutoff
    )
  }

  /**
   * Get validation history for an email
   */
  getEmailHistory(email: string): EmailValidationLog[] {
    return this.logs.filter(log => 
      log.email.toLowerCase() === email.toLowerCase()
    )
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
}

// Singleton instance
export const emailValidationMonitor = new EmailValidationMonitor()

/**
 * Rate limiting for email validation
 */
export class EmailValidationRateLimit {
  private attempts: Map<string, number[]> = new Map()
  private maxAttempts = 10 // Max attempts per IP per hour
  private windowMs = 60 * 60 * 1000 // 1 hour

  /**
   * Check if IP is rate limited
   */
  isRateLimited(ip: string): boolean {
    const now = Date.now()
    const attempts = this.attempts.get(ip) || []
    
    // Remove old attempts outside the window
    const recentAttempts = attempts.filter(timestamp => 
      now - timestamp < this.windowMs
    )
    
    this.attempts.set(ip, recentAttempts)
    
    return recentAttempts.length >= this.maxAttempts
  }

  /**
   * Record a validation attempt
   */
  recordAttempt(ip: string): void {
    const attempts = this.attempts.get(ip) || []
    attempts.push(Date.now())
    this.attempts.set(ip, attempts)
  }

  /**
   * Get remaining attempts for IP
   */
  getRemainingAttempts(ip: string): number {
    const now = Date.now()
    const attempts = this.attempts.get(ip) || []
    const recentAttempts = attempts.filter(timestamp => 
      now - timestamp < this.windowMs
    )
    
    return Math.max(0, this.maxAttempts - recentAttempts.length)
  }
}

// Singleton instance
export const emailValidationRateLimit = new EmailValidationRateLimit()

/**
 * Email validation cache
 */
export class EmailValidationCache {
  private cache: Map<string, { result: any, timestamp: number }> = new Map()
  private cacheTimeMs = 24 * 60 * 60 * 1000 // 24 hours

  /**
   * Get cached validation result
   */
  get(email: string): any | null {
    const cached = this.cache.get(email.toLowerCase())
    
    if (!cached) return null
    
    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.cacheTimeMs) {
      this.cache.delete(email.toLowerCase())
      return null
    }
    
    return cached.result
  }

  /**
   * Set cached validation result
   */
  set(email: string, result: any): void {
    this.cache.set(email.toLowerCase(), {
      result,
      timestamp: Date.now()
    })
  }

  /**
   * Clear expired cache entries
   */
  cleanup(): void {
    const now = Date.now()
    for (const [email, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.cacheTimeMs) {
        this.cache.delete(email)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number, hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // TODO: Implement hit rate tracking
    }
  }
}

// Singleton instance
export const emailValidationCache = new EmailValidationCache()

// Cleanup cache every hour
setInterval(() => {
  emailValidationCache.cleanup()
}, 60 * 60 * 1000)
