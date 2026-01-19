import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/users/me - Get current authenticated user's profile
 * Used by browser extension to get username
 */
export async function GET(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Create Supabase client with user's token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    )

    // Get current user from auth
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Get user profile from users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, username, email, avatar_url, real_name, institution')
      .eq('id', authUser.id)
      .single()

    if (profileError || !profile) {
      // User exists in auth but not in users table - return basic info
      return NextResponse.json({
        id: authUser.id,
        email: authUser.email,
        username: null,
        avatar_url: null,
      })
    }

    return NextResponse.json({
      id: profile.id,
      email: profile.email || authUser.email,
      username: profile.username,
      avatar_url: profile.avatar_url,
      real_name: profile.real_name,
      institution: profile.institution,
    })

  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
