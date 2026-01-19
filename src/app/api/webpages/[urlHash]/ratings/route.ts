/**
 * @deprecated Use /api/v2/ratings instead
 * 
 * Webpage Ratings API (Legacy)
 * GET /api/webpages/[urlHash]/ratings - Get all ratings
 * POST /api/webpages/[urlHash]/ratings - Submit/update rating
 * 
 * Supports both Cookie auth (website) and Bearer Token auth (browser extension)
 * 
 * Migration: This API will be removed in a future version.
 * Please migrate to /api/v2/ratings which provides:
 * - Unified paper/webpage rating API
 * - Consistent field naming (dimension1, dimension2, dimension3, overall)
 * - Better stats calculation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClientWithToken } from '@/lib/supabase-server'
import {
  getWebpageByHash,
  getWebpageUserRating,
  getWebpageRatings,
  calculateWebpageAverageRating,
  normalizeUrl,
  hashUrl,
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
 * GET /api/webpages/[urlHash]/ratings
 * Query: include_user_rating=true (if authenticated)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { urlHash } = await params
    const { searchParams } = new URL(request.url)
    const includeUserRating = searchParams.get('include_user_rating') === 'true'

    const webpage = await getWebpageByHash(urlHash)
    if (!webpage) {
      return NextResponse.json(
        { error: 'Webpage not found' },
        { status: 404 }
      )
    }

    const ratings = await getWebpageRatings(webpage.id)
    const average = calculateWebpageAverageRating(ratings)

    const response: any = {
      ratings,
      average,
      count: ratings.length,
    }

    // Include current user's rating if requested and authenticated
    if (includeUserRating) {
      const { user } = await getSupabaseWithAuth(request)
      if (user) {
        response.userRating = await getWebpageUserRating(webpage.id, user.id)
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('GET /api/webpages/[urlHash]/ratings error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ratings' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/webpages/[urlHash]/ratings
 * Body: { quality_score, usefulness_score, accuracy_score, overall_score, is_anonymous? }
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
    const body = await request.json()
    
    // Get or create webpage
    let webpage = await getWebpageByHash(urlHash)
    if (!webpage) {
      // Auto-create webpage if URL and title are provided (from browser extension)
      const url = body.url
      const title = body.title
      
      if (!url) {
        return NextResponse.json(
          { error: 'Webpage not found and no URL provided to create it' },
          { status: 404 }
        )
      }
      
      // Create webpage using authenticated Supabase client (to pass RLS)
      const normalizedUrl = normalizeUrl(url)
      const computedUrlHash = hashUrl(url)
      
      const { data: newWebpage, error: createError } = await supabase
        .from('webpages')
        .insert({
          url: normalizedUrl,
          url_hash: computedUrlHash,
          title: title,
          first_submitted_by: user.id,
        })
        .select()
        .single()
      
      if (createError) {
        console.error('Error creating webpage:', createError)
        return NextResponse.json(
          { error: 'Failed to create webpage record' },
          { status: 500 }
        )
      }
      
      webpage = newWebpage
    }

    // Support both naming conventions: snake_case (API) and camelCase (extension)
    const quality_score = body.quality_score ?? body.qualityRating
    const usefulness_score = body.usefulness_score ?? body.usefulnessRating
    const accuracy_score = body.accuracy_score ?? body.accuracyRating
    const overall_score = body.overall_score ?? body.overallRating
    const is_anonymous = body.is_anonymous ?? body.isAnonymous ?? false

    // Validate overall_score is required
    if (typeof overall_score !== 'number' || overall_score < 1 || overall_score > 5) {
      return NextResponse.json(
        { error: 'Overall score is required and must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Validate optional scores (allow null/undefined or valid number)
    const optionalScores = [quality_score, usefulness_score, accuracy_score]
    if (optionalScores.some(s => s !== null && s !== undefined && (typeof s !== 'number' || s < 1 || s > 5))) {
      return NextResponse.json(
        { error: 'Optional scores must be numbers between 1 and 5' },
        { status: 400 }
      )
    }

    // Ensure webpage exists after potential creation
    if (!webpage) {
      return NextResponse.json(
        { error: 'Failed to resolve webpage' },
        { status: 500 }
      )
    }

    // Check if user already has a rating for this webpage
    const { data: existingRating } = await supabase
      .from('webpage_ratings')
      .select('id')
      .eq('webpage_id', webpage.id)
      .eq('user_id', user.id)
      .single()
    
    let rating
    if (existingRating) {
      // Update existing rating
      const { data, error } = await supabase
        .from('webpage_ratings')
        .update({
          quality_score: quality_score || null,
          usefulness_score: usefulness_score || null,
          accuracy_score: accuracy_score || null,
          overall_score,
          is_anonymous,
        })
        .eq('id', existingRating.id)
        .select()
        .single()
      
      if (error) {
        console.error('Error updating rating:', error)
        return NextResponse.json(
          { error: 'Failed to update rating' },
          { status: 500 }
        )
      }
      rating = data
    } else {
      // Create new rating
      const { data, error } = await supabase
        .from('webpage_ratings')
        .insert({
          webpage_id: webpage.id,
          user_id: user.id,
          quality_score: quality_score || null,
          usefulness_score: usefulness_score || null,
          accuracy_score: accuracy_score || null,
          overall_score,
          is_anonymous,
        })
        .select()
        .single()
      
      if (error) {
        console.error('Error creating rating:', error)
        return NextResponse.json(
          { error: 'Failed to create rating' },
          { status: 500 }
        )
      }
      rating = data
    }

    // Get all ratings and calculate average
    const { data: allRatings } = await supabase
      .from('webpage_ratings')
      .select('*')
      .eq('webpage_id', webpage.id)
    
    const average = calculateWebpageAverageRating(allRatings || [])

    return NextResponse.json({
      rating,
      average,
      count: allRatings?.length || 0,
    })
  } catch (error) {
    console.error('POST /api/webpages/[urlHash]/ratings error:', error)
    return NextResponse.json(
      { error: 'Failed to submit rating' },
      { status: 500 }
    )
  }
}
