import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { getCourses } from "@/lib/actions/courses"
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
import {
  BookOpen,
  Calendar,
  Users,
  Plus,
  ArrowRight,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  BarChart3,
} from "lucide-react"
import Link from "next/link"

export default async function ProfessorDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "PROFESSOR") {
    redirect("/sign-in")
  }

  const displayName = getUserDisplayName(session.user)

  const [{ data: allCourses }, { data: announcements }] = await Promise.all([
    getCourses({ teacherId: session.user.id }),
    getAnnouncements({ scope: "global", limit: 5 }),
  ])

  const publishedCourses =
    allCourses?.filter((c: { isPublished: boolean }) => c.isPublished) || []
  const draftCourses =
    allCourses?.filter((c: { isPublished: boolean }) => !c.isPublished) || []

  // Calculate total students and stats
  const totalStudents =
    allCourses?.reduce(
      (acc: number, course: { enrollments?: { length: number } }) =>
        acc + (course.enrollments?.length || 0),
      0
    ) || 0

  return (
    <div className="flex-1 space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Professor Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Welcome back, {displayName}. Manage your
            courses and students.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/professor/courses">
            <Button variant="outline">
              <BookOpen className="mr-2 h-4 w-4" />
              My Courses
            </Button>
          </Link>
          <Link href="/professor/content/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Content
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">My Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allCourses?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {publishedCourses.length} published, {draftCourses.length} drafts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Students
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">
              Across all your courses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Grading
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              Submissions awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active This Week
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              Student interactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="courses" className="space-y-4 pt-2">
        <TabsList>
          <TabsTrigger value="courses">My Courses</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Quick Access</h3>
            <Link href="/professor/courses">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allCourses?.slice(0, 6).map((course) => (
              <Link key={course.id} href={`/professor/courses/${course.id}`}>
                <Card className="h-full cursor-pointer transition-colors hover:bg-muted/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="line-clamp-1 text-base">
                      {course.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-1">
                      {course.studyProgram?.name || "No program assigned"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {course.enrollments?.length || 0} students
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {course.weeks?.length || 0} weeks
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {(!allCourses || allCourses.length === 0) && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <BookOpen className="h-8 w-8 text-muted-foreground/50" />
                <h3 className="mt-4 font-medium">No Courses Assigned</h3>
                <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
                  You haven&apos;t been assigned to any courses yet. Contact your
                  administrator.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="announcements" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">System Announcements</h3>
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
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">
                        {announcement.title}
                      </CardTitle>
                      {announcement.isPinned && (
                        <Badge variant="secondary">Pinned</Badge>
                      )}
                    </div>
                    <CardDescription>
                      By{" "}
                      {announcement.author?.fullName ||
                        announcement.author?.name ||
                        "Unknown"}{" "}
                      •{" "}
                      {new Date(announcement.publishedAt).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {announcement.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <CheckCircle className="h-8 w-8 text-muted-foreground/50" />
                <h3 className="mt-4 font-medium">No Announcements</h3>
                <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
                  No system announcements at this time.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Teaching Schedule
              </CardTitle>
              <CardDescription>
                Your weekly teaching schedule and upcoming classes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">
                  Schedule Coming Soon
                </h3>
                <p className="mt-2 max-w-sm text-center text-muted-foreground">
                  The scheduling feature is currently in development. You&apos;ll be
                  able to view your teaching schedule here soon.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
