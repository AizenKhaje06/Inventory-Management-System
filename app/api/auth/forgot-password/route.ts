import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { hashPassword } from "@/lib/password-hash"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 200 })
    }

    // Find admin user by email
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('role', 'admin')
      .limit(1)

    if (error) {
      console.error('[Forgot Password] Database error:', error)
      return NextResponse.json({ error: "Failed to process request" }, { status: 200 })
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: false,
        error: "This email is not associated with an admin account"
      }, { status: 200 })
    }

    const user = users[0]

    // Generate a temporary password (8 characters)
    const tempPassword = Math.random().toString(36).slice(-8)

    // Hash and save the temporary password
    const hashedPassword = await hashPassword(tempPassword)

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', user.id)

    if (updateError) {
      console.error('[Forgot Password] Update error:', updateError)
      return NextResponse.json({ error: "Failed to reset password" }, { status: 200 })
    }

    // Log temp password to server console (admin must check server logs or Supabase dashboard)
    console.log('[Forgot Password] ✅ Password reset for user:', user.username)
    console.log('[Forgot Password] 🔑 Temporary password:', tempPassword)

    return NextResponse.json({
      success: true,
      message: "Password has been reset. Contact your system administrator for the temporary password.",
      // Only expose temp password in development
      tempPassword: process.env.NODE_ENV === 'development' ? tempPassword : undefined
    })

  } catch (error) {
    console.error('[Forgot Password] Error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 200 })
  }
}
