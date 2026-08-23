import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Testing Supabase connection...')
    
    // Test connection by counting inventory items
    const { data, error, count } = await supabaseAdmin
      .from('inventory')
      .select('*', { count: 'exact', head: false })
      .limit(5)

    if (error) {
      console.error('❌ Supabase error:', error)
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error
      }, { status: 500 })
    }

    console.log('✅ Supabase connection successful!')
    console.log(`📊 Found ${count} items in inventory`)
    console.log(`📦 Sample data:`, data)

    // Test all tables
    const tables = ['inventory', 'transactions', 'logs', 'restocks', 'categories', 'users']
    const tableStatus: Record<string, any> = {}

    for (const table of tables) {
      const { count: tableCount, error: tableError } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true })

      tableStatus[table] = {
        accessible: !tableError,
        count: tableCount || 0,
        error: tableError?.message || null
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase connection successful!',
      inventory: {
        count,
        sampleData: data
      },
      tables: tableStatus,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      stack: error.stack
    }, { status: 500 })
  }
}
