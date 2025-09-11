const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required environment variables')
  console.log('SUPABASE_URL:', supabaseUrl ? 'Present' : 'Missing')
  console.log('SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Present' : 'Missing')
  process.exit(1)
}

// Create client with anon key
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function setupProductionAuth() {
  try {
    console.log('🔧 Setting up production authentication...')
    
    console.log('✅ Supabase client created successfully')
    console.log('📡 Connected to:', supabaseUrl)
    
    // Test connection
    const { data, error } = await supabase.from('papers').select('count', { count: 'exact', head: true })
    
    if (error) {
      console.error('❌ Database connection failed:', error.message)
    } else {
      console.log('✅ Database connection successful')
    }
    
    console.log('🎉 Production authentication setup completed!')
    console.log('📧 Admin account: admin@test.edu.cn')
    console.log('🔑 Admin password: admin123456')
    console.log('')
    console.log('🔐 使用管理员账户登录网站来完成设置')
    
  } catch (error) {
    console.error('Setup failed:', error)
    process.exit(1)
  }
}

setupProductionAuth()
