import { NextResponse } from "next/server"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { getInventoryItems, getRestocks } from "@/lib/supabase-db"
import { getCachedData } from "@/lib/cache"
import type { DashboardStats, InventoryItem } from "@/lib/types"
import { 
  filterRevenueOrders, 
  calculateFinancialMetrics,
  getExcludedOrdersSummary,
  EXCLUDED_STATUSES 
} from "@/lib/financial-utils"

/**
 * Dashboard API - Complete Sales Data
 * 
 * Data Source: orders table (primary sales records)
 * Shows all sales orders with accurate financial data
 * 
 * This ensures all financial metrics match the orders table.
 */

function emptyDashboardStats(): DashboardStats {
  return {
    totalItems: 0,
    lowStockItems: 0,
    totalValue: 0,
    recentSales: 0,
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    profitMargin: 0,
    totalTransactions: 0,
    salesOverTime: [],
    topProducts: [],
    recentTransactions: [],
    topCategories: [],
    totalCategories: 0,
    totalProducts: 0,
    stockPercentageByCategory: [],
    stocksCountByCategory: [],
    stocksCountByStore: [],
    totalSales: 0,
    returnRate: 0,
    damagedReturnRate: 0,
    supplierReturnRate: 0,
    totalReturns: 0,
    returnValue: 0,
    itemsSoldToday: 0,
    revenueToday: 0,
    supplierReturns: [],
    recentRestocks: [],
    recentFreebies: [],
    averageOrderValue: 0,
    outOfStockCount: 0,
    inventoryHealthScore: 100,
    insights: [],
    salesVelocity: 0,
    yesterdaySales: 0,
    lastWeekSales: 0,
    lastMonthSales: 0,
    totalCancelledOrders: 0,
    cancelledOrdersValue: 0,
    cancellationRate: 0,
    topCancellationReasons: [],
    cancelledPackingQueue: 0,
    cancelledTrackOrders: 0,
    totalDelivered: 0,
    deliveredPercentage: 0,
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'ID'
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 DASHBOARD API - REQUEST RECEIVED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Period:', period);
    console.log('Start Date Param:', startDateParam);
    console.log('End Date Param:', endDateParam);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Get user from headers for department filtering
    const userRole = request.headers.get('x-user-role')
    const assignedChannel = request.headers.get('x-assigned-channel')

    // Parse date parameters
    let startDate: Date | null = null
    let endDate: Date | null = null
    
    if (startDateParam) {
      startDate = new Date(startDateParam)
    }
    if (endDateParam) {
      endDate = new Date(endDateParam)
    }

    // Fetch inventory items and restocks
    let items: InventoryItem[] = []
    let restockHistory: any[] = []

    try {
      items = await getCachedData(
        'inventory-items',
        () => getInventoryItems(),
        60000 // 1 minute
      )
      restockHistory = await getCachedData(
        'restocks',
        () => getRestocks(),
        60000 // 1 minute
      )
    } catch (dbError) {
      console.error("[Dashboard API] Database error:", dbError)
      return NextResponse.json(emptyDashboardStats())
    }

    // Fetch transactions from ORDERS table (primary sales data source)
    // Use supabaseAdmin to bypass RLS and get all orders
    let ordersQuery = supabaseAdmin
      .from('orders')
      .select('*')
      .eq('is_cancelled', false) // Only non-cancelled orders

    const { data: allOrders, error: ordersError } = await ordersQuery

    console.log('[Dashboard API] ===== ORDERS FETCH DEBUG =====')
    console.log('[Dashboard API] Orders fetched:', allOrders?.length || 0)
    console.log('[Dashboard API] First 3 orders:', JSON.stringify(allOrders?.slice(0, 3), null, 2))
    console.log('[Dashboard API] Date filter:', { startDate, endDate })
    console.log('[Dashboard API] Orders error:', ordersError)
    console.log('[Dashboard API] ===== END DEBUG =====')

    if (ordersError) {
      console.error("[Dashboard API] Error fetching orders:", ordersError)
      return NextResponse.json(emptyDashboardStats())
    }

    // Transform orders to transaction format for compatibility
    const allTransactions = (allOrders || []).map(order => ({
      id: order.id,
      item_id: null, // Orders don't have item_id
      item_name: order.product,
      quantity: order.qty,
      cost_price: order.cogs,
      selling_price: order.total / order.qty, // Calculate selling price
      total_cost: order.cogs * order.qty,
      total_revenue: order.total,
      profit: order.total - (order.cogs * order.qty),
      timestamp: order.date || order.created_at, // Use date first (timestamptz column), fallback to created_at
      type: 'sale',
      staff_name: order.dispatched_by,
      notes: order.notes || ''
    }))
    
    console.log('[Dashboard API] Sample transformed transaction:', allTransactions[0]);

    // Apply date filters ONLY for KPI cards (not for chart data)
    // Chart data is controlled by period tabs (Day/Week/Month)
    let filteredTransactionsForKPIs = allTransactions || []
    if (startDate || endDate) {
      const beforeFilter = filteredTransactionsForKPIs.length
      filteredTransactionsForKPIs = filteredTransactionsForKPIs.filter(tx => {
        const txDate = new Date(tx.timestamp)
        
        // Set time boundaries for inclusive date range
        if (startDate) {
          const startOfDay = new Date(startDate)
          startOfDay.setHours(0, 0, 0, 0)
          if (txDate < startOfDay) return false
        }
        if (endDate) {
          const endOfDay = new Date(endDate)
          endOfDay.setHours(23, 59, 59, 999)
          if (txDate > endOfDay) return false
        }
        return true
      })
      console.log('[Dashboard API] Date filter applied for KPI cards:', beforeFilter, '->', filteredTransactionsForKPIs.length)
    }
    
    // For chart data, ALWAYS use all transactions (ignore date filter)
    // Chart is controlled by period tabs (Day/Week/Month)
    const filteredTransactions = allTransactions || []

    // Map all transactions for processing
    const allTransactionsMapped = filteredTransactions.map(tx => ({
      id: tx.id,
      itemId: tx.item_id,
      itemName: tx.item_name,
      quantity: tx.quantity,
      costPrice: tx.cost_price,
      sellingPrice: tx.selling_price,
      totalCost: tx.total_cost,
      totalRevenue: tx.total_revenue,
      profit: tx.profit,
      timestamp: tx.timestamp,
      staffName: tx.staff_name,
      notes: tx.notes
    }))

    // Map filtered transactions for KPI cards (respects date filter)
    const kpiTransactionsMapped = filteredTransactionsForKPIs.map(tx => ({
      id: tx.id,
      itemId: tx.item_id,
      itemName: tx.item_name,
      quantity: tx.quantity,
      costPrice: tx.cost_price,
      sellingPrice: tx.selling_price,
      totalCost: tx.total_cost,
      totalRevenue: tx.total_revenue,
      profit: tx.profit,
      timestamp: tx.timestamp,
      staffName: tx.staff_name,
      notes: tx.notes
    }))

    // Use transactions for all calculations
    const activeTransactions = allTransactionsMapped
    const activeTransactionsKPI = kpiTransactionsMapped

    // Calculate overall financial metrics (for KPI cards - respects date filter)
    // Use transactions data directly
    const totalRevenue = activeTransactionsKPI.reduce((sum, tx) => sum + tx.totalRevenue, 0)
    const totalCOGS = activeTransactionsKPI.reduce((sum, tx) => sum + tx.totalCost, 0)
    const totalProfit = activeTransactionsKPI.reduce((sum, tx) => sum + tx.profit, 0)
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    const totalQuantity = activeTransactionsKPI.reduce((sum, tx) => sum + tx.quantity, 0)

    const financialMetrics = {
      totalRevenue,
      totalCOGS,
      totalProfit,
      profitMargin,
      totalQuantity,
      totalOrders: activeTransactionsKPI.length
    }

    // No excluded orders in simplified system
    const excludedSummary = {
      totalCancelled: 0,
      cancelledValue: 0,
      totalReturned: 0,
      returnedValue: 0
    }

    // Inventory metrics
    const totalItems = items.length
    const lowStockItems = items.filter((item: InventoryItem) => 
      item.quantity > 0 && item.quantity <= item.reorderLevel
    ).length
    const outOfStockCount = items.filter((item: InventoryItem) => item.quantity === 0).length
    const totalValue = items.reduce((sum, item: InventoryItem) => 
      sum + item.quantity * item.sellingPrice, 0
    )

    // Today's metrics for comparison (for Revenue Overview card - ignores date filter)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    // Use activeTransactions (all transactions, ignores date filter) for chart comparison
    const todayTransactions = activeTransactions.filter(tx => {
      const txDate = new Date(tx.timestamp)
      return txDate >= today && txDate <= todayEnd
    })

    // For KPI cards (respects date filter)
    const todayTransactionsKPI = activeTransactionsKPI.filter(tx => {
      const txDate = new Date(tx.timestamp)
      return txDate >= today && txDate <= todayEnd
    })

    const itemsSoldToday = todayTransactionsKPI.reduce((sum, tx) => sum + tx.quantity, 0)
    const revenueToday = todayTransactionsKPI.reduce((sum, tx) => sum + tx.totalRevenue, 0)
    const recentSales = todayTransactionsKPI.length

    // Yesterday's sales for comparison (for Revenue Overview card - ignores date filter)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const yesterdayEnd = new Date(today)
    yesterdayEnd.setHours(0, 0, 0, 0)

    const yesterdayTransactions = activeTransactions.filter(tx => {
      const txDate = new Date(tx.timestamp)
      return txDate >= yesterday && txDate < yesterdayEnd
    })
    const yesterdaySales = yesterdayTransactions.reduce((sum, tx) => sum + tx.totalRevenue, 0)
    const yesterdayQuantity = yesterdayTransactions.reduce((sum, tx) => sum + tx.quantity, 0)

    // Last week sales (7-14 days ago) (for Revenue Overview card - ignores date filter)
    const lastWeekStart = new Date(today)
    lastWeekStart.setDate(lastWeekStart.getDate() - 14)
    const lastWeekEnd = new Date(today)
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7)

    const lastWeekTransactions = activeTransactions.filter(tx => {
      const txDate = new Date(tx.timestamp)
      return txDate >= lastWeekStart && txDate < lastWeekEnd
    })
    const lastWeekSales = lastWeekTransactions.reduce((sum, tx) => sum + tx.totalRevenue, 0)
    const lastWeekQuantity = lastWeekTransactions.reduce((sum, tx) => sum + tx.quantity, 0)

    // Last month sales (for Revenue Overview card - ignores date filter)
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    lastMonthStart.setHours(0, 0, 0, 0)
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 1)
    lastMonthEnd.setHours(0, 0, 0, 0)

    const lastMonthTransactions = activeTransactions.filter(tx => {
      const txDate = new Date(tx.timestamp)
      return txDate >= lastMonthStart && txDate < lastMonthEnd
    })
    const lastMonthSales = lastMonthTransactions.reduce((sum, tx) => sum + tx.totalRevenue, 0)
    const lastMonthQuantity = lastMonthTransactions.reduce((sum, tx) => sum + tx.quantity, 0)

    // Sales over time based on period OR date filter
    let salesOverTime: { date: string; purchases: number; sales: number; quantity: number }[] = []

    // If date filter is active, use filtered date range for chart
    if (startDate && endDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
      
      salesOverTime = Array.from({ length: daysDiff }, (_, i) => {
        const day = new Date(start.getTime()) // Clone from timestamp
        day.setDate(day.getDate() + i) // Add days properly
        day.setHours(0, 0, 0, 0)
        const nextDay = new Date(day)
        nextDay.setDate(nextDay.getDate() + 1)

        // Format as "Nov 15" for consistency
        const dayStr = day.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        })

        const dayTransactions = activeTransactionsKPI.filter(tx => {
          const txDate = new Date(tx.timestamp)
          return txDate >= day && txDate < nextDay
        })

        const sales = dayTransactions.reduce((sum, tx) => sum + tx.totalRevenue, 0)
        const quantity = dayTransactions.reduce((sum, tx) => sum + tx.quantity, 0)

        return { date: dayStr, purchases: 0, sales, quantity }
      })
      
      console.log('[Dashboard API] Generated salesOverTime for date range:', {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        daysGenerated: daysDiff,
        firstDay: salesOverTime[0],
        lastDay: salesOverTime[salesOverTime.length - 1],
        daysWithSales: salesOverTime.filter(d => d.sales > 0).length
      })
    } else if (period === 'ID') {
      // Today: Hourly data
      salesOverTime = Array.from({ length: 24 }, (_, i) => {
        const hourStart = new Date(today)
        hourStart.setHours(i, 0, 0, 0)
        const hourEnd = new Date(today)
        hourEnd.setHours(i, 59, 59, 999)

        const hourStr = i.toString().padStart(2, '0') + ':00'

        const hourTransactions = activeTransactions.filter(tx => {
          const txDate = new Date(tx.timestamp)
          return txDate >= hourStart && txDate <= hourEnd
        })

        const sales = hourTransactions.reduce((sum, tx) => sum + tx.totalRevenue, 0)
        const quantity = hourTransactions.reduce((sum, tx) => sum + tx.quantity, 0)

        return { date: hourStr, purchases: 0, sales, quantity }
      })
    } else if (period === '1W') {
      // Last 7 days - show month and day (Nov 5, Nov 6, etc.)
      salesOverTime = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(today)
        day.setDate(today.getDate() - (6 - i))
        day.setHours(0, 0, 0, 0)
        const nextDay = new Date(day)
        nextDay.setDate(day.getDate() + 1)

        // Format as "Nov 5", "Nov 6", etc.
        const dayStr = day.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        })

        const dayTransactions = activeTransactions.filter(tx => {
          const txDate = new Date(tx.timestamp)
          return txDate >= day && txDate < nextDay
        })

        const sales = dayTransactions.reduce((sum, tx) => sum + tx.totalRevenue, 0)
        const quantity = dayTransactions.reduce((sum, tx) => sum + tx.quantity, 0)

        return { date: dayStr, purchases: 0, sales, quantity }
      })
    } else if (period === '1M') {
      // Current month
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()

      salesOverTime = Array.from({ length: daysInMonth }, (_, i) => {
        const day = new Date(today.getFullYear(), today.getMonth(), i + 1)
        day.setHours(0, 0, 0, 0)
        const nextDay = new Date(day)
        nextDay.setDate(nextDay.getDate() + 1)

        const dayStr = `${i + 1}` // Just the day number: 1, 2, 3, etc.

        const dayTransactions = activeTransactions.filter(tx => {
          const txDate = new Date(tx.timestamp)
          return txDate >= day && txDate < nextDay
        })

        const sales = dayTransactions.reduce((sum, tx) => sum + tx.totalRevenue, 0)
        const quantity = dayTransactions.reduce((sum, tx) => sum + tx.quantity, 0)

        return { date: dayStr, purchases: 0, sales, quantity }
      })
    }

    // Top products by quantity sold - Group by item name
    const productSales = kpiTransactionsMapped.reduce((acc: { [key: string]: { quantity: number; revenue: number } }, tx) => {
      const product = tx.itemName || 'Unknown'
      
      if (!acc[product]) {
        acc[product] = { quantity: 0, revenue: 0 }
      }
      acc[product].quantity += tx.quantity
      acc[product].revenue += tx.totalRevenue
      return acc
    }, {})

    const topProducts = Object.entries(productSales)
      .sort(([, a], [, b]) => (b as { quantity: number; revenue: number }).quantity - (a as { quantity: number; revenue: number }).quantity)
      .slice(0, 4)
      .map(([name, data]) => {
        const typedData = data as { quantity: number; revenue: number }
        return {
          name,
          sales: typedData.quantity,
          revenue: typedData.revenue
        }
      })

    // Recent transactions (last 5 transactions) (for KPI cards)
    const recentTransactions = kpiTransactionsMapped
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)
      .map(tx => ({
        id: tx.id,
        itemId: tx.itemId,
        itemName: tx.itemName,
        quantity: tx.quantity,
        costPrice: tx.costPrice,
        sellingPrice: tx.sellingPrice,
        totalCost: tx.totalCost,
        totalRevenue: tx.totalRevenue,
        profit: tx.profit,
        timestamp: tx.timestamp,
        type: 'sale' as const,
        transactionType: 'sale' as const,
        status: 'completed' as 'completed' | 'pending'
      }))

    // Top categories (from inventory items matched with transactions) (for KPI cards)
    const categorySales = items.reduce((acc: { [key: string]: { sales: number; revenue: number } }, item: InventoryItem) => {
      const categoryTransactions = kpiTransactionsMapped.filter(tx => 
        tx.itemId === item.id || tx.itemName === item.name
      )
      const sales = categoryTransactions.reduce((sum, tx) => sum + tx.quantity, 0)
      const revenue = categoryTransactions.reduce((sum, tx) => sum + tx.totalRevenue, 0)
      
      if (!acc[item.category]) {
        acc[item.category] = { sales: 0, revenue: 0 }
      }
      acc[item.category].sales += sales
      acc[item.category].revenue += revenue
      return acc
    }, {})

    const topCategories = Object.entries(categorySales)
      .sort(([, a], [, b]) => b.sales - a.sales)
      .slice(0, 3)
      .map(([name, data]) => ({ name, sales: data.sales, revenue: data.revenue }))

    // Stock metrics by category
    const totalCategories = new Set(items.map((item: InventoryItem) => item.category)).size
    const totalProducts = totalItems

    const stockValueByCategory = items.reduce((acc: { [key: string]: number }, item: InventoryItem) => {
      const value = item.quantity * item.costPrice
      acc[item.category] = (acc[item.category] || 0) + value
      return acc
    }, {})

    const stockPercentageByCategory = Object.entries(stockValueByCategory)
      .map(([name, value]) => ({
        name,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
      }))
      .sort((a, b) => b.percentage - a.percentage)

    const stocksCountByCategory = items.reduce((acc: { [key: string]: number }, item: InventoryItem) => {
      acc[item.category] = (acc[item.category] || 0) + item.quantity
      return acc
    }, {})

    const stocksCountByCategorySorted = Object.entries(stocksCountByCategory)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Empty — store/channel grouping removed
    const stocksCountByStoreSorted: { name: string; count: number }[] = []
    const storePerformanceSorted: { name: string; count: number }[] = []

    // No return/cancellation tracking in simplified POS system
    const returnedOrders: any[] = []
    const totalReturns = 0
    const returnValue = 0
    const totalOrdersQuantity = filteredTransactionsForKPIs.reduce((sum, tx) => sum + tx.quantity, 0)
    const returnRate = 0
    const damagedReturns = 0
    const supplierReturnsCount = 0
    const damagedReturnRate = 0
    const supplierReturnRate = 0
    const topSupplierReturns: { itemName: string; quantity: number; value: number }[] = []
    const returnsByItem: { name: string; count: number; value: number }[] = []
    const topReturnReasons: { reason: string; count: number }[] = []

    // No cancellation tracking in simplified POS system
    const totalCancelledOrders = 0
    const cancelledOrdersValue = 0
    const totalOrdersCount = filteredTransactionsForKPIs.length
    const cancellationRate = 0
    const topCancellationReasons: { reason: string; count: number }[] = []
    const cancelledPackingQueue = 0
    const cancelledTrackOrders = 0

    // No delivery tracking in simplified POS system
    const totalDelivered = 0
    const deliveredPercentage = 0
    const returnRateByDelivered = 0

    // Recent restocks
    const recentRestocks = restockHistory
      .filter(r => r.reason !== 'supplier-return')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)

    // Recent freebies - fetch from freebies table and group by item name
    let recentFreebies: any[] = []
    try {
      const { data: freebiesData, error: freebiesError } = await supabaseAdmin
        .from('freebies')
        .select('*')
        .order('dispatched_date', { ascending: false })
        .limit(20) // Fetch more to allow grouping

      if (!freebiesError && freebiesData) {
        // Group freebies by item name and sum quantities/COGS
        const groupedFreebies = freebiesData.reduce((acc: any, f: any) => {
          const itemName = f.item_name
          if (!acc[itemName]) {
            acc[itemName] = {
              itemName: itemName,
              quantity: 0,
              totalCOGS: 0,
              reason: f.reason, // Use first occurrence reason
              dispatchedBy: f.dispatched_by,
              dispatchedDate: f.dispatched_date
            }
          }
          acc[itemName].quantity += f.quantity
          acc[itemName].totalCOGS += f.total_cogs
          return acc
        }, {})

        // Convert to array and take top 5
        recentFreebies = Object.values(groupedFreebies)
          .sort((a: any, b: any) => new Date(b.dispatchedDate).getTime() - new Date(a.dispatchedDate).getTime())
          .slice(0, 5)
      }
    } catch (error) {
      console.error('[Dashboard API] Error fetching freebies:', error)
    }

    // Average order value
    const averageOrderValue = financialMetrics.totalOrders > 0 
      ? financialMetrics.totalRevenue / financialMetrics.totalOrders 
      : 0

    // Inventory health score
    const stockHealthPercent = totalItems > 0 ? ((totalItems - outOfStockCount) / totalItems) * 100 : 100
    const returnHealthPercent = 100 - Math.min(returnRate * 10, 100)
    const lowStockHealthPercent = totalItems > 0 ? ((totalItems - lowStockItems) / totalItems) * 100 : 100
    const inventoryHealthScore = Math.round(
      (stockHealthPercent * 0.4 + returnHealthPercent * 0.3 + lowStockHealthPercent * 0.3)
    )

    // Business insights
    const insights = []

    if (topProducts.length > 0) {
      insights.push({
        type: 'success',
        message: `Best seller: ${topProducts[0].name} with ₱${topProducts[0].revenue.toLocaleString()} revenue`
      })
    }

    if (lowStockItems > 0) {
      insights.push({
        type: 'warning',
        message: `${lowStockItems} items need restocking soon`
      })
    }

    if (outOfStockCount > 0) {
      insights.push({
        type: 'error',
        message: `${outOfStockCount} items are out of stock - immediate action required`
      })
    }

    if (financialMetrics.profitMargin >= 30) {
      insights.push({
        type: 'success',
        message: `Excellent profit margin of ${financialMetrics.profitMargin.toFixed(1)}% - keep it up!`
      })
    } else if (financialMetrics.profitMargin < 15) {
      insights.push({
        type: 'warning',
        message: `Profit margin is ${financialMetrics.profitMargin.toFixed(1)}% - consider reviewing pricing`
      })
    }

    if (returnRate > 10) {
      insights.push({
        type: 'error',
        message: `High return rate of ${returnRate.toFixed(1)}% - check product quality`
      })
    }

    if (totalCancelledOrders > 0) {
      insights.push({
        type: 'info',
        message: `${totalCancelledOrders} orders cancelled (₱${cancelledOrdersValue.toLocaleString()}) - excluded from revenue`
      })
    }

    const stats: DashboardStats = {
      totalItems,
      lowStockItems,
      totalValue,
      recentSales,
      totalRevenue: financialMetrics.totalRevenue,
      totalCost: financialMetrics.totalCOGS,
      totalProfit: financialMetrics.totalProfit,
      profitMargin: financialMetrics.profitMargin,
      totalTransactions: allTransactionsMapped.length, // ALL transactions
      salesOverTime,
      topProducts,
      recentTransactions,
      topCategories,
      totalCategories,
      totalProducts,
      stockPercentageByCategory,
      stocksCountByCategory: stocksCountByCategorySorted,
      stocksCountByStore: stocksCountByStoreSorted,
      storePerformance: storePerformanceSorted,
      totalSales: financialMetrics.totalQuantity,
      returnRate: 0, // No returns in simplified POS
      damagedReturnRate: 0,
      supplierReturnRate: 0,
      totalReturns: 0,
      returnValue: 0,
      itemsSoldToday,
      revenueToday,
      supplierReturns: [],
      recentRestocks,
      recentFreebies,
      averageOrderValue,
      outOfStockCount,
      inventoryHealthScore,
      insights,
      salesVelocity: itemsSoldToday,
      yesterdaySales,
      lastWeekSales,
      lastMonthSales,
      yesterdayQuantity,
      lastWeekQuantity,
      lastMonthQuantity,
      totalCancelledOrders: 0,
      cancelledOrdersValue: 0,
      cancellationRate: 0,
      topCancellationReasons: [],
      topReturnReasons: [],
      cancelledOrdersByChannel: [],
      returnsByItem: [],
      cancelledPackingQueue: 0,
      cancelledTrackOrders: 0,
      totalDelivered: 0,
      deliveredPercentage: 0,
    }

    console.log('[Dashboard API] Financial Metrics Summary:', {
      source: 'orders table (primary sales data)',
      totalTransactions: financialMetrics.totalOrders,
      totalRevenue: financialMetrics.totalRevenue,
      totalProfit: financialMetrics.totalProfit,
      profitMargin: financialMetrics.profitMargin
    })

    return NextResponse.json(stats)
  } catch (error) {
    console.error("[Dashboard API] Error:", error)
    return NextResponse.json({ 
      error: "Failed to fetch dashboard stats",
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 })
  }
}
