'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Package, Search, Download, XCircle, Eye, Copy, CheckCircle, AlertCircle,
  Calendar, Filter, Truck, DollarSign, ShoppingCart, TrendingUp, RefreshCw,
  MoreVertical, FileText
} from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost } from '@/lib/api-client'
import { formatPhilippinesDateTime } from '@/lib/timezone-utils'
import { getCurrentUser } from '@/lib/auth'
import { EnterpriseDateRangePicker } from '@/components/ui/enterprise-date-range-picker'
import { TablePagination } from '@/components/ui/table-pagination'
import * as XLSX from 'xlsx'

interface Order {
  id: string
  date: string
  qty: number
  cogs: number
  total: number
  product: string
  dispatched_by: string
  waybill_number: string | null
  is_cancelled: boolean
  cancelled_at: string | null
  cancelled_by: string | null
  cancellation_reason: string | null
  created_at: string
}

interface OrderStats {
  total: number
  active: number
  cancelled: number
  totalRevenue: number
  todayCount: number
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<OrderStats>({
    total: 0, active: 0, cancelled: 0, totalRevenue: 0, todayCount: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // Date range state
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const currentUser = getCurrentUser()

  useEffect(() => { fetchOrders() }, [statusFilter, startDate, endDate])
  useEffect(() => { 
    applyFilters()
    setCurrentPage(1) // Reset to first page when filters change
  }, [searchTerm, orders])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (startDate) params.append('startDate', startDate.toISOString())
      if (endDate) params.append('endDate', endDate.toISOString())
      const response = await apiGet<{ orders: Order[], stats: OrderStats }>(`/api/orders-management?${params.toString()}`)
      setOrders(response.orders)
      setFilteredOrders(response.orders)
      setStats(response.stats)
    } catch (error) {
      console.error('Error fetching orders:', error)
      toast.error('Failed to fetch orders')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...orders]
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(order =>
        order.id.toLowerCase().includes(search) ||
        order.product.toLowerCase().includes(search) ||
        order.waybill_number?.toLowerCase().includes(search) ||
        order.dispatched_by?.toLowerCase().includes(search)
      )
    }
    setFilteredOrders(filtered)
  }

  const handleCancelOrder = async () => {
    if (!selectedOrder || !cancelReason.trim()) {
      toast.error('Please provide a cancellation reason')
      return
    }
    try {
      setCancelling(true)
      await apiPost(`/api/orders-management/${selectedOrder.id}/cancel`, {
        reason: cancelReason,
        cancelledBy: currentUser?.displayName || 'Admin'
      })
      toast.success('Order cancelled successfully')
      setCancelModalOpen(false)
      setCancelReason('')
      setSelectedOrder(null)
      fetchOrders()
    } catch (error: any) {
      console.error('Error cancelling order:', error)
      toast.error(error.message || 'Failed to cancel order')
    } finally {
      setCancelling(false)
    }
  }

  const handleBulkCancel = async () => {
    if (selectedOrders.length === 0) {
      toast.error('No orders selected')
      return
    }
    if (!confirm(`Cancel ${selectedOrders.length} orders?`)) return
    const reason = prompt('Enter cancellation reason:')
    if (!reason) return
    try {
      for (const orderId of selectedOrders) {
        await apiPost(`/api/orders-management/${orderId}/cancel`, {
          reason,
          cancelledBy: currentUser?.displayName || 'Admin'
        })
      }
      toast.success(`${selectedOrders.length} orders cancelled`)
      setSelectedOrders([])
      fetchOrders()
    } catch (error) {
      toast.error('Failed to cancel some orders')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const exportToExcel = () => {
    const exportData = filteredOrders.map(order => ({
      'Order ID': order.id,
      'Date': formatPhilippinesDateTime(order.date),
      'Products': order.product,
      'Quantity': order.qty,
      'COGS': order.cogs,
      'Total': order.total,
      'Waybill': order.waybill_number || 'N/A',
      'Dispatched By': order.dispatched_by,
      'Status': order.is_cancelled ? 'Cancelled' : 'Active',
      'Cancelled By': order.cancelled_by || '',
      'Cancellation Reason': order.cancellation_reason || ''
    }))
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Orders')
    XLSX.writeFile(wb, `orders_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('Exported successfully')
  }

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Calculate pagination
  const totalPages = Math.ceil(filteredOrders.length / pageSize)
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="relative">
            <Package className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <RefreshCw className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin absolute top-4 left-1/2 -ml-4" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-semibold gradient-text">Orders Management</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Track and manage your dispatched orders efficiently</p>
          </div>
          <div className="flex items-center gap-3 sm:flex-shrink-0">
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

        {/* Stats Cards - Enterprise Grade */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {/* Total Orders */}
          <Card className="p-5 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-600 shadow-lg shadow-blue-500/30 flex-shrink-0">
                <ShoppingCart className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Total Orders</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 tabular-nums">{stats.total}</p>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">All time</p>
              </div>
            </div>
          </Card>

          {/* Active Orders */}
          <Card className="p-5 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-600 shadow-lg shadow-emerald-500/30 flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Active</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 tabular-nums">{stats.active}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">In transit</p>
              </div>
            </div>
          </Card>

          {/* Cancelled Orders */}
          <Card className="p-5 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-600 shadow-lg shadow-red-500/30 flex-shrink-0">
                <XCircle className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Cancelled</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100 tabular-nums">{stats.cancelled}</p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                  {stats.cancelled > 0 ? (
                    <><AlertCircle className="h-3 w-3 inline mr-0.5" />Restocked</>
                  ) : 'No cancellations'}
                </p>
              </div>
            </div>
          </Card>

          {/* Today's Orders */}
          <Card className="p-5 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-600 shadow-lg shadow-purple-500/30 flex-shrink-0">
                <Calendar className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Today</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 tabular-nums">{stats.todayCount}</p>
                <p className="text-xs text-purple-600 dark:text-purple-500 mt-0.5">
                  {stats.todayCount > 0 ? 'Orders dispatched' : 'No orders yet'}
                </p>
              </div>
            </div>
          </Card>

          {/* Total Revenue */}
          <Card className="p-5 border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/40 flex-shrink-0">
                <DollarSign className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Revenue</p>
                <p className="text-xl font-bold text-amber-900 dark:text-amber-100 tabular-nums">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-xs text-amber-700 dark:text-amber-600 mt-0.5">
                  {stats.totalRevenue > 0 ? (
                    <><TrendingUp className="h-3 w-3 inline mr-0.5" />Total earnings</>
                  ) : 'No revenue yet'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800/50">
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-12"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-[200px] h-12">
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="cancelled">Cancelled Only</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-3">
                <Button 
                  onClick={exportToExcel} 
                  size="sm"
                  className="h-12 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold gap-2 shadow-sm"
                >
                  <Download className="h-4 w-4" />
                  Export Excel
                </Button>
                {selectedOrders.length > 0 && (
                  <Button onClick={handleBulkCancel} variant="destructive" className="gap-2 h-12 px-4 font-semibold">
                    <XCircle className="h-4 w-4" />
                    Cancel ({selectedOrders.length})
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shopify-Style Table */}
        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <Package className="h-5 w-5 text-white" strokeWidth={2.5} />
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Orders</h2>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">{filteredOrders.length} total orders</p>
                {selectedOrders.length > 0 && (
                  <>
                    <div className="h-4 w-px bg-slate-300 dark:bg-slate-600"></div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{selectedOrders.length} selected</span>
                      <Button onClick={handleBulkCancel} size="sm" variant="destructive" className="h-8">
                        <XCircle className="h-3.5 w-3.5 mr-1.5" />
                        Cancel Selected
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="overflow-hidden border border-slate-200/60 dark:border-slate-700/60">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black border-b border-slate-700/50">
                    <th className="text-center py-3 px-4 w-[50px]">
                      <Checkbox
                        checked={selectedOrders.length === filteredOrders.filter(o => !o.is_cancelled).length && filteredOrders.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedOrders(filteredOrders.filter(o => !o.is_cancelled).map(o => o.id))
                          } else {
                            setSelectedOrders([])
                          }
                        }}
                        className="h-3.5 w-3.5"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-bold text-white uppercase tracking-wider w-[140px]">Date & Time</th>
                    <th className="text-left py-3 px-4 text-[10px] font-bold text-white uppercase tracking-wider w-[100px]">ID</th>
                    <th className="text-left py-3 px-4 text-[10px] font-bold text-white uppercase tracking-wider w-[240px]">Products</th>
                    <th className="text-center py-3 px-4 text-[10px] font-bold text-white uppercase tracking-wider w-[100px]">Quantity</th>
                    <th className="text-right py-3 px-4 text-[10px] font-bold text-white uppercase tracking-wider w-[120px]">Price</th>
                    <th className="text-center py-3 px-4 text-[10px] font-bold text-white uppercase tracking-wider w-[140px]">Waybill</th>
                    <th className="text-center py-3 px-4 text-[10px] font-bold text-white uppercase tracking-wider w-[100px]">Status</th>
                    <th className="text-center py-3 px-3 text-[10px] font-bold text-white uppercase tracking-wider w-[70px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/50">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-20">
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-14 w-14 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center">
                            <Package className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No orders found</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Try adjusting your search or filters</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 text-center">
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedOrders([...selectedOrders, order.id])
                              } else {
                                setSelectedOrders(selectedOrders.filter(id => id !== order.id))
                              }
                            }}
                            disabled={order.is_cancelled}
                            className="h-3.5 w-3.5"
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex-shrink-0">
                              <Calendar className="h-4 w-4 text-slate-400" />
                            </div>
                            <div>
                              <p className="text-[12px] font-medium text-slate-900 dark:text-white leading-tight whitespace-nowrap">{formatPhilippinesDateTime(order.date).split(',')[0]}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap">{formatPhilippinesDateTime(order.date).split(',')[1]}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                              #{order.id.slice(0, 8)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="text-[13px] font-medium text-slate-900 dark:text-white">{order.product}</p>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                            <Package className="h-3 w-3 text-slate-500" />
                            <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">{order.qty}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <p className="text-[13px] font-semibold text-slate-900 dark:text-white whitespace-nowrap">{formatCurrency(order.total)}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap">COGS: {formatCurrency(order.cogs)}</p>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {order.waybill_number ? (
                            <button
                              onClick={() => copyToClipboard(order.waybill_number!)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            >
                              <Truck className="h-3.5 w-3.5" />
                              <span className="font-mono text-[11px] font-medium whitespace-nowrap">{order.waybill_number}</span>
                              <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex justify-center">
                            {order.is_cancelled ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
                                <span className="h-1 w-1 rounded-full bg-red-600"></span>
                                Cancelled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20">
                                <span className="h-1 w-1 rounded-full bg-emerald-600"></span>
                                Active
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex justify-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-slate-100 dark:hover:bg-slate-800">
                                  <MoreVertical className="h-4 w-4 text-slate-400" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => { setSelectedOrder(order); setDetailsModalOpen(true) }} className="text-sm cursor-pointer">
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {!order.is_cancelled && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => { setSelectedOrder(order); setCancelModalOpen(true) }} className="text-sm cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400">
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Cancel Order
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Footer */}
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredOrders.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setCurrentPage(1)
              }}
            />
          </div>
        </Card>

        {/* Details Modal */}
        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
              <DialogDescription>Complete order information</DialogDescription>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Waybill</p>
                    <p className="font-mono font-semibold">{selectedOrder.waybill_number || 'No waybill'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Date</p>
                    <p className="font-semibold">{formatPhilippinesDateTime(selectedOrder.date)}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-1">Total</p>
                    <p className="text-xl font-bold text-emerald-700">{formatCurrency(selectedOrder.total)}</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">COGS</p>
                    <p className="font-semibold">{formatCurrency(selectedOrder.cogs)}</p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-400 mb-1">Profit</p>
                    <p className="text-xl font-bold text-blue-700">{formatCurrency(selectedOrder.total - selectedOrder.cogs)}</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Quantity</p>
                    <p className="font-semibold">{selectedOrder.qty} items</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-2">Products</p>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-sm">{selectedOrder.product}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-2">Order ID</p>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="font-mono text-sm">{selectedOrder.id}</p>
                  </div>
                </div>
                {selectedOrder.is_cancelled && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200">
                    <h3 className="font-bold text-red-700 mb-2">Cancellation Info</h3>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-red-600">By:</span> {selectedOrder.cancelled_by}</p>
                      <p><span className="text-red-600">At:</span> {selectedOrder.cancelled_at ? formatPhilippinesDateTime(selectedOrder.cancelled_at) : 'N/A'}</p>
                      <p><span className="text-red-600">Reason:</span> {selectedOrder.cancellation_reason}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Cancel Modal */}
        <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-600">Cancel Order</DialogTitle>
              <DialogDescription>This will restock inventory automatically</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedOrder && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-sm font-medium">Order: {selectedOrder.id}</p>
                  <p className="text-sm text-slate-600">{selectedOrder.product}</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-2">{formatCurrency(selectedOrder.total)}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-2 block">Cancellation Reason *</label>
                <Input
                  placeholder="E.g., Customer requested cancellation"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-700">
                <AlertCircle className="h-4 w-4" />
                <span>Inventory will be automatically restocked</span>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => { setCancelModalOpen(false); setCancelReason(''); setSelectedOrder(null) }}
                  variant="outline"
                  className="flex-1"
                  disabled={cancelling}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCancelOrder}
                  variant="destructive"
                  className="flex-1"
                  disabled={cancelling || !cancelReason.trim()}
                >
                  {cancelling ? 'Cancelling...' : 'Confirm'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
