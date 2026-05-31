import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Bot } from "lucide-react"

import { authOptions } from "@/lib/auth"
import { getCourseById } from "@/lib/actions/courses"
import { Button } from "@/components/ui/button"
import { AIAssignmentGeneratorDialog } from "@/components/ai-assignment-generator-dialog"

export default async function AIAssignmentCreationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ folderId?: string }>
}) {
  const { id } = await params
  const { folderId } = await searchParams

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

  if (!focusedWeek) {
    redirect(`/professor/courses/${id}/assignments/new?mode=tailored`)
  }

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex items-start gap-4">
        <Link
          href={`/professor/courses/${id}/assignments/new?mode=tailored${folderId ? `&folderId=${folderId}` : ""}`}
        >
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Create Assignment with AI
          </h1>
          <p className="text-muted-foreground">
            AI will analyze your folder materials and generate a tailored
            assignment.
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

      <div className="flex items-center justify-center py-12">
        <AIAssignmentGeneratorDialog
          weekId={focusedWeek.id}
          weekTitle={focusedWeek.title}
          trigger={
            <Button size="lg" className="gap-2">
              <Bot className="h-5 w-5" />
              Open AI Assignment Generator
            </Button>
          }
        />
      </div>
    </div>
  )
}
