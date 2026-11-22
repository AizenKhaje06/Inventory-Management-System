"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Package, Search, Plus, Minus, Trash2, X, ShoppingCart, FileText } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { apiGet, apiPost } from "@/lib/api-client"
import { getCurrentUser } from "@/lib/auth"
import type { InventoryItem } from "@/lib/types"

interface CartItem {
  id: string
  name: string
  quantity: number
  costPrice: number
  imageUrl?: string
}

interface Employee {
  id: string
  name: string
  department?: string
  position?: string
  status: string
}

const DEPARTMENTS = [
  { value: 'Facebook', label: 'Facebook', icon: '/facebook.png' },
  { value: 'TikTok', label: 'TikTok', icon: '/tiktok.png' },
  { value: 'Shopee', label: 'Shopee', icon: '/Shopee.png' },
  { value: 'Lazada', label: 'Lazada', icon: '/Lazada.png' },
  { value: 'Office', label: 'Office', icon: '/Corporate Building.png' }
]

const USAGE_TYPES = [
  { value: 'demo', label: 'Demo / Display' },
  { value: 'internal', label: 'Internal Use' }
]

interface UseItemModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function UseItemModal({ open, onClose, onSuccess }: UseItemModalProps) {
  const [products, setProducts] = useState<InventoryItem[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [department, setDepartment] = useState("")
  const [usageType, setUsageType] = useState("")
  const [employeeId, setEmployeeId] = useState("") // selected employee ID
  const [processedBy, setProcessedBy] = useState("") // auto-filled - logged in user
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchProducts()
      fetchEmployees()
      setCart([])
      setDepartment("")
      setUsageType("")
      setEmployeeId("")
      setNotes("")
      setSearch("")

      // Auto-fill processedBy from logged in user
      const currentUser = getCurrentUser()
      if (currentUser) {
        const name = currentUser.displayName || currentUser.username || ''
        setProcessedBy(name)
      }
    }
  }, [open])

  const fetchProducts = async () => {
    try {
      const data = await apiGet<InventoryItem[]>("/api/items")
      setProducts(Array.isArray(data) ? data.filter(i => i.quantity > 0) : [])
    } catch (error) {
      toast.error("Failed to load products")
    }
  }

  const fetchEmployees = async () => {
    try {
      const data = await apiGet<Employee[]>("/api/employees?status=active")
      setEmployees(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Failed to load employees:", error)
      // Don't show error toast, just log it
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  )

  const addToCart = (item: InventoryItem) => {
    const existing = cart.find(c => c.id === item.id)
    if (existing) {
      if (existing.quantity >= item.quantity) { toast.error("Not enough stock"); return }
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c))
    } else {
      setCart([...cart, { id: item.id, name: item.name, quantity: 1, costPrice: item.costPrice, imageUrl: item.imageUrl }])
    }
    toast.success(`${item.name} added`, { duration: 1000 })
  }

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) { setCart(cart.filter(c => c.id !== id)); return }
    const item = products.find(p => p.id === id)
    if (item && qty > item.quantity) { toast.error("Not enough stock"); return }
    setCart(cart.map(c => c.id === id ? { ...c, quantity: qty } : c))
  }

  const totalCost = cart.reduce((sum, item) => sum + item.costPrice * item.quantity, 0)

  const handleSubmit = async () => {
    if (!department)          { toast.error("Please select a department"); return }
    if (!usageType)           { toast.error("Please select usage type"); return }
    if (!employeeId)          { toast.error("Please select an employee"); return }
    if (cart.length === 0)    { toast.error("Cart is empty"); return }

    setLoading(true)
    try {
      await apiPost("/api/internal-usage", {
        department,
        usageType,
        employeeId,
        notes:       notes.trim() || null,
        processedBy: processedBy,
        items: cart.map(c => ({
          itemId:    c.id,
          itemName:  c.name,
          quantity:  c.quantity,
          costPrice: c.costPrice,
          imageUrl:  c.imageUrl || null
        }))
      })
      toast.success("Internal usage recorded!")
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error(error.message || "Failed to record internal usage")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 gap-0 bg-white rounded-2xl overflow-hidden border-0 shadow-2xl" hideCloseButton>
        {/* Compact Professional Header */}
        <div className="relative bg-slate-900 px-5 py-1.5 border-b border-slate-800 flex items-center">
          <div className="flex items-center gap-3 pr-8">
            {/* Icon */}
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <ShoppingCart className="h-4.5 w-4.5 text-white" />
            </div>
            {/* Title & Subtitle */}
            <div className="flex-1">
              <h2 className="text-base font-bold !text-white leading-tight" style={{ color: 'white' }}>Record Internal Usage</h2>
              <p className="text-[11px] !text-slate-300 mt-0.5" style={{ color: '#cbd5e1' }}>Track items used for demo, display, and internal consumption</p>
            </div>
          </div>
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-2.5 right-2.5 w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT - Products */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 h-10 bg-white border-slate-200"
              />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filteredProducts.map(item => {
                const inCart = cart.find(c => c.id === item.id)
                const available = item.quantity - (inCart?.quantity || 0)
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    disabled={available <= 0}
                    className={cn(
                      "group relative overflow-hidden rounded-lg border-2 transition-all duration-200 text-left",
                      available <= 0
                        ? "border-red-200 bg-red-50 opacity-60 cursor-not-allowed"
                        : "border-slate-200 bg-white hover:shadow-lg hover:border-blue-400 hover:-translate-y-0.5 active:scale-95"
                    )}
                  >
                    {/* Image */}
                    <div className="relative aspect-square bg-slate-50 overflow-hidden">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain p-2" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-8 w-8 text-slate-300" />
                        </div>
                      )}
                      {/* Stock Badge */}
                      <div className="absolute top-1.5 right-1.5">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-bold",
                          available <= 0 ? "bg-red-500 text-white" : available <= 10 ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"
                        )}>{available}</span>
                      </div>
                      {/* In Cart badge */}
                      {inCart && (
                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold">
                          {inCart.quantity}
                        </div>
                      )}
                      {/* Hover overlay */}
                      {available > 0 && (
                        <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
                            <Plus className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-2 bg-white border-t border-slate-100">
                      <div style={{ fontSize: '10px', fontWeight: 600, lineHeight: '1.3', color: '#1e293b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#059669', marginTop: '2px' }}>
                        {formatCurrency(item.costPrice)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No products found</p>
              </div>
            )}
          </div>

          {/* RIGHT - Details + Cart */}
          <div className="w-[400px] bg-white flex flex-col shadow-lg border-l border-slate-200">

            {/* Usage Details */}
            <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Usage Details</h3>
              </div>
              <div className="space-y-3">
                {/* Department + Usage Type - side by side */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Department <span className="text-red-500">*</span></label>
                    <Select value={department} onValueChange={setDepartment}>
                      <SelectTrigger className="h-9 bg-white border-slate-300 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map(dept => (
                          <SelectItem key={dept.value} value={dept.value}>
                            <div className="flex items-center gap-2">
                              <img src={dept.icon} alt={dept.label} className="w-4 h-4 object-contain" />
                              <span className="text-sm">{dept.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Usage Type <span className="text-red-500">*</span></label>
                    <Select value={usageType} onValueChange={setUsageType}>
                      <SelectTrigger className="h-9 bg-white border-slate-300 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="w-[160px]" align="start">
                        {USAGE_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            <span className="text-sm">{t.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Requested By - Employee Dropdown */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Requested By <span className="text-red-500">*</span></label>
                  <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger className="h-9 bg-white border-slate-300 text-sm">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.length === 0 ? (
                        <div className="px-2 py-3 text-xs text-slate-500 text-center">
                          No active employees found.<br/>Add employees first.
                        </div>
                      ) : (
                        employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{emp.name}</span>
                              {emp.department && (
                                <span className="text-xs text-slate-500">- {emp.department}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {/* Notes */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Notes <span className="text-slate-400 font-normal">(Optional)</span></label>
                  <Textarea
                    placeholder="Additional information..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="min-h-[60px] bg-white border-slate-300 text-sm resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Cart */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="px-5 py-3 bg-slate-50 border-b flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">Cart ({cart.length})</span>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-600 font-medium">Clear</button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {cart.length === 0 ? (
                  <div className="text-center py-10">
                    <ShoppingCart className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-medium">Cart is empty</p>
                    <p className="text-xs text-slate-400">Add products from the left</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white border-slate-200 hover:border-blue-200 transition-colors">
                      {/* Image */}
                      <div className="h-9 w-9 rounded-md bg-slate-100 border border-slate-200 flex-shrink-0 overflow-hidden">
                        {item.imageUrl
                          ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain p-0.5" />
                          : <div className="w-full h-full flex items-center justify-center"><Package className="h-4 w-4 text-slate-300" /></div>
                        }
                      </div>
                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{item.name}</p>
                        <p className="text-[10px] text-slate-500">{formatCurrency(item.costPrice)} × {item.quantity}</p>
                      </div>
                      {/* Qty */}
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" className="h-5 w-5 p-0 rounded" onClick={() => updateQty(item.id, item.quantity - 1)}>
                          <Minus className="h-2 w-2" />
                        </Button>
                        <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                        <Button size="sm" variant="outline" className="h-5 w-5 p-0 rounded" onClick={() => updateQty(item.id, item.quantity + 1)}>
                          <Plus className="h-2 w-2" />
                        </Button>
                      </div>
                      {/* Total */}
                      <div className="text-xs font-bold text-slate-800 w-14 text-right flex-shrink-0">
                        {formatCurrency(item.costPrice * item.quantity)}
                      </div>
                      {/* Delete */}
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-red-500 hover:bg-red-50 rounded flex-shrink-0" onClick={() => setCart(cart.filter(c => c.id !== item.id))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t p-4 bg-slate-50 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total Items:</span>
                  <span className="font-semibold">{cart.reduce((s, i) => s + i.quantity, 0)} units</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="font-semibold text-slate-900">Total Cost:</span>
                  <span className="text-lg font-bold text-blue-600">{formatCurrency(totalCost)}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1 h-10" onClick={onClose} disabled={loading}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleSubmit}
                    disabled={loading || cart.length === 0 || !department || !usageType || !employeeId}
                  >
                    {loading ? (
                      <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-r-transparent" />Recording...</>
                    ) : (
                      <><ShoppingCart className="h-4 w-4 mr-2" />Record Usage</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
