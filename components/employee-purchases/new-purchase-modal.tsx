"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  category?: string
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
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
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
      setCategoryFilter("all")
      setSelectedProduct(null)
    }
  }, [open])

  const fetchProducts = async () => {
    try {
      const data = await apiGet<any>('/api/products')
      console.log('[Employee Purchases] RAW API Response:', data)
      
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
        imageUrl: item.imageUrl || item.image_url,
        category: item.category || 'Uncategorized'
      }))
      
      console.log('[Employee Purchases] Loaded products with categories:', mappedProducts.map(p => ({ name: p.name, category: p.category })))
      
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

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter
    const hasStock = product.quantity > 0
    
    return matchesSearch && matchesCategory && hasStock
  })

  // Get unique categories from products (exclude 'Uncategorized' if there are other categories)
  const allCategories = Array.from(new Set(products.map(p => p.category || 'Uncategorized'))).sort()
  const hasRealCategories = allCategories.some(cat => cat !== 'Uncategorized')
  const categories = hasRealCategories ? allCategories.filter(cat => cat !== 'Uncategorized') : allCategories

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
              
              {/* Category Filter Dropdown */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-11 w-[200px] bg-white border-slate-200">
                  <Grid3x3 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-4 gap-3">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.quantity === 0}
                  className={cn(
                    "group relative overflow-hidden transition-all duration-200 text-left border-2 rounded-xl flex flex-col",
                    product.quantity === 0
                      ? "border-red-200 bg-red-50 opacity-60 cursor-not-allowed"
                      : "border-slate-200 bg-white hover:shadow-lg hover:border-blue-400 hover:-translate-y-1 cursor-pointer active:scale-95",
                    selectedProduct === product.id && "ring-2 ring-blue-500 border-blue-500 shadow-xl scale-[1.02]"
                  )}
                >
                  {/* Image Section */}
                  <div className="relative w-full aspect-square bg-slate-100 overflow-hidden">
                    {product.imageUrl ? (
                      <img 
                        src={product.imageUrl} 
                        alt={product.name}
                        className="w-full h-full object-contain p-3"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-12 w-12 text-slate-300" />
                      </div>
                    )}
                    
                    {/* Stock Badge */}
                    <div className="absolute top-2 right-2">
                      <span className={cn(
                        "px-2 py-1 text-[10px] font-bold rounded-md shadow-sm flex items-center gap-1",
                        product.quantity === 0
                          ? "bg-red-500 text-white"
                          : product.quantity <= 10
                          ? "bg-amber-500 text-white"
                          : "bg-emerald-500 text-white"
                      )}>
                        <Package className="h-3 w-3" />
                        {product.quantity === 0 ? "OUT" : product.quantity}
                      </span>
                    </div>

                    {/* Add Button Hover */}
                    {product.quantity > 0 && (
                      <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                          <ShoppingCart className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    )}

                    {/* Selected Checkmark */}
                    {selectedProduct === product.id && (
                      <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shadow-lg animate-in zoom-in duration-200">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Product Info - Rebuilt */}
                  <div className="p-2 bg-white border-t border-slate-200">
                    <div className="mb-1">
                      <p 
                        style={{ fontSize: '8px', lineHeight: '1.2' }}
                        className="font-semibold text-slate-900 overflow-hidden"
                        title={product.name}
                      >
                        {product.name}
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-600">
                        ₱{product.sellingPrice.toLocaleString()}
                      </span>
                      {product.quantity > 0 && (
                        <span style={{ fontSize: '9px' }} className="text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                          In Stock
                        </span>
                      )}
                    </div>
                  </div>
                </button>
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
