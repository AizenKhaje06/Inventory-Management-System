import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { withRoles } from "@/lib/api-helpers"

export const POST = withRoles(['admin', 'logistics-admin'], async (request: NextRequest) => {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const itemId = formData.get("itemId") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPG, PNG, WebP allowed." }, { status: 400 })
    }

    // Validate file size (max 2MB after compression)
    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large. Maximum size is 2MB." }, { status: 400 })
    }

    // Generate unique filename
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
    const filename = `${itemId || Date.now()}-${Date.now()}.${ext}`
    const filePath = `products/${filename}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    console.log("[Upload] Attempting upload to bucket: product-images")
    console.log("[Upload] File path:", filePath)
    console.log("[Upload] File size:", buffer.length, "bytes")
    console.log("[Upload] Content type:", file.type)
    
    const { data, error } = await supabaseAdmin.storage
      .from("product-images")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true, // Overwrite if exists
      })

    if (error) {
      console.error("[Upload] Supabase storage error:", error)
      console.error("[Upload] Error details:", JSON.stringify(error, null, 2))
      return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 })
    }

    console.log("[Upload] Upload successful:", data)

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("product-images")
      .getPublicUrl(filePath)

    console.log("[Upload] Generated public URL:", urlData.publicUrl)
    console.log("[Upload] File path:", filePath)
    
    // Verify file exists by listing
    const { data: listData, error: listError } = await supabaseAdmin.storage
      .from("product-images")
      .list("products")
    
    if (listError) {
      console.error("[Upload] Failed to list files:", listError)
    } else {
      console.log("[Upload] Files in products folder:", listData?.length || 0)
      const uploadedFile = listData?.find(f => f.name === filename)
      if (uploadedFile) {
        console.log("[Upload] ✅ File verified in storage:", uploadedFile.name)
      } else {
        console.error("[Upload] ❌ File NOT found in storage after upload!")
      }
    }

    return NextResponse.json({ 
      url: urlData.publicUrl,
      path: filePath
    })
  } catch (error) {
    console.error("[Upload] Error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
})

export const DELETE = withRoles(['admin', 'logistics-admin'], async (request: NextRequest) => {
  try {
    const { path } = await request.json()

    if (!path) {
      return NextResponse.json({ error: "No path provided" }, { status: 400 })
    }

    const { error } = await supabaseAdmin.storage
      .from("product-images")
      .remove([path])

    if (error) {
      console.error("[Upload] Delete error:", error)
      return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Upload] Delete error:", error)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
})
