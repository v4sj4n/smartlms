import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { generateSchedule } from "@/lib/scheduling/generator"
import { getSubjectAssignments } from "@/lib/actions/academic-structure"
import { getProfessorAvailability } from "@/lib/actions/professor-availability"
import { buildDefaultTwoHourGrid } from "@/lib/scheduling/equilibrium"
import type {
  SubjectAssignmentRequest,
  Room,
  TimeSlot,
  GenerationMode,
} from "@/lib/scheduling/types"

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
      mode = "balanced",
      timeSlots,
      rooms,
    }: {
      academicYearId: string
      mode: GenerationMode
      timeSlots?: TimeSlot[]
      rooms?: Room[]
    } = body

    if (!academicYearId) {
      return NextResponse.json(
        { error: "Missing required field: academicYearId" },
        { status: 400 }
      )
    }

    const assignmentsResult = await getSubjectAssignments({ academicYearId })

    if (!assignmentsResult.success) {
      return NextResponse.json(
        { error: "Failed to fetch subject assignments" },
        { status: 500 }
      )
    }

    const assignmentRequests: SubjectAssignmentRequest[] = []

    for (const assignment of assignmentsResult.data || []) {
      const availabilityResult = await getProfessorAvailability(
        assignment.professorId
      )

      const availableSlots: TimeSlot[] = []

      if (availabilityResult.success && availabilityResult.data?.availability) {
        for (const slot of availabilityResult.data.availability) {
          availableSlots.push({
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
          })
        }
      }

      assignmentRequests.push({
        assignmentId: assignment.id,
        professorId: assignment.professorId,
        courseId: assignment.courseId,
        groupId: assignment.groupId,
        requiredHours: assignment.requiredHours,
        availableSlots,
        maxWeeklyHours: availabilityResult.data?.maxWeeklyHours ?? 20,
        preferredTimeSlots: availabilityResult.data?.preferredTimeSlots ?? [],
        sessionType: assignment.sessionType ?? "lecture",
      })
    }

    const defaultTimeSlots: TimeSlot[] = timeSlots ?? buildDefaultTwoHourGrid()

    const defaultRooms: Room[] = rooms || [
      { id: "room-1", name: "Room 101", building: "Main Building" },
      { id: "room-2", name: "Room 102", building: "Main Building" },
      { id: "room-3", name: "Room 103", building: "Main Building" },
      { id: "lab-1", name: "Lab 1", building: "Science Building" },
      { id: "lab-2", name: "Lab 2", building: "Science Building" },
      { id: "hall-a", name: "Lecture Hall A", building: "Main Building" },
    ]

    const result = await generateSchedule({
      academicYearId,
      mode,
      assignments: assignmentRequests,
      rooms: defaultRooms,
      timeSlots: defaultTimeSlots,
    })

    return NextResponse.json({
      success: result.success,
      schedule: result.schedule,
      conflicts: result.conflicts,
      stats: result.stats,
      error: result.error,
    })
  } catch (error) {
    console.error("Schedule generation API error:", error)
    return NextResponse.json(
      { error: "Failed to generate schedule" },
      { status: 500 }
    )
  }
}
