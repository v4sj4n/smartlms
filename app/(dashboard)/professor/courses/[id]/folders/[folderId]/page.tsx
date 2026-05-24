import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import { getCourseById } from "@/lib/actions/courses"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { ArrowLeft, Plus, FileText, HelpCircle, Layers } from "lucide-react"
import { FolderMaterialUpload } from "@/components/folder-material-upload"

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

  return (
    <div className="flex-1 space-y-6 p-8">
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Materials
            </CardTitle>
            <CardDescription>
              Files and lecture resources in this folder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FolderMaterialUpload
              subjectId={course.id}
              weekNumber={folder.weekNumber}
            />

            {folder.materials && folder.materials.length > 0 ? (
              <div className="space-y-2">
                {folder.materials.map((material) => (
                  <div
                    key={material.id}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    <p className="font-medium">{material.title}</p>
                    <p className="text-muted-foreground">{material.type}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No materials added yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="h-4 w-4" />
              Quizzes
            </CardTitle>
            <CardDescription>
              Assessments available in this folder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {folder.quizzes && folder.quizzes.length > 0 ? (
              <div className="space-y-2">
                {folder.quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    <p className="font-medium">{quiz.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="secondary">{quiz.type}</Badge>
                      {quiz.timeLimitMinutes && (
                        <span className="text-muted-foreground">
                          {quiz.timeLimitMinutes} min
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No quizzes added yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" />
              Flashcards
            </CardTitle>
            <CardDescription>Study flashcards in this folder.</CardDescription>
          </CardHeader>
          <CardContent>
            {folder.flashcards && folder.flashcards.length > 0 ? (
              <div className="space-y-2">
                {folder.flashcards.map((flashcard) => (
                  <div
                    key={flashcard.id}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    <p className="font-medium">
                      Front: {flashcard.frontContent}
                    </p>
                    <p className="text-muted-foreground">
                      Back: {flashcard.backContent}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No flashcards added yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
