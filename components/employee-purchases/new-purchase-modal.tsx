"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { 
  Search, 
  Package, 
  CalendarIcon, 
  ShoppingCart, 
  Plus, 
  Minus, 
  X, 
  Gift, 
  User,
  Grid3x3,
  ChevronDown,
  Trash2,
  Send,
  ArrowLeft
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { apiGet, apiPost } from "@/lib/api-client"

interface CartItem {
  id: number
  name: string
  price: number
  quantity: number
  maxStock: number
  imageUrl?: string
  isFreebie: boolean
}

interface Product {
  id: number
  name: string
  sellingPrice: number
  quantity: number
  imageUrl?: string
}

interface NewPurchaseModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function NewPurchaseModal({ open, onClose, onSuccess }: NewPurchaseModalProps) {
  const [employeeName, setEmployeeName] = useState<string>("")
  const [deductionDate, setDeductionDate] = useState<Date>(getNextPayrollDate())
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null)

  const purchaseDate = new Date()

  useEffect(() => {
    if (open) {
      if (typeof window !== 'undefined') {
        const username = localStorage.getItem('username')
        const role = localStorage.getItem('userRole')
        
        if (!username || !role) {
          toast.error('You must be logged in to use this feature')
          return
        }
      }
      
      fetchProducts()
      setEmployeeName("")
      setCart([])
      setDeductionDate(getNextPayrollDate())
      setSearch("")
      setSelectedProduct(null)
    }
  }, [open])

  const fetchProducts = async () => {
    try {
      const data = await apiGet<any>('/api/products')
      const itemsArray = Array.isArray(data) ? data : (data.products || data.items || data.data || [])
      
      const availableItems = itemsArray.filter((item: any) => {
        const quantity = item.quantity || 0
        return quantity > 0
      })
      
      const mappedProducts = availableItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        sellingPrice: item.sellingPrice || item.selling_price || 0,
        quantity: item.quantity || 0,
        imageUrl: item.imageUrl || item.image_url
      }))
      
      setProducts(mappedProducts)
    } catch (error: any) {
      console.error('[Employee Purchases Modal] Error fetching products:', error)
      toast.error(`Failed to load products: ${error.message}`)
    }
  }

  function getNextPayrollDate(): Date {
    const today = new Date()
    const fifteenth = new Date(today.getFullYear(), today.getMonth(), 15)
    
    if (today.getDate() >= 15) {
      return new Date(today.getFullYear(), today.getMonth() + 1, 15)
    }
    return fifteenth
  }

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase()) && product.quantity > 0
  )

  const regularTotal = cart.filter(item => !item.isFreebie).reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.id === product.id && !item.isFreebie)
    
    if (existing) {
      if (existing.quantity < existing.maxStock) {
        setCart(cart.map((item) =>
          item.id === product.id && !item.isFreebie
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ))
        toast.success(`Added to cart`, { duration: 1000 })
      } else {
        toast.error(`Maximum stock reached`)
      }
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        price: product.sellingPrice,
        quantity: 1,
        maxStock: product.quantity,
        imageUrl: product.imageUrl,
        isFreebie: false
      }])
      toast.success(`Added to cart`, { duration: 1000 })
    }
    
    setSelectedProduct(product.id)
    setTimeout(() => setSelectedProduct(null), 500)
  }

  const updateQuantity = (id: number, isFreebie: boolean, quantity: number) => {
    const item = cart.find((i) => i.id === id && i.isFreebie === isFreebie)
    if (!item) return

    if (quantity < 1) {
      removeFromCart(id, isFreebie)
      return
    }

    if (quantity > item.maxStock) {
      toast.error(`Maximum stock is ${item.maxStock}`)
      return
    }

    setCart(cart.map((i) => (i.id === id && i.isFreebie === isFreebie ? { ...i, quantity } : i)))
  }

  const toggleFreebie = (id: number, currentFreebieStatus: boolean) => {
    setCart(cart.map((i) =>
      i.id === id && i.isFreebie === currentFreebieStatus
        ? { ...i, isFreebie: !currentFreebieStatus }
        : i
    ))
    toast.success(currentFreebieStatus ? 'Marked as paid item' : 'Marked as freebie 🎁', { duration: 1000 })
  }

  const removeFromCart = (id: number, isFreebie: boolean) => {
    setCart(cart.filter((item) => !(item.id === id && item.isFreebie === isFreebie)))
  }

  const clearCart = () => {
    if (cart.length === 0) return
    setCart([])
    toast.info('Cart cleared')
  }

  const handleCreatePurchase = async () => {
    if (!employeeName || employeeName.trim() === "") {
      toast.error("Please enter employee name")
      return
    }

    if (cart.length === 0) {
      toast.error("Please add items to cart")
      return
    }

    setLoading(true)

    try {
      await apiPost('/api/employee-purchases', {
        employee_name: employeeName.trim(),
        items: cart.map(item => ({
          ...item,
          actualPrice: item.isFreebie ? 0 : item.price
        })),
        deduction_date: deductionDate.toISOString(),
        total_amount: regularTotal
      })

      toast.success("Purchase created successfully!")
      setCart([])
      setEmployeeName("")
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error creating purchase:', error)
      toast.error(error.message || "Failed to create purchase")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 gap-0 bg-gradient-to-br from-slate-50 to-blue-50" hideCloseButton>
        {/* Header - Very compact */}
        <div className="flex items-center gap-2.5 px-5 py-1.5 bg-[#E8F0FE] border-b">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md">
            <ShoppingCart className="h-4 w-4 text-white" />
          </div>
          <h2 className="flex-1 text-base font-bold text-slate-900">Employee Purchase</h2>
          <button
            onClick={onClose}
            className="h-5 w-5 flex items-center justify-center rounded-md hover:bg-slate-200/60 transition-colors"
          >
            <X className="h-3.5 w-3.5 text-slate-600" strokeWidth={2.5} />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT - Products */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Search & Filter */}
            <div className="flex gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-11 bg-white border-slate-200"
                />
              </div>
              <Button variant="outline" className="h-11 px-4 bg-white border-slate-200">
                <Grid3x3 className="h-4 w-4 mr-2" />
                All Categories
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-3 gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className={cn(
                    "relative bg-white rounded-xl border-2 overflow-hidden transition-all duration-200",
                    selectedProduct === product.id 
                      ? "border-blue-500 shadow-lg shadow-blue-200 scale-105" 
                      : "border-slate-200 hover:border-blue-300 hover:shadow-md"
                  )}
                >
                  {/* Stock Badge */}
                  <div className="absolute top-3 left-3 z-10">
                    <Badge className="bg-emerald-500 text-white border-0 shadow-sm">
                      <Package className="h-3 w-3 mr-1" />
                      {product.quantity} in stock
                    </Badge>
                  </div>

                  {/* Selected Checkmark */}
                  {selectedProduct === product.id && (
                    <div className="absolute top-3 right-3 z-10 h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  {/* Product Image */}
                  <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 p-4">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-16 w-16 text-slate-300" />
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4 border-t">
                    <h3 className="font-bold text-slate-900 text-sm mb-1 line-clamp-1">
                      {product.name}
                    </h3>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xl font-bold text-blue-600">
                        ₱{product.sellingPrice.toLocaleString()}
                      </span>
                    </div>
                    <Button
                      onClick={() => addToCart(product)}
                      className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Add to Cart
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <Package className="h-16 w-16 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">No products found</p>
              </div>
            )}
          </div>

          {/* RIGHT - Cart & Info */}
          <div className="w-[420px] bg-white flex flex-col shadow-lg">
            {/* Employee Info Section */}
            <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
                  <User className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Employee Information</h3>
              </div>

              <div className="space-y-3.5">
                {/* Employee Name */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    Employee Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Enter employee name..."
                      value={employeeName}
                      onChange={(e) => setEmployeeName(e.target.value)}
                      className="pl-10 bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500 shadow-sm"
                    />
                  </div>
                </div>

                {/* Purchase Date */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    Purchase Date
                  </label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={format(purchaseDate, 'MMMM dd, yyyy')}
                      disabled
                      className="pl-10 bg-slate-50 text-slate-600 border-slate-200 shadow-sm"
                    />
                  </div>
                </div>

                {/* Deduction Date */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    Deduction Date <span className="text-red-500">*</span>
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-white hover:bg-slate-50 border-slate-300 shadow-sm"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                        {format(deductionDate, 'MMMM dd, yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white shadow-2xl border-2 border-slate-200 z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={deductionDate}
                        onSelect={(date) => date && setDeductionDate(date)}
                        initialFocus
                        className="bg-white"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Cart Section */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 bg-slate-50 border-b-2 border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center">
                    <ShoppingCart className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-900">Cart Items ({cart.length})</span>
                </div>
                {cart.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearCart}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 h-7 text-xs font-semibold"
                  >
                    Clear Cart
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <div className="h-20 w-20 rounded-full bg-slate-100 mx-auto mb-3 flex items-center justify-center">
                      <ShoppingCart className="h-10 w-10 text-slate-300" />
                    </div>
                    <p className="text-sm font-semibold text-slate-600">Cart is empty</p>
                    <p className="text-xs mt-1 text-slate-400">Add products to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item, index) => (
                      <div
                        key={`${item.id}-${item.isFreebie}-${index}`}
                        className={cn(
                          "flex gap-3 p-3 rounded-xl border-2 shadow-sm transition-all",
                          item.isFreebie 
                            ? "bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200" 
                            : "bg-white border-slate-200 hover:border-blue-200 hover:shadow-md"
                        )}
                      >
                        {/* Product Image */}
                        <div className="h-16 w-16 rounded-lg bg-white border border-slate-200 flex-shrink-0 overflow-hidden shadow-sm">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-contain p-1.5"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-7 w-7 text-slate-300" />
                            </div>
                          )}
                        </div>

                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm text-slate-900 line-clamp-1">
                                {item.name}
                              </h4>
                              {item.isFreebie ? (
                                <p className="text-xs text-pink-600 font-semibold mt-0.5">Freebie</p>
                              ) : (
                                <p className="text-xs text-slate-500 mt-0.5">₱{item.price.toLocaleString()}</p>
                              )}
                            </div>
                            <div className="ml-2 text-right">
                              <p className="font-bold text-slate-900">
                                ₱{item.isFreebie ? 0 : (item.price * item.quantity).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {/* Controls */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0 rounded"
                                onClick={() => updateQuantity(item.id, item.isFreebie, item.quantity - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0 rounded"
                                onClick={() => updateQuantity(item.id, item.isFreebie, item.quantity + 1)}
                                disabled={item.quantity >= item.maxStock}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFromCart(item.id, item.isFreebie)}
                              className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="border-t p-5 bg-slate-50">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-semibold">₱{regularTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Items:</span>
                    <span className="font-semibold">{totalItems} unit{totalItems !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="pt-2 border-t flex justify-between items-center">
                    <span className="text-lg font-bold text-slate-900">TOTAL:</span>
                    <span className="text-2xl font-bold text-blue-600">₱{regularTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-11"
                    onClick={clearCart}
                    disabled={cart.length === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Cart
                  </Button>
                  <Button
                    className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleCreatePurchase}
                    disabled={!employeeName.trim() || cart.length === 0 || loading}
                  >
                    {loading ? (
                      "Creating..."
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Create Purchase
                      </>
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
