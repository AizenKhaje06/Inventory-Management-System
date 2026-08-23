/**
 * Reset admin - bypasses RLS using service role
 * Run: node scripts/reset-admin-v2.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')

// MUST use service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        // Force bypass RLS
        'x-supabase-bypass-rls': 'true'
      }
    }
  }
)

async function resetAdmin() {
  console.log('=================================')
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('Service Key starts with:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...')
  console.log('=================================\n')

  const username = 'admin'
  const password = 'admin123'
  const hash = await bcrypt.hash(password, 10)
  const id = 'USR-' + Date.now()

  // First try: check existing users (ignore RLS)
  const { data: allUsers, error: listError } = await supabase
    .from('users')
    .select('id, username, role, display_name')

  if (listError) {
    console.error('❌ Cannot read users table:', listError.message)
    console.log('\n⚠️  Your SUPABASE_SERVICE_ROLE_KEY may still be wrong.')
    console.log('   It must start with: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')
    console.log('   Get it from: Supabase Dashboard → Project Settings → API → service_role secret')
    return
  }

  console.log('📋 Current users in DB:', allUsers?.length || 0)
  if (allUsers && allUsers.length > 0) {
    console.table(allUsers)
  }

  const existing = allUsers?.find(u => u.username === username)

  if (existing) {
    console.log('\n✅ Admin account found — resetting password to "admin123"...')
    const { error } = await supabase
      .from('users')
      .update({ password: hash })
      .eq('username', username)

    if (error) {
      console.error('❌ Update failed:', error.message)
    } else {
      console.log('✅ Password reset done!')
      console.log('   Username: admin')
      console.log('   Password: admin123')
    }
  } else {
    console.log('\n⚠️  No admin user found — creating one...')
    const { error } = await supabase
      .from('users')
      .insert({
        id,
        username,
        password: hash,
        role: 'admin',
        display_name: 'System Administrator',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('❌ Create failed:', error.message)
      console.log('\n📌 MANUAL FIX: Run this SQL in Supabase SQL Editor:')
      console.log(`
INSERT INTO users (id, username, password, role, display_name, created_at)
VALUES (
  '${id}',
  'admin',
  '${hash}',
  'admin',
  'System Administrator',
  NOW()
);
      `)
    } else {
      console.log('✅ Admin account created!')
      console.log('   Username: admin')
      console.log('   Password: admin123')
    }
  }
}

resetAdmin().catch(console.error)
