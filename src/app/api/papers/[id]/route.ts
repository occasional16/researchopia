import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { MockAuthService } from '@/lib/mockAuth'
import { getPapers } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if using Supabase or Mock mode
    if (!supabase || MockAuthService.shouldUseMockAuth()) {
      // Return mock data
      const papers = await getPapers()
      const paper = papers.find(p => p.id === id)
      
      if (!paper) {
        return NextResponse.json({ error: 'Paper not found' }, { status: 404 })
      }
      
      return NextResponse.json(paper)
    }

    // Use Supabase
    const { data: paper, error } = await supabase
      .from('papers')
      .select(`
        *,
        users:created_by (
          id,
          username,
          email
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Supabase error:', error)
      // Fallback to mock data
      const papers = await getPapers()
      const mockPaper = papers.find(p => p.id === id)
      
      if (!mockPaper) {
        return NextResponse.json({ error: 'Paper not found' }, { status: 404 })
      }
      
      return NextResponse.json(mockPaper)
    }

    return NextResponse.json(paper)
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    // Check if using Supabase or Mock mode
    if (!supabase || MockAuthService.shouldUseMockAuth()) {
      // Mock mode - return success response
      return NextResponse.json({ success: true, message: 'Paper updated (Mock mode)' })
    }

    // Use Supabase
    const { data, error } = await supabase
      .from('papers')
      .update(body)
      .eq('id', id)
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data[0])
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Check if using Supabase or Mock mode
    if (!supabase || MockAuthService.shouldUseMockAuth()) {
      // Mock mode - return success response
      return NextResponse.json({ success: true, message: 'Paper deleted (Mock mode)' })
    }

    // Use Supabase
    const { error } = await supabase
      .from('papers')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
