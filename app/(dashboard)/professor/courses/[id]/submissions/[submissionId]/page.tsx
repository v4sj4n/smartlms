import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { getSubmissionById } from "@/lib/actions/submissions"
import { GradingForm } from "@/components/professor/grading-form"
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
import { ArrowLeft, FileText } from "lucide-react"

export default async function ProfessorSubmissionGradePage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>
}) {
  const { id: courseId, submissionId } = await params

  const result = await getSubmissionById(submissionId)
  if (!result.success || !result.data) {
    notFound()
  }

  const {
    student,
    assignment,
    course,
    content,
    fileUrl,
    status,
    score,
    feedback,
    maxScore,
  } = result.data

  if (course.id !== courseId) {
    redirect(`/professor/courses/${course.id}/submissions/${submissionId}`)
  }

  return (
    <>
      <BreadcrumbLabels
        labels={{
          [`/professor/courses/${courseId}`]: course.title,
          [`/professor/courses/${courseId}/submissions`]: "Submissions",
          [`/professor/courses/${courseId}/submissions/${submissionId}`]:
            assignment?.title ?? "Grade",
        }}
      />
      <div className="mx-auto max-w-4xl space-y-6">
        <Button asChild variant="ghost" size="sm" className="rounded-full">
          <Link href={`/professor/courses/${courseId}/submissions`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to inbox
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {assignment?.title ?? "Assignment submission"}
            </h1>
            <p className="text-muted-foreground">
              {student?.fullName || student?.name || student?.email}
            </p>
          </div>
          <Badge variant="outline" className="capitalize">
            {status}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Submission</CardTitle>
            <CardDescription>Student response</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {content ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm whitespace-pre-wrap">
                {content}
              </div>
            ) : null}
            {fileUrl ? (
              <Button asChild variant="outline" className="rounded-full">
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="mr-2 h-4 w-4" />
                  View uploaded file
                </a>
              </Button>
            ) : null}
            {!content && !fileUrl ? (
              <p className="text-sm text-muted-foreground">
                No content submitted.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Grading</CardTitle>
            <CardDescription>Score out of {maxScore} points</CardDescription>
          </CardHeader>
          <CardContent>
            <GradingForm
              submissionId={submissionId}
              maxScore={maxScore}
              currentScore={score}
              currentFeedback={feedback}
              rubric={assignment?.rubric ?? null}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
