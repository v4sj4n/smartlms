import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import {
  validateSchedule,
  formatValidationResponse,
} from "@/lib/scheduling/validator"

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Only admin and professors can validate schedules
    if (user.role !== "ADMIN" && user.role !== "PROFESSOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const academicYearId = searchParams.get("academicYearId")

    if (!academicYearId) {
      return NextResponse.json(
        { error: "Missing required parameter: academicYearId" },
        { status: 400 }
      )
    }

    const result = await validateSchedule(academicYearId)
    const formatted = formatValidationResponse(result)

    return NextResponse.json(formatted)
  } catch (error) {
    console.error("Schedule validation API error:", error)
    return NextResponse.json(
      { error: "Failed to validate schedule" },
      { status: 500 }
    )
  }
}
