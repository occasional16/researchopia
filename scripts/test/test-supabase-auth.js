const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔍 Testing Supabase Authentication Setup...\n')

console.log('Environment Variables:')
console.log('- SUPABASE_URL:', supabaseUrl ? '✓ Set' : '❌ Missing')
console.log('- ANON_KEY:', supabaseAnonKey ? '✓ Set' : '❌ Missing')
console.log('- SERVICE_ROLE_KEY:', serviceRoleKey ? '✓ Set' : '❌ Missing')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing required Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)
const adminSupabase = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null

async function testSupabaseConnection() {
  console.log('\n📡 Testing Supabase Connection...')
  
  try {
    // Test basic connection
    const { data, error } = await supabase.from('users').select('count').limit(1)
    
    if (error) {
      console.error('❌ Connection test failed:', error.message)
      return false
    } else {
      console.log('✅ Supabase connection successful')
      return true
    }
  } catch (error) {
    console.error('❌ Connection error:', error.message)
    return false
  }
}

async function testUserTableStructure() {
  console.log('\n🗄️  Testing Users Table Structure...')
  
  if (!adminSupabase) {
    console.log('⚠️  No service role key - skipping detailed table tests')
    return
  }
  
  try {
    // Test if users table exists and has correct structure
    const { data, error } = await adminSupabase
      .from('users')
      .select('*')
      .limit(1)
    
    if (error) {
      if (error.code === '42P01') {
        console.error('❌ Users table does not exist!')
        console.log('💡 You need to create the users table in Supabase')
        return false
      } else {
        console.error('❌ Users table error:', error.message)
        return false
      }
    }
    
    console.log('✅ Users table exists and is accessible')
    
    // Test if the table has expected columns
    if (data && data.length > 0) {
      const user = data[0]
      const expectedFields = ['id', 'email', 'username', 'role', 'created_at', 'updated_at']
      const missingFields = expectedFields.filter(field => !(field in user))
      
      if (missingFields.length > 0) {
        console.log('⚠️  Missing fields in users table:', missingFields)
      } else {
        console.log('✅ Users table has all expected fields')
      }
    } else {
      console.log('ℹ️  Users table is empty (this is normal for new setups)')
    }
    
    return true
  } catch (error) {
    console.error('❌ Table structure test failed:', error.message)
    return false
  }
}

async function testAuthentication() {
  console.log('\n🔐 Testing Authentication...')
  
  try {
    // Test if auth is properly configured by checking current session
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('❌ Auth session check failed:', error.message)
      return false
    }
    
    console.log('✅ Auth system is accessible')
    console.log('Current session:', session ? 'Logged in' : 'No active session (normal)')
    
    return true
  } catch (error) {
    console.error('❌ Authentication test failed:', error.message)
    return false
  }
}

async function testAuthPolicies() {
  console.log('\n🛡️  Testing Row Level Security...')
  
  try {
    // Test if we can read from users table (should work with proper RLS)
    const { data, error } = await supabase
      .from('users')
      .select('id, email')
      .limit(1)
    
    if (error) {
      if (error.code === '42501') {
        console.log('⚠️  RLS is enabled but no policies allow anonymous access')
        console.log('💡 This might be intentional for security')
        return true
      } else {
        console.error('❌ RLS test failed:', error.message)
        return false
      }
    }
    
    console.log('✅ RLS policies allow appropriate access')
    return true
  } catch (error) {
    console.error('❌ RLS test failed:', error.message)
    return false
  }
}

async function runAllTests() {
  console.log('🚀 Starting Supabase Auth Diagnostics...\n')
  
  const connectionOk = await testSupabaseConnection()
  if (!connectionOk) {
    console.log('\n❌ Connection failed - stopping tests')
    return
  }
  
  await testUserTableStructure()
  await testAuthentication()
  await testAuthPolicies()
  
  console.log('\n📋 Summary:')
  console.log('- Make sure your Supabase project is active')
  console.log('- Ensure the users table exists with proper structure')
  console.log('- Check that RLS policies are configured correctly')
  console.log('- Verify email authentication is enabled in Supabase dashboard')
  
  console.log('\n💡 Common issues:')
  console.log('1. "Invalid login credentials" - User not registered or wrong password')
  console.log('2. "Database error saving new user" - Missing users table or RLS policy issue')
  console.log('3. Check Supabase Auth > Settings > Auth providers > Email is enabled')
  console.log('4. Check Supabase Auth > Settings > Auth policies for users table')
}

runAllTests().catch(console.error)