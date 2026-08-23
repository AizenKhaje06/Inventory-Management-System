/**
 * Orders to Transactions Transformation Layer
 * 
 * This file transforms orders data (new system) to transaction format (legacy)
 * to maintain backward compatibility with existing analytics functions.
 */

import type { Transaction } from './types'
import type { Order } from './supabase-db'

/**
 * Normalize product name to match inventory item names
 * Strips quantity suffixes like "(1)", "(2)" etc.
 */
function normalizeProductName(product: string): string {
  if (!product) return ''
  return product
    .replace(/\s*\(\d+\)\s*$/, '') // remove "(qty)" suffix
    .replace(/\s*x\d+\s*$/i, '')   // remove "x2" suffix
    .trim()
}

/**
 * Transform orders to transaction format for analytics
 * Uses product name matching to link orders to inventory items.
 */
export function transformOrdersToTransactions(orders: Order[], items?: any[]): Transaction[] {
  return orders
    .filter(order => {
      // Exclude cancelled and returned orders from analytics
      const excludedStatuses = ['CANCELLED', 'RETURNED']
      return !excludedStatuses.includes(order.parcel_status?.toUpperCase())
    })
    .flatMap(order => {
      const quantity = order.qty || 1
      const costPerUnit = (order.cogs || 0) / quantity
      const sellPerUnit = (order.total || 0) / quantity
      const profit = (order.total || 0) - (order.cogs || 0)

      // If no items list, fallback to a single transaction with order ID
      if (!items || items.length === 0) {
        const normalizedProduct = normalizeProductName(order.product || '')
        return [{
          id: order.id,
          itemId: order.id,
          itemName: normalizedProduct || order.product,
          quantity,
          costPrice: costPerUnit,
          sellingPrice: sellPerUnit,
          totalCost: order.cogs || 0,
          totalRevenue: order.total || 0,
          profit,
          timestamp: order.date,
          type: 'sale' as const,
          transactionType: 'sale' as const,
          department: order.sales_channel,
          status: 'completed' as const,
          staffName: order.dispatched_by,
          notes: `Order ${order.id} - ${order.product}`
        }]
      }

      // Split comma-separated product list: "Berry Soap (1), Aloe Cream (2)"
      const productParts = (order.product || '').split(',').map(p => p.trim()).filter(Boolean)

      // Try to match each product part to an inventory item
      const matched: Transaction[] = []

      for (const part of productParts) {
        const normalizedPart = normalizeProductName(part)

        // Find matching inventory item - try exact match first, then partial
        const matchedItem = items.find(item => {
          const itemName = normalizeProductName(item.name || '').toLowerCase()
          const partLower = normalizedPart.toLowerCase()
          return itemName === partLower || itemName.includes(partLower) || partLower.includes(itemName)
        })

        const itemId = matchedItem ? matchedItem.id : order.id  // fallback to order ID

        matched.push({
          id: `${order.id}-${normalizedPart.slice(0, 8)}`,
          itemId,
          itemName: matchedItem?.name || normalizedPart || order.product,
          quantity,
          costPrice: costPerUnit,
          sellingPrice: sellPerUnit,
          totalCost: order.cogs || 0,
          totalRevenue: order.total || 0,
          profit,
          timestamp: order.date,
          type: 'sale' as const,
          transactionType: 'sale' as const,
          department: order.sales_channel,
          status: 'completed' as const,
          staffName: order.dispatched_by,
          notes: `Order ${order.id} - ${order.product}`
        })
      }

      // If no parts matched, return a single fallback transaction
      if (matched.length === 0) {
        const normalizedProduct = normalizeProductName(order.product || '')
        return [{
          id: order.id,
          itemId: order.id,
          itemName: normalizedProduct || order.product,
          quantity,
          costPrice: costPerUnit,
          sellingPrice: sellPerUnit,
          totalCost: order.cogs || 0,
          totalRevenue: order.total || 0,
          profit,
          timestamp: order.date,
          type: 'sale' as const,
          transactionType: 'sale' as const,
          department: order.sales_channel,
          status: 'completed' as const,
          staffName: order.dispatched_by,
          notes: `Order ${order.id} - ${order.product}`
        }]
      }

      return matched
    })
}

/**
 * Filter orders by date range
 */
export function filterOrdersByDateRange(
  orders: Order[],
  startDate?: string,
  endDate?: string
): Order[] {
  let filtered = orders

  if (startDate) {
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    filtered = filtered.filter(order => new Date(order.date) >= start)
  }

  if (endDate) {
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    filtered = filtered.filter(order => new Date(order.date) <= end)
  }

  return filtered
}

/**
 * Get orders summary statistics
 */
export function getOrdersSummary(orders: Order[]) {
  const activeOrders = orders.filter(order => 
    !['CANCELLED', 'RETURNED'].includes(order.parcel_status?.toUpperCase())
  )

  return {
    total: orders.length,
    active: activeOrders.length,
    cancelled: orders.filter(o => o.parcel_status?.toUpperCase() === 'CANCELLED').length,
    returned: orders.filter(o => o.parcel_status?.toUpperCase() === 'RETURNED').length,
    totalRevenue: activeOrders.reduce((sum, o) => sum + o.total, 0),
    totalCost: activeOrders.reduce((sum, o) => sum + o.cogs, 0),
    totalProfit: activeOrders.reduce((sum, o) => sum + (o.total - o.cogs), 0),
    totalQuantity: activeOrders.reduce((sum, o) => sum + o.qty, 0)
  }
}
