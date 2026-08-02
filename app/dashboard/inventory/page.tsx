"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Pencil, Trash2, PackagePlus, Package, Filter, X, ArrowUpDown, AlertCircle, TrendingUp, Tag, LayoutGrid, LayoutList, Eye, ShoppingCart, Check, Building2, FileDown, FileSpreadsheet, ChevronDown, AlertTriangle } from "lucide-react"
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
  
  // Department detection - Agent role for filtering and restrictions
  const [isDepartment, setIsDepartment] = useState(false)
  const [userDepartment, setUserDepartment] = useState<string>("")
  
  // Separate flag for read-only access (no edit/delete)
  const [isReadOnly, setIsReadOnly] = useState(false)
  
  useEffect(() => {
    const checkDepartment = () => {
      const user = getCurrentUser()
      const role = getCurrentUserRole()
      
      // Operations (agent) - restricted to assigned channel only
      if (role === 'operations' && user?.assignedChannel) {
        setIsDepartment(true)
        setIsReadOnly(true)
        setUserDepartment(user.assignedChannel)
      } 
      // Department Manager - read-only but restricted to assigned channel
      else if (role === 'dept-manager' && user?.assignedChannel) {
        setIsDepartment(true)
        setIsReadOnly(true)
        setUserDepartment(user.assignedChannel)
      }
      // Department Manager without assigned channel
      else if (role === 'dept-manager') {
        setIsReadOnly(true)
      }
    }
    
    checkDepartment()
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

    // Stock status filter
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
  }, [debouncedSearch, salesChannelFilter, categoryFilter, statusFilter, sortBy, items])

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
      <div className="max-w-[1400px] mx-auto py-5 space-y-6" aria-live="polite" aria-busy="true">
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
    <div className="max-w-[1400px] mx-auto py-4 px-4 sm:px-6 space-y-5 sm:space-y-6">
      {/* Page Header - Professional & Mobile-Optimized */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-2xl md:text-3xl font-bold gradient-text mb-1.5 leading-tight">
            Inventory Overview
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
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

      <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader className="pb-5 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-col gap-4">
            {/* Title Row */}
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900 dark:text-white">
                <div className="p-2 rounded-lg bg-blue-600 shadow-sm">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <span>Product Inventory</span>
              </CardTitle>
              <div className="flex items-center gap-3">
                <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-0 text-sm px-3 py-1 font-bold">
                  {filteredItems.length} items
                </Badge>
              </div>
            </div>
            
            {/* Stats Row - Responsive Grid (5 cards for admin, 3 cards for department agents) */}
            <div className={cn(
              "grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4",
              isReadOnly ? "lg:grid-cols-3" : "lg:grid-cols-5"
            )}>
              {/* Total Items - Indigo Gradient */}
              <div className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 p-4 rounded-xl bg-white dark:bg-slate-900">
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                      <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Total Items</p>
                  <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-indigo-600 to-indigo-700 bg-clip-text text-transparent tabular-nums mb-2">
                    {formatNumber(Array.isArray(items) ? items.length : 0)}
                  </p>
                  {(search || salesChannelFilter !== "all") && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Filtered: {formatNumber(Array.isArray(filteredItems) ? filteredItems.length : 0)}
                    </p>
                  )}
                </div>
              </div>

              {/* Total Quantity - Blue Gradient */}
              <div className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 p-4 rounded-xl bg-white dark:bg-slate-900">
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Total Quantity</p>
                  <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-blue-600 to-blue-700 bg-clip-text text-transparent tabular-nums mb-2">
                    {formatNumber(Array.isArray(items) ? items.reduce((sum, item) => sum + item.quantity, 0) : 0)}
                  </p>
                  {(search || salesChannelFilter !== "all") && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Filtered: {formatNumber(Array.isArray(filteredItems) ? filteredItems.reduce((sum, item) => sum + item.quantity, 0) : 0)}
                    </p>
                  )}
                </div>
              </div>

              {/* Total Value - Green Gradient */}
              <div className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 p-4 rounded-xl bg-white dark:bg-slate-900">
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Total Value</p>
                  <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-green-600 to-green-700 bg-clip-text text-transparent tabular-nums mb-2">
                    {formatCurrency(Array.isArray(items) ? items.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0) : 0)}
                  </p>
                  {(search || salesChannelFilter !== "all") && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Filtered: {formatCurrency(Array.isArray(filteredItems) ? filteredItems.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0) : 0)}
                    </p>
                  )}
                </div>
              </div>

              {/* Total COGS - Orange Gradient - Hidden for Department Agents */}
              {!isReadOnly && (
                <div className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 p-4 rounded-xl bg-white dark:bg-slate-900">
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                        <Package className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Total COGS</p>
                    <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-orange-600 to-orange-700 bg-clip-text text-transparent tabular-nums mb-2">
                      {formatCurrency(Array.isArray(items) ? items.reduce((sum, item) => sum + (item.totalCOGS || (item.costPrice * item.quantity)), 0) : 0)}
                    </p>
                    {(search || salesChannelFilter !== "all") && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Filtered: {formatCurrency(Array.isArray(filteredItems) ? filteredItems.reduce((sum, item) => sum + (item.totalCOGS || (item.costPrice * item.quantity)), 0) : 0)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Total Bad Stock - Red Gradient - Hidden for Department Agents */}
              {!isReadOnly && (
                <div className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 p-4 rounded-xl bg-white dark:bg-slate-900">
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Total Bad Stock</p>
                    <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-red-600 to-red-700 bg-clip-text text-transparent tabular-nums">
                      {formatNumber(Array.isArray(items) ? items.filter(item => item.item_status === 'bad').reduce((sum, item) => sum + (item.bad_item_quantity || 0), 0) : 0)} units
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Search & Actions Bar - No Card Container */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
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
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          {!Array.isArray(filteredItems) || filteredItems.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
                <Package className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No products found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
                {search || salesChannelFilter !== "all"
                  ? "Try adjusting your filters or search terms"
                  : "Get started by adding your first product"}
              </p>
              <Button
                onClick={() => setAddDialogOpen(true)}
                className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
              >
                <Plus className="h-4 w-4" />
                Add Your First Product
              </Button>
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
                <div className="min-w-[1100px]">
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
                          <th className="py-2.5 px-3 text-center text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50 md:sticky md:right-[90px] bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black md:z-20 w-[90px]">
                            Total Bad
                          </th>
                          <th className="py-2.5 px-3 text-left text-[10px] font-bold text-white uppercase tracking-wider md:sticky md:right-0 bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black md:z-20 w-[90px]">
                            Cost
                          </th>
                        </>
                      ) : (
                        /* Normal Table Headers - No Sticky on Mobile and Desktop */
                        <>
                          {/* Image Column - Regular (No Sticky) */}
                          <th className="py-2.5 px-3 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50 bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black w-[90px]">
                            Image
                          </th>
                          {/* Product Name - Regular (No Sticky) */}
                          <th className={cn(
                            "py-2.5 px-3 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50 bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black",
                            !isReadOnly ? "w-[20%]" : "w-[25%]"
                          )}>
                            Product
                          </th>
                          <th className={cn(
                            "py-2.5 px-3 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50",
                            !isReadOnly ? "w-[12%]" : "w-[13%]"
                          )}>
                            Category
                          </th>
                          <th className={cn(
                            "py-2.5 px-3 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50",
                            !isReadOnly ? "w-[12%]" : "w-[13%]"
                          )}>
                            Status
                          </th>
                          <th className={cn(
                            "py-2.5 px-3 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50",
                            !isReadOnly ? "w-[11%]" : "w-[15%]"
                          )}>
                            Stock
                          </th>
                          {/* Hide Cost column for department agents (operations role) */}
                          {!isReadOnly && (
                            <th className="py-2.5 px-3 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50 w-[10%]">
                              Cost
                            </th>
                          )}
                          <th className={cn(
                            "py-2.5 px-3 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50",
                            !isReadOnly ? "w-[10%]" : "w-[12%]"
                          )}>
                            Price
                          </th>
                          <th className={cn(
                            "py-2.5 px-3 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-slate-700/50",
                            isReadOnly ? "w-[12%]" : "w-[8%]"
                          )}>
                            Margin
                          </th>
                          {!isReadOnly && (
                            <th className="py-2.5 px-3 text-left text-[10px] font-bold text-white uppercase tracking-wider md:sticky md:right-0 bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black md:z-20 w-[140px]">
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
                            <td className="py-2 px-3 text-center md:sticky md:right-[180px] bg-white dark:bg-slate-900 md:z-10">
                              <span className="inline-flex items-center justify-center min-w-[50px] px-2.5 py-1 rounded-lg font-bold text-sm bg-red-600 text-white">
                                {totalBadQty}
                              </span>
                            </td>
                            
                            {/* Cost - No Sticky on Mobile, Sticky on Desktop (Bad Stocks) */}
                            <td className="py-2 px-3 md:sticky md:right-[90px] bg-white dark:bg-slate-900 md:z-10">
                              <div className="text-slate-700 dark:text-slate-300 font-medium">
                                ₱{item.costPrice.toFixed(2)}
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
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <p 
                                  className={cn(
                                    "text-xs font-semibold break-words line-clamp-2",
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
                          <td className="py-2 px-3">
                            <span 
                              className={cn(
                                "text-xs block break-words",
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
                          <td className="py-2 px-3">
                            {(() => {
                              const badQty = item.bad_item_quantity || 0
                              const goodQty = item.quantity - badQty
                              const hasBadItems = badQty > 0
                              const breakdown = item.bad_items_breakdown || {}
                              const hasBreakdown = Object.keys(breakdown).length > 0
                              
                              // If filtered to "Bad Stock", show breakdown by reason OR just red bar
                              if (statusFilter === "bad" && hasBadItems) {
                                // If we have breakdown data, show multiple bars
                                if (hasBreakdown) {
                                  const totalBad = Object.values(breakdown).reduce((sum: number, qty) => sum + (qty as number), 0)
                                
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
                                  <div className="flex flex-col gap-1 items-start">
                                    {Object.entries(breakdown)
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
                                      })}
                                  </div>
                                )
                                } else {
                                  // No breakdown data, show single red bar for bad items
                                  return (
                                    <div className="flex flex-col gap-1 items-start">
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
                                    </div>
                                  )
                                }
                              }
                              
                              // Default display (All Status or Good Stock filter)
                              const goodPercent = item.quantity > 0 ? (goodQty / item.quantity) * 100 : 0
                              const badPercent = item.quantity > 0 ? (badQty / item.quantity) * 100 : 0
                              
                              return (
                                <div className="flex flex-col gap-1 items-start">
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
                                
                                // Default: show total quantity
                                return (
                                  <span className={cn(
                                    "text-lg font-bold tabular-nums",
                                    isSelected 
                                      ? "text-blue-900 dark:text-blue-100" 
                                      : "text-slate-900 dark:text-white"
                                  )}>
                                    {formatNumber(item.quantity)}
                                  </span>
                                )
                              })()}
                            </div>
                          </td>

                          {/* Cost - Hidden for department agents (operations role) */}
                          {!isReadOnly && (
                            <td className="py-2 px-3">
                              <span className="text-xs font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                                {formatCurrency(item.costPrice)}
                              </span>
                            </td>
                          )}

                          {/* Price */}
                          <td className="py-2 px-3">
                            <span className={
                              isSelected 
                                ? "text-xs font-semibold tabular-nums text-blue-900 dark:text-blue-100" 
                                : "text-xs font-semibold tabular-nums text-slate-900 dark:text-white"
                            }>
                              {formatCurrency(item.sellingPrice)}
                            </span>
                          </td>

                          {/* Profit Margin */}
                          <td className="py-2 px-3">
                            <div className="flex items-center justify-start gap-1">
                              <span className={`text-xs font-bold tabular-nums ${profitMargin >= 30 ? 'text-green-600' : profitMargin >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
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
                                      <TooltipContent><p>Adjust Stock</p></TooltipContent>
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
                                      <TooltipContent><p>Edit</p></TooltipContent>
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
                                      <TooltipContent><p>Delete</p></TooltipContent>
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
          <DialogContent className="max-w-[95vw] sm:max-w-2xl mx-4 sm:mx-auto max-h-[90vh] flex flex-col p-0 gap-0 rounded-xl sm:rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-8 py-6 border-b border-slate-600 flex-shrink-0">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-white text-lg font-medium">Adjust Stock</span>
                    <span className="text-white text-xl font-bold capitalize">{selectedAdjustItem.name.toLowerCase()}</span>
                  </div>
                </DialogTitle>
                <DialogDescription className="text-slate-200 text-sm mt-2 font-medium">
                  Current stock: {selectedAdjustItem.quantity} units
                </DialogDescription>
              </DialogHeader>
            </div>
            
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 min-h-0">
              {/* Adjustment Type */}
              <div>
                <Label className="text-slate-700 dark:text-slate-300 font-medium">Adjustment Type</Label>
                <div className="flex gap-3 mt-2">
                  <Button
                    type="button"
                    variant={adjustmentType === 'restock' ? 'default' : 'outline'}
                    onClick={() => setAdjustmentType('restock')}
                    className="flex-1"
                  >
                    <PackagePlus className="h-4 w-4 mr-2" />
                    Increase Stock
                  </Button>
                  <Button
                    type="button"
                    variant={adjustmentType === 'reduce' ? 'default' : 'outline'}
                    onClick={() => setAdjustmentType('reduce')}
                    className="flex-1"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Reduce Stock
                  </Button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <Label htmlFor="adjust-amount" className="text-slate-700 dark:text-slate-300 font-medium">
                  Amount to {adjustmentType === 'restock' ? 'Add' : 'Reduce'}
                </Label>
                <Input
                  id="adjust-amount"
                  type="number"
                  min="1"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Number.parseInt(e.target.value) || 0)}
                  placeholder="Enter amount"
                  className="mt-1.5 h-10 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                />
              </div>

              {/* Reason */}
              <div>
                <Label htmlFor="adjust-reason" className="text-slate-700 dark:text-slate-300 font-medium">Reason</Label>
                <Select value={adjustReason} onValueChange={setAdjustReason}>
                  <SelectTrigger id="adjust-reason" className="mt-1.5 h-10 rounded-lg border-2">
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
                  <Label htmlFor="adjust-notes" className="text-slate-700 dark:text-slate-300 font-medium">Notes (Optional)</Label>
                  <Input
                    id="adjust-notes"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="Additional details..."
                    className="mt-1.5 h-10 rounded-lg border-2"
                  />
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 px-8 py-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 flex-shrink-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setAdjustStockDialogOpen(false)}
                className="px-6 border-2 font-semibold"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                onClick={handleAdjustStockSubmit} 
                disabled={adjustAmount <= 0 || !adjustReason} 
                className="px-6 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold shadow-lg"
              >
                {adjustmentType === 'restock' ? 'Increase Stock' : 'Reduce Stock'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Category Management Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] mx-4 sm:mx-auto flex flex-col p-0 gap-0 rounded-xl sm:rounded-2xl overflow-hidden">
          {/* Professional Header with Dark Gradient - Mobile optimized */}
          <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-600 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                  <Tag className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <span className="text-white">Category Management</span>
              </DialogTitle>
              <DialogDescription className="text-slate-200 text-xs sm:text-sm mt-1 sm:mt-2 font-medium">
                Add and manage product categories
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 px-4 sm:px-8 py-4 sm:py-6 min-h-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-slate-500 [&::-webkit-scrollbar]:opacity-0 hover:[&::-webkit-scrollbar]:opacity-100 transition-opacity">
            {/* Add New Category Section - Mobile optimized */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-2 border-dashed border-orange-300 dark:border-orange-700 rounded-xl p-3 sm:p-4 space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2 mb-1 sm:mb-2">
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600" />
                <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">Add New Category</h3>
              </div>
              
              <div>
                <Label className="text-[10px] sm:text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 sm:mb-1.5 block">
                  Category Name *
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Enter category name"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newCategory.trim()) {
                        handleAddCategory()
                      }
                    }}
                    className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                    disabled={submitting}
                  />
                  <Button
                    onClick={handleAddCategory}
                    disabled={!newCategory.trim() || submitting}
                    className="h-9 sm:h-10 px-4 sm:px-6 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-xs sm:text-sm font-semibold flex-shrink-0 shadow-sm"
                  >
                    {submitting ? (
                      <CustomLoader size="sm" />
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">Add</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Existing Categories List */}
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white mb-2 sm:mb-3 px-1">
                Existing Categories ({categories.length})
              </h3>

            {/* Category List */}
            {categories.length === 0 ? (
              <div className="text-center py-8 sm:py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                <Tag className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-slate-400 mb-2 sm:mb-3" />
                <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">No categories yet</p>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-500 mt-1">Add your first category using the form above</p>
              </div>
            ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-orange-300 dark:hover:border-orange-700 transition-colors"
                >
                  {editingCategory?.id === category.id ? (
                    <div className="flex-1 flex gap-2">
                      <Input
                        value={editCategoryValue}
                        onChange={(e) => setEditCategoryValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleEditCategory()
                          }
                          if (e.key === "Escape") {
                            setEditingCategory(null)
                            setEditCategoryValue("")
                          }
                        }}
                        className="h-8 sm:h-9 text-xs sm:text-sm flex-1"
                        disabled={submitting}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={handleEditCategory}
                        disabled={submitting || !editCategoryValue.trim()}
                        className="h-8 sm:h-9 px-3 sm:px-4 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm whitespace-nowrap"
                      >
                        {submitting ? <CustomLoader size="sm" /> : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingCategory(null)
                          setEditCategoryValue("")
                        }}
                        disabled={submitting}
                        className="h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Tag className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                        <span className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white truncate">{category.name}</span>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingCategory(category)
                            setEditCategoryValue(category.name)
                          }}
                          disabled={submitting}
                          className="h-7 w-7 p-0 text-slate-600 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-400"
                        >
                          <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteCategoryId(category.id)}
                          disabled={submitting}
                          className="h-7 w-7 p-0 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
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
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-w-[95vw] sm:max-w-md mx-4 sm:mx-auto rounded-xl sm:rounded-2xl">
          <DialogHeader className="px-1">
            <DialogTitle className="text-slate-900 dark:text-white text-base sm:text-lg font-semibold">Delete Category</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400 text-sm">
              Are you sure you want to delete this category? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteCategoryId(null)}
              disabled={submitting}
              className="flex-1 sm:flex-initial h-9 sm:h-10 px-4 sm:px-6 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={() => deleteCategoryId && handleDeleteCategory(deleteCategoryId)}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white flex-1 sm:flex-initial h-9 sm:h-10 px-4 sm:px-6 text-sm"
            >
              {submitting ? (
                <>
                  <CustomLoader size="sm" className="mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
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
    </div>
  )
}
