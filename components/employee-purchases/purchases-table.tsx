"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, CheckCircle, XCircle, Eye, FileDown, Package, Calendar, User, DollarSign, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface PurchaseItem {
  id: number
  name: string
  quantity: number
  price: number
  isFreebie: boolean
}

interface Purchase {
  id: string
  employee_name: string
  items: string | PurchaseItem[] // JSON string or parsed array
  total_quantity: number
  amount: number
  purchase_date: string
  deduction_date: string
  paid_date?: string
  status: 'pending' | 'paid' | 'cancelled'
  notes?: string
}

interface PurchasesTableProps {
  purchases: Purchase[]
  loading: boolean
  onRefresh: () => void
}

export function PurchasesTable({ purchases, loading, onRefresh }: PurchasesTableProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type: 'paid' | 'cancel' | null
    purchaseId: string | null
    employeeName: string
  }>({
    open: false,
    type: null,
    purchaseId: null,
    employeeName: ''
  })
  const [cancelReason, setCancelReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [viewDetailsDialog, setViewDetailsDialog] = useState<{
    open: boolean
    purchase: Purchase | null
  }>({
    open: false,
    purchase: null
  })

  // Parse items if they're in JSON string format
  const getParsedItems = (purchase: Purchase): PurchaseItem[] => {
    // Handle new schema with items as JSON
    if (purchase.items) {
      if (typeof purchase.items === 'string') {
        try {
          return JSON.parse(purchase.items)
        } catch {
          return []
        }
      }
      return purchase.items
    }
    
    // Handle old schema with item_name and quantity
    const oldFormat = purchase as any
    if (oldFormat.item_name) {
      return [{
        id: 0,
        name: oldFormat.item_name,
        quantity: oldFormat.quantity || 1,
        price: oldFormat.amount || 0,
        isFreebie: false
      }]
    }
    
    return []
  }

  // Get items summary for display
  const getItemsSummary = (purchase: Purchase): string => {
    const items = getParsedItems(purchase)
    if (items.length === 0) return '-'
    if (items.length === 1) return items[0].name
    return `${items[0].name} +${items.length - 1} more`
  }
  
  // Get total quantity
  const getTotalQuantity = (purchase: Purchase): number => {
    // New schema has total_quantity field
    if (purchase.total_quantity) {
      return purchase.total_quantity
    }
    
    // Calculate from items
    const items = getParsedItems(purchase)
    return items.reduce((sum, item) => sum + item.quantity, 0)
  }

  // Filter purchases
  const filteredPurchases = purchases.filter((purchase) => {
    const items = getParsedItems(purchase)
    const itemNames = items.map(item => item.name.toLowerCase()).join(' ')
    
    const matchesSearch = 
      purchase.employee_name.toLowerCase().includes(search.toLowerCase()) ||
      itemNames.includes(search.toLowerCase()) ||
      purchase.notes?.toLowerCase().includes(search.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || purchase.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Handle mark as paid
  const handleMarkAsPaid = async (id: string, employeeName: string) => {
    setConfirmDialog({
      open: true,
      type: 'paid',
      purchaseId: id,
      employeeName
    })
  }

  // Handle cancel
  const handleCancel = async (id: string, employeeName: string) => {
    setConfirmDialog({
      open: true,
      type: 'cancel',
      purchaseId: id,
      employeeName
    })
    setCancelReason("")
  }
  
  // Confirm action
  const handleConfirmAction = async () => {
    if (!confirmDialog.purchaseId) return
    
    if (confirmDialog.type === 'cancel' && !cancelReason.trim()) {
      return
    }
    
    setIsProcessing(true)

    try {
      const body: any = {
        status: confirmDialog.type === 'paid' ? 'paid' : 'cancelled'
      }
      
      if (confirmDialog.type === 'cancel') {
        body.notes = cancelReason.trim()
      }

      const response = await fetch(`/api/employee-purchases/${confirmDialog.purchaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        onRefresh()
        setConfirmDialog({ open: false, type: null, purchaseId: null, employeeName: '' })
        setCancelReason("")
      }
    } catch (error) {
      console.error('Error updating purchase:', error)
    } finally {
      setIsProcessing(false)
    }
  }
  
  // Close dialog
  const handleCloseDialog = () => {
    if (isProcessing) return
    setConfirmDialog({ open: false, type: null, purchaseId: null, employeeName: '' })
    setCancelReason("")
  }
  
  // View details
  const handleViewDetails = (purchase: Purchase) => {
    setViewDetailsDialog({ open: true, purchase })
  }
  
  // Close view details
  const handleCloseViewDetails = () => {
    setViewDetailsDialog({ open: false, purchase: null })
  }

  // Export to CSV
  const handleExport = () => {
    const rows: string[][] = [
      ['Employee', 'Items', 'Total Quantity', 'Amount', 'Purchase Date', 'Deduction Date', 'Status', 'Paid Date']
    ]
    
    filteredPurchases.forEach(p => {
      const items = getParsedItems(p)
      const itemsSummary = items.map(item => 
        `${item.name} (${item.quantity}x)${item.isFreebie ? ' [Freebie]' : ''}`
      ).join('; ')
      
      rows.push([
        p.employee_name,
        itemsSummary,
        p.total_quantity.toString(),
        p.amount.toString(),
        format(new Date(p.purchase_date), 'yyyy-MM-dd'),
        format(new Date(p.deduction_date), 'yyyy-MM-dd'),
        p.status,
        p.paid_date ? format(new Date(p.paid_date), 'yyyy-MM-dd') : '-'
      ])
    })

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `employee-purchases-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  return (
    <Card className="border-0 shadow-xl bg-white rounded-2xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Package className="h-4 w-4 text-white" />
              </div>
              All Purchases
              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700 border-0">
                {filteredPurchases.length}
              </Badge>
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">View and manage employee purchase records</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search employee, items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-full sm:w-72 bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 bg-white border-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {/* Export Button */}
            <Button
              variant="outline"
              size="default"
              onClick={handleExport}
              disabled={filteredPurchases.length === 0}
              className="bg-white border-slate-300 hover:bg-slate-50"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="text-center py-20 text-slate-400">
            <div className="animate-spin rounded-full h-14 w-14 border-4 border-slate-200 border-t-blue-600 mx-auto mb-4" />
            <p className="text-base font-semibold text-slate-600">Loading purchases...</p>
            <p className="text-sm text-slate-400 mt-1">Please wait</p>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <div className="h-20 w-20 rounded-full bg-slate-100 mx-auto mb-4 flex items-center justify-center">
              <Package className="h-10 w-10 text-slate-300" />
            </div>
            <p className="text-lg font-semibold text-slate-600 mb-2">No purchases found</p>
            <p className="text-sm text-slate-400">
              {search || statusFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Click "New Purchase" to create your first purchase'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50 border-b-2 border-slate-200">
                  <TableHead className="font-bold text-slate-700 py-4 pl-6 w-[160px]">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Purchase Date
                    </div>
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 w-[180px]">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Employee
                    </div>
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 w-[220px]">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Items
                    </div>
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 text-center w-[90px]">
                    Qty
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 text-right w-[130px] pr-8">
                    Amount
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 w-[160px] pl-8">
                    Deduction Date
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 w-[110px]">
                    Status
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 w-[130px]">
                    Paid Date
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 text-right pr-6 w-[180px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.map((purchase, index) => {
                  const items = getParsedItems(purchase)
                  const itemsSummary = getItemsSummary(purchase)
                  const totalQty = getTotalQuantity(purchase)
                  
                  return (
                    <TableRow 
                      key={purchase.id}
                      className={cn(
                        "border-b border-slate-100 transition-colors",
                        "hover:bg-blue-50/50",
                        index % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                      )}
                    >
                      <TableCell className="py-3.5 pl-6">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-slate-900 text-sm whitespace-nowrap">
                              {format(new Date(purchase.purchase_date), 'MMM dd, yyyy')}
                            </p>
                            <p className="text-xs text-slate-500">
                              {format(new Date(purchase.purchase_date), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm flex-shrink-0">
                            <span className="text-white font-bold text-xs">
                              {purchase.employee_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">{purchase.employee_name}</p>
                            <p className="text-xs text-slate-500">Employee</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-start gap-1.5">
                            <Package className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <span className="font-semibold text-slate-900 text-sm line-clamp-1">{itemsSummary}</span>
                          </div>
                          {items.length > 1 && (
                            <span className="text-xs text-slate-500 ml-5">
                              {items.length} items
                            </span>
                          )}
                          {items.some(item => item.isFreebie) && (
                            <Badge variant="secondary" className="w-fit ml-5 bg-pink-100 text-pink-700 border-0 text-xs px-2 py-0.5">
                              + freebies
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-3.5">
                        <span className="inline-flex items-center justify-center min-w-[2.5rem] h-7 px-2.5 rounded-md bg-blue-100 text-blue-700 font-bold text-sm">
                          {totalQty}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-3.5 pr-8">
                        <span className="text-sm font-bold text-slate-900">
                          ₱{purchase.amount.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 pl-8">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                          <span className="font-semibold text-slate-900 text-sm whitespace-nowrap">
                            {format(new Date(purchase.deduction_date), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Badge
                          variant={
                            purchase.status === 'paid'
                              ? 'default'
                              : purchase.status === 'cancelled'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className={cn(
                            "font-semibold px-2.5 py-1 text-xs shadow-sm whitespace-nowrap",
                            purchase.status === 'paid' && 'bg-emerald-500 hover:bg-emerald-600 text-white border-0',
                            purchase.status === 'pending' && 'bg-amber-500 hover:bg-amber-600 text-white border-0',
                            purchase.status === 'cancelled' && 'bg-red-500 hover:bg-red-600 text-white border-0'
                          )}
                        >
                          {purchase.status === 'paid' && <CheckCircle className="h-3 w-3 mr-1 inline" />}
                          {purchase.status === 'cancelled' && <XCircle className="h-3 w-3 mr-1 inline" />}
                          {purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3.5">
                        {purchase.paid_date ? (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                            <span className="font-semibold text-slate-900 text-sm whitespace-nowrap">
                              {format(new Date(purchase.paid_date), 'MMM dd, yyyy')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm whitespace-nowrap">Not paid yet</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-3.5 pr-6">
                        <div className="flex items-center justify-end gap-2.5">
                          {purchase.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleMarkAsPaid(purchase.id, purchase.employee_name)}
                                className="text-emerald-600 hover:text-emerald-700 font-semibold text-sm transition-colors flex items-center gap-1"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Mark Paid
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                onClick={() => handleCancel(purchase.id, purchase.employee_name)}
                                className="text-red-600 hover:text-red-700 font-semibold text-sm transition-colors flex items-center gap-1"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Cancel
                              </button>
                            </>
                          )}
                          {purchase.status !== 'pending' && (
                            <button
                              onClick={() => handleViewDetails(purchase)}
                              className="text-blue-600 hover:text-blue-700 font-semibold text-sm transition-colors flex items-center gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Details
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Professional Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden">
          {confirmDialog.type === 'paid' ? (
            <>
              {/* Mark as Paid Dialog */}
              <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-emerald-50 to-green-50 border-b">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-12 w-12 rounded-full bg-emerald-600 flex items-center justify-center shadow-lg">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold text-slate-900">
                      Confirm Payment
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-600 mt-0.5">
                      Mark this purchase as paid
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="px-6 py-5">
                <div className="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-200">
                  <p className="text-sm text-slate-600 mb-2">Employee:</p>
                  <p className="text-base font-bold text-slate-900">{confirmDialog.employeeName}</p>
                </div>
                
                <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <AlertCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900 mb-1">
                      This action will mark the purchase as paid
                    </p>
                    <p className="text-xs text-emerald-700">
                      The paid date will be recorded as today's date. This action can be reviewed but not easily reversed.
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter className="px-6 py-4 bg-slate-50 border-t flex-row gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={handleCloseDialog}
                  disabled={isProcessing}
                  className="border-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmAction}
                  disabled={isProcessing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm Payment
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              {/* Cancel Purchase Dialog */}
              <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-red-50 to-orange-50 border-b">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-12 w-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                    <XCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold text-slate-900">
                      Cancel Purchase
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-600 mt-0.5">
                      Provide a reason for cancellation
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="px-6 py-5">
                <div className="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-200">
                  <p className="text-sm text-slate-600 mb-2">Employee:</p>
                  <p className="text-base font-bold text-slate-900">{confirmDialog.employeeName}</p>
                </div>

                <div className="mb-4">
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">
                    Cancellation Reason <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    placeholder="Enter the reason for cancelling this purchase..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="min-h-[100px] resize-none bg-white border-slate-300 focus:border-red-500 focus:ring-red-500"
                    disabled={isProcessing}
                  />
                  {!cancelReason.trim() && (
                    <p className="text-xs text-slate-500 mt-1.5">
                      Please provide a reason before cancelling
                    </p>
                  )}
                </div>
                
                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-900 mb-1">
                      This will cancel the purchase order
                    </p>
                    <p className="text-xs text-red-700">
                      The purchase will be marked as cancelled and will not be deducted from the employee's salary.
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter className="px-6 py-4 bg-slate-50 border-t flex-row gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={handleCloseDialog}
                  disabled={isProcessing}
                  className="border-slate-300"
                >
                  Go Back
                </Button>
                <Button
                  onClick={handleConfirmAction}
                  disabled={isProcessing || !cancelReason.trim()}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Confirm Cancellation
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* View Details Dialog - Smooth & Clean */}
      <Dialog open={viewDetailsDialog.open} onOpenChange={handleCloseViewDetails}>
        <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden">
          {/* Clean Header */}
          <DialogHeader className="px-6 py-5 bg-white border-b border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 mb-1">
                  Purchase Details
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500">
                  Order #{String(viewDetailsDialog.purchase?.id || '').slice(0, 8).toUpperCase()}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {viewDetailsDialog.purchase && (
            <div className="px-6 py-6 max-h-[65vh] overflow-y-auto space-y-6 bg-slate-50/50">
              {/* Employee & Status - Side by Side */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-2 block">
                    Employee
                  </label>
                  <p className="font-semibold text-slate-900">
                    {viewDetailsDialog.purchase.employee_name}
                  </p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-2 block">
                    Status
                  </label>
                  <Badge
                    className={cn(
                      "font-medium text-sm px-3 py-1",
                      viewDetailsDialog.purchase.status === 'paid' && 'bg-emerald-500 hover:bg-emerald-600 text-white border-0',
                      viewDetailsDialog.purchase.status === 'pending' && 'bg-amber-500 hover:bg-amber-600 text-white border-0',
                      viewDetailsDialog.purchase.status === 'cancelled' && 'bg-red-500 hover:bg-red-600 text-white border-0'
                    )}
                  >
                    {viewDetailsDialog.purchase.status.charAt(0).toUpperCase() + viewDetailsDialog.purchase.status.slice(1)}
                  </Badge>
                </div>
              </div>

              {/* Items - Clean List */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-3 block">
                  Items Purchased
                </label>
                <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {getParsedItems(viewDetailsDialog.purchase).map((item, idx) => (
                    <div key={idx} className="px-4 py-3.5 flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="font-medium text-slate-900 text-sm mb-0.5">{item.name}</p>
                        <p className="text-xs text-slate-500">Quantity: {item.quantity}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {item.isFreebie ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-pink-50 text-pink-700 border border-pink-200">
                            Free
                          </span>
                        ) : (
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">₱{(item.price * item.quantity).toLocaleString()}</p>
                            <p className="text-xs text-slate-500">₱{item.price.toLocaleString()} each</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dates Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-2 block">
                    Purchase Date
                  </label>
                  <div className="bg-white rounded-lg border border-slate-200 p-3">
                    <p className="font-medium text-slate-900 text-sm mb-0.5">
                      {format(new Date(viewDetailsDialog.purchase.purchase_date), 'MMM dd, yyyy')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(viewDetailsDialog.purchase.purchase_date), 'h:mm a')}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-amber-700 mb-2 block">
                    Deduction Date
                  </label>
                  <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
                    <p className="font-medium text-slate-900 text-sm">
                      {format(new Date(viewDetailsDialog.purchase.deduction_date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Paid Date - Full Width */}
              {viewDetailsDialog.purchase.paid_date && (
                <div>
                  <label className="text-xs font-medium text-emerald-700 mb-2 block">
                    Paid Date
                  </label>
                  <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3">
                    <p className="font-medium text-slate-900 text-sm">
                      {format(new Date(viewDetailsDialog.purchase.paid_date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              )}

              {/* Total Amount - Prominent */}
              <div className="bg-blue-600 rounded-lg p-5 text-white shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide mb-2 text-blue-100">
                  Total Amount
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">₱{viewDetailsDialog.purchase.amount.toLocaleString()}</span>
                  <span className="text-sm text-blue-100">
                    {getTotalQuantity(viewDetailsDialog.purchase)} {getTotalQuantity(viewDetailsDialog.purchase) === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </div>

              {/* Cancellation Reason */}
              {viewDetailsDialog.purchase.status === 'cancelled' && viewDetailsDialog.purchase.notes && (
                <div>
                  <label className="text-xs font-medium text-red-700 mb-2 block">
                    Cancellation Reason
                  </label>
                  <div className="bg-red-50 rounded-lg border border-red-200 p-4">
                    <p className="text-sm text-slate-700 leading-relaxed">{viewDetailsDialog.purchase.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clean Footer */}
          <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end">
            <Button
              onClick={handleCloseViewDetails}
              className="bg-slate-900 hover:bg-slate-800 text-white px-6"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
