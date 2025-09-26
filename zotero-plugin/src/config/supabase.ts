// Supabase configuration
export const SUPABASE_CONFIG = {
  url: "https://obcblvdtqhwrihoddlez.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4",
};

// Database table schemas
export const DATABASE_SCHEMAS = {
  shared_annotations: {
    id: "uuid",
    doi: "text",
    user_id: "uuid",
    user_name: "text",
    annotation_text: "text",
    annotation_comment: "text",
    page_number: "integer",
    position: "jsonb",
    annotation_type: "text",
    annotation_color: "text",
    created_at: "timestamp",
    updated_at: "timestamp",
  },
  annotation_likes: {
    id: "uuid",
    annotation_id: "uuid",
    user_id: "uuid",
    created_at: "timestamp",
  },
  annotation_comments: {
    id: "uuid",
    annotation_id: "uuid",
    user_id: "uuid",
    user_name: "text",
    comment_text: "text",
    created_at: "timestamp",
  },
  user_follows: {
    id: "uuid",
    follower_id: "uuid",
    following_id: "uuid",
    created_at: "timestamp",
  },
};
