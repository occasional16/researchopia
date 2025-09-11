-- Add URL field to papers table
-- Execute this in Supabase SQL Editor to add the missing url column

ALTER TABLE public.papers 
ADD COLUMN IF NOT EXISTS url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.papers.url IS 'External URL for the paper (from publisher, repository, etc.)';

-- Create index for URL searches (optional but recommended for performance)
CREATE INDEX IF NOT EXISTS idx_papers_url ON public.papers(url) WHERE url IS NOT NULL;

-- Update existing records to set url from DOI (optional)
-- This will update existing papers to have URL based on DOI
UPDATE public.papers 
SET url = 'https://doi.org/' || doi 
WHERE doi IS NOT NULL AND url IS NULL;
