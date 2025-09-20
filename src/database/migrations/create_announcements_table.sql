-- 创建公告表
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_type ON announcements(type);

-- 添加注释
COMMENT ON TABLE announcements IS '系统公告表';
COMMENT ON COLUMN announcements.id IS '公告唯一标识';
COMMENT ON COLUMN announcements.title IS '公告标题';
COMMENT ON COLUMN announcements.content IS '公告内容';
COMMENT ON COLUMN announcements.type IS '公告类型：info-信息，warning-警告，success-成功，error-错误';
COMMENT ON COLUMN announcements.is_active IS '是否激活显示';
COMMENT ON COLUMN announcements.created_by IS '创建者用户名';
COMMENT ON COLUMN announcements.created_at IS '创建时间';
COMMENT ON COLUMN announcements.updated_at IS '更新时间';

-- 插入示例数据
INSERT INTO announcements (title, content, type, created_by) VALUES 
('欢迎使用研学港！', '研学港是一个开放的学术交流平台，致力于突破传统的信息获取方式，实现用户之间随时随地的分享和交流！', 'info', 'admin'),
('系统维护通知', '系统将于本周日凌晨2:00-4:00进行例行维护，期间可能会影响部分功能的使用，请提前做好准备。', 'warning', 'admin');
