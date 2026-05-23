import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import type { CSSProperties } from "react"

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
  ArrowLeft,
  BookOpen,
  Calendar,
  FileText,
  HelpCircle,
  Layers,
  Users,
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

export default async function StudentCourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "STUDENT") {
    redirect("/sign-in")
  }

  const { data: course, success } = await getCourseById(id)

  if (!success || !course) {
    notFound()
  }

  const enrollments = course.enrollments || []
  const isEnrolled = enrollments.some(
    (enrollment: { studentId: string }) =>
      enrollment.studentId === session.user.id
  )

  if (!isEnrolled) {
    redirect("/student/courses")
  }

  const weeks = course.weeks || []
  const semesterWindow = course.semesterWindow
  const totalQuizzes = weeks.reduce(
    (acc, week) => acc + (week.quizzes?.length || 0),
    0
  )
  const totalMaterials = weeks.reduce(
    (acc, week) => acc + (week.materials?.length || 0),
    0
  )
  const totalFlashcards = weeks.reduce(
    (acc, week) => acc + (week.flashcards?.length || 0),
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

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Link href="/student/courses">
              <Button variant="ghost" size="icon" className="rounded-xl">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {course.title}
              </h1>
              <p className="mt-1 text-muted-foreground">
                {course.studyProgram?.name || "General"} •{" "}
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
        </div>

        <div className="flex flex-wrap gap-3">
          <Badge
            variant="secondary"
            className="rounded-full px-3 py-1 tracking-wide uppercase"
          >
            {course.isPublished ? "Published" : "Draft"}
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full px-3 py-1 tracking-wide uppercase"
          >
            Enrolled
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl border-border/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Weeks</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {timelineWeeks.length}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Materials</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {totalMaterials}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Quizzes</CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {totalQuizzes}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Flashcards</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {totalFlashcards}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="weeks" className="space-y-4 pt-2">
        <TabsList>
          <TabsTrigger value="weeks">Course Weeks</TabsTrigger>
          <TabsTrigger value="people">Classmates</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
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
                  <Card
                    key={cardKey}
                    className="rounded-2xl border-border/40 shadow-sm"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-4">
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
                                No content has been posted for this week yet.
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
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
                      <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
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
            <Card className="rounded-3xl border-dashed border-border/50 bg-muted/10">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">
                  No Weeks Available
                </h3>
                <p className="mt-2 max-w-sm text-muted-foreground">
                  This course does not have any weekly content yet.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="people" className="space-y-4">
          <Card className="rounded-2xl border-border/40 shadow-sm">
            <CardHeader>
              <CardTitle>Classmates</CardTitle>
              <CardDescription>
                Students enrolled in the same course.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {enrollments.map(
                  (enrollment: {
                    studentId: string
                    student?: {
                      name?: string | null
                      fullName?: string | null
                      email?: string | null
                    }
                  }) => (
                    <div
                      key={enrollment.studentId}
                      className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">
                          {enrollment.student?.fullName ||
                            enrollment.student?.name ||
                            "Classmate"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {enrollment.student?.email || "Student email"}
                        </p>
                      </div>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <Card className="rounded-2xl border-border/40 shadow-sm">
            <CardHeader>
              <CardTitle>Course Overview</CardTitle>
              <CardDescription>
                A quick read-only summary of what you can access in this course.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Teacher
                </p>
                <p className="mt-1 font-medium">
                  {course.teacher?.name ||
                    course.teacher?.fullName ||
                    "Unassigned"}
                </p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Program
                </p>
                <p className="mt-1 font-medium">
                  {course.studyProgram?.name || "General"}
                </p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Semester
                </p>
                <p className="mt-1 font-medium">{course.semester || "N/A"}</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Students
                </p>
                <p className="mt-1 font-medium">{enrollments.length}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
