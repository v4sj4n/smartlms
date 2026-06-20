"use server"

import { db } from "@/db"
import { users, subjectAssignments, courseSchedules } from "@/db/schema"
import { eq, and, sql, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import type { DayOfWeek } from "./schedules"

// ============================================================================
// TYPES
// ============================================================================

export type AvailabilitySlot = {
  dayOfWeek: DayOfWeek
  startTime: string // "HH:MM"
  endTime: string // "HH:MM"
}

export type PreferredTimeSlot = AvailabilitySlot & {
  priority: number // 1-5, 5 being highest preference
}

// ============================================================================
// PROFESSOR AVAILABILITY
// ============================================================================

export async function updateProfessorAvailability(
  professorId: string,
  data: {
    availability?: AvailabilitySlot[]
    maxWeeklyHours?: number
    preferredTimeSlots?: PreferredTimeSlot[]
  }
) {
  try {
    const [user] = await db
      .update(users)
      .set({
        ...(data.availability && { availability: data.availability }),
        ...(data.maxWeeklyHours !== undefined && {
          maxWeeklyHours: data.maxWeeklyHours,
        }),
        ...(data.preferredTimeSlots && {
          preferredTimeSlots: data.preferredTimeSlots,
        }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, professorId))
      .returning()

    if (!user) {
      return { success: false, error: "Professor not found" }
    }

    revalidatePath(`/professor/settings`)
    return { success: true, data: user }
  } catch (error) {
    console.error("Failed to update professor availability:", error)
    return { success: false, error: "Failed to update professor availability" }
  }
}

export async function getProfessorAvailability(professorId: string) {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, professorId),
      columns: {
        id: true,
        name: true,
        fullName: true,
        availability: true,
        maxWeeklyHours: true,
        preferredTimeSlots: true,
      },
    })

    if (!user) {
      return { success: false, error: "Professor not found" }
    }

    return {
      success: true,
      data: {
        professorId: user.id,
        name: user.fullName || user.name,
        availability: (user.availability as AvailabilitySlot[]) || [],
        maxWeeklyHours: user.maxWeeklyHours || 20,
        preferredTimeSlots:
          (user.preferredTimeSlots as PreferredTimeSlot[]) || [],
      },
    }
  } catch (error) {
    console.error("Failed to fetch professor availability:", error)
    return { success: false, error: "Failed to fetch professor availability" }
  }
}

// ============================================================================
// PROFESSOR SCHEDULE
// ============================================================================

export async function getProfessorSchedule(
  professorId: string,
  academicYearId?: string
) {
  try {
    // Get all subject assignments for this professor
    const assignments = await db.query.subjectAssignments.findMany({
      where: eq(subjectAssignments.professorId, professorId),
      columns: {
        id: true,
      },
    })

    const assignmentIds = assignments.map((a) => a.id)

    if (assignmentIds.length === 0) {
      return { success: true, data: [] }
    }

    // Get all schedules for these assignments
    let query = db.query.courseSchedules.findMany({
      where: inArray(courseSchedules.subjectAssignmentId, assignmentIds),
      with: {
        course: true,
        group: {
          with: {
            studyProgram: true,
          },
        },
        subjectAssignment: {
          with: {
            professor: {
              columns: {
                id: true,
                fullName: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [courseSchedules.dayOfWeek, courseSchedules.startTime],
    })

    if (academicYearId) {
      query = db.query.courseSchedules.findMany({
        where: and(
          inArray(courseSchedules.subjectAssignmentId, assignmentIds),
          eq(courseSchedules.academicYearId, academicYearId)
        ),
        with: {
          course: true,
          group: {
            with: {
              studyProgram: true,
            },
          },
          subjectAssignment: {
            with: {
              professor: {
                columns: {
                  id: true,
                  fullName: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [courseSchedules.dayOfWeek, courseSchedules.startTime],
      }) as typeof query
    }

    const schedules = await query

    return { success: true, data: schedules }
  } catch (error) {
    console.error("Failed to fetch professor schedule:", error)
    return { success: false, error: "Failed to fetch professor schedule" }
  }
}

// ============================================================================
// PROFESSOR WEEKLY HOURS
// ============================================================================

export async function getProfessorWeeklyHours(
  professorId: string,
  academicYearId?: string
) {
  try {
    // Get all subject assignments for this professor
    const assignments = await db.query.subjectAssignments.findMany({
      where: eq(subjectAssignments.professorId, professorId),
      columns: {
        id: true,
        requiredHours: true,
      },
    })

    const assignmentIds = assignments.map((a) => a.id)

    if (assignmentIds.length === 0) {
      return {
        success: true,
        data: {
          assignedHours: 0,
          maxHours: 20,
          remainingHours: 20,
          assignmentCount: 0,
        },
      }
    }

    // Calculate total scheduled hours
    let query = db
      .select({
        totalHours: sql<number>`COALESCE(SUM(
          EXTRACT(HOUR FROM CAST(${courseSchedules.endTime} AS TIME)) - 
          EXTRACT(HOUR FROM CAST(${courseSchedules.startTime} AS TIME))
        ), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(courseSchedules)
      .where(inArray(courseSchedules.subjectAssignmentId, assignmentIds))

    if (academicYearId) {
      query = db
        .select({
          totalHours: sql<number>`COALESCE(SUM(
            EXTRACT(HOUR FROM CAST(${courseSchedules.endTime} AS TIME)) - 
            EXTRACT(HOUR FROM CAST(${courseSchedules.startTime} AS TIME))
          ), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(courseSchedules)
        .where(
          and(
            inArray(courseSchedules.subjectAssignmentId, assignmentIds),
            eq(courseSchedules.academicYearId, academicYearId)
          )
        )
    }

    const [result] = await query
    const professor = await db.query.users.findFirst({
      where: eq(users.id, professorId),
      columns: { maxWeeklyHours: true },
    })

    const maxHours = professor?.maxWeeklyHours || 20
    const assignedHours = result?.totalHours || 0

    return {
      success: true,
      data: {
        assignedHours,
        maxHours,
        remainingHours: Math.max(0, maxHours - assignedHours),
        assignmentCount: result?.count || 0,
      },
    }
  } catch (error) {
    console.error("Failed to calculate professor weekly hours:", error)
    return {
      success: false,
      error: "Failed to calculate professor weekly hours",
    }
  }
}

// ============================================================================
// AVAILABILITY VALIDATION
// ============================================================================

export async function checkProfessorAvailability(
  professorId: string,
  proposedSlot: {
    dayOfWeek: DayOfWeek
    startTime: string
    endTime: string
  }
): Promise<{
  success: boolean
  available: boolean
  conflicts?: string[]
  withinPreferredHours?: boolean
}> {
  try {
    const availabilityResult = await getProfessorAvailability(professorId)

    if (!availabilityResult.success || !availabilityResult.data) {
      return {
        success: false,
        available: false,
        conflicts: ["Could not fetch professor availability"],
      }
    }

    const { availability, preferredTimeSlots } = availabilityResult.data

    // If no availability set, assume available all the time
    if (!availability || availability.length === 0) {
      return { success: true, available: true, withinPreferredHours: true }
    }

    // Check if the proposed slot is within availability
    const dayAvailability = availability.filter(
      (slot) => slot.dayOfWeek === proposedSlot.dayOfWeek
    )

    if (dayAvailability.length === 0) {
      return {
        success: true,
        available: false,
        conflicts: [`Professor not available on ${proposedSlot.dayOfWeek}`],
      }
    }

    const isWithinAvailability = dayAvailability.some(
      (slot) =>
        proposedSlot.startTime >= slot.startTime &&
        proposedSlot.endTime <= slot.endTime
    )

    if (!isWithinAvailability) {
      return {
        success: true,
        available: false,
        conflicts: [
          `Proposed time ${proposedSlot.startTime}-${proposedSlot.endTime} is outside availability on ${proposedSlot.dayOfWeek}`,
        ],
      }
    }

    // Check if within preferred time slots
    const dayPreferences =
      preferredTimeSlots?.filter(
        (slot) => slot.dayOfWeek === proposedSlot.dayOfWeek
      ) || []

    const withinPreferredHours =
      dayPreferences.length === 0 ||
      dayPreferences.some(
        (slot) =>
          proposedSlot.startTime >= slot.startTime &&
          proposedSlot.endTime <= slot.endTime
      )

    return {
      success: true,
      available: true,
      withinPreferredHours,
    }
  } catch (error) {
    console.error("Failed to check professor availability:", error)
    return {
      success: false,
      available: false,
      conflicts: ["Error checking availability"],
    }
  }
}
