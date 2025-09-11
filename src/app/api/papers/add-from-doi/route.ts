import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchPaperByDOI } from '@/lib/crossref'

export async function POST(request: NextRequest) {
  try {
    const { doi, userId } = await request.json()

    if (!doi) {
      return NextResponse.json({ error: 'DOI is required' }, { status: 400 })
    }

    // 如果没有提供userId，使用一个默认的系统用户ID
    // 这样可以允许未登录用户也能添加论文
    const effectiveUserId = userId || 'anonymous-user'

    // 直接在API路由中创建 Supabase 客户端
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY // 改用 anon key
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables')
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

    // 再次检查是否已存在该DOI的论文
    const { data: existingPapers } = await supabase
      .from('papers')
      .select('id')
      .eq('doi', doi)
      .limit(1)

    if (existingPapers && existingPapers.length > 0) {
      return NextResponse.json({ 
        error: 'Paper with this DOI already exists',
        paperId: existingPapers[0].id
      }, { status: 409 })
    }

    // 从CrossRef获取论文信息
    const crossRefData = await fetchPaperByDOI(doi)
    
    if (!crossRefData) {
      return NextResponse.json({ 
        error: '无法从CrossRef获取论文信息，请检查DOI是否正确' 
      }, { status: 404 })
    }

    // 准备论文数据
    const newPaper = {
      title: crossRefData.title,
      authors: crossRefData.authors,
      abstract: crossRefData.abstract || '',
      doi: crossRefData.doi,
      journal: crossRefData.journal,
      publication_date: crossRefData.publication_date,
      keywords: crossRefData.keywords || [],
      created_by: effectiveUserId
    }

    // 插入到数据库
    const { data: papers, error: insertError } = await supabase
      .from('papers')
      .insert([newPaper])
      .select(`
        id,
        title,
        authors,
        doi,
        abstract,
        journal,
        publication_date,
        keywords,
        created_at
      `)

    if (insertError) {
      console.error('Error inserting paper:', insertError)
      return NextResponse.json({ 
        error: 'Failed to save paper to database',
        details: insertError.message 
      }, { status: 500 })
    }

    const createdPaper = papers[0]

    return NextResponse.json({ 
      success: true,
      paper: createdPaper,
      message: '论文添加成功'
    })

  } catch (error) {
    console.error('Error in add-from-doi API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
