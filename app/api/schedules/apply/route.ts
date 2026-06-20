import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { db } from "@/db"
import { courseSchedules } from "@/db/schema"
import { eq } from "drizzle-orm"
import type { ScheduleEntry } from "@/lib/scheduling/types"

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Admin only" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      academicYearId,
      schedule,
      replaceExisting = true,
    }: {
      academicYearId: string
      schedule: ScheduleEntry[]
      replaceExisting?: boolean
    } = body

    if (!academicYearId || !Array.isArray(schedule)) {
      return NextResponse.json(
        { error: "Missing academicYearId or schedule array" },
        { status: 400 }
      )
    }

    if (replaceExisting) {
      await db
        .delete(courseSchedules)
        .where(eq(courseSchedules.academicYearId, academicYearId))
    }

    if (schedule.length === 0) {
      return NextResponse.json({ success: true, applied: 0 })
    }

    const rows = await db
      .insert(courseSchedules)
      .values(
        schedule.map((entry) => ({
          courseId: entry.courseId,
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
          room: entry.room,
          groupId: entry.groupId,
          subjectAssignmentId: entry.subjectAssignmentId,
          academicYearId: entry.academicYearId,
        }))
      )
      .returning()

    return NextResponse.json({
      success: true,
      applied: rows.length,
    })
  } catch (error) {
    console.error("Schedule apply API error:", error)
    return NextResponse.json(
      { error: "Failed to apply schedule" },
      { status: 500 }
    )
  }
}
