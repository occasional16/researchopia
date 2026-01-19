import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// CORS headers for extension access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
}

/**
 * OPTIONS /api/auth/extension-token
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

/**
 * GET /api/auth/extension-token
 * 
 * Provides authentication token for browser extension.
 * The extension can call this endpoint to sync auth state from the website.
 * Requires the user to be logged in on the website (session cookie).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession()
    
    console.log('Extension token request - Session:', session ? 'exists' : 'none', 'Error:', error?.message || 'none')
    
    if (error || !session) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401, headers: corsHeaders }
      )
    }

    // Return token info for extension
    return NextResponse.json({
      success: true,
      token: session.access_token,
      userId: session.user.id,
      email: session.user.email,
      expiresIn: session.expires_in || 3600
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('Extension token error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
