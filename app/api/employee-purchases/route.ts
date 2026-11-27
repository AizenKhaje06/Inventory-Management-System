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

    // 1. Create purchase record with items stored as JSONB
    const purchaseRecord = {
      employee_name: employee_name.trim(),
      items: items, // Supabase automatically handles JSONB conversion
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

    // 2. Deduct items from inventory
    for (const item of items) {
      const { data: inventoryItem, error: fetchError } = await supabaseAdmin
        .from('inventory')
        .select('*')
        .eq('id', item.id)
        .single()

      if (fetchError || !inventoryItem) {
        console.error(`[Employee Purchases API] Item ${item.id} not found in inventory`)
        continue
      }

      // Check if sufficient stock
      if (inventoryItem.quantity < item.quantity) {
        console.warn(`[Employee Purchases API] Insufficient stock for ${item.name}. Available: ${inventoryItem.quantity}, Requested: ${item.quantity}`)
        // Continue anyway - purchase was already recorded
      }

      // Deduct from inventory
      const newQuantity = Math.max(0, inventoryItem.quantity - item.quantity)
      const { error: updateError } = await supabaseAdmin
        .from('inventory')
        .update({ quantity: newQuantity })
        .eq('id', item.id)

      if (updateError) {
        console.error(`[Employee Purchases API] Error updating inventory for ${item.name}:`, updateError)
      }
    }

    // 3. Create activity log
    const logId = `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    const { error: logError } = await supabaseAdmin
      .from('logs')
      .insert({
        id: logId,
        operation: 'Employee Purchase',
        item_name: itemsSummary,
        details: `Employee purchase by ${employee_name}. Items: ${itemsSummary}. Total: ₱${calculatedTotal.toLocaleString()}. Deduction Date: ${new Date(deduction_date).toLocaleDateString()}`,
        timestamp: new Date().toISOString(),
        staff_name: employee_name,
        quantity: totalQuantity,
        status: 'completed'
      })

    if (logError) {
      console.error('[Employee Purchases API] Error creating log:', logError)
    }

    return NextResponse.json({
      success: true,
      message: 'Purchase created successfully and inventory updated',
      purchase: created
    })
  } catch (error) {
    console.error('[Employee Purchases API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
