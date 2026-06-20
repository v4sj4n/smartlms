import type {
  ScheduleEntry,
  SubjectAssignmentRequest,
  TimeSlot,
  Room,
  GenerationResult,
  GenerationStats,
  GenerationMode,
} from "./types"
import { DEFAULT_OPTIMIZATION_WEIGHTS } from "./types"
import {
  scoreGroupPlacement,
  getGroupDayHours,
  createEmptyGroupDayHours,
  type GroupDayHours,
} from "./equilibrium"

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_MAX_ITERATIONS = 10000
const SLOT_DURATION_MINUTES = 120

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

export async function generateSchedule(params: {
  academicYearId: string
  mode: GenerationMode
  assignments: SubjectAssignmentRequest[]
  rooms: Room[]
  timeSlots: TimeSlot[]
  maxIterations?: number
}): Promise<GenerationResult> {
  const startTime = Date.now()

  try {
    const { academicYearId, mode, assignments, rooms, timeSlots } = params
    const maxIterations = params.maxIterations || DEFAULT_MAX_ITERATIONS

    if (assignments.length === 0) {
      return {
        success: true,
        schedule: [],
        conflicts: [],
        stats: {
          totalAssignments: 0,
          scheduledAssignments: 0,
          totalSlots: 0,
          iterations: 0,
          durationMs: 0,
          constraintViolations: 0,
        },
      }
    }

    if (rooms.length === 0) {
      return {
        success: false,
        schedule: [],
        conflicts: [],
        stats: {
          totalAssignments: 0,
          scheduledAssignments: 0,
          totalSlots: 0,
          iterations: 0,
          durationMs: 0,
          constraintViolations: 0,
        },
        error: "No rooms available for scheduling",
      }
    }

    if (timeSlots.length === 0) {
      return {
        success: false,
        schedule: [],
        conflicts: [],
        stats: {
          totalAssignments: 0,
          scheduledAssignments: 0,
          totalSlots: 0,
          iterations: 0,
          durationMs: 0,
          constraintViolations: 0,
        },
        error: "No time slots available for scheduling",
      }
    }

    // Sort assignments by most constrained first (MRV heuristic)
    const sortedAssignments = [...assignments].sort((a, b) => {
      // Prioritize assignments with fewer available slots
      const aSlots = a.availableSlots.length
      const bSlots = b.availableSlots.length
      if (aSlots !== bSlots) return aSlots - bSlots

      // Then by required hours (more hours = more constrained)
      return b.requiredHours - a.requiredHours
    })

    // Generate schedule using backtracking
    const result = backtrackSchedule(
      sortedAssignments,
      rooms,
      timeSlots,
      academicYearId,
      mode,
      maxIterations
    )

    const duration = Date.now() - startTime

    return {
      ...result,
      stats: {
        ...result.stats,
        durationMs: duration,
      },
    }
  } catch (error) {
    console.error("Schedule generation failed:", error)
    return {
      success: false,
      schedule: [],
      conflicts: [],
      stats: {} as GenerationStats,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error during generation",
    }
  }
}

// ============================================================================
// BACKTRACKING CSP SOLVER
// ============================================================================

type ScheduleState = {
  entries: ScheduleEntry[]
  professorHours: Map<string, number>
  groupDayHours: GroupDayHours
  usedSlots: Set<string>
  iterationCount: number
}

function backtrackSchedule(
  assignments: SubjectAssignmentRequest[],
  rooms: Room[],
  timeSlots: TimeSlot[],
  academicYearId: string,
  mode: GenerationMode,
  maxIterations: number
): GenerationResult {
  const initialState: ScheduleState = {
    entries: [],
    professorHours: new Map(),
    groupDayHours: createEmptyGroupDayHours(),
    usedSlots: new Set(),
    iterationCount: 0,
  }

  const result = backtrack(
    assignments,
    0,
    initialState,
    rooms,
    timeSlots,
    academicYearId,
    mode,
    maxIterations
  )

  return result
}

function backtrack(
  assignments: SubjectAssignmentRequest[],
  index: number,
  state: ScheduleState,
  rooms: Room[],
  timeSlots: TimeSlot[],
  academicYearId: string,
  mode: GenerationMode,
  maxIterations: number
): GenerationResult {
  // Base case: all assignments processed
  if (index >= assignments.length) {
    return {
      success: true,
      schedule: state.entries,
      conflicts: [],
      stats: {
        totalAssignments: assignments.length,
        scheduledAssignments: state.entries.length,
        totalSlots: state.entries.length,
        iterations: state.iterationCount,
        durationMs: 0,
        constraintViolations: 0,
      },
    }
  }

  // Check iteration limit
  if (state.iterationCount >= maxIterations) {
    return {
      success: false,
      schedule: state.entries,
      conflicts: [],
      stats: {
        totalAssignments: assignments.length,
        scheduledAssignments: state.entries.length,
        totalSlots: state.entries.length,
        iterations: state.iterationCount,
        durationMs: 0,
        constraintViolations: 0,
      },
      error: "Maximum iterations reached",
    }
  }

  const assignment = assignments[index]
  const requiredSlots = Math.ceil(
    (assignment.requiredHours * 60) / SLOT_DURATION_MINUTES
  )

  // Generate all possible valid slots for this assignment
  const validSlots = generateValidSlots(
    assignment,
    rooms,
    timeSlots,
    state,
    requiredSlots,
    mode
  )

  if (validSlots.length === 0) {
    // No valid slots for this assignment - backtrack or skip
    return {
      success: false,
      schedule: state.entries,
      conflicts: [
        {
          type: "HOUR_SHORTAGE",
          assignmentId: assignment.assignmentId,
          required: assignment.requiredHours,
          assigned: 0,
          description: `No valid time slots found for assignment ${assignment.assignmentId}`,
        },
      ],
      stats: {
        totalAssignments: assignments.length,
        scheduledAssignments: state.entries.length,
        totalSlots: state.entries.length,
        iterations: state.iterationCount,
        durationMs: 0,
        constraintViolations: 1,
      },
      error: `Could not schedule assignment ${assignment.assignmentId}`,
    }
  }

  // Try each valid slot
  for (const slot of validSlots) {
    state.iterationCount++

    // Create schedule entries for this slot
    const newEntries: ScheduleEntry[] = slot.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room,
      courseId: assignment.courseId,
      groupId: assignment.groupId,
      subjectAssignmentId: assignment.assignmentId,
      academicYearId,
    }))

    // Update state
    const newState: ScheduleState = {
      entries: [...state.entries, ...newEntries],
      professorHours: new Map(state.professorHours),
      groupDayHours: new Map(
        [...state.groupDayHours.entries()].map(([gid, days]) => [
          gid,
          new Map(days),
        ])
      ),
      usedSlots: new Set(state.usedSlots),
      iterationCount: state.iterationCount,
    }

    // Update professor hours
    const addedHours = newEntries.reduce(
      (sum, e) => sum + calculateDuration(e.startTime, e.endTime),
      0
    )
    const professorCurrent =
      newState.professorHours.get(assignment.professorId) || 0
    const maxHours = assignment.maxWeeklyHours ?? 40

    if (professorCurrent + addedHours > maxHours) {
      continue
    }

    newState.professorHours.set(
      assignment.professorId,
      professorCurrent + addedHours
    )

    const groupHours = getGroupDayHours(
      newState.groupDayHours,
      assignment.groupId
    )
    for (const entry of newEntries) {
      groupHours.set(
        entry.dayOfWeek,
        (groupHours.get(entry.dayOfWeek) ?? 0) +
          calculateDuration(entry.startTime, entry.endTime)
      )
    }

    // Mark slots as used
    for (const entry of newEntries) {
      newState.usedSlots.add(
        createSlotKey(
          entry.dayOfWeek,
          entry.startTime,
          entry.endTime,
          entry.room
        )
      )
      newState.usedSlots.add(
        createProfessorSlotKey(
          entry.dayOfWeek,
          entry.startTime,
          entry.endTime,
          assignment.professorId
        )
      )
      newState.usedSlots.add(
        createGroupSlotKey(
          entry.dayOfWeek,
          entry.startTime,
          entry.endTime,
          entry.groupId
        )
      )
    }

    // Recurse
    const result = backtrack(
      assignments,
      index + 1,
      newState,
      rooms,
      timeSlots,
      academicYearId,
      mode,
      maxIterations
    )

    if (result.success) {
      return result
    }
  }

  // No valid slot worked - failure
  return {
    success: false,
    schedule: state.entries,
    conflicts: [
      {
        type: "HOUR_SHORTAGE",
        assignmentId: assignment.assignmentId,
        required: assignment.requiredHours,
        assigned: 0,
        description: `Could not find valid schedule for assignment ${assignment.assignmentId}`,
      },
    ],
    stats: {
      totalAssignments: assignments.length,
      scheduledAssignments: state.entries.length,
      totalSlots: state.entries.length,
      iterations: state.iterationCount,
      durationMs: 0,
      constraintViolations: 1,
    },
    error: `Failed to schedule assignment ${assignment.assignmentId}`,
  }
}

// ============================================================================
// SLOT GENERATION
// ============================================================================

function generateValidSlots(
  assignment: SubjectAssignmentRequest,
  rooms: Room[],
  timeSlots: TimeSlot[],
  state: ScheduleState,
  requiredSlots: number,
  mode: GenerationMode
): Array<Array<TimeSlot & { room: string }>> {
  const validSlotCombinations: Array<Array<TimeSlot & { room: string }>> = []

  // Get available slots that match professor availability
  const availableSlots =
    assignment.availableSlots.length > 0 ? assignment.availableSlots : timeSlots

  // Generate all possible combinations
  const roomTimeCombinations: Array<TimeSlot & { room: string }> = []

  for (const slot of availableSlots) {
    for (const room of rooms) {
      roomTimeCombinations.push({
        ...slot,
        room: room.name,
      })
    }
  }

  // Filter out used slots
  const freeSlots = roomTimeCombinations.filter(
    (slot) =>
      !state.usedSlots.has(
        createSlotKey(slot.dayOfWeek, slot.startTime, slot.endTime, slot.room)
      ) &&
      !state.usedSlots.has(
        createProfessorSlotKey(
          slot.dayOfWeek,
          slot.startTime,
          slot.endTime,
          assignment.professorId
        )
      ) &&
      !state.usedSlots.has(
        createGroupSlotKey(
          slot.dayOfWeek,
          slot.startTime,
          slot.endTime,
          assignment.groupId
        )
      )
  )

  if (freeSlots.length < requiredSlots) {
    return []
  }

  // For simple cases, just pick the first N non-overlapping slots
  if (requiredSlots === 1) {
    for (const slot of freeSlots) {
      validSlotCombinations.push([slot])
    }
  } else {
    // For multiple slots, try combinations that don't overlap
    const combinations = findNonOverlappingCombinations(
      freeSlots,
      requiredSlots
    )
    validSlotCombinations.push(...combinations)
  }

  // Sort by optimization score if in optimized or balanced mode
  if (
    (mode === "optimized" || mode === "balanced") &&
    validSlotCombinations.length > 1
  ) {
    validSlotCombinations.sort((a, b) => {
      const scoreA = scoreSlotCombination(a, assignment, state, mode)
      const scoreB = scoreSlotCombination(b, assignment, state, mode)
      return scoreB - scoreA // Higher score first
    })
  }

  return validSlotCombinations
}

function findNonOverlappingCombinations(
  slots: Array<TimeSlot & { room: string }>,
  count: number
): Array<Array<TimeSlot & { room: string }>> {
  const combinations: Array<Array<TimeSlot & { room: string }>> = []

  function backtrackCombo(
    start: number,
    current: Array<TimeSlot & { room: string }>
  ) {
    if (current.length === count) {
      combinations.push([...current])
      return
    }

    for (let i = start; i < slots.length; i++) {
      const slot = slots[i]

      // Check if this slot overlaps with any in current
      const overlaps = current.some(
        (s) =>
          s.dayOfWeek === slot.dayOfWeek &&
          timeRangesOverlap(
            s.startTime,
            s.endTime,
            slot.startTime,
            slot.endTime
          )
      )

      if (!overlaps) {
        current.push(slot)
        backtrackCombo(i + 1, current)
        current.pop()
      }
    }
  }

  backtrackCombo(0, [])
  return combinations.slice(0, 10) // Limit combinations
}

// ============================================================================
// SCORING (for optimization)
// ============================================================================

function scoreSlotCombination(
  slots: Array<TimeSlot & { room: string }>,
  assignment: SubjectAssignmentRequest,
  state: ScheduleState,
  mode: GenerationMode
): number {
  const weights = DEFAULT_OPTIMIZATION_WEIGHTS
  let score = 100

  const dayCounts = new Map<string, number>()
  for (const slot of slots) {
    dayCounts.set(slot.dayOfWeek, (dayCounts.get(slot.dayOfWeek) || 0) + 1)
  }
  const uniqueDays = dayCounts.size
  score += uniqueDays * weights.evenDistribution * 10

  for (const slot of slots) {
    if (slot.startTime >= "17:00") {
      score -= weights.lateClassPenalty * 5
    }

    if (mode === "balanced") {
      const groupHours = getGroupDayHours(
        state.groupDayHours,
        assignment.groupId
      )
      const hours = calculateDuration(slot.startTime, slot.endTime)
      const placementScore = scoreGroupPlacement(
        groupHours,
        slot.dayOfWeek,
        hours
      )
      score -= placementScore * 5
    }
  }

  return Math.max(0, score)
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function createSlotKey(
  day: string,
  start: string,
  end: string,
  room: string
): string {
  return `${day}-${start}-${end}-${room}`
}

function createProfessorSlotKey(
  day: string,
  start: string,
  end: string,
  professorId: string
): string {
  return `prof-${day}-${start}-${end}-${professorId}`
}

function createGroupSlotKey(
  day: string,
  start: string,
  end: string,
  groupId: string
): string {
  return `group-${day}-${start}-${end}-${groupId}`
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
