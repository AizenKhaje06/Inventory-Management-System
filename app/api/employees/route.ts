import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin as supabase } from "@/lib/supabase"
import { withAuth } from "@/lib/api-helpers"

// ─── GET: Fetch all employees ───────────────────────────────────────────────
export const GET = withAuth(async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'active', 'inactive', or 'all'
    const department = searchParams.get('department')

    let query = supabase
      .from('employees')
      .select('*')
      .order('name', { ascending: true })

    // Filter by status (default: only active)
    if (status === 'all') {
      // No filter
    } else if (status === 'inactive') {
      query = query.eq('status', 'inactive')
    } else {
      // Default: active only
      query = query.eq('status', 'active')
    }

    // Filter by department if provided
    if (department && department !== 'all') {
      query = query.eq('department', department)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Employees GET] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[Employees GET] Exception:', error)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
})

// ─── POST: Create new employee ──────────────────────────────────────────────
export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json()
    const { name, department, position } = body

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Employee name is required' }, { status: 400 })
    }

    // Check for duplicate name
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .ilike('name', name.trim())
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Employee with this name already exists' }, { status: 400 })
    }

    // Generate ID
    const id = `EMP-${Date.now()}`

    // Insert employee
    const { data, error } = await supabase
      .from('employees')
      .insert({
        id,
        name: name.trim(),
        department: department || null,
        position: position?.trim() || null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('[Employees POST] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[Employees POST] ✅ Created: ${id} - ${name}`)
    return NextResponse.json(data, { status: 201 })

  } catch (error: any) {
    console.error('[Employees POST] Exception:', error)
    return NextResponse.json({ error: error.message || 'Failed to create employee' }, { status: 500 })
  }
})
