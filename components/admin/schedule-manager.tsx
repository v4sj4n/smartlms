"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Clock,
  MapPin,
  Calendar,
  Plus,
  Trash2,
  Save,
  AlertCircle,
} from "lucide-react"
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  DayOfWeek,
} from "@/lib/actions/schedules"

const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
  { value: "SUNDAY", label: "Sunday" },
]

interface Schedule {
  id: string
  courseId: string
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  room?: string | null
  building?: string | null
}

interface ScheduleManagerProps {
  courseId: string
  courseName: string
  initialSchedules?: Schedule[]
}

export function ScheduleManager({
  courseId,
  courseName,
  initialSchedules = [],
}: ScheduleManagerProps) {
  const [schedules, setSchedules] = React.useState<Schedule[]>(initialSchedules)
  const [isAdding, setIsAdding] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [newSchedule, setNewSchedule] = React.useState({
    dayOfWeek: "MONDAY" as DayOfWeek,
    startTime: "09:00",
    endTime: "10:30",
    room: "",
    building: "",
  })

  const handleAddSchedule = async () => {
    setIsLoading(true)
    setError(null)

    const result = await createSchedule({
      courseId,
      ...newSchedule,
      room: newSchedule.room || undefined,
      building: newSchedule.building || undefined,
    })

    if (result.success && result.data) {
      setSchedules([...schedules, result.data])
      setIsAdding(false)
      setNewSchedule({
        dayOfWeek: "MONDAY",
        startTime: "09:00",
        endTime: "10:30",
        room: "",
        building: "",
      })
    } else {
      setError(result.error || "Failed to create schedule")
    }

    setIsLoading(false)
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    const result = await deleteSchedule(scheduleId)
    if (result.success) {
      setSchedules(schedules.filter((s) => s.id !== scheduleId))
    }
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":")
    return `${hours}:${minutes}`
  }

  const getDayLabel = (day: DayOfWeek) => {
    return DAYS_OF_WEEK.find((d) => d.value === day)?.label || day
  }

  const sortedSchedules = [...schedules].sort((a, b) => {
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

  const schedulesByDay = sortedSchedules.reduce(
    (acc, schedule) => {
      if (!acc[schedule.dayOfWeek]) {
        acc[schedule.dayOfWeek] = []
      }
      acc[schedule.dayOfWeek].push(schedule)
      return acc
    },
    {} as Record<DayOfWeek, Schedule[]>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Course Schedule
            </CardTitle>
            <CardDescription>
              Manage class times and locations for {courseName}
            </CardDescription>
          </div>
          <Button
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Schedule
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {isAdding && (
          <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
            <h4 className="font-medium">New Schedule</h4>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="day">Day of Week</Label>
                <Select
                  value={newSchedule.dayOfWeek}
                  onValueChange={(v) =>
                    setNewSchedule({
                      ...newSchedule,
                      dayOfWeek: v as DayOfWeek,
                    })
                  }
                >
                  <SelectTrigger id="day">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={newSchedule.startTime}
                  onChange={(e) =>
                    setNewSchedule({
                      ...newSchedule,
                      startTime: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={newSchedule.endTime}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, endTime: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="building">Building (optional)</Label>
                <Input
                  id="building"
                  placeholder="e.g., A"
                  value={newSchedule.building}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, building: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                <Label htmlFor="room">Room (optional)</Label>
                <Input
                  id="room"
                  placeholder="e.g., 101"
                  value={newSchedule.room}
                  onChange={(e) =>
                    setNewSchedule({ ...newSchedule, room: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAddSchedule}
                disabled={isLoading}
                size="sm"
              >
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Saving..." : "Save Schedule"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsAdding(false)}
                disabled={isLoading}
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-medium">No Schedules</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Add class schedules to help students know when and where classes
              take place.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {DAYS_OF_WEEK.filter(
              (day) => schedulesByDay[day.value]?.length > 0
            ).map((day) => (
              <div key={day.value}>
                <h4 className="mb-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                  {day.label}
                </h4>
                <div className="space-y-2">
                  {schedulesByDay[day.value].map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex items-center justify-between rounded-lg border bg-card p-3"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {formatTime(schedule.startTime)} –{" "}
                            {formatTime(schedule.endTime)}
                          </p>
                          {(schedule.building || schedule.room) && (
                            <p className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {schedule.building &&
                                `Building ${schedule.building}`}
                              {schedule.building && schedule.room && " · "}
                              {schedule.room && `Room ${schedule.room}`}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Separator className="mt-4" />
              </div>
            ))}
          </div>
        )}

        {schedules.length > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-muted p-3">
            <span className="text-sm text-muted-foreground">
              Total: {schedules.length} schedule
              {schedules.length !== 1 ? "s" : ""}
            </span>
            <Badge variant="secondary">
              {Object.keys(schedulesByDay).length} day
              {Object.keys(schedulesByDay).length !== 1 ? "s" : ""}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
