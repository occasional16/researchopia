import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const doi = searchParams.get('doi')

    if (!doi) {
      return NextResponse.json({ error: 'DOI is required' }, { status: 400 })
    }

    // 直接在API路由中创建 Supabase 客户端
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY // 改用 anon key
    
    // 添加调试信息
    console.log('=== Supabase 配置检查 ===')
    console.log('URL 存在:', !!supabaseUrl)
    console.log('Anon Key 存在:', !!supabaseKey)
    console.log('Anon Key 长度:', supabaseKey?.length || 0)
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables')
      console.error('URL:', supabaseUrl || 'undefined')
      console.error('Anon Key:', supabaseKey ? 'exists' : 'undefined')
      return NextResponse.json({ 
        error: 'Server configuration error' 
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 在数据库中查找是否已存在该DOI的论文
    const { data: papers, error } = await supabase
      .from('papers')
      .select(`
        id,
        title,
        authors,
        doi,
        abstract,
        journal,
        publication_date,
        created_at,
        users:created_by(username)
      `)
      .eq('doi', doi)
      .limit(1)

    if (error) {
      console.error('Error checking DOI:', error)
      return NextResponse.json({ 
        error: 'Database error' 
      }, { status: 500 })
    }

    if (papers && papers.length > 0) {
      return NextResponse.json({ 
        exists: true, 
        paper: papers[0] 
      })
    } else {
      return NextResponse.json({ 
        exists: false 
      })
    }

  } catch (error) {
    console.error('Error in check-doi API:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
