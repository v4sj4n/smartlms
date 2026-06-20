import type { DayOfWeek } from "@/lib/actions/schedules"

// ============================================================================
// SCHEDULE TYPES
// ============================================================================

export type TimeSlot = {
  dayOfWeek: DayOfWeek
  startTime: string // "HH:MM" (24h)
  endTime: string // "HH:MM" (24h)
}

export type ScheduleEntry = {
  id?: string
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  room: string
  courseId: string
  groupId: string
  subjectAssignmentId: string
  academicYearId: string
}

export type SubjectAssignmentRequest = {
  assignmentId: string
  professorId: string
  courseId: string
  groupId: string
  requiredHours: number
  availableSlots: TimeSlot[]
  maxWeeklyHours?: number
  preferredTimeSlots?: Array<TimeSlot & { priority?: number }>
  sessionType?: "lecture" | "seminar"
}

export type Room = {
  id: string
  name: string
  building?: string
  capacity?: number
}

// ============================================================================
// CONFLICT TYPES
// ============================================================================

export type ConflictType =
  | "PROFESSOR_OVERLAP"
  | "ROOM_OVERLAP"
  | "GROUP_OVERLAP"
  | "PROFESSOR_HOURS_EXCEEDED"
  | "HOUR_SHORTAGE"
  | "HOUR_OVER_ALLOCATION"
  | "INVALID_TIME_SLOT"
  | "GROUP_DAILY_OVERLOAD"

export type ScheduleConflict =
  | {
      type: "PROFESSOR_OVERLAP"
      professorId: string
      entries: string[] // IDs of conflicting schedule entries
      description: string
    }
  | {
      type: "ROOM_OVERLAP"
      room: string
      entries: string[]
      description: string
    }
  | {
      type: "GROUP_OVERLAP"
      groupId: string
      entries: string[]
      description: string
    }
  | {
      type: "PROFESSOR_HOURS_EXCEEDED"
      professorId: string
      assigned: number
      max: number
      description: string
    }
  | {
      type: "HOUR_SHORTAGE"
      assignmentId: string
      required: number
      assigned: number
      description: string
    }
  | {
      type: "HOUR_OVER_ALLOCATION"
      assignmentId: string
      required: number
      assigned: number
      description: string
    }
  | {
      type: "INVALID_TIME_SLOT"
      assignmentId: string
      slot: TimeSlot
      description: string
    }
  | {
      type: "GROUP_DAILY_OVERLOAD"
      groupId: string
      dayOfWeek: string
      hours: number
      description: string
    }

// ============================================================================
// GENERATION TYPES
// ============================================================================

export type GenerationMode = "random" | "optimized" | "balanced"

export type GenerationConstraints = {
  academicYearId: string
  mode: GenerationMode
  assignments: SubjectAssignmentRequest[]
  rooms: Room[]
  timeSlots: TimeSlot[]
  maxIterations?: number
}

export type GenerationResult = {
  success: boolean
  schedule: ScheduleEntry[]
  conflicts: ScheduleConflict[]
  stats: GenerationStats
  error?: string
}

export type GenerationStats = {
  totalAssignments: number
  scheduledAssignments: number
  totalSlots: number
  iterations: number
  durationMs: number
  constraintViolations: number
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export type ValidationResult = {
  valid: boolean
  conflicts: ScheduleConflict[]
  summary: ValidationSummary
}

export type ValidationSummary = {
  totalEntries: number
  professorConflicts: number
  roomConflicts: number
  groupConflicts: number
  hourIssues: number
  professorsUsed: number
  roomsUsed: number
  groupsUsed: number
}

// ============================================================================
// OPTIMIZATION TYPES
// ============================================================================

export type OptimizationWeights = {
  gapPenalty: number // Penalty for gaps in schedule (higher = avoid gaps)
  evenDistribution: number // Weight for even distribution across week
  preferredTimeBonus: number // Bonus for using professor's preferred times
  lateClassPenalty: number // Penalty for late classes (after 17:00)
}

export const DEFAULT_OPTIMIZATION_WEIGHTS: OptimizationWeights = {
  gapPenalty: 2.0,
  evenDistribution: 1.5,
  preferredTimeBonus: 1.0,
  lateClassPenalty: 1.5,
}

export type ScheduleScore = {
  totalScore: number
  gapScore: number
  distributionScore: number
  preferenceScore: number
  lateClassScore: number
}
