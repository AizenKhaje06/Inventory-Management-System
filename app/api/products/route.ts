import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin as supabase } from "@/lib/supabase"
import { withAuth } from "@/lib/api-helpers"

// GET - Fetch all products (inventory + bundles)
export const GET = withAuth(async (request, { user }) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search")
    const store = searchParams.get("store")
    const category = searchParams.get("category")
    const productType = searchParams.get("productType") // 'regular', 'bundle', or 'all'

    let query = supabase
      .from('products_unified')
      .select('*')
      .order('name', { ascending: true })

    // Products are universal - all roles can see all products
    // No department/channel filtering needed

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%,sku.ilike.%${search}%`)
    }
    
    if (store && store !== 'all') {
      query = query.eq('store', store)
    }
    
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }
    
    if (productType && productType !== 'all') {
      query = query.eq('productType', productType)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Products API] Error fetching products:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Map snake_case database columns to camelCase for frontend
    const products = (data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      costPrice: item.cost_price,
      sellingPrice: item.selling_price,
      reorderLevel: item.reorder_level,
      totalCOGS: item.total_cogs,
      sku: item.sku,
      imageUrl: item.image_url,
      productType: item.product_type,
      item_status: item.item_status,
      bad_item_reason: item.bad_item_reason,
      bad_item_quantity: item.bad_item_quantity,
      bad_items_breakdown: item.bad_items_breakdown,
      lastUpdated: item.last_updated,
      createdAt: item.created_at
    }))

    console.log('[Products API] Fetched products count:', products.length)
    console.log('[Products API] First 3 products:', products.slice(0, 3))

    return NextResponse.json(products)
  } catch (error) {
    console.error('[Products API] Exception:', error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
})
