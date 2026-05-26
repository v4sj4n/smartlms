import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"

import { authOptions } from "@/lib/auth"
import { getCourseById } from "@/lib/actions/courses"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, ArrowRight, Clock3, HelpCircle } from "lucide-react"
import { BreadcrumbLabels } from "@/components/breadcrumb-labels"

export default async function StudentCourseQuizzesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ weekId?: string }>
}) {
  const { id } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeWeekId = resolvedSearchParams?.weekId ?? null

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
  const quizzesByWeek = weeks
    .map((week) => ({
      week,
      quizzes: week.quizzes ?? [],
    }))
    .filter(({ quizzes }) => quizzes.length > 0)

  const totalQuizzes = quizzesByWeek.reduce(
    (count, item) => count + item.quizzes.length,
    0
  )
  const focusedWeek = activeWeekId
    ? (quizzesByWeek.find(({ week }) => week.id === activeWeekId)?.week ?? null)
    : null

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <BreadcrumbLabels
        labels={{
          [`/student/courses/${course.id}`]: course.title,
          [`/student/courses/${course.id}/quizzes`]: "Quizzes",
        }}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/student/courses/${course.id}`}>
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quizzes</h1>
            <p className="mt-1 text-muted-foreground">{course.title}</p>
          </div>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {totalQuizzes} total
        </Badge>
      </div>

      {focusedWeek && (
        <Card className="rounded-2xl border-primary/20 bg-primary/5 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.24em] text-primary uppercase">
                Week context preserved
              </p>
              <p className="mt-1 font-medium">
                Week {focusedWeek.weekNumber}: {focusedWeek.title}
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link
                href={`/student/courses/${course.id}?weekId=${focusedWeek.id}`}
              >
                Back to course week
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {quizzesByWeek.length > 0 ? (
        <div className="space-y-4">
          {quizzesByWeek.map(({ week, quizzes }) => (
            <Card
              key={week.id}
              className="rounded-2xl border-border/40 shadow-sm"
            >
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
                <div>
                  <CardTitle className="text-lg">
                    Week {week.weekNumber}: {week.title}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {quizzes.length} quizzes
                  </p>
                </div>
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-3">
                {quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-muted/20 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{quiz.title}</p>
                        <Badge variant="outline" className="uppercase">
                          {quiz.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {quiz.description || "No description provided."}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Open the dedicated quiz session to answer one question
                        at a time.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock3 className="h-4 w-4" />
                        <span>
                          {quiz.timeLimitMinutes
                            ? `${quiz.timeLimitMinutes} min`
                            : "No time limit"}
                        </span>
                      </div>
                      <Button asChild className="rounded-full">
                        <Link
                          href={`/student/courses/${course.id}/quizzes/${quiz.id}?weekId=${week.id}`}
                        >
                          Start quiz
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-2xl border-dashed border-border/60 bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <HelpCircle className="h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold">No quizzes yet</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              This course does not have any quizzes available right now.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
