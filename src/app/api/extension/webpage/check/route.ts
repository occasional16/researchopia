/**
 * Browser Extension Webpage Check API
 * GET /api/extension/webpage/check?url=xxx
 * Quick check if webpage exists and get basic stats
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getWebpageByUrl,
  hashUrl,
  getWebpageRatings,
  calculateWebpageAverageRating,
} from '@/lib/webpage-database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    const urlHash = hashUrl(url)
    const webpage = await getWebpageByUrl(url)

    if (!webpage) {
      return NextResponse.json({
        exists: false,
        url_hash: urlHash,
      })
    }

    // Get quick stats
    const ratings = await getWebpageRatings(webpage.id)
    const average = calculateWebpageAverageRating(ratings)

    return NextResponse.json({
      exists: true,
      url_hash: urlHash,
      webpage_id: webpage.id,
      title: webpage.title,
      rating_count: ratings.length,
      average_rating: average?.overall || 0,
    })
  } catch (error) {
    console.error('GET /api/extension/webpage/check error:', error)
    return NextResponse.json(
      { error: 'Failed to check webpage' },
      { status: 500 }
    )
  }
}
