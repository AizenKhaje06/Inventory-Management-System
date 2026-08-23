export interface InventoryItem {
  id: string
  name: string
  category: string
  quantity: number
  costPrice: number
  sellingPrice: number
  reorderLevel: number
  lastUpdated: string
  totalCOGS: number
  sku?: string
  images?: string[]
  imageUrl?: string | null
  productType?: 'regular' | 'bundle'
  // Bad Item Tracking
  item_status?: 'good' | 'bad'
  bad_item_reason?: string
  bad_item_quantity?: number
  bad_items_breakdown?: Record<string, number>
}

export interface Transaction {
  id: string
  itemId: string
  itemName: string
  quantity: number
  costPrice: number
  sellingPrice: number
  totalCost: number
  totalRevenue: number
  profit: number
  timestamp: string
  type: "sale" | "restock"
  staffName?: string
  notes?: string
  waybillNumber?: string
}

export interface BusinessContact {
  id: string
  name: string // Company name or individual name
  companyName?: string
  contactPerson?: string
  contactType: 'supplier' | 'distributor' | 'reseller'
  position?: string
  email?: string
  phone?: string
  address?: string
  notes?: string
  createdAt: string
}

// Legacy Customer interface - kept for backward compatibility
export interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
  loyaltyPoints: number
  totalPurchases: number
  totalSpent: number
  lastPurchase?: string
  createdAt: string
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum'
  notes?: string
}

export interface Promotion {
  id: string
  name: string
  description: string
  type: 'percentage' | 'fixed' | 'bogo' | 'bundle'
  value: number
  startDate: string
  endDate: string
  applicableItems?: string[] // Item IDs
  applicableCategories?: string[]
  minPurchase?: number
  maxDiscount?: number
  active: boolean
  usageCount: number
  createdAt: string
}

export interface DailySales {
  date: string
  revenue: number
  itemsSold: number
  profit: number
}

export interface MonthlySales {
  month: string
  revenue: number
  itemsSold: number
  profit: number
}

export interface SalesReport {
  totalRevenue: number
  totalCost: number
  totalProfit: number
  profitMargin: number
  itemsSold: number
  totalOrders: number
  transactions: Transaction[]
  dailySales?: DailySales[]
  monthlySales?: MonthlySales[]
  salesOverTime?: { date: string; revenue: number }[]
}

export interface DashboardStats {
  totalItems: number
  lowStockItems: number
  totalValue: number
  recentSales: number
  totalRevenue: number
  totalCost: number
  totalProfit: number
  profitMargin: number
  totalTransactions: number
  salesOverTime: { date: string; purchases: number; sales: number; quantity: number }[]
  topProducts: { name: string; sales: number; revenue: number }[]
  recentTransactions: Transaction[]
  topCategories: { name: string; sales: number }[]
  totalCategories: number
  totalProducts: number
  stockPercentageByCategory: { name: string; percentage: number }[]
  stocksCountByCategory: { name: string; count: number }[]
  stocksCountByStore: { name: string; count: number }[] // Sales channel performance (revenue)
  storePerformance?: { name: string; count: number }[] // Actual store performance (inventory value)
  totalCustomers?: number
  topCustomers?: { name: string; spent: number }[]
  averageOrderValue?: number
  returnRate?: number
  damagedReturnRate?: number
  supplierReturnRate?: number
  totalSales?: number
  totalReturns?: number
  returnValue?: number
  itemsSoldToday?: number
  revenueToday?: number
  supplierReturns?: { itemName: string; quantity: number; value: number }[]
  recentRestocks?: any[]
  outOfStockCount?: number
  inventoryHealthScore?: number
  insights?: { type: string; message: string }[]
  salesVelocity?: number
  yesterdaySales?: number
  lastWeekSales?: number
  lastMonthSales?: number
  yesterdayQuantity?: number
  lastWeekQuantity?: number
  lastMonthQuantity?: number
  // Cancelled orders tracking
  totalCancelledOrders?: number
  cancelledOrdersValue?: number
  cancellationRate?: number
  topCancellationReasons?: { reason: string; count: number }[]
  cancelledOrdersByChannel?: { channel: string; count: number; value: number }[]
  returnsByItem?: { name: string; count: number; value: number }[] // Return Count by Item
  cancelledPackingQueue?: number // Cancelled in packing queue (before packing)
  cancelledTrackOrders?: number // Cancelled in track orders (after packing)
  totalDelivered?: number // Total orders with status 'delivered'
  deliveredPercentage?: number // Percentage of delivered orders out of total orders
}

export interface Log {
  id: string
  operation: string
  itemId?: string
  itemName?: string
  details: string
  timestamp: string
  staffName?: string
  quantity?: number // NEW: Quantity for inventory restoration
  // Transaction status tracking
  status?: "completed" | "cancelled" | "returned" | "pending"
  cancellationReason?: string
  cancelledBy?: string
  cancelledAt?: string
}

export interface Restock {
  id: string
  itemId: string
  itemName: string
  quantity: number
  costPrice: number
  totalCost: number
  timestamp: string
  reason: string
}

export interface PredictiveAnalytics {
  itemId: string
  itemName: string
  predictedDemand: number
  recommendedReorderQty: number
  predictedStockoutDate?: string
  confidence: number
  trend: 'increasing' | 'decreasing' | 'stable'
}

export interface ABCAnalysis {
  itemId: string
  itemName: string
  category: 'A' | 'B' | 'C'
  revenueContribution: number
  cumulativePercentage: number
  recommendation: string
}

export interface InventoryTurnover {
  itemId: string
  itemName: string
  turnoverRatio: number
  daysToSell: number
  status: 'fast-moving' | 'normal' | 'slow-moving' | 'dead-stock'
}

