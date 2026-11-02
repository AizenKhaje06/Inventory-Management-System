'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, RefreshCw, Menu, X } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { useSessionGuard } from '@/lib/use-session-guard'

export interface RoleNavItem {
  href: string
  label: string
}

interface RoleLayoutProps {
  children: React.ReactNode
  navItems: RoleNavItem[]
  /** Display name for the role, shown in logout dialog and dropdown badge */
  roleName: string
  /** Default initials fallback if no displayName stored */
  defaultInitials: string
  /** Default display name fallback */
  defaultDisplayName: string
  /** Content to show beneath the display name in the brand area (optional) */
  brandSubtitle?: string
  /** Extra content above the sign-out button in the profile dropdown */
  extraDropdownItems?: React.ReactNode
  /** Container padding variant — 'full' uses max-w-[1920px], 'compact' uses full-width */
  containerVariant?: 'full' | 'compact'
}

export function RoleLayout({
  children,
  navItems,
  roleName,
  defaultInitials,
  defaultDisplayName,
  brandSubtitle,
  extraDropdownItems,
  containerVariant = 'full',
}: RoleLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [currentTime, setCurrentTime] = useState('')
  const [currentDate, setCurrentDate] = useState('')
  const [displayName, setDisplayName] = useState(defaultDisplayName)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [initials, setInitials] = useState(defaultInitials)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useSessionGuard()

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))
      setCurrentDate(now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)

    const storedDisplayName = localStorage.getItem('displayName')
    if (storedDisplayName) {
      setDisplayName(storedDisplayName)
      setInitials(
        storedDisplayName
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      )
    }
    const storedProfileImage = localStorage.getItem('profileImage')
    // Validate URL before using — prevents XSS via javascript: protocol
    if (storedProfileImage && storedProfileImage.startsWith('https://')) {
      setProfileImage(storedProfileImage)
    }

    return () => clearInterval(interval)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProfileDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showProfileDropdown) {
        setShowProfileDropdown(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showProfileDropdown])

  const handleLogout = async () => {
    try {
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null
      if (username) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        })
      }
      ;['authToken', 'currentUser', 'isLoggedIn', 'username', 'userRole', 'displayName', 'sessionId', 'assignedChannel', 'profileImage'].forEach(
        k => localStorage.removeItem(k)
      )
      toast.success('Logged out successfully')
      router.push('/')
    } catch {
      localStorage.clear()
      toast.success('Logged out successfully')
      router.push('/')
    }
  }

  const innerClass = containerVariant === 'full'
    ? 'max-w-[1920px] mx-auto px-3 sm:px-6'
    : 'px-6'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Skip to main content — accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>

      <header
        className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800"
        role="banner"
      >
        <div className={innerClass}>
          <div className="flex items-center justify-between h-12 sm:h-14">

            {/* Left: Brand + Navigation */}
            <div className="flex items-center gap-3 sm:gap-8">
              <div className="flex items-center gap-2 sm:gap-3 pr-3 sm:pr-8 border-r border-slate-200 dark:border-slate-800">
                <img src="/WIHILOGO.png" alt="WIHI Asia" aria-hidden="true" className="h-8 w-auto object-contain dark:hidden" />
                <img src="/WIHILOGO.png" alt="WIHI Asia" aria-hidden="true" className="h-8 w-auto object-contain hidden dark:block" />
                {/* Hide name on mobile - show only on sm and up */}
                <div className="hidden sm:flex flex-col">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none">
                    {brandSubtitle || 'Welcome back'}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                    {displayName}
                  </span>
                </div>
              </div>

              {/* Desktop Navigation - Hidden on mobile */}
              <nav aria-label="Main navigation" className="hidden md:flex items-center h-12 sm:h-14">
                {navItems.map(item => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'h-full flex items-center px-2 sm:px-4 text-xs sm:text-sm font-medium transition-colors relative border-b-2 whitespace-nowrap',
                        isActive
                          ? 'text-slate-900 dark:text-white border-slate-900 dark:border-white'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-transparent'
                      )}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>

              {/* Mobile Hamburger Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMobileMenu(true)}
                aria-label="Open navigation menu"
                className="md:hidden h-9 w-9 p-0 text-slate-600 dark:text-slate-400"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>

            {/* Right: Clock + Actions */}
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Date & time */}
              <div
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                aria-label={`Current date and time: ${currentDate}, ${currentTime}`}
              >
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{currentDate}</span>
                <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">•</span>
                <span className="text-sm text-slate-900 dark:text-white font-semibold font-mono tabular-nums">{currentTime}</span>
              </div>
              <div className="md:hidden text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums font-semibold">
                {currentTime}
              </div>

              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />

              <div className="flex items-center gap-2">
                {/* Refresh */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.reload()}
                  aria-label="Refresh page"
                  title="Refresh"
                  className="h-9 w-9 p-0 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <RefreshCw className="h-[18px] w-[18px]" aria-hidden="true" />
                </Button>

                <ThemeToggle />

                {/* Profile Dropdown */}
                <div className="relative ml-1" ref={dropdownRef}>
                  <button
                    onClick={() => setShowProfileDropdown(v => !v)}
                    aria-label={`${displayName} — ${roleName}. Open user menu`}
                    aria-haspopup="true"
                    aria-expanded={showProfileDropdown}
                    className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-full"
                  >
                    <div className="h-9 w-9 rounded-full overflow-hidden bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0 ring-2 ring-slate-200 dark:ring-slate-700 hover:ring-4 hover:ring-blue-400 dark:hover:ring-blue-500 transition-all duration-150 cursor-pointer">
                      {profileImage
                        ? <img src={profileImage} alt={displayName} className="w-full h-full object-cover object-center" />
                        : <span className="text-xs font-bold text-blue-700 dark:text-blue-300" aria-hidden="true">{initials}</span>
                      }
                    </div>
                  </button>

                  {/* Dropdown menu */}
                  {showProfileDropdown && (
                    <div
                      role="menu"
                      aria-label="User menu"
                      className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                      {/* User info header */}
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full overflow-hidden bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0 ring-2 ring-slate-200 dark:ring-slate-700">
                            {profileImage
                              ? <img src={profileImage} alt="" aria-hidden="true" className="w-full h-full object-cover object-center" />
                              : <span className="text-xs font-bold text-blue-700 dark:text-blue-300" aria-hidden="true">{initials}</span>
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{displayName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" aria-hidden="true" />
                              {roleName}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Extra items slot */}
                      {extraDropdownItems && (
                        <div className="p-1.5 border-b border-slate-100 dark:border-slate-800">
                          {extraDropdownItems}
                        </div>
                      )}

                      {/* Sign out */}
                      <div className="p-1.5">
                        <button
                          role="menuitem"
                          onClick={() => { setShowProfileDropdown(false); setShowLogoutDialog(true) }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-inset"
                        >
                          <LogOut className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" className="w-full pt-12 sm:pt-14" tabIndex={-1}>
        {children}
      </main>

      {/* Logout confirmation */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
          <AlertDialogHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <LogOut className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <AlertDialogTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                  Sign Out
                </AlertDialogTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{roleName}</p>
              </div>
            </div>
          </AlertDialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              You are about to sign out of your {roleName} account. Any unsaved work will be lost.
            </p>
          </div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="mt-0 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
              Stay Signed In
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-[60] md:hidden"
            onClick={() => setShowMobileMenu(false)}
            aria-hidden="true"
          />
          
          {/* Slide-out Menu */}
          <div className="fixed top-0 left-0 bottom-0 w-[280px] bg-white dark:bg-slate-900 z-[70] md:hidden shadow-2xl">
            {/* Menu Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <img src="/WIHILOGO.png" alt="WIHI Asia" aria-hidden="true" className="h-8 w-auto object-contain dark:hidden" />
                <img src="/WIHILOGO.png" alt="WIHI Asia" aria-hidden="true" className="h-8 w-auto object-contain hidden dark:block" />
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{displayName}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMobileMenu(false)}
                aria-label="Close menu"
                className="h-8 w-8 p-0"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Menu Items */}
            <nav className="p-2">
              {navItems.map(item => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMobileMenu(false)}
                    className={cn(
                      'flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors mb-1',
                      isActive
                        ? 'bg-slate-900 dark:bg-slate-800 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </>
      )}
    </div>
  )
}
