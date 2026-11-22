import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin as supabase } from "@/lib/supabase"
import { getInventoryItems, updateInventoryItem, addLog } from "@/lib/supabase-db"
import { withAuth } from "@/lib/api-helpers"

// ─── POST: Return demo/display items ─────────────────────────────────────────
export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json()
    const { personName, items } = body // items = [{ itemId, itemName, returnQuantity }]

    // Validate required fields
    if (!personName?.trim()) {
      return NextResponse.json({ error: 'Person name is required' }, { status: 400 })
    }
    if (!items?.length) {
      return NextResponse.json({ error: 'Items to return are required' }, { status: 400 })
    }

    // Fetch all internal usage records for this person (demo/display only)
    const { data: records, error: fetchError } = await supabase
      .from('internal_usage')
      .select('*')
      .eq('usage_type', 'demo')
      .eq('reason', personName.trim())

    if (fetchError) {
      console.error('[Return Items] Fetch error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'No demo/display records found for this person' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const returnedBy = user?.username || user?.displayName || 'Unknown'

    // Get current inventory
    const allInventoryItems = await getInventoryItems()

    // Process returns for each item
    for (const returnItem of items) {
      const { itemId, itemName, returnQuantity } = returnItem

      if (returnQuantity <= 0) continue

      console.log(`[Return] Processing ${itemName} (${itemId}), quantity: ${returnQuantity}`)

      // Find all records that have this item and sort by creation date (oldest first)
      const recordsWithItem = records
        .filter(rec => rec.items?.some((i: any) => i.itemId === itemId))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

      console.log(`[Return] Found ${recordsWithItem.length} records with ${itemName}`)

      if (recordsWithItem.length === 0) continue

      let remainingToReturn = returnQuantity
      let totalReturnedForThisItem = 0 // Track total returned for inventory update

      // Update each record
      for (const record of recordsWithItem) {
        if (remainingToReturn <= 0) break

        const itemInRecord = record.items?.find((i: any) => i.itemId === itemId)
        if (!itemInRecord) continue

        const totalRequested = itemInRecord.quantity
        const returned_items = record.returned_items || {}
        const currentlyReturned = returned_items[itemId]?.returned || 0
        const canReturn = totalRequested - currentlyReturned

        console.log(`[Return] Record ${record.id}: requested=${totalRequested}, returned=${currentlyReturned}, canReturn=${canReturn}`)

        if (canReturn <= 0) continue

        const qtyToReturnFromRecord = Math.min(remainingToReturn, canReturn)
        remainingToReturn -= qtyToReturnFromRecord
        totalReturnedForThisItem += qtyToReturnFromRecord

        console.log(`[Return] Returning ${qtyToReturnFromRecord} from record ${record.id}, remaining=${remainingToReturn}`)

        // Update returned_items JSONB
        const newReturnedItems = {
          ...returned_items,
          [itemId]: {
            returned: currentlyReturned + qtyToReturnFromRecord,
            total: totalRequested
          }
        }

        // Calculate total returned vs total requested across all items in THIS record
        let totalReturnedQty = 0
        let totalRequestedQty = 0
        for (const item of record.items) {
          const itemIdInRecord = item.itemId
          const requested = item.quantity
          const returned = newReturnedItems[itemIdInRecord]?.returned || 0
          totalRequestedQty += requested
          totalReturnedQty += returned
        }

        // Determine return status for THIS record
        let returnStatus = 'pending'
        if (totalReturnedQty > 0 && totalReturnedQty < totalRequestedQty) {
          returnStatus = 'partial'
        } else if (totalReturnedQty >= totalRequestedQty) {
          returnStatus = 'completed'
        }

        console.log(`[Return] Record ${record.id} status: ${returnStatus} (${totalReturnedQty}/${totalRequestedQty})`)

        // Append to return_history
        const returnHistory = record.return_history || []
        returnHistory.push({
          date: now,
          itemId,
          itemName,
          quantity: qtyToReturnFromRecord,
          returnedBy
        })

        // Update the record
        const { error: updateError } = await supabase
          .from('internal_usage')
          .update({
            returned_items: newReturnedItems,
            return_status: returnStatus,
            last_return_date: now,
            return_history: returnHistory
          })
          .eq('id', record.id)

        if (updateError) {
          console.error('[Return Items] Update error:', updateError)
          return NextResponse.json({ error: updateError.message }, { status: 500 })
        }
      }

      // Add back to inventory ONCE per item (after processing all records)
      if (totalReturnedForThisItem > 0) {
        const inventoryItem = allInventoryItems.find(i => i.id === itemId)
        if (inventoryItem) {
          const newQty = inventoryItem.quantity + totalReturnedForThisItem
          await updateInventoryItem(itemId, { quantity: newQty })

          console.log(`[Return] Updated inventory for ${itemName}: +${totalReturnedForThisItem} (new qty: ${newQty})`)

          // Log the return ONCE per item
          await addLog({
            operation: 'return',
            itemId,
            itemName,
            quantity: totalReturnedForThisItem,
            details: `Returned "${itemName}" - Qty: ${totalReturnedForThisItem}, From: ${personName}, Processed by: ${returnedBy}`,
          })
        }
      }
    }

    console.log(`[Return Items] ✅ Returned items for: ${personName}`)
    return NextResponse.json({ success: true }, { status: 200 })

  } catch (error: any) {
    console.error('[Return Items] Exception:', error)
    return NextResponse.json({ error: error.message || 'Failed to return items' }, { status: 500 })
  }
})
