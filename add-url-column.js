const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addUrlColumn() {
  try {
    console.log('🔄 Adding url column to papers table...')
    
    // Execute raw SQL to add the url column
    const { error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS url TEXT;'
    })

    if (error) {
      console.error('❌ Error adding url column:', error)
      // Try alternative approach using direct query
      const { error: altError } = await supabase
        .from('papers')
        .select('url')
        .limit(1)
        
      if (altError && altError.message.includes('column "url" does not exist')) {
        console.log('🔄 Column does not exist, this is expected...')
        console.log('📋 Please manually add the url column in Supabase dashboard:')
        console.log('   1. Go to https://app.supabase.com/project/obcblvdtqhwrihoddlez/editor')
        console.log('   2. Open the "papers" table')
        console.log('   3. Click "Add column"')
        console.log('   4. Name: url, Type: text, Default: null')
        console.log('   5. Save the changes')
      } else {
        console.log('✅ url column may already exist or was added successfully')
      }
    } else {
      console.log('✅ url column added successfully')
    }

    // Test if url column exists by trying to select it
    const { data, error: testError } = await supabase
      .from('papers')
      .select('id, title, url')
      .limit(1)

    if (testError) {
      if (testError.message.includes('column "url" does not exist')) {
        console.log('⚠️  url column still does not exist')
        console.log('📋 Manual steps required (see above)')
      } else {
        console.error('❌ Other error testing url column:', testError)
      }
    } else {
      console.log('✅ url column is accessible, papers can include URL field')
      if (data && data.length > 0) {
        console.log('Sample paper:', data[0])
      }
    }

  } catch (error) {
    console.error('❌ Script error:', error)
  }
}

addUrlColumn()
