import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/orders - Get orders with optional status filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Get user from headers (set by API client)
    const userRole = request.headers.get('x-user-role')
    const assignedChannel = request.headers.get('x-assigned-channel')
    
    console.log('[Orders API] ===== DEPARTMENT FILTERING DEBUG =====')
    console.log('[Orders API] User Role:', userRole)
    console.log('[Orders API] Assigned Channel:', assignedChannel)
    console.log('[Orders API] Date Filter:', { startDate, endDate })
    console.log('[Orders API] All Headers:', Object.fromEntries(request.headers.entries()))
    console.log('[Orders API] ===== END DEBUG =====')
    
    let query = supabase
      .from('orders')
      .select('*')
      .is('deleted_at', null)
    
    // DEPARTMENT FILTERING: Operations users only see their department's orders
    if (userRole === 'operations' && assignedChannel) {
      console.log('[Orders API] 🔒 FILTERING ORDERS by channel:', assignedChannel)
      query = query.eq('sales_channel', assignedChannel)
    } else {
      console.log('[Orders API] ✅ NO FILTERING - Admin or no assigned channel')
      console.log('[Orders API] Reason:', {
        isOperations: userRole === 'operations',
        hasChannel: !!assignedChannel,
        userRole,
        assignedChannel
      })
    }
    // Admin sees all orders
    
    // Filter by date range if provided
    // For Packed orders: filter by packed_at (when order was packed)
    // For Pending orders: filter by created_at (when order was dispatched)
    if (startDate) {
      if (status === 'Packed') {
        query = query.gte('packed_at', startDate)
        console.log('[Orders API] 📅 Filtering packed orders from (packed_at):', startDate)
      } else {
        query = query.gte('created_at', startDate)
        console.log('[Orders API] 📅 Filtering from (created_at):', startDate)
      }
    }
    if (endDate) {
      if (status === 'Packed') {
        query = query.lte('packed_at', endDate)
        console.log('[Orders API] 📅 Filtering packed orders to (packed_at):', endDate)
      } else {
        query = query.lte('created_at', endDate)
        console.log('[Orders API] 📅 Filtering to (created_at):', endDate)
      }
    }
    
    // Filter by status if provided
    if (status) {
      if (status === 'Pending') {
        query = query.eq('status', 'Pending')
      } else if (status === 'Packed') {
        query = query.in('status', ['Packed', 'Shipped', 'Delivered'])
      }
    }
    
    // Sort by appropriate timestamp based on status
    // For Packed orders: sort by packed_at (latest packed first)
    // For Pending orders: sort by created_at (latest created first)
    if (status === 'Packed') {
      query = query.order('packed_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }
    
    const { data, error } = await query
    
    console.log('[Orders API] 📊 Query Results:')
    console.log('[Orders API] Total orders returned:', data?.length || 0)
    if (data && data.length > 0) {
      console.log('[Orders API] Orders by channel:', 
        data.reduce((acc: any, order: any) => {
          acc[order.sales_channel] = (acc[order.sales_channel] || 0) + 1
          return acc
        }, {})
      )
    }
    
    if (error) {
      console.error('[API] Error fetching orders:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[API] Error in GET /api/orders:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch orders',
      details: error.toString()
    }, { status: 500 })
  }
}

// POST /api/orders - Create new order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      date,
      qty,
      cogs,
      total,
      product,
      dispatchedBy,
      orderItems = []
    } = body

    // Validate required fields
    if (!date || !qty || !cogs || !total || !product || !dispatchedBy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Generate order ID
    const orderId = `ORD-${Date.now()}`
    
    // Get current Manila time for created_at
    // Format: YYYY-MM-DD HH:mm:ss (without timezone, as Philippine time)
    const now = new Date()
    const manilaTimeString = now.toLocaleString('en-US', { 
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
    
    // Convert "MM/DD/YYYY, HH:mm:ss" to "YYYY-MM-DD HH:mm:ss"
    const [datePart, timePart] = manilaTimeString.split(', ')
    const [month, day, year] = datePart.split('/')
    const createdAt = `${year}-${month}-${day} ${timePart}`
    
    // Insert order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        id: orderId,
        date,
        qty,
        cogs,
        total,
        product,
        dispatched_by: dispatchedBy,
        created_at: createdAt
      })
      .select()
      .single()
    
    if (orderError) {
      console.error('[API] Error creating order:', orderError)
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }
    
    // Log the dispatch action
    try {
      const { addLog } = await import('@/lib/supabase-db')
      await addLog({
        operation: 'order-dispatched',
        itemName: product,
        details: `Order dispatched by ${dispatchedBy}. Qty: ${qty}, Total: ₱${total.toLocaleString()}.`
      })
    } catch (logError) {
      console.error('[API] Error logging order:', logError)
      // Don't fail the request if logging fails
    }
    
    // Insert order items if provided
    if (orderItems.length > 0) {
      const orderItemsData = orderItems.map((item: any) => ({
        id: `ORDITEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        order_id: orderId,
        item_id: item.itemId,
        item_name: item.itemName,
        quantity: item.quantity,
        cost_price: item.costPrice,
        selling_price: item.sellingPrice,
        total_cost: item.quantity * item.costPrice,
        total_revenue: item.quantity * item.sellingPrice,
        created_at: createdAt
      }))
      
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsData)
      
      if (itemsError) {
        console.error('[API] Error creating order items:', itemsError)
        // Don't fail the whole request, just log the error
      }
    }
    
    return NextResponse.json(order, { status: 201 })
  } catch (error: any) {
    console.error('[API] Error in POST /api/orders:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to create order',
      details: error.toString()
    }, { status: 500 })
  }
}
