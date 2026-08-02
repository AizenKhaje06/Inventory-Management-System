"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Package, AlertTriangle, DollarSign, TrendingUp, BarChart2, ShoppingCart, Activity, ArrowUpRight, ArrowDownRight, Percent, Plus, FileText, AlertCircle, PackageX, PackageOpen, RotateCcw, Download, Calendar, CheckCircle } from "lucide-react"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { ChartTooltip } from "@/components/ui/chart-tooltip"
import { GaugeChart } from "@/components/charts/gauge-chart"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import type { DashboardStats, InventoryItem } from "@/lib/types"
import type { TimePeriod } from "@/components/dashboard/revenue-chart"
import { formatNumber } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { PremiumDashboardLoading } from "@/components/premium-loading"
import { BrandLoader } from "@/components/ui/brand-loader"
import { StatCardSkeleton, CardSkeleton } from "@/components/ui/table-skeleton"
import { apiGet } from "@/lib/api-client"
import { formatChartData, calculatePeriodComparison } from "@/lib/dashboard-utils"
import { getCurrentUser } from "@/lib/auth"
import { getCurrentUserRole } from "@/lib/role-utils"
import { EnterpriseDateRangePicker } from "@/components/ui/enterprise-date-range-picker"

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([])
  const [outOfStockItems, setOutOfStockItems] = useState<InventoryItem[]>([])
  const [allItems, setAllItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("ID")
  
  // Default to current month (first day to last day)
  const getDefaultDateRange = () => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { firstDay, lastDay }
  }
  
  const { firstDay, lastDay } = getDefaultDateRange()
  const [startDate, setStartDate] = useState<Date | null>(firstDay)
  const [endDate, setEndDate] = useState<Date | null>(lastDay)
  const currentUser = getCurrentUser()

  const fetchData = async () => {
    try {
      setRefreshing(true)
      console.log('[Dashboard] Fetching data for period:', timePeriod)
      
      // Build API URL
      // - Tabs (Day/Week/Month) control chart data with their own date ranges
      // - Date picker controls KPI cards and other metrics
      let apiUrl = `/api/dashboard?period=${timePeriod}`
      
      // Add date filter for KPI cards (if set)
      if (startDate) {
        apiUrl += `&startDate=${startDate.toISOString()}`
      }
      if (endDate) {
        apiUrl += `&endDate=${endDate.toISOString()}`
      }
      
      const [stats, items] = await Promise.all([
        apiGet<DashboardStats>(apiUrl),
        apiGet<InventoryItem[]>("/api/items")
      ])

      console.log('[Dashboard] Data received:', {
        stats: stats,
        items: items
      })

      setStats(stats)
      setAllItems(items)
      setLowStockItems(items.filter((item: InventoryItem) => item.quantity > 0 && item.quantity <= item.reorderLevel))
      setOutOfStockItems(items.filter((item: InventoryItem) => item.quantity === 0))
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      setStats(null)
      setAllItems([])
      setLowStockItems([])
      setOutOfStockItems([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [timePeriod, startDate, endDate]) // Refetch when tab OR date filter changes

  // Show loading state with skeleton loaders
  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto py-5 space-y-6" aria-live="polite" aria-busy="true">
        {/* Header skeleton */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="space-y-2">
            <div className="h-8 w-56 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-4 w-72 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
          <div className="h-10 w-52 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
        </div>
        {/* KPI cards skeleton — row 1 */}
        <StatCardSkeleton count={4} />
        {/* KPI cards skeleton — row 2 */}
        <StatCardSkeleton count={4} />
        {/* Charts skeleton */}
        <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
          <CardSkeleton lines={6} />
          <CardSkeleton lines={6} />
          <CardSkeleton lines={6} />
        </div>
        <span className="sr-only">Loading dashboard, please wait...</span>
      </div>
    )
  }

  // Calculate additional metrics
  // Note: totalProfit already excludes returns (calculated from filtered orders)
  const netProfit = stats?.totalProfit || 0
  const lowStockCount = lowStockItems.length
  const outOfStockCount = outOfStockItems.length

  // Calculate Bad Stock metrics
  const badStockItems = allItems?.filter((item: InventoryItem) => item.item_status === 'bad') || []
  const totalBadQty = badStockItems.reduce((sum, item) => sum + (item.bad_item_quantity || 0), 0)
  const totalBadCOGS = badStockItems.reduce((sum, item) => sum + ((item.bad_item_quantity || 0) * item.costPrice), 0)
  const totalBadRevenueLost = badStockItems.reduce((sum, item) => sum + ((item.bad_item_quantity || 0) * item.sellingPrice), 0)

  const stocksCountData = stats?.stocksCountByCategory?.map((cat) => ({
    name: cat.name,
    count: cat.count,
  })) || []

  const stocksCountByStoreData = stats?.stocksCountByStore?.map((store) => ({
    name: store.name,
    count: store.count,
  })) || []

  const storePerformanceData = stats?.storePerformance?.map((store) => ({
    name: store.name,
    count: store.count,
  })) || []

  // Period comparison helper — compares today vs yesterday
  const revenueChange = stats?.revenueToday !== undefined && stats?.yesterdaySales !== undefined && stats.yesterdaySales > 0
    ? ((stats.revenueToday - stats.yesterdaySales) / stats.yesterdaySales) * 100
    : null

  const salesChange = stats?.itemsSoldToday !== undefined && stats?.yesterdayQuantity !== undefined && stats.yesterdayQuantity > 0
    ? ((stats.itemsSoldToday - stats.yesterdayQuantity) / stats.yesterdayQuantity) * 100
    : null

  // Small comparison badge component
  const ComparisonBadge = ({ pct }: { pct: number | null }) => {
    if (pct === null) return null
    const isUp = pct >= 0
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 ${
        isUp
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
      }`}>
        {isUp ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
        {Math.abs(pct).toFixed(1)}%
      </span>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto py-4 px-4 sm:px-6 space-y-5 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold gradient-text leading-tight">Dashboard Overview</h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">Welcome back! Here's what's happening with your inventory.</p>
        </div>
        
        {/* Actions - Date Picker */}
        <div className="flex items-center sm:flex-shrink-0">
          <EnterpriseDateRangePicker
            startDate={startDate}
            endDate={endDate}
            onDateChange={(start, end) => {
              setStartDate(start)
              setEndDate(end)
            }}
            className="w-full sm:w-auto"
          />
        </div>
      </div>
      {/* Redesigned KPI Cards - 2 Rows Only */}
      
      {/* Row 1: Financial Metrics (4 cards) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Sold */}
        <Card className="p-5 border-0 shadow-lg" role="region" aria-label="Total Sold statistics">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 shadow-lg shadow-blue-500/30 flex-shrink-0" aria-hidden="true">
              <ShoppingCart className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider" id="kpi-total-sold-label">Total Sold</p>
              <div className="flex items-center gap-1">
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 tabular-nums" aria-labelledby="kpi-total-sold-label">
                  <AnimatedNumber value={stats?.totalSales || 0} duration={1500} />
                </p>
                <ComparisonBadge pct={salesChange} />
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-500 flex items-center gap-1 mt-0.5">
                {stats?.itemsSoldToday !== undefined && stats.itemsSoldToday > 0
                  ? `${stats.itemsSoldToday} units today`
                  : 'All-time quantity'}
              </p>
            </div>
          </div>
        </Card>

        {/* Total Revenue */}
        <Card className="p-5 border-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-600 shadow-lg shadow-green-500/30 flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Total Revenue</p>
              <div className="flex items-center gap-1">
                <p className="text-2xl font-bold text-green-900 dark:text-green-100 tabular-nums">
                  ₱<AnimatedNumber value={stats?.totalRevenue || 0} duration={1500} />
                </p>
                {!startDate && !endDate && <ComparisonBadge pct={revenueChange} />}
              </div>
              <p className="text-xs text-green-600 dark:text-green-500 flex items-center gap-1 mt-0.5">
                {startDate || endDate ? (
                  stats?.totalRevenue && stats.totalRevenue > 0 ? (
                    <><ArrowUpRight className="h-3 w-3" />Filtered period</>
                  ) : "No sales in period"
                ) : (
                  stats?.revenueToday !== undefined && stats.revenueToday > 0 ? (
                    <><ArrowUpRight className="h-3 w-3" />₱{formatNumber(stats.revenueToday)} today</>
                  ) : "No sales today yet"
                )}
              </p>
            </div>
          </div>
        </Card>

        {/* Gross Profit */}
        <Card className="p-5 border-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600 shadow-lg shadow-purple-500/30 flex-shrink-0">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Gross Profit</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 tabular-nums">
                ₱<AnimatedNumber value={netProfit} duration={1500} />
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-500 flex items-center gap-1 mt-0.5">
                {stats?.returnValue !== undefined && stats.returnValue > 0 ? (
                  <>
                    <ArrowDownRight className="h-3 w-3" />
                    ₱{formatNumber(stats.returnValue)} returns
                  </>
                ) : (
                  "No returns"
                )}
              </p>
            </div>
          </div>
        </Card>

        {/* Profit Margin */}
        <Card className="p-5 border-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-600 shadow-lg shadow-amber-500/30 flex-shrink-0">
              <Percent className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Profit Margin</p>
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 tabular-nums">
                <AnimatedNumber value={stats?.profitMargin || 0} decimals={1} duration={1500} />%
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1 mt-0.5">
                {(stats?.profitMargin || 0) >= 30 ? (
                  "🏆 Excellent!"
                ) : (stats?.profitMargin || 0) >= 15 ? (
                  "✓ Good"
                ) : (
                  "⚠ Improve"
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2: Inventory Metrics (4 cards) - Simplified */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Products */}
        <Card className="p-5 border-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/30 flex-shrink-0">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Total Products</p>
              <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 tabular-nums">
                <AnimatedNumber value={allItems.length || 0} duration={1500} />
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-500 flex items-center gap-1 mt-0.5">
                Active inventory items
              </p>
            </div>
          </div>
        </Card>

        {/* Low Stock Count */}
        <Card className="p-5 border-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-600 shadow-lg shadow-amber-500/30 flex-shrink-0">
              <PackageOpen className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Low Stock Alert</p>
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 tabular-nums">
                <AnimatedNumber value={lowStockCount} duration={1500} />
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1 mt-0.5">
                {lowStockCount > 0 ? (
                  <>
                    <AlertTriangle className="h-3 w-3" />
                    Needs restocking
                  </>
                ) : (
                  "All good"
                )}
              </p>
            </div>
          </div>
        </Card>

        {/* Out of Stock Count */}
        <Card className="p-5 border-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-600 shadow-lg shadow-rose-500/30 flex-shrink-0">
              <PackageX className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Out of Stock</p>
              <p className="text-2xl font-bold text-rose-900 dark:text-rose-100 tabular-nums">
                <AnimatedNumber value={outOfStockCount} duration={1500} />
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-500 flex items-center gap-1 mt-0.5">
                {outOfStockCount > 0 ? (
                  <>
                    <AlertCircle className="h-3 w-3" />
                    Urgent restock
                  </>
                ) : (
                  "No shortages"
                )}
              </p>
            </div>
          </div>
        </Card>

        {/* Total Bad Stock */}
        <Card className="p-5 border-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-600 shadow-lg shadow-red-500/30 flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Total Bad Stock</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100 tabular-nums">
                <AnimatedNumber value={totalBadQty} duration={1500} /> units
              </p>
              <p className="text-xs text-red-600 dark:text-red-500 flex items-center gap-1 mt-0.5">
                {totalBadQty > 0 ? "Damaged or unusable" : "No bad stock"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Enhanced Revenue Chart - Enterprise Level */}
      <RevenueChart
        data={formatChartData(stats?.salesOverTime, timePeriod)}
        timePeriod={timePeriod}
        onPeriodChange={setTimePeriod}
        comparison={calculatePeriodComparison(stats, timePeriod)}
        loading={refreshing}
      />


      {/* Recent Activity */}
      <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
        {/* Recent Sales */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 bg-emerald-500 rounded-full flex-shrink-0"></div>
              <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Recent Sales</h3>
            </div>
            <p className="text-xs mt-0.5 ml-3 text-slate-600 dark:text-slate-400">Latest completed transactions</p>
          </div>
          <CardContent className="pt-4 pb-3">
            <div className="space-y-2">
              {stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
                stats.recentTransactions.map((tx, index) => (
                  <div key={index} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-[#1a1a1a] hover:bg-slate-100 dark:hover:bg-[#222] transition-colors border border-transparent hover:border-slate-200 dark:hover:border-amber-500/15">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                        <ShoppingCart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs truncate text-slate-900 dark:text-white">{tx.itemName}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                          <span>{tx.quantity} units</span>
                          {tx.staffName && <><span>·</span><span className="truncate">{tx.staffName}</span></>}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-bold flex-shrink-0 ml-2 text-emerald-600 dark:text-emerald-400">
                      ₱{formatNumber(tx.totalRevenue)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <ShoppingCart className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">No recent sales</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Restocks */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 bg-blue-500 rounded-full flex-shrink-0"></div>
              <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Recent Restocks</h3>
            </div>
            <p className="text-xs mt-0.5 ml-3 text-slate-600 dark:text-slate-400">Latest inventory replenishments</p>
          </div>
          <CardContent className="pt-4 pb-3">
            <div className="space-y-2">
              {stats?.recentRestocks && stats.recentRestocks.length > 0 ? (
                stats.recentRestocks.map((restock, index) => (
                  <div key={index} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-[#1a1a1a] hover:bg-slate-100 dark:hover:bg-[#222] transition-colors border border-transparent hover:border-slate-200 dark:hover:border-amber-500/15">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs truncate text-slate-900 dark:text-white">{restock.itemName}</div>
                        <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{restock.quantity} units added</div>
                      </div>
                    </div>
                    <div className="text-sm font-bold flex-shrink-0 ml-2 text-blue-600 dark:text-blue-400">
                      ₱{formatNumber(restock.totalCost)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <Package className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">No recent restocks</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights & Health */}
      <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
        {/* Business Insights */}
        <Card className="lg:col-span-2 overflow-hidden border-0 shadow-lg">
          <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 bg-violet-500 rounded-full flex-shrink-0"></div>
              <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Business Insights</h3>
            </div>
            <p className="text-xs mt-0.5 ml-3 text-slate-600 dark:text-slate-400">Automated performance analysis</p>
          </div>
          <CardContent className="pt-4 pb-3">
            <div className="space-y-2">
              {stats?.insights && stats.insights.length > 0 ? (
                stats.insights.map((insight, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 rounded-lg border-l-4",
                      insight.type === 'success' && "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-900/15",
                      insight.type === 'warning' && "border-l-amber-500 bg-amber-50 dark:bg-amber-900/15",
                      insight.type === 'error'   && "border-l-red-500 bg-red-50 dark:bg-red-900/15"
                    )}
                  >
                    <div className={cn(
                      "h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      insight.type === 'success' && "bg-emerald-500",
                      insight.type === 'warning' && "bg-amber-500",
                      insight.type === 'error'   && "bg-red-500"
                    )}>
                      <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {insight.type === 'success'
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v4m0 4h.01" />}
                      </svg>
                    </div>
                    <p className={cn(
                      "text-xs font-semibold leading-relaxed",
                      insight.type === 'success' && "text-emerald-700 dark:text-emerald-300",
                      insight.type === 'warning' && "text-amber-700 dark:text-amber-300",
                      insight.type === 'error'   && "text-red-700 dark:text-red-300"
                    )}>
                      {insight.message}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <Activity className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">No insights available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Inventory Health Score */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 bg-emerald-500 rounded-full flex-shrink-0"></div>
              <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Inventory Health</h3>
            </div>
            <p className="text-xs mt-0.5 ml-3 text-slate-600 dark:text-slate-400">Overall stock status score</p>
          </div>
          <CardContent className="pt-5 pb-4">
            {/* Score */}
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-slate-500 dark:text-slate-400">Health Score</p>
                <div className="flex items-end gap-1.5">
                  <span className="text-4xl font-black leading-none text-slate-900 dark:text-white">
                    {stats?.inventoryHealthScore || 0}
                  </span>
                  <span className="text-base mb-0.5 text-slate-400 dark:text-slate-500">/ 100</span>
                </div>
              </div>
              {/* Circular indicator */}
              <div className={cn(
                "h-14 w-14 rounded-full flex items-center justify-center border-4",
                (stats?.inventoryHealthScore || 0) >= 80 ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" :
                (stats?.inventoryHealthScore || 0) >= 60 ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" :
                "border-red-500 bg-red-50 dark:bg-red-900/20"
              )}>
                <Activity className={cn("h-6 w-6",
                  (stats?.inventoryHealthScore || 0) >= 80 ? "text-emerald-600 dark:text-emerald-400" :
                  (stats?.inventoryHealthScore || 0) >= 60 ? "text-amber-600 dark:text-amber-400" :
                  "text-red-600 dark:text-red-400"
                )} />
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000 ease-out",
                  (stats?.inventoryHealthScore || 0) >= 80 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                  (stats?.inventoryHealthScore || 0) >= 60 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                  "bg-gradient-to-r from-red-500 to-red-400"
                )}
                style={{ width: `${stats?.inventoryHealthScore || 0}%` }}
              />
            </div>
            <div className="flex justify-center mb-4">
              <span className={cn(
                "text-[11px] font-bold px-3 py-1 rounded-full",
                (stats?.inventoryHealthScore || 0) >= 80 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                (stats?.inventoryHealthScore || 0) >= 60 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              )}>
                {(stats?.inventoryHealthScore || 0) >= 80 ? "Excellent Health" :
                 (stats?.inventoryHealthScore || 0) >= 60 ? "Good Health" :
                 (stats?.inventoryHealthScore || 0) >= 40 ? "Fair Health" : "Needs Attention"}
              </span>
            </div>

            {/* Metrics */}
            <div className="space-y-2 border-t border-slate-100 dark:border-amber-500/10 pt-3">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#1a1a1a]">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Stock Levels</span>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {Math.round(((stats?.totalItems || 0) - (stats?.outOfStockCount || 0)) / (stats?.totalItems || 1) * 100)}%
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#1a1a1a]">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <TrendingUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Return Rate</span>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {(stats?.returnRate || 0).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#1a1a1a]">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Low Stock Items</span>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{lowStockCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
