import { NextResponse } from "next/server"
import { getInventoryItems, getTransactions, getRestocks } from "@/lib/supabase-db"
import { supabaseAdmin } from "@/lib/supabase"
import {
  performABCAnalysis,
  calculateInventoryTurnover,
  calculateSalesForecast,
  calculateProfitMarginByCategory,
  calculateReturnAnalytics
} from "@/lib/analytics"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all"

    // Fetch base data — skip getOrders to avoid deleted_at column issue
    const [items, transactions, restocks] = await Promise.all([
      getInventoryItems(),
      getTransactions(),
      getRestocks()
    ])

    // Fetch orders directly without deleted_at filter
    const { data: ordersRaw } = await supabaseAdmin
      .from('orders')
      .select('id, parcel_status, status')
      .in('status', ['Packed', 'Shipped', 'Delivered'])
      .limit(5000)

    const orders = ordersRaw || []

    // For forecast type, return predictive analytics per item
    if (type === "forecast") {
      const forecasts = items
        .map(item => calculateSalesForecast(transactions, item.id, 30))
        .filter(Boolean)
      return NextResponse.json(forecasts)
    }

    // Default: return all analytics
    const abc = performABCAnalysis(items, transactions)
    const turnover = calculateInventoryTurnover(items, transactions, 90)
    const profitMargin = calculateProfitMarginByCategory(transactions, items)
    const returns = calculateReturnAnalytics(restocks, transactions, items, orders)

    return NextResponse.json({
      abc,
      turnover,
      profitMargin,
      returns
    })
  } catch (error: any) {
    console.error("[Analytics API] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch analytics" }, { status: 500 })
  }
}
