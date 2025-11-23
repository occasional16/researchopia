/**
 * 使用Brevo API检查SMTP配置
 * 需要Brevo API Key (v3)
 */

require('dotenv').config({ path: '.env.local' });

async function checkBrevoConfig() {
  console.log('🔍 检查Brevo配置...\n');

  // 从用户获取API Key
  const apiKey = process.argv[2];
  
  if (!apiKey) {
    console.log('❌ 请提供Brevo API Key');
    console.log('\n用法: node check-brevo.js YOUR_API_KEY');
    console.log('\nAPI Key获取: https://app.brevo.com/settings/keys/api');
    console.log('需要 "v3" API Key，不是SMTP Key');
    return;
  }

  try {
    // 1. 检查账户信息
    console.log('📊 检查账户信息...');
    const accountRes = await fetch('https://api.brevo.com/v3/account', {
      headers: {
        'accept': 'application/json',
        'api-key': apiKey
      }
    });

    if (!accountRes.ok) {
      throw new Error(`API请求失败: ${accountRes.status} ${accountRes.statusText}`);
    }

    const account = await accountRes.json();
    console.log('✅ 账户信息:');
    console.log('  - Email:', account.email);
    console.log('  - Plan:', account.plan?.type || 'Unknown');
    console.log('  - Credits:', account.plan?.credits || 'N/A');
    console.log('');

    // 2. 检查发件人配置
    console.log('📧 检查发件人配置...');
    const sendersRes = await fetch('https://api.brevo.com/v3/senders', {
      headers: {
        'accept': 'application/json',
        'api-key': apiKey
      }
    });

    if (sendersRes.ok) {
      const senders = await sendersRes.json();
      console.log(`✅ 已验证的发件人 (${senders.senders?.length || 0}个):`);
      
      const fromEmail = process.env.SMTP_FROM_EMAIL;
      let found = false;
      
      senders.senders?.forEach((sender) => {
        const status = sender.active ? '✅' : '❌';
        console.log(`  ${status} ${sender.email} - ${sender.name || 'No name'}`);
        
        if (sender.email === fromEmail) {
          found = true;
          if (!sender.active) {
            console.log(`    ⚠️ 警告: ${fromEmail} 未激活！`);
          }
        }
      });

      console.log('');
      console.log('当前配置的发件人:', fromEmail);
      
      if (!found) {
        console.log('❌ 错误: 发件人邮箱未在Brevo验证！');
        console.log('解决方案:');
        console.log('1. 访问 https://app.brevo.com/settings/senders');
        console.log('2. 添加并验证:', fromEmail);
        console.log('或临时使用已验证的邮箱:', senders.senders?.[0]?.email);
      } else {
        console.log('✅ 发件人邮箱已验证');
      }
    }

    console.log('');

    // 3. 测试发送邮件（使用API方式）
    console.log('📨 尝试通过API发送测试邮件...');
    const testEmail = process.env.SMTP_USER;
    
    const sendRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: process.env.SMTP_FROM_NAME || 'Researchopia',
          email: process.env.SMTP_FROM_EMAIL
        },
        to: [{
          email: testEmail,
          name: 'Test User'
        }],
        subject: '✅ Brevo配置测试成功',
        htmlContent: `
          <h2>✅ 邮件服务配置正确！</h2>
          <p>您的Brevo配置可以正常工作。</p>
          <p>测试时间: ${new Date().toLocaleString('zh-CN')}</p>
        `
      })
    });

    if (sendRes.ok) {
      const result = await sendRes.json();
      console.log('✅ 测试邮件发送成功！');
      console.log('  - Message ID:', result.messageId);
      console.log('\n请检查邮箱:', testEmail);
    } else {
      const error = await sendRes.json();
      console.log('❌ 发送失败:', error.message || error.code);
      
      if (error.code === 'invalid_parameter' && error.message?.includes('sender')) {
        console.log('\n⚠️ 发件人邮箱问题，请检查:');
        console.log('1. 发件人邮箱是否在Brevo已验证');
        console.log('2. 访问: https://app.brevo.com/settings/senders');
      }
    }

  } catch (error) {
    console.error('\n❌ 检查失败:', error.message);
  }
}

checkBrevoConfig().catch(console.error);
