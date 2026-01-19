/**
 * Webpage Detail API
 * GET /api/webpages/[urlHash] - Get webpage with ratings and comments
 * PUT /api/webpages/[urlHash] - Update webpage metadata
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  getWebpageByHash,
  updateWebpage,
  getWebpageRatings,
  getWebpageComments,
  calculateWebpageAverageRating,
} from '@/lib/webpage-database'

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

interface RouteParams {
  params: Promise<{ urlHash: string }>
}

/**
 * GET /api/webpages/[urlHash]
 * Returns webpage with ratings summary and recent comments
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { urlHash } = await params

    const webpage = await getWebpageByHash(urlHash)
    if (!webpage) {
      return NextResponse.json(
        { error: 'Webpage not found' },
        { status: 404 }
      )
    }

    // Fetch ratings and comments in parallel
    const [ratings, comments] = await Promise.all([
      getWebpageRatings(webpage.id),
      getWebpageComments(webpage.id, 10, 0),
    ])

    const averageRating = calculateWebpageAverageRating(ratings)

    return NextResponse.json({
      webpage,
      ratings: {
        items: ratings,
        average: averageRating,
        count: ratings.length,
      },
      comments: {
        items: comments,
        count: comments.length,
      },
    })
  } catch (error) {
    console.error('GET /api/webpages/[urlHash] error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch webpage' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/webpages/[urlHash]
 * Update webpage metadata (only by first_submitted_by user)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await getSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()

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

    // Only first submitter can update
    if (webpage.first_submitted_by !== user.id) {
      return NextResponse.json(
        { error: 'Only the original submitter can update this webpage' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, description, favicon_url, og_image_url, metadata } = body

    const updated = await updateWebpage(urlHash, {
      title,
      description,
      favicon_url,
      og_image_url,
      metadata,
    })

    return NextResponse.json({ webpage: updated })
  } catch (error) {
    console.error('PUT /api/webpages/[urlHash] error:', error)
    return NextResponse.json(
      { error: 'Failed to update webpage' },
      { status: 500 }
    )
  }
}
