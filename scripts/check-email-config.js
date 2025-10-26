/**
 * 邮件服务配置检查工具
 * 
 * 用法：
 * 1. 在本地运行: npm run check-email-config
 * 2. 在线检查：访问 /api/admin/email-status (需要管理员密钥)
 */

console.log('\n========================================')
console.log('📧 邮件服务配置检查')
console.log('========================================\n')

// 检查环境变量
const checks = [
  {
    name: 'SMTP_HOST',
    value: process.env.SMTP_HOST,
    expected: 'smtp.sendgrid.net',
    required: false
  },
  {
    name: 'SMTP_PORT',
    value: process.env.SMTP_PORT,
    expected: '587',
    required: false
  },
  {
    name: 'SMTP_USER',
    value: process.env.SMTP_USER,
    expected: 'apikey',
    required: false
  },
  {
    name: 'SMTP_PASS',
    value: process.env.SMTP_PASS ? '*** (已设置)' : undefined,
    expected: 'SendGrid API密钥',
    required: true,
    actualLength: process.env.SMTP_PASS?.length
  },
  {
    name: 'SMTP_FROM_EMAIL',
    value: process.env.SMTP_FROM_EMAIL,
    expected: 'noreply@researchopia.com',
    required: false
  },
  {
    name: 'SMTP_FROM_NAME',
    value: process.env.SMTP_FROM_NAME,
    expected: 'Researchopia',
    required: false
  },
  {
    name: 'ADMIN_API_KEY',
    value: process.env.ADMIN_API_KEY ? '*** (已设置)' : undefined,
    expected: '随机安全字符串',
    required: false,
    actualLength: process.env.ADMIN_API_KEY?.length
  }
]

let hasError = false

checks.forEach(check => {
  const status = check.value ? '✅' : (check.required ? '❌' : '⚠️')
  console.log(`${status} ${check.name}`)
  console.log(`   期望值: ${check.expected}`)
  console.log(`   实际值: ${check.value || '未设置'}`)
  if (check.actualLength) {
    console.log(`   长度: ${check.actualLength} 字符`)
  }
  console.log('')

  if (check.required && !check.value) {
    hasError = true
  }
})

console.log('========================================')
console.log('📊 配置状态总结')
console.log('========================================\n')

if (hasError) {
  console.log('❌ 配置不完整！邮件服务将无法正常工作')
  console.log('')
  console.log('⚠️ 缺少必需的配置项：')
  checks.filter(c => c.required && !c.value).forEach(c => {
    console.log(`   - ${c.name}`)
  })
  console.log('')
  console.log('📝 修复步骤：')
  console.log('   1. 在 .env.local 中添加缺少的环境变量')
  console.log('   2. 或在 Vercel 项目设置中添加环境变量')
  console.log('   3. 重新部署项目')
  console.log('')
} else {
  console.log('✅ 配置完整！邮件服务应该可以正常工作')
  console.log('')
  console.log('📝 后续步骤：')
  console.log('   1. 确认 SendGrid API密钥有效（登录 SendGrid 查看）')
  console.log('   2. 确认发件人邮箱已在 SendGrid 验证')
  console.log('   3. 测试发送邮件')
  console.log('')
}

console.log('========================================')
console.log('📚 详细文档：docs/EMAIL_SERVICE_DEBUG.md')
console.log('========================================\n')
