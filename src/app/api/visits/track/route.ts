import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Record a page view (PV). Requires table public.page_visits (see create-visits-table.sql)
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // If Supabase is not configured, no-op to avoid breaking the UI
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ success: false, message: 'Supabase not configured' }, { status: 200 })
  }

  // Prefer service role on server to avoid RLS issues; fallback to anon key if missing
  const supabase = createClient(supabaseUrl, serviceRoleKey || anonKey)

  try {
    // Insert a row with default values: date = CURRENT_DATE, visit_count = 1
    const { error } = await supabase
      .from('page_visits')
      .insert([{ /* defaults */ }])

    if (error) {
      // If table missing or permission denied, return success=false but not 500
      return NextResponse.json({ success: false, message: error.message }, { status: 200 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'unknown error' }, { status: 200 })
  }
}

// Optional GET for quick ping/debug
export async function GET() {
  return NextResponse.json({ ok: true })
}
