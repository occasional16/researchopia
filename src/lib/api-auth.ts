/**
 * Unified API Authentication Helper
 * Supports both Cookie auth (website) and Bearer Token auth (extension/plugin)
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClientWithToken } from '@/lib/supabase-server';
import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuthResult {
  supabase: SupabaseClient;
  user: User | null;
}

/**
 * Get authenticated Supabase client from request
 * Priority: Bearer token > Cookies
 * 
 * @param request - Next.js request object
 * @returns Authenticated Supabase client and user (if any)
 */
export async function getAuthFromRequest(request: NextRequest): Promise<AuthResult> {
  // Check for Bearer token first (browser extension / Zotero plugin)
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token) {
    const supabase = createClientWithToken(token);
    const { data: { user } } = await supabase.auth.getUser();
    return { supabase, user };
  }

  // Fall back to cookie-based auth (website)
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Require authentication - throws 401 if not authenticated
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult & { user: User }> {
  const result = await getAuthFromRequest(request);
  
  if (!result.user) {
    throw new AuthError('Authentication required', 401);
  }
  
  return result as AuthResult & { user: User };
}

/**
 * Custom error class for authentication errors
 */
export class AuthError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}
