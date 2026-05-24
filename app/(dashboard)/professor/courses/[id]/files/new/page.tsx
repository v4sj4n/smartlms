import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"

import { authOptions } from "@/lib/auth"
import { getCourseById } from "@/lib/actions/courses"
import { FolderMaterialUpload } from "@/components/folder-material-upload"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"

export default async function NewCourseFilePage({
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

  const targetFolder = folderId
    ? course.weeks?.find((week) => week.id === folderId)
    : course.weeks?.[0]

  if (!targetFolder) {
    redirect(`/professor/courses/${id}/folders/new`)
  }

  return (
    <div className="flex-1 space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Link href={`/professor/courses/${id}/folders/${targetFolder.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upload Material</h1>
          <p className="mt-1 text-muted-foreground">
            Upload files into {targetFolder.title}.
          </p>
        </div>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Folder upload</CardTitle>
          <CardDescription>
            Uploaded files are automatically added to this folder&apos;s
            materials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FolderMaterialUpload
            subjectId={course.id}
            weekNumber={targetFolder.weekNumber}
          />
        </CardContent>
      </Card>
    </div>
  )
}
