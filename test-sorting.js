// 简单的排序测试
async function testSorting() {
  const baseUrl = 'http://localhost:3000/api/papers/paginated';
  
  console.log('测试不同排序参数...\n');
  
  // 测试recent_comments排序
  try {
    const response1 = await fetch(`${baseUrl}?page=1&limit=3&sortBy=recent_comments`);
    const data1 = await response1.json();
    console.log('✅ recent_comments排序成功');
    console.log('前3个结果:', data1.data.map(p => ({
      title: p.title.slice(0, 30) + '...',
      comment_count: p.comment_count
    })));
  } catch (err) {
    console.log('❌ recent_comments排序失败:', err.message);
  }
  
  console.log('\n---\n');
  
  // 测试rating排序
  try {
    const response2 = await fetch(`${baseUrl}?page=1&limit=3&sortBy=rating`);
    const data2 = await response2.json();
    console.log('✅ rating排序成功');
    console.log('前3个结果:', data2.data.map(p => ({
      title: p.title.slice(0, 30) + '...',
      average_rating: p.average_rating,
      rating_count: p.rating_count
    })));
  } catch (err) {
    console.log('❌ rating排序失败:', err.message);
  }
  
  console.log('\n---\n');
  
  // 测试comments排序
  try {
    const response3 = await fetch(`${baseUrl}?page=1&limit=3&sortBy=comments`);
    const data3 = await response3.json();
    console.log('✅ comments排序成功');
    console.log('前3个结果:', data3.data.map(p => ({
      title: p.title.slice(0, 30) + '...',
      comment_count: p.comment_count
    })));
  } catch (err) {
    console.log('❌ comments排序失败:', err.message);
  }
}

testSorting().catch(console.error);
