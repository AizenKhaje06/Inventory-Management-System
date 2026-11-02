"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Package, Plus, Minus, Trash2, Save, Search, Building2, PackageOpen, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatNumber } from "@/lib/utils"
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
  { value: 'Facebook', label: 'Facebook', icon: '📘' },
  { value: 'TikTok', label: 'TikTok', icon: '🎵' },
  { value: 'Shopee', label: 'Shopee', icon: '🛍️' },
  { value: 'Lazada', label: 'Lazada', icon: '🛒' },
  { value: 'Office', label: 'Office', icon: '🏢' }
]

const USAGE_TYPES = [
  { value: 'demo', label: 'Demo/Display' },
  { value: 'internal', label: 'Internal Use' },
  { value: 'transfer', label: 'Transfer/Relocation' }
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold gradient-text">Internal Usage</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Record items used for demo, display, or internal consumption
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Selection - Left Side */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  placeholder="Search products by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Products Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full text-center py-8 text-slate-500">
                Loading products...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="col-span-full text-center py-8 text-slate-500">
                No products found
              </div>
            ) : (
              filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => addToCart(item)}
                >
                  <CardContent className="p-4">
                    <div className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="h-12 w-12 text-slate-400" />
                      )}
                    </div>
                    <h3 className="font-medium text-sm mb-1 line-clamp-2">{item.name}</h3>
                    <div className="flex items-center justify-between">
                      <Badge variant={item.quantity > 0 ? "default" : "destructive"}>
                        Stock: {item.quantity}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Cart & Form - Right Side */}
        <div className="space-y-4">
          {/* Department & Usage Type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Usage Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Department *</Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept.value} value={dept.value}>
                        <span className="flex items-center gap-2">
                          <span>{dept.icon}</span>
                          {dept.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Usage Type *</Label>
                <Select value={usageType} onValueChange={setUsageType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select usage type" />
                  </SelectTrigger>
                  <SelectContent>
                    {USAGE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reason *</Label>
                <Input
                  placeholder="e.g., Display for promotion"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Additional Notes (Optional)</Label>
                <Input
                  placeholder="Any additional information"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Cart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PackageOpen className="h-5 w-5" />
                Cart ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Cart is empty</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            Cost: {formatCurrency(item.costPrice)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Total Items:</span>
                      <span className="font-medium">
                        {cart.reduce((sum, item) => sum + item.quantity, 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Total Cost:</span>
                      <span className="text-lg font-bold">{formatCurrency(getTotalCost())}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={clearCart}
                      disabled={submitting}
                    >
                      Clear
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? (
                        "Recording..."
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Record Usage
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
