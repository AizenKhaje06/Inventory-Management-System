"use client"

import React, { useState, useRef, useEffect } from "react"
import { usePathname } from "next/navigation"
import { User, RefreshCw, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/hooks/use-accessibility"
import { getCurrentUser } from "@/lib/auth"
import { ToggleTheme } from "@/components/ui/toggle-theme"
import { NotificationSystem } from "@/components/notification-system"
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

interface DispatcherNavbarProps {
  /** Show navigation links (for dispatcher role) */
  showNavigation?: boolean
  /** Show action buttons (notification, refresh, theme, profile) */
  showActions?: boolean
  /** Role display name */
  roleLabel?: string
}

export function DispatcherNavbar({ 
  showNavigation = true, 
  showActions = true,
  roleLabel = "Dispatcher" 
}: DispatcherNavbarProps) {
  const pathname = usePathname()
  const [username, setUsername] = useState("Dispatcher")
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const reducedMotion = useReducedMotion()
  const [currentTime, setCurrentTime] = useState('')
  const [currentDate, setCurrentDate] = useState('')
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  // Get user info from localStorage
  useEffect(() => {
    const loadUserData = () => {
      if (typeof window !== 'undefined') {
        try {
          const storedUsername = localStorage.getItem("username")
          const displayName = localStorage.getItem("displayName")
          const storedProfileImage = localStorage.getItem("profileImage")
          
          if (storedUsername) {
            setUsername(displayName || storedUsername)
          }
          if (storedProfileImage && storedProfileImage !== 'null' && storedProfileImage !== 'undefined') {
            setProfileImage(storedProfileImage)
          } else {
            setProfileImage(null)
          }
        } catch (error) {
          console.error('Error reading from localStorage:', error)
        }
      }
    }

    loadUserData()

    // Listen for storage events
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'displayName' || e.key === 'profileImage' || e.key === 'currentUser') {
        loadUserData()
      }
    }

    const handleProfileUpdate = () => {
      loadUserData()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('profileUpdated', handleProfileUpdate)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('profileUpdated', handleProfileUpdate)
    }
  }, [])

  // Update time and date every second
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      const timeString = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
      const dateString = now.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      })
      setCurrentTime(timeString)
      setCurrentDate(dateString)
    }
    
    updateDateTime()
    const interval = setInterval(updateDateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = async () => {
    try {
      const user = getCurrentUser()
      
      // Unregister service worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const registration of registrations) {
          await registration.unregister()
        }
      }
      
      // Clear caches
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName)
        }
      }
      
      // Clear localStorage
      const { clearCurrentUser } = await import('@/lib/auth')
      clearCurrentUser()
      
      if (typeof window !== 'undefined' && localStorage) {
        const keys = Object.keys(localStorage)
        keys.forEach(key => {
          try {
            localStorage.removeItem(key)
          } catch (e) {
            console.error('Error removing key:', key, e)
          }
        })
        localStorage.clear()
      }
      
      // Clear sessionStorage
      if (typeof window !== 'undefined' && sessionStorage) {
        sessionStorage.clear()
      }
      
      // Redirect
      const timestamp = Date.now()
      window.location.replace(`/?logout=${timestamp}`)
      
    } catch (error) {
      console.error('Logout error:', error)
      window.location.replace('/?logout=error')
    }
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Skip to main content
      </a>

      <header
        className={cn(
          "fixed z-40",
          reducedMotion ? "" : "transition-all duration-300",
          "left-0 right-0 top-0 h-16",
          "bg-white dark:bg-black border-b border-slate-200 dark:border-amber-500/10",
          "dark:shadow-[0_1px_0_0_rgba(245,158,11,0.08)]"
        )}
        role="banner"
      >
        <div className="h-full px-3 sm:px-6 flex items-center justify-between">
          {/* Left: Logo + Navigation Links */}
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0">
              <img 
                src="/WIHILOGO.png" 
                alt="WIHI Asia" 
                className="h-10 w-auto max-w-none object-contain dark:hidden" 
              />
              <img 
                src="/WIHILOGO.png" 
                alt="WIHI Asia" 
                className="h-10 w-auto max-w-none object-contain hidden dark:block" 
              />
            </div>

            {/* Divider */}
            {showNavigation && (
              <div className="h-8 w-px bg-slate-200 dark:bg-amber-900/30"></div>
            )}

            {/* Navigation Links (only for Dispatcher) */}
            {showNavigation && (
              <nav className="flex items-center gap-1 h-full" role="navigation" aria-label="Navigation">
                <a 
                  href="/dashboard/inventory" 
                  className={cn(
                    "relative px-4 h-full flex items-center text-sm font-medium transition-colors",
                    pathname === '/dashboard/inventory'
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <span>Products</span>
                  {/* Active underline */}
                  {pathname === '/dashboard/inventory' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 dark:bg-amber-400" />
                  )}
                </a>
                <span className="text-slate-300 dark:text-slate-700 self-center">|</span>
                <a 
                  href="/dashboard/pos" 
                  className={cn(
                    "relative px-4 h-full flex items-center text-sm font-medium transition-colors",
                    pathname === '/dashboard/pos'
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <span>POS</span>
                  {/* Active underline */}
                  {pathname === '/dashboard/pos' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 dark:bg-amber-400" />
                  )}
                </a>
                <span className="text-slate-300 dark:text-slate-700 self-center">|</span>
                <a 
                  href="/dashboard/log" 
                  className={cn(
                    "relative px-4 h-full flex items-center text-sm font-medium transition-colors",
                    pathname === '/dashboard/log'
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <span>Activity Logs</span>
                  {/* Active underline */}
                  {pathname === '/dashboard/log' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 dark:bg-amber-400" />
                  )}
                </a>
              </nav>
            )}
          </div>

          {/* Right: Date/Time + Actions */}
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Date & Time Display */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-amber-500/15">
              <span className="text-xs text-slate-500 dark:text-amber-400/70 font-medium">
                {currentDate}
              </span>
              <span className="text-slate-300 dark:text-amber-900/50">•</span>
              <span className="text-sm text-slate-900 dark:text-amber-300 font-semibold font-mono tabular-nums">
                {currentTime}
              </span>
            </div>

            {/* Mobile Time Only */}
            <div className="md:hidden text-xs text-slate-600 dark:text-amber-400/80 font-mono tabular-nums font-semibold">
              {currentTime}
            </div>
            
            {/* Divider */}
            <div className="h-8 w-px bg-slate-200 dark:bg-amber-900/30"></div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => window.location.reload()}
                className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-600 dark:text-amber-400/70 hover:text-slate-900 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-amber-500/10 transition-all"
                aria-label="Refresh page"
                title="Refresh"
              >
                <RefreshCw className="h-[18px] w-[18px]" />
              </button>
              
              <ToggleTheme 
                duration={600}
                animationType="flip-x-in"
                className="h-9 w-9 text-slate-600 dark:text-amber-400/70 hover:text-slate-900 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-amber-500/10"
              />
              
              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowProfileDropdown(v => !v)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setShowProfileDropdown(false) }}
                  className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 rounded-full"
                  aria-label={`${username} — ${roleLabel}. Open user menu`}
                  aria-haspopup="true"
                  aria-expanded={showProfileDropdown}
                >
                  <div className="h-9 w-9 rounded-full overflow-hidden border-2 border-slate-300 dark:border-amber-900/50 hover:ring-4 hover:ring-blue-400 dark:hover:ring-amber-400 transition-all duration-150 cursor-pointer flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600">
                    {profileImage ? (
                      <img
                        src={`/api/image-proxy?url=${encodeURIComponent(profileImage)}`}
                        alt={username}
                        className="h-full w-full object-cover object-center"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <User className="h-5 w-5 text-white" strokeWidth={2.5} aria-hidden="true" />
                    )}
                  </div>
                </button>

                {showProfileDropdown && (
                  <div
                    role="menu"
                    aria-label="User menu"
                    className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800" role="presentation">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600 flex-shrink-0">
                          {profileImage ? (
                            <img
                              src={`/api/image-proxy?url=${encodeURIComponent(profileImage)}`}
                              alt={username}
                              className="h-full w-full object-cover object-center"
                              onError={(e) => { e.currentTarget.style.display = 'none' }}
                            />
                          ) : (
                            <User className="h-5 w-5 text-white" strokeWidth={2.5} aria-hidden="true" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {username}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {roleLabel}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sign out */}
                    <div className="p-2">
                      <button
                        role="menuitem"
                        onClick={() => { setShowProfileDropdown(false); setShowLogoutDialog(true) }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
      </header>

      {/* Logout confirmation dialog */}
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
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{roleLabel}</p>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogDescription className="py-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            You are about to sign out of your {roleLabel} account. Any unsaved work will be lost.
          </AlertDialogDescription>
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
    </>
  )
}
