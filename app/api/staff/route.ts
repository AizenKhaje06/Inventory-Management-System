import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withAuth } from '@/lib/api-helpers'

/**
 * GET /api/staff
 * Get all staff members (simplified endpoint for employee purchases)
 * 
 * Requires authentication (any logged-in user)
 */
export const GET = withAuth(async (request, { user }) => {
  try {
    // Query all users with team_leader role (these are the employees)
    const { data: staff, error } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, email, role, assigned_channel, created_at')
      .eq('role', 'team_leader')
      .order('display_name', { ascending: true })

    if (error) {
      console.error('[Get Staff] Query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch staff' },
        { status: 500 }
      )
    }

    // Map to simple format
    const mappedStaff = (staff || []).map((member: any) => ({
      id: member.id,
      name: member.display_name || member.username,
      username: member.username,
      email: member.email,
      department: member.assigned_channel || member.role,
      role: member.role,
      createdAt: member.created_at
    }))

    return NextResponse.json({
      success: true,
      staff: mappedStaff
    }, { status: 200 })

  } catch (error) {
    console.error('[Get Staff] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch staff' },
      { status: 500 }
    )
  }
})
