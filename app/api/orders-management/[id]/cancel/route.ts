import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getPhilippinesDateTime } from '@/lib/timezone-utils'

/**
 * POST /api/orders-management/[id]/cancel
 * Cancel an order and restock inventory
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { reason, cancelledBy } = body

    if (!reason || !cancelledBy) {
      return NextResponse.json(
        { error: 'Reason and cancelledBy are required' },
        { status: 400 }
      )
    }

    // 1. Get order details
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    if (order.is_cancelled) {
      return NextResponse.json(
        { error: 'Order is already cancelled' },
        { status: 400 }
      )
    }

    // 2. Mark order as cancelled
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        is_cancelled: true,
        cancelled_at: getPhilippinesDateTime(),
        cancelled_by: cancelledBy,
        cancellation_reason: reason
      })
      .eq('id', id)

    if (updateError) {
      console.error('[Cancel Order API] Error updating order:', updateError)
      return NextResponse.json(
        { error: 'Failed to cancel order' },
        { status: 500 }
      )
    }

    // 3. Get related transactions to restock
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .ilike('notes', `%${id}%`)
      .eq('type', 'sale')

    if (!txError && transactions && transactions.length > 0) {
      // 4. Restock inventory for each item
      for (const tx of transactions) {
        const { data: inventoryItem, error: invError } = await supabaseAdmin
          .from('inventory')
          .select('quantity')
          .eq('id', tx.item_id)
          .single()

        if (!invError && inventoryItem) {
          const newQuantity = inventoryItem.quantity + tx.quantity

          await supabaseAdmin
            .from('inventory')
            .update({ quantity: newQuantity })
            .eq('id', tx.item_id)

          console.log(`[Cancel Order API] Restocked ${tx.item_name}: +${tx.quantity}`)
        }
      }
    }

    // 5. Create log entry
    await supabaseAdmin
      .from('logs')
      .insert({
        id: `LOG-${Date.now()}`,
        operation: 'cancel_order',
        item_id: id,
        item_name: order.product,
        details: `Order cancelled by ${cancelledBy}. Reason: ${reason}. Amount: ₱${order.total}`,
        timestamp: getPhilippinesDateTime(),
        staff_name: cancelledBy,
        quantity: order.qty,
        status: 'completed'
      })

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        id: order.id,
        is_cancelled: true,
        cancelled_at: getPhilippinesDateTime(),
        cancelled_by: cancelledBy,
        cancellation_reason: reason
      }
    })
  } catch (error) {
    console.error('[Cancel Order API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
