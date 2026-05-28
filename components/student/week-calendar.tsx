"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

function getWeekDays(anchor: Date) {
  const day = anchor.getDay()
  const monday = new Date(anchor)
  monday.setDate(anchor.getDate() - ((day + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

function getISOWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  )
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function WeekCalendar() {
  const today = new Date()
  const [selected, setSelected] = useState<Date>(today)
  const days = getWeekDays(today)
  const week = getISOWeek(today)
  const monthLabel = MONTH_NAMES[today.getMonth()] + " " + today.getFullYear()

  function isSameDay(a: Date, b: Date) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    )
  }

  return (
    <div className="surface-elevated rounded-2xl border border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {monthLabel}
        </span>
        <span className="rounded-full bg-muted px-3 py-1 font-mono text-[10px] font-medium tracking-widest text-muted-foreground">
          WEEK {week}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((day, i) => {
          const isToday = isSameDay(day, today)
          const isSelected = isSameDay(day, selected)
          const isWeekend = i >= 5

          return (
            <button
              key={i}
              onClick={() => setSelected(day)}
              aria-label={`${DOW[i]} ${day.getDate()}${isToday ? ", today" : ""}${isSelected ? ", selected" : ""}`}
              aria-pressed={isSelected}
              className={cn(
                "flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-xl px-0.5 py-1 sm:px-1 sm:py-2.5 transition-[background-color,transform] duration-150 active:scale-[0.96]",
                isSelected && !isToday
                  ? "bg-primary/10"
                  : !isToday
                    ? "bg-muted/60 hover:bg-muted"
                    : "",
                isToday
                  ? "bg-foreground text-background"
                  : isWeekend
                    ? "text-muted-foreground"
                    : "text-foreground"
              )}
            >
              {/* Top dot — mobile only, today only */}
              <span
                className={cn(
                  "h-1 w-1 rounded-full sm:hidden",
                  isToday ? "bg-emerald-400" : "invisible"
                )}
              />
              <span
                className={cn(
                  "sm:mb-1.5 text-[9px] font-semibold tracking-wide uppercase",
                  isToday ? "text-background/60" : "text-muted-foreground"
                )}
              >
                {DOW[i]}
              </span>
              <span
                className={cn(
                  "font-mono text-sm font-bold tabular-nums sm:text-base",
                  isToday ? "text-background" : ""
                )}
              >
                {day.getDate()}
              </span>
              {/* Bottom dot — sm+ only, today only */}
              <span
                className={cn(
                  "mt-1.5 hidden h-1 w-1 rounded-full sm:block",
                  isToday ? "bg-emerald-400" : "invisible"
                )}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
