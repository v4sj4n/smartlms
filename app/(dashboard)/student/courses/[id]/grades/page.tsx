import Link from "next/link"
import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"

import { authOptions } from "@/lib/auth"
import { getCourseById } from "@/lib/actions/courses"
import { getStudentCourseGrades } from "@/lib/data/student-progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BreadcrumbLabels } from "@/components/breadcrumb-labels"
import { ArrowLeft } from "lucide-react"

export default async function StudentCourseGradesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: courseId } = await params
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "STUDENT") {
    redirect("/sign-in")
  }

  const { data: course, success } = await getCourseById(courseId)
  if (!success || !course) {
    notFound()
  }

  const isEnrolled = (course.enrollments ?? []).some(
    (e: { studentId: string }) => e.studentId === session.user.id
  )
  if (!isEnrolled) {
    redirect("/student/courses")
  }

  const { weeks, assignmentSubs, quizAttempts } = await getStudentCourseGrades(
    session.user.id,
    courseId
  )

  return (
    <>
      <BreadcrumbLabels
        labels={{
          [`/student/courses/${courseId}`]: course.title,
          [`/student/courses/${courseId}/grades`]: "Grades",
        }}
      />
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm" className="rounded-full">
          <Link href={`/student/courses/${courseId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to course
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grades</h1>
          <p className="text-muted-foreground">{course.title}</p>
        </div>

        {weeks.map((week) => {
          const weekAssignments = week.assignments ?? []
          const weekQuizzes = week.quizzes ?? []
          if (weekAssignments.length === 0 && weekQuizzes.length === 0) {
            return null
          }

          return (
            <Card key={week.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  Week {week.weekNumber}: {week.title}
                </CardTitle>
                <CardDescription>Assignments and quizzes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {weekAssignments.map((assignment) => {
                  const sub = assignmentSubs.find(
                    (s) => s.referenceId === assignment.id
                  )
                  return (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
                    >
                      <div>
                        <p className="font-medium">{assignment.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          Assignment
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {sub?.score != null ? (
                          <Badge>
                            {sub.score}/{sub.maxScore}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="capitalize">
                            {sub?.status ?? "missing"}
                          </Badge>
                        )}
                        <Button asChild variant="ghost" size="sm">
                          <Link
                            href={`/student/courses/${courseId}/assignments/${assignment.id}`}
                          >
                            View
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )
                })}
                {weekQuizzes.map((quiz) => {
                  const attempt = quizAttempts.find((a) => a.quizId === quiz.id)
                  return (
                    <div
                      key={quiz.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
                    >
                      <div>
                        <p className="font-medium">{quiz.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          Quiz
                        </p>
                      </div>
                      {attempt ? (
                        <Badge>{attempt.score} pts</Badge>
                      ) : (
                        <Badge variant="outline">Not taken</Badge>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}
