"use client"

import { useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ShoppingCart, Trash2, CheckCircle, Package, Truck, User } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import type { InventoryItem } from "@/lib/types"
import { apiGet, apiPost } from "@/lib/api-client"
import { getCurrentUser } from "@/lib/auth"
import { formatCurrency, cn, toDisplayName } from "@/lib/utils"
import { toast } from "sonner"

interface CartItem {
  cartItemId: string  // Unique ID for each cart row
  item: InventoryItem
  quantity: number
  isFreebie?: boolean // NEW: Track if this item is a freebie
}

export default function POSPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [cart, setCart] = useState<CartItem[]>(() => {
    // Restore cart from localStorage on mount
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('pos_cart_draft')
        if (saved) {
          const parsed = JSON.parse(saved)
          // Ensure each cart item has a cartItemId (for backward compatibility)
          return parsed.map((ci: CartItem, index: number) => ({
            ...ci,
            cartItemId: ci.cartItemId || `${ci.item?.id || 'item'}-${Date.now()}-${index}`
          }))
        }
      } catch {}
    }
    return []
  })
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [staffName, setStaffName] = useState('')
  const [waybillNumber, setWaybillNumber] = useState('')
  const [staffProfileImage, setStaffProfileImage] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string>('')
  const [assignedChannel, setAssignedChannel] = useState<string>('')
  const [dispatchId, setDispatchId] = useState('')
  const [dispatchedItems, setDispatchedItems] = useState<Array<{name: string, quantity: number, price: number}>>([])
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [confirmDispatchOpen, setConfirmDispatchOpen] = useState(false) // NEW: Confirmation dialog state
  
  // Helper function to get local date in YYYY-MM-DD format
  const getLocalDateString = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Calculate total (exclude freebies from total)
  const total = useMemo(() => cart.reduce((sum, cartItem) => {
    if (cartItem.isFreebie) return sum // Freebies don't count in total
    return sum + cartItem.item.sellingPrice * cartItem.quantity
  }, 0), [cart])
  
  // Calculate freebie COGS
  const freebieCOGS = useMemo(() => cart.reduce((sum, cartItem) => {
    if (cartItem.isFreebie) return sum + cartItem.item.costPrice * cartItem.quantity
    return sum
  }, 0), [cart])

  // Helper function to get sellable quantity (good stock only, excludes bad stock)
  const getSellableQuantity = (item: InventoryItem): number => {
    // item.quantity already represents GOOD stock only (bad stock is separate)
    return item.quantity
  }

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pos_cart_draft', JSON.stringify(cart))
      } catch {}
    }
  }, [cart])

  // Get unique categories for filter chips
  const categories = useMemo(() => {
    const cats = new Set(items.map(i => i.category).filter(Boolean))
    return Array.from(cats).sort()
  }, [items])

  const filteredItems = useMemo(() => {
    let filtered = items

    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(
        (item) => item.name.toLowerCase().includes(searchLower) ||
                  item.category.toLowerCase().includes(searchLower),
      )
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(item => item.category === categoryFilter)
    }

    return filtered
  }, [search, categoryFilter, items])

  // Clear entire cart
  function clearCart() {
    setCart([])
    toast.info('Cart cleared', { duration: 1500 })
  }

  useEffect(() => {
    // Get current logged-in user using the auth helper
    const currentUser = getCurrentUser()
    console.log('[POS] Current user:', currentUser) // Debug log
    
    if (currentUser) {
      const name = currentUser.displayName || currentUser.username || 'Unknown User'
      console.log('[POS] Setting staff name to:', name) // Debug log
      setStaffName(name)
      setCurrentUserRole(currentUser.role || '')
      setAssignedChannel(currentUser.assignedChannel || '')
      
      // Fetch user profile image from API
      fetchUserProfile(currentUser.username)
    } else {
      console.warn('[POS] No current user found in localStorage')
      setStaffName('Unknown User')
    }
    
    fetchItems()
  }, [])

  async function fetchUserProfile(username: string) {
    try {
      const data = await apiGet<any>('/api/auth/profile')
      if (data.profile_image) {
        setStaffProfileImage(data.profile_image)
        console.log('[POS] Profile image loaded:', data.profile_image)
      }
    } catch (error) {
      console.error('[POS] Error fetching user profile:', error)
    }
  }

  async function fetchItems() {
    try {
      // Fetch all products
      const data = await apiGet<InventoryItem[]>("/api/products")
      const itemsArray = Array.isArray(data) ? data : []
      
      // Filter to only products with sellable stock
      // Sellable quantity = quantity - bad_item_quantity
      // Only show products where sellable quantity > 0
      const sellableItems = itemsArray.filter(item => {
        const badQuantity = item.bad_item_quantity || 0
        const sellableQuantity = item.quantity - badQuantity
        return sellableQuantity > 0
      })
      
      console.log('[POS] Fetched items count:', itemsArray.length)
      console.log('[POS] Sellable items count:', sellableItems.length)
      console.log('[POS] Filtered out items with no sellable stock:', itemsArray.length - sellableItems.length)
      console.log('[POS] First 5 items:', sellableItems.slice(0, 5))
      
      setItems(sellableItems)
    } catch (error) {
      console.error("[POS] Error fetching items:", error)
      setItems([])
    }
  }

  // Toggle freebie status
  function toggleFreebie(cartItemId: string) {
    setCart(cart.map(ci => 
      ci.cartItemId === cartItemId ? { ...ci, isFreebie: !ci.isFreebie } : ci
    ))
  }

  // Direct dispatch - no intermediate modal
  async function handleDispatchOrder() {
    if (cart.length === 0) {
      toast.error('Please add items to cart first')
      return
    }

    setLoading(true)
    try {
      // Separate regular items and freebies
      const regularItems = cart.filter(item => !item.isFreebie)
      const freebieItems = cart.filter(item => item.isFreebie)
      
      const currentUser = getCurrentUser()
      const saleId = `SALE-${Date.now()}`
      
      // Calculate totals
      const totalQty = regularItems.reduce((sum, item) => sum + item.quantity, 0)
      const totalCOGS = regularItems.reduce((sum, item) => sum + (item.item.costPrice * item.quantity), 0)
      const totalAmount = regularItems.reduce((sum, item) => sum + (item.item.sellingPrice * item.quantity), 0)
      const productList = cart.map(item => 
        `${item.item.name} (${item.quantity})${item.isFreebie ? ' 🎁' : ''}`
      ).join(', ')
      
      // 1. Create SALE for regular items (using /api/sales - creates transactions)
      if (regularItems.length > 0) {
        const saleItems = regularItems.map((cartItem) => ({
          itemId: cartItem.item.id,
          quantity: cartItem.quantity,
        }))

        await apiPost("/api/sales", {
          items: saleItems,
          department: 'POS - Walk-in',
          staffName: staffName,
          notes: freebieItems.length > 0 ? `Includes ${freebieItems.length} freebie item(s)` : ''
        })
      }
      
      // 2. Create ORDER record (for Dashboard and Sales page)
      // POS sales are created directly as Packed & Delivered (walk-in sales)
      if (regularItems.length > 0) {
        console.log('[POS] Creating order with data:', {
          qty: totalQty,
          cogs: totalCOGS,
          total: totalAmount,
          product: productList,
          dispatchedBy: staffName,
          waybillNumber: waybillNumber
        })
        
        const orderResponse = await apiPost("/api/pos/checkout", {
          items: regularItems.map(cartItem => ({
            id: cartItem.item.id,
            name: cartItem.item.name,
            quantity: cartItem.quantity,
            costPrice: cartItem.item.costPrice,
            sellingPrice: cartItem.item.sellingPrice
          })),
          qty: totalQty,
          cogs: totalCOGS,
          total: totalAmount,
          product: productList,
          dispatchedBy: staffName,
          waybillNumber: waybillNumber.trim() || null
        })
        
        console.log('[POS] Order created successfully:', orderResponse)
        console.log('[POS] Order created successfully:', orderResponse)
      }
      
      // 3. Create FREEBIE records (for freebie items)
      if (freebieItems.length > 0) {
        const freebieData = freebieItems.map((cartItem) => ({
          itemId: cartItem.item.id,
          itemName: cartItem.item.name,
          quantity: cartItem.quantity,
          costPrice: cartItem.item.costPrice,
          totalCOGS: cartItem.item.costPrice * cartItem.quantity,
        }))

        await apiPost("/api/freebies", {
          items: freebieData,
          reason: regularItems.length > 0 ? 'With purchase' : 'Promotional giveaway',
          dispatchedBy: staffName,
          dispatchedDate: getLocalDateString(),
          givenWithSale: regularItems.length > 0 ? saleId : null
        })
      }

      // Generate dispatch ID
      const newDispatchId = `DIS-${Date.now()}`
      setDispatchId(newDispatchId)
      
      // Store dispatched items for display
      setDispatchedItems(cart.map(cartItem => ({
        name: `${cartItem.item.name}${cartItem.isFreebie ? ' 🎁 FREE' : ''}`,
        quantity: cartItem.quantity,
        price: cartItem.isFreebie ? 0 : cartItem.item.sellingPrice * cartItem.quantity
      })))
      
      // Clear cart
      setCart([])
      setWaybillNumber('') // Clear waybill number
      localStorage.removeItem('pos_cart_draft')
      
      // Refresh items
      await fetchItems()
      
      // Show success modal
      setSuccessModalOpen(true)
      
      toast.success('Order dispatched successfully!')
    } catch (error: any) {
      console.error('[POS] Error dispatching order:', error)
      const errorMessage = error?.message || 'Failed to dispatch order'
      console.error('[POS] Error details:', errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  function addToCart(item: InventoryItem) {
    const sellableQty = getSellableQuantity(item)

    // Check total quantity already in cart for this item across all rows
    const totalInCart = cart
      .filter(ci => ci.item.id === item.id)
      .reduce((sum, ci) => sum + ci.quantity, 0)

    if (totalInCart >= sellableQty) {
      toast.warning(`Maximum stock reached for ${item.name}`, {
        duration: 2000,
        icon: '⚠️',
      })
      return
    }

    // Always add as a new separate row (for buy 1 take 1 scenarios)
    const newCartItem: CartItem = {
      cartItemId: `${item.id}-${Date.now()}`,
      item,
      quantity: 1,
      isFreebie: false
    }
    setCart([...cart, newCartItem])
    toast.success(`${item.name} added to cart`, {
      duration: 2000,
      icon: '✓',
    })
  }

  function updateQuantity(cartItemId: string, quantity: number) {
    const cartItem = cart.find((ci) => ci.cartItemId === cartItemId)
    if (!cartItem) return

    if (quantity <= 0) {
      removeFromCart(cartItemId)
      return
    }

    // Check total in cart for this product excluding current row
    const otherRowsTotal = cart
      .filter(ci => ci.item.id === cartItem.item.id && ci.cartItemId !== cartItemId)
      .reduce((sum, ci) => sum + ci.quantity, 0)

    const sellableQty = getSellableQuantity(cartItem.item)
    const maxForThisRow = sellableQty - otherRowsTotal
    const finalQuantity = Math.min(quantity, maxForThisRow)
    setCart(cart.map((ci) => (ci.cartItemId === cartItemId ? { ...ci, quantity: finalQuantity } : ci)))
  }

  function removeFromCart(cartItemId: string) {
    setCart(cart.filter((cartItem) => cartItem.cartItemId !== cartItemId))
  }

  // NEW: Cart modal state
  const [cartModalOpen, setCartModalOpen] = useState(false)

  return (
    <div className="w-full py-5">
      {/* Page Header with Floating Cart Button */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold gradient-text">Point of Sale</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select products to add to cart
          </p>
        </div>
        
        {/* Professional Corporate Cart Button */}
        <button
          onClick={() => setCartModalOpen(true)}
          className="relative group"
        >
          {/* Main Button Container */}
          <div className="relative inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-amber-500 shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5">
            {/* Cart Icon with Animated Background */}
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 dark:bg-amber-500 opacity-10 rounded-lg group-hover:opacity-20 transition-opacity"></div>
              <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-amber-500 relative z-10" strokeWidth={2.5} />
            </div>
            
            {/* Cart Text & Count */}
            <div className="flex flex-col items-start">
              <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Shopping Cart
              </span>
              {cart.length > 0 && (
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {cart.length} {cart.length === 1 ? 'item' : 'items'} • ₱{total.toFixed(2)}
                </span>
              )}
            </div>

            {/* Item Count Badge - Corporate Style */}
            {cart.length > 0 && (
              <div className="absolute -top-2 -right-2 min-w-[26px] h-[26px] px-1.5 rounded-full bg-gradient-to-br from-red-500 to-red-600 dark:from-red-500 dark:to-red-700 text-white text-xs font-bold flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900 animate-pulse">
                {cart.length > 99 ? '99+' : cart.length}
              </div>
            )}
          </div>

          {/* Hover Effect Border Glow */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 to-blue-600/20 dark:from-amber-500/20 dark:to-amber-600/20 opacity-0 group-hover:opacity-100 blur-sm transition-opacity -z-10"></div>
        </button>
      </div>

      {/* Full Width Products Grid */}
      <div className="space-y-4">

      {/* Full Width Products Grid */}
      <div className="space-y-4">
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-900">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                Products ({filteredItems.length})
              </CardTitle>
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {/* Category Filter Chips */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                <button
                  onClick={() => setCategoryFilter("all")}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                    categoryFilter === "all"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                >
                  All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat === categoryFilter ? "all" : cat)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                      categoryFilter === cat
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </CardHeader>

          <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2.5">
                {filteredItems.map((item) => {
                  const sellableQty = getSellableQuantity(item)
                  const isLowStock = sellableQty <= item.reorderLevel && sellableQty > 0
                  const isOutOfStock = sellableQty === 0
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      disabled={isOutOfStock}
                      className={cn(
                        "group relative overflow-hidden transition-all duration-200 text-left border rounded-lg flex flex-col",
                        isOutOfStock
                          ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 opacity-60 cursor-not-allowed"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 hover:-translate-y-0.5 cursor-pointer active:scale-95"
                      )}
                    >
                      {/* Image Section - Reduced height */}
                      <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        {item.imageUrl ? (
                          <img 
                            src={item.imageUrl} 
                            alt={item.name}
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                          </div>
                        )}
                        
                        {/* Stock Badge - Smaller */}
                        <div className="absolute top-1 right-1">
                          <span className={cn(
                            "px-1.5 py-0.5 text-[8px] font-bold rounded shadow-sm",
                            isOutOfStock
                              ? "bg-red-500 text-white"
                              : isLowStock
                              ? "bg-amber-500 text-white"
                              : "bg-green-600 text-white"
                          )}>
                            {isOutOfStock ? "OUT" : sellableQty}
                          </span>
                        </div>

                        {/* Add Button Hover - Smaller */}
                        {!isOutOfStock && (
                          <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Product Info - More compact */}
                      <div className="p-1.5 flex flex-col gap-0.5 bg-white dark:bg-[#1a1a1a] border-t border-slate-100 dark:border-amber-500/10">
                        <h3 
                          className="font-semibold text-slate-800 dark:text-white line-clamp-2 leading-tight min-h-[24px]" 
                          style={{ fontSize: '11px' }}
                          title={item.name}
                        >
                          {toDisplayName(item.name)}
                        </h3>
                        
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            ₱{item.sellingPrice.toFixed(0)}
                          </span>
                          {currentUserRole !== 'operations' && currentUserRole !== 'dept-manager' && (
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 tabular-nums">
                              ₱{item.costPrice.toFixed(0)}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              
              {filteredItems.length === 0 && (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400 font-semibold">
                    {search || categoryFilter !== "all" ? "No products match your filters" : "No products available"}
                  </p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                    {search || categoryFilter !== "all"
                      ? "Try clearing your search or category filter"
                      : "Add products in Inventory to get started"}
                  </p>
                  {(search || categoryFilter !== "all") && (
                    <button
                      onClick={() => { setSearch(""); setCategoryFilter("all") }}
                      className="mt-3 text-xs text-blue-600 dark:text-amber-400 underline hover:no-underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Professional Corporate Cart Modal */}
      <Dialog open={cartModalOpen} onOpenChange={setCartModalOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl border-0 shadow-2xl [&>button]:hidden">
          {/* Premium Header - Warehouse Style */}
          <div className="relative overflow-hidden bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 px-6 py-4">
            {/* Background warehouse image effect */}
            <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLThoLTJ2LTRoMnY0em0tNiA4aC0ydi00aDJ2NHptMC04aC0ydi00aDJ2NHoiLz48L2c+PC9nPjwvc3ZnPg==')]"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-950/50 via-transparent to-blue-950/30 pointer-events-none"></div>

            <div className="relative flex items-center justify-between gap-4">
              {/* Left - Icon + Title + Subtitle + Badges */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Cart Icon Box */}
                <div className="flex-shrink-0 w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <ShoppingCart className="h-7 w-7 text-white" />
                </div>

                {/* Vertical Divider */}
                <div className="w-px h-12 bg-white/20 flex-shrink-0"></div>

                {/* Title + Subtitle */}
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-2xl font-bold !text-white tracking-tight leading-tight">
                    Shopping Cart
                  </DialogTitle>
                  <p className="text-blue-200/80 text-xs mt-0.5">
                    Manage orders and dispatch for warehouse operations
                  </p>
                </div>
              </div>

              {/* Right - Total Amount */}
              <div className="flex items-center gap-3 flex-shrink-0 pl-4 border-l border-white/20">
                <div className="text-right leading-none">
                  <div className="text-xs font-semibold text-blue-200/80 mb-0.5">
                    Total Amount
                  </div>
                  <div className="text-2xl font-black text-yellow-400 tabular-nums tracking-tight -mt-0.5">
                    ₱{total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {freebieCOGS > 0 && (
                    <div className="text-[10px] font-semibold text-orange-300 mt-0.5">
                      +₱{freebieCOGS.toFixed(2)} freebies
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cart Items - Premium Design */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-950/50 dark:to-slate-900">
            {cart.length === 0 ? (
              <div className="text-center py-20">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-2xl"></div>
                  <div className="relative p-6 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-3xl">
                    <ShoppingCart className="h-20 w-20 text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Your cart is empty</h3>
                <p className="text-slate-600 dark:text-slate-400 text-lg">Start adding products to begin checkout</p>
              </div>
            ) : (
              cart.map((cartItem) => {
                // Get fresh item data from items array (not cached cart data)
                const freshItem = items.find(i => i.id === cartItem.item.id) || cartItem.item
                const sellableQty = getSellableQuantity(freshItem)
                const itemTotal = cartItem.isFreebie ? 0 : freshItem.sellingPrice * cartItem.quantity
                
                return (
                  <div
                    key={cartItem.cartItemId}
                    className={cn(
                      "rounded-xl border transition-all p-3",
                      cartItem.isFreebie 
                        ? "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-700" 
                        : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700"
                    )}
                  >
                    {/* Enterprise-Grade Balanced Layout - Proportional Spacing */}
                    <div className="flex items-center gap-4">
                      
                      {/* Product Image - Refined Size */}
                      <div className="w-14 h-14 flex-shrink-0 rounded-md overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {freshItem.imageUrl ? (
                          <img 
                            src={freshItem.imageUrl} 
                            alt={freshItem.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                          </div>
                        )}
                      </div>

                      {/* Product Info - Compact & Balanced */}
                      <div className="flex-1 min-w-0 max-w-[180px]">
                        <h4 className="font-semibold text-[10px] text-slate-900 dark:text-white mb-0.5 truncate leading-tight">
                          {toDisplayName(freshItem.name)}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Cost: ₱{freshItem.costPrice.toFixed(2)}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Stock: {sellableQty}
                        </p>
                      </div>

                      {/* Quantity Section - Stepper with Maintained Width */}
                      <div className="flex flex-col items-center gap-0.5 ml-4">
                        <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Qty</span>
                        <div className="flex items-center bg-white dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-600">
                          <button
                            onClick={() => updateQuantity(cartItem.cartItemId, cartItem.quantity - 1)}
                            className="h-7 w-7 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-base transition-colors rounded-l-md"
                          >
                            −
                          </button>
                          <Input
                            type="number"
                            min="1"
                            max={sellableQty}
                            value={cartItem.quantity}
                            onChange={(e) => {
                              const value = e.target.value
                              if (value === '') return
                              const numValue = parseInt(value, 10)
                              if (!isNaN(numValue) && numValue >= 1) {
                                if (numValue > sellableQty) {
                                  toast.warning(`Maximum available stock is ${sellableQty} units`, {
                                    duration: 2000,
                                    icon: '⚠️',
                                  })
                                }
                                updateQuantity(cartItem.cartItemId, numValue)
                              }
                            }}
                            className="h-7 w-14 text-center font-semibold text-sm bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none px-1"
                          />
                          <button
                            onClick={() => updateQuantity(cartItem.cartItemId, cartItem.quantity + 1)}
                            className="h-7 w-7 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-base transition-colors rounded-r-md"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Subtotal Section - Refined Size */}
                      <div className="flex flex-col items-end gap-0.5 min-w-[90px] ml-4">
                        <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Subtotal</span>
                        <div className="text-base font-bold text-slate-900 dark:text-white">
                          {cartItem.isFreebie ? (
                            <span className="text-orange-600 dark:text-orange-400">FREE</span>
                          ) : (
                            `₱${itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          )}
                        </div>
                      </div>

                      {/* Action Icons - Pushed to far right */}
                      <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                        {/* Gift Icon - Toggle Freebie */}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => toggleFreebie(cartItem.cartItemId)} 
                          className={cn(
                            "h-9 w-9 p-0 transition-all rounded-lg border",
                            cartItem.isFreebie
                              ? "bg-orange-100 text-orange-600 border-orange-300 hover:bg-orange-200"
                              : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300"
                          )}
                          title={cartItem.isFreebie ? "Remove freebie status" : "Mark as freebie"}
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/>
                          </svg>
                        </Button>
                        
                        {/* Delete Icon */}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeFromCart(cartItem.cartItemId)} 
                          className="h-9 w-9 p-0 bg-slate-100 text-slate-500 border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-300 rounded-lg transition-all"
                          title="Remove from cart"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                    </div>

                  </div>
                )
              })
            )}
          </div>

          {/* Clean Dispatch Section */}
          {cart.length > 0 && (
            <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-5 space-y-4">
              
              {/* Waybill Number Input - MOVED TO TOP */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Waybill Number (Optional)
                </label>
                <Input
                  placeholder="Enter waybill/tracking number"
                  value={waybillNumber}
                  onChange={(e) => setWaybillNumber(e.target.value)}
                  className="h-11"
                />
              </div>

              {/* Dispatched By - MOVED TO BOTTOM */}
              <div>
                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 block">
                  Dispatched By
                </Label>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {staffProfileImage ? (
                    <img 
                      src={staffProfileImage} 
                      alt={staffName}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-lg">
                      {staffName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {staffName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      <span className="text-xs text-slate-600 dark:text-slate-400">Currently logged in</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                    Verified
                  </span>
                </div>
              </div>

              <Button
                onClick={() => setConfirmDispatchOpen(true)}
                disabled={loading || cart.length === 0}
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 hover:from-slate-800 hover:via-slate-700 hover:to-slate-800 dark:from-white dark:via-slate-50 dark:to-white dark:hover:from-slate-50 dark:hover:via-white dark:hover:to-slate-50 text-white dark:text-slate-900 shadow-xl hover:shadow-2xl transition-all duration-200 rounded-xl"
                size="lg"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 border-3 border-white/30 border-t-white dark:border-slate-900/30 dark:border-t-slate-900 rounded-full animate-spin"></div>
                    <span>Processing Order...</span>
                  </div>
                ) : (
                  <>
                    <Truck className="h-6 w-6 mr-2" />
                    Dispatch Order • {cart.length} {cart.length === 1 ? 'Item' : 'Items'}
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog - NEW */}
      <Dialog open={confirmDispatchOpen} onOpenChange={setConfirmDispatchOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white text-xl font-semibold flex items-center gap-2">
              <Truck className="h-6 w-6 text-blue-500" />
              Confirm Order Dispatch
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              Are you sure you want to dispatch this order?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {/* Order Summary */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Total Items:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{cart.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Total Amount:</span>
                <span className="font-bold text-lg text-slate-900 dark:text-white">
                  ₱{total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {freebieCOGS > 0 && (
                <div className="flex justify-between text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-orange-600 dark:text-orange-400">Freebies:</span>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                    {cart.filter(item => item.isFreebie).length} item(s)
                  </span>
                </div>
              )}
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400">
              This action will update inventory and create a sale record. This cannot be undone.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDispatchOpen(false)}
              className="flex-1"
              disabled={loading}
            >
              No, Cancel
            </Button>
            <Button
              onClick={async () => {
                setConfirmDispatchOpen(false)
                setCartModalOpen(false)
                await handleDispatchOrder()
              }}
              disabled={loading}
              className="flex-1 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900"
            >
              Yes, Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal - Updated for Freebies */}
      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white text-xl font-semibold flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
              Transaction Completed!
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              Sale processed and inventory updated
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-center text-green-800 dark:text-green-200 font-medium mb-2">
                ✓ Transaction Successful
              </p>
              <p className="text-center text-sm text-green-700 dark:text-green-300">
                Transaction ID: <span className="font-mono font-bold">{dispatchId}</span>
              </p>
            </div>

            {/* Product Details */}
            {dispatchedItems.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Items</h4>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-700 max-h-48 overflow-y-auto">
                  {dispatchedItems.map((item, index) => {
                    const isFree = item.name.includes('🎁 FREE')
                    return (
                      <div 
                        key={index} 
                        className={cn(
                          "px-4 py-3 flex items-center justify-between transition-colors",
                          isFree 
                            ? "bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20" 
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Qty: {item.quantity}
                          </p>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <p className={cn(
                            "text-sm font-bold",
                            isFree 
                              ? "text-amber-600 dark:text-amber-400" 
                              : "text-slate-900 dark:text-white"
                          )}>
                            {isFree ? 'FREE' : formatCurrency(item.price)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Total</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatCurrency(dispatchedItems.reduce((sum, item) => sum + item.price, 0))}
                    </span>
                  </div>
                  {dispatchedItems.some(i => i.name.includes('🎁 FREE')) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      + {dispatchedItems.filter(i => i.name.includes('🎁 FREE')).length} freebie item(s)
                    </p>
                  )}
                </div>
              </div>
            )}
            
            <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <p>✓ Sale recorded</p>
              <p>✓ Inventory updated</p>
              <p>✓ Staff: {staffName}</p>
              {dispatchedItems.some(i => i.name.includes('🎁 FREE')) && (
                <p className="text-amber-600 dark:text-amber-400">
                  🎁 Freebies tracked separately
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSuccessModalOpen(false)} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
