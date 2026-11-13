import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

/**
 * GET - Fetch all employee purchases
 */
export async function GET(request: Request) {
  try {
    const { data: purchases, error } = await supabaseAdmin
      .from('employee_purchases')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Employee Purchases API] Error fetching purchases:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ purchases })
  } catch (error) {
    console.error('[Employee Purchases API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST - Create new employee purchase
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { employee_name, items, deduction_date, total_amount } = body

    if (!employee_name || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Calculate totals
    const totalQuantity = items.reduce((sum: number, item: any) => sum + item.quantity, 0)
    const calculatedTotal = items.reduce((sum: number, item: any) => {
      const itemPrice = item.isFreebie ? 0 : (item.price * item.quantity)
      return sum + itemPrice
    }, 0)

    // Create a summary of items for notes
    const itemsSummary = items.map((item: any) => 
      `${item.name} (${item.quantity}x)${item.isFreebie ? ' [Freebie]' : ''}`
    ).join(', ')

    // Create single purchase record with items stored as JSON
    const purchaseRecord = {
      employee_name: employee_name.trim(),
      items: JSON.stringify(items), // Store items as JSON array
      total_quantity: totalQuantity,
      amount: calculatedTotal,
      purchase_date: new Date().toISOString(),
      deduction_date,
      status: 'pending',
      notes: itemsSummary
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from('employee_purchases')
      .insert(purchaseRecord)
      .select()
      .single()

    if (insertError) {
      console.error('[Employee Purchases API] Error creating purchase:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Purchase created successfully',
      purchase: created
    })
  } catch (error) {
    console.error('[Employee Purchases API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
