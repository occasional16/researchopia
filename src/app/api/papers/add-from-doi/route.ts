import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchPaperByDOI } from '@/lib/crossref'
import { fetchPaperFromArxiv, isArxivIdentifier } from '@/lib/arxiv'

export async function POST(request: NextRequest) {
  try {
    const { doi, userId } = await request.json()

    if (!doi) {
      return NextResponse.json({ error: 'DOI is required' }, { status: 400 })
    }

    // 使用匿名密钥，支持游客模式
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    console.log('环境变量检查:')
    console.log('- SUPABASE_URL:', supabaseUrl ? '存在' : '缺失')
    console.log('- ANON_KEY:', supabaseAnonKey ? `存在 (长度: ${supabaseAnonKey.length})` : '缺失')
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json({ 
        error: 'Server configuration error' 
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // 支持游客模式添加论文，使用第一个可用用户
    let effectiveUserId = userId
    
    if (!effectiveUserId) {
      console.log('游客模式：查找第一个可用用户...')
      const { data: firstUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .limit(1)
        .single()
      
      if (firstUser) {
        effectiveUserId = firstUser.id
        console.log('使用现有用户进行匿名添加，用户ID:', effectiveUserId)
      } else {
        // 如果没有用户，返回错误，建议注册
        return NextResponse.json({ 
          error: '系统需要至少有一个注册用户才能添加论文。请先注册账户或联系管理员。' 
        }, { status: 400 })
      }
    }

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
    console.log('🔍 Fetching paper metadata for DOI:', doi)
    let crossRefData = await fetchPaperByDOI(doi)
    
    // 如果 CrossRef 没有找到，尝试 arXiv
    if (!crossRefData && isArxivIdentifier(doi)) {
      console.log('🔄 CrossRef未找到，尝试从arXiv获取...')
      const arxivData = await fetchPaperFromArxiv(doi)
      
      if (arxivData) {
        crossRefData = arxivData
        console.log('✅ Paper metadata fetched from arXiv:', arxivData.title)
      }
    }
    
    if (!crossRefData) {
      console.error('❌ Failed to fetch paper from CrossRef and arXiv:', doi)
      return NextResponse.json({ 
        error: '无法获取论文信息',
        details: isArxivIdentifier(doi) 
          ? 'DOI在CrossRef和arXiv数据库中均未找到。请检查DOI是否正确。'
          : 'DOI在CrossRef数据库中未找到。如果是arXiv论文，请使用包含"arXiv"的DOI格式（如：10.48550/arXiv.XXXX.XXXXX）。',
        suggestion: '请检查DOI是否正确，或尝试直接输入论文标题进行搜索。'
      }, { status: 404 })
    }

    console.log('✅ Paper metadata fetched:', crossRefData.title)

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
