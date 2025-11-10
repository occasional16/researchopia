/**
 * ⚠️ DEPRECATED: This API is deprecated and should not be used.
 * Use POST /api/proxy/annotations instead (writes to annotations table)
 * Then use POST /api/proxy/annotations/share-to-session (writes to annotation_shares table)
 * 
 * This API writes to the old session_annotations table which is being phased out.
 * It is kept for backward compatibility but may be removed in the future.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClientWithToken } from '@/lib/supabase-server';

// 创建admin客户端
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  // Return deprecation warning
  console.warn('[API] DEPRECATED: /api/proxy/annotations/create is deprecated. Use /api/proxy/annotations + /api/proxy/annotations/share-to-session instead.');
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
    const annotationData = await req.json();

    // Validate required fields
    const { session_id, paper_doi, zotero_key, annotation_data, page_number } = annotationData;
    if (!session_id || !paper_doi || !annotation_data) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // Store zotero_key in annotation_data if provided
    const enrichedAnnotationData = {
      ...annotation_data,
      zotero_key: zotero_key || undefined,
    };

    // Check if annotation with the same zotero_key already exists for this session
    if (zotero_key) {
      const { data: existingAnnotations } = await supabaseAdmin
        .from('session_annotations')
        .select('id, annotation_data')
        .eq('session_id', session_id)
        .eq('user_id', user.id);

      const existing = existingAnnotations?.find((ann: any) => 
        ann.annotation_data?.zotero_key === zotero_key
      );

      if (existing) {
        // Annotation already exists, return it
        return NextResponse.json({ success: true, annotation: existing, message: 'Annotation already exists' }, { status: 200 });
      }
    }

    // Insert new annotation
    const { data: newAnnotation, error: insertError } = await supabaseAdmin
      .from('session_annotations')
      .insert({
        session_id,
        user_id: user.id,
        paper_doi,
        annotation_data: enrichedAnnotationData,
        page_number: page_number || 1,
      })
      .select('*, users(username, email, avatar_url)')
      .single();

    if (insertError) {
      console.error('Error creating annotation:', insertError);
      return NextResponse.json({ message: 'Failed to create annotation', error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, annotation: newAnnotation });
  } catch (error) {
    console.error('Error processing POST request for annotation:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
