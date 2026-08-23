"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Package } from "lucide-react"
import { apiGet, apiPost, apiPut } from "@/lib/api-client"
import { toast } from "sonner"
import { ImageUpload } from "@/components/ui/image-upload"
import { CustomLoader } from "@/components/ui/custom-loader"

interface AddItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddItemDialog({ open, onOpenChange, onSuccess }: AddItemDialogProps) {
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Array<{id: string, name: string}>>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    quantity: 0,
    costPrice: 0,
    sellingPrice: 0,
    reorderLevel: 0,
  })

  useEffect(() => {
    if (open) {
      fetchCategories()
      setImageUrl(null)
    }
  }, [open])

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
      const item = await apiPost("/api/items", formData) as any
      
      // If image was uploaded, save the URL to the item
      if (imageUrl && item?.id) {
        await apiPut(`/api/items/${item.id}`, { imageUrl })
      }

      toast.success("Product added successfully!")
      onSuccess()
      onOpenChange(false)
      setFormData({
        name: "",
        category: "",
        quantity: 0,
        costPrice: 0,
        sellingPrice: 0,
        reorderLevel: 0,
      })
      setImageUrl(null)
    } catch (error: any) {
      console.error("[Add Item] Error adding item:", error)
      if (error.message) {
        toast.error(error.message)
      } else {
        toast.error("Failed to add product. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl mx-4 sm:mx-auto max-h-[90vh] flex flex-col p-0 gap-0 rounded-xl sm:rounded-2xl overflow-hidden">
        {/* Professional Header with Dark Gradient - Mobile Optimized */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-4 sm:px-6 py-4 sm:py-5 relative overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
          <div className="relative">
            <DialogHeader>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/30">
                  <Package className="h-5 w-5 sm:h-6 sm:w-6 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <DialogTitle className="text-lg sm:text-2xl font-bold text-white tracking-tight !text-white">Add New Product</DialogTitle>
                  <DialogDescription className="text-slate-200 text-xs sm:text-sm mt-0 sm:mt-0.5 font-medium !text-slate-200">
                    Create a new product in your inventory
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 space-y-3 sm:space-y-5">
          {/* Product Image Upload */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs sm:text-sm">
              Product Image <span className="text-slate-400 font-normal text-[10px] sm:text-xs">(optional)</span>
            </Label>
            <ImageUpload
              currentImageUrl={imageUrl}
              onUploadComplete={(url) => setImageUrl(url)}
              onRemove={() => setImageUrl(null)}
            />
          </div>

          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="name" className="text-slate-700 dark:text-slate-300 font-medium text-xs sm:text-sm">
                Product Name
              </Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-9 sm:h-10 text-xs sm:text-sm rounded-[5px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="category" className="text-slate-700 dark:text-slate-300 font-medium text-xs sm:text-sm">
                Category
              </Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })} required>
                <SelectTrigger id="category" className="w-full max-w-xs h-9 sm:h-10 text-xs sm:text-sm rounded-[5px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20">
                  <SelectValue placeholder={loadingCategories ? "Loading categories..." : "Select a category"} />
                </SelectTrigger>
                <SelectContent className="w-full max-w-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  {loadingCategories ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : categories.length === 0 ? (
                    <SelectItem value="none" disabled>No categories available</SelectItem>
                  ) : (
                    categories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="quantity" className="text-slate-700 dark:text-slate-300 font-medium text-xs sm:text-sm">
                Quantity
              </Label>
              <Input
                id="quantity"
                type="number"
                required
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number.parseInt(e.target.value) || 0 })}
                className="h-9 sm:h-10 text-xs sm:text-sm rounded-[5px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="costPrice" className="text-slate-700 dark:text-slate-300 font-medium text-xs sm:text-sm">
                Cost Price
              </Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                required
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: Number.parseFloat(e.target.value) || 0 })}
                className="h-9 sm:h-10 text-xs sm:text-sm rounded-[5px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="sellingPrice" className="text-slate-700 dark:text-slate-300 font-medium text-xs sm:text-sm">
                Selling Price
              </Label>
              <Input
                id="sellingPrice"
                type="number"
                step="0.01"
                required
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: Number.parseFloat(e.target.value) || 0 })}
                className="h-9 sm:h-10 text-xs sm:text-sm rounded-[5px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="reorderLevel" className="text-slate-700 dark:text-slate-300 font-medium text-xs sm:text-sm">
                Reorder Level
              </Label>
              <Input
                id="reorderLevel"
                type="number"
                required
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: Number.parseInt(e.target.value) || 0 })}
                className="h-9 sm:h-10 text-xs sm:text-sm rounded-[5px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
          </div>
        </form>

        {/* Professional Footer - Mobile Optimized */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 sm:px-8 py-4 sm:py-6 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0">
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="h-9 sm:h-11 px-4 sm:px-6 text-xs sm:text-sm font-semibold border-2"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading} 
              onClick={handleSubmit}
              className="h-9 sm:h-11 px-4 sm:px-6 text-xs sm:text-sm font-semibold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg"
            >
              {loading ? (
                <>
                  <CustomLoader size="sm" className="mr-1.5 sm:mr-2" />
                  <span className="hidden sm:inline">Adding Product...</span>
                  <span className="sm:hidden">Adding...</span>
                </>
              ) : (
                <>
                  <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Product</span>
                  <span className="sm:hidden">Add</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
