import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { addTransaction } from '@/lib/supabase-db'
import { getPhilippinesDateTime } from '@/lib/timezone-utils'

/**
 * POST /api/pos/checkout
 * Creates an order and transaction records for POS walk-in sales
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      items, // Array of items with details
      qty,
      cogs,
      total,
      product,
      dispatchedBy,
      waybillNumber
    } = body

    // Validate required fields
    if (!qty || !cogs || !total || !product || !dispatchedBy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Generate order ID
    const orderId = `ORD-${Date.now()}`
    const now = getPhilippinesDateTime() // Use Philippines timezone
    
    // Insert order (simplified structure)
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        id: orderId,
        date: now,
        qty,
        cogs,
        total,
        product,
        dispatched_by: dispatchedBy,
        waybill_number: waybillNumber || null,
        created_at: now
      })
      .select()
      .single()
    
    if (orderError) {
      console.error('[POS Checkout API] Error creating order:', orderError)
      return NextResponse.json(
        { error: orderError.message },
        { status: 500 }
      )
    }
    
    console.log('[POS Checkout API] ✅ Order created successfully:', {
      id: orderId,
      qty,
      total,
      product
    })

    // Create transaction records for each item
    if (items && Array.isArray(items) && items.length > 0) {
      console.log('[POS Checkout API] Creating transactions with waybill:', waybillNumber)
      
      for (const item of items) {
        try {
          const transactionData: any = {
            itemId: item.id,
            itemName: item.name,
            quantity: item.quantity,
            costPrice: item.costPrice,
            sellingPrice: item.sellingPrice,
            totalCost: item.costPrice * item.quantity,
            totalRevenue: item.sellingPrice * item.quantity,
            type: 'sale' as const,
            staffName: dispatchedBy,
            notes: `POS Sale - Order ${orderId}`
          }
          
          // Only add waybillNumber if it has a value
          if (waybillNumber) {
            transactionData.waybillNumber = waybillNumber
          }
          
          await addTransaction(transactionData)
          console.log('[POS Checkout API] ✅ Transaction created for:', item.name, 'with waybill:', waybillNumber)
        } catch (txError) {
          console.error('[POS Checkout API] Error creating transaction for', item.name, ':', txError)
          // Continue with other items even if one fails
        }
      }
    }
    
    return NextResponse.json(order, { status: 201 })
  } catch (error: any) {
    console.error('[POS Checkout API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: 500 }
    )
  }
}
