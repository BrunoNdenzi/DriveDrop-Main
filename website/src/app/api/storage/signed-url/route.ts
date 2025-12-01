import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { path } = await request.json()

    if (!path) {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      )
    }

    const supabase = getServiceSupabase()

    // Extract bucket and file path from full URL or path
    let bucket: string
    let filePath: string

    if (path.includes('storage/v1/object/public/')) {
      // Parse from full URL
      const urlMatch = path.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
      if (!urlMatch) {
        return NextResponse.json(
          { error: 'Invalid storage URL format' },
          { status: 400 }
        )
      }
      bucket = urlMatch[1]
      filePath = urlMatch[2]
    } else {
      // Assume format: bucket/path
      const parts = path.split('/')
      bucket = parts[0]
      filePath = parts.slice(1).join('/')
    }

    // Generate signed URL (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600) // 1 hour

    if (error) {
      console.error('Error creating signed URL:', error)
      return NextResponse.json(
        { error: 'Failed to create signed URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
    })
  } catch (error) {
    console.error('Error in signed URL endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
