import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"

import { authOptions } from "@/lib/auth"
import { getCourseById } from "@/lib/actions/courses"
import { ManualFlashcardsForm } from "@/components/manual-flashcards-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"

export default async function NewFlashcardsPage({
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

  const weeks = (course.weeks ?? []).map((week) => ({
    id: week.id,
    title: week.title,
    weekNumber: week.weekNumber,
  }))

  if (!weeks.length) {
    redirect(`/professor/courses/${id}/folders/new`)
  }

  const defaultWeekId =
    (folderId && weeks.some((week) => week.id === folderId) && folderId) ||
    weeks[0]!.id

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Link href={`/professor/courses/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Create Flashcards
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manually build flashcards for {course.title}.
          </p>
        </div>
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Manual flashcard setup</CardTitle>
        </CardHeader>
        <CardContent>
          <ManualFlashcardsForm
            courseId={id}
            weeks={weeks}
            defaultWeekId={defaultWeekId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
