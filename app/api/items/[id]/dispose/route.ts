import { type NextRequest, NextResponse } from "next/server"
import { updateInventoryItem, getInventoryItems, addLog } from "@/lib/supabase-db"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { amount, notes } = body

    console.log('[Dispose API] Request received:', { id, amount, notes })

    if (!amount || amount <= 0) {
      console.log('[Dispose API] Validation failed: Invalid amount')
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 })
    }

    console.log('[Dispose API] Fetching inventory items...')
    const items = await getInventoryItems()
    const item = items.find((i) => i.id === id)

    if (!item) {
      console.log('[Dispose API] Item not found:', id)
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    const currentBadQty = item.bad_item_quantity || 0

    console.log('[Dispose API] Item found:', { 
      id: item.id, 
      name: item.name, 
      currentGoodQty: item.quantity,
      currentBadQty 
    })

    // Check if there's enough bad stock to dispose
    if (currentBadQty < amount) {
      console.log('[Dispose API] Insufficient bad stock:', { available: currentBadQty, requested: amount })
      return NextResponse.json(
        { error: `Insufficient bad stock. Available: ${currentBadQty}, Requested: ${amount}` }, 
        { status: 400 }
      )
    }

    // Calculate new bad quantity (good quantity stays the same)
    const newBadQty = currentBadQty - amount

    // Update breakdown - reduce proportionally from all reasons
    const breakdown = (item.bad_items_breakdown || {}) as Record<string, number>
    const updatedBreakdown: Record<string, number> = {}
    
    if (Object.keys(breakdown).length > 0) {
      let remaining = amount
      const totalBad = Object.values(breakdown).reduce((sum, qty) => sum + qty, 0)
      
      // Reduce proportionally from each reason
      for (const [reason, qty] of Object.entries(breakdown)) {
        const proportion = qty / totalBad
        const toReduce = Math.min(Math.round(proportion * amount), qty, remaining)
        const newQty = qty - toReduce
        
        if (newQty > 0) {
          updatedBreakdown[reason] = newQty
        }
        remaining -= toReduce
      }
    }

    // Determine new status
    const newStatus = newBadQty === 0 ? 'good' : 'bad'

    console.log('[Dispose API] Updating inventory:', { 
      goodQty: item.quantity,
      oldBadQty: currentBadQty,
      newBadQty,
      newStatus,
      updatedBreakdown
    })

    await updateInventoryItem(id, {
      bad_item_quantity: newBadQty,
      bad_items_breakdown: updatedBreakdown,
      item_status: newStatus,
      bad_item_reason: newBadQty === 0 ? null : item.bad_item_reason
    })

    console.log('[Dispose API] Inventory updated successfully')
    
    // Get username from headers for staff tracking
    const username = request.headers.get('x-user-username') || 'Unknown'
    const displayName = request.headers.get('x-user-display-name') || username
    
    console.log('[Dispose API] Adding log entry...', { staffName: displayName })
    
    // Get current timestamp
    const timestamp = new Date().toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
    
    await addLog({
      operation: "dispose",
      itemId: id,
      itemName: item.name,
      details: `Disposed ${amount} units of bad stock${notes ? ` - ${notes}` : ''} | Dispatcher: ${displayName} | ${timestamp}`,
    })

    console.log('[Dispose API] Operation completed successfully')
    return NextResponse.json({ 
      success: true, 
      item: { 
        ...item, 
        bad_item_quantity: newBadQty,
        item_status: newStatus
      } 
    })
  } catch (error) {
    console.error("[Dispose API] Error disposing stock:", error)
    return NextResponse.json({ error: "Failed to dispose stock" }, { status: 500 })
  }
}
