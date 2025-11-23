/**
 * 邮件发送测试脚本
 * 运行: node test-email.js
 */

const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env.local' });

async function testEmail() {
  console.log('📧 开始测试Brevo SMTP配置...\n');

  const config = {
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  };

  console.log('配置信息:');
  console.log('- Host:', config.host);
  console.log('- Port:', config.port);
  console.log('- User:', config.auth.user);
  console.log('- Pass configured:', !!config.auth.pass);
  console.log('');

  if (!config.auth.user || !config.auth.pass) {
    console.error('❌ SMTP_USER 或 SMTP_PASS 未配置');
    console.log('请在.env.local中配置:');
    console.log('SMTP_USER=你的Brevo注册邮箱');
    console.log('SMTP_PASS=你的SMTP_Key');
    return;
  }

  try {
    // 创建transporter
    const transporter = nodemailer.createTransport(config);
    
    // 验证连接
    console.log('🔍 验证SMTP连接...');
    await transporter.verify();
    console.log('✅ SMTP连接成功！\n');

    // 发送测试邮件
    const testEmail = process.argv[2] || config.auth.user; // 命令行参数或使用自己的邮箱
    console.log(`📨 发送测试邮件到: ${testEmail}`);
    
    const info = await transporter.sendMail({
      from: `"Researchopia Test" <${process.env.SMTP_FROM_EMAIL || 'noreply@researchopia.com'}>`,
      to: testEmail,
      subject: '📧 Researchopia邮件服务测试',
      html: `
        <h2>✅ 邮件服务配置成功！</h2>
        <p>您的Brevo SMTP配置正确，邮件服务可以正常使用。</p>
        <p><strong>测试时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          此邮件由 Researchopia 邮件测试脚本自动发送。
        </p>
      `,
      text: `
        ✅ 邮件服务配置成功！
        
        您的Brevo SMTP配置正确，邮件服务可以正常使用。
        
        测试时间: ${new Date().toLocaleString('zh-CN')}
        
        ---
        此邮件由 Researchopia 邮件测试脚本自动发送。
      `
    });

    console.log('✅ 测试邮件发送成功！');
    console.log('- Message ID:', info.messageId);
    console.log('- Accepted:', info.accepted);
    console.log('- Rejected:', info.rejected);
    console.log('\n📊 请登录Brevo后台查看发送统计:');
    console.log('   https://app.brevo.com/statistics/transactional-email');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    
    if (error.code === 'EAUTH') {
      console.log('\n💡 认证失败，请检查:');
      console.log('1. SMTP_USER 是否为Brevo注册邮箱');
      console.log('2. SMTP_PASS 是否为有效的SMTP Key (不是账号密码)');
      console.log('3. SMTP Key是否在Brevo后台启用');
    } else if (error.code === 'EENVELOPE') {
      console.log('\n💡 发件人地址未验证，请:');
      console.log('1. 登录 https://app.brevo.com/settings/senders');
      console.log('2. 验证发件人邮箱或域名');
    }
  }
}

// 运行测试
testEmail().catch(console.error);
