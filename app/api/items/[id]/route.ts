import { type NextRequest, NextResponse } from "next/server"
import { updateInventoryItem, deleteInventoryItem, getInventoryItems, addLog } from "@/lib/supabase-db"
import { invalidateCachePattern } from "@/lib/cache"
import { requireAuth, requireRole } from "@/lib/api-auth"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult

  try {
    const { id } = await context.params
    const items = await getInventoryItems()
    const item = items.find(i => i.id === id)
    
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }
    
    return NextResponse.json(item)
  } catch (error) {
    console.error("[API] Error fetching item:", error)
    return NextResponse.json({ error: "Failed to fetch item" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(request, ['admin', 'logistics-admin'])
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult

  try {
    const { id } = await context.params
    const body = await request.json()
    const items = await getInventoryItems()
    const item = items.find(i => i.id === id)
    
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }
    
    // STRICT VALIDATION: Prevent quantity changes through edit
    if (body.quantity !== undefined && body.quantity !== item.quantity) {
      return NextResponse.json({ 
        error: "Direct quantity modification is not allowed. Use the Restock function to change stock levels.",
        field: "quantity"
      }, { status: 400 })
    }
    
    // Remove quantity from update if present (safety measure)
    const { quantity, ...updateData } = body
    
    await updateInventoryItem(id, updateData)
    invalidateCachePattern('inventory')
    
    // Skip logging if only imageUrl is being updated (happens during product creation with image upload)
    const updatedFields = Object.keys(updateData)
    const isOnlyImageUpdate = updatedFields.length === 1 && updatedFields[0] === 'imageUrl'
    
    if (!isOnlyImageUpdate) {
      const changes = Object.entries(updateData)
        .filter(([key]) => key !== 'imageUrl') // Don't include imageUrl in change log
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
      
      if (changes) { // Only log if there are actual changes to log
        await addLog({
          operation: "update",
          itemId: id,
          itemName: item.name,
          details: `Updated "${item.name}" by ${user.displayName} - Changes: ${changes}`
        })
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API] Error updating item:", error)
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = requireRole(request, ['admin', 'logistics-admin'])
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult

  try {
    const { id } = await context.params
    console.log('[API DELETE] Attempting to delete item:', id)
    
    const items = await getInventoryItems()
    const item = items.find(i => i.id === id)
    
    if (!item) {
      console.log('[API DELETE] Item not found:', id)
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }
    
    console.log('[API DELETE] Found item:', item.name)
    await deleteInventoryItem(id)
    console.log('[API DELETE] Item deleted successfully')
    
    invalidateCachePattern('inventory')
    
    await addLog({
      operation: "delete",
      itemId: id,
      itemName: item.name,
      details: `Deleted "${item.name}" by ${user.displayName}`
    })
    
    return NextResponse.json({ success: true, message: 'Item deleted successfully' })
  } catch (error) {
    console.error("[API DELETE] Error deleting item:", error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete item'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
