import type { DayOfWeek } from "@/lib/actions/schedules"

export const SLOT_DURATION_HOURS = 2
export const MAX_DAILY_HOURS_PER_GROUP = 6

const WEEKDAYS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
]

export type GroupDayHours = Map<string, Map<DayOfWeek, number>>

export function createEmptyGroupDayHours(): GroupDayHours {
  return new Map()
}

export function getGroupDayHours(
  state: GroupDayHours,
  groupId: string
): Map<DayOfWeek, number> {
  if (!state.has(groupId)) {
    state.set(groupId, new Map())
  }
  return state.get(groupId)!
}

export function varianceOfDayHours(dayHours: Map<DayOfWeek, number>): number {
  const values = WEEKDAYS.map((d) => dayHours.get(d) ?? 0)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
}

export function isCatastrophic(dayHours: Map<DayOfWeek, number>): boolean {
  for (const day of WEEKDAYS) {
    const hours = dayHours.get(day) ?? 0
    if (hours > MAX_DAILY_HOURS_PER_GROUP) {
      return true
    }
  }
  return false
}

export function scoreGroupPlacement(
  groupDayHours: Map<DayOfWeek, number>,
  day: DayOfWeek,
  hoursToAdd: number,
  preferredBonus = 0
): number {
  const before = varianceOfDayHours(groupDayHours)
  const afterMap = new Map(groupDayHours)
  afterMap.set(day, (afterMap.get(day) ?? 0) + hoursToAdd)
  const after = varianceOfDayHours(afterMap)

  const dayOverloadPenalty = Math.max(
    0,
    (afterMap.get(day) ?? 0) - MAX_DAILY_HOURS_PER_GROUP
  )

  const zeroDays = WEEKDAYS.filter((d) => (afterMap.get(d) ?? 0) === 0).length
  const offDayBonus = zeroDays === 1 ? 0.5 : 0

  return after - before + dayOverloadPenalty * 10 - preferredBonus - offDayBonus
}

export function computeGroupBalanceMetrics(
  entries: Array<{
    groupId: string
    dayOfWeek: DayOfWeek
    startTime: string
    endTime: string
  }>
): Record<string, Record<DayOfWeek, number>> {
  const metrics: Record<string, Record<DayOfWeek, number>> = {}

  for (const entry of entries) {
    if (!metrics[entry.groupId]) {
      metrics[entry.groupId] = Object.fromEntries(
        WEEKDAYS.map((d) => [d, 0])
      ) as Record<DayOfWeek, number>
    }
    const duration = calculateDurationHours(entry.startTime, entry.endTime)
    metrics[entry.groupId][entry.dayOfWeek] += duration
  }

  return metrics
}

export function calculateDurationHours(
  startTime: string,
  endTime: string
): number {
  const [startHour, startMin] = startTime.split(":").map(Number)
  const [endHour, endMin] = endTime.split(":").map(Number)
  return (endHour * 60 + endMin - (startHour * 60 + startMin)) / 60
}

export function slotContainedInAvailability(
  slotStart: string,
  slotEnd: string,
  availStart: string,
  availEnd: string
): boolean {
  return slotStart >= availStart && slotEnd <= availEnd
}

export function buildDefaultTwoHourGrid(): Array<{
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
}> {
  const blocks = [
    { startTime: "09:00", endTime: "11:00" },
    { startTime: "11:15", endTime: "13:15" },
    { startTime: "14:00", endTime: "16:00" },
    { startTime: "16:15", endTime: "18:15" },
  ]

  return WEEKDAYS.flatMap((dayOfWeek) =>
    blocks.map((b) => ({ dayOfWeek, ...b }))
  )
}
