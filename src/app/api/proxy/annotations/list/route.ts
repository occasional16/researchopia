import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClientWithToken } from '@/lib/supabase-server';

// 创建admin客户端
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClientWithToken(token);
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    const since = searchParams.get('since');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!sessionId) {
      return NextResponse.json({ message: 'Session ID is required' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('session_annotations')
      .select('*, users(username, email, avatar_url)')
      .eq('session_id', sessionId);

    if (since) {
      query = query.gt('created_at', since);
    }

    // Order by creation time BEFORE pagination
    query = query.order('created_at', { ascending: false});

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: annotations, error } = await query;

    if (error) {
      console.error('Error fetching annotations:', error);
      return NextResponse.json({ message: 'Failed to fetch annotations', error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, annotations });
  } catch (error) {
    console.error('Error processing GET request for annotations:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
