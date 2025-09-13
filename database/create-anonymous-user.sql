-- 创建一个系统用户来支持匿名论文提交
-- 直接插入到users表，绕过auth限制

-- 创建一个UUID
-- 使用这个固定的UUID: 11111111-1111-1111-1111-111111111111

INSERT INTO public.users (id, email, username, role) 
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'anonymous@researchopia.com',
  'anonymous_user',
  'user'
) ON CONFLICT (id) DO NOTHING;

-- 验证创建结果
SELECT id, email, username, role, created_at FROM public.users WHERE id = '11111111-1111-1111-1111-111111111111';