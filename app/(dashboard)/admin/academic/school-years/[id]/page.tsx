import Link from "next/link"
import { notFound } from "next/navigation"
import { getSchoolYearById, setActiveSchoolYear } from "@/lib/actions/academic"
import { requireAdminOnly } from "@/lib/permissions/guards"
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
  BookOpen,
  Calendar,
  GraduationCap,
  School,
  Users,
} from "lucide-react"

interface SchoolYearDetailPageProps {
  params: Promise<{
    id: string
  }>
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function semesterLabel(type: "FIRST" | "SECOND") {
  return type === "FIRST" ? "First Semester" : "Second Semester"
}

export default async function SchoolYearDetailPage({
  params,
}: SchoolYearDetailPageProps) {
  await requireAdminOnly()

  const { id } = await params
  const result = await getSchoolYearById(id)

  if (!result.success || !result.data) {
    notFound()
  }

  const schoolYear = result.data
  const semesters = [...schoolYear.semesters].sort((a, b) =>
    a.type.localeCompare(b.type)
  )

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Link href="/admin/academic/school-years">
            <Button
              variant="ghost"
              size="icon"
              className="mt-0.5 shrink-0 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                {schoolYear.name}
              </h1>
              {schoolYear.isActive && <Badge>Active</Badge>}
            </div>
            <p className="mt-1 text-pretty text-muted-foreground">
              {formatDate(schoolYear.startDate)} –{" "}
              {formatDate(schoolYear.endDate)}
            </p>
          </div>
        </div>

        <form
          action={async () => {
            "use server"
            await setActiveSchoolYear(id)
          }}
        >
          <Button
            type="submit"
            variant={schoolYear.isActive ? "ghost" : "outline"}
            size="sm"
            disabled={schoolYear.isActive}
          >
            {schoolYear.isActive ? "Currently Active" : "Set as Active"}
          </Button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Semesters</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {semesters.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Study Programs
            </CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {schoolYear.studyPrograms.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Enrollments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {schoolYear.studentProgramEnrollments.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {schoolYear.courses.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Semesters
            </CardTitle>
            <CardDescription>
              Two semesters per academic year (first and second).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {semesters.length > 0 ? (
              semesters.map((semester) => (
                <div key={semester.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">
                      {semesterLabel(semester.type)}
                    </p>
                    <Badge variant="outline">{semester.type}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                    <div>
                      <p className="text-xs tracking-wide uppercase">Start</p>
                      <p>{formatDate(semester.startDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs tracking-wide uppercase">Midterm</p>
                      <p>{formatDate(semester.midDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs tracking-wide uppercase">End</p>
                      <p>{formatDate(semester.endDate)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No semesters configured for this academic year yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Study Programs
            </CardTitle>
            <CardDescription>
              Programs offered during this academic year.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {schoolYear.studyPrograms.length > 0 ? (
              schoolYear.studyPrograms.map((program) => (
                <div key={program.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{program.name}</p>
                      {program.description && (
                        <p className="mt-1 text-sm text-pretty text-muted-foreground">
                          {program.description}
                        </p>
                      )}
                    </div>
                    {program.code && (
                      <Badge variant="secondary">{program.code}</Badge>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>{program.studentGroups.length} groups</span>
                    <span>
                      {program.studentProgramEnrollments.length} students
                    </span>
                    <span>{program.courses.length} courses</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No study programs linked to this academic year yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
          <CardDescription>
            Jump to related academic management pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/academic/enrollments">Manage Enrollments</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/academic/groups">Student Groups</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/academic/schedules">Schedules</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/courses">Courses</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
