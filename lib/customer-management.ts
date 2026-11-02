import { supabaseAdmin as supabase } from "./supabase"
import type { Customer } from "./types"

const formatTimestamp = (date: Date) => {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }
  const formatted = date.toLocaleString('en-US', options)
  const [datePart, timePart] = formatted.split(', ')
  const [month, day, year] = datePart.split('/')
  const [hour, minute] = timePart.split(':')
  const hour24 = parseInt(hour)
  const ampm = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12
  return `${year}-${month}-${day} / ${hour12}:${minute} ${ampm}`
}

export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Supabase] Error fetching customers:', error)
    throw new Error('Failed to fetch customers')
  }

  console.log('[Supabase] Raw customer data:', JSON.stringify(data, null, 2))

  return (data || []).map(row => {
    const mapped = {
      id: row.id,
      name: row.name,
      email: row.email || "",
      phone: row.phone || "",
      address: row.address || "",
      loyaltyPoints: Number(row.loyalty_points) || 0,
      totalPurchases: Number(row.total_purchases) || 0,
      totalSpent: Number(row.total_spent) || 0,
      lastPurchase: row.last_purchase || "",
      tier: (row.tier || "bronze") as 'bronze' | 'silver' | 'gold' | 'platinum',
      createdAt: row.created_at || formatTimestamp(new Date()),
    }
    console.log('[Supabase] Mapped customer:', row.name, 'totalSpent:', row.total_spent, '->', mapped.totalSpent)
    return mapped
  })
}

export async function addCustomer(customer: Omit<Customer, "id" | "createdAt">): Promise<Customer> {
  const id = `CUST-${Date.now()}`
  const createdAt = formatTimestamp(new Date())

  const { data, error } = await supabase
    .from('customers')
    .insert({
      id,
      name: customer.name,
      email: customer.email || null,
      phone: customer.phone || null,
      address: customer.address || null,
      loyalty_points: customer.loyaltyPoints || 0,
      total_purchases: customer.totalPurchases || 0,
      total_spent: customer.totalSpent || 0,
      last_purchase: customer.lastPurchase || null,
      tier: customer.tier || "bronze",
      created_at: createdAt,
    })
    .select()
    .single()

  if (error) {
    console.error('[Supabase] Error adding customer:', error)
    throw new Error('Failed to add customer')
  }

  return { ...customer, id, createdAt }
}

export async function updateCustomer(id: string, updates: Partial<Customer>): Promise<void> {
  const updateData: Record<string, unknown> = {}
  
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.email !== undefined) updateData.email = updates.email || null
  if (updates.phone !== undefined) updateData.phone = updates.phone || null
  if (updates.address !== undefined) updateData.address = updates.address || null
  if (updates.loyaltyPoints !== undefined) updateData.loyalty_points = updates.loyaltyPoints
  if (updates.totalPurchases !== undefined) updateData.total_purchases = updates.totalPurchases
  if (updates.totalSpent !== undefined) updateData.total_spent = updates.totalSpent
  if (updates.lastPurchase !== undefined) updateData.last_purchase = updates.lastPurchase || null
  if (updates.tier !== undefined) updateData.tier = updates.tier

  const { error } = await supabase
    .from('customers')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('[Supabase] Error updating customer:', error)
    throw new Error('Failed to update customer')
  }
}

export async function calculateCustomerTier(totalSpent: number): Promise<'bronze' | 'silver' | 'gold' | 'platinum'> {
  if (totalSpent >= 100000) return 'platinum'
  if (totalSpent >= 50000) return 'gold'
  if (totalSpent >= 20000) return 'silver'
  return 'bronze'
}

export async function addLoyaltyPoints(customerId: string, amount: number): Promise<void> {
  const customers = await getCustomers()
  const customer = customers.find(c => c.id === customerId)
  
  if (!customer) {
    throw new Error("Customer not found")
  }

  const points = Math.floor(amount / 100) // 1 point per 100 spent
  await updateCustomer(customerId, {
    loyaltyPoints: customer.loyaltyPoints + points
  })
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[Supabase] Error deleting customer:', error)
    throw new Error('Failed to delete customer')
  }
}
