import { describe, it, expect } from "vitest"
import {
  varianceOfDayHours,
  isCatastrophic,
  scoreGroupPlacement,
  calculateDurationHours,
} from "@/lib/scheduling/equilibrium"
import type { DayOfWeek } from "@/lib/actions/schedules"

describe("equilibrium scheduling", () => {
  it("prefers even distribution across days", () => {
    const dayHours = new Map<DayOfWeek, number>([
      ["MONDAY", 2],
      ["TUESDAY", 2],
      ["WEDNESDAY", 0],
      ["THURSDAY", 0],
      ["FRIDAY", 0],
    ])

    const mondayScore = scoreGroupPlacement(dayHours, "MONDAY", 2)
    const wednesdayScore = scoreGroupPlacement(dayHours, "WEDNESDAY", 2)

    expect(wednesdayScore).toBeLessThan(mondayScore)
  })

  it("flags catastrophic daily overload", () => {
    const overloaded = new Map<DayOfWeek, number>([
      ["MONDAY", 8],
      ["TUESDAY", 0],
      ["WEDNESDAY", 0],
      ["THURSDAY", 0],
      ["FRIDAY", 0],
    ])

    expect(isCatastrophic(overloaded)).toBe(true)
  })

  it("calculates 2-hour block duration", () => {
    expect(calculateDurationHours("09:00", "11:00")).toBe(2)
  })

  it("variance is zero when hours are equal", () => {
    const balanced = new Map<DayOfWeek, number>([
      ["MONDAY", 2],
      ["TUESDAY", 2],
      ["WEDNESDAY", 2],
      ["THURSDAY", 2],
      ["FRIDAY", 2],
    ])
    expect(varianceOfDayHours(balanced)).toBe(0)
  })
})
