"use client"

import Link from "next/link"
import { Clock, MapPin, Calendar } from "lucide-react"

interface Schedule {
  id: string
  courseId: string
  dayOfWeek:
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY"
    | "SUNDAY"
  startTime: string // Format: "HH:MM"
  endTime: string // Format: "HH:MM"
  room?: string | null
  building?: string | null
}

interface Course {
  id: string
  title: string
  description?: string | null
  teacher?: {
    fullName?: string | null
    name?: string | null
  } | null
  schedules?: Schedule[]
}

interface ScheduleListProps {
  courses: Course[]
}

const DAY_NAMES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const

function getTodayDayOfWeek(): (typeof DAY_NAMES)[number] {
  return DAY_NAMES[new Date().getDay()]
}

function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime} – ${endTime}`
}

function parseTime(timeStr: string): Date {
  const today = new Date()
  const [hours, minutes] = timeStr.split(":").map(Number)
  const date = new Date(today)
  date.setHours(hours, minutes, 0, 0)
  return date
}

function formatDuration(startTime: string, endTime: string): string {
  const start = parseTime(startTime)
  const end = parseTime(endTime)
  const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60)
  return `${diffMinutes} min`
}

function isCurrentLecture(startTime: string, endTime: string): boolean {
  const now = new Date()
  const start = parseTime(startTime)
  const end = parseTime(endTime)
  return now >= start && now <= end
}

function isPastLecture(endTime: string): boolean {
  const now = new Date()
  const end = parseTime(endTime)
  return now > end
}

interface CourseScheduleItem {
  course: Course
  schedule: Schedule
}

function getTodaySchedules(courses: Course[]): CourseScheduleItem[] {
  const todayDay = getTodayDayOfWeek()
  const items: CourseScheduleItem[] = []

  for (const course of courses) {
    const schedules = course.schedules || []
    for (const schedule of schedules) {
      if (schedule.dayOfWeek === todayDay) {
        items.push({ course, schedule })
      }
    }
  }

  // Sort by start time
  return items.sort((a, b) => {
    return a.schedule.startTime.localeCompare(b.schedule.startTime)
  })
}

function getNextScheduleIndex(items: CourseScheduleItem[]): number | null {
  const now = new Date()

  for (let i = 0; i < items.length; i++) {
    const start = parseTime(items[i].schedule.startTime)
    if (now < start) {
      return i
    }
  }

  return null
}

export function ScheduleList({ courses }: ScheduleListProps) {
  const todaySchedules = getTodaySchedules(courses)
  const nextIndex = getNextScheduleIndex(todaySchedules)

  // Show upcoming schedule if no schedules today OR all classes for today have passed
  if (todaySchedules.length === 0 || nextIndex === null) {
    const today = new Date()
    const dayIndex = today.getDay()
    const upcomingDays = [
      {
        dayName: "Tomorrow",
        date: new Date(today.getTime() + 86400000),
        dayOfWeek: DAY_NAMES[(dayIndex + 1) % 7],
      },
      {
        dayName:
          DAY_NAMES[(dayIndex + 2) % 7].charAt(0) +
          DAY_NAMES[(dayIndex + 2) % 7].slice(1).toLowerCase(),
        date: new Date(today.getTime() + 172800000),
        dayOfWeek: DAY_NAMES[(dayIndex + 2) % 7],
      },
      {
        dayName:
          DAY_NAMES[(dayIndex + 3) % 7].charAt(0) +
          DAY_NAMES[(dayIndex + 3) % 7].slice(1).toLowerCase(),
        date: new Date(today.getTime() + 259200000),
        dayOfWeek: DAY_NAMES[(dayIndex + 3) % 7],
      },
    ]

    // Get upcoming schedules for the next few days
    const upcomingSchedules: {
      course: Course
      schedule: Schedule
      dayName: string
      date: Date
    }[] = []
    for (const day of upcomingDays) {
      for (const course of courses) {
        const schedules = course.schedules || []
        for (const schedule of schedules) {
          if (schedule.dayOfWeek === day.dayOfWeek) {
            upcomingSchedules.push({
              course,
              schedule,
              dayName: day.dayName,
              date: day.date,
            })
          }
        }
      }
    }

    // Sort by date then time
    upcomingSchedules.sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime()
      if (dateDiff !== 0) return dateDiff
      return a.schedule.startTime.localeCompare(b.schedule.startTime)
    })

    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Clock className="h-7 w-7 text-muted-foreground/60" />
          </div>
          <h3 className="mt-4 font-semibold text-balance">No Classes Today</h3>
          <p className="mt-1.5 max-w-sm text-center text-sm text-pretty text-muted-foreground">
            You have nothing for today.
          </p>
        </div>

        {upcomingSchedules.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
              Upcoming Schedule
            </h4>
            <div className="flex flex-col gap-3">
              {upcomingSchedules.slice(0, 5).map((item, i) => {
                const timeRange = formatTimeRange(
                  item.schedule.startTime,
                  item.schedule.endTime
                )
                const duration = formatDuration(
                  item.schedule.startTime,
                  item.schedule.endTime
                )
                const location =
                  item.schedule.building && item.schedule.room
                    ? `Building ${item.schedule.building} · Room ${item.schedule.room}`
                    : item.schedule.room || "TBA"

                return (
                  <div
                    key={`${item.course.id}-${item.schedule.id}`}
                    className="relative overflow-hidden rounded-2xl bg-card p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {item.course.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.date.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                          <span className="ml-2">· {item.dayName}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">
                          {timeRange}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {duration}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {todaySchedules.map(({ course, schedule }, i) => {
        const timeRange = formatTimeRange(schedule.startTime, schedule.endTime)
        const duration = formatDuration(schedule.startTime, schedule.endTime)
        const professorName =
          course.teacher?.fullName || course.teacher?.name || null
        const topic = course.description || null
        const location =
          schedule.building && schedule.room
            ? `Building ${schedule.building} · Room ${schedule.room}`
            : schedule.room || "TBA"

        const current = isCurrentLecture(schedule.startTime, schedule.endTime)
        const past = isPastLecture(schedule.endTime)
        const isNext = nextIndex === i

        return (
          <Link
            key={`${course.id}-${schedule.id}`}
            href={`/student/courses/${course.id}`}
          >
            <div
              className={`relative cursor-pointer overflow-hidden rounded-2xl bg-card transition-[box-shadow,transform] hover:bg-muted/50 ${
                current ? "bg-primary/2 ring-1 ring-primary/30" : ""
              } ${past ? "opacity-60" : ""}`}
            >
              {/* Status indicator dot */}
              <div className="absolute top-1/2 left-3 -translate-y-1/2">
                {current && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  </span>
                )}
                {isNext && !current && (
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
                )}
              </div>

              <div className="flex items-start justify-between gap-4 pt-4 pr-5 pb-4 pl-8">
                <div className="min-w-0 flex-1">
                  {/* Title · Professor */}
                  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                    <span className="text-base font-semibold text-foreground">
                      {course.title}
                    </span>
                    {professorName && (
                      <>
                        <span
                          className="hidden text-muted-foreground/40 sm:inline"
                          aria-hidden="true"
                        >
                          ·
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {professorName}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Status label */}
                  {current && (
                    <span className="mt-1 inline-flex items-center text-xs font-medium text-emerald-600">
                      Currently on
                    </span>
                  )}
                  {isNext && !current && (
                    <span className="mt-1 inline-flex items-center text-xs font-medium text-amber-600">
                      Next
                    </span>
                  )}

                  {/* Topic + Location */}
                  <div className="mt-0.5 flex flex-col gap-0.5">
                    {topic && (
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {topic}
                      </span>
                    )}
                    <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {location}
                    </span>
                  </div>
                </div>

                {/* Time block */}
                <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                  <span className="flex items-center gap-1 font-mono text-sm font-semibold text-foreground tabular-nums">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {timeRange}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground tabular-nums">
                    {duration}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
