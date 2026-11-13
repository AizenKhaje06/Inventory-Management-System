import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

/**
 * Debug API - Check Profit Calculation
 * 
 * This endpoint helps identify why profit calculations might be wrong
 */
export async function GET(request: Request) {
  try {
    // Fetch all non-cancelled orders
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('is_cancelled', false)
      .order('created_at', { ascending: false })
      .limit(10) // Get last 10 orders

    if (error) {
      console.error('Error fetching orders:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform and analyze orders
    const analysis = orders?.map(order => {
      const qty = order.qty || 0
      const cogs = order.cogs || 0
      const total = order.total || 0
      const calculatedProfit = total - (cogs * qty)
      const profitMargin = total > 0 ? (calculatedProfit / total) * 100 : 0

      return {
        id: order.id,
        product: order.product,
        qty: qty,
        cogs: cogs,
        total: total,
        totalCost: cogs * qty,
        calculatedProfit: calculatedProfit,
        profitMargin: profitMargin.toFixed(2) + '%',
        hasIssue: calculatedProfit < 0 || cogs <= 0 || total <= 0,
        created_at: order.created_at
      }
    }) || []

    // Calculate totals
    const totals = {
      totalOrders: orders?.length || 0,
      totalRevenue: orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0,
      totalCOGS: orders?.reduce((sum, o) => sum + ((o.cogs || 0) * (o.qty || 0)), 0) || 0,
      totalProfit: orders?.reduce((sum, o) => sum + (o.total - (o.cogs * o.qty)), 0) || 0,
      ordersWithIssues: analysis.filter(a => a.hasIssue).length
    }

    totals['profitMargin'] = totals.totalRevenue > 0 
      ? ((totals.totalProfit / totals.totalRevenue) * 100).toFixed(2) + '%'
      : '0%'

    return NextResponse.json({
      success: true,
      message: 'Last 10 orders analyzed',
      totals,
      orders: analysis
    })

  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
