import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientWithToken } from '@/lib/supabase-server'
import type { UpdateFolderRequest } from '@/types/bookmarks'
import crypto from 'crypto'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Get Supabase client with auth from either Bearer token or cookies
 */
async function getSupabaseWithAuth(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  if (token) {
    const supabase = createClientWithToken(token)
    const { data: { user } } = await supabase.auth.getUser()
    return { supabase, user }
  }
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

/**
 * GET /api/bookmarks/folders/[id]
 * Get a single folder with its items
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get folder
    const { data: folder, error } = await supabase
      .from('bookmark_folders')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Check access
    if (folder.user_id !== user.id && folder.visibility === 'private') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get items in this folder
    const { data: items } = await supabase
      .from('bookmark_items')
      .select(`
        *,
        webpage:webpages(id, url, url_hash, title, favicon_url, description)
      `)
      .eq('folder_id', id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })

    // Get child folders
    const { data: children } = await supabase
      .from('bookmark_folders')
      .select('*')
      .eq('parent_id', id)
      .order('position', { ascending: true })

    return NextResponse.json({
      success: true,
      folder: {
        ...folder,
        items: items || [],
        children: children || []
      }
    })
  } catch (error) {
    console.error('GET /api/bookmarks/folders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/bookmarks/folders/[id]
 * Update a folder
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check ownership
    const { data: existingFolder } = await supabase
      .from('bookmark_folders')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (!existingFolder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    if (existingFolder.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body: UpdateFolderRequest = await request.json()
    
    // Build update object
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.parent_id !== undefined) updateData.parent_id = body.parent_id
    if (body.icon !== undefined) updateData.icon = body.icon
    if (body.position !== undefined) updateData.position = body.position
    if (body.visibility !== undefined) updateData.visibility = body.visibility
    if (body.description !== undefined) updateData.description = body.description

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Prevent circular parent reference
    if (body.parent_id === id) {
      return NextResponse.json({ error: 'Cannot set folder as its own parent' }, { status: 400 })
    }

    const { data: folder, error } = await supabase
      .from('bookmark_folders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Folder with this name already exists' }, { status: 409 })
      }
      console.error('Error updating folder:', error)
      return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      folder
    })
  } catch (error) {
    console.error('PUT /api/bookmarks/folders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/bookmarks/folders/[id]
 * Delete a folder (cascade deletes children and items)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check ownership
    const { data: existingFolder } = await supabase
      .from('bookmark_folders')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (!existingFolder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    if (existingFolder.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete folder (cascade will handle children and items)
    const { error } = await supabase
      .from('bookmark_folders')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting folder:', error)
      return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/bookmarks/folders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/bookmarks/folders/[id]
 * Special operations: generate share code, etc.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    // Check ownership
    const { data: existingFolder } = await supabase
      .from('bookmark_folders')
      .select('*')
      .eq('id', id)
      .single()

    if (!existingFolder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    if (existingFolder.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (action === 'generate_share_code') {
      // Generate a random share code
      const shareCode = crypto.randomBytes(8).toString('hex')
      
      const { data: folder, error } = await supabase
        .from('bookmark_folders')
        .update({
          share_code: shareCode,
          visibility: 'shared'
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error generating share code:', error)
        return NextResponse.json({ error: 'Failed to generate share code' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        folder,
        share_url: `/bookmarks/shared/${shareCode}`
      })
    }

    if (action === 'revoke_share') {
      const { data: folder, error } = await supabase
        .from('bookmark_folders')
        .update({
          share_code: null,
          visibility: 'private'
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error revoking share:', error)
        return NextResponse.json({ error: 'Failed to revoke share' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        folder
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('PATCH /api/bookmarks/folders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
