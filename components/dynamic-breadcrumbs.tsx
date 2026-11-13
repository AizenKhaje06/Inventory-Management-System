"use client"

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href: string
}

/**
 * Route label mappings for better UX
 */
const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  inventory: 'Inventory',
  create: 'Create',
  'low-stock': 'Low Stock',
  'out-of-stock': 'Out of Stock',
  pos: 'Point of Sale (POS)',
  'employee-purchases': 'Employee Purchases',
  sales: 'Sales',
  insights: 'Business Insights',
  customers: 'Customers',
  reports: 'Reports',
  log: 'Activity Logs',
  settings: 'Settings',
  operations: 'Operations Dashboard',
  'internal-usage': 'Internal Usage',
  admin: 'Admin',
  credentials: 'Credentials',
  instructions: 'Instructions',
  'product-edit': 'Product Edit',
  'settings-code': 'Settings Code',
}

export function DynamicBreadcrumbs() {
  const pathname = usePathname()

  // Don't show breadcrumbs on home page
  if (pathname === '/') return null

  const pathSegments = pathname.split('/').filter(Boolean)
  
  // Build breadcrumb items
  const breadcrumbs: BreadcrumbItem[] = pathSegments.map((segment, index) => {
    const href = '/' + pathSegments.slice(0, index + 1).join('/')
    const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
    
    return { label, href }
  })

  // Add home
  const allBreadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
    ...breadcrumbs
  ]

  return (
    <nav 
      aria-label="Breadcrumb" 
      className="mb-6 animate-in fade-in-0 slide-in-from-top-2 duration-500"
    >
      <ol className="flex items-center gap-2 text-sm flex-wrap">
        {allBreadcrumbs.map((item, index) => {
          const isLast = index === allBreadcrumbs.length - 1
          const isFirst = index === 0

          return (
            <li key={item.href} className="flex items-center gap-2">
              {!isFirst && (
                <ChevronRight 
                  className="h-4 w-4 text-slate-400 dark:text-slate-600" 
                  aria-hidden="true"
                />
              )}
              
              {isLast ? (
                <span 
                  className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5"
                  aria-current="page"
                >
                  {isFirst && <Home className="h-4 w-4" aria-hidden="true" />}
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
                    "transition-colors duration-200 flex items-center gap-1.5",
                    "hover:underline underline-offset-4"
                  )}
                >
                  {isFirst && <Home className="h-4 w-4" aria-hidden="true" />}
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
