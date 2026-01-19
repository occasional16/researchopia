/**
 * @deprecated Use /api/v2/comments instead
 * 
 * Webpage Comments API (Legacy)
 * GET /api/webpages/[urlHash]/comments - Get comments
 * POST /api/webpages/[urlHash]/comments - Create comment
 * 
 * Supports both Cookie auth (website) and Bearer Token auth (browser extension)
 * 
 * Migration: This API will be removed in a future version.
 * Please migrate to /api/v2/comments which provides:
 * - Unified paper/webpage comments API
 * - Nested comments support
 * - User info joining
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClientWithToken } from '@/lib/supabase-server'
import {
  getWebpageByHash,
  getWebpageComments,
} from '@/lib/webpage-database'

/**
 * Get Supabase client with auth from either Bearer token or cookies
 * Priority: Bearer token > Cookies
 */
async function getSupabaseWithAuth(request: NextRequest) {
  // Check for Bearer token first (browser extension)
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  if (token) {
    const supabase = createClientWithToken(token)
    const { data: { user } } = await supabase.auth.getUser()
    return { supabase, user }
  }
  
  // Fall back to cookie-based auth (website)
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

interface RouteParams {
  params: Promise<{ urlHash: string }>
}

/**
 * GET /api/webpages/[urlHash]/comments
 * Query: limit, offset
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { urlHash } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const webpage = await getWebpageByHash(urlHash)
    if (!webpage) {
      return NextResponse.json(
        { error: 'Webpage not found' },
        { status: 404 }
      )
    }

    const comments = await getWebpageComments(webpage.id, limit, offset)

    return NextResponse.json({
      comments,
      pagination: {
        limit,
        offset,
        hasMore: comments.length === limit,
      },
    })
  } catch (error) {
    console.error('GET /api/webpages/[urlHash]/comments error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/webpages/[urlHash]/comments
 * Body: { content, parent_id?, is_anonymous? }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { supabase, user } = await getSupabaseWithAuth(request)

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { urlHash } = await params
    const webpage = await getWebpageByHash(urlHash)

    if (!webpage) {
      return NextResponse.json(
        { error: 'Webpage not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { content, parent_id, is_anonymous } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Comment content is required' },
        { status: 400 }
      )
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: 'Comment is too long (max 5000 characters)' },
        { status: 400 }
      )
    }

    // Create comment using authenticated Supabase client (to pass RLS)
    const { data: comment, error: createError } = await supabase
      .from('webpage_comments')
      .insert({
        webpage_id: webpage.id,
        user_id: user.id,
        content: content.trim(),
        parent_id: parent_id || null,
        is_anonymous: is_anonymous ?? false,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating comment:', createError)
      return NextResponse.json(
        { error: 'Failed to create comment' },
        { status: 500 }
      )
    }

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    console.error('POST /api/webpages/[urlHash]/comments error:', error)
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    )
  }
}
