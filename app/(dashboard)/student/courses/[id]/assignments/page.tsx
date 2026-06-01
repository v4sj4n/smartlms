import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { getCourseById } from "@/lib/actions/courses"
import { getStudentSubmissionsForCourse } from "@/lib/actions/submissions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"
import { BreadcrumbLabels } from "@/components/breadcrumb-labels"

export default async function StudentAssignmentsPage({
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

  const studentId = session.user.id
  const submissionsResult = await getStudentSubmissionsForCourse(id, studentId)
  const submissions = submissionsResult.data || []

  // Collect all assignments from all weeks
  const allAssignments =
    course.weeks?.flatMap((week) =>
      (week.assignments || [])
        .filter((a) => a.isPublished)
        .map((assignment) => {
          const submission = submissions.find(
            (s) => s.referenceId === assignment.id
          )
          const isLate = assignment.dueDate
            ? new Date() > new Date(assignment.dueDate)
            : false

          return {
            ...assignment,
            weekId: week.id,
            weekNumber: week.weekNumber,
            weekTitle: week.title,
            submission,
            isLate,
          }
        })
    ) || []

  // Sort by due date (earliest first)
  const sortedAssignments = allAssignments.sort((a, b) => {
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  })

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <BreadcrumbLabels
        labels={{
          [`/student/courses/${course.id}`]: course.title,
          [`/student/courses/${course.id}/assignments`]: "Assignments",
        }}
      />

      <div className="flex items-center gap-3">
        <Link href={`/student/courses/${course.id}`}>
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Assignments</h1>
          <p className="text-muted-foreground">{course.title}</p>
        </div>
      </div>

      {sortedAssignments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No Assignments</h3>
            <p className="mt-2 max-w-sm text-center text-muted-foreground">
              There are no assignments available for this course yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedAssignments.map((assignment) => {
            const hasSubmitted = !!assignment.submission
            const isGraded =
              assignment.submission &&
              assignment.submission.score !== null &&
              assignment.submission.score !== undefined

            return (
              <Card
                key={assignment.id}
                className={
                  hasSubmitted
                    ? "border-green-200 bg-green-50/30 dark:bg-green-950/10"
                    : ""
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">
                          {assignment.title}
                        </CardTitle>
                        <Badge variant="outline">{assignment.type}</Badge>
                      </div>
                      <CardDescription className="mt-1">
                        Week {assignment.weekNumber}: {assignment.weekTitle}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {isGraded ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Graded: {assignment.submission?.score}/
                          {assignment.maxScore}
                        </Badge>
                      ) : hasSubmitted ? (
                        <Badge variant="secondary">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Submitted
                        </Badge>
                      ) : assignment.isLate ? (
                        <Badge variant="destructive">
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Overdue
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-200 text-amber-600"
                        >
                          <Clock className="mr-1 h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {assignment.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {assignment.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />
                      <span>Max Score: {assignment.maxScore}</span>
                    </div>
                    {assignment.dueDate && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>
                          Due:{" "}
                          {new Date(assignment.dueDate).toLocaleDateString()}
                          {assignment.isLate && !hasSubmitted && " (Late)"}
                        </span>
                      </div>
                    )}
                    {assignment.timeLimitMinutes && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>{assignment.timeLimitMinutes} min limit</span>
                      </div>
                    )}
                    {assignment.submissionType && (
                      <Badge variant="outline" className="text-xs">
                        {assignment.submissionType === "text"
                          ? "Text submission"
                          : assignment.submissionType === "file"
                            ? "File upload"
                            : "Text or file"}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button asChild className="rounded-full">
                      <Link
                        href={`/student/courses/${course.id}/assignments/${assignment.id}?weekId=${assignment.weekId}`}
                      >
                        {hasSubmitted ? "View / Resubmit" : "View & Submit"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
