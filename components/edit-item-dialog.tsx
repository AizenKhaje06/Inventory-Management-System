"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Package, AlertCircle } from "lucide-react"
import type { InventoryItem } from "@/lib/types"
import { apiGet, apiPut } from "@/lib/api-client"
import { getCurrentUser } from "@/lib/auth"
import { formatCurrency, cn } from "@/lib/utils"
import { ImageUpload } from "@/components/ui/image-upload"

// Helper functions for bundle calculations
function calculateBundleCost(components: Array<{ quantity: number; costPrice: number }>): number {
  return components.reduce((total, comp) => total + (comp.quantity * comp.costPrice), 0)
}

function calculateVirtualStock(components: Array<{ quantity: number; currentStock: number }>): number {
  if (components.length === 0) return 0
  return Math.min(...components.map(comp => Math.floor(comp.currentStock / comp.quantity)))
}

interface EditItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: InventoryItem
  onSuccess: () => void
}

export function EditItemDialog({ open, onOpenChange, item, onSuccess }: EditItemDialogProps) {
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Array<{id: string, name: string}>>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [componentItems, setComponentItems] = useState<InventoryItem[]>([])
  const [loadingComponents, setLoadingComponents] = useState(false)
  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.role === 'admin'
  
  // Check if this is a bundle product
  const isBundle = item.productType === 'bundle' || (item as any).product_type === 'bundle'
  const bundleComponents = (item as any).bundle_components || (item as any).bundleComponents || []
  
  const [formData, setFormData] = useState({
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    costPrice: item.costPrice,
    sellingPrice: item.sellingPrice,
    reorderLevel: item.reorderLevel,
  })
  const [imageUrl, setImageUrl] = useState<string | null>(item.imageUrl || null)

  useEffect(() => {
    setFormData({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      costPrice: item.costPrice,
      sellingPrice: item.sellingPrice,
      reorderLevel: item.reorderLevel,
    })
    setImageUrl(item.imageUrl || null)
  }, [item])

  useEffect(() => {
    if (open) {
      fetchCategories()
      if (isBundle && bundleComponents.length > 0) {
        fetchComponentDetails()
      }
    }
  }, [open, isBundle])

  async function fetchComponentDetails() {
    try {
      setLoadingComponents(true)
      const componentIds = bundleComponents.map((c: any) => c.item_id)
      const items = await apiGet<InventoryItem[]>("/api/items")
      const components = items.filter(item => componentIds.includes(item.id))
      setComponentItems(components)
    } catch (error) {
      console.error("Error fetching component details:", error)
    } finally {
      setLoadingComponents(false)
    }
  }

  async function fetchCategories() {
    try {
      setLoadingCategories(true)
      const data = await apiGet<Array<{id: string, name: string}>>("/api/categories")
      setCategories(data)
    } catch (error) {
      console.error("Error fetching categories:", error)
    } finally {
      setLoadingCategories(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      // Use different API endpoint based on product type
      if (isBundle) {
        await apiPut(`/api/bundles/${item.id}`, { ...formData, imageUrl })
      } else {
        await apiPut(`/api/items/${item.id}`, { ...formData, imageUrl })
      }
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error("[EditItemDialog] Error updating item:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] max-h-[90vh] flex flex-col p-0 gap-0 rounded-xl border-0 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex items-center gap-3 flex-shrink-0">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Edit {isBundle ? 'Bundle' : 'Product'}
            </p>
            <p className="text-sm font-bold text-white truncate">{item.name}</p>
          </div>
          {isBundle && (
            <span className="flex-shrink-0 bg-purple-600 text-white text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md">
              Bundle
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0">
          <div className="px-6 py-5 space-y-5 bg-white">

            {/* Product Image */}
            <div>
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                {isBundle ? 'Bundle' : 'Product'} Image <span className="normal-case font-normal text-slate-400">(optional)</span>
              </Label>
              <ImageUpload
                currentImageUrl={imageUrl}
                itemId={item.id}
                onUploadComplete={(url) => setImageUrl(url)}
                onRemove={() => setImageUrl(null)}
                uploadType="product"
              />
            </div>

            {/* Name + Category */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-name" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Product Name
                </Label>
                <Input
                  id="edit-name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-10 border-slate-200 bg-slate-50 focus:bg-white text-slate-900"
                />
              </div>
              <div>
                <Label htmlFor="edit-category" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Category
                </Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })} required>
                  <SelectTrigger id="edit-category" className="h-10 border-slate-200 bg-slate-50 focus:bg-white w-full">
                    <SelectValue placeholder={loadingCategories ? "Loading..." : "Select category"} />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingCategories ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : categories.length === 0 ? (
                      <SelectItem value="none" disabled>No categories</SelectItem>
                    ) : (
                      categories.map((category) => (
                        <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Current Stock + Cost Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-quantity" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Current Stock <span className="normal-case font-normal text-slate-400">(Read-only)</span>
                </Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  value={formData.quantity}
                  readOnly
                  disabled
                  className="h-10 border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                />
                <p className="text-xs text-blue-600 flex items-center gap-1 mt-1.5">
                  <AlertCircle className="h-3 w-3" />
                  Use Adjust Stock to change quantity
                </p>
              </div>
              <div>
                <Label htmlFor="edit-costPrice" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Cost Price (₱)
                </Label>
                <Input
                  id="edit-costPrice"
                  type="number"
                  step="0.01"
                  required
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: Number.parseFloat(e.target.value) })}
                  className="h-10 border-slate-200 bg-slate-50 focus:bg-white text-slate-900"
                />
              </div>
            </div>

            {/* Selling Price + Reorder Level */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-sellingPrice" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Selling Price (₱)
                </Label>
                <Input
                  id="edit-sellingPrice"
                  type="number"
                  step="0.01"
                  required
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: Number.parseFloat(e.target.value) })}
                  className="h-10 border-slate-200 bg-slate-50 focus:bg-white text-slate-900"
                />
                {formData.costPrice > 0 && formData.sellingPrice > 0 && (
                  <p className="text-xs text-slate-500 mt-1.5">
                    Margin: <span className={`font-bold ${((formData.sellingPrice - formData.costPrice) / formData.sellingPrice * 100) >= 20 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {((formData.sellingPrice - formData.costPrice) / formData.sellingPrice * 100).toFixed(1)}%
                    </span>
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-reorderLevel" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Reorder Level
                </Label>
                <Input
                  id="edit-reorderLevel"
                  type="number"
                  required
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData({ ...formData, reorderLevel: Number.parseInt(e.target.value) })}
                  className="h-10 border-slate-200 bg-slate-50 focus:bg-white text-slate-900"
                />
              </div>
            </div>

            {/* Bundle Components Section */}
            {isBundle && bundleComponents.length > 0 && (
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-purple-600" />
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Bundle Components</h3>
                </div>

                {loadingComponents ? (
                  <div className="text-center py-6 text-sm text-slate-400">Loading components...</div>
                ) : (
                  <div className="space-y-2 max-h-[260px] overflow-y-auto">
                    {bundleComponents.map((component: any, index: number) => {
                      const componentItem = componentItems.find(item => item.id === component.item_id)
                      const subtotal = componentItem ? componentItem.costPrice * component.quantity : 0
                      const canMake = componentItem ? Math.floor(componentItem.quantity / component.quantity) : 0

                      return (
                        <div key={component.item_id || index} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {componentItem?.name || 'Unknown Product'}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                <span>Qty: <span className="font-medium text-slate-700">{component.quantity}</span></span>
                                <span>Stock: <span className={`font-medium ${(componentItem?.quantity || 0) < component.quantity ? 'text-red-600' : 'text-emerald-600'}`}>{componentItem?.quantity || 0}</span></span>
                                <span>Cost: <span className="font-medium text-slate-700">{formatCurrency(subtotal)}</span></span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-slate-400">Can make</p>
                              <p className={`text-sm font-bold ${canMake === 0 ? 'text-red-600' : 'text-emerald-600'}`}>{canMake}</p>
                            </div>
                          </div>
                          {(componentItem?.quantity || 0) < component.quantity && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                              <AlertCircle className="h-3 w-3 flex-shrink-0" />
                              Insufficient stock
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {!loadingComponents && componentItems.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div>
                      <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-0.5">Bundle Cost</p>
                      <p className="text-base font-bold text-blue-900">
                        {formatCurrency(calculateBundleCost(bundleComponents.map((c: any) => {
                          const it = componentItems.find(i => i.id === c.item_id)
                          return { quantity: c.quantity, costPrice: it?.costPrice || 0 }
                        })))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-0.5">Virtual Stock</p>
                      <p className="text-base font-bold text-blue-900">
                        {calculateVirtualStock(bundleComponents.map((c: any) => {
                          const it = componentItems.find(i => i.id === c.item_id)
                          return { quantity: c.quantity, currentStock: it?.quantity || 0 }
                        }))} bundles
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 px-5 border-slate-300 font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            onClick={handleSubmit}
            className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-r-transparent" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  )
}
