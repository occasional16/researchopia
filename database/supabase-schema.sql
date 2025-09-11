-- Academic Rating Platform Database Schema
-- Execute this in Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Papers table
CREATE TABLE public.papers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT[] NOT NULL DEFAULT '{}',
  doi TEXT UNIQUE,
  abstract TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  publication_date DATE,
  journal TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) NOT NULL
);

-- Ratings table
CREATE TABLE public.ratings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  paper_id UUID REFERENCES public.papers(id) ON DELETE CASCADE NOT NULL,
  innovation_score INTEGER CHECK (innovation_score >= 1 AND innovation_score <= 5) NOT NULL,
  methodology_score INTEGER CHECK (methodology_score >= 1 AND methodology_score <= 5) NOT NULL,
  practicality_score INTEGER CHECK (practicality_score >= 1 AND practicality_score <= 5) NOT NULL,
  overall_score INTEGER CHECK (overall_score >= 1 AND overall_score <= 5) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, paper_id)
);

-- Comments table
CREATE TABLE public.comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  paper_id UUID REFERENCES public.papers(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comment votes table
CREATE TABLE public.comment_votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE NOT NULL,
  vote_type TEXT CHECK (vote_type IN ('like', 'dislike')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, comment_id)
);

-- Paper favorites table
CREATE TABLE public.paper_favorites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  paper_id UUID REFERENCES public.papers(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, paper_id)
);

-- Create indexes for better performance
CREATE INDEX idx_papers_created_by ON public.papers(created_by);
CREATE INDEX idx_papers_doi ON public.papers(doi);
CREATE INDEX idx_ratings_paper_id ON public.ratings(paper_id);
CREATE INDEX idx_ratings_user_id ON public.ratings(user_id);
CREATE INDEX idx_comments_paper_id ON public.comments(paper_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);
CREATE INDEX idx_comment_votes_comment_id ON public.comment_votes(comment_id);
CREATE INDEX idx_paper_favorites_user_id ON public.paper_favorites(user_id);
CREATE INDEX idx_paper_favorites_paper_id ON public.paper_favorites(paper_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users policies
CREATE POLICY "Users can view all profiles" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Papers policies (public read, authenticated write)
CREATE POLICY "Anyone can view papers" ON public.papers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create papers" ON public.papers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own papers" ON public.papers FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Admins can update any paper" ON public.papers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Ratings policies
CREATE POLICY "Anyone can view ratings" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create ratings" ON public.ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ratings" ON public.ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ratings" ON public.ratings FOR DELETE USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any comment" ON public.comments FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Comment votes policies
CREATE POLICY "Anyone can view comment votes" ON public.comment_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote" ON public.comment_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own votes" ON public.comment_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes" ON public.comment_votes FOR DELETE USING (auth.uid() = user_id);

-- Paper favorites policies
CREATE POLICY "Users can view own favorites" ON public.paper_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own favorites" ON public.paper_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON public.paper_favorites FOR DELETE USING (auth.uid() = user_id);

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_papers_updated_at BEFORE UPDATE ON public.papers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ratings_updated_at BEFORE UPDATE ON public.ratings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
