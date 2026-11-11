import { type NextRequest, NextResponse } from "next/server"
// Using Supabase as primary database
import { addTransaction, updateInventoryItem, getInventoryItems, addLog } from "@/lib/supabase-db"
import { invalidateCachePattern } from "@/lib/cache"
import { supabaseAdmin as supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, department, staffName, notes, skipStockUpdate } = body

    console.log('[Sales API] Received request:', { items, department, staffName, notes })

    // Get user from headers for department filtering and dispatcher info
    const userRole = request.headers.get('x-user-role')
    const assignedChannel = request.headers.get('x-assigned-channel')
    const dispatcherName = request.headers.get('x-user-display-name') || 'N/A'

    if (!department) {
      console.error('[Sales API] Department is missing')
      return NextResponse.json({ error: "Department is required" }, { status: 400 })
    }

    if (!items || items.length === 0) {
      console.error('[Sales API] No items provided')
      return NextResponse.json({ error: "Items are required" }, { status: 400 })
    }

    // DEPARTMENT VALIDATION removed — only admin and logistics-admin exist
    // Both roles can create sales for any department

    // Determine transaction type based on destination
    const transactionType = department.startsWith('Demo/Display') 
      ? 'demo' 
      : department.startsWith('Internal Use')
      ? 'internal'
      : department.startsWith('Warehouse')
      ? 'transfer'
      : 'sale'

    // Extract destination storage room for warehouse transfers
    const destinationStorage = transactionType === 'transfer' && department.includes(' / ')
      ? department.split(' / ')[1]
      : null

    const allItems = await getInventoryItems()
    const transactions = []

    // Process items sequentially to avoid race conditions
    for (const saleItem of items) {
      // Check if it's a bundle (ID starts with "BUNDLE-")
      const isBundle = saleItem.itemId.startsWith('BUNDLE-')
      
      if (isBundle) {
        // Handle bundle sale
        const { data: bundle, error: bundleError } = await supabase
          .from('bundles')
          .select('*')
          .eq('id', saleItem.itemId)
          .single()
        
        if (bundleError || !bundle) {
          return NextResponse.json({ error: `Bundle ${saleItem.itemId} not found` }, { status: 404 })
        }
        
        if (bundle.quantity < saleItem.quantity) {
          return NextResponse.json({ error: `Insufficient stock for bundle ${bundle.name}` }, { status: 400 })
        }
        
        // Get bundle components
        const { data: bundleItems } = await supabase
          .from('bundle_items')
          .select('*')
          .eq('bundle_id', saleItem.itemId)
        
        // Deduct component items from inventory
        for (const component of bundleItems || []) {
          const inventoryItem = allItems.find(item => item.id === component.item_id)
          if (inventoryItem) {
            const deductQty = component.quantity * saleItem.quantity
            await updateInventoryItem(inventoryItem.id, {
              quantity: inventoryItem.quantity - deductQty
            })
          }
        }
        
        // Update bundle quantity
        await supabase
          .from('bundles')
          .update({ quantity: bundle.quantity - saleItem.quantity })
          .eq('id', saleItem.itemId)
        
        // Record transaction
        const totalCost = bundle.bundle_cost * saleItem.quantity
        const totalRevenue = transactionType === 'sale' ? bundle.bundle_price * saleItem.quantity : 0
        const profit = totalRevenue - totalCost
        
        const transaction = await addTransaction({
          itemId: bundle.id,
          itemName: bundle.name,
          quantity: saleItem.quantity,
          costPrice: bundle.bundle_cost,
          sellingPrice: bundle.bundle_price,
          totalCost,
          totalRevenue,
          profit,
          type: "sale",
          transactionType,
          department,
          staffName,
          notes,
        })
        
        await addLog({
          operation: transactionType === 'sale' ? 'sale' : transactionType === 'demo' ? 'demo-display' : transactionType === 'internal' ? 'internal-usage' : 'warehouse',
          itemId: bundle.id,
          itemName: bundle.name,
          details: `${transactionType === 'sale' ? 'Dispatched' : transactionType === 'demo' ? 'Demo/Display' : transactionType === 'internal' ? 'Internal Use' : 'Transferred'} bundle "${bundle.name}" - Qty: ${saleItem.quantity}, ${transactionType === 'sale' ? `Total: ₱${totalRevenue.toFixed(2)}, ` : ''}Department: ${department}, Dispatcher: ${dispatcherName}`
        })
        
        transactions.push(transaction)
        continue
      }
      
      // Regular item handling (existing code)
      const inventoryItem = allItems.find((item) => item.id === saleItem.itemId)

      if (!inventoryItem) {
        return NextResponse.json({ error: `Item ${saleItem.itemId} not found` }, { status: 404 })
      }

      if (inventoryItem.quantity < saleItem.quantity) {
        return NextResponse.json({ error: `Insufficient stock for ${inventoryItem.name}` }, { status: 400 })
      }

      const totalCost = inventoryItem.costPrice * saleItem.quantity
      // For non-sales movements, revenue = 0 (no actual sale)
      const totalRevenue = transactionType === 'sale' ? inventoryItem.sellingPrice * saleItem.quantity : 0
      const profit = totalRevenue - totalCost

      // Handle warehouse transfer differently
      if (transactionType === 'transfer' && destinationStorage) {
        // Find if item already exists in destination storage
        const destinationItem = allItems.find(
          (item) => item.name === inventoryItem.name &&
                    item.id !== inventoryItem.id
        )

        if (destinationItem) {
          // Item exists in destination - add quantity
          await Promise.all([
            // Subtract from source
            updateInventoryItem(inventoryItem.id, {
              quantity: inventoryItem.quantity - saleItem.quantity,
            }),
            // Add to destination
            updateInventoryItem(destinationItem.id, {
              quantity: destinationItem.quantity + saleItem.quantity,
            }),
            // Log the transfer
            addLog({
              operation: 'warehouse',
              itemId: inventoryItem.id,
              itemName: inventoryItem.name,
              details: `Transferred "${inventoryItem.name}" - Qty: ${saleItem.quantity}, Dispatcher: ${dispatcherName}`
            }),
            // Record transaction
            addTransaction({
              itemId: inventoryItem.id,
              itemName: inventoryItem.name,
              quantity: saleItem.quantity,
              costPrice: inventoryItem.costPrice,
              sellingPrice: inventoryItem.sellingPrice,
              totalCost,
              totalRevenue: 0,
              profit: 0,
              type: "sale",
              transactionType: 'transfer',
              department,
              staffName,
              notes: `Transfer to ${destinationStorage}`,
            })
          ])
        } else {
          // Item doesn't exist in destination - create new entry
          const { addInventoryItem } = await import('@/lib/supabase-db')
          
          await Promise.all([
            // Subtract from source
            updateInventoryItem(inventoryItem.id, {
              quantity: inventoryItem.quantity - saleItem.quantity,
            }),
            // Create in destination
            addInventoryItem({
              name: inventoryItem.name,
              category: inventoryItem.category,
              quantity: saleItem.quantity,
              totalCOGS: totalCost,
              costPrice: inventoryItem.costPrice,
              sellingPrice: inventoryItem.sellingPrice,
              reorderLevel: inventoryItem.reorderLevel,
            }),
            // Log the transfer
            addLog({
              operation: 'warehouse',
              itemId: inventoryItem.id,
              itemName: inventoryItem.name,
              details: `Transferred "${inventoryItem.name}" from ${inventoryItem.store} to ${destinationStorage} (new entry) - Qty: ${saleItem.quantity}, Dispatcher: ${dispatcherName}`
            }),
            // Record transaction
            addTransaction({
              itemId: inventoryItem.id,
              itemName: inventoryItem.name,
              quantity: saleItem.quantity,
              costPrice: inventoryItem.costPrice,
              sellingPrice: inventoryItem.sellingPrice,
              totalCost,
              totalRevenue: 0,
              profit: 0,
              type: "sale",
              transactionType: 'transfer',
              department,
              staffName,
              notes: `Transfer (new entry)`,
            })
          ])
        }
      } else {
        // Regular sale/demo/internal use - subtract from inventory (unless skipStockUpdate is true)
        const transactionPromises: Promise<any>[] = [
          addTransaction({
            itemId: inventoryItem.id,
            itemName: inventoryItem.name,
            quantity: saleItem.quantity,
            costPrice: inventoryItem.costPrice,
            sellingPrice: inventoryItem.sellingPrice,
            totalCost,
            totalRevenue,
            profit,
            type: "sale",
            transactionType,
            department,
            staffName,
            notes,
          }),
          addLog({
            operation: transactionType === 'sale' ? 'sale' : transactionType === 'demo' ? 'demo-display' : transactionType === 'internal' ? 'internal-usage' : 'warehouse',
            itemId: inventoryItem.id,
            itemName: inventoryItem.name,
            details: `${transactionType === 'sale' ? 'Dispatched' : transactionType === 'demo' ? 'Demo/Display' : transactionType === 'internal' ? 'Internal Use' : 'Transferred'} "${inventoryItem.name}" - Qty: ${saleItem.quantity}, ${transactionType === 'sale' ? `Total: ₱${totalRevenue.toFixed(2)}, ` : ''}Department: ${department}, Dispatcher: ${dispatcherName}`
          })
        ]
        
        // Only update inventory if skipStockUpdate is not true
        // skipStockUpdate is used when stock is already updated (e.g., stock adjustment/reduce)
        if (!skipStockUpdate) {
          transactionPromises.push(
            updateInventoryItem(inventoryItem.id, {
              quantity: inventoryItem.quantity - saleItem.quantity,
            })
          )
        }

        const [transaction] = await Promise.all(transactionPromises)
        transactions.push(transaction)
      }
    }

    // Invalidate all relevant caches after sale
    invalidateCachePattern('inventory')
    invalidateCachePattern('transactions')
    invalidateCachePattern('dashboard')

    return NextResponse.json({ transactions })
  } catch (error: any) {
    console.error("[Sales API] Error processing sale:", error)
    console.error("[Sales API] Error message:", error?.message)
    console.error("[Sales API] Error stack:", error?.stack)
    return NextResponse.json({ 
      error: "Failed to process sale", 
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}
