-- 增强 paper_reports 表以支持贡献者展示
-- 这个migration可以在未来执行

-- 添加用户表引用以支持贡献者信息显示
ALTER TABLE paper_reports 
ADD CONSTRAINT fk_paper_reports_user 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 创建视图以便获取贡献者信息
CREATE OR REPLACE VIEW paper_reports_with_contributors AS
SELECT 
    pr.*,
    COALESCE(u.raw_user_meta_data->>'username', '匿名用户') as contributor_name,
    CASE 
        WHEN pr.source = 'crawler' THEN '智能爬取'
        ELSE '手动添加'
    END as contribution_type
FROM paper_reports pr
LEFT JOIN auth.users u ON pr.created_by = u.id;

-- 添加索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_paper_reports_created_by 
ON paper_reports(created_by);

COMMENT ON VIEW paper_reports_with_contributors 
IS '论文报道视图，包含贡献者信息，用于显示每条报道的添加方式和贡献者';