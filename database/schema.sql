-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create papers table
CREATE TABLE public.papers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT[] NOT NULL,
  doi TEXT UNIQUE,
  abstract TEXT,
  keywords TEXT[] DEFAULT '{}',
  publication_date DATE,
  journal TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Create ratings table
CREATE TABLE public.ratings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  paper_id UUID REFERENCES public.papers(id) ON DELETE CASCADE NOT NULL,
  innovation_score INTEGER CHECK (innovation_score >= 1 AND innovation_score <= 5) NOT NULL,
  methodology_score INTEGER CHECK (methodology_score >= 1 AND methodology_score <= 5) NOT NULL,
  practicality_score INTEGER CHECK (practicality_score >= 1 AND practicality_score <= 5) NOT NULL,
  overall_score INTEGER CHECK (overall_score >= 1 AND overall_score <= 5) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, paper_id)
);

-- Create comments table
CREATE TABLE public.comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  paper_id UUID REFERENCES public.papers(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  dislikes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create comment votes table
CREATE TABLE public.comment_votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE NOT NULL,
  vote_type TEXT CHECK (vote_type IN ('like', 'dislike')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, comment_id)
);

-- Create paper favorites table
CREATE TABLE public.paper_favorites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  paper_id UUID REFERENCES public.papers(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, paper_id)
);

-- Create indexes for better performance
CREATE INDEX idx_papers_title ON public.papers USING gin(to_tsvector('english', title));
CREATE INDEX idx_papers_authors ON public.papers USING gin(authors);
CREATE INDEX idx_papers_keywords ON public.papers USING gin(keywords);
CREATE INDEX idx_papers_created_at ON public.papers(created_at DESC);
CREATE INDEX idx_ratings_paper_id ON public.ratings(paper_id);
CREATE INDEX idx_ratings_user_id ON public.ratings(user_id);
CREATE INDEX idx_comments_paper_id ON public.comments(paper_id);
CREATE INDEX idx_comments_created_at ON public.comments(created_at DESC);
CREATE INDEX idx_comment_votes_comment_id ON public.comment_votes(comment_id);
CREATE INDEX idx_comment_votes_user_id ON public.comment_votes(user_id);
CREATE INDEX idx_paper_favorites_user_id ON public.paper_favorites(user_id);
CREATE INDEX idx_paper_favorites_paper_id ON public.paper_favorites(paper_id);

-- Create updated_at trigger function
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

-- Create trigger to update comment vote counts
CREATE OR REPLACE FUNCTION update_comment_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'like' THEN
      UPDATE public.comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
    ELSIF NEW.vote_type = 'dislike' THEN
      UPDATE public.comments SET dislikes_count = dislikes_count + 1 WHERE id = NEW.comment_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Remove old vote
    IF OLD.vote_type = 'like' THEN
      UPDATE public.comments SET likes_count = likes_count - 1 WHERE id = OLD.comment_id;
    ELSIF OLD.vote_type = 'dislike' THEN
      UPDATE public.comments SET dislikes_count = dislikes_count - 1 WHERE id = OLD.comment_id;
    END IF;
    -- Add new vote
    IF NEW.vote_type = 'like' THEN
      UPDATE public.comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
    ELSIF NEW.vote_type = 'dislike' THEN
      UPDATE public.comments SET dislikes_count = dislikes_count + 1 WHERE id = NEW.comment_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'like' THEN
      UPDATE public.comments SET likes_count = likes_count - 1 WHERE id = OLD.comment_id;
    ELSIF OLD.vote_type = 'dislike' THEN
      UPDATE public.comments SET dislikes_count = dislikes_count - 1 WHERE id = OLD.comment_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_vote_counts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.comment_votes
  FOR EACH ROW EXECUTE FUNCTION update_comment_vote_counts();

-- Row Level Security (RLS) policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_favorites ENABLE ROW LEVEL SECURITY;

-- Users can read all users but only update their own profile
CREATE POLICY "Users can view all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Papers are readable by all, but only authenticated users can create
CREATE POLICY "Anyone can view papers" ON public.papers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create papers" ON public.papers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own papers" ON public.papers FOR UPDATE USING (auth.uid() = created_by);

-- Ratings are readable by all, but users can only manage their own ratings
CREATE POLICY "Anyone can view ratings" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "Users can manage own ratings" ON public.ratings FOR ALL USING (auth.uid() = user_id);

-- Comments are readable by all, but users can only manage their own comments
CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can manage own comments" ON public.comments FOR ALL USING (auth.uid() = user_id);

-- Comment votes policies
CREATE POLICY "Anyone can view comment votes" ON public.comment_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote on comments" ON public.comment_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own votes" ON public.comment_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes" ON public.comment_votes FOR DELETE USING (auth.uid() = user_id);

-- Paper favorites policies
CREATE POLICY "Anyone can view favorites" ON public.paper_favorites FOR SELECT USING (true);
CREATE POLICY "Users can manage own favorites" ON public.paper_favorites FOR ALL USING (auth.uid() = user_id);

-- Create a function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
