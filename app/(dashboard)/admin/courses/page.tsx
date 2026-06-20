import { getCoursesWithSchedules } from "@/lib/actions/schedules"
import { requireAdminOnly } from "@/lib/permissions/guards"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BookOpen,
  Users,
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  Plus,
} from "lucide-react"

export default async function AdminCoursesPage() {
  await requireAdminOnly()

  const result = await getCoursesWithSchedules()
  const courses = result.success && result.data ? result.data : []

  const dayOrder = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ]
  const dayLabels: Record<string, string> = {
    MONDAY: "Mon",
    TUESDAY: "Tue",
    WEDNESDAY: "Wed",
    THURSDAY: "Thu",
    FRIDAY: "Fri",
    SATURDAY: "Sat",
    SUNDAY: "Sun",
  }

  return (
    <div className="flex-1 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Courses</h1>
          <p className="text-muted-foreground">
            Manage all courses and their schedules
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin">
            <Button variant="outline" size="sm">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courses.length}</div>
            <p className="text-xs text-muted-foreground">All courses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              With Schedules
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {courses.filter((c) => (c.schedules?.length || 0) > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Courses with class times
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Schedules
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {courses.reduce((acc, c) => acc + (c.schedules?.length || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">All class sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Courses Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => {
          const scheduleCount = course.schedules?.length || 0
          const sortedSchedules = [...(course.schedules || [])].sort(
            (a, b) =>
              dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek)
          )

          return (
            <Link key={course.id} href={`/admin/courses/${course.id}`}>
              <Card className="h-full cursor-pointer transition-[background-color,box-shadow,transform] hover:bg-muted/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="line-clamp-1 text-base">
                      {course.title}
                    </CardTitle>
                    <Badge
                      variant={course.isPublished ? "default" : "secondary"}
                    >
                      {course.isPublished ? "Live" : "Draft"}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-1">
                    {course.studyProgram?.name || "General"} ·{" "}
                    {course.teacher?.fullName ||
                      course.teacher?.name ||
                      "No professor"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {course.enrollments?.length || 0} students
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {scheduleCount} schedule{scheduleCount !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Schedule Preview */}
                  {scheduleCount > 0 ? (
                    <div className="space-y-1.5">
                      {sortedSchedules.slice(0, 3).map((schedule) => (
                        <div
                          key={schedule.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Badge
                            variant="outline"
                            className="text-xs font-normal"
                          >
                            {dayLabels[schedule.dayOfWeek]}
                          </Badge>
                          <span className="tabular-nums">
                            {schedule.startTime} – {schedule.endTime}
                          </span>
                          {(schedule.building || schedule.room) && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {schedule.building && `B${schedule.building}`}
                              {schedule.building && schedule.room && "·"}
                              {schedule.room}
                            </span>
                          )}
                        </div>
                      ))}
                      {scheduleCount > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{scheduleCount - 3} more
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-dashed p-2 text-sm text-muted-foreground">
                      <Plus className="h-4 w-4" />
                      Click to add schedules
                    </div>
                  )}

                  {/* Action */}
                  <div className="flex items-center justify-end">
                    <span className="flex items-center gap-1 text-sm font-medium text-primary">
                      Manage
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {courses.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-medium">No Courses</h3>
            <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
              Create courses from the admin dashboard to get started.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
