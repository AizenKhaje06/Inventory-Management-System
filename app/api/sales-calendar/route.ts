import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

/**
 * Sales Calendar API - Clean Implementation
 * Returns daily sales data for a specific month/year
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || '0') // 0-11
    const year = parseInt(searchParams.get('year') || '2026')

    console.log('🗓️ Sales Calendar API - Request:', { month, year })

    // Calculate month start and end dates
    const monthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))
    const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999))

    console.log('📅 Date Range:', {
      start: monthStart.toISOString(),
      end: monthEnd.toISOString()
    })

    // Fetch orders for this month
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('id, date, qty, cogs, total, product')
      .eq('is_cancelled', false)
      .gte('date', monthStart.toISOString())
      .lte('date', monthEnd.toISOString())
      .order('date', { ascending: true })

    if (error) {
      console.error('❌ Error fetching orders:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Orders fetched:', orders?.length || 0)
    if (orders && orders.length > 0) {
      console.log('📦 First order sample:', {
        id: orders[0].id,
        date: orders[0].date,
        product: orders[0].product,
        qty: orders[0].qty,
        total: orders[0].total
      })
    }

    // Group orders by day
    const dailySales: { [key: string]: { revenue: number; items: number; orders: number } } = {}

    orders?.forEach(order => {
      const orderDate = new Date(order.date)
      const dayKey = orderDate.getUTCDate() // Get day number (1-31)
      
      console.log(`📅 Processing order: date=${order.date}, parsed=${orderDate.toISOString()}, day=${dayKey}`)

      if (!dailySales[dayKey]) {
        dailySales[dayKey] = { revenue: 0, items: 0, orders: 0 }
      }

      dailySales[dayKey].revenue += order.total || 0
      dailySales[dayKey].items += order.qty || 0
      dailySales[dayKey].orders += 1
    })

    console.log('📊 Daily Sales Summary:', dailySales)

    // Generate array of all days in month with sales data
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const salesData = dailySales[day]

      return {
        day,
        date: new Date(Date.UTC(year, month, day)).toISOString(),
        revenue: salesData?.revenue || 0,
        items: salesData?.items || 0,
        orders: salesData?.orders || 0
      }
    })

    console.log('✅ Calendar days generated:', calendarDays.length)
    console.log('📈 Days with sales:', calendarDays.filter(d => d.revenue > 0).length)
    console.log('🔍 Sample calendar days:', calendarDays.slice(0, 3).map(d => ({
      day: d.day,
      date: d.date,
      revenue: d.revenue
    })))

    return NextResponse.json({
      month,
      year,
      days: calendarDays,
      summary: {
        totalRevenue: calendarDays.reduce((sum, d) => sum + d.revenue, 0),
        totalItems: calendarDays.reduce((sum, d) => sum + d.items, 0),
        totalOrders: calendarDays.reduce((sum, d) => sum + d.orders, 0),
        daysWithSales: calendarDays.filter(d => d.revenue > 0).length
      }
    })

  } catch (error) {
    console.error('❌ Sales Calendar API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales calendar data' },
      { status: 500 }
    )
  }
}
