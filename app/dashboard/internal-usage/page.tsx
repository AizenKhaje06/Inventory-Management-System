"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Plus, Package, TrendingDown, Building2, Search, RefreshCw } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { apiGet } from "@/lib/api-client"
import { UseItemModal } from "@/components/internal-usage/use-item-modal"
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
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  demo:     { label: 'Demo / Display',        color: 'bg-purple-100 text-purple-700 border-purple-200' },
  internal: { label: 'Internal Use',          color: 'bg-blue-100 text-blue-700 border-blue-200' },
  transfer: { label: 'Transfer / Relocation', color: 'bg-amber-100 text-amber-700 border-amber-200' },
}

export default function InternalUsagePage() {
  const [records, setRecords]       = useState<UsageRecord[]>([])
  const [loading, setLoading]       = useState(true)
  const [modalOpen, setModalOpen]   = useState(false)
  const [search, setSearch]         = useState("")

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

  const filteredRecords = records.filter(r =>
    r.items?.some(i => i.itemName?.toLowerCase().includes(search.toLowerCase())) ||
    r.department?.toLowerCase().includes(search.toLowerCase()) ||
    r.usage_type?.toLowerCase().includes(search.toLowerCase()) ||
    r.reason?.toLowerCase().includes(search.toLowerCase())
  )

  // KPI calculations
  const totalRecords  = records.length
  const totalCost     = records.reduce((sum, r) => sum + (r.total_cost || 0), 0)
  const totalQty      = records.reduce((sum, r) => sum + (r.total_qty || 0), 0)
  const demoCount     = records.filter(r => r.usage_type === 'demo').length
  const internalCount = records.filter(r => r.usage_type === 'internal').length
  const transferCount = records.filter(r => r.usage_type === 'transfer').length

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
        <Button onClick={() => setModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg">
          <Plus className="mr-2 h-4 w-4" />
          Use Item
        </Button>
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
                <p className="text-xs text-slate-500 mt-0.5">inventory consumed</p>
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
              <div className="p-2.5 rounded-xl bg-amber-100">
                <Package className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Internal / Transfer</p>
                <p className="text-2xl font-bold text-slate-900">{internalCount + transferCount}</p>
                <p className="text-xs text-slate-500 mt-0.5">records</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Card */}
      <Card className="border-0 shadow-lg">
        {/* Table Header */}
        <div className="p-5 border-b flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by item, department, or type..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 bg-white border-slate-200"
            />
          </div>
          <button
            onClick={fetchRecords}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Date</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Item</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Department</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Type</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Qty</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent mb-3" />
                    <p className="text-sm text-slate-500">Loading records...</p>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-600">No records found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {search ? 'Try adjusting your search' : 'Click "Use Item" to record usage'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, idx) => {
                  const typeInfo = TYPE_LABELS[record.usage_type] || { label: record.usage_type, color: 'bg-slate-100 text-slate-700 border-slate-200' }
                  const itemNames = record.items?.map(i => i.itemName).join(', ') || '—'
                  return (
                    <tr key={record.id || idx} className="hover:bg-slate-50 transition-colors">
                      {/* Date */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{formatDate(record.created_at)}</div>
                        <div className="text-xs text-slate-400">{formatTime(record.created_at)}</div>
                      </td>
                      {/* Item */}
                      <td className="px-4 py-3.5">
                        <div className="text-sm font-semibold text-slate-900 max-w-[200px] truncate" title={itemNames}>
                          {itemNames}
                        </div>
                        {record.reason && (
                          <div className="text-xs text-slate-500 max-w-[200px] truncate">{record.reason}</div>
                        )}
                      </td>
                      {/* Department */}
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-slate-700 font-medium">{record.department}</span>
                      </td>
                      {/* Type */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      {/* Qty */}
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-bold text-slate-900">{record.total_qty}</span>
                        <span className="text-xs text-slate-400 ml-1">units</span>
                      </td>
                      {/* Cost */}
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-bold text-red-600">
                          {formatCurrency(record.total_cost || 0)}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {!loading && filteredRecords.length > 0 && (
          <div className="px-5 py-3 border-t bg-slate-50 text-xs text-slate-500">
            Showing {filteredRecords.length} of {records.length} records
          </div>
        )}
      </Card>

      {/* Modal */}
      <UseItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          setModalOpen(false)
          fetchRecords()
        }}
      />
    </div>
  )
}
