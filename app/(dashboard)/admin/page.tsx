import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { getSchoolYears } from "@/lib/actions/academic"
import { getCourses } from "@/lib/actions/courses"
import { getClubs } from "@/lib/actions/clubs"
import { getAdminDashboardPriorities } from "@/lib/actions/dashboard-intelligence"
import { getAnnouncements } from "@/lib/actions/announcements"
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
import { getUserDisplayName } from "@/lib/display-name"
import { DashboardPriorityPanel } from "@/components/dashboard-priority-panel"
import {
  Users,
  BookOpen,
  School,
  Calendar,
  Megaphone,
  Plus,
  ArrowRight,
  GraduationCap,
  Users2,
} from "lucide-react"
import Link from "next/link"

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    redirect("/sign-in")
  }

  const displayName = getUserDisplayName(session.user)

  const [
    { data: schoolYears },
    { data: courses },
    { data: clubs },
    { data: announcements },
  ] = await Promise.all([
    getSchoolYears(),
    getCourses(),
    getClubs(),
    getAnnouncements({ limit: 5 }),
  ])

  const { important, notImportant } = await getAdminDashboardPriorities()

  const activeYear = schoolYears?.find((y: { isActive: boolean }) => y.isActive)
  const totalPrograms =
    schoolYears?.reduce(
      (acc: number, year: { studyPrograms?: { length: number } }) =>
        acc + (year.studyPrograms?.length || 0),
      0
    ) || 0
  const totalEnrollments =
    courses?.reduce(
      (acc: number, course: { enrollments?: { length: number } }) =>
        acc + (course.enrollments?.length || 0),
      0
    ) || 0

  return (
    <div className="flex-1 space-y-6">
      {/* Header */}
      <div
        className="reveal-in flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ animationDelay: "0ms" }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-pretty text-muted-foreground">
            Welcome back, {displayName}. Here&apos;s what&apos;s happening.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/academic/school-years/new">
            <Button
              variant="outline"
              size="sm"
              className="transition-transform duration-150 ease-out active:scale-[0.96]"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Year
            </Button>
          </Link>
          <Link href="/admin/courses/new">
            <Button
              size="sm"
              className="transition-transform duration-150 ease-out active:scale-[0.96]"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Course
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card
          className="surface-elevated reveal-in"
          style={{ animationDelay: "80ms" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active Academic Year
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {activeYear ? activeYear.name : "None"}
            </div>
            <p className="text-xs text-muted-foreground">
              {activeYear
                ? `${new Date(activeYear.startDate).toLocaleDateString()} - ${new Date(activeYear.endDate).toLocaleDateString()}`
                : "Set an active year"}
            </p>
          </CardContent>
        </Card>

        <Card
          className="surface-elevated reveal-in"
          style={{ animationDelay: "140ms" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Study Programs
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {totalPrograms}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {schoolYears?.length || 0} academic years
            </p>
          </CardContent>
        </Card>

        <Card
          className="surface-elevated reveal-in"
          style={{ animationDelay: "200ms" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active Courses
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {courses?.filter((c: { isPublished: boolean }) => c.isPublished)
                .length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {courses?.length || 0} total courses
            </p>
          </CardContent>
        </Card>

        <Card
          className="surface-elevated reveal-in"
          style={{ animationDelay: "260ms" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Student Enrollments
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {totalEnrollments}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all active courses
            </p>
          </CardContent>
        </Card>
      </div>

      <DashboardPriorityPanel
        important={important}
        notImportant={notImportant}
        title="Dashboard Priorities"
      />

      {/* Main Content Tabs */}
      <Tabs defaultValue="announcements" className="space-y-4">
        <TabsList className="w-full overflow-x-auto sm:w-auto">
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="courses">Recent Courses</TabsTrigger>
          <TabsTrigger value="clubs">Clubs</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="announcements" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent Announcements</h3>
            <Link href="/admin/announcements">
              <Button
                variant="ghost"
                size="sm"
                className="transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {announcements && announcements.length > 0 ? (
            <div className="grid gap-4">
              {announcements.map((announcement) => (
                <Card
                  key={announcement.id}
                  className={
                    announcement.isPinned
                      ? "border-l-4 border-l-yellow-500"
                      : ""
                  }
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">
                            {announcement.title}
                          </CardTitle>
                          {announcement.isPinned && (
                            <Badge variant="secondary">Pinned</Badge>
                          )}
                        </div>
                        <CardDescription className="mt-1">
                          By{" "}
                          {announcement.author?.fullName ||
                            announcement.author?.name ||
                            "Unknown"}{" "}
                          •{" "}
                          {new Date(
                            announcement.publishedAt
                          ).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{announcement.scope}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">
                      {announcement.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Megaphone className="h-8 w-8 text-muted-foreground/50" />
                <h3 className="mt-4 font-medium">No Announcements</h3>
                <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
                  Create announcements to communicate with students, professors,
                  and staff.
                </p>
                <Link href="/admin/announcements/new" className="mt-4">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Announcement
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="courses" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent Courses</h3>
            <Link href="/admin/courses">
              <Button
                variant="ghost"
                size="sm"
                className="transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses?.slice(0, 6).map((course) => (
              <Link key={course.id} href={`/admin/courses/${course.id}`}>
                <Card className="surface-elevated h-full cursor-pointer transition-[background-color,box-shadow,transform] hover:bg-muted/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="line-clamp-1 text-base">
                      {course.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-1">
                      {course.teacher?.fullName ||
                        course.teacher?.name ||
                        "No instructor"}{" "}
                      • {course.studyProgram?.name || "No program"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 line-clamp-2 text-sm text-pretty text-muted-foreground">
                      {course.description || "No description available"}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>
                        {course.enrollments?.length || 0} students enrolled
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {(!courses || courses.length === 0) && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <BookOpen className="h-8 w-8 text-muted-foreground/50" />
                <h3 className="mt-4 font-medium">No Courses</h3>
                <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
                  Create courses and assign them to programs and professors.
                </p>
                <Link href="/admin/courses/new" className="mt-4">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Course
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="clubs" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Clubs</h3>
            <Link href="/admin/clubs">
              <Button
                variant="ghost"
                size="sm"
                className="transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clubs?.slice(0, 6).map((club) => (
              <Link key={club.id} href={`/admin/clubs/${club.id}`}>
                <Card className="surface-elevated h-full cursor-pointer transition-[background-color,box-shadow,transform] hover:bg-muted/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{club.name}</CardTitle>
                    <CardDescription>
                      {club.members?.length || 0} members •{" "}
                      {club.materials?.length || 0} materials •{" "}
                      {club.messages?.length || 0} messages
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">
                      {club.description || "No description available"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {(!clubs || clubs.length === 0) && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Users2 className="h-8 w-8 text-muted-foreground/50" />
                <h3 className="mt-4 font-medium">No Clubs Yet</h3>
                <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
                  Create clubs to foster community and collaborative activity.
                </p>
                <Link href="/admin/clubs/new" className="mt-4">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                      Create Group
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Summary</CardTitle>
              <CardDescription>
                Current state of the platform based on live data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <School className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Active Academic Year</p>
                    <p className="text-sm text-muted-foreground">
                      {activeYear
                        ? `${activeYear.name} — ${new Date(activeYear.startDate).toLocaleDateString()} to ${new Date(activeYear.endDate).toLocaleDateString()}`
                        : "No active year set. Go to Academic Management to create one."}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Courses</p>
                    <p className="text-sm text-muted-foreground">
                      {courses?.filter(
                        (c: { isPublished: boolean }) => c.isPublished
                      ).length || 0}{" "}
                      published,{" "}
                      {courses?.filter(
                        (c: { isPublished: boolean }) => !c.isPublished
                      ).length || 0}{" "}
                      unpublished
                      {courses?.[0] && ` — most recent: ${courses[0].title}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Student Enrollments</p>
                    <p className="text-sm text-muted-foreground">
                      {totalEnrollments} total enrollment
                      {totalEnrollments !== 1 ? "s" : ""} across{" "}
                      {courses?.length || 0} course
                      {(courses?.length || 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
