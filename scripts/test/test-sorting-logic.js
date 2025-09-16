// 测试排序逻辑
console.log('开始测试排序逻辑...\n');

// 模拟数据结构
const mockPapers = [
  {
    id: '1',
    title: '论文A - 高评分多评论',
    ratings: [
      { overall_score: 9 }, 
      { overall_score: 8 }, 
      { overall_score: 9 }
    ],
    comments: [
      { created_at: '2025-01-10T10:00:00Z' },
      { created_at: '2025-01-09T10:00:00Z' },
      { created_at: '2025-01-08T10:00:00Z' },
      { created_at: '2025-01-07T10:00:00Z' }
    ]
  },
  {
    id: '2', 
    title: '论文B - 中等评分少评论',
    ratings: [
      { overall_score: 6 },
      { overall_score: 7 }
    ],
    comments: [
      { created_at: '2025-01-11T10:00:00Z' },
      { created_at: '2025-01-06T10:00:00Z' }
    ]
  },
  {
    id: '3',
    title: '论文C - 最高评分最少评论',
    ratings: [
      { overall_score: 10 }
    ],
    comments: [
      { created_at: '2025-01-05T10:00:00Z' }
    ]
  },
  {
    id: '4',
    title: '论文D - 低评分最新评论',
    ratings: [
      { overall_score: 4 },
      { overall_score: 5 },
      { overall_score: 3 }
    ],
    comments: [
      { created_at: '2025-01-12T10:00:00Z' }  // 最新评论
    ]
  }
];

// 计算统计数据
function calculateStats(papers) {
  return papers.map(paper => {
    const ratings = paper.ratings || [];
    const comments = paper.comments || [];
    
    let averageRating = 0;
    if (ratings.length > 0) {
      const totalScore = ratings.reduce((sum, rating) => sum + rating.overall_score, 0);
      averageRating = totalScore / ratings.length;
    }
    
    const latestCommentTime = comments.length > 0 
      ? Math.max(...comments.map(c => new Date(c.created_at).getTime()))
      : 0;
    
    return {
      ...paper,
      rating_count: ratings.length,
      comment_count: comments.length,
      average_rating: Math.round(averageRating * 10) / 10,
      latest_comment_time: latestCommentTime
    };
  });
}

// 排序函数
function sortPapers(papers, sortBy) {
  const papersWithStats = calculateStats([...papers]);
  
  switch (sortBy) {
    case 'rating':
      papersWithStats.sort((a, b) => {
        if (b.average_rating !== a.average_rating) {
          return b.average_rating - a.average_rating;
        }
        return b.rating_count - a.rating_count;
      });
      break;
    case 'comments':
      papersWithStats.sort((a, b) => {
        if (b.comment_count !== a.comment_count) {
          return b.comment_count - a.comment_count;
        }
        return b.latest_comment_time - a.latest_comment_time;
      });
      break;
    case 'recent_comments':
      papersWithStats.sort((a, b) => {
        if (a.latest_comment_time > 0 && b.latest_comment_time > 0) {
          return b.latest_comment_time - a.latest_comment_time;
        }
        if (a.latest_comment_time > 0) return -1;
        if (b.latest_comment_time > 0) return 1;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
      break;
  }
  
  return papersWithStats;
}

// 测试不同排序
console.log('=== 原始数据 ===');
const statsData = calculateStats(mockPapers);
statsData.forEach(paper => {
  console.log(`${paper.title}:`);
  console.log(`  平均评分: ${paper.average_rating} (${paper.rating_count}个评分)`);
  console.log(`  评论数量: ${paper.comment_count}`);
  console.log(`  最新评论: ${paper.latest_comment_time ? new Date(paper.latest_comment_time).toISOString() : '无'}`);
  console.log('');
});

console.log('=== 评分最高排序 ===');
const ratingSort = sortPapers(mockPapers, 'rating');
ratingSort.forEach((paper, index) => {
  console.log(`${index + 1}. ${paper.title} - 评分:${paper.average_rating} (${paper.rating_count}个)`);
});

console.log('\n=== 评论最多排序 ===');
const commentsSort = sortPapers(mockPapers, 'comments');
commentsSort.forEach((paper, index) => {
  console.log(`${index + 1}. ${paper.title} - 评论:${paper.comment_count}个`);
});

console.log('\n=== 最新评论排序 ===');
const recentSort = sortPapers(mockPapers, 'recent_comments');
recentSort.forEach((paper, index) => {
  const latestDate = paper.latest_comment_time ? new Date(paper.latest_comment_time).toISOString().slice(0, 10) : '无';
  console.log(`${index + 1}. ${paper.title} - 最新评论:${latestDate}`);
});

console.log('\n测试完成！');
