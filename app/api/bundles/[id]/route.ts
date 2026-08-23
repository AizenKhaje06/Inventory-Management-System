import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { requireRole } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET single bundle
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    
    const { data: bundle, error } = await supabase
      .from('bundles')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error || !bundle) {
      return NextResponse.json({ error: 'Bundle not found' }, { status: 404 })
    }
    
    // Get bundle items
    const { data: bundleItems, error: itemsError } = await supabase
      .from('bundle_items')
      .select('*')
      .eq('bundle_id', id)
    
    if (itemsError) {
      console.error('[Bundles API] Error fetching bundle items:', itemsError)
    }
    
    return NextResponse.json({
      ...bundle,
      bundle_components: bundleItems || []
    }, { status: 200 })
  } catch (error: any) {
    console.error('[Bundles API] GET exception:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT update bundle
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()
    
    console.log('[Bundles API PUT] ===== START =====')
    console.log('[Bundles API PUT] Bundle ID:', id)
    console.log('[Bundles API PUT] Request body:', JSON.stringify(body, null, 2))
    console.log('[Bundles API PUT] Body keys:', Object.keys(body))
    console.log('[Bundles API PUT] imageUrl in body?', 'imageUrl' in body)
    console.log('[Bundles API PUT] imageUrl value:', body.imageUrl)
    
    // Check if bundle exists
    const { data: existingBundle, error: fetchError } = await supabase
      .from('bundles')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError || !existingBundle) {
      console.error('[Bundles API PUT] Bundle not found:', id, fetchError)
      return NextResponse.json({ error: 'Bundle not found' }, { status: 404 })
    }
    
    console.log('[Bundles API PUT] Existing bundle found:', existingBundle.name)
    console.log('[Bundles API PUT] Current image_url:', existingBundle.image_url)
    
    // STRICT VALIDATION: Prevent quantity changes through edit
    if (body.quantity !== undefined && body.quantity !== existingBundle.quantity) {
      console.error('[Bundles API PUT] ❌ Attempt to change quantity blocked')
      return NextResponse.json({ 
        error: "Direct quantity modification is not allowed for bundles. Quantity is auto-calculated from components.",
        field: "quantity"
      }, { status: 400 })
    }
    
    // Prepare update data
    const updateData: any = {}
    
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.store !== undefined) updateData.store = body.store
    // Removed: if (body.quantity !== undefined) - bundles auto-calculate quantity
    if (body.costPrice !== undefined) updateData.bundle_cost = body.costPrice
    if (body.bundlePrice !== undefined) updateData.bundle_price = body.bundlePrice
    if (body.sellingPrice !== undefined) updateData.bundle_price = body.sellingPrice
    if (body.reorderLevel !== undefined) updateData.reorder_level = body.reorderLevel
    if (body.description !== undefined) updateData.description = body.description
    if (body.badge !== undefined) updateData.badge = body.badge
    if (body.imageUrl !== undefined) {
      console.log('[Bundles API PUT] ✅ imageUrl found in body, setting to:', body.imageUrl)
      updateData.image_url = body.imageUrl
    } else {
      console.log('[Bundles API PUT] ❌ imageUrl NOT found in body')
    }
    
    // Handle bundle items update if provided
    if (body.items && Array.isArray(body.items)) {
      console.log('[Bundles API PUT] Bundle items provided, updating components')
      console.log('[Bundles API PUT] Items to update:', JSON.stringify(body.items, null, 2))
      
      // Delete existing bundle items
      const { error: deleteError } = await supabase
        .from('bundle_items')
        .delete()
        .eq('bundle_id', id)
      
      if (deleteError) {
        console.error('[Bundles API PUT] Error deleting old bundle items:', deleteError)
        console.error('[Bundles API PUT] Delete error details:', JSON.stringify(deleteError, null, 2))
        return NextResponse.json({ 
          error: 'Failed to delete old bundle items', 
          details: deleteError.message 
        }, { status: 500 })
      }
      
      console.log('[Bundles API PUT] Old bundle items deleted successfully')
      
      // Insert new bundle items with generated IDs
      const bundleItems = body.items.map((item: any) => ({
        id: `BUNDLE_ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        bundle_id: id,
        item_id: item.itemId,
        quantity: item.quantity
      }))
      
      console.log('[Bundles API PUT] Prepared bundle items for insert:', JSON.stringify(bundleItems, null, 2))
      
      const { error: insertError } = await supabase
        .from('bundle_items')
        .insert(bundleItems)
      
      if (insertError) {
        console.error('[Bundles API PUT] Error inserting new bundle items:', insertError)
        console.error('[Bundles API PUT] Insert error details:', JSON.stringify(insertError, null, 2))
        console.error('[Bundles API PUT] Insert error code:', insertError.code)
        console.error('[Bundles API PUT] Insert error message:', insertError.message)
        return NextResponse.json({ 
          error: 'Failed to insert new bundle items', 
          details: insertError.message,
          code: insertError.code
        }, { status: 500 })
      }
      
      console.log('[Bundles API PUT] Bundle items updated successfully')
    }
    
    console.log('[Bundles API PUT] Final update data:', JSON.stringify(updateData, null, 2))
    console.log('[Bundles API PUT] Update data keys:', Object.keys(updateData))
    
    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      console.log('[Bundles API PUT] No fields to update')
      return NextResponse.json(existingBundle, { status: 200 })
    }
    
    // Update bundle
    console.log('[Bundles API PUT] Executing Supabase update...')
    const { data: updatedBundle, error: updateError } = await supabase
      .from('bundles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (updateError) {
      console.error('[Bundles API PUT] ❌ Supabase update error:', updateError)
      console.error('[Bundles API PUT] Error details:', JSON.stringify(updateError, null, 2))
      return NextResponse.json({ error: 'Failed to update bundle', details: updateError.message }, { status: 500 })
    }
    
    console.log('[Bundles API PUT] ✅ Bundle updated successfully')
    console.log('[Bundles API PUT] Updated bundle image_url:', updatedBundle?.image_url)
    console.log('[Bundles API PUT] ===== END =====')
    return NextResponse.json(updatedBundle, { status: 200 })
  } catch (error: any) {
    console.error('[Bundles API PUT] ❌ Exception:', error)
    console.error('[Bundles API PUT] Exception stack:', error.stack)
    return NextResponse.json({ error: 'Failed to update bundle', details: error.message }, { status: 500 })
  }
}

// DELETE bundle
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    console.log('[Bundles API DELETE] Attempting to delete bundle:', id)
    
    // Check if bundle exists
    const { data: existingBundle, error: fetchError } = await supabase
      .from('bundles')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError || !existingBundle) {
      console.log('[Bundles API DELETE] Bundle not found:', id, fetchError)
      return NextResponse.json({ error: 'Bundle not found' }, { status: 404 })
    }
    
    console.log('[Bundles API DELETE] Found bundle:', existingBundle.name)
    
    // Delete bundle items first
    const { error: itemsDeleteError } = await supabase
      .from('bundle_items')
      .delete()
      .eq('bundle_id', id)
    
    if (itemsDeleteError) {
      console.error('[Bundles API DELETE] Error deleting bundle items:', itemsDeleteError)
      return NextResponse.json({ error: `Failed to delete bundle items: ${itemsDeleteError.message}` }, { status: 500 })
    }
    
    console.log('[Bundles API DELETE] Bundle items deleted')
    
    // Delete bundle
    const { error: deleteError } = await supabase
      .from('bundles')
      .delete()
      .eq('id', id)
    
    if (deleteError) {
      console.error('[Bundles API DELETE] Error deleting bundle:', deleteError)
      return NextResponse.json({ error: `Failed to delete bundle: ${deleteError.message}` }, { status: 500 })
    }
    
    console.log('[Bundles API DELETE] Bundle deleted successfully:', id)
    return NextResponse.json({ success: true, message: 'Bundle deleted successfully' }, { status: 200 })
  } catch (error: any) {
    console.error('[Bundles API DELETE] Exception:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete bundle'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
