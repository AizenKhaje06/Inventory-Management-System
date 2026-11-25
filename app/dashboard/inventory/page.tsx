"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Pencil, Trash2, PackagePlus, Package, Filter, X, ArrowUpDown, AlertCircle, TrendingUp, Tag, LayoutGrid, LayoutList, Eye, ShoppingCart, Check, Building2, FileDown, FileSpreadsheet, ChevronDown, AlertTriangle, RotateCcw } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import * as XLSX from 'xlsx'
import type { InventoryItem } from "@/lib/types"
import { AddItemDialog } from "@/components/add-item-dialog"
import { EditItemDialog } from "@/components/edit-item-dialog"
import { formatNumber, formatCurrency, cn } from "@/lib/utils"
import { showSuccess, showError } from "@/lib/toast-utils"
import { getCurrentUser } from "@/lib/auth"
import { apiGet, apiDelete, apiPost, apiPut } from "@/lib/api-client"
import { getCurrentUserRole } from '@/lib/role-utils'
import { toast } from 'sonner'
import { CustomLoader } from "@/components/ui/custom-loader"

const SALES_CHANNELS = ['Shopee', 'Lazada', 'Facebook', 'TikTok', 'Physical Store'] as const

import { TableSkeleton, CardSkeleton, StatCardSkeleton } from '@/components/ui/table-skeleton'
import { BrandLoader } from '@/components/ui/brand-loader'
import { TablePagination } from "@/components/ui/table-pagination"
import { useDebounce } from "@/hooks/useDebounce"

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([])
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 300) // Debounce search input
  const [salesChannelFilter, setSalesChannelFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "good" | "bad">("all")
  const [stockLevelFilter, setStockLevelFilter] = useState<"all" | "low" | "out">("all")
  const [sortBy, setSortBy] = useState("name-asc")
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  
  // Adjust Stock Modal (replaces old restock dialog)
  const [adjustStockDialogOpen, setAdjustStockDialogOpen] = useState(false)
  const [adjustmentType, setAdjustmentType] = useState<'restock' | 'reduce'>('restock')
  const [selectedAdjustItem, setSelectedAdjustItem] = useState<InventoryItem | null>(null)
  const [adjustAmount, setAdjustAmount] = useState(0)
  const [adjustReason, setAdjustReason] = useState("")
  const [adjustNotes, setAdjustNotes] = useState("")
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  
  // Get current user for role-based features
  const currentUser = getCurrentUser()
  
  // Role detection for export button
  const userRole = getCurrentUserRole()
  const isTeamLeader = false // Team leader role removed
  
  // Role detection for read-only access
  const [isReadOnly, setIsReadOnly] = useState(false)
  
  useEffect(() => {
    const checkRole = () => {
      const role = getCurrentUserRole()
      
      // Operations staff - read-only access to ALL products (no channel filtering)
      if (role === 'operations') {
        setIsReadOnly(true)
      }
    }
    
    checkRole()
  }, [])
  
  // Category Management
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [categories, setCategories] = useState<Array<{id: string, name: string, createdAt: string}>>([])
  const [newCategory, setNewCategory] = useState("")
  const [editingCategory, setEditingCategory] = useState<{id: string, name: string} | null>(null)
  const [editCategoryValue, setEditCategoryValue] = useState("")
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null)
  
  const [submitting, setSubmitting] = useState(false)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set()) // Bulk selection
  
  // Bad Stock Management
  const [restoreDialogItem, setRestoreDialogItem] = useState<InventoryItem | null>(null)
  const [disposeDialogItem, setDisposeDialogItem] = useState<InventoryItem | null>(null)
  const [restoreAmount, setRestoreAmount] = useState(0)
  const [restoreReason, setRestoreReason] = useState("")
  const [disposeAmount, setDisposeAmount] = useState(0)
  const [restoreNotes, setRestoreNotes] = useState("")
  const [disposeNotes, setDisposeNotes] = useState("")
  
  // Calculate initial column widths based on viewport
  const getInitialColumnWidths = () => {
    if (typeof window === 'undefined') {
      return {
        product: 350,
        category: 220,
        status: 120,
        stock: 130,
        cost: 130,
        price: 130,
        margin: 120,
        actions: 150
      }
    }
    
    // Get available width (viewport - sidebar - scrollbar)
    const viewportWidth = window.innerWidth
    const sidebarWidth = 192 // Sidebar width (w-48 = 192px)
    const scrollbarWidth = 17 // Typical scrollbar width
    const availableWidth = viewportWidth - sidebarWidth - scrollbarWidth
    
    // Base ratios for proportional distribution (removed salesChannel and store)
    const ratios = {
      product: 350,
      category: 220,
      status: 120,
      stock: 130,
      cost: 130,
      price: 130,
      margin: 120,
      actions: 150
    }
    
    const totalRatio = Object.values(ratios).reduce((a, b) => a + b, 0)
    const scale = availableWidth / totalRatio
    
    // Calculate widths and distribute any remainder to avoid dead space
    const widths = Object.entries(ratios).reduce((acc, [key, ratio], index, arr) => {
      if (index === arr.length - 1) {
        // Last column gets the remainder to fill exactly
        const usedWidth = Object.values(acc).reduce((a, b) => a + b, 0)
        acc[key] = availableWidth - usedWidth
      } else {
        acc[key] = Math.floor(ratio * scale)
      }
      return acc
    }, {} as Record<string, number>)
    
    return widths as typeof ratios
  }
  
  // Resizable columns state - Persistent via localStorage
  const [columnWidths, setColumnWidths] = useState(() => {
    // Try to load saved column widths from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('inventory-column-widths')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error('Failed to parse saved column widths:', e)
        }
      }
    }
    
    // Default widths if no saved data (removed salesChannel and store)
    return {
      product: 350,
      category: 220,
      status: 120,
      stock: 130,
      cost: 130,
      price: 130,
      margin: 120,
      actions: 150
    }
  })
  const [resizing, setResizing] = useState<string | null>(null)
  const [startX, setStartX] = useState(0)
  const [startWidth, setStartWidth] = useState(0)
  
  // Delete confirmation modal state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{id: string, name: string} | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Handle column resize
  const handleMouseDown = (e: React.MouseEvent, column: string) => {
    setResizing(column)
    setStartX(e.clientX)
    setStartWidth(columnWidths[column as keyof typeof columnWidths])
    e.preventDefault()
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return
      
      const diff = e.clientX - startX
      const newWidth = Math.max(80, startWidth + diff) // Minimum 80px
      
      setColumnWidths(prev => ({
        ...prev,
        [resizing]: newWidth
      }))
    }

    const handleMouseUp = () => {
      if (resizing) {
        // Save to localStorage when resize is complete
        localStorage.setItem('inventory-column-widths', JSON.stringify(columnWidths))
      }
      setResizing(null)
    }

    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizing, startX, startWidth, columnWidths])

  useEffect(() => {
    fetchItems()
    fetchCategories()

    // Refresh data when window regains focus (e.g., after switching tabs)
    const handleFocus = () => {
      fetchItems()
      fetchCategories()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  useEffect(() => {
    let filtered = items

    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase()
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          item.category.toLowerCase().includes(searchLower) ||
          item.sku?.toLowerCase().includes(searchLower)
      )
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((item) => item.category === categoryFilter)
    }

    // Status filter (good vs bad items)
    if (statusFilter === "good") {
      filtered = filtered.filter((item) => item.item_status !== 'bad')
    } else if (statusFilter === "bad") {
      filtered = filtered.filter((item) => item.item_status === 'bad')
    }

    // Stock Level filter
    if (stockLevelFilter === "low") {
      filtered = filtered.filter((item) => item.quantity > 0 && item.quantity <= item.reorderLevel)
    } else if (stockLevelFilter === "out") {
      filtered = filtered.filter((item) => item.quantity === 0)
    }

    // Stock status filter (legacy - keeping for backwards compatibility)
    if (salesChannelFilter === "low-stock") {
      filtered = filtered.filter((item) => item.quantity > 0 && item.quantity <= item.reorderLevel)
    } else if (salesChannelFilter === "out-of-stock") {
      filtered = filtered.filter((item) => item.quantity === 0)
    }

    // Apply sorting
    if (sortBy === "name-asc") {
      filtered.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === "name-desc") {
      filtered.sort((a, b) => b.name.localeCompare(a.name))
    } else if (sortBy === "price-asc") {
      filtered.sort((a, b) => a.sellingPrice - b.sellingPrice)
    } else if (sortBy === "price-desc") {
      filtered.sort((a, b) => b.sellingPrice - a.sellingPrice)
    } else if (sortBy === "stock-asc") {
      filtered.sort((a, b) => a.quantity - b.quantity)
    } else if (sortBy === "stock-desc") {
      filtered.sort((a, b) => b.quantity - a.quantity)
    }

    setFilteredItems(filtered)
  }, [debouncedSearch, salesChannelFilter, categoryFilter, statusFilter, stockLevelFilter, sortBy, items])

  // Calculate pagination
  const totalPages = Math.ceil(filteredItems.length / pageSize)
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  async function fetchItems() {
    try {
      const data = await apiGet<InventoryItem[]>(`/api/items?t=${Date.now()}`)
      console.log('[Inventory] RAW API Response:', data)
      
      let itemsArray = Array.isArray(data) ? data : []
      
      // Department users can now see ALL products (no sales channel filtering)
      // This matches the behavior of the Warehouse Dispatch page
      
      // Debug: Log items with images BEFORE setting state
      const itemsWithImages = itemsArray.filter(item => item.imageUrl)
      if (itemsWithImages.length > 0) {
        console.log('[Inventory] Items with images BEFORE setState:', itemsWithImages.map(item => ({
          name: item.name,
          imageUrl: item.imageUrl,
          imageUrlType: typeof item.imageUrl,
          imageUrlLength: item.imageUrl?.length
        })))
      }
      
      setItems(itemsArray)
      setFilteredItems(itemsArray)
      
      // Debug: Log items AFTER setting state
      console.log('[Inventory] Items AFTER setState:', itemsArray.slice(0, 3))
    } catch (error) {
      console.error("[Inventory] Error fetching items:", error)
      setItems([])
      setFilteredItems([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchCategories() {
    try {
      const data = await apiGet<any[]>("/api/categories")
      setCategories(data)
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }

  async function handleDelete(id: string) {
    try {
      setIsDeleting(true)
      
      const endpoint = `/api/items/${id}`
      
      // Add authentication headers
      const headers = new Headers({
        'Content-Type': 'application/json'
      })
      
      const username = localStorage.getItem('username')
      const role = localStorage.getItem('userRole')
      const displayName = localStorage.getItem('displayName')
      
      if (username) headers.set('x-user-username', username)
      if (role) headers.set('x-user-role', role)
      if (displayName) headers.set('x-user-display-name', displayName)
      
      const response = await fetch(endpoint, { 
        method: "DELETE",
        headers 
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete product' }))
        throw new Error(errorData.error || 'Failed to delete product')
      }
      
      await fetchItems()
      setDeleteDialogOpen(false)
      setItemToDelete(null)
      showSuccess("Product deleted successfully")
    } catch (error) {
      console.error("[Inventory] Error deleting item:", error)
      showError(error instanceof Error ? error.message : "Failed to delete product")
    } finally {
      setIsDeleting(false)
    }
  }
  
  function openDeleteDialog(id: string, name: string) {
    setItemToDelete({ id, name })
    setDeleteDialogOpen(true)
  }

  async function handleEdit(item: InventoryItem) {
    setSelectedItem(item)
    setEditDialogOpen(true)
  }

  function handleAdjustStock(item: InventoryItem, type: 'restock' | 'reduce' = 'restock') {
    setSelectedAdjustItem(item)
    setAdjustmentType(type)
    setAdjustAmount(0)
    setAdjustReason("")
    setAdjustNotes("")
    setAdjustStockDialogOpen(true)
  }

  async function handleAdjustStockSubmit() {
    if (!selectedAdjustItem || adjustAmount <= 0 || !adjustReason) {
      showError("Please fill in all required fields")
      return
    }

    try {
      if (adjustmentType === 'restock') {
        await apiPost(`/api/items/${selectedAdjustItem.id}/restock`, {
          amount: adjustAmount,
          reason: adjustReason
        })
        showSuccess(`Stock increased by ${adjustAmount} units!`)
      } else {
        await apiPost(`/api/items/${selectedAdjustItem.id}/reduce`, {
          amount: adjustAmount,
          reason: adjustReason,
          notes: adjustNotes
        })
        showSuccess(`Stock reduced by ${adjustAmount} units!`)
      }

      setAdjustStockDialogOpen(false)
      setSelectedAdjustItem(null)
      setAdjustAmount(0)
      setAdjustReason("")
      setAdjustNotes("")
      await fetchItems()
    } catch (error) {
      console.error("[Inventory] Error adjusting stock:", error)
      showError(`Failed to ${adjustmentType === 'restock' ? 'increase' : 'reduce'} stock`)
    }
  }

  // Category Management Functions
  async function handleAddCategory() {
    if (!newCategory.trim()) {
      showError("Please enter a category name")
      return
    }

    try {
      setSubmitting(true)
      const category = await apiPost("/api/categories", { name: newCategory.trim() })
      showSuccess("Category added successfully")
      setNewCategory("")
      fetchCategories()
    } catch (error) {
      console.error("Error adding category:", error)
      showError("Failed to add category")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditCategory() {
    if (!editingCategory || !editCategoryValue.trim()) {
      showError("Please enter a category name")
      return
    }

    try {
      setSubmitting(true)
      await apiPut(`/api/categories/${editingCategory.id}`, { name: editCategoryValue.trim() })
      showSuccess("Category updated successfully")
      setEditingCategory(null)
      setEditCategoryValue("")
      fetchCategories()
    } catch (error) {
      console.error("Error updating category:", error)
      showError("Failed to update category")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteCategory(id: string) {
    try {
      setSubmitting(true)
      await apiDelete(`/api/categories/${id}`)
      showSuccess("Category deleted successfully")
      setDeleteCategoryId(null)
      fetchCategories()
    } catch (error) {
      console.error("Error deleting category:", error)
      showError("Failed to delete category")
    } finally {
      setSubmitting(false)
    }
  }

  // Export Functions
  const exportToExcel = async () => {
    try {
      const exportItems = filteredItems
      
      // Fetch restock data for all items
      const restockResponse = await fetch('/api/restocks')
      const allRestocks = restockResponse.ok ? await restockResponse.json() : []
      
      // Group items by product name + cost price + selling price
      const groupedItems = exportItems.reduce((acc, item) => {
        // Create unique key based on name, cost, and selling price
        const key = `${item.name}-${item.costPrice}-${item.sellingPrice}`
        
        if (!acc[key]) {
          acc[key] = {
            name: item.name,
            quantity: 0,
            costPrice: item.costPrice,
            sellingPrice: item.sellingPrice,
            items: []
          }
        }
        
        acc[key].quantity += item.quantity
        acc[key].items.push(item)
        
        return acc
      }, {} as Record<string, any>)
      
      // Add restock information to each group
      Object.values(groupedItems).forEach((group: any) => {
        // Find the most recent restock for any item in this group
        const itemIds = group.items.map((i: any) => i.id)
        const groupRestocks = allRestocks.filter((r: any) => itemIds.includes(r.itemId))
        
        if (groupRestocks.length > 0) {
          // Sort by timestamp descending to get the most recent
          const latestRestock = groupRestocks.sort((a: any, b: any) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0]
          
          group.lastRestockDate = latestRestock.timestamp
          group.lastRestockAmount = latestRestock.quantity
          group.lastRestockReason = latestRestock.reason
        } else {
          group.lastRestockDate = 'N/A'
          group.lastRestockAmount = 'N/A'
          group.lastRestockReason = 'N/A'
        }
      })

      const groupedArray = Object.values(groupedItems)

      // Calculate totals for header
      const totalProducts = groupedArray.length
      const totalQuantity = groupedArray.reduce((sum: number, group: any) => sum + group.quantity, 0)
      const totalValue = groupedArray.reduce((sum: number, group: any) => sum + (group.quantity * group.sellingPrice), 0)
      const totalCOGS = groupedArray.reduce((sum: number, group: any) => sum + (group.quantity * group.costPrice), 0)
      
      let lowStockCount = 0
      let outOfStockCount = 0
      groupedArray.forEach((group: any) => {
        const lowestReorderLevel = Math.min(...group.items.map((i: any) => i.reorderLevel || 0))
        if (group.quantity === 0) {
          outOfStockCount++
        } else if (group.quantity <= lowestReorderLevel) {
          lowStockCount++
        }
      })
      const inStockCount = totalProducts - lowStockCount - outOfStockCount

      // Create header information
      const headerInfo = [
        ['INVENTORY REPORT'],
        [''],
        ['Report Date:', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
        ['Report Time:', new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })],
        [''],
        ['SUMMARY INFORMATION'],
        ['Total Products:', `${totalProducts} items`],
        ['Total Quantity:', `${formatNumber(totalQuantity)} units`],
        ['Total Inventory Value:', formatCurrency(totalValue)],
        ['Total COGS:', formatCurrency(totalCOGS)],
        ['In Stock Items:', `${inStockCount} items`],
        ['Low Stock Items:', `${lowStockCount} items`],
        ['Out of Stock Items:', `${outOfStockCount} items`],
        ['Filter Applied:', salesChannelFilter !== 'all' ? salesChannelFilter : 'All Channels'],
        [''],
        ['']
      ]

      // Convert grouped data to export format
      const exportData = groupedArray.map((group: any) => {
        const totalValue = group.quantity * group.sellingPrice
        const totalCOGS = group.quantity * group.costPrice
        const profitMargin = group.sellingPrice > 0 
          ? ((group.sellingPrice - group.costPrice) / group.sellingPrice * 100).toFixed(2)
          : '0.00'
        
        // Determine status based on total quantity
        const lowestReorderLevel = Math.min(...group.items.map((i: any) => i.reorderLevel || 0))
        const status = group.quantity === 0 
          ? 'Out of Stock' 
          : group.quantity <= lowestReorderLevel 
            ? 'Low Stock' 
            : 'In Stock'
        
        // Format restock date if available
        const restockDate = group.lastRestockDate !== 'N/A' 
          ? new Date(group.lastRestockDate).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            })
          : 'N/A'
        
        // Format restock reason
        const restockReason = group.lastRestockReason !== 'N/A'
          ? group.lastRestockReason.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
          : 'N/A'

        return {
          'Product Name': group.name,
          'Quantity': group.quantity,
          'Cost Price': formatCurrency(group.costPrice),
          'Selling Price': formatCurrency(group.sellingPrice),
          'Profit Margin': `${profitMargin}%`,
          'Total Value': formatCurrency(totalValue),
          'Total COGS': formatCurrency(totalCOGS),
          'Status': status,
          'Last Restock Date': restockDate,
          'Last Restock Amount': group.lastRestockAmount,
          'Restock Reason': restockReason
        }
      })

      // Create workbook and add header
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(headerInfo)
      
      // Add data table below header
      XLSX.utils.sheet_add_json(ws, exportData, { origin: -1, skipHeader: false })
      
      // Style the header section (make first row bold)
      if (!ws['!rows']) ws['!rows'] = []
      ws['!rows'][0] = { hpt: 20, hpx: 20 }
      
      // Auto-size columns
      const maxWidth = 50
      const allData = [...headerInfo.map(row => row.join(' ')), ...exportData.map(row => Object.values(row).join(' '))]
      const colCount = Math.max(...headerInfo.map(row => row.length), Object.keys(exportData[0] || {}).length)
      const colWidths = Array(colCount).fill(0).map((_, i) => {
        const maxLen = Math.max(
          ...headerInfo.map(row => String(row[i] || '').length),
          ...exportData.map(row => String(Object.values(row)[i] || '').length)
        )
        return { wch: Math.min(maxLen + 2, maxWidth) }
      })
      ws['!cols'] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, 'Inventory')

      const fileName = `Inventory-Report-${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)
      toast.success('Excel report downloaded successfully')
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      toast.error('Failed to export Excel report')
    }
  }

  const exportToPDF = async () => {
    try {
      const exportItems = filteredItems
      
      // Fetch restock data for all items
      const restockResponse = await fetch('/api/restocks')
      const allRestocks = restockResponse.ok ? await restockResponse.json() : []
      
      // Group items by product name + cost price + selling price
      const groupedItems = exportItems.reduce((acc, item) => {
        // Create unique key based on name, cost, and selling price
        const key = `${item.name}-${item.costPrice}-${item.sellingPrice}`
        
        if (!acc[key]) {
          acc[key] = {
            name: item.name,
            quantity: 0,
            costPrice: item.costPrice,
            sellingPrice: item.sellingPrice,
            items: []
          }
        }
        
        acc[key].quantity += item.quantity
        acc[key].items.push(item)
        
        return acc
      }, {} as Record<string, any>)
      
      // Add restock information to each group
      Object.values(groupedItems).forEach((group: any) => {
        // Find the most recent restock for any item in this group
        const itemIds = group.items.map((i: any) => i.id)
        const groupRestocks = allRestocks.filter((r: any) => itemIds.includes(r.itemId))
        
        if (groupRestocks.length > 0) {
          // Sort by timestamp descending to get the most recent
          const latestRestock = groupRestocks.sort((a: any, b: any) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0]
          
          group.lastRestockDate = latestRestock.timestamp
          group.lastRestockAmount = latestRestock.quantity
          group.lastRestockReason = latestRestock.reason
        } else {
          group.lastRestockDate = 'N/A'
          group.lastRestockAmount = 'N/A'
          group.lastRestockReason = 'N/A'
        }
      })

      const groupedArray = Object.values(groupedItems)

      // Calculate totals
      const totalProducts = groupedArray.length
      const totalQuantity = groupedArray.reduce((sum: number, group: any) => sum + group.quantity, 0)
      const totalValue = groupedArray.reduce((sum: number, group: any) => sum + (group.quantity * group.sellingPrice), 0)
      const totalCOGS = groupedArray.reduce((sum: number, group: any) => sum + (group.quantity * group.costPrice), 0)
      
      // Count low stock and out of stock
      let lowStockCount = 0
      let outOfStockCount = 0
      groupedArray.forEach((group: any) => {
        const lowestReorderLevel = Math.min(...group.items.map((i: any) => i.reorderLevel || 0))
        if (group.quantity === 0) {
          outOfStockCount++
        } else if (group.quantity <= lowestReorderLevel) {
          lowStockCount++
        }
      })

      // Create printable HTML
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        toast.error('Please allow popups to export PDF')
        return
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Inventory Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { border-bottom: 3px solid #1e293b; padding-bottom: 20px; margin-bottom: 30px; }
            h1 { color: #1e293b; margin: 0 0 10px 0; font-size: 32px; }
            .report-info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 15px; }
            .info-item { display: flex; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 6px; }
            .info-label { color: #64748b; font-size: 13px; font-weight: 600; }
            .info-value { color: #1e293b; font-size: 13px; font-weight: 700; }
            .meta { color: #64748b; margin-bottom: 20px; font-size: 14px; }
            .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
            .summary-card { border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; }
            .summary-card h3 { margin: 0 0 5px 0; font-size: 12px; color: #64748b; text-transform: uppercase; }
            .summary-card p { margin: 0; font-size: 24px; font-weight: bold; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background-color: #f8fafc; font-weight: 600; color: #475569; font-size: 12px; text-transform: uppercase; }
            td { font-size: 14px; color: #1e293b; }
            .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
            .status-in-stock { background-color: #dcfce7; color: #166534; }
            .status-low-stock { background-color: #fef3c7; color: #92400e; }
            .status-out-of-stock { background-color: #fee2e2; color: #991b1b; }
            @media print {
              body { padding: 0; }
              .header { page-break-inside: avoid; }
              .summary { page-break-inside: avoid; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Inventory Report</h1>
            <div class="report-info">
              <div class="info-item">
                <span class="info-label">Report Date:</span>
                <span class="info-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Report Time:</span>
                <span class="info-value">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Total Products:</span>
                <span class="info-value">${totalProducts} items</span>
              </div>
              <div class="info-item">
                <span class="info-label">Total Quantity:</span>
                <span class="info-value">${formatNumber(totalQuantity)} units</span>
              </div>
              <div class="info-item">
                <span class="info-label">Total Inventory Value:</span>
                <span class="info-value">${formatCurrency(totalValue)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Total COGS:</span>
                <span class="info-value">${formatCurrency(totalCOGS)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">In Stock Items:</span>
                <span class="info-value">${totalProducts - lowStockCount - outOfStockCount} items</span>
              </div>
              <div class="info-item">
                <span class="info-label">Low Stock Items:</span>
                <span class="info-value">${lowStockCount} items</span>
              </div>
              <div class="info-item">
                <span class="info-label">Out of Stock Items:</span>
                <span class="info-value">${outOfStockCount} items</span>
              </div>
              <div class="info-item">
                <span class="info-label">Filter Applied:</span>
                <span class="info-value">${salesChannelFilter !== 'all' ? salesChannelFilter : 'All Channels'}</span>
              </div>
            </div>
          </div>
          
          <div class="summary">
            <div class="summary-card">
              <h3>Total Products</h3>
              <p>${totalProducts}</p>
            </div>
            <div class="summary-card">
              <h3>Total Quantity</h3>
              <p>${formatNumber(totalQuantity)}</p>
            </div>
            <div class="summary-card">
              <h3>Total Value</h3>
              <p>${formatCurrency(totalValue)}</p>
            </div>
            <div class="summary-card">
              <h3>Total COGS</h3>
              <p>${formatCurrency(totalCOGS)}</p>
            </div>
            <div class="summary-card">
              <h3>Low Stock Items</h3>
              <p>${lowStockCount}</p>
            </div>
            <div class="summary-card">
              <h3>Out of Stock</h3>
              <p>${outOfStockCount}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Profit Margin</th>
                <th>Total Value</th>
                <th>Status</th>
                <th>Last Restock</th>
                <th>Restock Qty</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              ${groupedArray.map((group: any) => {
                const totalValue = group.quantity * group.sellingPrice
                const profitMargin = group.sellingPrice > 0 
                  ? ((group.sellingPrice - group.costPrice) / group.sellingPrice * 100).toFixed(2)
                  : '0.00'
                
                const lowestReorderLevel = Math.min(...group.items.map((i: any) => i.reorderLevel || 0))
                const status = group.quantity === 0 
                  ? 'Out of Stock' 
                  : group.quantity <= lowestReorderLevel 
                    ? 'Low Stock' 
                    : 'In Stock'
                const statusClass = group.quantity === 0 
                  ? 'status-out-of-stock' 
                  : group.quantity <= lowestReorderLevel 
                    ? 'status-low-stock' 
                    : 'status-in-stock'
                
                // Format restock date
                const restockDate = group.lastRestockDate !== 'N/A' 
                  ? new Date(group.lastRestockDate).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })
                  : 'N/A'
                
                // Format restock reason
                const restockReason = group.lastRestockReason !== 'N/A'
                  ? group.lastRestockReason.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                  : 'N/A'
                
                return `
                  <tr>
                    <td>${group.name}</td>
                    <td>${group.quantity}</td>
                    <td>${formatCurrency(group.costPrice)}</td>
                    <td>${formatCurrency(group.sellingPrice)}</td>
                    <td>${profitMargin}%</td>
                    <td>${formatCurrency(totalValue)}</td>
                    <td><span class="status-badge ${statusClass}">${status}</span></td>
                    <td>${restockDate}</td>
                    <td>${group.lastRestockAmount}</td>
                    <td>${restockReason}</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `)

      printWindow.document.close()
      printWindow.focus()
      
      setTimeout(() => {
        printWindow.print()
        toast.success('PDF export ready')
      }, 250)
    } catch (error) {
      console.error('Error exporting to PDF:', error)
      toast.error('Failed to export PDF report')
    }
  }

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto py-4 px-6 space-y-5 sm:space-y-6" aria-live="polite" aria-busy="true">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-3 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        <TableSkeleton rows={8} columns={8} />
        <span className="sr-only">Loading, please wait...</span>
      </div>
    )
  }

  // Extract unique category names for filter
  const categoryNames = categories.map(cat => cat.name)

  const activeFiltersCount = [
    salesChannelFilter !== "all",
    search !== ""
  ].filter(Boolean).length

  const clearAllFilters = () => {
    setSearch("")
    setSalesChannelFilter("all")
    setSortBy("name-asc")
  }

  return (
    <div className="max-w-[1600px] mx-auto py-4 px-6 space-y-5 sm:space-y-6">
      {/* Page Header - Professional & Mobile-Optimized */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-semibold gradient-text">
            Inventory Overview
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Comprehensive product inventory control and management
          </p>
        </div>
        
        {/* Action Buttons - Mobile stacked, Desktop inline */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 sm:flex-shrink-0">
          {/* Add Product - Primary Action */}
          {!isReadOnly && (
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="w-full sm:w-auto h-11 sm:h-9 px-4 sm:px-3 text-sm font-medium bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-700 text-white rounded-lg sm:rounded-md shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          )}
          
          {/* Secondary Actions - Grid on mobile, flex on desktop */}
          <div className="grid grid-cols-3 sm:flex gap-2">
            {/* Categories - Hidden for operations (agents), dept-manager, and logistics-admin */}
            {!isReadOnly && userRole !== 'logistics-admin' && (
              <Button
                onClick={() => setCategoryDialogOpen(true)}
                className="h-11 sm:h-9 px-3 sm:px-3 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg sm:rounded-md transition-colors"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
                <span className="hidden sm:inline">Categories</span>
                <span className="sm:hidden">Category</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards - Internal Usage Style */}
      <div className={cn(
        "grid grid-cols-2 gap-4",
        isReadOnly ? "lg:grid-cols-3" : "lg:grid-cols-5"
      )}>
        {/* Total Items */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-100">
                <Package className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Items</p>
                <p className="text-2xl font-bold text-slate-900">{formatNumber(Array.isArray(items) ? items.length : 0)}</p>
                <p className="text-xs text-slate-500 mt-0.5">products</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Quantity */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-100">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Quantity</p>
                <p className="text-2xl font-bold text-slate-900">{formatNumber(Array.isArray(items) ? items.reduce((sum, item) => sum + item.quantity, 0) : 0)}</p>
                <p className="text-xs text-slate-500 mt-0.5">units</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Value */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-green-100">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Value</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(Array.isArray(items) ? items.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0) : 0)}</p>
                <p className="text-xs text-slate-500 mt-0.5">inventory value</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total COGS - Hidden for Department Agents */}
        {!isReadOnly && (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-100">
                  <Package className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total COGS</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(Array.isArray(items) ? items.reduce((sum, item) => sum + (item.totalCOGS || (item.costPrice * item.quantity)), 0) : 0)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">cost basis</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Total Bad Stock - Hidden for Department Agents */}
        {!isReadOnly && (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Bad Stock</p>
                  <p className="text-2xl font-bold text-slate-900">{formatNumber(Array.isArray(items) ? items.filter(item => item.item_status === 'bad').reduce((sum, item) => sum + (item.bad_item_quantity || 0), 0) : 0)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">units</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Table Card - Internal Usage Style */}
      <Card className="border-0 shadow-lg overflow-hidden">
        {/* Table Toolbar */}
        <div className="px-6 py-4 border-b bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Search Bar - Half Width with Clear Button */}
            <div className="flex items-center gap-3 lg:w-1/2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search products by name, category, or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-3 h-7 text-xs border-slate-300 dark:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => setSearch("")}
                disabled={!search}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            </div>

            {/* Action Buttons - Right Side - Replaced with Category Filter */}
            <div className="flex gap-2 flex-wrap lg:flex-nowrap lg:ml-auto">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full lg:w-[200px] h-7 text-xs border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Filter by Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value: "all" | "good" | "bad") => setStatusFilter(value)}>
                <SelectTrigger className="w-full lg:w-[180px] h-7 text-xs border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="good">Good Stock</SelectItem>
                  <SelectItem value="bad">Bad Stock</SelectItem>
                </SelectContent>
              </Select>
              <Select value={stockLevelFilter} onValueChange={(value: "all" | "low" | "out") => setStockLevelFilter(value)}>
                <SelectTrigger className="w-full lg:w-[180px] h-7 text-xs border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Stock Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="low">Low Stocks</SelectItem>
                  <SelectItem value="out">Out of Stocks</SelectItem>
                </SelectContent>
              </Select>
            </div>
        </div>

        <CardContent className="p-0">
          {!Array.isArray(filteredItems) || filteredItems.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
                <Package className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </div>
              {stockLevelFilter === "low" ? (
                <>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No low stock items</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">All products have sufficient stock levels</p>
                </>
              ) : stockLevelFilter === "out" ? (
                <>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No out of stock items</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">All products are currently in stock</p>
                </>
              ) : statusFilter === "bad" ? (
                <>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No bad stock items</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">All products are in good condition</p>
                </>
              ) : debouncedSearch || categoryFilter !== "all" ? (
                <>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No products found</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Try adjusting your search or filters</p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No products found</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Get started by adding your first product</p>
                  <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Your First Product
                  </Button>
                </>
              )}
            </div>
          ) : (
            /* Table View */
            <>
              {/* Mobile Scroll Hint */}
              <div className="md:hidden px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-blue-100 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-center gap-2 font-medium">
                  <span className="text-blue-500">←</span>
                  <span>Swipe to see all columns • Tap row to highlight</span>
                  <span className="text-blue-500">→</span>
                </p>
              </div>

              <div className="overflow-x-auto">
                <div className="w-full">
                  <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black">
                      {statusFilter === "bad" ? (
                        /* Bad Stock Table Headers - Complete Reasons */
                        <>
                          <th className="py-2.5 px-3 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50 md:sticky md:left-0 bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black md:z-20 w-[80px]">
                            Image
                          </th>
                          <th className="py-2.5 px-3 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50 md:sticky md:left-[80px] bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black md:z-20 w-[180px]">
                            Item Name
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-red-300 uppercase tracking-wider border-r border-slate-700/50 w-[90px]">
                            Damaged
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-orange-300 uppercase tracking-wider border-r border-slate-700/50 w-[90px]">
                            Defective
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-yellow-300 uppercase tracking-wider border-r border-slate-700/50 w-[85px]">
                            Expired
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-green-300 uppercase tracking-wider border-r border-slate-700/50 w-[100px]">
                            Quality Failed
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-blue-300 uppercase tracking-wider border-r border-slate-700/50 w-[120px]">
                            Customer Return
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-indigo-300 uppercase tracking-wider border-r border-slate-700/50 w-[120px]">
                            Supplier Return
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-pink-300 uppercase tracking-wider border-r border-slate-700/50 w-[115px]">
                            Broken Pkg
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-cyan-300 uppercase tracking-wider border-r border-slate-700/50 w-[110px]">
                            Missing Parts
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-teal-300 uppercase tracking-wider border-r border-slate-700/50 w-[110px]">
                            Water Damage
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-amber-300 uppercase tracking-wider border-r border-slate-700/50 w-[120px]">
                            Incorrect Storage
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-lime-300 uppercase tracking-wider border-r border-slate-700/50 w-[90px]">
                            Obsolete
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-rose-300 uppercase tracking-wider border-r border-slate-700/50 w-[110px]">
                            Contaminated
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-fuchsia-300 uppercase tracking-wider border-r border-slate-700/50 w-[100px]">
                            Pest Damage
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-violet-300 uppercase tracking-wider border-r border-slate-700/50 w-[100px]">
                            Mishandling
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-purple-300 uppercase tracking-wider border-r border-slate-700/50 w-[80px]">
                            Lost
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-orange-200 uppercase tracking-wider border-r border-slate-700/50 w-[90px]">
                            Spoilage
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-red-200 uppercase tracking-wider border-r border-slate-700/50 w-[95px]">
                            Theft/Loss
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-slate-300 uppercase tracking-wider border-r border-slate-700/50 w-[80px]">
                            Other
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50 md:sticky md:right-[220px] bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black md:z-20 w-[110px]">
                            Total Bad
                          </th>
                          <th className="py-2.5 px-3 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50 md:sticky md:right-[110px] bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black md:z-20 w-[110px]">
                            Cost
                          </th>
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-white uppercase tracking-wider md:sticky md:right-0 bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black md:z-20 w-[110px]">
                            Actions
                          </th>
                        </>
                      ) : (
                        /* Normal Table Headers - No Sticky on Mobile and Desktop */
                        <>
                          {/* Image Column - Regular (No Sticky) */}
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50 bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black w-[7%]">
                            Image
                          </th>
                          {/* Product Name - Regular (No Sticky) */}
                          <th className={cn(
                            "py-2.5 px-3 text-center text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50 bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black",
                            !isReadOnly ? "w-[20%]" : "w-[24%]"
                          )}>
                            Product
                          </th>
                          <th className={cn(
                            "py-2.5 px-3 text-center text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50",
                            !isReadOnly ? "w-[12%]" : "w-[14%]"
                          )}>
                            Category
                          </th>
                          <th className={cn(
                            "py-2.5 px-3 text-center text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50",
                            !isReadOnly ? "w-[12%]" : "w-[14%]"
                          )}>
                            Status
                          </th>
                          <th className={cn(
                            "py-2.5 px-3 text-center text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50",
                            !isReadOnly ? "w-[11%]" : "w-[14%]"
                          )}>
                            Stock
                          </th>
                          {/* Hide Cost column for department agents (operations role) */}
                          {!isReadOnly && (
                            <th className="py-2.5 px-3 text-center text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50 w-[11%]">
                              Cost
                            </th>
                          )}
                          <th className={cn(
                            "py-2.5 px-3 text-center text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50",
                            !isReadOnly ? "w-[11%]" : "w-[12%]"
                          )}>
                            Price
                          </th>
                          <th className={cn(
                            "py-2.5 px-3 text-center text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50",
                            isReadOnly ? "w-[12%]" : "w-[10%]"
                          )}>
                            Margin
                          </th>
                          {!isReadOnly && (
                            <th className="py-2.5 px-3 text-center text-[10px] font-bold text-white uppercase tracking-wider md:sticky md:right-0 bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black md:z-20 w-[13%]">
                              Actions
                            </th>
                          )}
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {paginatedItems.map((item) => {
                      const profitMargin = item.sellingPrice > 0 ? ((item.sellingPrice - item.costPrice) / item.sellingPrice * 100) : 0
                      const isLowStock = item.quantity <= item.reorderLevel && item.quantity > 0
                      const isOutOfStock = item.quantity === 0
                      const stockPercentage = Math.min((item.quantity / (item.reorderLevel * 2)) * 100, 100)
                      const isSelected = selectedRowId === item.id
                      
                      // Bad stock breakdown - Individual reason quantities
                      const breakdown = (item.bad_items_breakdown || {}) as Record<string, number>
                      const totalBadQty = item.bad_item_quantity || 0
                      const totalCost = totalBadQty * item.costPrice
                      
                      // Individual reason columns (exact match from database keys)
                      const damagedQty = (breakdown['damaged'] || 0) + (breakdown['damage'] || 0)
                      const defectiveQty = (breakdown['defective'] || 0) + (breakdown['defect'] || 0)
                      const expiredQty = (breakdown['expired'] || 0)
                      const qualityFailedQty = (breakdown['quality-failed'] || 0) + (breakdown['quality-rejection'] || 0)
                      const customerReturnQty = (breakdown['customer-return'] || 0) + (breakdown['customer-return-defective'] || 0)
                      const supplierReturnQty = (breakdown['supplier-return'] || 0)
                      const brokenPackagingQty = (breakdown['broken-packaging'] || 0)
                      const missingPartsQty = (breakdown['missing-parts'] || 0)
                      const waterDamageQty = (breakdown['water-damage'] || 0)
                      const incorrectStorageQty = (breakdown['incorrect-storage'] || 0)
                      const obsoleteQty = (breakdown['obsolete'] || 0)
                      const contaminatedQty = (breakdown['contaminated'] || 0)
                      const pestDamageQty = (breakdown['pest-damage'] || 0)
                      const mishandlingQty = (breakdown['mishandling'] || 0)
                      const lostQty = (breakdown['lost'] || 0)
                      const spoilageQty = (breakdown['spoilage'] || 0)
                      const theftLossQty = (breakdown['theft-loss'] || 0)
                      const otherQty = (breakdown['other'] || 0)
                      
                      // If in bad stock view, render specialized row
                      if (statusFilter === "bad") {
                        return (
                          <tr 
                            key={item.id} 
                            onClick={() => setSelectedRowId(isSelected ? null : item.id)}
                            className={
                              isSelected
                                ? "transition-all duration-200 cursor-pointer bg-red-50 dark:bg-red-900/20 ring-2 ring-red-500 dark:ring-red-400 ring-inset"
                                : "transition-all duration-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30"
                            }
                          >
                            {/* Image - No Sticky on Mobile, Sticky on Desktop (Bad Stocks) */}
                            <td className="py-2 px-3 md:sticky md:left-0 bg-white dark:bg-slate-900 md:z-10">
                              <div className="flex items-center justify-center">
                                {item.imageUrl ? (
                                  <div className="w-10 h-10 rounded overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 border-2 border-red-300 dark:border-red-700">
                                    <img 
                                      src={item.imageUrl} 
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement
                                        target.style.display = 'none'
                                        if (target.parentElement) {
                                          target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-400"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/></svg></div>'
                                        }
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-red-300 dark:border-red-700">
                                    <span className="text-red-400 text-lg">📦</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            
                            {/* Item Name - No Sticky on Mobile, Sticky on Desktop (Bad Stocks) */}
                            <td className="py-2 px-3 md:sticky md:left-[80px] bg-white dark:bg-slate-900 md:z-10 border-r border-slate-200 dark:border-slate-700">
                              <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                            </td>
                            
                            {/* Damaged */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                damagedQty > 0 ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" : "text-slate-400"
                              )}>
                                {damagedQty || "-"}
                              </span>
                            </td>
                            
                            {/* Defective */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                defectiveQty > 0 ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" : "text-slate-400"
                              )}>
                                {defectiveQty || "-"}
                              </span>
                            </td>
                            
                            {/* Expired */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                expiredQty > 0 ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" : "text-slate-400"
                              )}>
                                {expiredQty || "-"}
                              </span>
                            </td>
                            
                            {/* Quality Failed */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                qualityFailedQty > 0 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "text-slate-400"
                              )}>
                                {qualityFailedQty || "-"}
                              </span>
                            </td>
                            
                            {/* Customer Return */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                customerReturnQty > 0 ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "text-slate-400"
                              )}>
                                {customerReturnQty || "-"}
                              </span>
                            </td>
                            
                            {/* Supplier Return */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                supplierReturnQty > 0 ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "text-slate-400"
                              )}>
                                {supplierReturnQty || "-"}
                              </span>
                            </td>
                            
                            {/* Broken Packaging */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                brokenPackagingQty > 0 ? "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300" : "text-slate-400"
                              )}>
                                {brokenPackagingQty || "-"}
                              </span>
                            </td>
                            
                            {/* Missing Parts */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                missingPartsQty > 0 ? "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300" : "text-slate-400"
                              )}>
                                {missingPartsQty || "-"}
                              </span>
                            </td>
                            
                            {/* Water Damage */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                waterDamageQty > 0 ? "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300" : "text-slate-400"
                              )}>
                                {waterDamageQty || "-"}
                              </span>
                            </td>
                            
                            {/* Incorrect Storage */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                incorrectStorageQty > 0 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" : "text-slate-400"
                              )}>
                                {incorrectStorageQty || "-"}
                              </span>
                            </td>
                            
                            {/* Obsolete */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                obsoleteQty > 0 ? "bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300" : "text-slate-400"
                              )}>
                                {obsoleteQty || "-"}
                              </span>
                            </td>
                            
                            {/* Contaminated */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                contaminatedQty > 0 ? "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300" : "text-slate-400"
                              )}>
                                {contaminatedQty || "-"}
                              </span>
                            </td>
                            
                            {/* Pest Damage */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                pestDamageQty > 0 ? "bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300" : "text-slate-400"
                              )}>
                                {pestDamageQty || "-"}
                              </span>
                            </td>
                            
                            {/* Mishandling */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                mishandlingQty > 0 ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300" : "text-slate-400"
                              )}>
                                {mishandlingQty || "-"}
                              </span>
                            </td>
                            
                            {/* Lost */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                lostQty > 0 ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" : "text-slate-400"
                              )}>
                                {lostQty || "-"}
                              </span>
                            </td>
                            
                            {/* Spoilage */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                spoilageQty > 0 ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-200" : "text-slate-400"
                              )}>
                                {spoilageQty || "-"}
                              </span>
                            </td>
                            
                            {/* Theft/Loss */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                theftLossQty > 0 ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-200" : "text-slate-400"
                              )}>
                                {theftLossQty || "-"}
                              </span>
                            </td>
                            
                            {/* Other */}
                            <td className="py-2 px-3 text-center">
                              <span className={cn(
                                "inline-flex items-center justify-center min-w-[40px] px-2 py-1 rounded font-semibold text-xs",
                                otherQty > 0 ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300" : "text-slate-400"
                              )}>
                                {otherQty || "-"}
                              </span>
                            </td>
                            
                            {/* Total Bad - No Sticky on Mobile, Sticky on Desktop (Bad Stocks) */}
                            <td className="py-2 px-3 text-center md:sticky md:right-[220px] bg-white dark:bg-slate-900 md:z-10 w-[110px]">
                              <span className="inline-flex items-center justify-center min-w-[50px] px-2.5 py-1 rounded-lg font-bold text-sm bg-red-600 text-white">
                                {totalBadQty}
                              </span>
                            </td>
                            
                            {/* Cost - No Sticky on Mobile, Sticky on Desktop (Bad Stocks) */}
                            <td className="py-2 px-3 text-left md:sticky md:right-[110px] bg-white dark:bg-slate-900 md:z-10 w-[110px]">
                              <div className="text-slate-700 dark:text-slate-300 font-medium">
                                ₱{item.costPrice.toFixed(2)}
                              </div>
                            </td>
                            
                            {/* Actions - No Sticky on Mobile, Sticky on Desktop (Bad Stocks) */}
                            <td className="py-2 px-3 text-center md:sticky md:right-0 bg-white dark:bg-slate-900 md:z-10 w-[110px]">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-300 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-400 dark:border-green-700"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setRestoreDialogItem(item)
                                  }}
                                  title="Restore to Good Stock"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs bg-red-50 hover:bg-red-100 text-red-700 border-red-300 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 dark:border-red-700"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDisposeDialogItem(item)
                                  }}
                                  title="Dispose Bad Stock"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      }
                      
                      // Normal table row rendering
                      return (
                        <tr 
                          key={item.id} 
                          onClick={() => setSelectedRowId(isSelected ? null : item.id)}
                          className={
                            isSelected
                              ? "transition-all duration-200 cursor-pointer bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500 dark:ring-blue-400 ring-inset"
                              : "transition-all duration-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30"
                          }
                        >
                          {/* Image Column - Regular (No Sticky) */}
                          <td className="py-2 px-3 bg-white dark:bg-slate-900">
                            <div className="flex items-center justify-center">
                              {item.imageUrl ? (
                                <div className="w-10 h-10 rounded overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                    onLoad={() => console.log('[Inventory] Image loaded:', item.name, item.imageUrl)}
                                    onError={(e) => {
                                      console.error('[Inventory] Image failed to load:', {
                                        name: item.name,
                                        imageUrl: item.imageUrl,
                                        actualSrc: (e.target as HTMLImageElement).src,
                                        error: e
                                      })
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                  <Package className="h-5 w-5 text-slate-400" />
                                </div>
                              )}
                            </div>
                          </td>
                          
                          {/* Product Name - Regular (No Sticky) */}
                          <td className="py-2 px-3 bg-white dark:bg-slate-900">
                            <div className="flex items-center justify-center gap-2">
                              <div className="min-w-0 flex-1 text-center">
                                <p 
                                  className={cn(
                                    "text-[13px] font-semibold break-words line-clamp-2",
                                    isSelected 
                                      ? "text-blue-900 dark:text-blue-100" 
                                      : "text-slate-900 dark:text-white"
                                  )}
                                  title={item.name}
                                >
                                  {item.name}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-2 px-3 text-center">
                            <span 
                              className={cn(
                                "text-[12px] break-words",
                                isSelected 
                                  ? "text-blue-900 dark:text-blue-100 font-medium" 
                                  : "text-slate-600 dark:text-slate-400"
                              )}
                              title={item.category}
                            >
                              {item.category}
                            </span>
                          </td>

                          {/* Stock Status - CONDITIONAL DISPLAY */}
                          <td className="py-2 px-3 text-center">
                            {(() => {
                              const badQty = item.bad_item_quantity || 0
                              const goodQty = item.quantity // item.quantity is GOOD stock only
                              const hasBadItems = badQty > 0
                              const breakdown = item.bad_items_breakdown || {}
                              const hasBreakdown = Object.keys(breakdown).length > 0
                              
                              // If filtered to "Bad Stock", show breakdown by reason AND good stock if exists
                              if (statusFilter === "bad" && hasBadItems) {
                                // Color mapping for different reasons
                                const reasonColors: Record<string, string> = {
                                  // New comprehensive reasons
                                  damaged: 'bg-red-500',
                                  defective: 'bg-orange-500',
                                  expired: 'bg-yellow-500',
                                  'quality-failed': 'bg-amber-600',
                                  'customer-return': 'bg-rose-500',
                                  'supplier-return': 'bg-purple-500',
                                  'broken-packaging': 'bg-pink-500',
                                  'missing-parts': 'bg-indigo-500',
                                  'water-damage': 'bg-blue-500',
                                  'incorrect-storage': 'bg-cyan-500',
                                  obsolete: 'bg-gray-500',
                                  contaminated: 'bg-lime-600',
                                  'pest-damage': 'bg-green-600',
                                  mishandling: 'bg-orange-600',
                                  other: 'bg-slate-500',
                                  // Legacy reasons (backward compatibility)
                                  damage: 'bg-red-500',
                                  defect: 'bg-orange-500',
                                  lost: 'bg-purple-500',
                                  spoilage: 'bg-pink-500',
                                  'theft-loss': 'bg-gray-500',
                                  'quality-rejection': 'bg-amber-500',
                                  'customer-return-defective': 'bg-rose-500'
                                }
                                
                                const textColors: Record<string, string> = {
                                  // New comprehensive reasons
                                  damaged: 'text-red-700 dark:text-red-400',
                                  defective: 'text-orange-700 dark:text-orange-400',
                                  expired: 'text-yellow-700 dark:text-yellow-400',
                                  'quality-failed': 'text-amber-700 dark:text-amber-400',
                                  'customer-return': 'text-rose-700 dark:text-rose-400',
                                  'supplier-return': 'text-purple-700 dark:text-purple-400',
                                  'broken-packaging': 'text-pink-700 dark:text-pink-400',
                                  'missing-parts': 'text-indigo-700 dark:text-indigo-400',
                                  'water-damage': 'text-blue-700 dark:text-blue-400',
                                  'incorrect-storage': 'text-cyan-700 dark:text-cyan-400',
                                  obsolete: 'text-gray-700 dark:text-gray-400',
                                  contaminated: 'text-lime-700 dark:text-lime-400',
                                  'pest-damage': 'text-green-700 dark:text-green-400',
                                  mishandling: 'text-orange-700 dark:text-orange-400',
                                  other: 'text-slate-700 dark:text-slate-400',
                                  // Legacy reasons
                                  damage: 'text-red-700 dark:text-red-400',
                                  defect: 'text-orange-700 dark:text-orange-400',
                                  lost: 'text-purple-700 dark:text-purple-400',
                                  spoilage: 'text-pink-700 dark:text-pink-400',
                                  'theft-loss': 'text-gray-700 dark:text-gray-400',
                                  'quality-rejection': 'text-amber-700 dark:text-amber-400',
                                  'customer-return-defective': 'text-rose-700 dark:text-rose-400'
                                }
                                
                                const reasonLabels: Record<string, string> = {
                                  // New comprehensive reasons
                                  damaged: 'Damaged',
                                  defective: 'Defective',
                                  expired: 'Expired',
                                  'quality-failed': 'Qual Fail',
                                  'customer-return': 'Cust Ret',
                                  'supplier-return': 'Supp Ret',
                                  'broken-packaging': 'Broken Pkg',
                                  'missing-parts': 'Miss Parts',
                                  'water-damage': 'Water Dmg',
                                  'incorrect-storage': 'Bad Store',
                                  obsolete: 'Obsolete',
                                  contaminated: 'Contam',
                                  'pest-damage': 'Pest Dmg',
                                  mishandling: 'Mishandle',
                                  other: 'Other',
                                  // Legacy reasons
                                  damage: 'Damage',
                                  defect: 'Defect',
                                  lost: 'Lost',
                                  spoilage: 'Spoilage',
                                  'theft-loss': 'Theft',
                                  'quality-rejection': 'Rejected',
                                  'customer-return-defective': 'Return'
                                }
                                
                                return (
                                  <div className="flex flex-col gap-1 items-center">
                                    {/* Show good items bar if exists */}
                                    {goodQty > 0 && (
                                      <div className="flex items-center gap-2 w-full max-w-[160px]">
                                        <span className="text-[10px] font-semibold text-green-700 dark:text-green-400 min-w-[35px] text-right tabular-nums">
                                          {formatNumber(goodQty)}
                                        </span>
                                        <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-green-500 transition-all" 
                                            style={{ width: '100%' }}
                                          />
                                        </div>
                                        <span className="text-[9px] text-slate-500 dark:text-slate-400 min-w-[40px]">
                                          Good
                                        </span>
                                      </div>
                                    )}
                                    
                                    {/* Show bad items breakdown */}
                                    {hasBreakdown ? (
                                      <>
                                        {(() => {
                                          const totalBad = Object.values(breakdown).reduce((sum: number, qty) => sum + (qty as number), 0)
                                          return Object.entries(breakdown)
                                            .filter(([_, qty]) => (qty as number) > 0)
                                            .map(([reason, qty]) => {
                                              const percentage = totalBad > 0 ? ((qty as number) / totalBad) * 100 : 0
                                              return (
                                                <div key={reason} className="flex items-center gap-2 w-full max-w-[180px]">
                                                  <span className={cn(
                                                    "text-[10px] font-semibold min-w-[35px] text-left tabular-nums",
                                                    textColors[reason] || 'text-red-700 dark:text-red-400'
                                                  )}>
                                                    {formatNumber(qty as number)}
                                                  </span>
                                                  <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div 
                                                      className={cn("h-full transition-all", reasonColors[reason] || 'bg-red-500')}
                                                      style={{ width: `${percentage}%` }}
                                                    />
                                                  </div>
                                                  <span className="text-[9px] text-slate-500 dark:text-slate-400 min-w-[40px]">
                                                    {reasonLabels[reason] || reason}
                                                  </span>
                                                </div>
                                              )
                                            })
                                        })()}
                                      </>
                                    ) : (
                                      // No breakdown data, show single red bar for bad items
                                      <div className="flex items-center gap-2 w-full max-w-[160px]">
                                        <span className="text-[10px] font-semibold text-red-700 dark:text-red-400 min-w-[35px] text-left tabular-nums">
                                          {formatNumber(badQty)}
                                        </span>
                                        <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-red-500 transition-all" 
                                            style={{ width: '100%' }}
                                          />
                                        </div>
                                        <span className="text-[9px] text-slate-500 dark:text-slate-400 min-w-[40px]">
                                          Bad
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )
                              }
                              
                              // Default display (All Status or Good Stock filter)
                              const totalItems = goodQty + badQty
                              const goodPercent = totalItems > 0 ? (goodQty / totalItems) * 100 : 0
                              const badPercent = totalItems > 0 ? (badQty / totalItems) * 100 : 0
                              
                              return (
                                <div className="flex flex-col gap-1 items-center">
                                  {hasBadItems ? (
                                    <>
                                      {/* Green bar - Good items */}
                                      <div className="flex items-center gap-2 w-full max-w-[160px]">
                                        <span className="text-[10px] font-semibold text-green-700 dark:text-green-400 min-w-[35px] text-left tabular-nums">
                                          {formatNumber(goodQty)}
                                        </span>
                                        <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-green-500 transition-all" 
                                            style={{ width: `${goodPercent}%` }}
                                          />
                                        </div>
                                      </div>
                                      
                                      {/* Red bar - Bad items */}
                                      <div className="flex items-center gap-2 w-full max-w-[160px]">
                                        <span className="text-[10px] font-semibold text-red-700 dark:text-red-400 min-w-[35px] text-left tabular-nums">
                                          {formatNumber(badQty)}
                                        </span>
                                        <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-red-500 transition-all" 
                                            style={{ width: `${badPercent}%` }}
                                          />
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    /* Single green bar - all good */
                                    <div className="flex items-center gap-2 w-full max-w-[160px]">
                                      <span className="text-[10px] font-semibold text-green-700 dark:text-green-400 min-w-[35px] text-left tabular-nums">
                                        {formatNumber(goodQty)}
                                      </span>
                                      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div 
                                          className="h-full bg-green-500 transition-all" 
                                          style={{ width: '100%' }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                          </td>

                          {/* Stock - CONDITIONAL TOTAL */}
                          <td className="py-2 px-3">
                            <div className="flex items-center justify-center">
                              {(() => {
                                // If filtered to "Bad Stock", show only bad count
                                if (statusFilter === "bad") {
                                  const badQty = item.bad_item_quantity || 0
                                  return (
                                    <span className={cn(
                                      "text-lg font-bold tabular-nums",
                                      isSelected 
                                        ? "text-red-900 dark:text-red-100" 
                                        : "text-red-700 dark:text-red-400"
                                    )}>
                                      {formatNumber(badQty)}
                                    </span>
                                  )
                                }
                                
                                // Default: show total quantity (good + bad items)
                                const badQty = item.bad_item_quantity || 0
                                const totalStock = item.quantity + badQty
                                return (
                                  <span className={cn(
                                    "text-lg font-bold tabular-nums",
                                    isSelected 
                                      ? "text-blue-900 dark:text-blue-100" 
                                      : "text-slate-900 dark:text-white"
                                  )}>
                                    {formatNumber(totalStock)}
                                  </span>
                                )
                              })()}
                            </div>
                          </td>

                          {/* Cost - Hidden for department agents (operations role) */}
                          {!isReadOnly && (
                            <td className="py-2 px-3 text-center">
                              <span className="text-[13px] font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                                {formatCurrency(item.costPrice)}
                              </span>
                            </td>
                          )}

                          {/* Price */}
                          <td className="py-2 px-3 text-center">
                            <span className={
                              isSelected 
                                ? "text-[13px] font-semibold tabular-nums text-blue-900 dark:text-blue-100" 
                                : "text-[13px] font-semibold tabular-nums text-slate-900 dark:text-white"
                            }>
                              {formatCurrency(item.sellingPrice)}
                            </span>
                          </td>

                          {/* Profit Margin */}
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className={`text-[12px] font-bold tabular-nums ${profitMargin >= 30 ? 'text-green-600' : profitMargin >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                                {profitMargin.toFixed(1)}%
                              </span>
                            </div>
                          </td>

                          {/* Actions Column - Hidden for agents (operations) and dept-manager */}
                          {!isReadOnly && (
                            <td className="py-2 px-3 md:sticky md:right-0 bg-white dark:bg-slate-900 md:z-10">
                              <TooltipProvider>
                                <div className="flex justify-start gap-0">

                                  {/* Adjust Stock - only for non-read-only users */}
                                  {!isReadOnly && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => { e.stopPropagation(); handleAdjustStock(item) }}
                                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 h-8 w-8 p-0"
                                        >
                                          <PackagePlus className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs font-semibold">
                                        Adjust Stock
                                      </TooltipContent>
                                    </Tooltip>
                                  )}

                                  {/* Edit - admins only */}
                                  {!isReadOnly && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => { e.stopPropagation(); handleEdit(item) }}
                                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-8 w-8 p-0"
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs font-semibold">
                                        Edit Product
                                      </TooltipContent>
                                    </Tooltip>
                                  )}

                                  {/* Delete - admins only */}
                                  {!isReadOnly && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => { e.stopPropagation(); openDeleteDialog(item.id, item.name) }}
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 h-8 w-8 p-0"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs font-semibold">
                                        Delete Product
                                      </TooltipContent>
                                    </Tooltip>
                                  )}

                                </div>
                              </TooltipProvider>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              </div>

              {/* Pagination */}
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredItems.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setCurrentPage(1)
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}

      <AddItemDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSuccess={fetchItems} />

      {selectedItem && (
        <EditItemDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          item={selectedItem}
          onSuccess={fetchItems}
        />
      )}

      {/* Adjust Stock Dialog */}
      {selectedAdjustItem && (
        <Dialog open={adjustStockDialogOpen} onOpenChange={setAdjustStockDialogOpen}>
          <DialogContent className="max-w-[480px] p-0 gap-0 rounded-xl overflow-hidden border-0 shadow-2xl">
            
            {/* Header */}
            <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Adjust Stock</p>
                <p className="text-sm font-bold text-white truncate">{selectedAdjustItem.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">Current stock: <span className="text-white font-semibold">{selectedAdjustItem.quantity} units</span></p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5 bg-white">

              {/* Adjustment Type Toggle */}
              <div>
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Adjustment Type</Label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('restock')}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold transition-all ${
                      adjustmentType === 'restock'
                        ? 'bg-white text-emerald-700 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <PackagePlus className={`h-4 w-4 ${adjustmentType === 'restock' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    Increase Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('reduce')}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold transition-all ${
                      adjustmentType === 'reduce'
                        ? 'bg-white text-red-700 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Package className={`h-4 w-4 ${adjustmentType === 'reduce' ? 'text-red-500' : 'text-slate-400'}`} />
                    Reduce Stock
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <Label htmlFor="adjust-amount" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                  Amount to {adjustmentType === 'restock' ? 'Add' : 'Reduce'}
                </Label>
                <Input
                  id="adjust-amount"
                  type="number"
                  min="1"
                  value={adjustAmount || ''}
                  onChange={(e) => setAdjustAmount(Number.parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="h-10 border-slate-200 bg-slate-50 focus:bg-white text-slate-900 font-medium"
                />
                {adjustAmount > 0 && (
                  <p className="text-xs text-slate-500 mt-1.5">
                    New stock will be: <span className={`font-bold ${adjustmentType === 'restock' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {adjustmentType === 'restock'
                        ? selectedAdjustItem.quantity + adjustAmount
                        : Math.max(0, selectedAdjustItem.quantity - adjustAmount)
                      } units
                    </span>
                  </p>
                )}
              </div>

              {/* Reason */}
              <div>
                <Label htmlFor="adjust-reason" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Reason</Label>
                <Select value={adjustReason} onValueChange={setAdjustReason}>
                  <SelectTrigger id="adjust-reason" className="h-10 border-slate-200 bg-slate-50 focus:bg-white">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {adjustmentType === 'restock' ? (
                      <>
                        <SelectItem value="new-stock">New Stock Arrival</SelectItem>
                        <SelectItem value="customer-return">Customer Return</SelectItem>
                        <SelectItem value="inventory-adjustment">Inventory Adjustment</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="damaged">Damaged</SelectItem>
                        <SelectItem value="defective">Defective</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="quality-failed">Quality Failed</SelectItem>
                        <SelectItem value="customer-return">Customer Return</SelectItem>
                        <SelectItem value="supplier-return">Supplier Return</SelectItem>
                        <SelectItem value="broken-packaging">Broken Packaging</SelectItem>
                        <SelectItem value="missing-parts">Missing Parts</SelectItem>
                        <SelectItem value="water-damage">Water Damage</SelectItem>
                        <SelectItem value="incorrect-storage">Incorrect Storage</SelectItem>
                        <SelectItem value="obsolete">Obsolete</SelectItem>
                        <SelectItem value="contaminated">Contaminated</SelectItem>
                        <SelectItem value="pest-damage">Pest Damage</SelectItem>
                        <SelectItem value="mishandling">Mishandling</SelectItem>
                        <SelectItem value="other">Other (with remarks)</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes (for reduce only) */}
              {adjustmentType === 'reduce' && (
                <div>
                  <Label htmlFor="adjust-notes" className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Notes <span className="normal-case font-normal text-slate-400">(optional)</span></Label>
                  <Input
                    id="adjust-notes"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="Additional details..."
                    className="h-10 border-slate-200 bg-slate-50 focus:bg-white"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdjustStockDialogOpen(false)}
                className="h-10 px-5 border-slate-300 font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={handleAdjustStockSubmit}
                disabled={adjustAmount <= 0 || !adjustReason}
                className={`h-10 px-5 font-semibold text-white shadow-sm ${
                  adjustmentType === 'restock'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {adjustmentType === 'restock' ? (
                  <><PackagePlus className="h-4 w-4 mr-2" />Increase Stock</>
                ) : (
                  <><Package className="h-4 w-4 mr-2" />Reduce Stock</>
                )}
              </Button>
            </div>

          </DialogContent>
        </Dialog>
      )}

      {/* Category Management Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-[480px] max-h-[85vh] flex flex-col p-0 gap-0 rounded-xl border-0 shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex items-center gap-3 flex-shrink-0">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Tag className="h-5 w-5 text-white" />
            </div>
            <div className="pr-6">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Products</p>
              <p className="text-sm font-bold text-white">Category Management</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 bg-white">

            {/* Add New Category */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Add New Category</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter category name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newCategory.trim()) handleAddCategory() }}
                  className="h-10 border-slate-200 bg-slate-50 focus:bg-white text-slate-900 flex-1"
                  disabled={submitting}
                />
                <Button
                  onClick={handleAddCategory}
                  disabled={!newCategory.trim() || submitting}
                  className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold flex-shrink-0 shadow-sm"
                >
                  {submitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                  ) : (
                    <><Plus className="h-4 w-4 mr-1.5" />Add</>
                  )}
                </Button>
              </div>
            </div>

            {/* Existing Categories */}
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Existing Categories
                </p>
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {categories.length}
                </span>
              </div>

              {categories.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg">
                  <Tag className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-medium text-slate-500">No categories yet</p>
                  <p className="text-xs text-slate-400 mt-0.5">Add your first category above</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40 transition-all"
                    >
                      {editingCategory?.id === category.id ? (
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            value={editCategoryValue}
                            onChange={(e) => setEditCategoryValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEditCategory()
                              if (e.key === "Escape") { setEditingCategory(null); setEditCategoryValue("") }
                            }}
                            className="h-9 text-sm flex-1 border-slate-300"
                            disabled={submitting}
                            autoFocus
                          />
                          <Button
                            onClick={handleEditCategory}
                            disabled={submitting || !editCategoryValue.trim()}
                            className="h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm flex-shrink-0"
                          >
                            {submitting ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent" /> : "Save"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => { setEditingCategory(null); setEditCategoryValue("") }}
                            disabled={submitting}
                            className="h-9 px-4 rounded-md text-xs border-slate-300 text-slate-600 hover:bg-slate-100 flex-shrink-0"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <Tag className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                            <span className="text-sm font-medium text-slate-900 truncate">{category.name}</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setEditingCategory(category); setEditCategoryValue(category.name) }}
                              disabled={submitting}
                              className="h-7 w-7 p-0 hover:bg-blue-100 hover:text-blue-600"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteCategoryId(category.id)}
                              disabled={submitting}
                              className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <Dialog open={!!deleteCategoryId} onOpenChange={() => setDeleteCategoryId(null)}>
        <DialogContent className="max-w-[420px] p-0 gap-0 rounded-xl border-0 shadow-2xl overflow-hidden">
          <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
              <Trash2 className="h-5 w-5 text-white" />
            </div>
            <div className="pr-6">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Confirm Action</p>
              <p className="text-sm font-bold text-white">Delete Category</p>
            </div>
          </div>
          <div className="px-6 py-5 bg-white">
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-900 mb-1">This action cannot be undone</p>
                <p className="text-xs text-red-700 leading-relaxed">
                  Deleting this category may affect products currently assigned to it.
                </p>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteCategoryId(null)}
              disabled={submitting}
              className="h-10 px-5 border-slate-300 font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </Button>
            <Button
              onClick={() => deleteCategoryId && handleDeleteCategory(deleteCategoryId)}
              disabled={submitting}
              className="h-10 px-5 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm"
            >
              {submitting ? (
                <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-r-transparent" />Deleting...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" />Delete Category</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Professional SaaS Delete Confirmation Modal */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[480px] mx-4 sm:mx-auto p-0 gap-0 overflow-hidden border-0 rounded-xl sm:rounded-2xl">
          {/* Header with gradient background - Compact on mobile */}
          <div className="relative bg-gradient-to-br from-red-500 via-red-600 to-red-700 px-4 sm:px-6 py-4 sm:py-5 text-center">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20"></div>
            <div className="relative">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-2 sm:mb-3 rounded-full bg-white/20 backdrop-blur-sm ring-2 sm:ring-4 ring-white/30">
                <AlertCircle className="h-6 w-6 sm:h-7 sm:w-7 text-white" strokeWidth={2.5} />
              </div>
              <DialogTitle className="text-lg sm:text-xl font-bold !text-white tracking-tight">
                Delete Product
              </DialogTitle>
              <p className="text-white text-xs mt-1 sm:mt-1.5 font-medium">
                This action is permanent and cannot be undone
              </p>
            </div>
          </div>

          {/* Content - Compact padding on mobile */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4">
            <div className="text-center space-y-2 sm:space-y-3">
              <p className="text-slate-700 dark:text-slate-300 font-medium text-sm sm:text-base">
                Are you sure you want to delete this product?
              </p>
              {itemToDelete && (
                <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg">
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-semibold mb-1">
                    Product Name
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {itemToDelete.name}
                  </p>
                </div>
              )}
            </div>

            {/* Warning box - Compact on mobile */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-red-900 dark:text-red-100 mb-1">
                    Warning: Permanent Action
                  </p>
                  <p className="text-[11px] sm:text-xs text-red-700 dark:text-red-300 leading-relaxed">
                    All product data, including inventory history and associated records, will be permanently removed from the system.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer with buttons - Mobile optimized */}
          <div className="bg-slate-50 dark:bg-slate-900/50 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-end gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false)
                  setItemToDelete(null)
                }}
                disabled={isDeleting}
                className="h-9 sm:h-11 px-4 sm:px-6 text-sm font-semibold border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => itemToDelete && handleDelete(itemToDelete.id)}
                disabled={isDeleting}
                className="h-9 sm:h-11 px-4 sm:px-6 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">Please wait...</span>
                    <span className="sm:hidden">Wait...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Delete Product</span>
                    <span className="sm:hidden">Delete</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Bad Stock Dialog */}
      {restoreDialogItem && (
        <Dialog open={!!restoreDialogItem} onOpenChange={(open) => !open && setRestoreDialogItem(null)}>
          <DialogContent className="max-w-lg p-0 gap-0 rounded-2xl border-0 shadow-2xl overflow-hidden [&>button]:hidden ring-0 focus:ring-0 focus-visible:ring-0 outline-none">
            {/* Premium Header */}
            <div className="relative bg-slate-900 px-6 py-5">
              {/* Close button */}
              <button
                onClick={() => {
                  setRestoreDialogItem(null)
                  setRestoreAmount(0)
                  setRestoreNotes("")
                }}
                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
              >
                <X className="h-3.5 w-3.5 text-white" />
              </button>

              {/* Header content */}
              <div className="flex items-center gap-4 pr-10">
                <div className="w-11 h-11 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <RotateCcw className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <DialogTitle className="!text-white text-2xl font-bold tracking-tight leading-tight" style={{ color: 'white' }}>
                    Restore Stock
                  </DialogTitle>
                  <DialogDescription className="!text-slate-300 text-sm mt-0.5" style={{ color: '#cbd5e1' }}>
                    Convert bad stock back to good condition for <strong>{restoreDialogItem.name}</strong>
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-950/50 dark:to-slate-900">
              
              {/* Bad Stock Breakdown - Show all reasons with quantities */}
              {restoreDialogItem.bad_items_breakdown && Object.keys(restoreDialogItem.bad_items_breakdown).length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Bad Stock Breakdown</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(restoreDialogItem.bad_items_breakdown).map(([reason, qty]) => (
                      <div key={reason} className="p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 rounded-lg border border-red-200 dark:border-red-700/50 shadow-sm">
                        <p className="text-xs font-semibold text-red-700 dark:text-red-400 capitalize">{reason.replace(/_/g, ' ')}</p>
                        <p className="text-xl font-black text-red-600 dark:text-red-400 tabular-nums">{qty as number} units</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 rounded-xl border border-red-200 dark:border-red-700/50 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">Available Bad Stock</p>
                      <p className="text-2xl font-black text-red-600 dark:text-red-400 tabular-nums">{restoreDialogItem.bad_item_quantity || 0} units</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Reason Selection Dropdown */}
              {restoreDialogItem.bad_items_breakdown && Object.keys(restoreDialogItem.bad_items_breakdown).length > 0 && (
                <div>
                  <Label htmlFor="restore-reason" className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                    Select Reason to Restore From *
                  </Label>
                  <Select value={restoreReason} onValueChange={setRestoreReason}>
                    <SelectTrigger id="restore-reason" className="h-12 text-base border-slate-300 focus:border-green-500 focus:ring-green-500">
                      <SelectValue placeholder="Choose which bad stock reason to restore from" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(restoreDialogItem.bad_items_breakdown).map(([reason, qty]) => (
                        <SelectItem key={reason} value={reason}>
                          <span className="capitalize">{reason.replace(/_/g, ' ')}</span> - {qty as number} units available
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Quantity Input */}
              <div>
                <Label htmlFor="restore-amount" className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                  Quantity to Restore *
                </Label>
                <Input
                  id="restore-amount"
                  type="number"
                  min="1"
                  max={
                    restoreReason && restoreDialogItem.bad_items_breakdown 
                      ? (restoreDialogItem.bad_items_breakdown[restoreReason] as number || 0)
                      : (restoreDialogItem.bad_item_quantity || 0)
                  }
                  value={restoreAmount}
                  onChange={(e) => setRestoreAmount(parseInt(e.target.value) || 0)}
                  placeholder="Enter quantity to restore"
                  className="h-12 text-base border-slate-300 focus:border-green-500 focus:ring-green-500"
                />
                {restoreReason && restoreDialogItem.bad_items_breakdown && (
                  <p className="text-xs text-slate-500 mt-1">
                    Max: {restoreDialogItem.bad_items_breakdown[restoreReason] as number} units from "{restoreReason.replace(/_/g, ' ')}"
                  </p>
                )}
              </div>

              {/* Notes Input */}
              <div>
                <Label htmlFor="restore-notes" className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                  Notes (Optional)
                </Label>
                <Input
                  id="restore-notes"
                  value={restoreNotes}
                  onChange={(e) => setRestoreNotes(e.target.value)}
                  placeholder="e.g., Items re-inspected and verified as good"
                  className="h-12 text-base border-slate-300 focus:border-green-500 focus:ring-green-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRestoreDialogItem(null)
                    setRestoreAmount(0)
                    setRestoreReason("")
                    setRestoreNotes("")
                  }}
                  className="flex-1 h-12 border-2 border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    // Validation
                    if (!restoreAmount || restoreAmount <= 0) {
                      showError("Please enter a valid quantity")
                      return
                    }
                    
                    // Check if reason is required and selected
                    const hasBreakdown = restoreDialogItem.bad_items_breakdown && Object.keys(restoreDialogItem.bad_items_breakdown).length > 0
                    if (hasBreakdown && !restoreReason) {
                      showError("Please select which reason to restore from")
                      return
                    }

                    // Check quantity limits
                    const maxQty = restoreReason && restoreDialogItem.bad_items_breakdown
                      ? (restoreDialogItem.bad_items_breakdown[restoreReason] as number || 0)
                      : (restoreDialogItem.bad_item_quantity || 0)
                    
                    if (restoreAmount > maxQty) {
                      showError(`Quantity exceeds available stock (max: ${maxQty})`)
                      return
                    }

                    try {
                      await apiPost(`/api/items/${restoreDialogItem.id}/restore`, {
                        amount: restoreAmount,
                        reason: restoreReason || null,
                        notes: restoreNotes
                      })
                      showSuccess(`Successfully restored ${restoreAmount} units to good stock!`)
                      setRestoreDialogItem(null)
                      setRestoreAmount(0)
                      setRestoreReason("")
                      setRestoreNotes("")
                      await fetchItems()
                    } catch (error) {
                      console.error("Error restoring stock:", error)
                      showError("Failed to restore stock")
                    }
                  }}
                  className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl shadow-lg"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore to Good
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dispose Bad Stock Dialog */}
      {disposeDialogItem && (
        <Dialog open={!!disposeDialogItem} onOpenChange={(open) => !open && setDisposeDialogItem(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <Trash2 className="h-5 w-5" />
                Dispose Bad Stock
              </DialogTitle>
              <DialogDescription>
                Permanently remove bad stock from inventory for <strong>{disposeDialogItem.name}</strong>
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>This action will permanently remove items from inventory. This cannot be undone.</span>
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Available bad stock: <span className="font-bold text-red-600 dark:text-red-400">{disposeDialogItem.bad_item_quantity || 0} units</span>
                </p>
              </div>

              <div>
                <Label htmlFor="dispose-amount">Quantity to Dispose *</Label>
                <Input
                  id="dispose-amount"
                  type="number"
                  min="1"
                  max={disposeDialogItem.bad_item_quantity || 0}
                  value={disposeAmount}
                  onChange={(e) => setDisposeAmount(parseInt(e.target.value) || 0)}
                  placeholder="Enter quantity"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="dispose-notes">Disposal Notes *</Label>
                <Input
                  id="dispose-notes"
                  value={disposeNotes}
                  onChange={(e) => setDisposeNotes(e.target.value)}
                  placeholder="e.g., Thrown away, donated, sent to supplier"
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDisposeDialogItem(null)
                  setDisposeAmount(0)
                  setDisposeNotes("")
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!disposeAmount || disposeAmount <= 0) {
                    showError("Please enter a valid quantity")
                    return
                  }
                  if (disposeAmount > (disposeDialogItem.bad_item_quantity || 0)) {
                    showError("Quantity exceeds available bad stock")
                    return
                  }
                  if (!disposeNotes.trim()) {
                    showError("Please provide disposal notes")
                    return
                  }

                  try {
                    await apiPost(`/api/items/${disposeDialogItem.id}/dispose`, {
                      amount: disposeAmount,
                      notes: disposeNotes
                    })
                    showSuccess(`Successfully disposed ${disposeAmount} units of bad stock!`)
                    setDisposeDialogItem(null)
                    setDisposeAmount(0)
                    setDisposeNotes("")
                    await fetchItems()
                  } catch (error) {
                    console.error("Error disposing stock:", error)
                    showError("Failed to dispose stock")
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Dispose Stock
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
