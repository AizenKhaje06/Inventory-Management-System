"use client"

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { announceToScreenReader } from '@/lib/accessibility-utils'

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  action: () => void
  description: string
  category?: string
}

/**
 * Enterprise Keyboard Shortcuts Hook
 * Provides comprehensive keyboard navigation
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[] = []) {
  const router = useRouter()

  // Default enterprise shortcuts
  const defaultShortcuts: KeyboardShortcut[] = [
    {
      key: 'k',
      ctrl: true,
      description: 'Open command palette',
      category: 'Navigation',
      action: () => {
        // Trigger command palette
        const event = new CustomEvent('open-command-palette')
        window.dispatchEvent(event)
        announceToScreenReader('Command palette opened')
      }
    },
    {
      key: 'h',
      ctrl: true,
      description: 'Go to dashboard',
      category: 'Navigation',
      action: () => {
        router.push('/dashboard')
        announceToScreenReader('Navigating to dashboard')
      }
    },
    {
      key: 'i',
      ctrl: true,
      description: 'Go to inventory',
      category: 'Navigation',
      action: () => {
        router.push('/dashboard/inventory')
        announceToScreenReader('Navigating to inventory')
      }
    },
    {
      key: 'n',
      ctrl: true,
      shift: true,
      description: 'New product',
      category: 'Actions',
      action: () => {
        const event = new CustomEvent('open-add-product')
        window.dispatchEvent(event)
        announceToScreenReader('Opening add product dialog')
      }
    },
    {
      key: 's',
      ctrl: true,
      description: 'Go to sales',
      category: 'Navigation',
      action: () => {
        router.push('/dashboard/pos')
        announceToScreenReader('Navigating to sales')
      }
    },
    {
      key: '/',
      description: 'Focus search',
      category: 'Navigation',
      action: () => {
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
          announceToScreenReader('Search focused')
        }
      }
    },
    {
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      category: 'Help',
      action: () => {
        const event = new CustomEvent('show-shortcuts-modal')
        window.dispatchEvent(event)
        announceToScreenReader('Keyboard shortcuts help opened')
      }
    }
  ]

  const allShortcuts = [...defaultShortcuts, ...shortcuts]

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Allow "/" to focus search even from inputs
      if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        return
      }
      // Skip other shortcuts when in input fields
      if (event.key !== '/') {
        return
      }
    }

    allShortcuts.forEach((shortcut) => {
      const ctrlKey = event.ctrlKey || event.metaKey
      const isMatch =
        event.key.toLowerCase() === shortcut.key.toLowerCase() &&
        (!shortcut.ctrl || ctrlKey) &&
        (!shortcut.shift || event.shiftKey) &&
        (!shortcut.alt || event.altKey)

      if (isMatch) {
        event.preventDefault()
        event.stopPropagation()
        shortcut.action()
      }
    })
  }, [allShortcuts])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return {
    shortcuts: allShortcuts,
    registerShortcut: (shortcut: KeyboardShortcut) => {
      allShortcuts.push(shortcut)
    }
  }
}

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = []
  
  if (shortcut.ctrl) parts.push('Ctrl')
  if (shortcut.shift) parts.push('Shift')
  if (shortcut.alt) parts.push('Alt')
  if (shortcut.meta) parts.push('⌘')
  
  parts.push(shortcut.key.toUpperCase())
  
  return parts.join(' + ')
}
