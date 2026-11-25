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
      <DialogContent className="max-w-[520px] max-h-[90vh] flex flex-col p-0 gap-0 rounded-xl border-0 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex items-center gap-3 flex-shrink-0">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div className="pr-6">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Inventory</p>
            <p className="text-sm font-bold text-white">Add New Product</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0">
          <div className="px-6 py-5 space-y-5 bg-white">

            {/* Product Image */}
            <div>
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                Product Image <span className="normal-case font-normal text-slate-400">(optional)</span>
              </Label>
              <ImageUpload
                currentImageUrl={imageUrl}
                onUploadComplete={(url) => setImageUrl(url)}
                onRemove={() => setImageUrl(null)}
              />
            </div>

            {/* Name + Category */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Product Name
                </Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter product name"
                  className="h-10 border-slate-200 bg-slate-50 focus:bg-white text-slate-900"
                />
              </div>
              <div>
                <Label htmlFor="category" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Category
                </Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })} required>
                  <SelectTrigger id="category" className="h-10 border-slate-200 bg-slate-50 focus:bg-white w-full">
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

            {/* Quantity + Cost Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantity" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Quantity
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  required
                  value={formData.quantity || ''}
                  placeholder="0"
                  onChange={(e) => setFormData({ ...formData, quantity: Number.parseInt(e.target.value) || 0 })}
                  className="h-10 border-slate-200 bg-slate-50 focus:bg-white text-slate-900"
                />
              </div>
              <div>
                <Label htmlFor="costPrice" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Cost Price (₱)
                </Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  required
                  value={formData.costPrice || ''}
                  placeholder="0.00"
                  onChange={(e) => setFormData({ ...formData, costPrice: Number.parseFloat(e.target.value) || 0 })}
                  className="h-10 border-slate-200 bg-slate-50 focus:bg-white text-slate-900"
                />
              </div>
            </div>

            {/* Selling Price + Reorder Level */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sellingPrice" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Selling Price (₱)
                </Label>
                <Input
                  id="sellingPrice"
                  type="number"
                  step="0.01"
                  required
                  value={formData.sellingPrice || ''}
                  placeholder="0.00"
                  onChange={(e) => setFormData({ ...formData, sellingPrice: Number.parseFloat(e.target.value) || 0 })}
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
                <Label htmlFor="reorderLevel" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Reorder Level
                </Label>
                <Input
                  id="reorderLevel"
                  type="number"
                  required
                  value={formData.reorderLevel || ''}
                  placeholder="0"
                  onChange={(e) => setFormData({ ...formData, reorderLevel: Number.parseInt(e.target.value) || 0 })}
                  className="h-10 border-slate-200 bg-slate-50 focus:bg-white text-slate-900"
                />
              </div>
            </div>

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
                Adding...
              </>
            ) : (
              <>
                <Package className="h-4 w-4 mr-2" />
                Add Product
              </>
            )}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  )
}
