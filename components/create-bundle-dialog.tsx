'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Package, X, TrendingDown, Search, Check, ChevronDown, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost, apiPut } from '@/lib/api-client'
import type { InventoryItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ImageUpload } from '@/components/ui/image-upload'

interface CreateBundleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  editMode?: boolean
  bundleId?: string
  initialData?: {
    name: string
    description?: string
    bundlePrice: number
    badge?: string
    salesChannel?: string
    store?: string
    imageUrl?: string
    bundleItems?: Array<{
      itemId: string
      itemName: string
      quantity: number
      unitPrice: number
      unitCost: number
    }>
  }
}

interface BundleItem {
  itemId: string
  itemName: string
  quantity: number
  unitPrice: number
  unitCost: number
}

export function CreateBundleDialog({ open, onOpenChange, onSuccess, editMode = false, bundleId, initialData }: CreateBundleDialogProps) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    bundlePrice: 0,
    badge: '',
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false)
      }
    }

    if (searchOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [searchOpen])

  useEffect(() => {
    if (open) {
      fetchItems()
      
      // If edit mode and has initial data, pre-fill everything
      if (editMode && initialData) {
        console.log('[CreateBundleDialog] Edit mode - Loading initial data:', initialData)
        setFormData({
          name: initialData.name || '',
          description: initialData.description || '',
          bundlePrice: initialData.bundlePrice || 0,
          badge: initialData.badge || '',
        })
        setImageUrl(initialData.imageUrl || null)
        setBundleItems(initialData.bundleItems || [])
      } else {
        // Create mode - reset form
        resetForm()
        setImageUrl(null)
      }
    }
  }, [open, editMode, initialData])

  const fetchItems = async () => {
    try {
      const data = await apiGet<InventoryItem[]>('/api/items')
      console.log('[Fetch Items] Received items:', data?.length || 0)
      if (data && data.length > 0) {
        console.log('[Fetch Items] Sample item:', data[0])
      }
      setItems(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching items:', error)
      toast.error('Failed to load items')
    }
  }

  const addBundleItem = (itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    const exists = bundleItems.find(bi => bi.itemId === itemId)
    if (exists) {
      toast.warning('Item already added to bundle')
      return
    }

    console.log('[Add Bundle Item]', item.name, '- Stock:', item.quantity)

    setBundleItems([...bundleItems, {
      itemId: item.id,
      itemName: item.name,
      quantity: 1,
      unitPrice: item.sellingPrice,
      unitCost: item.costPrice
    }])
    
    setSearchOpen(false)
    setSearchValue('')
    toast.success(`${item.name} added to bundle`)
  }

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity < 1) return
    setBundleItems(bundleItems.map(bi => 
      bi.itemId === itemId ? { ...bi, quantity } : bi
    ))
  }

  const removeItem = (itemId: string) => {
    setBundleItems(bundleItems.filter(bi => bi.itemId !== itemId))
  }

  // Calculate how many bundles can be made based on available stock
  const calculateVirtualStock = () => {
    if (bundleItems.length === 0) return 0
    
    const possibleBundles = bundleItems.map(bi => {
      const item = items.find(i => i.id === bi.itemId)
      if (!item) {
        console.warn('[Virtual Stock] Item not found:', bi.itemId)
        return 0
      }
      if (!item.quantity && item.quantity !== 0) {
        console.warn('[Virtual Stock] Item has no quantity field:', item)
        return 0
      }
      if (item.quantity === 0) return 0
      
      const canMake = Math.floor(item.quantity / bi.quantity)
      console.log('[Virtual Stock]', bi.itemName, '- Stock:', item.quantity, 'Need:', bi.quantity, 'Can make:', canMake)
      return canMake
    })
    
    const result = Math.min(...possibleBundles)
    console.log('[Virtual Stock] Final result:', result, 'from:', possibleBundles)
    return result
  }

  const calculateTotals = () => {
    const regularPrice = bundleItems.reduce((sum, bi) => sum + (bi.unitPrice * bi.quantity), 0)
    const bundleCost = bundleItems.reduce((sum, bi) => sum + (bi.unitCost * bi.quantity), 0)
    const savings = regularPrice - formData.bundlePrice
    const savingsPercent = regularPrice > 0 ? (savings / regularPrice) * 100 : 0
    const profit = formData.bundlePrice - bundleCost
    const profitMargin = formData.bundlePrice > 0 ? (profit / formData.bundlePrice) * 100 : 0
    const virtualStock = calculateVirtualStock()

    return { regularPrice, bundleCost, savings, savingsPercent, profit, profitMargin, virtualStock }
  }

  const handleSubmit = async () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error('Please enter bundle name')
      return
    }
    
    if (bundleItems.length === 0) {
      toast.error('Please add at least one item to the bundle')
      return
    }
    
    if (!formData.bundlePrice || formData.bundlePrice <= 0) {
      toast.error('Please enter a valid bundle price')
      return
    }

    const totals = calculateTotals()
    if (formData.bundlePrice < totals.bundleCost) {
      toast.error('Bundle price cannot be below cost!')
      return
    }

    setLoading(true)
    try {
      const virtualStock = totals.virtualStock
      
      console.log('[CreateBundleDialog] ===== SUBMIT START =====')
      console.log('[CreateBundleDialog] Mode:', editMode ? 'EDIT' : 'CREATE')
      console.log('[CreateBundleDialog] Bundle ID:', bundleId)
      console.log('[CreateBundleDialog] Virtual stock:', virtualStock)
      
      const bundleData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        bundlePrice: formData.bundlePrice,
        quantity: virtualStock,
        items: bundleItems.map(bi => ({
          itemId: bi.itemId,
          quantity: bi.quantity
        })),
        badge: formData.badge.trim() || null,
        imageUrl: imageUrl || null
      }

      console.log('[CreateBundleDialog] Payload:', bundleData)

      let response: any

      if (editMode && bundleId) {
        // UPDATE existing bundle
        console.log('[CreateBundleDialog] Updating bundle:', bundleId)
        response = await apiPut(`/api/bundles/${bundleId}`, bundleData)
        console.log('[CreateBundleDialog] Update response:', response)
        toast.success('Bundle updated successfully!')
      } else {
        // CREATE new bundle
        console.log('[CreateBundleDialog] Creating new bundle')
        response = await apiPost('/api/bundles', bundleData)
        console.log('[CreateBundleDialog] Create response:', response)
        
        // If image was uploaded, update the bundle with image
        if (imageUrl && response?.id) {
          console.log('[CreateBundleDialog] Saving image to new bundle:', response.id)
          try {
            await apiPut(`/api/bundles/${response.id}`, { imageUrl })
            console.log('[CreateBundleDialog] Image saved successfully')
          } catch (imageError: any) {
            console.error('[CreateBundleDialog] Failed to save image:', imageError)
            toast.warning('Bundle created but image save failed')
          }
        }
        
        toast.success('Bundle created successfully!')
      }

      console.log('[CreateBundleDialog] ===== SUBMIT SUCCESS =====')
      resetForm()
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error('[CreateBundleDialog] ===== SUBMIT ERROR =====')
      console.error('[CreateBundleDialog] Error:', error)
      toast.error(error.message || `Failed to ${editMode ? 'update' : 'create'} bundle`)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      bundlePrice: 0,
      badge: '',
    })
    setBundleItems([])
    setSearchValue('')
    setImageUrl(null)
  }

  const totals = calculateTotals()

  // Filter items for search - EXCLUDE BUNDLES (only show regular items)
  const filteredItems = items.filter(item => 
    !item.id.startsWith('BUNDLE-') && // Exclude bundles - bundles cannot contain other bundles
    (
      item.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      item.category.toLowerCase().includes(searchValue.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchValue.toLowerCase())
    )
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-5xl mx-4 sm:mx-auto max-h-[90vh] flex flex-col p-0 gap-0 rounded-xl sm:rounded-2xl overflow-hidden">
        {/* Professional Header with Dark Gradient - Mobile Optimized */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-600 flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <Package className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
              </div>
              <span className="text-white">{editMode ? 'Edit' : 'Create'} Product Bundle</span>
            </DialogTitle>
            <DialogDescription className="text-slate-200 text-xs sm:text-sm mt-1 sm:mt-2 font-medium">
              {editMode 
                ? 'Update bundle details, items, and pricing'
                : 'Create a bundle of products with special pricing to increase sales'
              }
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto py-3 sm:py-4 px-3 sm:px-6 min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
            {/* Left Column - Bundle Info */}
            <div className="space-y-3 sm:space-y-5">
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm font-semibold">Bundle Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Berry Soap 3-Pack"
                  className="h-9 sm:h-11 text-xs sm:text-sm"
                />
              </div>

              {/* Bundle Image Upload */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm font-semibold">
                  Bundle Image <span className="text-slate-400 font-normal text-[10px] sm:text-xs">(optional)</span>
                </Label>
                <ImageUpload
                  currentImageUrl={imageUrl}
                  onUploadComplete={(url) => setImageUrl(url)}
                  onRemove={() => setImageUrl(null)}
                  uploadType="product"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm font-semibold">Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe this bundle..."
                  rows={3}
                  className="resize-none text-xs sm:text-sm"
                />
              </div>

              {/* Pricing Summary */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg sm:rounded-xl p-3 sm:p-5 border border-slate-200 dark:border-slate-700 space-y-2 sm:space-y-3">
                <h4 className="font-bold text-sm sm:text-base flex items-center gap-1.5 sm:gap-2">
                  <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Pricing Summary
                </h4>
                <div className="space-y-1.5 sm:space-y-2.5 text-xs sm:text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Regular Price:</span>
                    <span className="font-bold text-sm sm:text-base">₱{totals.regularPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Bundle Cost:</span>
                    <span className="font-bold text-sm sm:text-base">₱{totals.bundleCost.toFixed(2)}</span>
                  </div>
                  <div className="h-px bg-slate-300 dark:bg-slate-600"></div>
                  <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                    <span className="font-medium">Customer Saves:</span>
                    <span className="font-bold text-sm sm:text-base">₱{totals.savings.toFixed(2)} ({totals.savingsPercent.toFixed(1)}%)</span>
                  </div>
                  <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                    <span className="font-medium">Your Profit:</span>
                    <span className="font-bold text-sm sm:text-base">₱{totals.profit.toFixed(2)} ({totals.profitMargin.toFixed(1)}%)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm font-semibold">
                  Bundle Price * 
                  <span className="text-[10px] sm:text-xs font-normal text-slate-500 ml-1 sm:ml-2">(What customer pays)</span>
                </Label>
                <Input
                  type="number"
                  value={formData.bundlePrice || ''}
                  onChange={(e) => setFormData({...formData, bundlePrice: parseFloat(e.target.value) || 0})}
                  placeholder="0.00"
                  className="h-10 sm:h-12 text-lg sm:text-xl font-bold"
                  min="0"
                  step="0.01"
                />
                {formData.bundlePrice > 0 && formData.bundlePrice < totals.bundleCost && (
                  <p className="text-[10px] sm:text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                    <span className="text-sm sm:text-base">⚠️</span> Price is below cost! Minimum: ₱{totals.bundleCost.toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            {/* Right Column - Product Selector & Bundle Items */}
            <div className="space-y-3 sm:space-y-4">
              {/* Custom Product Search Dropdown */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm font-semibold">Add Items to Bundle *</Label>
                <div className="relative" ref={searchContainerRef}>
                  <div
                    className={cn(
                      "relative w-full h-9 sm:h-11 border rounded-lg bg-white dark:bg-slate-950 cursor-pointer transition-all",
                      searchOpen 
                        ? "border-purple-500" 
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    )}
                    onClick={() => setSearchOpen(!searchOpen)}
                  >
                    <div className="flex items-center h-full px-2 sm:px-3 gap-1.5 sm:gap-2">
                      <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" />
                      <input
                        type="text"
                        value={searchValue}
                        onChange={(e) => {
                          setSearchValue(e.target.value)
                          setSearchOpen(true)
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSearchOpen(true)
                        }}
                        placeholder={`Search products... (${items.length} available)`}
                        className="flex-1 bg-transparent outline-none text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-0 focus:border-0"
                        style={{ boxShadow: 'none' }}
                      />
                      <ChevronDown className={cn(
                        "h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0 transition-transform",
                        searchOpen && "rotate-180"
                      )} />
                    </div>
                  </div>

                  {/* Custom Dropdown */}
                  {searchOpen && (
                    <div
                      ref={dropdownRef}
                      className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-[9999] overflow-hidden"
                      style={{ maxHeight: '320px' }}
                    >
                      <div className="overflow-y-auto max-h-[320px]" style={{ scrollbarWidth: 'thin' }}>
                        {filteredItems.length === 0 ? (
                          <div className="py-6 sm:py-8 text-center">
                            <div className="inline-flex p-2 sm:p-3 rounded-full bg-slate-100 dark:bg-slate-800 mb-2 sm:mb-3">
                              <Search className="h-4 w-4 sm:h-6 sm:w-6 text-slate-400" />
                            </div>
                            <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">No products found</p>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">Try a different search term</p>
                          </div>
                        ) : (
                          <>
                            <div className="sticky top-0 bg-slate-50 dark:bg-slate-800 px-2 sm:px-3 py-1.5 sm:py-2 border-b border-slate-200 dark:border-slate-700 z-10">
                              <p className="text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                                Products ({filteredItems.length})
                              </p>
                            </div>
                            <div className="p-1.5 sm:p-2">
                              {filteredItems.slice(0, 50).map((item) => {
                                const isAdded = bundleItems.some(bi => bi.itemId === item.id)
                                return (
                                  <button
                                    key={item.id}
                                    onClick={() => !isAdded && addBundleItem(item.id)}
                                    disabled={isAdded}
                                    className={cn(
                                      "w-full flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-all text-left",
                                      isAdded
                                        ? "bg-green-50 dark:bg-green-900/20 cursor-not-allowed opacity-60"
                                        : "hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer"
                                    )}
                                  >
                                    {/* Product Icon */}
                                    <div className={cn(
                                      "flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center",
                                      isAdded 
                                        ? "bg-green-100 dark:bg-green-900/30" 
                                        : "bg-purple-100 dark:bg-purple-900/30"
                                    )}>
                                      {isAdded ? (
                                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                                      ) : (
                                        <Package className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
                                      )}
                                    </div>

                                    {/* Product Info */}
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                                        {item.name}
                                      </p>
                                      <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                                        {item.category} • Stock: {item.quantity}
                                      </p>
                                    </div>

                                    {/* Price */}
                                    <div className="text-right flex-shrink-0">
                                      <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                                        ₱{item.sellingPrice.toFixed(2)}
                                      </p>
                                      <p className="text-[10px] sm:text-xs text-slate-500">
                                        Cost: ₱{item.costPrice.toFixed(2)}
                                      </p>
                                    </div>
                                  </button>
                                )
                              })}
                              {filteredItems.length > 50 && (
                                <div className="py-2 sm:py-3 px-3 sm:px-4 text-center border-t border-slate-200 dark:border-slate-700 mt-1.5 sm:mt-2">
                                  <p className="text-[10px] sm:text-xs text-slate-500">
                                    Showing first 50 results. Refine your search to see more.
                                  </p>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bundle Contents */}
              <div className="space-y-2 sm:space-y-3">
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl p-3 sm:p-4 bg-slate-50/50 dark:bg-slate-900/50" style={{ minHeight: '300px' }}>
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h4 className="font-bold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                      <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      Bundle Contents
                    </h4>
                    <Badge variant="outline" className="font-semibold text-[10px] sm:text-xs">
                      {bundleItems.length} {bundleItems.length === 1 ? 'item' : 'items'}
                    </Badge>
                  </div>
                  
                  {bundleItems.length === 0 ? (
                    <div className="text-center py-12 sm:py-16">
                      <div className="inline-flex p-3 sm:p-4 rounded-full bg-slate-200 dark:bg-slate-800 mb-3 sm:mb-4">
                        <Package className="h-8 w-8 sm:h-10 sm:w-10 text-slate-400" />
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-0.5 sm:mb-1">No items added yet</p>
                      <p className="text-[10px] sm:text-xs text-slate-500">Search and select products to add to this bundle</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 sm:space-y-2 max-h-[280px] overflow-y-auto pr-1 sm:pr-2" style={{ scrollbarWidth: 'thin' }}>
                      {bundleItems.map((bi, index) => (
                        <div key={bi.itemId} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <span className="text-[10px] sm:text-xs font-bold text-purple-600 dark:text-purple-400">{index + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-semibold truncate text-slate-900 dark:text-slate-100">{bi.itemName}</p>
                            <p className="text-[10px] sm:text-xs text-slate-500">₱{bi.unitPrice.toFixed(2)} each</p>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <Input
                              type="number"
                              value={bi.quantity}
                              onChange={(e) => updateQuantity(bi.itemId, parseInt(e.target.value) || 1)}
                              className="w-12 sm:w-16 h-8 sm:h-9 text-center font-semibold text-xs sm:text-sm"
                              min="1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(bi.itemId)}
                              className="h-8 w-8 sm:h-9 sm:w-9 p-0 hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-600"
                            >
                              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                          </div>
                          <div className="text-right min-w-[60px] sm:min-w-[80px]">
                            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">₱{(bi.unitPrice * bi.quantity).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Virtual Stock Card - Separate */}
                {bundleItems.length > 0 && (
                  <div className={cn(
                    "rounded-lg sm:rounded-xl p-3 sm:p-4 border-2",
                    totals.virtualStock === 0 
                      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                      : totals.virtualStock < 5
                      ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                      : "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={cn(
                          "w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center",
                          totals.virtualStock === 0 
                            ? "bg-red-100 dark:bg-red-900/40"
                            : totals.virtualStock < 5
                            ? "bg-yellow-100 dark:bg-yellow-900/40"
                            : "bg-purple-100 dark:bg-purple-900/40"
                        )}>
                          <Package className={cn(
                            "h-5 w-5 sm:h-6 sm:w-6",
                            totals.virtualStock === 0 
                              ? "text-red-600 dark:text-red-400"
                              : totals.virtualStock < 5
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-purple-600 dark:text-purple-400"
                          )} />
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                            Virtual Stock
                          </p>
                          <p className={cn(
                            "text-xl sm:text-2xl font-bold",
                            totals.virtualStock === 0 
                              ? "text-red-600 dark:text-red-400"
                              : totals.virtualStock < 5
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-purple-600 dark:text-purple-400"
                          )}>
                            {totals.virtualStock} {totals.virtualStock === 1 ? 'bundle' : 'bundles'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {totals.virtualStock === 0 ? (
                          <Badge variant="destructive" className="font-semibold text-[10px] sm:text-xs">
                            Out of Stock
                          </Badge>
                        ) : totals.virtualStock < 5 ? (
                          <Badge variant="outline" className="font-semibold text-[10px] sm:text-xs border-yellow-600 text-yellow-600 dark:border-yellow-400 dark:text-yellow-400">
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-semibold text-[10px] sm:text-xs border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400">
                            Available
                          </Badge>
                        )}
                      </div>
                    </div>
                    {totals.virtualStock === 0 && (
                      <p className="text-[10px] sm:text-xs text-red-600 dark:text-red-400 mt-2 sm:mt-3 font-medium">
                        ⚠️ Insufficient stock to create any bundles
                      </p>
                    )}
                    {totals.virtualStock > 0 && totals.virtualStock < 5 && (
                      <p className="text-[10px] sm:text-xs text-yellow-600 dark:text-yellow-400 mt-2 sm:mt-3 font-medium">
                        ⚠️ Limited stock - only {totals.virtualStock} bundle{totals.virtualStock !== 1 ? 's' : ''} can be made
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Professional Footer - Mobile Optimized */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-4 sm:py-6 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0">
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <Button 
              variant="outline" 
              onClick={() => {
                resetForm()
                onOpenChange(false)
              }} 
              disabled={loading}
              className="h-9 sm:h-11 px-4 sm:px-6 text-xs sm:text-sm font-semibold border-2"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || bundleItems.length === 0}
              className="h-9 sm:h-11 px-4 sm:px-6 text-xs sm:text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg"
            >
              {loading ? (
                <>
                  <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5 sm:mr-2"></div>
                  <span className="hidden sm:inline">Creating Bundle...</span>
                  <span className="sm:hidden">Creating...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Create Bundle</span>
                  <span className="sm:hidden">Create</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
