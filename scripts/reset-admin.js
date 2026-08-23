/**
 * Reset or create admin account
 * Run: node scripts/reset-admin.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function resetAdmin() {
  const username = 'admin'
  const password = 'admin123'
  const hash = await bcrypt.hash(password, 10)

  console.log('Connecting to Supabase...')
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

  // Check if admin exists
  const { data: existing } = await supabase
    .from('users')
    .select('id, username, role')
    .eq('username', username)
    .single()

  if (existing) {
    console.log('Admin found — updating password...')
    const { error } = await supabase
      .from('users')
      .update({ password: hash })
      .eq('username', username)

    if (error) {
      console.error('❌ Update failed:', error.message)
    } else {
      console.log('✅ Password reset successfully!')
      console.log('   Username:', username)
      console.log('   Password:', password)
    }
  } else {
    console.log('No admin found — creating new admin account...')
    const id = 'USR-' + Date.now()
    const { error } = await supabase
      .from('users')
      .insert({
        id,
        username,
        password: hash,
        role: 'admin',
        display_name: 'System Administrator',
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('❌ Create failed:', error.message)
    } else {
      console.log('✅ Admin account created!')
      console.log('   Username:', username)
      console.log('   Password:', password)
    }
  }

  // Show all users in the table
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, username, role, display_name')

  console.log('\n📋 All users in database:')
  console.table(allUsers)
}

resetAdmin().catch(console.error)
