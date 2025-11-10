/**
 * Supabase clients - centralized exports
 */

// Re-export server client
export { createClient } from './server';

// Client-side supabase instance
export { supabase, getSupabase, createSupabaseClient } from '../supabase';

// Types
export type { User, Paper, Rating, Comment, PaperReport } from '../supabase';
