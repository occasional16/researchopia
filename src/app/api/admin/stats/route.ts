import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { MockAuthService } from '@/lib/mockAuth'

export async function GET(request: NextRequest) {
  try {
    // Check if using Supabase or Mock mode
    if (!supabase || MockAuthService.shouldUseMockAuth()) {
      // Return mock stats
      const mockStats = {
        totalUsers: 10,
        totalPapers: 25,
        totalRatings: 150,
        totalComments: 75
      }
      
      const mockActivity = [
        { type: 'paper', action: '添加了新论文', user: 'admin', time: '2小时前' },
        { type: 'rating', action: '发表了评分', user: 'user1', time: '3小时前' },
        { type: 'comment', action: '发表了评论', user: 'user2', time: '5小时前' }
      ]

      return NextResponse.json({ 
        stats: mockStats, 
        activity: mockActivity 
      })
    }

    // Use Supabase to get real stats
    const [usersResult, papersResult, ratingsResult, commentsResult] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('papers').select('id', { count: 'exact', head: true }),
      supabase.from('ratings').select('id', { count: 'exact', head: true }),
      supabase.from('comments').select('id', { count: 'exact', head: true })
    ])

    const stats = {
      totalUsers: usersResult.count || 0,
      totalPapers: papersResult.count || 0,
      totalRatings: ratingsResult.count || 0,
      totalComments: commentsResult.count || 0
    }

    // Get recent activity
    const { data: recentActivity, error: activityError } = await supabase
      .from('papers')
      .select(`
        id,
        title,
        created_at,
        users:created_by (username)
      `)
      .order('created_at', { ascending: false })
      .limit(5)

    let activity: any[] = []
    if (!activityError && recentActivity) {
      activity = recentActivity.map(paper => ({
        type: 'paper',
        action: '添加了新论文',
        user: (paper.users as any)?.username || 'Unknown',
        time: formatTimeAgo(paper.created_at),
        title: paper.title
      }))
    }

    return NextResponse.json({ stats, activity })
  } catch (error) {
    console.error('Admin stats API error:', error)
    
    // Fallback to mock data on error
    const mockStats = {
      totalUsers: 10,
      totalPapers: 25,
      totalRatings: 150,
      totalComments: 75
    }
    
    const mockActivity = [
      { type: 'paper', action: '添加了新论文', user: 'admin', time: '2小时前' },
      { type: 'rating', action: '发表了评分', user: 'user1', time: '3小时前' },
      { type: 'comment', action: '发表了评论', user: 'user2', time: '5小时前' }
    ]

    return NextResponse.json({ 
      stats: mockStats, 
      activity: mockActivity 
    })
  }
}

function formatTimeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 60) {
    return `${diffInMinutes}分钟前`
  } else if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60)
    return `${hours}小时前`
  } else {
    const days = Math.floor(diffInMinutes / 1440)
    return `${days}天前`
  }
}
