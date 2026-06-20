"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  updateProfessorAvailability,
  type AvailabilitySlot,
} from "@/lib/actions/professor-availability"
import type { DayOfWeek } from "@/lib/actions/schedules"

const DAYS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
]

type ProfessorAvailabilityFormProps = {
  professorId: string
  initialAvailability: AvailabilitySlot[]
  initialMaxHours: number
}

export function ProfessorAvailabilityForm({
  professorId,
  initialAvailability,
  initialMaxHours,
}: ProfessorAvailabilityFormProps) {
  const [maxWeeklyHours, setMaxWeeklyHours] = useState(String(initialMaxHours))
  const [slots, setSlots] = useState<AvailabilitySlot[]>(
    initialAvailability.length > 0
      ? initialAvailability
      : [
          {
            dayOfWeek: "MONDAY",
            startTime: "09:00",
            endTime: "17:00",
          },
        ]
  )
  const [isSaving, setIsSaving] = useState(false)

  function addSlot() {
    setSlots((prev) => [
      ...prev,
      { dayOfWeek: "MONDAY", startTime: "09:00", endTime: "11:00" },
    ])
  }

  async function handleSave() {
    setIsSaving(true)
    const result = await updateProfessorAvailability(professorId, {
      availability: slots,
      maxWeeklyHours: Number(maxWeeklyHours),
    })
    setIsSaving(false)

    if (!result.success) {
      toast.error(result.error ?? "Failed to save availability")
      return
    }

    toast.success("Availability updated")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Teaching availability</CardTitle>
        <CardDescription>
          Used by the timetable generator to place your 2-hour lecture and
          seminar blocks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="max-hours">Max weekly hours</Label>
          <Input
            id="max-hours"
            type="number"
            min={2}
            max={40}
            value={maxWeeklyHours}
            onChange={(e) => setMaxWeeklyHours(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          {slots.map((slot, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-lg border border-border/60 p-3 sm:grid-cols-4"
            >
              <Select
                value={slot.dayOfWeek}
                onValueChange={(value) =>
                  setSlots((prev) =>
                    prev.map((s, i) =>
                      i === index ? { ...s, dayOfWeek: value as DayOfWeek } : s
                    )
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day.charAt(0) + day.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="time"
                value={slot.startTime}
                onChange={(e) =>
                  setSlots((prev) =>
                    prev.map((s, i) =>
                      i === index ? { ...s, startTime: e.target.value } : s
                    )
                  )
                }
              />
              <Input
                type="time"
                value={slot.endTime}
                onChange={(e) =>
                  setSlots((prev) =>
                    prev.map((s, i) =>
                      i === index ? { ...s, endTime: e.target.value } : s
                    )
                  )
                }
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setSlots((prev) => prev.filter((_, i) => i !== index))
                }
              >
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={addSlot}>
            Add window
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save availability"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
