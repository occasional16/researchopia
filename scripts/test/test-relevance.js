// 测试相关性算法
const testContent = "Scientists capture elusive liquid carbon — a diamond precursor"
const testQuery = "Hydration solids"

function calculateRelevance(content, query) {
    const contentLower = content.toLowerCase()
    const queryLower = query.toLowerCase()
    
    console.log(`内容: "${contentLower}"`)
    console.log(`查询: "${queryLower}"`)
    
    // 简化：直接分割查询词，不过滤常见词
    const queryWords = queryLower.split(/\s+/)
        .filter(word => word.length > 2)
    
    console.log(`查询词: [${queryWords.join(', ')}]`)
    
    if (queryWords.length === 0) return 0
    
    let totalScore = 0
    
    // 1. 完整查询匹配
    if (contentLower.includes(queryLower)) {
        console.log(`✅ 完整匹配: +50`)
        totalScore += 50
    } else {
        console.log(`❌ 无完整匹配`)
    }
    
    // 2. 简单的单词包含检查
    for (const word of queryWords) {
        if (contentLower.includes(word)) {
            console.log(`✅ 找到词: "${word}" +10`)
            totalScore += 10
        } else {
            console.log(`❌ 未找到词: "${word}"`)
        }
    }
    
    console.log(`最终得分: ${totalScore}`)
    return totalScore
}

console.log('=== 相关性算法测试 ===')
calculateRelevance(testContent, testQuery)

console.log('\n=== 测试另一个例子 ===')
calculateRelevance("Study of hydration in concrete solids", testQuery)