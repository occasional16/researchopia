// Email sending monitoring and bounce handling
export interface EmailSendLog {
  id: string
  to: string
  subject: string
  type: 'verification' | 'password_reset' | 'welcome' | 'notification'
  timestamp: Date
  success: boolean
  messageId?: string
  error?: string
  bounced?: boolean
  rejected?: string[]
  processingTime: number
  retryCount: number
}

export interface EmailBounceInfo {
  email: string
  bounceType: 'hard' | 'soft' | 'complaint'
  reason: string
  timestamp: Date
  messageId?: string
}

export interface EmailStats {
  totalSent: number
  successfulSent: number
  failedSent: number
  bouncedEmails: number
  bounceRate: number
  recentSends: EmailSendLog[]
  recentBounces: EmailBounceInfo[]
  typeStats: Record<string, number>
}

class EmailMonitor {
  private sendLogs: EmailSendLog[] = []
  private bounces: EmailBounceInfo[] = []
  private maxLogs = 1000
  private bounceThreshold = 0.05 // 5% bounce rate threshold

  /**
   * Log an email send attempt
   */
  logEmailSend(log: Omit<EmailSendLog, 'id' | 'timestamp'>): void {
    const emailLog: EmailSendLog = {
      id: this.generateId(),
      timestamp: new Date(),
      ...log
    }

    this.sendLogs.push(emailLog)

    // Keep only recent logs
    if (this.sendLogs.length > this.maxLogs) {
      this.sendLogs = this.sendLogs.slice(-this.maxLogs)
    }

    // Log to console
    const status = log.success ? '✅' : '❌'
    console.log(`${status} Email ${log.type} to ${log.to}: ${log.success ? 'Success' : log.error} (${log.processingTime}ms)`)

    // Check bounce rate
    this.checkBounceRate()
  }

  /**
   * Log an email bounce
   */
  logEmailBounce(bounce: Omit<EmailBounceInfo, 'timestamp'>): void {
    const bounceInfo: EmailBounceInfo = {
      timestamp: new Date(),
      ...bounce
    }

    this.bounces.push(bounceInfo)

    // Keep only recent bounces
    if (this.bounces.length > this.maxLogs) {
      this.bounces = this.bounces.slice(-this.maxLogs)
    }

    console.warn(`🚫 Email bounce: ${bounce.email} - ${bounce.bounceType} - ${bounce.reason}`)

    // Add to blacklist if hard bounce
    if (bounce.bounceType === 'hard') {
      this.addToBlacklist(bounce.email)
    }
  }

  /**
   * Get email sending statistics
   */
  getStats(): EmailStats {
    const totalSent = this.sendLogs.length
    const successfulSent = this.sendLogs.filter(log => log.success).length
    const failedSent = totalSent - successfulSent
    const bouncedEmails = this.bounces.length
    const bounceRate = totalSent > 0 ? bouncedEmails / totalSent : 0

    const typeStats: Record<string, number> = {}
    this.sendLogs.forEach(log => {
      typeStats[log.type] = (typeStats[log.type] || 0) + 1
    })

    return {
      totalSent,
      successfulSent,
      failedSent,
      bouncedEmails,
      bounceRate,
      recentSends: this.sendLogs.slice(-20),
      recentBounces: this.bounces.slice(-20),
      typeStats
    }
  }

  /**
   * Check if email is blacklisted
   */
  isBlacklisted(email: string): boolean {
    // Check for recent hard bounces
    const recentHardBounces = this.bounces.filter(bounce => 
      bounce.email.toLowerCase() === email.toLowerCase() &&
      bounce.bounceType === 'hard' &&
      Date.now() - bounce.timestamp.getTime() < 30 * 24 * 60 * 60 * 1000 // 30 days
    )

    return recentHardBounces.length > 0
  }

  /**
   * Get failed email attempts for retry
   */
  getFailedEmails(maxRetries: number = 3): EmailSendLog[] {
    return this.sendLogs.filter(log => 
      !log.success && 
      log.retryCount < maxRetries &&
      !log.bounced &&
      Date.now() - log.timestamp.getTime() > 5 * 60 * 1000 // Wait 5 minutes before retry
    )
  }

  /**
   * Check bounce rate and alert if too high
   */
  private checkBounceRate(): void {
    const stats = this.getStats()
    
    if (stats.totalSent > 100 && stats.bounceRate > this.bounceThreshold) {
      console.error(`🚨 HIGH BOUNCE RATE ALERT: ${(stats.bounceRate * 100).toFixed(2)}% (${stats.bouncedEmails}/${stats.totalSent})`)
      
      // In production, you might want to:
      // - Send alert to administrators
      // - Temporarily disable email sending
      // - Switch to backup email service
    }
  }

  /**
   * Add email to blacklist
   */
  private addToBlacklist(email: string): void {
    console.warn(`📝 Adding ${email} to blacklist due to hard bounce`)
    // In production, you might want to store this in a database
  }

  /**
   * Get emails with high bounce risk
   */
  getHighRiskEmails(): string[] {
    const riskEmails = new Set<string>()
    
    // Emails with multiple soft bounces
    const emailBounceCount: Record<string, number> = {}
    this.bounces.forEach(bounce => {
      if (bounce.bounceType === 'soft') {
        emailBounceCount[bounce.email] = (emailBounceCount[bounce.email] || 0) + 1
      }
    })

    Object.entries(emailBounceCount).forEach(([email, count]) => {
      if (count >= 3) { // 3 or more soft bounces
        riskEmails.add(email)
      }
    })

    return Array.from(riskEmails)
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
}

// Singleton instance
export const emailMonitor = new EmailMonitor()

/**
 * Email retry service
 */
export class EmailRetryService {
  private retryInterval = 30 * 60 * 1000 // 30 minutes
  private maxRetries = 3

  /**
   * Start retry service
   */
  start(): void {
    setInterval(() => {
      this.processRetries()
    }, this.retryInterval)

    console.log('📧 Email retry service started')
  }

  /**
   * Process failed email retries
   */
  private async processRetries(): Promise<void> {
    const failedEmails = emailMonitor.getFailedEmails(this.maxRetries)
    
    if (failedEmails.length === 0) return

    console.log(`🔄 Processing ${failedEmails.length} failed email retries`)

    for (const failedEmail of failedEmails) {
      try {
        // Skip blacklisted emails
        if (emailMonitor.isBlacklisted(failedEmail.to)) {
          console.log(`⏭️ Skipping blacklisted email: ${failedEmail.to}`)
          continue
        }

        // Retry logic would go here
        // For now, just log the attempt
        console.log(`🔄 Retrying email to ${failedEmail.to} (attempt ${failedEmail.retryCount + 1})`)
        
        // Update retry count
        failedEmail.retryCount++
        
      } catch (error) {
        console.error(`❌ Retry failed for ${failedEmail.to}:`, error)
      }
    }
  }
}

// Start retry service
const emailRetryService = new EmailRetryService()
// emailRetryService.start() // Uncomment to enable retry service
