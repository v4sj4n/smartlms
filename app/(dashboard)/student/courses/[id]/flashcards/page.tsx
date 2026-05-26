import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"

import { authOptions } from "@/lib/auth"
import { getCourseById } from "@/lib/actions/courses"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, ArrowRight, Layers3, Sparkles } from "lucide-react"
import { BreadcrumbLabels } from "@/components/breadcrumb-labels"

export default async function StudentCourseFlashcardsPage({
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
  const flashcardsByWeek = weeks
    .map((week) => ({
      week,
      flashcards: week.flashcards ?? [],
    }))
    .filter(({ flashcards }) => flashcards.length > 0)

  const totalFlashcards = flashcardsByWeek.reduce(
    (count, item) => count + item.flashcards.length,
    0
  )
  const focusedWeek = activeWeekId
    ? (flashcardsByWeek.find(({ week }) => week.id === activeWeekId)?.week ??
      null)
    : null

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <BreadcrumbLabels
        labels={{
          [`/student/courses/${course.id}`]: course.title,
          [`/student/courses/${course.id}/flashcards`]: "Flashcards",
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
            <h1 className="text-3xl font-bold tracking-tight">Flashcards</h1>
            <p className="mt-1 text-muted-foreground">{course.title}</p>
          </div>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          {totalFlashcards} total
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

      {flashcardsByWeek.length > 0 ? (
        <div className="space-y-4">
          {flashcardsByWeek.map(({ week, flashcards }) => (
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
                    {flashcards.length} flashcards
                  </p>
                </div>
                <Layers3 className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {flashcards.length > 0 && (
                  <div className="rounded-2xl border border-border/50 bg-linear-to-br from-muted/20 to-background/80 p-5 shadow-sm md:col-span-2 xl:col-span-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Sparkles className="h-4 w-4" />
                          <span>Study deck</span>
                        </div>
                        <p className="text-base font-medium">
                          One card at a time, with smooth flip navigation.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {flashcards.length} flashcards ready for this week.
                        </p>
                      </div>
                      <Button asChild className="rounded-full">
                        <Link
                          href={`/student/courses/${course.id}/flashcards/${week.id}`}
                        >
                          Start studying
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-2xl border-dashed border-border/60 bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Layers3 className="h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold">No flashcards yet</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              This course does not have any flashcards available right now.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
