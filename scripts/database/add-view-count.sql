-- 为papers表添加view_count字段
-- 在Supabase Dashboard的SQL Editor中运行这个脚本

-- 1. 添加view_count列
ALTER TABLE public.papers 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- 2. 为现有的papers设置默认值
UPDATE public.papers 
SET view_count = 0 
WHERE view_count IS NULL;

-- 3. 确保索引优化
CREATE INDEX IF NOT EXISTS idx_papers_view_count ON public.papers(view_count);

-- 4. 创建paper_views表用于跟踪访问历史（可选）
CREATE TABLE IF NOT EXISTS public.paper_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id UUID REFERENCES public.papers(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- 5. 为paper_views表创建索引
CREATE INDEX IF NOT EXISTS idx_paper_views_paper_id ON public.paper_views(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_views_viewed_at ON public.paper_views(viewed_at);

-- 6. 创建site_statistics表
CREATE TABLE IF NOT EXISTS public.site_statistics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_date DATE DEFAULT CURRENT_DATE,
  total_visits INTEGER DEFAULT 0,
  daily_visits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stat_date)
);

-- 7. 插入今天的统计记录
INSERT INTO public.site_statistics (stat_date, total_visits, daily_visits)
VALUES (CURRENT_DATE, 0, 0)
ON CONFLICT (stat_date) DO NOTHING;
