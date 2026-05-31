"use client"

import Link from "next/link"
import { Clock, MapPin } from "lucide-react"

interface Course {
  id: string
  title: string
  description?: string | null
  enrollments?: Array<{ studentId: string }>
}

interface TeachingScheduleProps {
  courses: Course[]
  activeCourseId?: string
}

const times = [
  "09:00 – 10:30",
  "11:00 – 12:30",
  "14:00 – 15:00",
  "15:30 – 17:00",
  "17:15 – 18:15",
]

const durations = ["90 min", "90 min", "60 min", "90 min", "60 min"]
const buildings = ["A", "B", "C", "D"]

function parseTime(timeStr: string): { start: Date; end: Date } {
  const today = new Date()
  const [startStr, endStr] = timeStr.split(" – ")

  const parsePart = (part: string) => {
    const [hours, minutes] = part.split(":").map(Number)
    const date = new Date(today)
    date.setHours(hours, minutes, 0, 0)
    return date
  }

  return {
    start: parsePart(startStr),
    end: parsePart(endStr),
  }
}

function isCurrentLecture(timeStr: string): boolean {
  const now = new Date()
  const { start, end } = parseTime(timeStr)
  return now >= start && now <= end
}

function isPastLecture(timeStr: string): boolean {
  const now = new Date()
  const { end } = parseTime(timeStr)
  return now > end
}

function getNextLectureIndex(courses: Course[]): number | null {
  const now = new Date()

  for (let i = 0; i < Math.min(courses.length, times.length); i++) {
    const { start } = parseTime(times[i])
    if (now < start) {
      return i
    }
  }

  return null
}

export function TeachingSchedule({
  courses,
  activeCourseId,
}: TeachingScheduleProps) {
  const nextIndex = getNextLectureIndex(courses)

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Clock className="h-7 w-7 text-muted-foreground/60" />
        </div>
        <h3 className="mt-4 font-semibold text-balance">No Classes Today</h3>
        <p className="mt-1.5 max-w-sm text-center text-sm text-pretty text-muted-foreground">
          You have no scheduled classes for today.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {courses.slice(0, 5).map((course, i) => {
        const time = times[i % times.length]
        const duration = durations[i % durations.length]
        const studentCount = course.enrollments?.length || 0
        const building = buildings[i % buildings.length]
        const floor = (i % 2) + 1
        const room = (i % 10) + 1
        const location = `Building ${building} · Room ${floor}0${room}`

        const current = isCurrentLecture(time)
        const past = isPastLecture(time)
        const isNext = nextIndex === i
        const isActive = course.id === activeCourseId

        return (
          <Link key={course.id} href={`/professor/courses/${course.id}`}>
            <div
              className={`relative cursor-pointer overflow-hidden rounded-2xl bg-card transition-[box-shadow,transform] hover:bg-muted/50 ${
                current ? "bg-primary/2 ring-1 ring-primary/30" : ""
              } ${past ? "opacity-60" : ""} ${isActive ? "ring-1 ring-blue-400/40" : ""}`}
            >
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
                {isActive && !current && !isNext && (
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-400"></span>
                )}
              </div>

              <div className="flex items-start justify-between gap-4 pt-4 pr-5 pb-4 pl-8">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                    <span className="text-base font-semibold text-foreground">
                      {course.title}
                    </span>
                    <span
                      className="hidden text-muted-foreground/40 sm:inline"
                      aria-hidden="true"
                    >
                      ·
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {studentCount}{" "}
                      {studentCount === 1 ? "student" : "students"}
                    </span>
                  </div>

                  {current && (
                    <span className="mt-1 inline-flex items-center text-xs font-medium text-emerald-600">
                      Currently teaching
                    </span>
                  )}
                  {isNext && !current && (
                    <span className="mt-1 inline-flex items-center text-xs font-medium text-amber-600">
                      Next class
                    </span>
                  )}
                  {isActive && !current && !isNext && (
                    <span className="mt-1 inline-flex items-center text-xs font-medium text-blue-600">
                      Active course
                    </span>
                  )}

                  <div className="mt-0.5 flex flex-col gap-0.5">
                    {course.description && (
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {course.description}
                      </span>
                    )}
                    <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {location}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                  <span className="flex items-center gap-1 font-mono text-sm font-semibold text-foreground tabular-nums">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {time}
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
