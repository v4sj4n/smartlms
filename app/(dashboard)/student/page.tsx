import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { getCourses } from "@/lib/actions/courses"
import { getClubs } from "@/lib/actions/clubs"
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
import { Progress } from "@/components/ui/progress"
import {
  BookOpen,
  Calendar,
  Users,
  Clock,
  Award,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Flame,
  Target,
  Star,
} from "lucide-react"
import Link from "next/link"

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "STUDENT") {
    redirect("/sign-in")
  }

  const [{ data: allCourses }, { data: clubs }, { data: announcements }] =
    await Promise.all([
      getCourses(),
      getClubs(),
      getAnnouncements({ scope: "global", limit: 5 }),
    ])

  // Filter courses where student is enrolled
  const enrolledCourses =
    allCourses?.filter(
      (course: { enrollments?: Array<{ studentId: string }> }) =>
        course.enrollments?.some(
          (e: { studentId: string }) => e.studentId === session.user.id
        )
    ) || []

  // Calculate completion rates (mock for now)
  const totalWeeks = enrolledCourses.reduce(
    (acc: number, course: { weeks?: { length: number } }) =>
      acc + (course.weeks?.length || 0),
    0
  )

  return (
    <div className="flex-1 space-y-6 p-8">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {session.user.name?.split(" ")[0] || "Student"}! 👋
          </h1>
          <p className="mt-1 text-muted-foreground">
            Here's what's happening with your courses today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/student/courses">
            <Button variant="outline">
              <BookOpen className="mr-2 h-4 w-4" />
              My Courses
            </Button>
          </Link>
          <Link href="/student/clubs">
            <Button>
              <Users className="mr-2 h-4 w-4" />
              Explore Clubs
            </Button>
          </Link>
        </div>
      </div>

      {/* Progress Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-blue-200/50 bg-gradient-to-br from-blue-500/10 to-blue-600/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Enrolled Courses
            </CardTitle>
            <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
              {enrolledCourses.length}
            </div>
            <p className="mt-1 text-xs text-blue-600/70 dark:text-blue-400/70">
              {
                enrolledCourses.filter(
                  (c: { isPublished: boolean }) => c.isPublished
                ).length
              }{" "}
              currently active
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200/50 bg-gradient-to-br from-green-500/10 to-green-600/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Completion Rate
            </CardTitle>
            <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">
              --%
            </div>
            <p className="mt-1 text-xs text-green-600/70 dark:text-green-400/70">
              Across all courses
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-200/50 bg-gradient-to-br from-orange-500/10 to-orange-600/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Study Streak
            </CardTitle>
            <Flame className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700 dark:text-orange-300">
              --
            </div>
            <p className="mt-1 text-xs text-orange-600/70 dark:text-orange-400/70">
              Days in a row
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-200/50 bg-gradient-to-br from-purple-500/10 to-purple-600/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Clubs Joined
            </CardTitle>
            <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">
              --
            </div>
            <p className="mt-1 text-xs text-purple-600/70 dark:text-purple-400/70">
              Active memberships
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="courses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="courses">My Courses</TabsTrigger>
          <TabsTrigger value="clubs">Student Clubs</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Enrolled Courses</h3>
            <Link href="/student/courses">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {enrolledCourses.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {enrolledCourses.map((course) => (
                <Link key={course.id} href={`/student/courses/${course.id}`}>
                  <Card className="h-full cursor-pointer transition-colors hover:bg-muted/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="line-clamp-1 text-base">
                        {course.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-1">
                        {course.studyProgram?.name || "General"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                        {course.description || "No description available"}
                      </p>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {course.weeks?.length || 0} weeks
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {course.enrollments?.length || 0} students
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <BookOpen className="h-8 w-8 text-muted-foreground/50" />
                <h3 className="mt-4 font-medium">No Enrolled Courses</h3>
                <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
                  You're not enrolled in any courses yet. Contact your
                  administrator or academic advisor.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="clubs" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Available Clubs</h3>
            <Link href="/student/clubs">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clubs?.slice(0, 6).map((club) => (
              <Link key={club.id} href={`/student/clubs/${club.id}`}>
                <Card className="h-full cursor-pointer transition-colors hover:bg-muted/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{club.name}</CardTitle>
                    <CardDescription>
                      {club.members?.length || 0} members •{" "}
                      {club.materials?.length || 0} materials •{" "}
                      {club.messages?.length || 0} messages
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
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
                <Users className="h-8 w-8 text-muted-foreground/50" />
                <h3 className="mt-4 font-medium">No Clubs Available</h3>
                <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
                  Student clubs will appear here once they're created by
                  administrators.
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
                  No system announcements at this time. Check back later for
                  updates.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
