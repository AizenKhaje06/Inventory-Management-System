"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  PackageOpen,
  AlertTriangle,
  XCircle,
  TrendingUp,
  FileText,
  LogOut,
  Users,
  Brain,
  X,
  Settings,
  BarChart2,
  FileBarChart2,
  MessageCircle,
  ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/hooks/use-accessibility"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getCurrentUser, hasPermission } from "@/lib/auth"
import { apiGet } from "@/lib/api-client"

interface NavItem {
  name: string
  href: string
  icon: any
  badge?: number
  badgeVariant?: 'default' | 'destructive' | 'warning'
}

interface NavSection {
  section: string
  items: NavItem[]
}

const getNavigation = (lowStockCount: number = 0, outOfStockCount: number = 0): NavSection[] => [
  {
    section: "Main",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Point of Sale (POS)", href: "/dashboard/pos", icon: ShoppingCart },
    ],
  },
  {
    section: "Inventory",
    items: [
      { name: "Products", href: "/dashboard/inventory", icon: Package },
      { name: "Internal Usage", href: "/dashboard/internal-usage", icon: PackageOpen },
      { 
        name: "Low Stocks", 
        href: "/dashboard/inventory/low-stock", 
        icon: AlertTriangle,
        badge: lowStockCount > 0 ? lowStockCount : undefined,
        badgeVariant: 'warning'
      },
      { 
        name: "Out of Stocks", 
        href: "/dashboard/inventory/out-of-stock", 
        icon: XCircle,
        badge: outOfStockCount > 0 ? outOfStockCount : undefined,
        badgeVariant: 'destructive'
      },
    ],
  },
  {
    section: "Reports",
    items: [
      { name: "Orders", href: "/dashboard/orders", icon: ClipboardList },
      { name: "Sales", href: "/dashboard/sales", icon: FileBarChart2 },
    ],
  },
  {
    section: "System",
    items: [
      { name: "Activity Logs", href: "/dashboard/log", icon: FileText },
      { name: "Settings", href: "/dashboard/settings", icon: Settings }, // Admin only
    ],
  },
]

interface PremiumSidebarProps {
  onNavClick?: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
  onCollapsedChange?: (collapsed: boolean) => void
}

export function PremiumSidebar({ onNavClick, mobileOpen = false, onMobileClose, onCollapsedChange }: PremiumSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false) // Default: false = expanded/open
  const reducedMotion = useReducedMotion()
  const [isMobile, setIsMobile] = useState(false)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [outOfStockCount, setOutOfStockCount] = useState(0)
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getCurrentUser>>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [showContactModal, setShowContactModal] = useState(false)
  const [showPreferenceModal, setShowPreferenceModal] = useState(false)

  // Get current user
  useEffect(() => {
    setCurrentUser(getCurrentUser())
  }, [])

  // Fetch profile image
  useEffect(() => {
    const fetchProfileImage = async () => {
      try {
        const user = getCurrentUser()
        if (!user?.username) return

        // Fetch user profile including image from API
        const response = await fetch('/api/auth/profile', {
          method: 'GET',
          headers: {
            'x-user-username': user.username
          }
        })

        if (!response.ok) return

        const data = await response.json()
        if (data?.profile_image) {
          setProfileImage(data.profile_image)
        }
      } catch (error) {
        console.error('Error fetching profile image:', error)
      }
    }

    if (currentUser) {
      fetchProfileImage()
    }
  }, [currentUser])

  // Notify parent when collapsed state changes
  useEffect(() => {
    onCollapsedChange?.(collapsed)
  }, [collapsed, onCollapsedChange])

  // Fetch inventory counts for badges (admin only)
  useEffect(() => {
    const fetchInventoryCounts = async () => {
      try {
        // Skip for non-admin users who don't have access to /api/items
        const user = getCurrentUser()
        if (user?.role !== 'admin') {
          return
        }

        const items = await apiGet<any[]>('/api/items')
        const lowStock = items.filter((item: any) => item.quantity > 0 && item.quantity <= item.reorderLevel).length
        const outOfStock = items.filter((item: any) => item.quantity === 0).length
        setLowStockCount(lowStock)
        setOutOfStockCount(outOfStock)
      } catch (error) {
        console.error('Error fetching inventory counts:', error)
      }
    }

    fetchInventoryCounts()
    // Refresh counts every 30 seconds
    const interval = setInterval(fetchInventoryCounts, 30000)
    return () => clearInterval(interval)
  }, [])

  const allNavigation = getNavigation(lowStockCount, outOfStockCount)
  
  // Filter navigation based on user role
  const navigation = currentUser ? allNavigation.map(section => ({
    ...section,
    items: section.items.filter(item => {
      const hasAccess = hasPermission(currentUser.role, item.href)
      console.log(`[Sidebar] ${currentUser.role} - ${item.name} (${item.href}): ${hasAccess}`)
      return hasAccess
    })
  })).filter(section => section.items.length > 0) : allNavigation

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    if (isMobile && mobileOpen) {
      onMobileClose?.()
    }
  }, [pathname])

  const handleNavClick = () => {
    onNavClick?.()
    if (isMobile) {
      onMobileClose?.()
    }
  }

  const handleLogout = async () => {
    try {
      console.log('[Sidebar] Starting logout...')
      
      // Check if team leader
      const user = getCurrentUser()
      
      console.log('[Sidebar] User role:', user?.role)
      
      // Set a marker BEFORE clearing to prevent race conditions
      if (typeof window !== 'undefined') {
        try {
          // Use a cookie as backup since localStorage might fail
          document.cookie = '__logout_marker__=true; path=/; max-age=10'
          console.log('[Sidebar] Logout marker set in cookie')
        } catch (e) {
          console.error('[Sidebar] Cookie error:', e)
        }
      }
      
      // CRITICAL: Unregister service worker to clear all caches
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations()
          console.log('[Sidebar] Found service workers:', registrations.length)
          
          for (const registration of registrations) {
            await registration.unregister()
            console.log('[Sidebar] Service worker unregistered')
          }
        } catch (e) {
          console.error('[Sidebar] Service worker unregister error:', e)
        }
      }
      
      // Clear all caches
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys()
          console.log('[Sidebar] Found caches:', cacheNames)
          
          for (const cacheName of cacheNames) {
            await caches.delete(cacheName)
            console.log('[Sidebar] Cache deleted:', cacheName)
          }
        } catch (e) {
          console.error('[Sidebar] Cache delete error:', e)
        }
      }
      
      // Use the proper clearCurrentUser function from lib/auth.ts
      // This ensures all session keys are properly removed
      const { clearCurrentUser } = await import('@/lib/auth')
      clearCurrentUser()
      console.log('[Sidebar] clearCurrentUser() called')
      
      // Additional aggressive clearing for any remaining keys
      if (typeof window !== 'undefined' && localStorage) {
        console.log('[Sidebar] Double-checking localStorage...')
        
        // Get all remaining keys
        const keys = Object.keys(localStorage)
        console.log('[Sidebar] Remaining keys after clearCurrentUser:', keys)
        
        // Remove any remaining keys
        if (keys.length > 0) {
          console.log('[Sidebar] Removing remaining keys:', keys)
          keys.forEach(key => {
            try {
              localStorage.removeItem(key)
            } catch (e) {
              console.error('[Sidebar] Error removing key:', key, e)
            }
          })
        }
        
        // Final clear
        try {
          localStorage.clear()
          console.log('[Sidebar] localStorage.clear() called')
        } catch (e) {
          console.error('[Sidebar] localStorage.clear() error:', e)
        }
      }
      
      // Clear sessionStorage
      if (typeof window !== 'undefined' && sessionStorage) {
        console.log('[Sidebar] Clearing sessionStorage...')
        try {
          sessionStorage.clear()
          console.log('[Sidebar] sessionStorage cleared')
        } catch (e) {
          console.error('[Sidebar] sessionStorage.clear() error:', e)
        }
      }
      
      // Force redirect with timestamp to prevent caching
      const timestamp = Date.now()
      console.log('[Sidebar] Redirecting to login with timestamp:', timestamp)
      
      // Use location.replace to prevent back button
      window.location.replace(`/?logout=${timestamp}`)
      
    } catch (error) {
      console.error('[Sidebar] Logout error:', error)
      // Force redirect even on error
      window.location.replace('/?logout=error')
    }
  }

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobile && mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobile, mobileOpen])

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed z-50 flex flex-col",
          reducedMotion ? "" : "transition-all duration-300",
          // Fixed width - no more collapsing
          "w-48 xl:w-52",
          isMobile && !mobileOpen && "-translate-x-full",
          isMobile && mobileOpen && "translate-x-0",
          // Desktop: clean edge with subtle border
          "lg:left-0 lg:top-0 lg:h-screen",
          // Mobile: full screen
          "left-0 top-0 h-screen",
          // Light mode - gradient matching track-orders table header
          "bg-gradient-to-b from-slate-800 to-slate-900 border-r border-slate-700/50",
          // Dark mode - pure black with subtle border
          "dark:bg-none dark:bg-black dark:border-slate-800/60"
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo & Brand - Professional Layout with Dark Mode Support */}
        <div 
          className="h-16 flex items-center px-1.5 xl:px-2 pt-2 pb-3 flex-shrink-0 relative"
        >
          {/* Bottom border line - matching separator style */}
          <div className="absolute bottom-0 left-2 right-2 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:from-transparent dark:via-white dark:to-transparent" />
          
          {/* Logo - Centered */}
          <div className="flex items-center justify-center flex-1">
            <div className="flex items-center justify-center py-1.5">
              {/* Light mode logo */}
              <img 
                src="/WIHILOGO.png" 
                alt="WIHI Asia" 
                className="h-14 w-auto object-contain dark:hidden"
              />
              {/* Dark mode logo */}
              <img 
                src="/WIHILOGO.png" 
                alt="WIHI Asia" 
                className="h-14 w-auto object-contain hidden dark:block"
              />
            </div>
          </div>
          
          {/* Mobile Close Button */}
          {isMobile && (
            <button
              onClick={onMobileClose}
              className="ml-auto p-2 rounded-lg transition-colors text-white hover:bg-white/10 dark:text-slate-400 dark:hover:bg-slate-800 flex-shrink-0"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2.5 xl:py-3 px-1.5 xl:px-2 min-h-0 max-h-full scrollbar-hide" aria-label="Primary">
          {navigation.map((section, sectionIdx) => (
            <div key={section.section} className={cn("mb-4 xl:mb-5", sectionIdx === 0 && "mt-0")}>
              {/* Separator line above section (except first section) */}
              {!collapsed && sectionIdx > 0 && (
                <div className="h-px mb-3 mx-2 bg-gradient-to-r from-transparent via-white to-transparent dark:from-transparent dark:via-white dark:to-transparent" />
              )}
              {!collapsed && (
                <div className="px-1.5 xl:px-2 mb-1">
                  <p className="text-xs xl:text-sm font-semibold uppercase tracking-wider text-white dark:text-white">
                    {section.section}
                  </p>
                </div>
              )}
              {collapsed && sectionIdx > 0 && (
                <div className="h-px my-2.5 xl:my-3 mx-2 bg-gradient-to-r from-transparent via-white to-transparent dark:from-transparent dark:via-white dark:to-transparent" />
              )}
              <div className="space-y-0.5 xl:space-y-1" role="list">
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  const NavLink = (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleNavClick}
                      className={cn(
                        "flex items-center group relative overflow-hidden",
                        reducedMotion ? "" : "transition-all duration-200",
                        // Collapsed state: centered icon with better spacing
                        collapsed ? "justify-center py-2.5 xl:py-3 mx-auto" : "gap-1.5 xl:gap-2 px-1.5 xl:px-2 py-1.5 xl:py-2",
                        // Active state - GOLD GRADIENT with LEFT BORDER
                        isActive 
                          ? "border-l-3 border-amber-500" 
                          : "text-white/70 hover:text-white hover:bg-amber-500/5 dark:text-white/70 dark:hover:text-white dark:hover:bg-amber-500/5 border-l-3 border-transparent",
                        // Smooth transitions
                        "transition-all duration-200"
                      )}
                      style={isActive ? {
                        borderLeftWidth: '3px',
                        borderLeftColor: '#f59e0b',
                        background: 'rgba(245, 158, 11, 0.10)',
                      } : {
                        borderLeftWidth: '3px',
                        borderLeftColor: 'transparent'
                      }}
                      aria-current={isActive ? "page" : undefined}
                      role="listitem"
                    >
                      {/* Icon with neon glow effect when active */}
                      <div className={cn(
                        "flex items-center justify-center flex-shrink-0 relative",
                        collapsed ? "w-5 h-5 xl:w-6 xl:h-6" : ""
                      )}>
                        <item.icon
                          className={cn(
                            "flex-shrink-0 relative z-10",
                            collapsed 
                              ? "h-[16px] w-[16px] xl:h-[18px] xl:w-[18px]" 
                              : "h-[13px] w-[13px] xl:h-[14px] xl:w-[14px]",
                            // Icon animation on hover
                            !reducedMotion && "group-hover:scale-110 transition-transform duration-200"
                          )}
                          strokeWidth={isActive ? 2.5 : 2}
                          style={isActive ? {
                            filter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.8)) drop-shadow(0 0 12px rgba(245, 158, 11, 0.4))',
                            color: '#fbbf24'
                          } : undefined}
                          aria-hidden="true"
                        />
                        {/* Gold glow backdrop for active icon */}
                        {isActive && (
                          <div 
                            className="absolute inset-0 blur-md opacity-50"
                            style={{
                              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.6) 0%, transparent 70%)'
                            }}
                          />
                        )}
                      </div>
                      
                      {!collapsed && (
                        <>
                          <span 
                            className={cn(
                              "text-xs xl:text-sm flex-1 relative z-10",
                              isActive ? "font-semibold" : "font-normal"
                            )}
                            style={isActive ? {
                              background: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              backgroundClip: 'text',
                              filter: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.5))'
                            } : undefined}
                          >
                            {item.name}
                          </span>
                          {item.badge !== undefined && (
                            <Badge 
                              variant={item.badgeVariant === 'destructive' ? 'destructive' : item.badgeVariant === 'warning' ? 'default' : 'default'}
                              className={cn(
                                "ml-auto text-xs xl:text-sm px-1 xl:px-1.5 py-0",
                                item.badgeVariant === 'warning' && "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
                                isActive && "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                              )}
                              style={isActive ? {
                                boxShadow: '0 0 8px rgba(245, 158, 11, 0.3)'
                              } : undefined}
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </>
                      )}
                      
                      {/* Enhanced badge for collapsed state */}
                      {collapsed && item.badge !== undefined && (
                        <div className={cn(
                          "absolute -top-0.5 -right-0.5 xl:-top-1 xl:-right-1",
                          "min-w-[16px] h-[16px] xl:min-w-[18px] xl:h-[18px]",
                          "rounded-full flex items-center justify-center",
                          "text-white text-xs xl:text-sm font-bold",
                          "shadow-lg",
                          "border-2 border-white dark:border-slate-900",
                          item.badgeVariant === 'destructive' 
                            ? "bg-gradient-to-br from-red-500 to-red-600" 
                            : item.badgeVariant === 'warning'
                            ? "bg-gradient-to-br from-amber-500 to-amber-600"
                            : "bg-gradient-to-br from-blue-500 to-blue-600",
                          !reducedMotion && "animate-pulse"
                        )}>
                          {item.badge > 9 ? '9+' : item.badge}
                        </div>
                      )}
                    </Link>
                  )

                  return collapsed ? (
                    <TooltipProvider key={item.name}>
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                          {NavLink}
                        </TooltipTrigger>
                        <TooltipContent 
                          side="right" 
                          className={cn(
                            "font-medium shadow-xl border-slate-200 dark:border-slate-700",
                            "bg-white/95 dark:bg-black/95 backdrop-blur-sm"
                          )}
                          sideOffset={12}
                        >
                          <p className="font-semibold">{item.name}</p>
                          {item.badge !== undefined && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {item.badge} {item.badgeVariant === 'warning' ? 'low stock' : item.badgeVariant === 'destructive' ? 'out of stock' : 'items'}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : NavLink
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile Dropdown */}
        <div className="p-2.5 xl:p-3 border-t flex-shrink-0 border-white/10 dark:border-slate-800/60">
          {collapsed ? (
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <DropdownMenu open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center justify-center rounded-lg w-full group relative overflow-hidden",
                          "py-2.5 xl:py-3",
                          reducedMotion ? "" : "transition-all duration-200",
                          "hover:bg-white/10 dark:hover:bg-slate-800/60",
                          !reducedMotion && "hover:scale-105"
                        )}
                        aria-label="User profile menu"
                      >
                        <div className="flex items-center justify-center w-8 h-8 xl:w-10 xl:h-10 rounded-full bg-slate-700 dark:bg-slate-600 flex-shrink-0 overflow-hidden">
                          {profileImage ? (
                            <img 
                              src={profileImage} 
                              alt={currentUser?.displayName || currentUser?.username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm xl:text-base font-bold text-white">
                              {currentUser?.displayName?.[0]?.toUpperCase() || currentUser?.username?.[0]?.toUpperCase() || 'U'}
                            </span>
                          )}
                        </div>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="end" 
                      className="w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                      sideOffset={8}
                    >
                      {/* Profile Header Section */}
                      <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-700 dark:bg-slate-600 flex-shrink-0 overflow-hidden">
                            {profileImage ? (
                              <img 
                                src={profileImage} 
                                alt={currentUser?.displayName || currentUser?.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-bold text-white">
                                {currentUser?.displayName?.[0]?.toUpperCase() || currentUser?.username?.[0]?.toUpperCase() || 'U'}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {currentUser?.displayName || currentUser?.username}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {currentUser?.role === 'admin' ? 'Main Admin' : 
                                 currentUser?.role === 'logistics-admin' ? 'Logistics Admin' : 
                                 currentUser?.role?.charAt(0).toUpperCase() + currentUser?.role?.slice(1)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="py-1">
                        <DropdownMenuItem 
                          onClick={() => {
                            setShowSettingsModal(true)
                            setProfileMenuOpen(false)
                          }}
                          className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                        >
                          <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                          <span>Settings</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem 
                          onClick={() => {
                            setShowAboutModal(true)
                            setProfileMenuOpen(false)
                          }}
                          className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                        >
                          <AlertTriangle className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                          <span>About</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem 
                          onClick={() => {
                            setShowPreferenceModal(true)
                            setProfileMenuOpen(false)
                          }}
                          className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                        >
                          <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                          <span>Preferences</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="my-1 bg-slate-200 dark:bg-slate-800" />

                        <DropdownMenuItem 
                          onClick={() => {
                            setShowLogoutConfirm(true)
                            setProfileMenuOpen(false)
                          }}
                          className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sign Out</span>
                        </DropdownMenuItem>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TooltipTrigger>
                <TooltipContent 
                  side="right" 
                  className={cn(
                    "font-medium shadow-xl border-slate-200 dark:border-slate-700",
                    "bg-white/95 dark:bg-black/95 backdrop-blur-sm"
                  )}
                  sideOffset={12}
                >
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {currentUser?.displayName || currentUser?.username}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {currentUser?.role === 'admin' ? 'Main Admin' : 
                     currentUser?.role === 'logistics-admin' ? 'Logistics Admin' : 
                     currentUser?.role?.charAt(0).toUpperCase() + currentUser?.role?.slice(1)}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Click to open menu</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <DropdownMenu open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2 xl:gap-3 px-2 xl:px-3 py-2 xl:py-2.5 rounded-lg w-full",
                    reducedMotion ? "" : "transition-all duration-200",
                    "hover:bg-white/10 dark:hover:bg-slate-800/60",
                    "group"
                  )}
                  aria-label="User profile menu"
                >
                  <div className="flex items-center justify-center w-8 h-8 xl:w-10 xl:h-10 rounded-full bg-slate-700 dark:bg-slate-600 flex-shrink-0 overflow-hidden">
                    {profileImage ? (
                      <img 
                        src={profileImage} 
                        alt={currentUser?.displayName || currentUser?.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm xl:text-base font-bold text-white">
                        {currentUser?.displayName?.[0]?.toUpperCase() || currentUser?.username?.[0]?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[8px] xl:text-[9px] font-semibold text-white truncate">
                      Welcome back,
                    </p>
                    <p className="text-xs xl:text-sm font-bold text-white/90 truncate">
                      {currentUser?.displayName || currentUser?.username}
                    </p>
                  </div>
                  <LogOut
                    className="h-3.5 w-3.5 xl:h-4 xl:w-4 flex-shrink-0 text-white/60 group-hover:text-white transition-colors"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                sideOffset={8}
              >
                {/* Profile Header Section */}
                <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-700 dark:bg-slate-600 flex-shrink-0 overflow-hidden">
                      {profileImage ? (
                        <img 
                          src={profileImage} 
                          alt={currentUser?.displayName || currentUser?.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold text-white">
                          {currentUser?.displayName?.[0]?.toUpperCase() || currentUser?.username?.[0]?.toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {currentUser?.displayName || currentUser?.username}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {currentUser?.role === 'admin' ? 'Main Admin' : 
                           currentUser?.role === 'logistics-admin' ? 'Logistics Admin' : 
                           currentUser?.role?.charAt(0).toUpperCase() + currentUser?.role?.slice(1)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <DropdownMenuItem 
                    onClick={() => {
                      setShowSettingsModal(true)
                      setProfileMenuOpen(false)
                    }}
                    className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                  >
                    <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    <span>Settings</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem 
                    onClick={() => {
                      setShowAboutModal(true)
                      setProfileMenuOpen(false)
                    }}
                    className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                  >
                    <AlertTriangle className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    <span>About</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem 
                    onClick={() => {
                      setShowPreferenceModal(true)
                      setProfileMenuOpen(false)
                    }}
                    className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                  >
                    <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    <span>Preferences</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="my-1 bg-slate-200 dark:bg-slate-800" />

                  <DropdownMenuItem 
                    onClick={() => {
                      setShowLogoutConfirm(true)
                      setProfileMenuOpen(false)
                    }}
                    className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>

      {/* Settings Modal */}
      {showSettingsModal && (
        <>
          <div 
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSettingsModal(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="border-b border-slate-200 dark:border-slate-800 p-6 sticky top-0 bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Settings
                  </h2>
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    aria-label="Close modal"
                  >
                    <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Account Settings */}
                <section>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Account Settings</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <label className="text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">Display Name</span>
                        <input type="text" defaultValue={currentUser?.displayName} className="w-full mt-1 px-3 py-2 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                      </label>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <label className="text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">Email</span>
                        <input type="email" placeholder="user@example.com" className="w-full mt-1 px-3 py-2 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                      </label>
                    </div>
                    <button className="w-full px-4 py-2 text-sm font-medium text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 rounded-lg transition-colors">
                      Change Password
                    </button>
                  </div>
                </section>

                {/* Security & Access */}
                <section className="border-t border-slate-200 dark:border-slate-800 pt-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Security & Access</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-3">
                      <span className="text-lg">🔐</span>
                      <div>
                        <p className="font-medium text-blue-900 dark:text-blue-400">Two-Factor Authentication</p>
                        <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">Enhance your account security</p>
                        <button className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">Enable 2FA</button>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <label className="text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">Active Sessions</span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">View and manage all active login sessions</p>
                      </label>
                      <button className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">View Sessions</button>
                    </div>
                  </div>
                </section>

                {/* API & Integrations */}
                <section className="border-t border-slate-200 dark:border-slate-800 pt-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">API & Integrations</h3>
                  <div className="space-y-3">
                    <button className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2">
                      <span>🔑</span> Generate API Key
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2">
                      <span>🔗</span> Manage Integrations
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2">
                      <span>📚</span> API Documentation
                    </button>
                  </div>
                </section>

                {/* Audit Log */}
                <section className="border-t border-slate-200 dark:border-slate-800 pt-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Audit & Compliance</h3>
                  <div className="space-y-3">
                    <button className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2">
                      <span>📋</span> View Activity Log
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2">
                      <span>📊</span> Export Audit Trail
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2">
                      <span>📅</span> Compliance Reports
                    </button>
                  </div>
                </section>

                {/* Danger Zone */}
                <section className="border-t border-slate-200 dark:border-slate-800 pt-6">
                  <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">Danger Zone</h3>
                  <div className="space-y-2">
                    <button className="w-full px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                      Delete Account
                    </button>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                  </div>
                </section>

                {/* Save Button */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="px-4 py-2 text-sm font-medium text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <>
          <div 
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAboutModal(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="border-b border-slate-200 dark:border-slate-800 p-6 sticky top-0 bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700">
                      <img 
                        src="/WIHILOGO.png" 
                        alt="WIHI Asia" 
                        className="h-10 w-auto object-contain dark:hidden"
                      />
                      <img 
                        src="/WIHILOGO.png" 
                        alt="WIHI Asia" 
                        className="h-10 w-auto object-contain hidden dark:block"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                        About VERTEX
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Inventory Management System
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAboutModal(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
                    aria-label="Close modal"
                  >
                    <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* System Information */}
                <section>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">System Information</h3>
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Application</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">VERTEX Inventory Management System</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Version</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">1.0.0</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Build Date</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">July 2026</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Organization</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">WIHI Asia</p>
                    </div>
                  </div>
                </section>

                {/* System Overview */}
                <section>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">System Overview</h3>
                  <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold mt-0.5">•</span>
                      <span>Real-time inventory tracking across multiple sales channels</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold mt-0.5">•</span>
                      <span>Integrated sales channel management (Shopee, Lazada, etc.)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold mt-0.5">•</span>
                      <span>Multi-role access control (Admin, Operations, Department Managers)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold mt-0.5">•</span>
                      <span>Comprehensive order tracking and fulfillment management</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold mt-0.5">•</span>
                      <span>Advanced analytics and business insights dashboard</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold mt-0.5">•</span>
                      <span>Activity logging and audit trail for compliance</span>
                    </li>
                  </ul>
                </section>

                {/* Technology Stack */}
                <section>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Technology Stack</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <p className="font-medium text-blue-900 dark:text-blue-400">Frontend</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Next.js 14, React, Tailwind CSS</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                      <p className="font-medium text-green-900 dark:text-green-400">Backend</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Supabase, PostgreSQL</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                      <p className="font-medium text-purple-900 dark:text-purple-400">Infrastructure</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Cloud-based, Real-time Sync</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                      <p className="font-medium text-orange-900 dark:text-orange-400">Security</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">End-to-end Encryption, HTTPS</p>
                    </div>
                  </div>
                </section>

                {/* Copyright */}
                <div className="text-center pt-4 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    © 2026 WIHI Asia. All rights reserved.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Contact Support Modal */}
      {showContactModal && (
        <>
          <div 
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowContactModal(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full">
              <div className="border-b border-slate-200 dark:border-slate-800 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Contact Support
                  </h2>
                  <button
                    onClick={() => setShowContactModal(false)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    aria-label="Close modal"
                  >
                    <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Support Team */}
                <section>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 text-center">Support Team</h3>
                  
                  {/* Primary Contact */}
                  <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg border border-amber-200 dark:border-amber-800/50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500">
                          <span className="text-sm font-bold text-white">K</span>
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">Marjake Rivera</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Support Manager</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <a href="tel:+639057474686" className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                        <span>📱</span> +63 905 747 4686
                      </a>
                      <a href="mailto:aizenjhakerivera06@gmail.com" className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                        <span>📧</span> aizenjhakerivera06@gmail.com
                      </a>
                    </div>
                  </div>
                </section>

                {/* Support Channels */}
                <section>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Quick Contact</h3>
                  <div className="space-y-2">
                    <a href="tel:+639057474686" className="block w-full px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-center font-medium">
                      📱 Call Now
                    </a>
                    <a href="mailto:aizenjhakerivera06@gmail.com" className="block w-full px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-center font-medium">
                      📧 Send Email
                    </a>
                  </div>
                </section>

                {/* Support Hours */}
                <section className="border-t border-slate-200 dark:border-slate-800 pt-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Support Hours</h3>
                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>Monday - Friday</span>
                      <span className="font-medium text-slate-900 dark:text-white">9:00 AM - 6:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Saturday</span>
                      <span className="font-medium text-slate-900 dark:text-white">10:00 AM - 2:00 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sunday</span>
                      <span className="font-medium text-red-600">Closed</span>
                    </div>
                  </div>
                </section>

                {/* Response Time */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3">
                  <p className="text-xs text-blue-900 dark:text-blue-400">
                    <span className="font-semibold">⏱️ Average Response Time:</span> Within 2-4 hours during business hours
                  </p>
                </div>

                <button
                  onClick={() => setShowContactModal(false)}
                  className="w-full px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Preferences Modal */}
      {showPreferenceModal && (
        <>
          <div 
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPreferenceModal(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="border-b border-slate-200 dark:border-slate-800 p-6 sticky top-0 bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Preferences
                  </h2>
                  <button
                    onClick={() => setShowPreferenceModal(false)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    aria-label="Close modal"
                  >
                    <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Display Preferences */}
                <section>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Display</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <label className="text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">Theme</span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Choose your preferred color scheme</p>
                      </label>
                      <select defaultValue="auto" className="px-3 py-2 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        <option value="auto">Auto</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <label className="text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">Sidebar Collapse</span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Auto-collapse sidebar on small screens</p>
                      </label>
                      <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-slate-300 text-amber-500" />
                    </div>
                  </div>
                </section>

                {/* Notification Preferences */}
                <section className="border-t border-slate-200 dark:border-slate-800 pt-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Notifications</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <label className="text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">Email Notifications</span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Receive updates via email</p>
                      </label>
                      <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-slate-300 text-amber-500" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <label className="text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">In-App Notifications</span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Show notifications within the app</p>
                      </label>
                      <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-slate-300 text-amber-500" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <label className="text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">Low Stock Alerts</span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Notify when items run low</p>
                      </label>
                      <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-slate-300 text-amber-500" />
                    </div>
                  </div>
                </section>

                {/* Language & Region */}
                <section className="border-t border-slate-200 dark:border-slate-800 pt-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Language & Region</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <label className="text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">Language</span>
                        <select defaultValue="en" className="w-full mt-2 px-3 py-2 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                          <option value="en">English</option>
                          <option value="tl">Filipino (Tagalog)</option>
                          <option value="es">Spanish</option>
                          <option value="zh">Chinese</option>
                        </select>
                      </label>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <label className="text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">Timezone</span>
                        <select defaultValue="pht" className="w-full mt-2 px-3 py-2 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                          <option value="pht">Philippine Time (PHT)</option>
                          <option value="utc">Coordinated Universal Time (UTC)</option>
                          <option value="est">Eastern Standard Time (EST)</option>
                          <option value="pst">Pacific Standard Time (PST)</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </section>

                {/* Privacy & Data */}
                <section className="border-t border-slate-200 dark:border-slate-800 pt-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Privacy & Data</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <label className="text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">Analytics</span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Help us improve by sharing usage data</p>
                      </label>
                      <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-amber-500" />
                    </div>
                    <button className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2">
                      <span>🗑️</span> Clear Cache
                    </button>
                  </div>
                </section>

                {/* Save Button */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setShowPreferenceModal(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => setShowPreferenceModal(false)}
                    className="px-4 py-2 text-sm font-medium text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Professional Logout Confirmation Modal */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
          <AlertDialogHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                <LogOut className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <AlertDialogTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                  Sign Out
                </AlertDialogTitle>
                {currentUser && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {currentUser.displayName || currentUser.username} • {currentUser.role === 'admin' ? 'Main Admin' : currentUser.role === 'logistics' ? 'Logistics Admin' : currentUser.role === 'operations' ? 'Department User' : currentUser.role?.charAt(0).toUpperCase() + currentUser.role?.slice(1)}
                  </p>
                )}
              </div>
            </div>
          </AlertDialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              You are about to sign out of your account. Any unsaved work will be lost.
            </p>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="mt-0 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
              Stay Signed In
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLogout}
              className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900"
            >
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
