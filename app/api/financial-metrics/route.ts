import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * Financial Metrics API
 * 
 * This endpoint provides accurate financial data based on the orders table.
 * Only includes orders with status='Packed' (dispatched orders).
 * 
 * EXCLUDED from revenue calculations:
 * - CANCELLED orders
 * - RETURNED orders
 * - DETAINED orders
 * - PROBLEMATIC orders
 * 
 * INCLUDED in revenue calculations:
 * - DELIVERED orders (confirmed revenue)
 * - IN TRANSIT orders (pending revenue)
 * - ON DELIVERY orders (pending revenue)
 * - PICKUP orders (pending revenue)
 * - PENDING orders (pending revenue)
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'all'
    const includeStatus = searchParams.get('includeStatus') || 'delivered' // 'delivered' | 'all-active' | 'pending'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Get user from headers for department filtering
    const userRole = request.headers.get('x-user-role')
    const assignedChannel = request.headers.get('x-assigned-channel')

    // Fetch all packed orders (dispatched orders)
    // Exclude CANCELLED, RETURNED, DETAINED, and PROBLEMATIC orders from the query
    let query = supabase
      .from('orders')
      .select('*')
      .eq('status', 'Packed')
      .not('parcel_status', 'in', '(CANCELLED,RETURNED,DETAINED,PROBLEMATIC)')

    // DEPARTMENT FILTERING removed — admin sees all orders

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }

    const { data: orders, error } = await query

    if (error) {
      console.error('[API] Error fetching orders:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Define which statuses to include based on parameter
    let includedStatuses: string[] = []
    
    if (includeStatus === 'delivered') {
      // Most conservative: Only confirmed delivered orders
      includedStatuses = ['DELIVERED']
    } else if (includeStatus === 'all-active') {
      // Include all active orders (already excluded cancelled/returned in query)
      includedStatuses = ['DELIVERED', 'IN TRANSIT', 'ON DELIVERY', 'PICKUP', 'PENDING']
    } else if (includeStatus === 'pending') {
      // Only pending/in-progress orders
      includedStatuses = ['IN TRANSIT', 'ON DELIVERY', 'PICKUP', 'PENDING']
    }

    // Filter orders by parcel status
    const activeOrders = orders?.filter(order => 
      includedStatuses.includes(order.parcel_status || 'PENDING')
    ) || []

    // Calculate financial metrics
    const totalOrders = activeOrders.length
    const totalQuantity = activeOrders.reduce((sum, order) => sum + (order.qty || 0), 0)
    const totalRevenue = activeOrders.reduce((sum, order) => sum + (order.total || 0), 0)
    const totalCOGS = totalRevenue * 0.6 // 60% cost assumption
    const totalProfit = totalRevenue - totalCOGS
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

    // Calculate by parcel status
    const byStatus = {
      delivered: calculateStatusMetrics(orders?.filter(o => o.parcel_status === 'DELIVERED') || []),
      inTransit: calculateStatusMetrics(orders?.filter(o => o.parcel_status === 'IN TRANSIT') || []),
      onDelivery: calculateStatusMetrics(orders?.filter(o => o.parcel_status === 'ON DELIVERY') || []),
      pickup: calculateStatusMetrics(orders?.filter(o => o.parcel_status === 'PICKUP') || []),
      pending: calculateStatusMetrics(orders?.filter(o => o.parcel_status === 'PENDING') || []),
      cancelled: calculateStatusMetrics(orders?.filter(o => o.parcel_status === 'CANCELLED') || []),
      returned: calculateStatusMetrics(orders?.filter(o => o.parcel_status === 'RETURNED') || []),
      detained: calculateStatusMetrics(orders?.filter(o => o.parcel_status === 'DETAINED') || []),
      problematic: calculateStatusMetrics(orders?.filter(o => o.parcel_status === 'PROBLEMATIC') || []),
    }

    // Calculate by sales channel
    const bySalesChannel: Record<string, any> = {}
    activeOrders.forEach(order => {
      const channel = order.sales_channel || 'Unknown'
      if (!bySalesChannel[channel]) {
        bySalesChannel[channel] = {
          orders: 0,
          quantity: 0,
          revenue: 0,
          cogs: 0,
          profit: 0,
        }
      }
      bySalesChannel[channel].orders += 1
      bySalesChannel[channel].quantity += order.qty || 0
      bySalesChannel[channel].revenue += order.total || 0
      bySalesChannel[channel].cogs += (order.total || 0) * 0.6
      bySalesChannel[channel].profit += (order.total || 0) * 0.4
    })

    // Calculate by payment status
    const byPaymentStatus = {
      paid: calculateStatusMetrics(activeOrders.filter(o => o.payment_status === 'paid')),
      pending: calculateStatusMetrics(activeOrders.filter(o => o.payment_status === 'pending')),
      cod: calculateStatusMetrics(activeOrders.filter(o => o.payment_status === 'cod')),
      refunded: calculateStatusMetrics(activeOrders.filter(o => o.payment_status === 'refunded')),
    }

    return NextResponse.json({
      summary: {
        totalOrders,
        totalQuantity,
        totalRevenue,
        totalCOGS,
        totalProfit,
        profitMargin,
      },
      byStatus,
      bySalesChannel,
      byPaymentStatus,
      metadata: {
        includeStatus,
        period,
        startDate,
        endDate,
        totalOrdersInSystem: orders?.length || 0,
        excludedOrders: (orders?.length || 0) - totalOrders,
      }
    })
  } catch (error: any) {
    console.error('[API] Error in GET /api/financial-metrics:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch financial metrics',
      details: error.toString()
    }, { status: 500 })
  }
}

function calculateStatusMetrics(orders: any[]) {
  const count = orders.length
  const quantity = orders.reduce((sum, o) => sum + (o.qty || 0), 0)
  const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0)
  const cogs = revenue * 0.6
  const profit = revenue - cogs
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0

  return {
    count,
    quantity,
    revenue,
    cogs,
    profit,
    margin,
  }
}
