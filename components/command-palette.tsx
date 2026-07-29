"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  Plus,
  FileText,
  TrendingUp,
  Brain,
  AlertTriangle,
  XCircle,
} from "lucide-react"

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    // Listen for custom event
    const handleOpen = () => setOpen(true)
    window.addEventListener('open-command-palette', handleOpen)

    document.addEventListener("keydown", down)
    return () => {
      document.removeEventListener("keydown", down)
      window.removeEventListener('open-command-palette', handleOpen)
    }
  }, [])

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Quick Actions">
          <CommandItem
            onSelect={() => runCommand(() => router.push('/dashboard/inventory/create'))}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>Add New Product</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/dashboard/pos'))}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            <span>New Sale</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => runCommand(() => router.push('/dashboard'))}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>D
            </kbd>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/dashboard/inventory'))}
          >
            <Package className="mr-2 h-4 w-4" />
            <span>Inventory</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>I
            </kbd>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/dashboard/pos'))}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            <span>Point of Sale</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>P
            </kbd>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Inventory">
          <CommandItem
            onSelect={() => runCommand(() => router.push('/dashboard/inventory/low-stock'))}
          >
            <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" />
            <span>Low Stock Items</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/dashboard/inventory/out-of-stock'))}
          >
            <XCircle className="mr-2 h-4 w-4 text-red-600" />
            <span>Out of Stock Items</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          <CommandItem
            onSelect={() => runCommand(() => router.push('/dashboard/settings'))}
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push('/dashboard/log'))}
          >
            <FileText className="mr-2 h-4 w-4" />
            <span>Activity Logs</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
