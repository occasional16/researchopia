-- Add PDF annotations tables to support intelligent PDF reader feature

-- Create pdf_documents table
CREATE TABLE public.pdf_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL, -- URL to the PDF file (stored in Supabase storage or external)
  file_hash TEXT UNIQUE, -- SHA-256 hash for deduplication
  total_pages INTEGER NOT NULL DEFAULT 0,
  file_size BIGINT NOT NULL DEFAULT 0, -- file size in bytes
  paper_id UUID REFERENCES public.papers(id) ON DELETE CASCADE, -- optional link to papers table
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pdf_annotations table
CREATE TABLE public.pdf_annotations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pdf_document_id UUID REFERENCES public.pdf_documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER NOT NULL CHECK (page_number >= 1),
  annotation_type TEXT NOT NULL CHECK (annotation_type IN ('highlight', 'note', 'bookmark', 'drawing')),
  
  -- Position and selection data (JSON format for flexibility)
  position_data JSONB NOT NULL, -- stores coordinates, bounds, text selection info
  
  -- Annotation content
  content TEXT, -- user's note/comment
  selected_text TEXT, -- the text that was selected (for highlights)
  
  -- Visual properties
  color TEXT DEFAULT '#ffff00', -- highlight color
  opacity REAL DEFAULT 0.3 CHECK (opacity >= 0 AND opacity <= 1),
  
  -- Metadata
  tags TEXT[] DEFAULT '{}', -- user-defined tags for organization
  is_private BOOLEAN DEFAULT false, -- whether annotation is private or shared
  reply_to UUID REFERENCES public.pdf_annotations(id) ON DELETE CASCADE, -- for threaded discussions
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pdf_annotation_interactions table (likes, replies, etc.)
CREATE TABLE public.pdf_annotation_interactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  annotation_id UUID REFERENCES public.pdf_annotations(id) ON DELETE CASCADE NOT NULL,
  interaction_type TEXT CHECK (interaction_type IN ('like', 'dislike', 'flag', 'helpful')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, annotation_id, interaction_type)
);

-- Create pdf_reading_sessions table (track reading progress and analytics)
CREATE TABLE public.pdf_reading_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pdf_document_id UUID REFERENCES public.pdf_documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  pages_read INTEGER[] DEFAULT '{}', -- array of page numbers read
  total_time_seconds INTEGER DEFAULT 0,
  reading_progress REAL DEFAULT 0 CHECK (reading_progress >= 0 AND reading_progress <= 1), -- 0-1 representing completion %
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_pdf_documents_paper_id ON public.pdf_documents(paper_id);
CREATE INDEX idx_pdf_documents_uploaded_by ON public.pdf_documents(uploaded_by);
CREATE INDEX idx_pdf_documents_file_hash ON public.pdf_documents(file_hash);
CREATE INDEX idx_pdf_documents_created_at ON public.pdf_documents(created_at DESC);

CREATE INDEX idx_pdf_annotations_document_id ON public.pdf_annotations(pdf_document_id);
CREATE INDEX idx_pdf_annotations_user_id ON public.pdf_annotations(user_id);
CREATE INDEX idx_pdf_annotations_page_number ON public.pdf_annotations(page_number);
CREATE INDEX idx_pdf_annotations_type ON public.pdf_annotations(annotation_type);
CREATE INDEX idx_pdf_annotations_tags ON public.pdf_annotations USING gin(tags);
CREATE INDEX idx_pdf_annotations_is_private ON public.pdf_annotations(is_private);
CREATE INDEX idx_pdf_annotations_created_at ON public.pdf_annotations(created_at DESC);

CREATE INDEX idx_pdf_annotation_interactions_annotation_id ON public.pdf_annotation_interactions(annotation_id);
CREATE INDEX idx_pdf_annotation_interactions_user_id ON public.pdf_annotation_interactions(user_id);

CREATE INDEX idx_pdf_reading_sessions_document_id ON public.pdf_reading_sessions(pdf_document_id);
CREATE INDEX idx_pdf_reading_sessions_user_id ON public.pdf_reading_sessions(user_id);
CREATE INDEX idx_pdf_reading_sessions_progress ON public.pdf_reading_sessions(reading_progress);

-- Create triggers for updated_at
CREATE TRIGGER update_pdf_documents_updated_at 
  BEFORE UPDATE ON public.pdf_documents 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pdf_annotations_updated_at 
  BEFORE UPDATE ON public.pdf_annotations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pdf_reading_sessions_updated_at 
  BEFORE UPDATE ON public.pdf_reading_sessions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security policies
ALTER TABLE public.pdf_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_annotation_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_reading_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for pdf_documents
CREATE POLICY "Public pdf_documents are viewable by everyone" ON public.pdf_documents
  FOR SELECT USING (true);

CREATE POLICY "Users can upload pdf_documents" ON public.pdf_documents
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update their own pdf_documents" ON public.pdf_documents
  FOR UPDATE USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own pdf_documents" ON public.pdf_documents
  FOR DELETE USING (auth.uid() = uploaded_by);

-- Policies for pdf_annotations
CREATE POLICY "Public annotations are viewable by everyone" ON public.pdf_annotations
  FOR SELECT USING (is_private = false OR auth.uid() = user_id);

CREATE POLICY "Users can create annotations" ON public.pdf_annotations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own annotations" ON public.pdf_annotations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own annotations" ON public.pdf_annotations
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for pdf_annotation_interactions
CREATE POLICY "Users can view all interactions" ON public.pdf_annotation_interactions
  FOR SELECT USING (true);

CREATE POLICY "Users can create interactions" ON public.pdf_annotation_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interactions" ON public.pdf_annotation_interactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interactions" ON public.pdf_annotation_interactions
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for pdf_reading_sessions
CREATE POLICY "Users can view their own reading sessions" ON public.pdf_reading_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create reading sessions" ON public.pdf_reading_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reading sessions" ON public.pdf_reading_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Create functions for analytics
CREATE OR REPLACE FUNCTION get_pdf_annotation_stats(document_id UUID)
RETURNS TABLE (
  total_annotations BIGINT,
  total_highlights BIGINT,
  total_notes BIGINT,
  total_bookmarks BIGINT,
  unique_users BIGINT,
  avg_annotations_per_page NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_annotations,
    COUNT(*) FILTER (WHERE annotation_type = 'highlight') as total_highlights,
    COUNT(*) FILTER (WHERE annotation_type = 'note') as total_notes,
    COUNT(*) FILTER (WHERE annotation_type = 'bookmark') as total_bookmarks,
    COUNT(DISTINCT user_id) as unique_users,
    CASE 
      WHEN (SELECT total_pages FROM pdf_documents WHERE id = document_id) > 0 
      THEN ROUND(COUNT(*)::numeric / (SELECT total_pages FROM pdf_documents WHERE id = document_id), 2)
      ELSE 0
    END as avg_annotations_per_page
  FROM pdf_annotations
  WHERE pdf_document_id = document_id AND is_private = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's reading progress
CREATE OR REPLACE FUNCTION get_user_reading_progress(document_id UUID, user_uuid UUID)
RETURNS TABLE (
  progress_percentage REAL,
  pages_read INTEGER[],
  total_reading_time_seconds INTEGER,
  last_page_read INTEGER,
  last_read_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(s.reading_progress, 0) as progress_percentage,
    COALESCE(s.pages_read, '{}') as pages_read,
    COALESCE(s.total_time_seconds, 0) as total_reading_time_seconds,
    CASE 
      WHEN array_length(s.pages_read, 1) > 0 
      THEN s.pages_read[array_upper(s.pages_read, 1)]
      ELSE 1
    END as last_page_read,
    s.updated_at as last_read_at
  FROM pdf_reading_sessions s
  WHERE s.pdf_document_id = document_id AND s.user_id = user_uuid
  ORDER BY s.updated_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;