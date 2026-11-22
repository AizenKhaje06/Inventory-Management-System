import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin as supabase } from "@/lib/supabase"
import { withAuth } from "@/lib/api-helpers"

// ─── PUT: Update employee ───────────────────────────────────────────────────
export const PUT = withAuth(async (request, { user, params }) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const { name, department, position, status } = body

    // Validate
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Employee name is required' }, { status: 400 })
    }

    if (status && !['active', 'inactive'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Check for duplicate name (excluding current employee)
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .ilike('name', name.trim())
      .neq('id', id)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Another employee with this name already exists' }, { status: 400 })
    }

    // Update employee
    const { data, error } = await supabase
      .from('employees')
      .update({
        name: name.trim(),
        department: department || null,
        position: position?.trim() || null,
        status: status || 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[Employees PUT] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    console.log(`[Employees PUT] ✅ Updated: ${id} - ${name}`)
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('[Employees PUT] Exception:', error)
    return NextResponse.json({ error: error.message || 'Failed to update employee' }, { status: 500 })
  }
})

// ─── DELETE: Soft delete (mark as inactive) ─────────────────────────────────
export const DELETE = withAuth(async (request, { user, params }) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
    }

    // Soft delete: mark as inactive instead of deleting
    const { data, error } = await supabase
      .from('employees')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[Employees DELETE] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    console.log(`[Employees DELETE] ✅ Deactivated: ${id}`)
    return NextResponse.json({ success: true, message: 'Employee marked as inactive' })

  } catch (error: any) {
    console.error('[Employees DELETE] Exception:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete employee' }, { status: 500 })
  }
})
