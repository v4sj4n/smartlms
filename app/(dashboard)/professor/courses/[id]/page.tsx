import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { getCourseById } from "@/lib/actions/courses"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Users,
  Calendar,
  ArrowLeft,
  Plus,
  FileText,
  HelpCircle,
  Layers,
} from "lucide-react"
import Link from "next/link"

type SemesterWeekSlot = {
  weekNumber: number
  startDate: Date
  endDate: Date
  rangeLabel: string
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function formatRange(startDate: Date, endDate: Date): string {
  const startLabel = startDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const endLabel = endDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return `${startLabel} - ${endLabel}`
}

function buildSemesterWeekSlots(
  startDateValue: string,
  endDateValue: string
): SemesterWeekSlot[] {
  const semesterStart = parseDateOnly(startDateValue)
  const semesterEnd = parseDateOnly(endDateValue)

  const slots: SemesterWeekSlot[] = []
  const cursor = new Date(semesterStart)
  let weekNumber = 1

  while (cursor <= semesterEnd) {
    const weekStart = new Date(cursor)
    const weekEnd = new Date(cursor)
    weekEnd.setDate(weekEnd.getDate() + 6)

    if (weekEnd > semesterEnd) {
      weekEnd.setTime(semesterEnd.getTime())
    }

    slots.push({
      weekNumber,
      startDate: weekStart,
      endDate: weekEnd,
      rangeLabel: formatRange(weekStart, weekEnd),
    })

    cursor.setDate(cursor.getDate() + 7)
    weekNumber += 1
  }

  return slots
}

export default async function ProfessorCourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "PROFESSOR") {
    redirect("/sign-in")
  }

  const { data: course, success } = await getCourseById(id)

  if (!success || !course) {
    notFound()
  }

  // Check if professor owns this course
  if (course.teacherId !== session.user.id) {
    redirect("/professor/courses")
  }

  // Calculate stats
  const weeks = course.weeks || []
  const semesterWindow = course.semesterWindow
  const enrollments = course.enrollments || []
  const totalQuizzes = weeks.reduce(
    (acc, week) => acc + (week.quizzes?.length || 0),
    0
  )
  const totalMaterials = weeks.reduce(
    (acc, week) => acc + (week.materials?.length || 0),
    0
  )

  const weeksByNumber = new Map(weeks.map((week) => [week.weekNumber, week]))
  const semesterWeekSlots = semesterWindow
    ? buildSemesterWeekSlots(semesterWindow.startDate, semesterWindow.endDate)
    : []
  const generatedWeekNumbers = new Set(
    semesterWeekSlots.map((slot) => slot.weekNumber)
  )

  const timelineWeeks = [
    ...semesterWeekSlots.map((slot) => ({
      ...slot,
      contentWeek: weeksByNumber.get(slot.weekNumber) ?? null,
      isOutsideSemester: false,
    })),
    ...weeks
      .filter((week) => !generatedWeekNumbers.has(week.weekNumber))
      .map((week) => ({
        weekNumber: week.weekNumber,
        startDate: null,
        endDate: null,
        rangeLabel: "No semester range",
        contentWeek: week,
        isOutsideSemester: true,
      })),
  ]

  const plannedWeekCount =
    semesterWeekSlots.length > 0 ? semesterWeekSlots.length : weeks.length
  const configuredWeekCount = weeks.length

  return (
    <div className="flex-1 space-y-6 p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/professor/courses">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {course.title}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {course.studyProgram?.name || "No program"} •{" "}
              {course.semester || "N/A"} Semester
            </p>
            {semesterWindow && (
              <p className="text-sm text-muted-foreground">
                Semester timeline:{" "}
                {new Date(semesterWindow.startDate).toLocaleDateString()} -{" "}
                {new Date(semesterWindow.endDate).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/professor/courses/${course.id}/weeks/new`}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Week
            </Button>
          </Link>
        </div>
      </div>

      {/* Course Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Enrolled Students
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrollments.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Semester Weeks
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plannedWeekCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {configuredWeekCount} configured
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Quizzes</CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuizzes}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Materials</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMaterials}</div>
          </CardContent>
        </Card>
      </div>

      {/* Course Content Tabs */}
      <Tabs defaultValue="weeks" className="space-y-4 pt-2">
        <TabsList>
          <TabsTrigger value="weeks">Course Weeks</TabsTrigger>
          <TabsTrigger value="students">Enrolled Students</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="weeks" className="space-y-4">
          {timelineWeeks.length > 0 ? (
            <div className="space-y-4">
              {timelineWeeks.map((timelineWeek) => {
                const week = timelineWeek.contentWeek
                const cardKey = week
                  ? week.id
                  : `slot-${timelineWeek.weekNumber}`

                return (
                  <Card key={cardKey}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
                            {timelineWeek.weekNumber}
                          </div>
                          <div>
                            <CardTitle className="text-lg">
                              {week
                                ? week.title
                                : `Week ${timelineWeek.weekNumber}`}
                            </CardTitle>
                            <CardDescription className="mt-0.5">
                              {timelineWeek.rangeLabel}
                            </CardDescription>
                            {week?.description && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {week.description}
                              </p>
                            )}
                            {!week && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                No content added for this week yet.
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {week ? (
                            <Link
                              href={`/professor/courses/${course.id}/weeks/${week.id}`}
                            >
                              <Button variant="outline" size="sm">
                                View Week
                              </Button>
                            </Link>
                          ) : (
                            <Link
                              href={`/professor/courses/${course.id}/weeks/new`}
                            >
                              <Button variant="outline" size="sm">
                                Add Content
                              </Button>
                            </Link>
                          )}
                          <Badge variant={week ? "default" : "secondary"}>
                            {week ? "Configured" : "Empty"}
                          </Badge>
                          {timelineWeek.isOutsideSemester && (
                            <Badge variant="outline">Outside semester</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span>{week?.materials?.length || 0} Materials</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <HelpCircle className="h-4 w-4" />
                          <span>{week?.quizzes?.length || 0} Quizzes</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4" />
                          <span>
                            {week?.flashcards?.length || 0} Flashcards
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">No Weeks Created</h3>
                <p className="mt-2 max-w-sm text-center text-muted-foreground">
                  Start building your course by adding weekly content. Each week
                  can contain lectures, quizzes, and flashcards.
                </p>
                <Link
                  href={`/professor/courses/${course.id}/weeks/new`}
                  className="mt-6"
                >
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Week
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enrolled Students</CardTitle>
              <CardDescription>
                Students currently enrolled in this course.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {enrollments.length > 0 ? (
                <div className="space-y-4">
                  {enrollments.map((enrollment) => (
                    <div
                      key={enrollment.studentId}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                          {(
                            enrollment.student?.fullName ||
                            enrollment.student?.name ||
                            "S"
                          ).charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">
                            {enrollment.student?.fullName ||
                              enrollment.student?.name ||
                              "Unknown Student"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {enrollment.student?.email}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Enrolled{" "}
                        {new Date(enrollment.enrolledAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No students enrolled yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Course Analytics</CardTitle>
              <CardDescription>
                Overview of course engagement and performance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4 text-center">
                  <div className="text-3xl font-bold text-primary">
                    {enrollments.length}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Total Enrollments
                  </div>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <div className="text-3xl font-bold text-primary">
                    {plannedWeekCount}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Semester Weeks
                  </div>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <div className="text-3xl font-bold text-primary">
                    {totalQuizzes}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Total Quizzes
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
