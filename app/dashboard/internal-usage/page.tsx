"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Package, TrendingDown, Building2, Search, RefreshCw, RotateCcw } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { apiGet, apiPost } from "@/lib/api-client"
import { UseItemModal } from "@/components/internal-usage/use-item-modal"
import { ReturnDemoItemsModal } from "@/components/internal-usage/return-demo-items-modal"
import { toast } from "sonner"

interface UsageRecord {
  id: string
  department: string
  usage_type: string
  reason: string
  notes?: string
  items: Array<{
    itemId: string
    itemName: string
    quantity: number
    costPrice: number
    totalCost: number
  }>
  total_cost: number
  total_qty: number
  recorded_by: string
  created_at: string
  returned_items?: Record<string, { returned: number; total: number }>
  return_status?: string
  last_return_date?: string
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  demo:     { label: 'Demo / Display', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  internal: { label: 'Internal Use',   color: 'bg-blue-100 text-blue-700 border-blue-200' },
}

export default function InternalUsagePage() {
  const [records, setRecords]       = useState<UsageRecord[]>([])
  const [loading, setLoading]       = useState(true)
  const [modalOpen, setModalOpen]   = useState(false)
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [selectedRecordForReturn, setSelectedRecordForReturn] = useState<UsageRecord | null>(null)
  const [search, setSearch]         = useState("")
  const [typeFilter, setTypeFilter] = useState("all")

  const fetchRecords = async () => {
    try {
      setLoading(true)
      const data = await apiGet<UsageRecord[]>("/api/internal-usage")
      console.log('[Internal Usage] API response:', data)
      setRecords(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching internal usage:", error)
      toast.error("Failed to load records")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRecords() }, [])

  const handleReturnClick = (record: UsageRecord) => {
    setSelectedRecordForReturn(record)
    setReturnModalOpen(true)
  }

  const filteredRecords = records.filter(r => {
    const matchesSearch =
      r.items?.some(i => i.itemName?.toLowerCase().includes(search.toLowerCase())) ||
      r.department?.toLowerCase().includes(search.toLowerCase()) ||
      r.usage_type?.toLowerCase().includes(search.toLowerCase()) ||
      r.reason?.toLowerCase().includes(search.toLowerCase())

    const matchesType = typeFilter === "all" || r.usage_type === typeFilter

    return matchesSearch && matchesType
  })

  // KPI calculations - transfer removed
  const totalRecords  = records.length
  const totalCost     = records.reduce((sum, r) => sum + (r.total_cost || 0), 0)
  const totalQty      = records.reduce((sum, r) => sum + (r.total_qty || 0), 0)
  const demoCount     = records.filter(r => r.usage_type === 'demo').length
  const internalCount = records.filter(r => r.usage_type === 'internal').length

  const formatDate = (ts: string) => {
    if (!ts) return '—'
    return new Date(ts).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const formatTime = (ts: string) => {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold gradient-text">Internal Usage</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track items used for demo, display, and internal consumption
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => setModalOpen(true)} 
            className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
          >
            <Plus className="mr-2 h-4 w-4" />
            Use Item
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-100">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Records</p>
                <p className="text-2xl font-bold text-slate-900">{totalRecords}</p>
                <p className="text-xs text-slate-500 mt-0.5">{totalQty} units total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-100">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Cost</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalCost)}</p>
                <p className="text-xs text-slate-500 mt-0.5">demo & internal only</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-100">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Demo / Display</p>
                <p className="text-2xl font-bold text-slate-900">{demoCount}</p>
                <p className="text-xs text-slate-500 mt-0.5">records</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-100">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Internal Use</p>
                <p className="text-2xl font-bold text-slate-900">{internalCount}</p>
                <p className="text-xs text-slate-500 mt-0.5">records</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Card */}
      <Card className="border-0 shadow-lg overflow-hidden">
        {/* Table Toolbar */}
        <div className="px-6 py-4 border-b bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search items, department, type..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 w-64 bg-slate-50 border-slate-200 text-sm focus:bg-white"
              />
            </div>
            {/* Type Filter Dropdown */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 w-44 bg-slate-50 border-slate-200 text-sm">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="demo">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                    Demo / Display
                  </span>
                </SelectItem>
                <SelectItem value="internal">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    Internal Use
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">
              {filteredRecords.length} of {records.length} records
            </span>
            <button
              onClick={fetchRecords}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black border-b border-slate-700/50">
                <th className="text-left pl-6 pr-4 py-3 w-[9%]">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Date & Time</span>
                </th>
                <th className="text-left px-4 py-3 w-[20%]">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Items</span>
                </th>
                <th className="text-left px-4 py-3 w-[10%]">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Requested By</span>
                </th>
                <th className="text-left px-4 py-3 w-[9%]">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Department</span>
                </th>
                <th className="text-left px-4 py-3 w-[10%]">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Type</span>
                </th>
                <th className="text-left px-4 py-3 w-[11%]">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Return Status</span>
                </th>
                <th className="text-left px-4 py-3 w-[9%]">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Last Return</span>
                </th>
                <th className="text-right px-4 py-3 w-[6%]">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Qty</span>
                </th>
                <th className="text-right px-4 py-3 w-[7%]">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Total Cost</span>
                </th>
                <th className="text-center pl-4 pr-6 py-3 w-[9%]">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-20">
                    <div className="inline-flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent" />
                      <p className="text-sm text-slate-500 font-medium">Loading records...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-20">
                    <div className="inline-flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                        <Package className="h-8 w-8 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">No records found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {search ? 'Try a different search term' : 'Click "Use Item" to record your first usage'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, idx) => {
                  const typeInfo = TYPE_LABELS[record.usage_type] || { label: record.usage_type, color: 'bg-slate-100 text-slate-600 border-slate-200' }
                  const itemNames = record.items?.map(i => i.itemName).join(', ') || '—'
                  const isEven = idx % 2 === 0

                  return (
                    <tr
                      key={record.id || idx}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Date */}
                      <td className="pl-6 pr-4 py-3.5 whitespace-nowrap">
                        <div className="text-[12px] font-medium text-slate-900 dark:text-white leading-tight">{formatDate(record.created_at)}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{formatTime(record.created_at)}</div>
                      </td>

                      {/* Items */}
                      <td className="px-4 py-3.5">
                        <div className="text-[13px] font-medium text-slate-900 dark:text-white" title={itemNames}>
                          {itemNames}
                        </div>
                        {record.notes && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1" title={record.notes}>
                            {record.notes}
                          </div>
                        )}
                      </td>

                      {/* Requested By */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                              {record.reason?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <span className="text-[12px] font-medium text-slate-700 dark:text-slate-300">{record.reason || '—'}</span>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {/* Department icon */}
                          {(() => {
                            const icons: Record<string, string> = {
                              'Facebook': '/facebook.png',
                              'TikTok': '/tiktok.png',
                              'Shopee': '/Shopee.png',
                              'Lazada': '/Lazada.png',
                              'Office': '/Corporate Building.png'
                            }
                            const icon = icons[record.department]
                            return icon ? (
                              <img src={icon} alt={record.department} className="w-5 h-5 object-contain flex-shrink-0" />
                            ) : null
                          })()}
                          <span className="text-[13px] font-semibold text-slate-800 dark:text-white">{record.department}</span>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </td>

                      {/* Return Status - Only for demo/display */}
                      <td className="px-4 py-3.5">
                        {record.usage_type === 'demo' ? (
                          (() => {
                            const returnStatus = record.return_status || 'pending'
                            const returned_items = record.returned_items || {}
                            
                            // Calculate total returned vs total requested
                            let totalReturned = 0
                            let totalRequested = 0
                            for (const item of record.items) {
                              totalRequested += item.quantity
                              totalReturned += returned_items[item.itemId]?.returned || 0
                            }

                            let badgeColor = ''
                            let badgeText = ''
                            
                            if (returnStatus === 'completed' || totalReturned >= totalRequested) {
                              badgeColor = 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              badgeText = 'All items returned'
                            } else if (returnStatus === 'partial') {
                              badgeColor = 'bg-amber-100 text-amber-700 border-amber-200'
                              badgeText = `${totalReturned}/${totalRequested} returned`
                            } else {
                              badgeColor = 'bg-red-100 text-red-700 border-red-200'
                              badgeText = `${totalReturned}/${totalRequested} returned`
                            }

                            return (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border ${badgeColor}`}>
                                {badgeText}
                              </span>
                            )
                          })()
                        ) : (
                          <span className="text-[12px] text-slate-400">—</span>
                        )}
                      </td>

                      {/* Last Return Date - Only for demo/display */}
                      <td className="px-4 py-3.5">
                        {record.usage_type === 'demo' && record.last_return_date ? (
                          <div>
                            <div className="text-[12px] font-medium text-slate-900 dark:text-white leading-tight">
                              {formatDate(record.last_return_date)}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {formatTime(record.last_return_date)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[12px] text-slate-400">—</span>
                        )}
                      </td>

                      {/* Qty */}
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-[13px] font-bold text-slate-900 dark:text-white tabular-nums">{record.total_qty}</span>
                        <span className="text-[10px] text-slate-400 ml-1">units</span>
                      </td>

                      {/* Cost */}
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-[13px] font-bold text-red-600 dark:text-red-400 tabular-nums">
                          {formatCurrency(record.total_cost || 0)}
                        </span>
                      </td>

                      {/* Actions - Only for demo/display that haven't been fully returned */}
                      <td className="pl-4 pr-6 py-3.5 text-center">
                        {record.usage_type === 'demo' ? (
                          (() => {
                            const returned_items = record.returned_items || {}
                            const allReturned = record.items.every(item => {
                              const returnInfo = returned_items[item.itemId]
                              return returnInfo && returnInfo.returned >= item.quantity
                            })

                            if (allReturned) {
                              return <span className="text-[11px] text-slate-400">—</span>
                            }

                            return (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReturnClick(record)}
                                className="h-7 px-3 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 hover:border-emerald-300 font-semibold"
                              >
                                <RotateCcw className="h-3 w-3 mr-1.5" />
                                Return
                              </Button>
                            )
                          })()
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!loading && records.length > 0 && (
          <div className="px-6 py-3 border-t bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{filteredRecords.length}</span> of <span className="font-semibold text-slate-700">{records.length}</span> records
            </span>
            <span className="text-xs text-slate-500">
              Total: <span className="font-bold text-red-600">{formatCurrency(filteredRecords.reduce((s, r) => s + (r.total_cost || 0), 0))}</span>
            </span>
          </div>
        )}
      </Card>

      {/* Modals */}
      <UseItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          setModalOpen(false)
          fetchRecords()
        }}
      />

      {/* Return Modal - Opens for specific record */}
      {selectedRecordForReturn && (
        <ReturnDemoItemsModal
          open={returnModalOpen}
          onClose={() => {
            setReturnModalOpen(false)
            setSelectedRecordForReturn(null)
          }}
          onSuccess={() => {
            setReturnModalOpen(false)
            setSelectedRecordForReturn(null)
            fetchRecords()
          }}
          preselectedRecord={selectedRecordForReturn}
        />
      )}
    </div>
  )
}
