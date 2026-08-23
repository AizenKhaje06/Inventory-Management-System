import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

// PATCH /api/orders/[id] - Update order details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      qty,
      total
    } = body

    // Get current order details to check if quantity changed
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('qty, product')
      .eq('id', id)
      .single()

    if (fetchError || !currentOrder) {
      console.error('[API PATCH] Error fetching current order:', fetchError)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    console.log('[API PATCH] Current order:', {
      id,
      currentQty: currentOrder.qty,
      newQty: qty,
      product: currentOrder.product
    })

    // Update order details
    const { data, error } = await supabase
      .from('orders')
      .update({
        qty,
        total
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[API PATCH] Error updating order:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[API] Error in PATCH /api/orders/[id]:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to update order',
      details: error.toString()
    }, { status: 500 })
  }
}

// DELETE /api/orders/[id] - Delete order and restore inventory
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    console.log('[API DELETE] Deleting order:', id)
    
    // Delete the order
    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[API DELETE] Error deleting order:', deleteError)
      return NextResponse.json({ 
        error: 'Failed to delete order',
        details: deleteError.message 
      }, { status: 500 })
    }

    console.log('[API DELETE] ✅ Order deleted successfully:', id)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Order deleted successfully'
    })
  } catch (error: any) {
    console.error('[API DELETE] Unexpected error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to delete order',
      details: error.toString()
    }, { status: 500 })
  }
}
