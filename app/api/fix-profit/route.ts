import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

/**
 * Fix Profit Calculation Issues
 * 
 * This endpoint fixes orders where COGS was stored as total instead of per-unit
 */
export async function POST(request: Request) {
  try {
    // The 3 problematic orders
    const ordersToFix = [
      {
        id: 'ORD-1788361733302',
        product: 'Volcanic Mud Scrub',
        qty: 500,
        incorrectCOGS: 60000,
        correctCOGS: 120, // per unit
        total: 249500
      },
      {
        id: 'ORD-1788358757437',
        product: 'Niacinamide Soap',
        qty: 700,
        incorrectCOGS: 14100,
        correctCOGS: 20, // per unit
        total: 69700
      },
      {
        id: 'ORD-1788356709322',
        product: 'Berry Soap',
        qty: 892,
        incorrectCOGS: 17840,
        correctCOGS: 20, // per unit
        total: 88308
      }
    ]

    const results = []

    for (const order of ordersToFix) {
      // Update the order with correct COGS
      const { data, error } = await supabaseAdmin
        .from('orders')
        .update({ 
          cogs: order.correctCOGS 
        })
        .eq('id', order.id)
        .select()

      if (error) {
        results.push({
          order_id: order.id,
          success: false,
          error: error.message
        })
      } else {
        const newProfit = order.total - (order.correctCOGS * order.qty)
        results.push({
          order_id: order.id,
          success: true,
          product: order.product,
          qty: order.qty,
          old_cogs: order.incorrectCOGS,
          new_cogs: order.correctCOGS,
          old_profit: order.total - (order.incorrectCOGS * order.qty),
          new_profit: newProfit,
          updated: true
        })
      }
    }

    // Calculate new totals
    const { data: allOrders } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('is_cancelled', false)

    const newTotals = {
      totalRevenue: allOrders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0,
      totalCOGS: allOrders?.reduce((sum, o) => sum + ((o.cogs || 0) * (o.qty || 0)), 0) || 0,
      totalProfit: allOrders?.reduce((sum, o) => sum + (o.total - (o.cogs * o.qty)), 0) || 0,
    }

    newTotals['profitMargin'] = newTotals.totalRevenue > 0 
      ? ((newTotals.totalProfit / newTotals.totalRevenue) * 100).toFixed(2) + '%'
      : '0%'

    return NextResponse.json({
      success: true,
      message: 'Orders fixed successfully',
      results,
      newTotals
    })

  } catch (error) {
    console.error('Fix API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Also allow GET to see what would be fixed
export async function GET(request: Request) {
  return NextResponse.json({
    message: 'Use POST method to fix the orders',
    ordersToFix: [
      'ORD-1788361733302 - Volcanic Mud Scrub (500) - COGS will change from 60000 to 120',
      'ORD-1788358757437 - Niacinamide Soap (700) - COGS will change from 14100 to 20',
      'ORD-1788356709322 - Berry Soap (892) - COGS will change from 17840 to 20'
    ],
    note: 'Send POST request to apply fixes'
  })
}
