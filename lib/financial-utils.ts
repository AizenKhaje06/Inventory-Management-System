/**
 * Financial Utilities
 * 
 * Centralized financial calculation functions to ensure consistency
 * across the entire application.
 * 
 * IMPORTANT: All financial metrics should use orders from the Track Orders
 * page (orders table with status='Packed') and EXCLUDE:
 * - CANCELLED orders
 * - RETURNED orders
 * 
 * CRITICAL: Use ACTUAL COGS from each order, NOT percentage-based calculations.
 * The 'total' field in orders table is the FINAL amount customer will pay.
 * The 'cogs' field in orders table is the ACTUAL cost of goods.
 */

export interface Order {
  id: string
  qty: number
  total: number
  cogs?: number
  product?: string
  parcel_status: string
  payment_status: string
  date: string
  created_at?: string
}

export interface FinancialMetrics {
  totalOrders: number
  totalQuantity: number
  totalRevenue: number
  totalCOGS: number
  totalProfit: number
  profitMargin: number
}

/**
 * Parcel statuses that should be EXCLUDED from revenue calculations
 * 
 * CANCELLED - Order was cancelled, no revenue
 * RETURNED - Order was returned, revenue reversed
 * PROBLEMATIC - Order has issues, excluded from revenue
 * DETAINED - Order detained by carrier, excluded from revenue
 */
export const EXCLUDED_STATUSES = ['CANCELLED', 'RETURNED', 'PROBLEMATIC', 'DETAINED']

/**
 * Parcel statuses that represent confirmed revenue
 */
export const CONFIRMED_REVENUE_STATUSES = ['DELIVERED']

/**
 * Parcel statuses that represent pending/in-progress revenue
 * PENDING is included here because if order is in Track Orders (status='Packed'),
 * it means it's packed and ready, so it counts as revenue
 */
export const PENDING_REVENUE_STATUSES = ['PENDING', 'IN TRANSIT', 'ON DELIVERY', 'PICKUP']

/**
 * Parcel statuses that may need special handling
 * DETAINED is EXCLUDED from revenue (uncertain delivery outcome)
 * PROBLEMATIC is EXCLUDED from revenue
 */
export const PROBLEMATIC_STATUSES = ['PROBLEMATIC', 'DETAINED'] // Both excluded from revenue

/**
 * Filter orders to only include those that should count toward revenue
 * 
 * @param orders - Array of orders
 * @param includeMode - 'delivered' (most conservative), 'active' (all non-cancelled/returned), 'all' (everything)
 * @returns Filtered orders
 */
export function filterRevenueOrders(
  orders: Order[],
  includeMode: 'delivered' | 'active' | 'all' = 'active'
): Order[] {
  if (includeMode === 'all') {
    return orders
  }

  if (includeMode === 'delivered') {
    // Most conservative: Only confirmed delivered orders
    return orders.filter(order => 
      CONFIRMED_REVENUE_STATUSES.includes(order.parcel_status)
    )
  }

  // Default 'active': Exclude cancelled and returned
  return orders.filter(order => 
    !EXCLUDED_STATUSES.includes(order.parcel_status)
  )
}

/**
 * Calculate financial metrics from orders
 * 
 * CRITICAL: Uses ACTUAL COGS from each order, not percentage-based calculation.
 * This ensures accuracy when orders have:
 * - Custom pricing
 * - Discounts
 * - Different product margins
 * - Adjusted amounts
 * 
 * @param orders - Array of orders (should be pre-filtered)
 * @returns Financial metrics based on actual order data
 */
export function calculateFinancialMetrics(
  orders: Order[]
): FinancialMetrics {
  const totalOrders = orders.length
  const totalQuantity = orders.reduce((sum, order) => sum + (order.qty || 0), 0)
  const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0)
  
  // Use ACTUAL COGS from each order, not percentage calculation
  const totalCOGS = orders.reduce((sum, order) => sum + (order.cogs || 0), 0)
  
  const totalProfit = totalRevenue - totalCOGS
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  return {
    totalOrders,
    totalQuantity,
    totalRevenue,
    totalCOGS,
    totalProfit,
    profitMargin,
  }
}

/**
 * Calculate metrics for a specific parcel status
 */
export function calculateStatusMetrics(
  orders: Order[],
  status: string
): FinancialMetrics {
  const statusOrders = orders.filter(o => o.parcel_status === status)
  return calculateFinancialMetrics(statusOrders)
}

/**
 * Calculate metrics grouped by payment status
 */
export function calculateByPaymentStatus(
  orders: Order[]
): Record<string, FinancialMetrics> {
  const grouped: Record<string, Order[]> = {}

  orders.forEach(order => {
    const status = order.payment_status || 'unknown'
    if (!grouped[status]) {
      grouped[status] = []
    }
    grouped[status].push(order)
  })

  const result: Record<string, FinancialMetrics> = {}
  Object.keys(grouped).forEach(status => {
    result[status] = calculateFinancialMetrics(grouped[status])
  })

  return result
}

/**
 * Get a summary of excluded orders for reporting
 */
export function getExcludedOrdersSummary(orders: Order[]): {
  cancelled: FinancialMetrics
  returned: FinancialMetrics
  total: FinancialMetrics
} {
  const cancelled = orders.filter(o => o.parcel_status === 'CANCELLED')
  const returned = orders.filter(o => o.parcel_status === 'RETURNED')
  const allExcluded = [...cancelled, ...returned]

  return {
    cancelled: calculateFinancialMetrics(cancelled),
    returned: calculateFinancialMetrics(returned),
    total: calculateFinancialMetrics(allExcluded),
  }
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = '₱'): string {
  return `${currency}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`
}
