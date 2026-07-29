import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { addLog } from '@/lib/supabase-db'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/freebies
 * Create freebie records and deduct inventory
 */
export async function POST(request: NextRequest) {
  const authResult = requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult

  try {
    const body = await request.json()
    const { items, reason, dispatchedBy, dispatchedDate, givenWithSale, customerName, notes } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items array is required' }, { status: 400 })
    }

    if (!dispatchedBy) {
      return NextResponse.json({ error: 'Dispatched by is required' }, { status: 400 })
    }

    // Insert freebie records
    const freebieRecords = items.map((item: any) => ({
      item_id: item.itemId,
      item_name: item.itemName,
      quantity: item.quantity,
      cost_price: item.costPrice,
      total_cogs: item.totalCOGS || (item.costPrice * item.quantity),
      given_with_sale_id: givenWithSale || null,
      reason: reason || 'Promotional giveaway',
      dispatched_by: dispatchedBy,
      dispatched_date: dispatchedDate || new Date().toISOString().split('T')[0],
      customer_name: customerName || null,
      notes: notes || null
    }))

    const { data: insertedFreebies, error: insertError } = await supabase
      .from('freebies')
      .insert(freebieRecords)
      .select()

    if (insertError) {
      console.error('[Freebies API] Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create freebie records', details: insertError.message }, { status: 500 })
    }

    // Deduct inventory for freebie items
    for (const item of items) {
      const { data: inventoryItem, error: fetchError } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('id', item.itemId)
        .single()

      if (fetchError || !inventoryItem) {
        console.error(`[Freebies API] Failed to fetch inventory for ${item.itemName}:`, fetchError)
        continue
      }

      const newQuantity = inventoryItem.quantity - item.quantity

      if (newQuantity < 0) {
        console.warn(`[Freebies API] Warning: ${item.itemName} quantity would be negative (${newQuantity})`)
      }

      const { error: updateError } = await supabase
        .from('inventory')
        .update({ quantity: Math.max(0, newQuantity) })
        .eq('id', item.itemId)

      if (updateError) {
        console.error(`[Freebies API] Failed to update inventory for ${item.itemName}:`, updateError)
      }

      // Log the freebie
      await addLog({
        operation: 'freebie',
        itemId: item.itemId,
        itemName: item.itemName,
        details: `Freebie: ${item.quantity} units given by ${dispatchedBy}. Reason: ${reason || 'Promotional giveaway'}. COGS: ₱${(item.costPrice * item.quantity).toFixed(2)}`
      })
    }

    console.log('[Freebies API] Successfully created freebies:', insertedFreebies.length)

    return NextResponse.json({ 
      success: true, 
      freebies: insertedFreebies,
      message: `${items.length} freebie item(s) recorded successfully`
    })
  } catch (error) {
    console.error('[Freebies API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/freebies
 * Get freebies with optional filters
 */
export async function GET(request: NextRequest) {
  const authResult = requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const reason = searchParams.get('reason')
    const dispatchedBy = searchParams.get('dispatchedBy')

    let query = supabase
      .from('freebies')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply filters
    if (startDate) {
      query = query.gte('dispatched_date', startDate)
    }

    if (endDate) {
      query = query.lte('dispatched_date', endDate)
    }

    if (reason) {
      query = query.eq('reason', reason)
    }

    if (dispatchedBy) {
      query = query.eq('dispatched_by', dispatchedBy)
    }

    const { data: freebies, error } = await query

    if (error) {
      console.error('[Freebies API] Fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch freebies' }, { status: 500 })
    }

    // Calculate totals
    const totalItems = freebies.reduce((sum, f) => sum + f.quantity, 0)
    const totalCOGS = freebies.reduce((sum, f) => sum + parseFloat(f.total_cogs), 0)

    return NextResponse.json({ 
      freebies,
      totals: {
        count: freebies.length,
        totalItems,
        totalCOGS
      }
    })
  } catch (error) {
    console.error('[Freebies API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
