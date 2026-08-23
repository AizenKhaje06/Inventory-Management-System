/**
 * Test Supabase Connection
 * 
 * Run this to verify Supabase is connected and working
 */

import { supabaseAdmin } from './supabase'

export async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...')
  
  try {
    // Test 1: Check if we can connect
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .select('count')
      .limit(1)

    if (error) {
      console.error('❌ Connection failed:', error.message)
      return false
    }

    console.log('✅ Supabase connection successful!')
    
    // Test 2: Check all tables exist
    const tables = ['inventory', 'transactions', 'logs', 'restocks', 'categories', 'users']
    
    for (const table of tables) {
      const { error: tableError } = await supabaseAdmin
        .from(table)
        .select('count')
        .limit(1)
      
      if (tableError) {
        console.error(`❌ Table "${table}" not accessible:`, tableError.message)
      } else {
        console.log(`✅ Table "${table}" accessible`)
      }
    }

    return true
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return false
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testSupabaseConnection()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}
