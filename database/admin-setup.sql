-- Admin setup script
-- Run this after creating your admin account through the normal registration process

-- Replace 'admin@university.edu.cn' with your actual admin email
-- This will promote the user to admin role

UPDATE public.users 
SET role = 'admin' 
WHERE email = 'admin@university.edu.cn';

-- Create admin-specific policies
-- Admins can manage all content

-- Admin can update any user's role (except their own to prevent lockout)
CREATE POLICY "Admins can update user roles" ON public.users 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
  AND id != auth.uid() -- Prevent admins from changing their own role
);

-- Admin can delete any paper
CREATE POLICY "Admins can delete papers" ON public.papers 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Admin can delete any comment
CREATE POLICY "Admins can delete comments" ON public.comments 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Admin can delete any rating
CREATE POLICY "Admins can delete ratings" ON public.ratings 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Create admin dashboard views
CREATE OR REPLACE VIEW admin_stats AS
SELECT 
  (SELECT COUNT(*) FROM public.users) as total_users,
  (SELECT COUNT(*) FROM public.papers) as total_papers,
  (SELECT COUNT(*) FROM public.ratings) as total_ratings,
  (SELECT COUNT(*) FROM public.comments) as total_comments,
  (SELECT COUNT(*) FROM public.users WHERE created_at > NOW() - INTERVAL '7 days') as new_users_week,
  (SELECT COUNT(*) FROM public.papers WHERE created_at > NOW() - INTERVAL '7 days') as new_papers_week,
  (SELECT AVG(overall_score) FROM public.ratings) as avg_rating;

-- Grant access to admin stats view
GRANT SELECT ON admin_stats TO authenticated;

-- Create policy for admin stats view
CREATE POLICY "Admins can view stats" ON admin_stats 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM public.users 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
