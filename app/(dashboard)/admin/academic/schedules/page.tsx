import Link from "next/link"
import { requireAdminOnly } from "@/lib/permissions/guards"
import { getSchoolYears } from "@/lib/actions/academic"
import { getAcademicYearSchedule } from "@/lib/actions/academic-structure"
import { Button } from "@/components/ui/button"
import { ScheduleGeneratorPanel } from "@/components/admin/schedule-generator-panel"
import { ConflictAlertPanel } from "@/components/admin/conflict-alert-panel"
import { TimetableCalendar } from "@/components/admin/timetable-calendar"
import { ArrowLeft } from "lucide-react"

export default async function AdminSchedulesPage() {
  await requireAdminOnly()

  const { data: schoolYears } = await getSchoolYears()
  const activeYear = schoolYears?.find((y) => y.isActive)

  if (!activeYear) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          No active school year. Set one in Academic settings first.
        </p>
        <Button asChild>
          <Link href="/admin/academic/school-years">Manage school years</Link>
        </Button>
      </div>
    )
  }

  const { data: scheduleEntries } = await getAcademicYearSchedule(activeYear.id)

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="rounded-full">
        <Link href="/admin">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to admin
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Schedules</h1>
        <p className="text-muted-foreground">
          Generate balanced timetables for {activeYear.name}
        </p>
      </div>

      <ScheduleGeneratorPanel academicYearId={activeYear.id} />

      <div className="grid gap-6 lg:grid-cols-2">
        <TimetableCalendar
          entries={
            (scheduleEntries ?? []) as Parameters<
              typeof TimetableCalendar
            >[0]["entries"]
          }
          title="Current timetable"
        />
        <ConflictAlertPanel conflicts={[]} />
      </div>
    </div>
  )
}
