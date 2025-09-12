// 测试RSS源可访问性
const RSS_SOURCES = [
  'https://www.sciencedaily.com/rss/all.xml',
  'https://www.nature.com/nature.rss', 
  'https://science.org/rss/news_current.xml',
  'https://news.mit.edu/rss/feed',
  'https://phys.org/rss-feed/'
]

async function testRSSSource(url) {
  try {
    console.log(`🔍 测试: ${url}`)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Academic-Rating-Bot/1.0)'
      }
    })
    
    if (response.ok) {
      const content = await response.text()
      const itemCount = (content.match(/<item[^>]*>/gi) || []).length
      console.log(`✅ 可访问 - 找到 ${itemCount} 个项目`)
    } else {
      console.log(`❌ 失败: ${response.status} ${response.statusText}`)
    }
  } catch (error) {
    console.log(`❌ 错误: ${error.message}`)
  }
}

async function testAllSources() {
  console.log('📡 开始测试RSS源可访问性...\n')
  
  for (const url of RSS_SOURCES) {
    await testRSSSource(url)
    await new Promise(resolve => setTimeout(resolve, 1000)) // 1秒延迟
  }
  
  console.log('\n✅ RSS源测试完成')
}

testAllSources()