import Link from "next/link"
import { requireAdminOnly } from "@/lib/permissions/guards"
import { getStudentGroups } from "@/lib/actions/academic-structure"
import { getStudyPrograms } from "@/lib/actions/academic"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AdminGroupsForm } from "@/components/admin/groups-form"
import { ArrowLeft, Users2 } from "lucide-react"

export default async function AdminGroupsPage() {
  await requireAdminOnly()

  const [{ data: groups }, { data: programs }] = await Promise.all([
    getStudentGroups(),
    getStudyPrograms(),
  ])

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="rounded-full">
        <Link href="/admin">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to admin
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Student Groups</h1>
        <p className="text-muted-foreground">
          Manage cohorts within study programs
        </p>
      </div>

      <AdminGroupsForm programs={programs ?? []} />

      <div className="grid gap-4 md:grid-cols-2">
        {(groups ?? []).map((group) => (
          <Card key={group.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{group.name}</CardTitle>
                <Badge variant="outline">Year {group.yearLevel}</Badge>
              </div>
              <CardDescription>
                {group.studyProgram?.name ?? "Program"} ·{" "}
                {group.members?.length ?? 0}/{group.capacity ?? "∞"} students
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users2 className="h-4 w-4" />
                {group.subjectAssignments?.length ?? 0} subject assignments
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
