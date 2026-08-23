import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getPhilippinesDateTime } from '@/lib/timezone-utils'

/**
 * GET /api/orders-management
 * Fetch all orders with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status') // 'active' | 'cancelled' | 'all'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const staff = searchParams.get('staff')

    let query = supabaseAdmin
      .from('orders')
      .select('*')
      .order('date', { ascending: false })

    // Filter by status
    if (status === 'active') {
      query = query.eq('is_cancelled', false)
    } else if (status === 'cancelled') {
      query = query.eq('is_cancelled', true)
    }

    // Filter by date range
    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }

    // Filter by staff
    if (staff) {
      query = query.eq('dispatched_by', staff)
    }

    const { data: orders, error } = await query

    if (error) {
      console.error('[Orders API] Error fetching orders:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Apply search filter (client-side for complex search)
    let filteredOrders = orders || []
    if (search) {
      const searchLower = search.toLowerCase()
      filteredOrders = filteredOrders.filter(order =>
        order.id.toLowerCase().includes(searchLower) ||
        order.product?.toLowerCase().includes(searchLower) ||
        order.waybill_number?.toLowerCase().includes(searchLower) ||
        order.dispatched_by?.toLowerCase().includes(searchLower)
      )
    }

    // Calculate statistics
    const stats = {
      total: filteredOrders.length,
      active: filteredOrders.filter(o => !o.is_cancelled).length,
      cancelled: filteredOrders.filter(o => o.is_cancelled).length,
      totalRevenue: filteredOrders
        .filter(o => !o.is_cancelled)
        .reduce((sum, o) => sum + (o.total || 0), 0),
      todayCount: filteredOrders.filter(o => {
        const orderDate = new Date(o.date)
        const today = new Date()
        return orderDate.toDateString() === today.toDateString() && !o.is_cancelled
      }).length
    }

    return NextResponse.json({
      orders: filteredOrders,
      stats
    })
  } catch (error) {
    console.error('[Orders API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
