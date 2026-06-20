import Link from "next/link"
import { requireAdminOnly } from "@/lib/permissions/guards"
import {
  getSubjectAssignments,
  getStudentGroups,
} from "@/lib/actions/academic-structure"
import { getCourses } from "@/lib/actions/courses"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AdminSubjectAssignmentsForm } from "@/components/admin/subject-assignments-form"
import { ArrowLeft } from "lucide-react"

export default async function AdminSubjectAssignmentsPage() {
  await requireAdminOnly()

  const [{ data: assignments }, { data: groups }, { data: courses }] =
    await Promise.all([
      getSubjectAssignments(),
      getStudentGroups(),
      getCourses(),
    ])

  const professors = await db.query.users.findMany({
    where: eq(users.role, "PROFESSOR"),
    columns: { id: true, name: true, fullName: true, email: true },
  })

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="rounded-full">
        <Link href="/admin">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to admin
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Subject Assignments
        </h1>
        <p className="text-muted-foreground">
          Link professors, courses, and student groups
        </p>
      </div>

      <AdminSubjectAssignmentsForm
        professors={professors}
        courses={courses ?? []}
        groups={groups ?? []}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current assignments</CardTitle>
          <CardDescription>
            {(assignments ?? []).length} active assignments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(assignments ?? []).map((assignment) => (
            <div
              key={assignment.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-3"
            >
              <div>
                <p className="font-medium">{assignment.course?.title}</p>
                <p className="text-sm text-muted-foreground">
                  {assignment.professor?.fullName || assignment.professor?.name}{" "}
                  · {assignment.group?.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {assignment.sessionType ?? "lecture"}
                </Badge>
                <Badge>{assignment.requiredHours}h/week</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
