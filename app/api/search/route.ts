import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey)
}

interface SearchResult {
  id: string
  type: 'product' | 'order' | 'customer' | 'chat'
  title: string
  subtitle?: string
  description?: string
  link: string
}

// Server-side auth check using headers
function getCurrentUserFromRequest(request: NextRequest) {
  const username = request.headers.get('x-user-username')
  const role = request.headers.get('x-user-role')
  const displayName = request.headers.get('x-user-display-name')
  const assignedChannel = request.headers.get('x-user-assigned-channel')

  if (!username || !role) return null

  return {
    username,
    role: role as any,
    displayName: displayName || username,
    assignedChannel: assignedChannel || undefined
  }
}

export async function GET(request: NextRequest) {
  try {
    // Try to get user from headers first, fallback to session cookie
    let currentUser = getCurrentUserFromRequest(request)
    
    // If no headers, allow the request but with limited access
    // This is needed because client-side can't send custom headers easily
    const query = request.nextUrl.searchParams.get('q')
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] })
    }

    const supabase = getSupabaseClient()
    const searchTerm = query.trim().toLowerCase()
    const results: SearchResult[] = []

    // Search Products (always allowed)
    try {
      const { data: products, error: productsError } = await supabase
        .from('products_unified')
        .select('id, name, sku, category, quantity, price')
        .or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`)
        .limit(5)

      if (!productsError && products) {
        products.forEach((product: any) => {
          results.push({
            id: product.id,
            type: 'product',
            title: product.name,
            subtitle: `SKU: ${product.sku} • ${product.category}`,
            description: `Stock: ${product.quantity} • Price: ₱${product.price?.toFixed(2) || '0.00'}`,
            link: `/dashboard/inventory?product=${product.id}`
          })
        })
      }
    } catch (error) {
      console.error('Error searching products:', error)
    }

    // Search Orders (if user has admin/logistics-admin role)
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'logistics-admin')) {
      try {
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('id, channel, tracking_number, customer_name, status, total_amount, created_at')
          .or(`tracking_number.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%,channel.ilike.%${searchTerm}%`)
          .order('created_at', { ascending: false })
          .limit(5)

        if (!ordersError && orders) {
          orders.forEach((order: any) => {
            results.push({
              id: order.id,
              type: 'order',
              title: `Order #${order.tracking_number || order.id.slice(0, 8)}`,
              subtitle: `${order.customer_name} • ${order.channel}`,
              description: `Status: ${order.status} • ₱${order.total_amount?.toFixed(2) || '0.00'}`,
              link: `/dashboard/sales?order=${order.id}`
            })
          })
        }
      } catch (error) {
        console.error('Error searching orders:', error)
      }
    }

    // Search Chat Messages (if user is logged in)
    if (currentUser) {
      try {
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            conversation_id,
            created_at,
            conversations!inner (
              id,
              name,
              conversation_members!inner (
                user_id
              )
            )
          `)
          .ilike('content', `%${searchTerm}%`)
          .eq('conversations.conversation_members.user_id', currentUser.username)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(5)

        if (!messagesError && messages) {
          messages.forEach((message: any) => {
            const preview = message.content.length > 100 
              ? message.content.substring(0, 100) + '...' 
              : message.content
            
            results.push({
              id: message.id,
              type: 'chat',
              title: message.conversations?.name || 'Direct Message',
              subtitle: new Date(message.created_at).toLocaleDateString(),
              description: preview,
              link: `/dashboard/chat?conversation=${message.conversation_id}`
            })
          })
        }
      } catch (error) {
        console.error('Error searching messages:', error)
      }
    }

    // Sort results by relevance (exact matches first)
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase().includes(searchTerm) ? 1 : 0
      const bExact = b.title.toLowerCase().includes(searchTerm) ? 1 : 0
      return bExact - aExact
    })

    return NextResponse.json({ 
      results: results.slice(0, 20), // Limit to 20 total results
      query: searchTerm 
    })

  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
