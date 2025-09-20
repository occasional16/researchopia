/**
 * 初始化公告表的脚本
 */

const { createClient } = require('@supabase/supabase-js')

// 从环境变量获取配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration. Please check your .env.local file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function initAnnouncementsTable() {
  try {
    console.log('🚀 Initializing announcements table...')

    // 创建公告表的SQL
    const createTableSQL = `
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
    `

    // 创建索引的SQL
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);
      CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_announcements_type ON announcements(type);
    `

    // 执行创建表的SQL
    const { error: tableError } = await supabase.rpc('exec_sql', { 
      sql: createTableSQL 
    })

    if (tableError) {
      console.error('❌ Error creating table:', tableError)
      return
    }

    console.log('✅ Announcements table created successfully')

    // 执行创建索引的SQL
    const { error: indexError } = await supabase.rpc('exec_sql', { 
      sql: createIndexesSQL 
    })

    if (indexError) {
      console.error('❌ Error creating indexes:', indexError)
      return
    }

    console.log('✅ Indexes created successfully')

    // 插入示例数据
    const { error: insertError } = await supabase
      .from('announcements')
      .insert([
        {
          title: '欢迎使用研学港！',
          content: '研学港是一个开放的学术交流平台，致力于突破传统的信息获取方式，实现用户之间随时随地的分享和交流！',
          type: 'info',
          created_by: 'admin'
        },
        {
          title: '系统维护通知',
          content: '系统将于本周日凌晨2:00-4:00进行例行维护，期间可能会影响部分功能的使用，请提前做好准备。',
          type: 'warning',
          created_by: 'admin'
        }
      ])

    if (insertError) {
      console.error('❌ Error inserting sample data:', insertError)
      return
    }

    console.log('✅ Sample announcements inserted successfully')
    console.log('🎉 Announcements system initialized!')

  } catch (error) {
    console.error('❌ Error initializing announcements table:', error)
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initAnnouncementsTable()
    .then(() => {
      console.log('✅ Initialization complete')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Initialization failed:', error)
      process.exit(1)
    })
}

module.exports = { initAnnouncementsTable }
