/**
 * Unified Ratings API v2
 * 
 * POST /api/v2/ratings - Create/update rating
 * GET  /api/v2/ratings - Get ratings for a target
 * 
 * Supports both papers and webpages via targetType parameter
 * Supports both Cookie and Bearer Token authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest, requireAuth, AuthError } from '@/lib/api-auth';

// ============================================================================
// Types
// ============================================================================

type TargetType = 'paper' | 'webpage';

interface RatingScores {
  dimension1?: number;
  dimension2?: number;
  dimension3?: number;
  overall: number;
}

// ============================================================================
// GET - Get ratings for a target
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('targetType') as TargetType;
    const targetId = searchParams.get('targetId');
    const includeUserRating = searchParams.get('includeUserRating') === 'true';

    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: 'targetType and targetId are required' },
        { status: 400 }
      );
    }

    if (!['paper', 'webpage'].includes(targetType)) {
      return NextResponse.json(
        { error: 'targetType must be "paper" or "webpage"' },
        { status: 400 }
      );
    }

    const { supabase, user } = await getAuthFromRequest(request);
    const table = targetType === 'paper' ? 'ratings' : 'webpage_ratings';
    const targetColumn = targetType === 'paper' ? 'paper_id' : 'webpage_id';

    // For webpage, targetId is url_hash, need to get actual webpage_id first
    let actualTargetId = targetId;
    if (targetType === 'webpage') {
      const { data: webpage, error: webpageError } = await supabase
        .from('webpages')
        .select('id')
        .eq('url_hash', targetId)
        .single();
      
      if (webpageError || !webpage) {
        // If webpage doesn't exist yet, return empty ratings
        return NextResponse.json({
          ratings: [],
          stats: { count: 0, average: { overall: 0 } },
          userRating: null,
        });
      }
      actualTargetId = webpage.id;
    }

    // Get all ratings
    // Note: paper ratings have foreign key to users, but webpage_ratings may not
    let query = supabase.from(table).select('*').eq(targetColumn, actualTargetId);
    
    // For paper ratings, we can join users directly
    if (targetType === 'paper') {
      const { data: ratings, error } = await supabase
        .from(table)
        .select(`
          *,
          user:users(id, username, avatar_url)
        `)
        .eq(targetColumn, actualTargetId);
      
      if (error) {
        console.error('Error fetching ratings:', error);
        return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 });
      }
      
      // Calculate statistics and return
      const stats = calculateStats(ratings || [], targetType);
      
      let userRating = null;
      if (includeUserRating && user) {
        const { data } = await supabase
          .from(table)
          .select('*')
          .eq(targetColumn, actualTargetId)
          .eq('user_id', user.id)
          .single();
        userRating = data ? normalizeRating(data, targetType) : null;
      }
      
      return NextResponse.json({
        ratings: (ratings || []).map(r => normalizeRating(r, targetType)),
        stats,
        userRating,
      });
    }
    
    // For webpage ratings, fetch ratings first then get user info separately
    const { data: ratings, error } = await supabase
      .from(table)
      .select('*')
      .eq(targetColumn, actualTargetId);

    if (error) {
      console.error('Error fetching ratings:', error);
      return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 });
    }

    // Get user info for webpage ratings
    let ratingsWithUsers = ratings || [];
    if (ratingsWithUsers.length > 0) {
      const userIds = [...new Set(ratingsWithUsers.map(r => r.user_id))];
      const { data: users } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .in('id', userIds);
      
      const userMap = new Map((users || []).map(u => [u.id, u]));
      ratingsWithUsers = ratingsWithUsers.map(r => ({
        ...r,
        user: userMap.get(r.user_id) || null
      }));
    }

    // Calculate statistics
    const stats = calculateStats(ratingsWithUsers, targetType);

    // Get user's rating if requested
    let userRating = null;
    if (includeUserRating && user) {
      const { data } = await supabase
        .from(table)
        .select('*')
        .eq(targetColumn, actualTargetId)
        .eq('user_id', user.id)
        .single();
      userRating = data ? normalizeRating(data, targetType) : null;
    }

    return NextResponse.json({
      ratings: ratingsWithUsers.map(r => normalizeRating(r, targetType)),
      stats,
      userRating,
    });
  } catch (error) {
    console.error('GET /api/v2/ratings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST - Create or update rating
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(request);

    const body = await request.json();
    const { targetType, targetId, scores, isAnonymous, showUsername, url, title } = body as {
      targetType: TargetType;
      targetId: string;
      scores: RatingScores;
      isAnonymous?: boolean;
      showUsername?: boolean;
      url?: string;
      title?: string;
    };

    // Validation
    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: 'targetType and targetId are required' },
        { status: 400 }
      );
    }

    if (!scores?.overall || scores.overall < 1 || scores.overall > 10) {
      return NextResponse.json(
        { error: 'overall score is required (1-10)' },
        { status: 400 }
      );
    }

    // Validate optional dimension scores
    for (const key of ['dimension1', 'dimension2', 'dimension3'] as const) {
      const score = scores[key];
      if (score !== undefined && score !== null && (score < 1 || score > 10)) {
        return NextResponse.json(
          { error: `${key} must be between 1 and 10` },
          { status: 400 }
        );
      }
    }

    // Handle different target types
    if (targetType === 'paper') {
      return handlePaperRating(supabase, user.id, targetId, scores, isAnonymous, showUsername);
    } else {
      return handleWebpageRating(supabase, user.id, targetId, scores, isAnonymous, showUsername, url, title);
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/v2/ratings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function handlePaperRating(
  supabase: any,
  userId: string,
  paperId: string,
  scores: RatingScores,
  isAnonymous?: boolean,
  showUsername?: boolean
) {
  // Check if rating exists
  const { data: existing } = await supabase
    .from('ratings')
    .select('id')
    .eq('paper_id', paperId)
    .eq('user_id', userId)
    .single();

  const ratingData = {
    paper_id: paperId,
    user_id: userId,
    innovation_score: scores.dimension1 || null,
    methodology_score: scores.dimension2 || null,
    practicality_score: scores.dimension3 || null,
    overall_score: scores.overall,
    is_anonymous: isAnonymous ?? false,
    show_username: isAnonymous ? false : (showUsername ?? true),
  };

  let rating;
  if (existing) {
    const { data, error } = await supabase
      .from('ratings')
      .update(ratingData)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    rating = data;
  } else {
    const { data, error } = await supabase
      .from('ratings')
      .insert(ratingData)
      .select()
      .single();
    if (error) throw error;
    rating = data;
  }

  // Get updated stats
  const { data: allRatings } = await supabase
    .from('ratings')
    .select('*')
    .eq('paper_id', paperId);

  return NextResponse.json({
    rating: normalizeRating(rating, 'paper'),
    stats: calculateStats(allRatings || [], 'paper'),
  });
}

async function handleWebpageRating(
  supabase: any,
  userId: string,
  targetId: string,
  scores: RatingScores,
  isAnonymous?: boolean,
  showUsername?: boolean,
  url?: string,
  title?: string
) {
  // For webpage, targetId is urlHash. Need to get or create webpage first.
  let webpageId = targetId;
  
  // Check if targetId is a urlHash (16 chars hex) or UUID
  const isUrlHash = /^[a-f0-9]{16}$/.test(targetId);
  
  if (isUrlHash) {
    // Look up webpage by urlHash
    const { data: webpage } = await supabase
      .from('webpages')
      .select('id')
      .eq('url_hash', targetId)
      .single();

    if (!webpage) {
      // Auto-create webpage if url is provided
      if (!url) {
        return NextResponse.json(
          { error: 'Webpage not found. Provide url to auto-create.' },
          { status: 404 }
        );
      }

      // Create webpage
      const normalizedUrl = normalizeUrl(url);
      const { data: newWebpage, error: createError } = await supabase
        .from('webpages')
        .insert({
          url: normalizedUrl,
          url_hash: targetId,
          title: title || null,
          first_submitted_by: userId,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating webpage:', createError);
        return NextResponse.json({ error: 'Failed to create webpage' }, { status: 500 });
      }

      webpageId = newWebpage.id;
    } else {
      webpageId = webpage.id;
    }
  }

  // Check if rating exists
  const { data: existing } = await supabase
    .from('webpage_ratings')
    .select('id')
    .eq('webpage_id', webpageId)
    .eq('user_id', userId)
    .single();

  const ratingData = {
    webpage_id: webpageId,
    user_id: userId,
    quality_score: scores.dimension1 || null,
    usefulness_score: scores.dimension2 || null,
    accuracy_score: scores.dimension3 || null,
    overall_score: scores.overall,
    is_anonymous: isAnonymous ?? false,
    show_username: isAnonymous ? false : (showUsername ?? true),
  };

  let rating;
  if (existing) {
    const { data, error } = await supabase
      .from('webpage_ratings')
      .update(ratingData)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    rating = data;
  } else {
    const { data, error } = await supabase
      .from('webpage_ratings')
      .insert(ratingData)
      .select()
      .single();
    if (error) throw error;
    rating = data;
  }

  // Get updated stats
  const { data: allRatings } = await supabase
    .from('webpage_ratings')
    .select('*')
    .eq('webpage_id', webpageId);

  return NextResponse.json({
    rating: normalizeRating(rating, 'webpage'),
    stats: calculateStats(allRatings || [], 'webpage'),
  });
}

// Normalize rating to unified format
function normalizeRating(rating: any, targetType: TargetType) {
  const baseRating = {
    id: rating.id,
    userId: rating.user_id,
    isAnonymous: rating.is_anonymous,
    showUsername: rating.show_username ?? true,
    createdAt: rating.created_at,
    updatedAt: rating.updated_at,
    user: rating.user ? {
      id: rating.user.id,
      username: rating.user.username,
      avatarUrl: rating.user.avatar_url  // Normalize to camelCase
    } : undefined
  };
  
  if (targetType === 'paper') {
    return {
      ...baseRating,
      targetType: 'paper',
      targetId: rating.paper_id,
      dimension1: rating.innovation_score,
      dimension2: rating.methodology_score,
      dimension3: rating.practicality_score,
      overallScore: rating.overall_score,
      // Keep original field names for backwards compatibility
      innovation_score: rating.innovation_score,
      methodology_score: rating.methodology_score,
      practicality_score: rating.practicality_score,
      overall_score: rating.overall_score,
    };
  } else {
    return {
      ...baseRating,
      targetType: 'webpage',
      targetId: rating.webpage_id,
      dimension1: rating.quality_score,
      dimension2: rating.usefulness_score,
      dimension3: rating.accuracy_score,
      overallScore: rating.overall_score,
      // Keep original field names for backwards compatibility
      quality_score: rating.quality_score,
      usefulness_score: rating.usefulness_score,
      accuracy_score: rating.accuracy_score,
      overall_score: rating.overall_score,
    };
  }
}

// Calculate rating statistics
function calculateStats(ratings: any[], targetType: TargetType) {
  if (ratings.length === 0) {
    return { count: 0, average: { overall: 0 } };
  }

  const dim1Key = targetType === 'paper' ? 'innovation_score' : 'quality_score';
  const dim2Key = targetType === 'paper' ? 'methodology_score' : 'usefulness_score';
  const dim3Key = targetType === 'paper' ? 'practicality_score' : 'accuracy_score';

  const sum = {
    dimension1: 0,
    dimension2: 0,
    dimension3: 0,
    overall: 0,
  };
  const counts = {
    dimension1: 0,
    dimension2: 0,
    dimension3: 0,
    overall: 0,
  };

  for (const r of ratings) {
    if (r[dim1Key]) { sum.dimension1 += r[dim1Key]; counts.dimension1++; }
    if (r[dim2Key]) { sum.dimension2 += r[dim2Key]; counts.dimension2++; }
    if (r[dim3Key]) { sum.dimension3 += r[dim3Key]; counts.dimension3++; }
    if (r.overall_score) { sum.overall += r.overall_score; counts.overall++; }
  }

  return {
    count: ratings.length,
    average: {
      dimension1: counts.dimension1 > 0 ? Number((sum.dimension1 / counts.dimension1).toFixed(1)) : null,
      dimension2: counts.dimension2 > 0 ? Number((sum.dimension2 / counts.dimension2).toFixed(1)) : null,
      dimension3: counts.dimension3 > 0 ? Number((sum.dimension3 / counts.dimension3).toFixed(1)) : null,
      overall: counts.overall > 0 ? Number((sum.overall / counts.overall).toFixed(1)) : 0,
    },
  };
}

// Simple URL normalization
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'fbclid', 'gclid'];
    trackingParams.forEach(p => parsed.searchParams.delete(p));
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString();
  } catch {
    return url;
  }
}
