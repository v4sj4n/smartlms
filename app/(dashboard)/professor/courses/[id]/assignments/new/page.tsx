import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, BookOpen, Bot, FileCheck2, Users } from "lucide-react"

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
import { cn } from "@/lib/utils"

export default async function NewAssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    folderId?: string
    mode?: "general" | "tailored"
    source?: "quiz" | "ai"
  }>
}) {
  const { id } = await params
  const { folderId, mode, source } = await searchParams

  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "PROFESSOR") {
    redirect("/sign-in")
  }

  const { data: course, success } = await getCourseById(id)
  if (!success || !course) {
    notFound()
  }

  if (course.teacherId !== session.user.id) {
    redirect("/professor/courses")
  }

  const weeks = course.weeks ?? []
  const focusedWeek = folderId
    ? (weeks.find((week) => week.id === folderId) ?? null)
    : null
  const selectedMode = mode === "general" || mode === "tailored" ? mode : null

  // Handle AI source - redirect to AI assignment creation page
  if (source === "ai" && selectedMode === "tailored") {
    if (!folderId) {
      redirect(
        `/professor/courses/${id}/assignments/new?mode=tailored&message=Please select a folder first`
      )
    }
    redirect(`/professor/courses/${id}/assignments/new/ai?folderId=${folderId}`)
  }

  // Handle quiz source - redirect to quiz-based assignment (placeholder)
  if (source === "quiz" && selectedMode === "tailored") {
    // TODO: Implement quiz-based tailored assignment creation
    redirect(
      `/professor/courses/${id}/assignments/new?mode=tailored&message=Quiz-based assignment creation coming soon`
    )
  }

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex items-start gap-4">
        <Link href={`/professor/courses/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Create Assignment
          </h1>
          <p className="text-muted-foreground">
            Choose a shared assignment or build one that adapts after quiz
            results or with AI assistance.
          </p>
          <p className="text-sm text-muted-foreground">
            Course: {course.title}
          </p>
          {focusedWeek && (
            <p className="text-sm text-muted-foreground">
              Folder: Week {focusedWeek.weekNumber}: {focusedWeek.title}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href={`/professor/courses/${id}/assignments/new?mode=general${folderId ? `&folderId=${folderId}` : ""}`}
          className="block"
        >
          <Card
            className={cn(
              "h-full cursor-pointer border-border/50 transition-all hover:border-primary/40 hover:shadow-lg",
              selectedMode === "general" && "border-primary bg-primary/5"
            )}
          >
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <BookOpen className="h-6 w-6" />
              </div>
              <CardTitle className="mt-4 text-2xl">
                General assignment
              </CardTitle>
              <CardDescription>
                Create one assignment that every student sees and submits in the
                same way.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Best for homework, essays, projects, and shared deadlines.</p>
              <p>
                Use one set of instructions, one rubric, and one due date for
                the full class.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link
          href={`/professor/courses/${id}/assignments/new?mode=tailored${folderId ? `&folderId=${folderId}` : ""}`}
          className="block"
        >
          <Card
            className={cn(
              "h-full cursor-pointer border-border/50 transition-all hover:border-primary/40 hover:shadow-lg",
              selectedMode === "tailored" && "border-primary bg-primary/5"
            )}
          >
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Users className="h-6 w-6" />
              </div>
              <CardTitle className="mt-4 text-2xl">
                Tailored after quiz or AI
              </CardTitle>
              <CardDescription>
                Create a follow-up assignment that is individualized from quiz
                results or generated with AI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Best for remediation, personalized practice, and differentiated
                instruction.
              </p>
              <p>
                Use quiz performance to create a next-step assignment, or let AI
                draft one for you.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {selectedMode ? (
        <Card className="border-border/50 bg-muted/20">
          <CardHeader>
            <CardTitle>
              {selectedMode === "general"
                ? "General assignment selected"
                : "Tailored assignment selected"}
            </CardTitle>
            <CardDescription>
              {selectedMode === "general"
                ? "The next step should collect the shared title, instructions, due date, and grading details."
                : "The next step should let you start from quiz results or generate a draft with AI."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {selectedMode === "tailored" && (
              <>
                <Button variant="outline" asChild>
                  <Link
                    href={`/professor/courses/${id}/assignments/new?mode=tailored${folderId ? `&folderId=${folderId}` : ""}&source=quiz`}
                  >
                    <FileCheck2 className="mr-2 h-4 w-4" />
                    Create from quiz results
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link
                    href={`/professor/courses/${id}/assignments/new?mode=tailored${folderId ? `&folderId=${folderId}` : ""}&source=ai`}
                  >
                    <Bot className="mr-2 h-4 w-4" />
                    Create assignment with AI
                  </Link>
                </Button>
              </>
            )}
            <Button variant="outline" asChild>
              <Link
                href={`/professor/courses/${id}/assignments/new${folderId ? `?folderId=${folderId}` : ""}`}
              >
                Change choice
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/professor/courses/${id}`}>Back to course</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-border/60 bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium tracking-[0.24em] text-muted-foreground uppercase">
              Start here
            </p>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Pick the assignment style first, then the builder can expand into
              the full creation flow.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
