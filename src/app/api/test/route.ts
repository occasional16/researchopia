import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ 
    message: 'API routes are working!',
    timestamp: new Date().toISOString(),
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set',
    supabase_key_exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })
}
