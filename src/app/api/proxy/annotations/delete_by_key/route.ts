import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClientWithToken } from '@/lib/supabase-server';

// 创建admin客户端
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Find annotations with matching zotero_key in annotation_data
    const { data: annotations } = await supabaseAdmin
      .from('session_annotations')
      .select('id, annotation_data')
      .eq('session_id', sessionId);

    const annotationToDelete = annotations?.find((ann: any) => 
      ann.annotation_data?.zotero_key === zoteroKey
    );

    if (!annotationToDelete) {
      return NextResponse.json({ success: true, message: 'Annotation not found or already deleted' });
    }

    // Delete the annotation
    const { error } = await supabaseAdmin
      .from('session_annotations')
      .delete()
      .eq('id', annotationToDelete.id);

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
