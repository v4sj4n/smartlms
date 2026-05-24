import { NextRequest, NextResponse } from "next/server"
import { createSignedUpload } from "@/lib/actions/files"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await createSignedUpload(body)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create signed URL",
      },
      { status: 400 }
    )
  }
}
