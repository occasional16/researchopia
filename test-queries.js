// 测试常见科学术语的相关性
const articles = [
    "Scientists capture elusive liquid carbon — a diamond precursor",
    "Graphene just broke a fundamental law of physics",
    "Black holes just proved Stephen Hawking right",
    "NASA spacecraft detect a mysterious force shaping",
    "Study finds cell memory can be more like a dimmer"
]

function testQuery(query) {
    console.log(`\n=== 测试查询: "${query}" ===`)
    
    articles.forEach((article, index) => {
        const contentLower = article.toLowerCase()
        const queryLower = query.toLowerCase()
        const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2)
        
        let score = 0
        
        // 完整匹配
        if (contentLower.includes(queryLower)) {
            score += 50
        }
        
        // 单词匹配
        for (const word of queryWords) {
            if (contentLower.includes(word)) {
                score += 10
            }
        }
        
        console.log(`${index + 1}. [${score}分] ${article.substring(0, 50)}...`)
    })
}

// 测试不同的查询
testQuery("Hydration solids")
testQuery("carbon")
testQuery("physics")
testQuery("black holes")
testQuery("cells")