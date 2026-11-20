import { type NextRequest, NextResponse } from "next/server"
import { updateInventoryItem, getInventoryItems, addLog } from "@/lib/supabase-db"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { amount, reason, notes } = body

    console.log('[Restore API] Request received:', { id, amount, reason, notes })

    if (!amount || amount <= 0) {
      console.log('[Restore API] Validation failed: Invalid amount')
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 })
    }

    console.log('[Restore API] Fetching inventory items...')
    const items = await getInventoryItems()
    const item = items.find((i) => i.id === id)

    if (!item) {
      console.log('[Restore API] Item not found:', id)
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    const currentBadQty = item.bad_item_quantity || 0
    const breakdown = (item.bad_items_breakdown || {}) as Record<string, number>

    console.log('[Restore API] Item found:', { 
      id: item.id, 
      name: item.name, 
      currentGoodQty: item.quantity,
      currentBadQty,
      breakdown
    })

    // Check if there's enough bad stock to restore
    if (currentBadQty < amount) {
      console.log('[Restore API] Insufficient bad stock:', { available: currentBadQty, requested: amount })
      return NextResponse.json(
        { error: `Insufficient bad stock. Available: ${currentBadQty}, Requested: ${amount}` }, 
        { status: 400 }
      )
    }

    // If reason is specified, validate and update breakdown
    let updatedBreakdown: Record<string, number> = { ...breakdown }
    
    if (reason && Object.keys(breakdown).length > 0) {
      // Check if reason exists in breakdown
      if (!breakdown[reason]) {
        console.log('[Restore API] Invalid reason:', reason)
        return NextResponse.json(
          { error: `Invalid reason: ${reason}` }, 
          { status: 400 }
        )
      }

      // Check if enough quantity for this reason
      if (breakdown[reason] < amount) {
        console.log('[Restore API] Insufficient quantity for reason:', { reason, available: breakdown[reason], requested: amount })
        return NextResponse.json(
          { error: `Insufficient quantity for "${reason}". Available: ${breakdown[reason]}, Requested: ${amount}` }, 
          { status: 400 }
        )
      }

      // Update breakdown - subtract from specific reason
      const newQty = breakdown[reason] - amount
      if (newQty > 0) {
        updatedBreakdown[reason] = newQty
      } else {
        delete updatedBreakdown[reason]
      }
    } else if (Object.keys(breakdown).length > 0) {
      // No specific reason selected but breakdown exists - reduce proportionally
      let remaining = amount
      updatedBreakdown = {}
      
      for (const [reasonKey, qty] of Object.entries(breakdown)) {
        if (remaining <= 0) {
          updatedBreakdown[reasonKey] = qty
          continue
        }
        
        const toReduce = Math.min(qty, remaining)
        const newQty = qty - toReduce
        
        if (newQty > 0) {
          updatedBreakdown[reasonKey] = newQty
        }
        remaining -= toReduce
      }
    }

    // Calculate new quantities
    const newGoodQty = item.quantity + amount
    const newBadQty = currentBadQty - amount

    // Determine new status
    const newStatus = newBadQty === 0 ? 'good' : 'bad'

    console.log('[Restore API] Updating inventory:', { 
      oldGoodQty: item.quantity, 
      newGoodQty,
      oldBadQty: currentBadQty,
      newBadQty,
      newStatus,
      oldBreakdown: breakdown,
      updatedBreakdown
    })

    await updateInventoryItem(id, {
      quantity: newGoodQty,
      bad_item_quantity: newBadQty,
      bad_items_breakdown: updatedBreakdown,
      item_status: newStatus,
      bad_item_reason: newBadQty === 0 ? null : item.bad_item_reason
    })

    console.log('[Restore API] Inventory updated successfully')
    
    // Get username from headers for staff tracking
    const username = request.headers.get('x-user-username') || 'Unknown'
    const displayName = request.headers.get('x-user-display-name') || username
    
    console.log('[Restore API] Adding log entry...', { staffName: displayName })
    
    // Get current timestamp
    const timestamp = new Date().toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
    
    const reasonText = reason ? ` from "${reason.replace(/_/g, ' ')}"` : ''
    await addLog({
      operation: "restore",
      itemId: id,
      itemName: item.name,
      details: `Restored ${amount} units${reasonText} from bad to good stock${notes ? ` - ${notes}` : ''} | Dispatcher: ${displayName} | ${timestamp}`,
    })

    console.log('[Restore API] Operation completed successfully')
    return NextResponse.json({ 
      success: true, 
      item: { 
        ...item, 
        quantity: newGoodQty,
        bad_item_quantity: newBadQty,
        bad_items_breakdown: updatedBreakdown,
        item_status: newStatus
      } 
    })
  } catch (error) {
    console.error("[Restore API] Error restoring stock:", error)
    return NextResponse.json({ error: "Failed to restore stock" }, { status: 500 })
  }
}
