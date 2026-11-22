"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Package, RotateCcw, X, CheckCircle2, AlertCircle } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { apiGet, apiPost } from "@/lib/api-client"

interface UsageRecord {
  id: string
  department: string
  usage_type: string
  reason: string
  items: Array<{
    itemId: string
    itemName: string
    quantity: number
    costPrice: number
    totalCost: number
    imageUrl?: string
  }>
  returned_items?: Record<string, { returned: number; total: number }>
  return_status?: string
  created_at: string
}

interface AggregatedItem {
  itemId: string
  itemName: string
  totalRequested: number
  totalReturned: number
  available: number
  costPrice: number
  imageUrl?: string
  records: Array<{
    recordId: string
    requested: number
    returned: number
  }>
}

interface ReturnItem {
  itemId: string
  itemName: string
  returnQuantity: number
}

interface ReturnDemoItemsModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ReturnDemoItemsModal({ open, onClose, onSuccess }: ReturnDemoItemsModalProps) {
  const [records, setRecords] = useState<UsageRecord[]>([])
  const [selectedPerson, setSelectedPerson] = useState("")
  const [aggregatedItems, setAggregatedItems] = useState<AggregatedItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchRecords()
      setSelectedPerson("")
      setAggregatedItems([])
      setSelectedItems(new Set())
      setQuantities({})
    }
  }, [open])

  const fetchRecords = async () => {
    try {
      const data = await apiGet<UsageRecord[]>("/api/internal-usage")
      const demoRecords = data.filter(r => r.usage_type === 'demo')
      setRecords(demoRecords)
    } catch (error) {
      toast.error("Failed to load records")
    }
  }

  // Get unique person names (from reason field)
  const personNames = Array.from(new Set(records.map(r => r.reason))).sort()

  // Aggregate items when person is selected
  useEffect(() => {
    if (!selectedPerson) {
      setAggregatedItems([])
      setSelectedItems(new Set())
      setQuantities({})
      return
    }

    const personRecords = records.filter(r => r.reason === selectedPerson)
    const itemMap = new Map<string, AggregatedItem>()

    for (const record of personRecords) {
      for (const item of record.items) {
        const returned_items = record.returned_items || {}
        const returnedQty = returned_items[item.itemId]?.returned || 0
        const available = item.quantity - returnedQty

        if (!itemMap.has(item.itemId)) {
          itemMap.set(item.itemId, {
            itemId: item.itemId,
            itemName: item.itemName,
            totalRequested: 0,
            totalReturned: 0,
            available: 0,
            costPrice: item.costPrice,
            imageUrl: item.imageUrl,
            records: []
          })
        }

        const aggItem = itemMap.get(item.itemId)!
        aggItem.totalRequested += item.quantity
        aggItem.totalReturned += returnedQty
        aggItem.available += available
        aggItem.records.push({
          recordId: record.id,
          requested: item.quantity,
          returned: returnedQty
        })
      }
    }

    // Only show items that have available quantity to return
    const items = Array.from(itemMap.values()).filter(item => item.available > 0)
    setAggregatedItems(items)

    // Initialize quantities
    const initialQty: Record<string, number> = {}
    items.forEach(item => {
      initialQty[item.itemId] = item.available
    })
    setQuantities(initialQty)

  }, [selectedPerson, records])

  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const updateQuantity = (itemId: string, value: string) => {
    const num = parseInt(value) || 0
    const item = aggregatedItems.find(i => i.itemId === itemId)
    if (!item) return

    const clamped = Math.max(0, Math.min(num, item.available))
    setQuantities({ ...quantities, [itemId]: clamped })
  }

  const handleSubmit = async () => {
    if (!selectedPerson) {
      toast.error("Please select a person")
      return
    }

    if (selectedItems.size === 0) {
      toast.error("Please select at least one item to return")
      return
    }

    const returnItems: ReturnItem[] = []
    for (const itemId of selectedItems) {
      const qty = quantities[itemId] || 0
      if (qty <= 0) {
        toast.error("Return quantity must be greater than 0")
        return
      }
      const item = aggregatedItems.find(i => i.itemId === itemId)
      if (!item) continue

      returnItems.push({
        itemId,
        itemName: item.itemName,
        returnQuantity: qty
      })
    }

    setLoading(true)
    try {
      await apiPost("/api/internal-usage/return", {
        personName: selectedPerson,
        items: returnItems
      })
      toast.success("Items returned successfully!")
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.message || "Failed to return items")
    } finally {
      setLoading(false)
    }
  }

  const totalReturnCost = Array.from(selectedItems).reduce((sum, itemId) => {
    const item = aggregatedItems.find(i => i.itemId === itemId)
    if (!item) return sum
    const qty = quantities[itemId] || 0
    return sum + (item.costPrice * qty)
  }, 0)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0 bg-white rounded-2xl overflow-hidden border-0 shadow-2xl" hideCloseButton>
        {/* Header */}
        <div className="relative bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 border-b border-emerald-700 flex items-center">
          <div className="flex items-center gap-3 pr-8">
            <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-sm">
              <RotateCcw className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold !text-white leading-tight" style={{ color: 'white' }}>Return Demo/Display Items</h2>
              <p className="text-xs !text-emerald-100 mt-0.5" style={{ color: '#d1fae5' }}>
                Select items to return and add back to inventory
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1: Select Person */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                1
              </div>
              <h3 className="text-sm font-bold text-slate-900">Select Person</h3>
            </div>
            <Select value={selectedPerson} onValueChange={setSelectedPerson}>
              <SelectTrigger className="h-11 bg-white border-slate-300">
                <SelectValue placeholder="Choose who is returning items..." />
              </SelectTrigger>
              <SelectContent>
                {personNames.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500">No demo/display records found</div>
                ) : (
                  personNames.map(name => {
                    const personRecords = records.filter(r => r.reason === name)
                    const totalItems = personRecords.reduce((sum, r) => sum + r.total_qty, 0)
                    return (
                      <SelectItem key={name} value={name}>
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span className="font-medium">{name}</span>
                          <span className="text-xs text-slate-500">{totalItems} items</span>
                        </div>
                      </SelectItem>
                    )
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Select Items */}
          {selectedPerson && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                  2
                </div>
                <h3 className="text-sm font-bold text-slate-900">Select Items to Return</h3>
              </div>

              {aggregatedItems.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700">All items returned!</p>
                  <p className="text-xs text-slate-500 mt-1">No pending items to return for this person</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {aggregatedItems.map(item => {
                    const isSelected = selectedItems.has(item.itemId)
                    const qty = quantities[item.itemId] || 0
                    const progress = (item.totalReturned / item.totalRequested) * 100

                    return (
                      <div
                        key={item.itemId}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-lg border-2 transition-all",
                          isSelected
                            ? "border-blue-400 bg-blue-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        )}
                      >
                        {/* Checkbox */}
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleItem(item.itemId)}
                          className="mt-1"
                        />

                        {/* Image */}
                        <div className="w-14 h-14 rounded-md bg-slate-100 border border-slate-200 flex-shrink-0 overflow-hidden">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.itemName} className="w-full h-full object-contain p-1" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-6 w-6 text-slate-300" />
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{item.itemName}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-slate-600">
                              <span className="font-semibold text-slate-900">{item.available}</span> available to return
                            </span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-600">
                              {item.totalReturned}/{item.totalRequested} returned
                            </span>
                          </div>
                          {/* Progress Bar */}
                          <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        {/* Quantity Input */}
                        <div className="flex flex-col items-end gap-1">
                          <label className="text-xs font-semibold text-slate-600">Return Qty</label>
                          <Input
                            type="number"
                            min={1}
                            max={item.available}
                            value={qty}
                            onChange={e => updateQuantity(item.itemId, e.target.value)}
                            disabled={!isSelected}
                            className={cn(
                              "h-9 w-20 text-center font-bold",
                              isSelected ? "border-blue-400" : ""
                            )}
                          />
                          <span className="text-xs text-slate-500">
                            {formatCurrency(item.costPrice * qty)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {selectedPerson && aggregatedItems.length > 0 && selectedItems.size > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase">Return Summary</p>
                  <p className="text-sm text-slate-700 mt-1">
                    <span className="font-bold text-blue-600">{selectedItems.size}</span> item(s) selected
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-600 uppercase">Total Cost</p>
                  <p className="text-lg font-bold text-blue-600 mt-1">{formatCurrency(totalReturnCost)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-slate-50 px-6 py-4 flex items-center justify-between gap-4">
          <Button
            variant="outline"
            className="h-10 px-6"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="h-10 px-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
            onClick={handleSubmit}
            disabled={loading || !selectedPerson || selectedItems.size === 0 || aggregatedItems.length === 0}
          >
            {loading ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-r-transparent" />
                Processing...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Return Items ({selectedItems.size})
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
