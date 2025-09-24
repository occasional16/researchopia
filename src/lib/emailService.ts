// Custom SMTP email service
import nodemailer from 'nodemailer'

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface EmailSendResult {
  success: boolean
  messageId?: string
  error?: string
  bounced?: boolean
  rejected?: string[]
}

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
  from: {
    email: string
    name: string
  }
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private config: EmailConfig | null = null

  /**
   * Initialize the email service with SMTP configuration
   */
  async initialize(): Promise<void> {
    const config: EmailConfig = {
      host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || 'apikey',
        pass: process.env.SMTP_PASS || ''
      },
      from: {
        email: process.env.SMTP_FROM_EMAIL || 'noreply@researchopia.com',
        name: process.env.SMTP_FROM_NAME || 'Researchopia'
      }
    }

    // Check if SMTP is configured
    if (!config.auth.pass || config.auth.pass === 'your_sendgrid_api_key') {
      console.warn('SMTP not configured, email service will not be available')
      return
    }

    this.config = config

    // Create transporter
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      // Additional options for better deliverability
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000, // 1 second between messages
      rateLimit: 10 // max 10 messages per rateDelta
    })

    // Verify connection
    try {
      await this.transporter.verify()
      console.log('✅ SMTP server connection verified')
    } catch (error) {
      console.error('❌ SMTP server connection failed:', error)
      this.transporter = null
    }
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(email: string, verificationUrl: string): Promise<EmailSendResult> {
    const template = this.getEmailVerificationTemplate(verificationUrl)
    return this.sendEmail(email, template)
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string, resetUrl: string): Promise<EmailSendResult> {
    const template = this.getPasswordResetTemplate(resetUrl)
    return this.sendEmail(email, template)
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, username: string): Promise<EmailSendResult> {
    const template = this.getWelcomeTemplate(username)
    return this.sendEmail(email, template)
  }

  /**
   * Generic email sending method
   */
  private async sendEmail(to: string, template: EmailTemplate): Promise<EmailSendResult> {
    if (!this.transporter || !this.config) {
      return {
        success: false,
        error: 'Email service not configured'
      }
    }

    try {
      const mailOptions = {
        from: `"${this.config.from.name}" <${this.config.from.email}>`,
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
        // Headers for better deliverability
        headers: {
          'X-Mailer': 'Researchopia',
          'X-Priority': '3',
          'List-Unsubscribe': `<mailto:unsubscribe@researchopia.com>`,
        }
      }

      const info = await this.transporter.sendMail(mailOptions)
      
      console.log(`📧 Email sent successfully to ${to}: ${info.messageId}`)
      
      return {
        success: true,
        messageId: info.messageId,
        rejected: info.rejected
      }
    } catch (error: any) {
      console.error(`❌ Failed to send email to ${to}:`, error)
      
      return {
        success: false,
        error: error.message,
        bounced: error.code === 'EENVELOPE' || error.responseCode >= 500
      }
    }
  }

  /**
   * Email verification template
   */
  private getEmailVerificationTemplate(verificationUrl: string): EmailTemplate {
    return {
      subject: '验证您的Researchopia账户',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>验证您的账户</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">Researchopia</h1>
              <p style="color: #666;">学术研究协作平台</p>
            </div>
            
            <h2>欢迎加入Researchopia！</h2>
            
            <p>感谢您注册Researchopia账户。请点击下面的按钮验证您的邮箱地址：</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                验证邮箱
              </a>
            </div>
            
            <p>如果按钮无法点击，请复制以下链接到浏览器地址栏：</p>
            <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            
            <p style="font-size: 12px; color: #666;">
              此邮件由系统自动发送，请勿回复。如有疑问，请联系我们的客服团队。
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        欢迎加入Researchopia！
        
        感谢您注册Researchopia账户。请访问以下链接验证您的邮箱地址：
        
        ${verificationUrl}
        
        如有疑问，请联系我们的客服团队。
        
        Researchopia团队
      `
    }
  }

  /**
   * Password reset template
   */
  private getPasswordResetTemplate(resetUrl: string): EmailTemplate {
    return {
      subject: '重置您的Researchopia密码',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>重置密码</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">Researchopia</h1>
            </div>
            
            <h2>重置您的密码</h2>
            
            <p>我们收到了重置您账户密码的请求。请点击下面的按钮设置新密码：</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                重置密码
              </a>
            </div>
            
            <p>如果您没有请求重置密码，请忽略此邮件。</p>
            
            <p style="font-size: 12px; color: #666;">
              此链接将在24小时后失效。
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        重置您的Researchopia密码
        
        我们收到了重置您账户密码的请求。请访问以下链接设置新密码：
        
        ${resetUrl}
        
        如果您没有请求重置密码，请忽略此邮件。
        此链接将在24小时后失效。
        
        Researchopia团队
      `
    }
  }

  /**
   * Welcome email template
   */
  private getWelcomeTemplate(username: string): EmailTemplate {
    return {
      subject: '欢迎来到Researchopia！',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>欢迎来到Researchopia</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">Researchopia</h1>
            </div>
            
            <h2>欢迎，${username}！</h2>
            
            <p>恭喜您成功注册Researchopia账户！您现在可以：</p>
            
            <ul>
              <li>📚 浏览和评价学术论文</li>
              <li>💬 参与学术讨论</li>
              <li>🔍 使用智能搜索功能</li>
              <li>👥 与其他研究者协作</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://researchopia.com" 
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                开始探索
              </a>
            </div>
            
            <p>祝您在学术研究的道路上取得更多成就！</p>
          </div>
        </body>
        </html>
      `,
      text: `
        欢迎来到Researchopia，${username}！
        
        恭喜您成功注册账户！您现在可以：
        
        - 浏览和评价学术论文
        - 参与学术讨论
        - 使用智能搜索功能
        - 与其他研究者协作
        
        访问 https://researchopia.com 开始探索
        
        祝您在学术研究的道路上取得更多成就！
        
        Researchopia团队
      `
    }
  }

  /**
   * Check if email service is available
   */
  isAvailable(): boolean {
    return this.transporter !== null && this.config !== null
  }
}

// Singleton instance
export const emailService = new EmailService()

// Initialize on module load
emailService.initialize().catch(console.error)
