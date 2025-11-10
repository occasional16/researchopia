import { NextResponse } from 'next/server';
import { createClientWithToken, createAdminClient } from '@/lib/supabase-server';

export async function DELETE(req: Request) {
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
    const zoteroKey = searchParams.get('zotero_key');

    if (!sessionId || !zoteroKey) {
      return NextResponse.json({ message: 'Session ID and Zotero Key are required' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 查找匹配original_id (zotero_key)的annotation
    const { data: annotations } = await adminClient
      .from('annotations')
      .select('id')
      .eq('original_id', zoteroKey)
      .eq('user_id', user.id);

    if (!annotations || annotations.length === 0) {
      return NextResponse.json({ success: true, message: 'Annotation not found or already deleted' });
    }

    const annotationId = annotations[0].id;

    // 删除annotation_shares记录(如果有)
    await adminClient
      .from('annotation_shares')
      .delete()
      .eq('annotation_id', annotationId)
      .eq('session_id', sessionId);

    // 可选:也删除annotation本身(如果不想保留)
    const { error } = await adminClient
      .from('annotations')
      .delete()
      .eq('id', annotationId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting annotation:', error);
      return NextResponse.json({ message: 'Failed to delete annotation', error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Annotation deleted' });
  } catch (error) {
    console.error('Error processing DELETE request for annotation:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
