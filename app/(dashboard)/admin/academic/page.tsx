import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { getSchoolYears } from "@/lib/actions/academic"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Calendar,
  GraduationCap,
  Users,
  BookOpen,
  Plus,
  School,
} from "lucide-react"
import Link from "next/link"

export default async function AcademicPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    redirect("/sign-in")
  }

  const { data: schoolYears } = await getSchoolYears()

  const activeYear = schoolYears?.find((y: { isActive: boolean }) => y.isActive)

  return (
    <div className="flex-1 space-y-6">
      <div
        className="reveal-in flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ animationDelay: "0ms" }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            Academic Management
          </h1>
          <p className="mt-1 text-pretty text-muted-foreground">
            Manage academic years, semesters, study programs, and enrollments.
          </p>
        </div>
        <Link href="/admin/academic/school-years">
          <Button
            size="sm"
            className="transition-transform duration-150 ease-out active:scale-[0.96]"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Academic Year
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <div
          className="reveal-in overflow-x-auto"
          style={{ animationDelay: "100ms" }}
        >
          <TabsList className="w-max min-w-full sm:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="years">Academic Years</TabsTrigger>
            <TabsTrigger value="programs">Programs</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          {activeYear ? (
            <Card
              className="reveal-in surface-elevated border-l-4 border-l-green-500"
              style={{ animationDelay: "200ms" }}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">
                      {activeYear.name}
                    </CardTitle>
                    <CardDescription>
                      Currently Active Academic Year
                    </CardDescription>
                  </div>
                  <Badge variant="default" className="text-sm">
                    Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900">
                      <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Start Date</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(activeYear.startDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-purple-100 dark:bg-purple-900">
                      <School className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Programs</p>
                      <p className="text-sm text-muted-foreground">
                        {activeYear.studyPrograms?.length || 0} active
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-orange-100 dark:bg-orange-900">
                      <BookOpen className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Semesters</p>
                      <p className="text-sm text-muted-foreground">
                        {activeYear.semesters?.length || 0} terms
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-green-100 dark:bg-green-900">
                      <GraduationCap className="h-5 w-5 text-green-600 dark:text-green-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Status</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date() > new Date(activeYear.endDate)
                          ? "Ended"
                          : "In Progress"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <School className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">
                  No Active Academic Year
                </h3>
                <p className="mt-2 max-w-sm text-center text-muted-foreground">
                  Get started by creating a new academic year. This will serve
                  as the foundation for your academic structure.
                </p>
                <Link href="/admin/academic/school-years" className="mt-6">
                  <Button className="transition-transform duration-150 ease-out active:scale-[0.96]">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Academic Year
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <div
            className="reveal-in grid gap-6 md:grid-cols-3"
            style={{ animationDelay: "300ms" }}
          >
            <Link href="/admin/academic/school-years">
              <Card className="surface-elevated h-full cursor-pointer transition-[background-color,box-shadow,transform] hover:bg-muted/50 hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Academic Years
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">
                    {schoolYears?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Manage academic calendar and semesters
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/academic/study-programs">
              <Card className="surface-elevated h-full cursor-pointer transition-[background-color,box-shadow,transform] hover:bg-muted/50 hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Study Programs
                  </CardTitle>
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">
                    {schoolYears?.reduce(
                      (
                        acc: number,
                        year: { studyPrograms?: { length: number } }
                      ) => acc + (year.studyPrograms?.length || 0),
                      0
                    ) || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Departments, majors, and specializations
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/academic/enrollments">
              <Card className="surface-elevated h-full cursor-pointer transition-[background-color,box-shadow,transform] hover:bg-muted/50 hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Enrollments
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">-</div>
                  <p className="text-xs text-muted-foreground">
                    Manage student enrollments and registrations
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="years" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-balance">
              Academic Years
            </h2>
            <Link href="/admin/academic/school-years">
              <Button
                variant="outline"
                className="transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Year
              </Button>
            </Link>
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
                <Link
                  key={year.id}
                  href={`/admin/academic/school-years/${year.id}`}
                >
                  <Card className="surface-elevated cursor-pointer transition-[background-color,box-shadow,transform] hover:bg-muted/50 hover:shadow-md">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{year.name}</CardTitle>
                        {year.isActive && (
                          <Badge variant="default">Active</Badge>
                        )}
                      </div>
                      <CardDescription>
                        {new Date(year.startDate).toLocaleDateString()} -{" "}
                        {new Date(year.endDate).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>{year.semesters?.length || 0} Semesters</span>
                        <span>•</span>
                        <span>{year.studyPrograms?.length || 0} Programs</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            )}
          </div>
        </TabsContent>

        <TabsContent value="programs" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-balance">
              Study Programs
            </h2>
            <Link href="/admin/academic/study-programs">
              <Button
                variant="outline"
                className="transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Program
              </Button>
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {schoolYears?.flatMap((year) =>
              year.studyPrograms?.map((program) => (
                <Link
                  key={program.id}
                  href={`/admin/academic/study-programs/${program.id}`}
                >
                  <Card className="surface-elevated cursor-pointer transition-[background-color,box-shadow,transform] hover:bg-muted/50 hover:shadow-md">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          {program.name}
                        </CardTitle>
                        {program.code && (
                          <Badge variant="secondary">{program.code}</Badge>
                        )}
                      </div>
                      <CardDescription>{year.name}</CardDescription>
                    </CardHeader>
                    {program.description && (
                      <CardContent>
                        <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">
                          {program.description}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </Link>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
