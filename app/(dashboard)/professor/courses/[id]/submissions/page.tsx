import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { getCourseById } from "@/lib/actions/courses"
import { getSubmissionsForCourse } from "@/lib/actions/submissions"
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
import { ArrowLeft, ArrowRight, Clock } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export default async function ProfessorSubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: courseId } = await params
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "PROFESSOR") {
    redirect("/sign-in")
  }

  const { data: course, success } = await getCourseById(courseId)
  if (!success || !course) {
    notFound()
  }

  if (course.teacherId !== session.user.id) {
    redirect("/professor/courses")
  }

  const pendingResult = await getSubmissionsForCourse(courseId, {
    status: "submitted",
  })
  const lateResult = await getSubmissionsForCourse(courseId, { status: "late" })
  const gradedResult = await getSubmissionsForCourse(courseId, {
    status: "graded",
  })

  const pending = [...(pendingResult.data ?? []), ...(lateResult.data ?? [])]
  const graded = gradedResult.data ?? []

  return (
    <>
      <BreadcrumbLabels
        labels={{
          [`/professor/courses/${courseId}`]: course.title,
          [`/professor/courses/${courseId}/submissions`]: "Submissions",
        }}
      />
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link href={`/professor/courses/${courseId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to course
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Submissions</h1>
          <p className="text-muted-foreground">{course.title}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending grading</CardTitle>
            <CardDescription>
              {pending.length} submission{pending.length !== 1 ? "s" : ""}{" "}
              waiting
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">All caught up.</p>
            ) : (
              pending.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/professor/courses/${courseId}/submissions/${sub.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {sub.student?.fullName ||
                        sub.student?.name ||
                        sub.student?.email}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {sub.assignment?.title ?? "Assignment"}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(sub.submittedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {sub.status}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {graded.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recently graded</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {graded.slice(0, 10).map((sub) => (
                <Link
                  key={sub.id}
                  href={`/professor/courses/${courseId}/submissions/${sub.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">
                      {sub.student?.fullName || sub.student?.email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {sub.assignment?.title}
                    </p>
                  </div>
                  <Badge>
                    {sub.score}/{sub.maxScore}
                  </Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
