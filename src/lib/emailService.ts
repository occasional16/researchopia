// Email service with Resend API (recommended) and SMTP fallback
import { Resend } from 'resend'

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
  from: {
    email: string
    name: string
  }
}

class EmailService {
  private resend: Resend | null = null
  private config: EmailConfig | null = null
  private provider: 'resend' | 'smtp' | null = null

  /**
   * Initialize the email service with Resend API
   */
  async initialize(): Promise<void> {
    const config: EmailConfig = {
      from: {
        email: process.env.EMAIL_FROM || 'noreply@researchopia.com',
        name: process.env.EMAIL_FROM_NAME || 'Researchopia'
      }
    }

    this.config = config

    // Try Resend first (recommended)
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      try {
        this.resend = new Resend(resendKey)
        this.provider = 'resend'
        console.log('✅ Email service initialized with Resend API')
        console.log('📧 From:', `${config.from.name} <${config.from.email}>`)
        return
      } catch (error) {
        console.error('❌ Resend initialization failed:', error)
      }
    }

    // If Resend not available, check SMTP (legacy fallback)
    const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    if (smtpConfigured) {
      console.warn('⚠️ Using legacy SMTP configuration. Consider migrating to Resend.')
      console.warn('⚠️ Get free API key at: https://resend.com/api-keys')
      this.provider = 'smtp'
      await this.initializeSMTP()
      return
    }

    console.error('❌ No email service configured!')
    console.error('📌 To fix: Add RESEND_API_KEY to .env.local')
    console.error('📌 Get free key: https://resend.com/api-keys')
  }

  /**
   * Legacy SMTP initialization (kept for backward compatibility)
   */
  private async initializeSMTP(): Promise<void> {
    // Dynamic import to avoid loading nodemailer if not needed
    const nodemailer = await import('nodemailer')
    
    const smtpConfig = {
      host: process.env.SMTP_HOST!,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!
      }
    }

    const transporter = nodemailer.default.createTransport(smtpConfig)
    
    try {
      await transporter.verify()
      console.log('✅ SMTP server connection verified')
    } catch (error) {
      console.error('❌ SMTP server connection failed:', error)
      this.provider = null
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
   * Generic email sending method with Resend API
   */
  private async sendEmail(to: string, template: EmailTemplate): Promise<EmailSendResult> {
    if (!this.config) {
      return {
        success: false,
        error: 'Email service not configured'
      }
    }

    // Try Resend API first
    if (this.provider === 'resend' && this.resend) {
      try {
        const { data, error } = await this.resend.emails.send({
          from: `${this.config.from.name} <${this.config.from.email}>`,
          to: [to],
          subject: template.subject,
          html: template.html,
          text: template.text,
        })

        if (error) {
          console.error(`❌ Resend API error for ${to}:`, error)
          return {
            success: false,
            error: error.message
          }
        }

        console.log(`✅ Email sent via Resend to ${to}: ${data?.id}`)
        return {
          success: true,
          messageId: data?.id
        }
      } catch (error: any) {
        console.error(`❌ Failed to send via Resend to ${to}:`, error)
        return {
          success: false,
          error: error.message
        }
      }
    }

    // Fallback to SMTP (legacy)
    if (this.provider === 'smtp') {
      return this.sendEmailSMTP(to, template)
    }

    return {
      success: false,
      error: 'No email provider configured'
    }
  }

  /**
   * Legacy SMTP sending (kept for backward compatibility)
   */
  private async sendEmailSMTP(to: string, template: EmailTemplate): Promise<EmailSendResult> {
    try {
      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST!,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASS!
        }
      })

      const info = await transporter.sendMail({
        from: `"${this.config!.from.name}" <${this.config!.from.email}>`,
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
      })
      
      console.log(`📧 Email sent via SMTP to ${to}: ${info.messageId}`)
      return {
        success: true,
        messageId: info.messageId,
        rejected: info.rejected.map(addr => typeof addr === 'string' ? addr : addr.address)
      }
    } catch (error: any) {
      console.error(`❌ Failed to send via SMTP to ${to}:`, error)
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
    return this.provider !== null && this.config !== null
  }
}

// Singleton instance
export const emailService = new EmailService()

// Initialize on module load
emailService.initialize().catch(console.error)
