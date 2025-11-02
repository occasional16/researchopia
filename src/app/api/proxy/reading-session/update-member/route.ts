import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClientWithToken } from '@/lib/supabase-server';

// 创建admin客户端
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: Request) {
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
    const { session_id, is_online, page_number } = await req.json();

    if (!session_id) {
      return NextResponse.json({ message: 'Session ID is required' }, { status: 400 });
    }

    // Find the member entry for the current user in the specified session
    const { data: member, error: memberError } = await supabaseAdmin
      .from('session_members')
      .select('id')
      .eq('session_id', session_id)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ message: 'Member not found in this session' }, { status: 404 });
    }

    // Prepare the data to update
    const updateData: { is_online?: boolean; last_seen: string; current_page?: number } = {
      last_seen: new Date().toISOString(),
    };

    if (typeof is_online === 'boolean') {
      updateData.is_online = is_online;
    }

    if (typeof page_number === 'number') {
      updateData.current_page = page_number;
    }

    // Update the member's status
    const { error: updateError } = await supabaseAdmin
      .from('session_members')
      .update(updateData)
      .eq('id', member.id);

    if (updateError) {
      console.error('Error updating member status:', updateError);
      return NextResponse.json({ message: 'Failed to update member status', error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Member status updated' });
  } catch (error) {
    console.error('Error processing PATCH request:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
