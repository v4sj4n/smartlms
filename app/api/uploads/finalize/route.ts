import { NextRequest, NextResponse } from "next/server"
import { finalizeFileUpload } from "@/lib/actions/files"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await finalizeFileUpload(body)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to finalize upload",
      },
      { status: 400 }
    )
  }
}
