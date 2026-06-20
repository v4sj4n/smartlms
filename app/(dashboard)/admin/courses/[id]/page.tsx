import { getCourseById } from "@/lib/actions/courses"
import { getCourseSchedules } from "@/lib/actions/schedules"
import { requireAdminOnly } from "@/lib/permissions/guards"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScheduleManager } from "@/components/admin/schedule-manager"
import {
  ArrowLeft,
  BookOpen,
  Users,
  Calendar,
  MapPin,
  Clock,
} from "lucide-react"

interface CourseDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function AdminCourseDetailPage({
  params,
}: CourseDetailPageProps) {
  await requireAdminOnly()

  const { id } = await params
  const [courseResult, schedulesResult] = await Promise.all([
    getCourseById(id),
    getCourseSchedules(id),
  ])

  if (!courseResult.success || !courseResult.data) {
    notFound()
  }

  const course = courseResult.data
  const schedules =
    schedulesResult.success && schedulesResult.data ? schedulesResult.data : []

  return (
    <div className="flex-1 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin
            </Button>
          </Link>
        </div>
      </div>

      {/* Course Info */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{course.title}</h1>
        <p className="text-muted-foreground">
          {course.description || "No description available"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant={course.isPublished ? "default" : "secondary"}>
            {course.isPublished ? "Published" : "Draft"}
          </Badge>
          {course.semester && (
            <Badge variant="outline">{course.semester}</Badge>
          )}
          {course.studyProgram?.name && (
            <Badge variant="outline">{course.studyProgram.name}</Badge>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {course.enrollments?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Enrolled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Weeks</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {course.weeks?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Content weeks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Schedules</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedules.length}</div>
            <p className="text-xs text-muted-foreground">Class times</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Professor</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="truncate text-lg font-bold">
              {course.teacher?.fullName || course.teacher?.name || "Unassigned"}
            </div>
            <p className="text-xs text-muted-foreground">
              {course.teacher?.email || "No email"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Manager */}
      <ScheduleManager
        courseId={course.id}
        courseName={course.title}
        initialSchedules={schedules}
      />

      {/* Quick Schedule Preview */}
      {schedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Weekly Schedule Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold">
                    {schedule.dayOfWeek.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {schedule.startTime} – {schedule.endTime}
                    </p>
                    {(schedule.building || schedule.room) && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">
                          {schedule.building && `Bldg ${schedule.building}`}
                          {schedule.building && schedule.room && " · "}
                          {schedule.room}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
