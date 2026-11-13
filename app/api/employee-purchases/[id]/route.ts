import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

/**
 * PATCH - Update employee purchase status
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { status, notes } = body

    const updates: any = { status }

    if (status === 'paid') {
      updates.paid_date = new Date().toISOString()
    }

    if (notes) {
      updates.notes = notes
    }

    const { data, error } = await supabaseAdmin
      .from('employee_purchases')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[Employee Purchases API] Error updating:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Purchase ${status}`,
      purchase: data
    })
  } catch (error) {
    console.error('[Employee Purchases API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE - Delete employee purchase
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { error } = await supabaseAdmin
      .from('employee_purchases')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[Employee Purchases API] Error deleting:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Purchase deleted'
    })
  } catch (error) {
    console.error('[Employee Purchases API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
