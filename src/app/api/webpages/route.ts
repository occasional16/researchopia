/**
 * Webpage API - Main entry point
 * GET /api/webpages - List webpages with stats
 * POST /api/webpages - Create/get webpage
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  getWebpagesWithStats,
  getOrCreateWebpage,
  hashUrl,
} from '@/lib/webpage-database'

// Get server-side Supabase client with auth
async function getSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
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
}

/**
 * GET /api/webpages
 * Query params: limit, offset, sort (newest|rating|comments), search
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const sort = (searchParams.get('sort') || 'newest') as 'newest' | 'rating' | 'comments'
    const search = searchParams.get('search') || undefined

    const webpages = await getWebpagesWithStats(limit, offset, sort, search)

    return NextResponse.json({
      webpages,
      pagination: {
        limit,
        offset,
        hasMore: webpages.length === limit,
      },
    })
  } catch (error) {
    console.error('GET /api/webpages error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch webpages' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/webpages
 * Body: { url, title?, description?, favicon_url?, og_image_url?, metadata? }
 * Returns: webpage record (existing or newly created)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { url, title, description, favicon_url, og_image_url, metadata } = body

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    const webpage = await getOrCreateWebpage(
      url,
      { title, description, favicon_url, og_image_url, metadata },
      user.id
    )

    return NextResponse.json({
      webpage,
      url_hash: hashUrl(url),
    })
  } catch (error) {
    console.error('POST /api/webpages error:', error)
    return NextResponse.json(
      { error: 'Failed to create webpage' },
      { status: 500 }
    )
  }
}
