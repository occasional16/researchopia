-- Create a system guest user for anonymous paper submissions
-- This allows guest users to add papers without authentication

-- Insert a special guest user (this should be run once during setup)
INSERT INTO public.users (id, email, username, role) 
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'guest@system.local',
  'system_guest',
  'user'
) ON CONFLICT (id) DO NOTHING;

-- Update papers RLS policy to allow service role to insert papers for guests
DROP POLICY IF EXISTS "Authenticated users can create papers" ON public.papers;
CREATE POLICY "Allow service role and authenticated users to create papers" ON public.papers 
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' OR auth.role() = 'service_role'
);

-- Optional: Add a policy to allow anyone to view papers (already exists)
-- The existing "Anyone can view papers" policy already handles this