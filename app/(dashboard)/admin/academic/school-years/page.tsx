"use server"

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { getSchoolYears, setActiveSchoolYear } from "@/lib/actions/academic"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, Plus, School } from "lucide-react"
import Link from "next/link"

export default async function SchoolYearsPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    redirect("/sign-in")
  }

  const { data: schoolYears } = await getSchoolYears()

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Link href="/admin/academic">
            <Button
              variant="ghost"
              size="icon"
              className="mt-0.5 shrink-0 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              Academic Years
            </h1>
            <p className="mt-1 text-pretty text-muted-foreground">
              Manage academic years, semesters, and study programs.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {schoolYears?.length || 0} years
          </span>
          <Link href="/admin/academic/school-years/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Year
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {schoolYears?.map(
          (year: {
            id: string
            name: string
            isActive: boolean
            startDate: string
            endDate: string
            semesters?: { length: number }
            studyPrograms?: { length: number }
          }) => (
            <Card
              key={year.id}
              className={year.isActive ? "border-l-4 border-l-green-500" : ""}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{year.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {new Date(year.startDate).toLocaleDateString()} -{" "}
                      {new Date(year.endDate).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  {year.isActive && <Badge variant="default">Active</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {year.semesters?.length || 0} semesters
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <School className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {year.studyPrograms?.length || 0} programs
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <form
                    action={async () => {
                      "use server"
                      await setActiveSchoolYear(year.id)
                    }}
                  >
                    <Button
                      type="submit"
                      variant={year.isActive ? "ghost" : "outline"}
                      size="sm"
                      disabled={year.isActive}
                    >
                      {year.isActive ? "Currently Active" : "Set as Active"}
                    </Button>
                  </form>
                  <Link href={`/admin/academic/school-years/${year.id}`}>
                    <Button variant="ghost" size="sm">
                      View Details
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {(!schoolYears || schoolYears.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <School className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No Academic Years</h3>
            <p className="mt-2 max-w-sm text-center text-muted-foreground">
              Get started by creating your first academic year to begin managing
              your institution.
            </p>
            <Link href="/admin/academic/school-years/new" className="mt-6">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Academic Year
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
