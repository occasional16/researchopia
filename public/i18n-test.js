/**
 * 国际化系统测试脚本
 * 用于验证语言切换、翻译系统和组件功能
 */

console.log('🚀 开始国际化系统测试...\n')

// 测试语言切换功能
function testLanguageSwitcher() {
  console.log('📋 测试语言切换器组件...')
  
  try {
    // 检查语言切换按钮是否存在
    const languageSwitcher = document.querySelector('[data-testid="language-switcher"]')
    if (languageSwitcher) {
      console.log('✅ 语言切换器组件已加载')
    } else {
      console.log('⚠️ 语言切换器组件未找到')
    }
    
    // 检查当前语言设置
    const currentLang = localStorage.getItem('preferred-language') || 'zh'
    console.log(`📍 当前语言设置: ${currentLang === 'zh' ? '中文' : 'English'}`)
    
  } catch (error) {
    console.error('❌ 语言切换器测试失败:', error)
  }
}

// 测试导航栏翻译
function testNavbarTranslation() {
  console.log('\n🧭 测试导航栏翻译...')
  
  try {
    const navbar = document.querySelector('nav')
    if (navbar) {
      console.log('✅ 导航栏已加载')
      
      // 检查主要导航项目
      const navItems = navbar.querySelectorAll('a')
      console.log(`📊 找到 ${navItems.length} 个导航链接`)
      
      navItems.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.textContent?.trim() || '(空文本)'}`)
      })
    } else {
      console.log('⚠️ 导航栏未找到')
    }
    
  } catch (error) {
    console.error('❌ 导航栏翻译测试失败:', error)
  }
}

// 测试页面内容翻译
function testContentTranslation() {
  console.log('\n📄 测试页面内容翻译...')
  
  try {
    // 检查主标题
    const mainTitle = document.querySelector('h1')
    if (mainTitle) {
      console.log(`✅ 主标题: "${mainTitle.textContent?.trim()}"`)
    }
    
    // 检查副标题
    const subtitle = document.querySelector('h2, .text-xl, .text-2xl')
    if (subtitle) {
      console.log(`✅ 副标题: "${subtitle.textContent?.trim()}"`)
    }
    
    // 检查按钮文本
    const buttons = document.querySelectorAll('button, .btn')
    if (buttons.length > 0) {
      console.log(`📊 找到 ${buttons.length} 个按钮`)
      buttons.forEach((btn, index) => {
        const text = btn.textContent?.trim()
        if (text && text.length < 50) {
          console.log(`  按钮 ${index + 1}: "${text}"`)
        }
      })
    }
    
  } catch (error) {
    console.error('❌ 内容翻译测试失败:', error)
  }
}

// 测试本地存储功能
function testLocalStorage() {
  console.log('\n💾 测试本地存储功能...')
  
  try {
    const currentLang = localStorage.getItem('preferred-language')
    console.log(`📍 存储的语言偏好: ${currentLang || '未设置'}`)
    
    // 测试语言切换存储
    const originalLang = currentLang || 'zh'
    const testLang = originalLang === 'zh' ? 'en' : 'zh'
    
    localStorage.setItem('preferred-language', testLang)
    console.log(`🔄 测试切换到: ${testLang}`)
    
    const newLang = localStorage.getItem('preferred-language')
    if (newLang === testLang) {
      console.log('✅ 语言设置存储成功')
    } else {
      console.log('❌ 语言设置存储失败')
    }
    
    // 恢复原始设置
    localStorage.setItem('preferred-language', originalLang)
    console.log(`🔄 恢复原始语言设置: ${originalLang}`)
    
  } catch (error) {
    console.error('❌ 本地存储测试失败:', error)
  }
}

// 生成测试报告
function generateTestReport() {
  console.log('\n📋 生成测试报告...')
  
  const report = {
    timestamp: new Date().toISOString(),
    currentURL: window.location.href,
    userAgent: navigator.userAgent,
    language: navigator.language,
    preferredLanguage: localStorage.getItem('preferred-language'),
    pageTitle: document.title,
    hasLanguageSwitcher: !!document.querySelector('[data-testid="language-switcher"]'),
    navItemsCount: document.querySelectorAll('nav a').length,
    buttonCount: document.querySelectorAll('button').length
  }
  
  console.log('📊 测试报告:')
  console.table(report)
  
  return report
}

// 主测试函数
function runInternationalizationTest() {
  console.log('🌐 研学港 Researchopia - 国际化系统测试\n')
  
  testLanguageSwitcher()
  testNavbarTranslation()
  testContentTranslation()
  testLocalStorage()
  
  const report = generateTestReport()
  
  console.log('\n🎉 国际化系统测试完成!')
  console.log('💡 在浏览器控制台运行以下命令来执行此测试:')
  console.log('runInternationalizationTest()')
  
  return report
}

// 导出测试函数到全局作用域
if (typeof window !== 'undefined') {
  window.runInternationalizationTest = runInternationalizationTest
  
  // 页面加载完成后自动运行测试
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(runInternationalizationTest, 1000)
    })
  } else {
    setTimeout(runInternationalizationTest, 1000)
  }
}

export default runInternationalizationTest