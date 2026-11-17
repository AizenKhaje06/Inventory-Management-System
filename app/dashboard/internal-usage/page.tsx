"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Package, Plus, Minus, Trash2, Save, Search, Building2, PackageOpen, ArrowRight, ShoppingCart, FileText, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatNumber, cn } from "@/lib/utils"
import { showSuccess, showError } from "@/lib/toast-utils"
import { apiGet, apiPost } from "@/lib/api-client"
import type { InventoryItem } from "@/lib/types"

interface CartItem {
  id: string
  name: string
  quantity: number
  costPrice: number
  sellingPrice: number
  imageUrl?: string
}

const DEPARTMENTS = [
  { value: 'Facebook', label: 'Facebook', icon: '📘', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'TikTok', label: 'TikTok', icon: '🎵', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { value: 'Shopee', label: 'Shopee', icon: '🛍️', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'Lazada', label: 'Lazada', icon: '🛒', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'Office', label: 'Office', icon: '🏢', color: 'bg-slate-50 text-slate-700 border-slate-200' }
]

const USAGE_TYPES = [
  { value: 'demo', label: 'Demo/Display', icon: '👁️', description: 'Product demonstration or display' },
  { value: 'internal', label: 'Internal Use', icon: '🏢', description: 'Internal company consumption' },
  { value: 'transfer', label: 'Transfer/Relocation', icon: '📦', description: 'Move between locations' }
]

export default function InternalUsagePage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [selectedDepartment, setSelectedDepartment] = useState("")
  const [usageType, setUsageType] = useState("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    try {
      setLoading(true)
      const data = await apiGet<InventoryItem[]>("/api/items")
      setItems(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching items:", error)
      showError("Failed to load products")
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const addToCart = (item: InventoryItem) => {
    if (item.quantity <= 0) {
      showError("Product is out of stock")
      return
    }

    const existingItem = cart.find(cartItem => cartItem.id === item.id)
    
    if (existingItem) {
      if (existingItem.quantity >= item.quantity) {
        showError("Not enough stock available")
        return
      }
      updateQuantity(item.id, existingItem.quantity + 1)
    } else {
      setCart([...cart, {
        id: item.id,
        name: item.name,
        quantity: 1,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
        imageUrl: item.imageUrl
      }])
      showSuccess(`${item.name} added to cart`)
    }
  }

  const updateQuantity = (itemId: string, newQuantity: number) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    if (newQuantity > item.quantity) {
      showError("Not enough stock available")
      return
    }

    if (newQuantity <= 0) {
      removeFromCart(itemId)
      return
    }

    setCart(cart.map(cartItem =>
      cartItem.id === itemId
        ? { ...cartItem, quantity: newQuantity }
        : cartItem
    ))
  }

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId))
  }

  const clearCart = () => {
    setCart([])
    setSelectedDepartment("")
    setUsageType("")
    setReason("")
    setNotes("")
  }

  const getTotalCost = () => {
    return cart.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0)
  }

  const handleSubmit = async () => {
    if (cart.length === 0) {
      showError("Cart is empty")
      return
    }

    if (!selectedDepartment) {
      showError("Please select a department")
      return
    }

    if (!usageType) {
      showError("Please select usage type")
      return
    }

    if (!reason.trim()) {
      showError("Please enter a reason")
      return
    }

    try {
      setSubmitting(true)

      // Create transaction for each item
      for (const cartItem of cart) {
        await apiPost("/api/transactions", {
          itemId: cartItem.id,
          itemName: cartItem.name,
          quantity: cartItem.quantity,
          transactionType: usageType,
          department: selectedDepartment,
          details: `${reason}${notes ? ` - ${notes}` : ''}`,
          costPrice: cartItem.costPrice,
          sellingPrice: 0, // No selling price for internal usage
        })
      }

      showSuccess("Internal usage recorded successfully")
      clearCart()
      fetchItems() // Refresh stock levels
    } catch (error) {
      console.error("Error recording internal usage:", error)
      showError("Failed to record internal usage")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Professional Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold gradient-text">Internal Usage</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Record and track items used for demo, display, or internal consumption
          </p>
        </div>
        
        {/* Header Stats */}
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Available Products</div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{items.length}</div>
          </div>
          <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Cart Items</div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{cart.length}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Products Selection - Left Side (3 columns) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Professional Search Card */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-5">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  placeholder="Search products by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 text-base border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Products Grid */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  Available Products
                </CardTitle>
                <Badge variant="outline" className="bg-white">
                  {filteredItems.length} items
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {loading ? (
                <div className="text-center py-16 text-slate-500">
                  <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4"></div>
                  <p className="text-sm font-medium">Loading products...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                    <Search className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No products found</p>
                  <p className="text-xs text-slate-500 mt-1">Try adjusting your search query</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                  {filteredItems.map((item) => {
                    const inCart = cart.find(c => c.id === item.id)
                    const availableStock = item.quantity - (inCart?.quantity || 0)
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        disabled={availableStock <= 0}
                        className={cn(
                          "group relative overflow-hidden rounded-lg border transition-all duration-200 text-left",
                          availableStock <= 0
                            ? "border-red-200 bg-red-50 opacity-60 cursor-not-allowed"
                            : "border-slate-200 bg-white hover:shadow-lg hover:border-blue-400 hover:-translate-y-0.5 cursor-pointer active:scale-95"
                        )}
                      >
                        {/* Product Image - Reduced size */}
                        <div className="relative aspect-square bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-contain p-2"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-8 w-8 text-slate-300" />
                            </div>
                          )}
                          
                          {/* Stock Badge - Top Right */}
                          <div className="absolute top-1.5 right-1.5">
                            <div className={cn(
                              "px-1.5 py-0.5 rounded-md text-[10px] font-bold shadow-sm",
                              availableStock <= 0 ? "bg-red-500 text-white" : 
                              availableStock <= 10 ? "bg-amber-500 text-white" : 
                              "bg-emerald-500 text-white"
                            )}>
                              {availableStock}
                            </div>
                          </div>

                          {/* Hover Add Icon */}
                          {availableStock > 0 && (
                            <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
                                <Plus className="h-5 w-5 text-white" />
                              </div>
                            </div>
                          )}

                          {/* In Cart Indicator - Top Left */}
                          {inCart && (
                            <div className="absolute top-1.5 left-1.5">
                              <div className="px-1.5 py-0.5 rounded-md bg-blue-600 text-white shadow-sm text-[10px] font-bold flex items-center gap-0.5">
                                <ShoppingCart className="h-2.5 w-2.5" />
                                {inCart.quantity}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Product Info - Compact */}
                        <div className="p-2 bg-white border-t border-slate-100">
                          <h3 className="font-semibold text-xs text-slate-900 line-clamp-2 leading-tight mb-1 min-h-[28px]">
                            {item.name}
                          </h3>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-500 font-medium">
                              Cost: <span className="text-slate-700 font-semibold">{formatCurrency(item.costPrice)}</span>
                            </span>
                            {item.sku && (
                              <span className="text-slate-400 text-[9px]">
                                {item.sku}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Form & Cart - Right Side (2 columns) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Usage Details Form */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Usage Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {/* Department */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  Department
                  <span className="text-red-500">*</span>
                </Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="h-11 bg-white border-slate-300">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept.value} value={dept.value}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{dept.icon}</span>
                          <span className="font-medium">{dept.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Usage Type */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  Usage Type
                  <span className="text-red-500">*</span>
                </Label>
                <Select value={usageType} onValueChange={setUsageType}>
                  <SelectTrigger className="h-11 bg-white border-slate-300">
                    <SelectValue placeholder="Select usage type" />
                  </SelectTrigger>
                  <SelectContent>
                    {USAGE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{type.icon}</span>
                          <div>
                            <div className="font-medium">{type.label}</div>
                            <div className="text-xs text-slate-500">{type.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  Reason
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g., Display for promotion"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-11 bg-white border-slate-300"
                />
              </div>

              {/* Additional Notes */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Additional Notes
                  <span className="text-slate-400 text-xs ml-1">(Optional)</span>
                </Label>
                <Textarea
                  placeholder="Any additional information..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[80px] bg-white border-slate-300 resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Cart */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-emerald-600" />
                  Cart
                </CardTitle>
                <Badge className="bg-emerald-600 text-white">
                  {cart.length} {cart.length === 1 ? 'item' : 'items'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                    <PackageOpen className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Cart is empty</p>
                  <p className="text-xs text-slate-500 mt-1">Add products to get started</p>
                </div>
              ) : (
                <>
                  {/* Cart Items */}
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 transition-colors"
                      >
                        {/* Item Image */}
                        <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex-shrink-0 overflow-hidden">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-5 w-5 text-slate-300" />
                            </div>
                          )}
                        </div>

                        {/* Item Name & Cost */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-1">
                            {item.name}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formatCurrency(item.costPrice)} × {item.quantity} = <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(item.costPrice * item.quantity)}</span>
                          </p>
                        </div>

                        {/* Quantity Controls - Compact */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 rounded-md border-slate-300 hover:bg-slate-100"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <div className="w-10 h-8 flex items-center justify-center bg-white border border-slate-300 rounded-md">
                            <span className="text-sm font-bold text-slate-900">
                              {item.quantity}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 rounded-md border-slate-300 hover:bg-slate-100"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Delete Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 flex-shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Cart Summary */}
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Total Items:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {cart.reduce((sum, item) => sum + item.quantity, 0)} units
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-base font-semibold text-slate-900 dark:text-white">Total Cost:</span>
                      <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(getTotalCost())}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-11 border-slate-300"
                      onClick={clearCart}
                      disabled={submitting}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                    <Button
                      className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
                      onClick={handleSubmit}
                      disabled={submitting || !selectedDepartment || !usageType || !reason.trim()}
                    >
                      {submitting ? (
                        <>
                          <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                          Recording...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Record Usage
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Validation Warning */}
                  {cart.length > 0 && (!selectedDepartment || !usageType || !reason.trim()) && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Please fill in all required fields to record usage
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
