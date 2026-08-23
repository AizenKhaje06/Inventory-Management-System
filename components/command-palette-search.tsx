'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Command as CommandPrimitive } from 'cmdk'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  Package,
  FileText,
  ShoppingCart,
  Users,
  TrendingUp,
  Settings,
  History,
  AlertCircle,
  XCircle,
  BarChart3,
  Warehouse,
  PackagePlus,
  Search,
  ArrowRight,
  X,
  ClipboardList,
} from 'lucide-react'

interface CommandItem {
  id: string
  title: string
  description?: string
  icon: any
  href: string
  category: 'pages' | 'actions' | 'quick-links'
  keywords?: string[]
}

const commandItems: CommandItem[] = [
  // Main Pages
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Overview and analytics',
    icon: LayoutDashboard,
    href: '/dashboard',
    category: 'pages',
    keywords: ['home', 'overview', 'main'],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    description: 'Manage products and stock',
    icon: Package,
    href: '/dashboard/inventory',
    category: 'pages',
    keywords: ['products', 'items', 'stock'],
  },
  {
    id: 'pos',
    title: 'Point of Sale (POS)',
    description: 'Create transactions and sales',
    icon: ShoppingCart,
    href: '/dashboard/pos',
    category: 'pages',
    keywords: ['pos', 'sales', 'checkout', 'transaction'],
  },
  {
    id: 'orders',
    title: 'Orders Management',
    description: 'Track and manage dispatched orders',
    icon: ClipboardList,
    href: '/dashboard/orders',
    category: 'pages',
    keywords: ['orders', 'dispatch', 'cancel', 'waybill', 'tracking'],
  },
  {
    id: 'customers',
    title: 'Customers',
    description: 'Manage customer information',
    icon: Users,
    href: '/dashboard/customers',
    category: 'pages',
    keywords: ['clients', 'contacts'],
  },

  {
    id: 'activity-logs',
    title: 'Activity Logs',
    description: 'View system activity',
    icon: History,
    href: '/dashboard/log',
    category: 'pages',
    keywords: ['history', 'audit', 'trail'],
  },
  {
    id: 'cancelled-orders',
    title: 'Cancelled Orders',
    description: 'View cancelled transactions',
    icon: XCircle,
    href: '/dashboard/cancelled-orders',
    category: 'pages',
    keywords: ['cancelled', 'refund', 'void'],
  },


  {
    id: 'settings',
    title: 'Settings',
    description: 'System configuration',
    icon: Settings,
    href: '/dashboard/settings',
    category: 'pages',
    keywords: ['config', 'preferences', 'options'],
  },

  // Quick Links - Inventory Sub-pages
  {
    id: 'low-stock',
    title: 'Low Stock Items',
    description: 'Items below reorder level',
    icon: AlertCircle,
    href: '/dashboard/inventory/low-stock',
    category: 'quick-links',
    keywords: ['alert', 'warning', 'reorder', 'inventory'],
  },
  {
    id: 'out-of-stock',
    title: 'Out of Stock',
    description: 'Items with zero quantity',
    icon: PackagePlus,
    href: '/dashboard/inventory/out-of-stock',
    category: 'quick-links',
    keywords: ['empty', 'zero', 'restock', 'inventory'],
  },
]

export function CommandPaletteSearch() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const router = useRouter()

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const handleSelect = useCallback((href: string) => {
    setOpen(false)
    setSearch('')
    router.push(href)
  }, [router])

  const filteredPages = commandItems.filter(item => item.category === 'pages')
  const filteredQuickLinks = commandItems.filter(item => item.category === 'quick-links')

  return (
    <>
      {/* Search Button Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all flex-shrink-0 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 lg:max-w-full"
        aria-label="Search (Ctrl+K)"
      >
        <Search className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm flex-1 text-left">Search pages, actions, or commands...</span>
        <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 font-mono text-[10px] font-medium text-slate-600 dark:text-slate-400 flex-shrink-0">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Command Palette Dialog - Lightswind UI Style */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        {/* Header with Site Search title and ESC button */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Search className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Site Search</h2>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm">
              ESC
            </kbd>
            <button
              onClick={() => setOpen(false)}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 text-slate-400 flex-shrink-0" strokeWidth={2.5} />
            <CommandPrimitive.Input
              placeholder="Search & access anything from this site...!" 
              value={search}
              onValueChange={setSearch}
              className="flex-1 bg-transparent border-0 text-base placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none text-slate-900 dark:text-white font-medium"
            />
          </div>
        </div>
        
        <CommandList className="max-h-[450px] overflow-y-auto">
          <CommandEmpty className="py-12 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Search className="h-5 w-5 text-slate-400" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No results found</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Try a different search term</p>
              </div>
            </div>
          </CommandEmpty>

          {/* Pages Section */}
          <CommandGroup 
            heading="Get Started" 
            className="px-4 py-2 [&_[cmdk-group-heading]]:px-0 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-slate-500 dark:[&_[cmdk-group-heading]]:text-slate-400"
          >
            {filteredPages.slice(0, 2).map((item) => {
              const Icon = item.icon
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.title} ${item.description} ${item.keywords?.join(' ')}`}
                  onSelect={() => handleSelect(item.href)}
                  className="flex items-center justify-between gap-3 px-3 py-3 rounded-lg cursor-pointer data-[selected=true]:bg-slate-100 dark:data-[selected=true]:bg-slate-800 transition-colors group mb-1"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4 w-4 text-white dark:text-slate-900" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight">
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                      get started
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-400" strokeWidth={2} />
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>

          {/* Component Categories Section */}
          <CommandGroup 
            heading="Component Categories" 
            className="px-4 py-2 [&_[cmdk-group-heading]]:px-0 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-slate-500 dark:[&_[cmdk-group-heading]]:text-slate-400"
          >
            {filteredPages.slice(2).map((item) => {
              const Icon = item.icon
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.title} ${item.description} ${item.keywords?.join(' ')}`}
                  onSelect={() => handleSelect(item.href)}
                  className="flex items-center justify-between gap-3 px-3 py-3 rounded-lg cursor-pointer data-[selected=true]:bg-slate-100 dark:data-[selected=true]:bg-slate-800 transition-colors group mb-1"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4 w-4 text-white dark:text-slate-900" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight">
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded lowercase">
                      {item.keywords?.[0] || 'view'}
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-400" strokeWidth={2} />
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>

          {/* Quick Links Section */}
          {filteredQuickLinks.length > 0 && (
            <CommandGroup 
              heading="Quick Access" 
              className="px-4 py-2 pb-4 [&_[cmdk-group-heading]]:px-0 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-slate-500 dark:[&_[cmdk-group-heading]]:text-slate-400"
            >
              {filteredQuickLinks.map((item) => {
                const Icon = item.icon
                return (
                  <CommandItem
                    key={item.id}
                    value={`${item.title} ${item.description} ${item.keywords?.join(' ')}`}
                    onSelect={() => handleSelect(item.href)}
                    className="flex items-center justify-between gap-3 px-3 py-3 rounded-lg cursor-pointer data-[selected=true]:bg-slate-100 dark:data-[selected=true]:bg-slate-800 transition-colors group mb-1"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4 w-4 text-white dark:text-slate-900" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight">
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded lowercase">
                        {item.keywords?.[0] || 'view'}
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-400" strokeWidth={2} />
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
