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
        if (saved) return JSON.parse(saved)
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

  // Helper function to calculate sellable quantity (total - bad stock)
  const getSellableQuantity = (item: InventoryItem): number => {
    const badQuantity = item.bad_item_quantity || 0
    return Math.max(0, item.quantity - badQuantity)
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
  function toggleFreebie(itemId: string) {
    setCart(cart.map(ci => 
      ci.item.id === itemId ? { ...ci, isFreebie: !ci.isFreebie } : ci
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
    const existingItem = cart.find((cartItem) => cartItem.item.id === item.id)
    const sellableQty = getSellableQuantity(item)

    if (existingItem) {
      if (existingItem.quantity < sellableQty) {
        setCart(
          cart.map((cartItem) =>
            cartItem.item.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem,
          ),
        )
        // Toast for quantity increase
        toast.success(`${item.name} quantity increased to ${existingItem.quantity + 1}`, {
          duration: 2000,
          icon: '➕',
        })
      } else {
        // Toast when max stock reached
        toast.warning(`Maximum stock reached for ${item.name}`, {
          duration: 2000,
          icon: '⚠️',
        })
      }
    } else {
      setCart([...cart, { item, quantity: 1 }])
      // Toast for new item added
      toast.success(`${item.name} added to cart`, {
        duration: 2000,
        icon: '✓',
      })
    }
  }

  function updateQuantity(itemId: string, quantity: number) {
    const cartItem = cart.find((ci) => ci.item.id === itemId)
    if (!cartItem) return

    if (quantity <= 0) {
      removeFromCart(itemId)
      return
    }

    // Allow any quantity to be entered, but cap at sellable stock
    const sellableQty = getSellableQuantity(cartItem.item)
    const finalQuantity = Math.min(quantity, sellableQty)
    setCart(cart.map((ci) => (ci.item.id === itemId ? { ...ci, quantity: finalQuantity } : ci)))
  }

  function removeFromCart(itemId: string) {
    setCart(cart.filter((cartItem) => cartItem.item.id !== itemId))
  }

  // NEW: Cart modal state
  const [cartModalOpen, setCartModalOpen] = useState(false)

  return (
    <div className="w-full py-5">
      {/* Page Header with Floating Cart Button */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold gradient-text">Point of Sale</h2>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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
                      {/* Image Section */}
                      <div className="relative w-full aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        {item.imageUrl ? (
                          <img 
                            src={item.imageUrl} 
                            alt={item.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                          </div>
                        )}
                        
                        {/* Stock Badge */}
                        <div className="absolute top-1.5 right-1.5">
                          <span className={cn(
                            "px-1.5 py-0.5 text-[9px] font-bold rounded shadow-sm",
                            isOutOfStock
                              ? "bg-red-500 text-white"
                              : isLowStock
                              ? "bg-amber-500 text-white"
                              : "bg-slate-900/70 text-white"
                          )}>
                            {isOutOfStock ? "OUT" : sellableQty}
                          </span>
                        </div>

                        {/* Add Button Hover */}
                        {!isOutOfStock && (
                          <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="p-2 flex flex-col gap-1 bg-white dark:bg-[#1a1a1a] border-t border-slate-100 dark:border-amber-500/10">
                        <h3 
                          className="font-semibold text-slate-800 dark:text-white line-clamp-2 leading-snug min-h-[28px]" 
                          style={{ fontSize: '13px' }}
                          title={item.name}
                        >
                          {toDisplayName(item.name)}
                        </h3>
                        
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            ₱{item.sellingPrice.toFixed(0)}
                          </span>
                          {currentUserRole !== 'operations' && currentUserRole !== 'dept-manager' && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                              COGS ₱{item.costPrice.toFixed(0)}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          {/* Clean Header */}
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white">
                  Cart Summary
                </DialogTitle>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors flex items-center gap-1.5 mt-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear All Items
                  </button>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                  ₱{total.toFixed(2)}
                </div>
                {freebieCOGS > 0 && (
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    +₱{freebieCOGS.toFixed(2)} freebies
                  </div>
                )}
                {cart.length > 0 && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {cart.length} item{cart.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cart Items - Clean Professional Design */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-slate-50 dark:bg-slate-950">
            {cart.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingCart className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" strokeWidth={1.5} />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Your cart is empty</h3>
                <p className="text-slate-600 dark:text-slate-400">Start adding products to begin checkout</p>
              </div>
            ) : (
              cart.map((cartItem) => {
                const sellableQty = getSellableQuantity(cartItem.item)
                const itemTotal = cartItem.isFreebie ? 0 : cartItem.item.sellingPrice * cartItem.quantity
                
                return (
                  <div
                    key={cartItem.item.id}
                    className={cn(
                      "rounded-lg border transition-all bg-white dark:bg-slate-900",
                      cartItem.isFreebie 
                        ? "border-slate-300 dark:border-slate-600" 
                        : "border-slate-200 dark:border-slate-700"
                    )}
                  >
                    {/* Freebie Toggle - With Color When Active */}
                    <button
                      onClick={() => toggleFreebie(cartItem.item.id)}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b",
                        cartItem.isFreebie
                          ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-600"
                          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      🎁 {cartItem.isFreebie ? 'Remove Freebie Status' : 'Mark as Freebie'}
                    </button>

                    {/* Product Info */}
                    <div className="p-4">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-base text-slate-900 dark:text-white">
                              {toDisplayName(cartItem.item.name)}
                            </h4>
                            {cartItem.isFreebie && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                FREE
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {cartItem.isFreebie ? (
                              <>Cost: ₱{cartItem.item.costPrice.toFixed(2)} × {cartItem.quantity}</>
                            ) : (
                              <>Price: ₱{cartItem.item.sellingPrice.toFixed(2)} × {cartItem.quantity}</>
                            )}
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeFromCart(cartItem.item.id)} 
                          className="h-9 w-9 p-0 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Quantity + Total */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Quantity
                          </Label>
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
                                updateQuantity(cartItem.item.id, numValue)
                              }
                            }}
                            className="h-10 text-center font-semibold"
                          />
                        </div>
                        <div className="text-right">
                          <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">
                            Subtotal
                          </Label>
                          <div className={cn(
                            "text-2xl font-bold tabular-nums pt-1.5",
                            cartItem.isFreebie 
                              ? "text-slate-400 dark:text-slate-500 line-through" 
                              : "text-slate-900 dark:text-white"
                          )}>
                            ₱{itemTotal.toFixed(2)}
                          </div>
                        </div>
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

              {/* Waybill Number Input */}
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

              <Button
                onClick={() => {
                  setCartModalOpen(false)
                  handleDispatchOrder()
                }}
                disabled={loading || cart.length === 0}
                className="w-full h-12 text-base font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900"
                size="lg"
              >
                {loading ? (
                  "Processing..."
                ) : (
                  <>
                    <Truck className="h-5 w-5 mr-2" />
                    Dispatch Order ({cart.length} item{cart.length !== 1 ? 's' : ''})
                  </>
                )}
              </Button>
            </div>
          )}
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
