"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, MapPin, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DayOfWeek } from "@/lib/actions/schedules"

// ============================================================================
// TYPES
// ============================================================================

type ScheduleEntry = {
  id: string
  dayOfWeek: DayOfWeek
  startTime: string // "HH:MM"
  endTime: string // "HH:MM"
  room?: string | null
  course?: {
    id: string
    title: string
  }
  group?: {
    id: string
    name: string
  } | null
  subjectAssignment?: {
    professor?: {
      id: string
      fullName?: string | null
      name?: string | null
    } | null
  } | null
}

interface TimetableCalendarProps {
  entries: ScheduleEntry[]
  title?: string
  className?: string
  viewMode?: "admin" | "professor" | "student"
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DAYS_OF_WEEK: { value: DayOfWeek; label: string; short: string }[] = [
  { value: "MONDAY", label: "Monday", short: "Mon" },
  { value: "TUESDAY", label: "Tuesday", short: "Tue" },
  { value: "WEDNESDAY", label: "Wednesday", short: "Wed" },
  { value: "THURSDAY", label: "Thursday", short: "Thu" },
  { value: "FRIDAY", label: "Friday", short: "Fri" },
  { value: "SATURDAY", label: "Saturday", short: "Sat" },
  { value: "SUNDAY", label: "Sunday", short: "Sun" },
]

const TIME_SLOTS = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number)
  return hours * 60 + minutes
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":")
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

function getEntryPosition(startTime: string, endTime: string) {
  const start = parseTime(startTime)
  const end = parseTime(endTime)
  const firstSlot = parseTime(TIME_SLOTS[0])

  const slotHeight = 48 // pixels per 30-min slot
  const pixelsPerMinute = slotHeight / 30

  const top = (start - firstSlot) * pixelsPerMinute
  const height = (end - start) * pixelsPerMinute

  return { top, height }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TimetableCalendar({
  entries,
  title = "Timetable",
  className,
  viewMode = "admin",
}: TimetableCalendarProps) {
  // Group entries by day
  const entriesByDay = React.useMemo(() => {
    const grouped = new Map<DayOfWeek, ScheduleEntry[]>()

    for (const day of DAYS_OF_WEEK) {
      grouped.set(day.value, [])
    }

    for (const entry of entries) {
      const dayEntries = grouped.get(entry.dayOfWeek) || []
      dayEntries.push(entry)
      grouped.set(entry.dayOfWeek, dayEntries)
    }

    // Sort each day's entries by start time
    for (const [day, dayEntries] of grouped) {
      grouped.set(
        day,
        dayEntries.sort(
          (a, b) => parseTime(a.startTime) - parseTime(b.startTime)
        )
      )
    }

    return grouped
  }, [entries])

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="border-b bg-muted/50 px-4 py-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <div className="min-w-[800px]">
            {/* Header - Days of week */}
            <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b">
              <div className="border-r bg-muted/30 p-2 text-xs font-medium text-muted-foreground">
                Time
              </div>
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day.value}
                  className="border-r bg-muted/30 p-2 text-center text-xs font-medium"
                >
                  <div className="hidden sm:block">{day.label}</div>
                  <div className="sm:hidden">{day.short}</div>
                </div>
              ))}
            </div>

            {/* Time grid */}
            <div className="relative grid grid-cols-[80px_repeat(7,1fr)]">
              {/* Time labels */}
              <div className="border-r bg-muted/10">
                {TIME_SLOTS.map((time) => (
                  <div
                    key={time}
                    className="flex h-12 items-start justify-end border-b border-dashed border-border/50 px-2 pt-1"
                  >
                    <span className="text-xs text-muted-foreground">
                      {formatTime(time)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day.value}
                  className="relative border-r border-dashed border-border/50"
                >
                  {/* Time slot grid lines */}
                  {TIME_SLOTS.map((_, index) => (
                    <div
                      key={index}
                      className="h-12 border-b border-dashed border-border/30"
                    />
                  ))}

                  {/* Schedule entries */}
                  {entriesByDay.get(day.value)?.map((entry) => {
                    const { top, height } = getEntryPosition(
                      entry.startTime,
                      entry.endTime
                    )

                    return (
                      <div
                        key={entry.id}
                        className="absolute right-1 left-1 overflow-hidden rounded-md border bg-primary/10 p-1.5 text-xs shadow-sm transition-all hover:bg-primary/20 hover:shadow-md"
                        style={{
                          top: `${top}px`,
                          height: `${height - 2}px`,
                        }}
                      >
                        <div className="leading-tight font-medium text-primary">
                          {entry.course?.title || "Unknown Course"}
                        </div>

                        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTime(entry.startTime)} -{" "}
                          {formatTime(entry.endTime)}
                        </div>

                        {viewMode === "admin" && (
                          <>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {entry.subjectAssignment?.professor?.fullName ||
                                entry.subjectAssignment?.professor?.name ||
                                "No professor"}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {entry.group?.name || "No group"} •{" "}
                              {entry.room || "TBA"}
                            </div>
                          </>
                        )}

                        {viewMode === "professor" && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {entry.group?.name || "No group"} •{" "}
                            {entry.room || "TBA"}
                          </div>
                        )}

                        {viewMode === "student" && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {entry.subjectAssignment?.professor?.fullName ||
                              entry.subjectAssignment?.professor?.name ||
                              "No professor"}
                            {entry.room && ` • ${entry.room}`}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// COMPACT VIEW (for dashboards)
// ============================================================================

interface CompactScheduleViewProps {
  entries: ScheduleEntry[]
  maxEntries?: number
  className?: string
}

export function CompactScheduleView({
  entries,
  maxEntries = 5,
  className,
}: CompactScheduleViewProps) {
  // Get upcoming entries (sorted by day and time)
  const sortedEntries = React.useMemo(() => {
    const now = new Date()
    const currentDay = now.getDay()
    const dayMap: Record<number, DayOfWeek> = {
      0: "SUNDAY",
      1: "MONDAY",
      2: "TUESDAY",
      3: "WEDNESDAY",
      4: "THURSDAY",
      5: "FRIDAY",
      6: "SATURDAY",
    }
    const currentDayOfWeek = dayMap[currentDay]

    return entries
      .filter((e) => {
        // Simple filtering - could be enhanced to filter by actual datetime
        const dayOrder = DAYS_OF_WEEK.findIndex((d) => d.value === e.dayOfWeek)
        const currentDayIndex = DAYS_OF_WEEK.findIndex(
          (d) => d.value === currentDayOfWeek
        )
        return dayOrder >= currentDayIndex
      })
      .sort((a, b) => {
        const dayDiff =
          DAYS_OF_WEEK.findIndex((d) => d.value === a.dayOfWeek) -
          DAYS_OF_WEEK.findIndex((d) => d.value === b.dayOfWeek)
        if (dayDiff !== 0) return dayDiff
        return parseTime(a.startTime) - parseTime(b.startTime)
      })
      .slice(0, maxEntries)
  }, [entries, maxEntries])

  if (sortedEntries.length === 0) {
    return (
      <div className={cn("py-8 text-center text-muted-foreground", className)}>
        No upcoming classes scheduled
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      {sortedEntries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
        >
          <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-primary/10 text-center">
            <span className="text-xs font-bold text-primary">
              {DAYS_OF_WEEK.find((d) => d.value === entry.dayOfWeek)?.short}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {entry.startTime}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {entry.course?.title || "Unknown Course"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {entry.subjectAssignment?.professor?.fullName ||
                entry.subjectAssignment?.professor?.name ||
                "No professor"}
              {entry.group?.name && ` • ${entry.group.name}`}
              {entry.room && ` • ${entry.room}`}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">
            {entry.endTime}
          </Badge>
        </div>
      ))}
    </div>
  )
}
