import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import { createCourseWeek, getCourseById } from "@/lib/actions/courses"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft } from "lucide-react"

export default async function NewFolderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

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

  const nextFolderNumber =
    Math.max(0, ...(course.weeks?.map((week) => week.weekNumber) ?? [0])) + 1

  async function createFolderAction(formData: FormData) {
    "use server"

    const title = String(formData.get("title") || "").trim()
    const description = String(formData.get("description") || "").trim()
    const numberRaw = String(formData.get("folderNumber") || "").trim()
    const folderNumber = Number.parseInt(numberRaw, 10)

    if (!title || Number.isNaN(folderNumber) || folderNumber <= 0) {
      redirect(`/professor/courses/${id}/folders/new`)
    }

    const result = await createCourseWeek({
      courseId: id,
      title,
      description: description || undefined,
      weekNumber: folderNumber,
    })

    if (!result.success || !result.data) {
      redirect(`/professor/courses/${id}/folders/new`)
    }

    redirect(`/professor/courses/${id}/folders/${result.data.id}`)
  }

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Link href={`/professor/courses/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Folder</h1>
          <p className="mt-1 text-muted-foreground">
            Add a new folder for {course.title}.
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Folder Details</CardTitle>
          <CardDescription>
            Folders are the same as course weeks, but displayed as folders in
            the UI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createFolderAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folderNumber">Folder Number</Label>
              <Input
                id="folderNumber"
                name="folderNumber"
                type="number"
                min={1}
                defaultValue={nextFolderNumber}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                placeholder="Folder title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Optional description"
                rows={4}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit">Create Folder</Button>
              <Link href={`/professor/courses/${id}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
