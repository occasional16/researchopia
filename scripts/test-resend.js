/**
 * Resend Email Service Test Script
 * 测试 Resend API 配置和邮件发送
 * 
 * Usage: node test-resend.js [test-email@example.com]
 */

require('dotenv').config({ path: '.env.local' })
const { Resend } = require('resend')

async function testResend() {
  console.log('🔍 测试 Resend 邮件服务...\n')

  // 1. 检查配置
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM || 'noreply@researchopia.com'
  const fromName = process.env.EMAIL_FROM_NAME || 'Researchopia'

  console.log('📋 配置信息:')
  console.log(`  - API Key: ${apiKey ? '✅ 已配置' : '❌ 未配置'}`)
  console.log(`  - From: ${fromName} <${fromEmail}>`)
  console.log()

  if (!apiKey) {
    console.error('❌ 错误: RESEND_API_KEY 未配置')
    console.log('\n📌 解决方案:')
    console.log('1. 访问: https://resend.com/api-keys')
    console.log('2. 创建新的 API Key')
    console.log('3. 在 .env.local 添加: RESEND_API_KEY=re_xxx')
    process.exit(1)
  }

  // 2. 初始化 Resend
  const resend = new Resend(apiKey)

  // 3. 获取测试邮箱
  const testEmail = process.argv[2] || 'delivered@resend.dev' // Resend 测试地址
  console.log(`📧 测试邮箱: ${testEmail}`)
  console.log('   (使用 delivered@resend.dev 可直接测试，无需实际邮箱)\n')

  // 4. 发送测试邮件
  try {
    console.log('📤 正在发送测试邮件...')
    
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [testEmail],
      subject: '✅ Researchopia 邮件服务测试成功',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">🎉 邮件服务测试成功！</h1>
          
          <p>恭喜！您的 Resend 邮件服务已正确配置。</p>
          
          <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">配置信息:</h3>
            <ul>
              <li><strong>From:</strong> ${fromName} &lt;${fromEmail}&gt;</li>
              <li><strong>Provider:</strong> Resend API</li>
              <li><strong>Status:</strong> ✅ Active</li>
            </ul>
          </div>
          
          <p>现在您可以使用此邮件服务发送:</p>
          <ul>
            <li>邮箱验证邮件</li>
            <li>密码重置邮件</li>
            <li>欢迎邮件</li>
          </ul>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="font-size: 12px; color: #666;">
            此邮件由 Researchopia 邮件服务测试脚本自动发送。<br>
            Time: ${new Date().toISOString()}
          </p>
        </div>
      `,
      text: `
Researchopia 邮件服务测试成功！

恭喜！您的 Resend 邮件服务已正确配置。

配置信息:
- From: ${fromName} <${fromEmail}>
- Provider: Resend API
- Status: ✅ Active

现在您可以使用此邮件服务发送邮箱验证、密码重置等邮件。

Time: ${new Date().toISOString()}
      `
    })

    if (error) {
      console.error('\n❌ 发送失败:', error)
      console.log('\n💡 常见问题:')
      console.log('1. API Key 无效或过期')
      console.log('2. 发件人邮箱未验证（需在 Resend 后台配置域名）')
      console.log('3. 免费额度已用完（100封/天）')
      console.log('\n📌 Resend 后台: https://resend.com/domains')
      process.exit(1)
    }

    console.log('\n✅ 邮件发送成功！')
    console.log(`\n📬 邮件ID: ${data.id}`)
    
    if (testEmail === 'delivered@resend.dev') {
      console.log('\n💡 提示: delivered@resend.dev 是 Resend 测试地址')
      console.log('   邮件不会真实送达，但可验证 API 配置正确')
      console.log('   若要测试真实发送，请提供实际邮箱: node test-resend.js your@email.com')
    } else {
      console.log('\n📥 请检查邮箱收件箱（可能在垃圾邮件中）')
    }

    console.log('\n🎯 下一步:')
    console.log('1. 确认 .env.local 包含 RESEND_API_KEY')
    console.log('2. 重启开发服务器: npm run dev')
    console.log('3. 测试注册功能的邮件发送')

  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    console.log('\n💡 请检查:')
    console.log('1. 网络连接是否正常')
    console.log('2. RESEND_API_KEY 格式是否正确（re_xxx）')
    console.log('3. Resend 账户状态是否正常')
    process.exit(1)
  }
}

// 运行测试
testResend().catch(console.error)
