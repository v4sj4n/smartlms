import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  Plus,
  FileText,
  HelpCircle,
  Layers,
  Sparkles,
} from "lucide-react"
import { FolderMaterialUpload } from "@/components/folder-material-upload"
import { BreadcrumbLabels } from "@/components/breadcrumb-labels"
import { WeekContentTable } from "@/components/week-content-table"
import { AIContentGeneratorDialog } from "@/components/ai-content-generator-dialog"

export default async function ProfessorFolderDetailPage({
  params,
}: {
  params: Promise<{ id: string; folderId: string }>
}) {
  const { id, folderId } = await params

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

  const folder = course.weeks?.find((week) => week.id === folderId)

  if (!folder) {
    notFound()
  }

  const contentItems = [
    ...(folder.materials ?? []).map((material) => ({
      id: material.id,
      kind: "material" as const,
      title: material.title,
      detail: material.type,
      isPublished: material.isPublished,
    })),
    ...(folder.quizzes ?? []).map((quiz) => ({
      id: quiz.id,
      kind: "quiz" as const,
      title: quiz.title,
      detail: quiz.timeLimitMinutes
        ? `${quiz.type} • ${quiz.timeLimitMinutes} min`
        : quiz.type,
      isPublished: quiz.status === "PUBLISHED",
    })),
    ...(folder.flashcards && folder.flashcards.length > 0
      ? [
          {
            id: `flashcards-${folder.id}`,
            kind: "flashcardSet" as const,
            title: "Flashcard Set",
            detail: `${folder.flashcards.length} flashcards`,
            isPublished: folder.flashcards.every(
              (flashcard) => flashcard.status === "PUBLISHED"
            ),
            memberIds: folder.flashcards.map((flashcard) => flashcard.id),
          },
        ]
      : []),
  ]
  const contentItemsKey = contentItems
    .map((item) => `${item.kind}:${item.id}:${item.isPublished ? "1" : "0"}`)
    .join("|")

  return (
    <div className="flex-1 space-y-6 p-8">
      <BreadcrumbLabels
        labels={{
          [`/professor/courses/${course.id}`]: course.title,
          [`/professor/courses/${course.id}/folders/${folder.id}`]:
            folder.title,
        }}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/professor/courses/${course.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {folder.title}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {course.title} • Folder {folder.weekNumber}
            </p>
            {folder.description && (
              <p className="mt-2 text-sm text-muted-foreground">
                {folder.description}
              </p>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Content
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link
                href={`/professor/courses/${course.id}/files/new?folderId=${folder.id}`}
                className="flex cursor-pointer items-center"
              >
                <FileText className="mr-2 h-4 w-4" />
                Materials
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href={`/professor/courses/${course.id}/quizzes/new?folderId=${folder.id}`}
                className="flex cursor-pointer items-center"
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                Quizzes
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href={`/professor/courses/${course.id}/flashcards/new?folderId=${folder.id}`}
                className="flex cursor-pointer items-center"
              >
                <Layers className="mr-2 h-4 w-4" />
                Flashcards
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="p-0"
            >
              <AIContentGeneratorDialog
                weekId={folder.id}
                weekTitle={folder.title}
                trigger={
                  <div className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted">
                    <Sparkles className="mr-2 h-4 w-4 text-amber-400" />
                    <span>GenAI</span>
                  </div>
                }
              />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Materials</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {folder.materials?.length || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quizzes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{folder.quizzes?.length || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Flashcards</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {folder.flashcards?.length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Folder Content
          </CardTitle>
          <CardDescription>
            Materials, quizzes, and flashcards in this folder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FolderMaterialUpload
            subjectId={course.id}
            folderId={folder.id}
            weekNumber={folder.weekNumber}
          />

          <WeekContentTable
            key={contentItemsKey}
            weekId={folder.id}
            items={contentItems}
          />
        </CardContent>
      </Card>
    </div>
  )
}
