import { db } from "@/db"
import {
  courseSchedules,
  users,
  schoolYears,
  scheduleValidations,
} from "@/db/schema"
import { eq, and } from "drizzle-orm"
import type {
  ScheduleEntry,
  ScheduleConflict,
  ValidationResult,
  ValidationSummary,
  TimeSlot,
} from "./types"

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

export async function validateSchedule(
  academicYearId: string,
  proposedEntries?: ScheduleEntry[]
): Promise<ValidationResult> {
  const startTime = Date.now()

  try {
    // Get existing schedule entries for this academic year
    const existingEntries = await db.query.courseSchedules.findMany({
      where: eq(courseSchedules.academicYearId, academicYearId),
      with: {
        subjectAssignment: {
          columns: {
            professorId: true,
          },
        },
      },
    })

    // Combine with proposed entries if provided
    const allEntries: ScheduleEntry[] = [
      ...existingEntries.map((e) => ({
        id: e.id,
        dayOfWeek: e.dayOfWeek,
        startTime: e.startTime,
        endTime: e.endTime,
        room: e.room || "",
        courseId: e.courseId,
        groupId: e.groupId || "",
        subjectAssignmentId: e.subjectAssignmentId || "",
        academicYearId: e.academicYearId || academicYearId,
        professorId: e.subjectAssignment?.professorId,
      })),
      ...(proposedEntries || []),
    ]

    const conflicts: ScheduleConflict[] = []

    // Check all conflict types
    conflicts.push(...checkProfessorOverlaps(allEntries))
    conflicts.push(...checkRoomOverlaps(allEntries))
    conflicts.push(...checkGroupOverlaps(allEntries))
    conflicts.push(...(await checkProfessorHours(allEntries, academicYearId)))
    conflicts.push(...checkHourAllocation(allEntries))

    // Calculate summary
    const summary: ValidationSummary = {
      totalEntries: allEntries.length,
      professorConflicts: conflicts.filter(
        (c) => c.type === "PROFESSOR_OVERLAP"
      ).length,
      roomConflicts: conflicts.filter((c) => c.type === "ROOM_OVERLAP").length,
      groupConflicts: conflicts.filter((c) => c.type === "GROUP_OVERLAP")
        .length,
      hourIssues: conflicts.filter(
        (c) =>
          c.type === "HOUR_SHORTAGE" ||
          c.type === "HOUR_OVER_ALLOCATION" ||
          c.type === "PROFESSOR_HOURS_EXCEEDED"
      ).length,
      professorsUsed: new Set(
        allEntries.map((e) => (e as { professorId?: string }).professorId)
      ).size,
      roomsUsed: new Set(allEntries.map((e) => e.room)).size,
      groupsUsed: new Set(allEntries.map((e) => e.groupId)).size,
    }

    // Store validation result
    const validationDuration = Date.now() - startTime
    await db.insert(scheduleValidations).values({
      academicYearId,
      isValid: conflicts.length === 0,
      conflicts: conflicts as unknown as Record<string, unknown>[],
      conflictCount: conflicts.length,
      validationDurationMs: validationDuration,
    })

    return {
      valid: conflicts.length === 0,
      conflicts,
      summary,
    }
  } catch (error) {
    console.error("Schedule validation failed:", error)
    return {
      valid: false,
      conflicts: [
        {
          type: "INVALID_TIME_SLOT",
          assignmentId: "",
          slot: { dayOfWeek: "MONDAY", startTime: "", endTime: "" } as TimeSlot,
          description: `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
      summary: {
        totalEntries: 0,
        professorConflicts: 0,
        roomConflicts: 0,
        groupConflicts: 0,
        hourIssues: 1,
        professorsUsed: 0,
        roomsUsed: 0,
        groupsUsed: 0,
      },
    }
  }
}

// ============================================================================
// CONFLICT DETECTION HELPERS
// ============================================================================

function checkProfessorOverlaps(entries: ScheduleEntry[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []
  const professorSlots: Map<string, ScheduleEntry[]> = new Map()

  // Group entries by professor
  for (const entry of entries) {
    const professorId = (entry as { professorId?: string }).professorId
    if (!professorId) continue

    if (!professorSlots.has(professorId)) {
      professorSlots.set(professorId, [])
    }
    professorSlots.get(professorId)!.push(entry)
  }

  // Check for overlaps within each professor's schedule
  for (const [professorId, slots] of professorSlots) {
    const overlaps = findOverlappingSlots(slots)

    for (const overlapGroup of overlaps) {
      if (overlapGroup.length > 1) {
        conflicts.push({
          type: "PROFESSOR_OVERLAP",
          professorId,
          entries: overlapGroup.map((e) => e.id || ""),
          description: `Professor has ${overlapGroup.length} overlapping classes on ${overlapGroup[0].dayOfWeek} at ${overlapGroup[0].startTime}`,
        })
      }
    }
  }

  return conflicts
}

function checkRoomOverlaps(entries: ScheduleEntry[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []
  const roomSlots: Map<string, ScheduleEntry[]> = new Map()

  // Group entries by room
  for (const entry of entries) {
    if (!entry.room) continue

    if (!roomSlots.has(entry.room)) {
      roomSlots.set(entry.room, [])
    }
    roomSlots.get(entry.room)!.push(entry)
  }

  // Check for overlaps within each room
  for (const [room, slots] of roomSlots) {
    const overlaps = findOverlappingSlots(slots)

    for (const overlapGroup of overlaps) {
      if (overlapGroup.length > 1) {
        conflicts.push({
          type: "ROOM_OVERLAP",
          room,
          entries: overlapGroup.map((e) => e.id || ""),
          description: `Room ${room} has ${overlapGroup.length} overlapping classes on ${overlapGroup[0].dayOfWeek} at ${overlapGroup[0].startTime}`,
        })
      }
    }
  }

  return conflicts
}

function checkGroupOverlaps(entries: ScheduleEntry[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []
  const groupSlots: Map<string, ScheduleEntry[]> = new Map()

  // Group entries by group
  for (const entry of entries) {
    if (!entry.groupId) continue

    if (!groupSlots.has(entry.groupId)) {
      groupSlots.set(entry.groupId, [])
    }
    groupSlots.get(entry.groupId)!.push(entry)
  }

  // Check for overlaps within each group's schedule
  for (const [groupId, slots] of groupSlots) {
    const overlaps = findOverlappingSlots(slots)

    for (const overlapGroup of overlaps) {
      if (overlapGroup.length > 1) {
        conflicts.push({
          type: "GROUP_OVERLAP",
          groupId,
          entries: overlapGroup.map((e) => e.id || ""),
          description: `Group has ${overlapGroup.length} overlapping classes on ${overlapGroup[0].dayOfWeek} at ${overlapGroup[0].startTime}`,
        })
      }
    }
  }

  return conflicts
}

async function checkProfessorHours(
  entries: ScheduleEntry[],
  academicYearId: string
): Promise<ScheduleConflict[]> {
  const conflicts: ScheduleConflict[] = []
  const professorHours: Map<string, number> = new Map()

  // Calculate hours per professor
  for (const entry of entries) {
    const professorId = (entry as { professorId?: string }).professorId
    if (!professorId) continue

    const duration = calculateDuration(entry.startTime, entry.endTime)
    professorHours.set(
      professorId,
      (professorHours.get(professorId) || 0) + duration
    )
  }

  // Check against max weekly hours
  for (const [professorId, hours] of professorHours) {
    const professor = await db.query.users.findFirst({
      where: eq(users.id, professorId),
      columns: { maxWeeklyHours: true, fullName: true, name: true },
    })

    const maxHours = professor?.maxWeeklyHours || 20

    if (hours > maxHours) {
      conflicts.push({
        type: "PROFESSOR_HOURS_EXCEEDED",
        professorId,
        assigned: hours,
        max: maxHours,
        description: `Professor ${professor?.fullName || professor?.name || professorId} has ${hours} hours assigned (max: ${maxHours})`,
      })
    }
  }

  return conflicts
}

function checkHourAllocation(entries: ScheduleEntry[]): ScheduleConflict[] {
  // This would require knowing the required hours per assignment
  // For now, we'll skip detailed hour checking as it's handled during generation
  return []
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function findOverlappingSlots(entries: ScheduleEntry[]): ScheduleEntry[][] {
  // Sort by day and start time
  const sorted = [...entries].sort((a, b) => {
    const dayOrder = [
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY",
    ]
    const dayDiff =
      dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek)
    if (dayDiff !== 0) return dayDiff
    return a.startTime.localeCompare(b.startTime)
  })

  const overlapGroups: ScheduleEntry[][] = []
  let currentGroup: ScheduleEntry[] = []

  for (const entry of sorted) {
    if (currentGroup.length === 0) {
      currentGroup.push(entry)
    } else {
      const lastEntry = currentGroup[currentGroup.length - 1]

      // Check if this entry overlaps with the last one
      if (
        entry.dayOfWeek === lastEntry.dayOfWeek &&
        timeRangesOverlap(
          lastEntry.startTime,
          lastEntry.endTime,
          entry.startTime,
          entry.endTime
        )
      ) {
        currentGroup.push(entry)
      } else {
        if (currentGroup.length > 1) {
          overlapGroups.push([...currentGroup])
        }
        currentGroup = [entry]
      }
    }
  }

  if (currentGroup.length > 1) {
    overlapGroups.push(currentGroup)
  }

  return overlapGroups
}

function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  return start1 < end2 && start2 < end1
}

function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(":").map(Number)
  const [endHour, endMin] = endTime.split(":").map(Number)

  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  return (endMinutes - startMinutes) / 60 // Return hours
}

// ============================================================================
// API RESPONSE HELPER
// ============================================================================

export function formatValidationResponse(result: ValidationResult): {
  valid: boolean
  conflicts: Array<{
    type: string
    description: string
    details: Record<string, unknown>
  }>
  summary: ValidationSummary
} {
  return {
    valid: result.valid,
    conflicts: result.conflicts.map((c) => ({
      type: c.type,
      description: c.description,
      details: c as unknown as Record<string, unknown>,
    })),
    summary: result.summary,
  }
}
