import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const store = searchParams.get('store')
    const activeOnly = searchParams.get('activeOnly') !== 'false'
    
    // Get user from headers for department filtering
    const userRole = request.headers.get('x-user-role')
    const assignedChannel = request.headers.get('x-assigned-channel')
    
    let query = supabase.from('bundles').select('*').order('created_at', { ascending: false })
    
    if (activeOnly) query = query.eq('is_active', true)
    if (store) query = query.eq('store', store)

    // DEPARTMENT FILTERING: Operations users only see their department's bundles
    if (userRole === 'operations' && assignedChannel) {
      query = query.eq('sales_channel', assignedChannel)
    }
    // Admin sees all bundles
    
    const { data, error } = await query
    
    if (error) {
      console.error('[Bundles API] GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json(data || [], { status: 200 })
  } catch (error: any) {
    console.error('[Bundles API] GET exception:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[Bundles API] Creating bundle:', body.name)
    
    const { name, description, bundlePrice, items, badge } = body

    if (!name || !bundlePrice || !items?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    const itemIds = items.map((i: any) => i.itemId)
    
    // Fetch items for cost calculation
    const { data: itemsData, error: itemsError } = await supabase
      .from('inventory')
      .select('id, cost_price, selling_price')
      .in('id', itemIds)
    
    if (itemsError || !itemsData?.length) {
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }
    
    let bundleCost = 0
    let regularPrice = 0
    
    items.forEach((bundleItem: any) => {
      const item = itemsData.find(i => i.id === bundleItem.itemId)
      if (item) {
        bundleCost += item.cost_price * bundleItem.quantity
        regularPrice += item.selling_price * bundleItem.quantity
      }
    })
    
    if (bundlePrice < bundleCost) {
      return NextResponse.json({ error: 'Price below cost' }, { status: 400 })
    }
    
    const bundleId = 'BUNDLE-' + Date.now()
    
    // Insert bundle with quantity = 0 (will be updated by trigger)
    const bundleData: any = {
      id: bundleId,
      name: name.trim(),
      bundle_price: bundlePrice,
      bundle_cost: bundleCost,
      is_active: true,
      quantity: 0,
      reorder_level: 5
    }

    if (description?.trim()) bundleData.description = description.trim()
    if (badge?.trim()) bundleData.badge = badge.trim()
    
    const { data: bundle, error: bundleError } = await supabase
      .from('bundles')
      .insert(bundleData)
      .select()
      .single()
    
    if (bundleError) {
      console.error('[Bundles API] Error creating bundle:', bundleError)
      return NextResponse.json({ error: 'Failed to create bundle' }, { status: 500 })
    }
    
    // Insert bundle items (trigger will auto-update bundle quantity)
    const bundleItemsData = items.map((item: any, index: number) => ({
      id: 'BITEM-' + Date.now() + '-' + index,
      bundle_id: bundleId,
      item_id: item.itemId,
      quantity: item.quantity
    }))
    
    const { error: itemsInsertError } = await supabase
      .from('bundle_items')
      .insert(bundleItemsData)
    
    if (itemsInsertError) {
      console.error('[Bundles API] Error inserting items:', itemsInsertError)
      console.error('[Bundles API] Items data:', JSON.stringify(bundleItemsData, null, 2))
      console.error('[Bundles API] Error details:', {
        message: itemsInsertError.message,
        details: itemsInsertError.details,
        hint: itemsInsertError.hint,
        code: itemsInsertError.code
      })
      // Rollback: delete the bundle
      await supabase.from('bundles').delete().eq('id', bundleId)
      return NextResponse.json({ 
        error: 'Failed to add items', 
        details: itemsInsertError.message 
      }, { status: 500 })
    }
    
    // Fetch updated bundle with correct quantity (set by trigger)
    const { data: updatedBundle } = await supabase
      .from('bundles')
      .select('*')
      .eq('id', bundleId)
      .single()
    
    console.log('[Bundles API] Bundle created with quantity:', updatedBundle?.quantity)
    return NextResponse.json(updatedBundle || bundle, { status: 201 })
  } catch (error: any) {
    console.error('[Bundles API] Exception:', error)
    return NextResponse.json({ error: 'Failed to create bundle' }, { status: 500 })
  }
}
