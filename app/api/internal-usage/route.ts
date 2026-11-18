import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin as supabase } from "@/lib/supabase"
import { getInventoryItems, updateInventoryItem, addLog } from "@/lib/supabase-db"
import { withAuth } from "@/lib/api-helpers"

// ─── GET: Fetch all internal usage records ───────────────────────────────────
export const GET = withAuth(async (request, { user }) => {
  try {
    const { data, error } = await supabase
      .from('internal_usage')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Internal Usage GET] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('[Internal Usage GET] Exception:', error)
    return NextResponse.json({ error: 'Failed to fetch internal usage records' }, { status: 500 })
  }
})

// ─── POST: Record new internal usage ─────────────────────────────────────────
export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json()
    const { department, usageType, reason, notes, items, processedBy } = body

    // Validate required fields
    if (!department)          return NextResponse.json({ error: 'Department is required' }, { status: 400 })
    if (!usageType)           return NextResponse.json({ error: 'Usage type is required' }, { status: 400 })
    if (!reason?.trim())      return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
    if (!items?.length)       return NextResponse.json({ error: 'Items are required' }, { status: 400 })

    // Get current inventory to validate stock
    const allItems = await getInventoryItems()

    // Check stock availability for all items first
    for (const reqItem of items) {
      const inventoryItem = allItems.find(i => i.id === reqItem.itemId)
      if (!inventoryItem) {
        return NextResponse.json({ error: `Item ${reqItem.itemId} not found` }, { status: 404 })
      }
      if (inventoryItem.quantity < reqItem.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for "${inventoryItem.name}". Available: ${inventoryItem.quantity}, Requested: ${reqItem.quantity}` },
          { status: 400 }
        )
      }
    }

    // Calculate totals
    const totalCost = items.reduce((sum: number, item: any) => sum + (item.costPrice * item.quantity), 0)
    const totalQty  = items.reduce((sum: number, item: any) => sum + item.quantity, 0)

    // Build JSONB items array
    const itemsData = items.map((item: any) => ({
      itemId:    item.itemId,
      itemName:  item.itemName,
      quantity:  item.quantity,
      costPrice: item.costPrice,
      totalCost: item.costPrice * item.quantity,
      imageUrl:  item.imageUrl || null
    }))

    // Generate ID
    const id = `IU-${Date.now()}`

    // Save to internal_usage table
    const { error: insertError } = await supabase
      .from('internal_usage')
      .insert({
        id,
        department,
        usage_type:  usageType,
        reason:      reason.trim(),
        notes:       notes?.trim() || null,
        items:       itemsData,
        total_cost:  totalCost,
        total_qty:   totalQty,
        recorded_by: processedBy || user?.username || user?.displayName || 'Unknown',
        created_at:  new Date().toISOString()
      })

    if (insertError) {
      console.error('[Internal Usage POST] Insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Deduct stock from inventory and create log for each item
    for (const reqItem of items) {
      const inventoryItem = allItems.find(i => i.id === reqItem.itemId)
      if (inventoryItem) {
        const newQty = inventoryItem.quantity - reqItem.quantity
        await updateInventoryItem(reqItem.itemId, { quantity: newQty })

        // Log the operation
        const typeLabel = usageType === 'demo' ? 'Demo/Display' : usageType === 'internal' ? 'Internal Use' : 'Transfer'
        await addLog({
          operation: usageType === 'transfer' ? 'transfer' : usageType === 'demo' ? 'demo' : 'internal',
          itemId:    reqItem.itemId,
          itemName:  reqItem.itemName,
          quantity:  reqItem.quantity,
          details:   `${typeLabel} "${reqItem.itemName}" - Qty: ${reqItem.quantity}, Department: ${department}, Requested by: ${reason}, Processed by: ${processedBy || user?.displayName || 'Unknown'}`,
        })
      }
    }

    console.log(`[Internal Usage POST] ✅ Recorded: ${id}, items: ${totalQty}, cost: ${totalCost}`)
    return NextResponse.json({ success: true, id }, { status: 201 })

  } catch (error: any) {
    console.error('[Internal Usage POST] Exception:', error)
    return NextResponse.json({ error: error.message || 'Failed to record internal usage' }, { status: 500 })
  }
})
