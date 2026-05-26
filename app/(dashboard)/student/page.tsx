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
import { getUserDisplayName } from "@/lib/display-name"
import {
  BookOpen,
  Users,
  ArrowRight,
  CheckCircle,
  Flame,
  Target,
} from "lucide-react"
import Link from "next/link"

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "STUDENT") {
    redirect("/sign-in")
  }

  const displayName = getUserDisplayName(session.user)

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

  return (
    <div className="flex-1 space-y-6">
      {/* Welcome Header */}
      <div
        className="reveal-in flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ animationDelay: "0ms" }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            Welcome back, {displayName}! 👋
          </h1>
          <p className="mt-1 text-pretty text-muted-foreground">
            Here&apos;s what&apos;s happening with your courses today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/student/courses">
            <Button
              variant="outline"
              size="sm"
              className="transition-transform duration-150 ease-out active:scale-[0.96]"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              My Courses
            </Button>
          </Link>
          <Link href="/student/clubs">
            <Button
              size="sm"
              className="transition-transform duration-150 ease-out active:scale-[0.96]"
            >
              <Users className="mr-2 h-4 w-4" />
              Explore Clubs
            </Button>
          </Link>
        </div>
      </div>

      {/* Progress Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card
          className="surface-elevated reveal-in"
          style={{ animationDelay: "80ms" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Enrolled Courses
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {enrolledCourses.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {
                enrolledCourses.filter(
                  (c: { isPublished: boolean }) => c.isPublished
                ).length
              }{" "}
              currently active
            </p>
          </CardContent>
        </Card>

        <Card
          className="surface-elevated reveal-in"
          style={{ animationDelay: "140ms" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Completion Rate
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">--%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Across all courses
            </p>
          </CardContent>
        </Card>

        <Card
          className="surface-elevated reveal-in"
          style={{ animationDelay: "200ms" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Study Streak</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">--</div>
            <p className="mt-1 text-xs text-muted-foreground">Days in a row</p>
          </CardContent>
        </Card>

        <Card
          className="surface-elevated reveal-in"
          style={{ animationDelay: "260ms" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clubs Joined</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">--</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Active memberships
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="courses" className="space-y-4">
        <TabsList className="w-full overflow-x-auto sm:w-auto">
          <TabsTrigger value="courses">My Courses</TabsTrigger>
          <TabsTrigger value="clubs">Student Clubs</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Enrolled Courses</h3>
            <Link href="/student/courses">
              <Button
                variant="ghost"
                size="sm"
                className="transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {enrolledCourses.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {enrolledCourses.map((course) => (
                <Link key={course.id} href={`/student/courses/${course.id}`}>
                  <Card className="surface-elevated h-full cursor-pointer transition-[background-color,box-shadow,transform] hover:bg-muted/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="line-clamp-1 text-base">
                        {course.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-1">
                        {course.studyProgram?.name || "General"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-4 line-clamp-2 text-sm text-pretty text-muted-foreground">
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
                  You&apos;re not enrolled in any courses yet. Contact your
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
              <Link key={club.id} href={`/student/clubs/${club.id}`}>
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
                <Users className="h-8 w-8 text-muted-foreground/50" />
                <h3 className="mt-4 font-medium">No Clubs Available</h3>
                <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
                  Student clubs will appear here once they&apos;re created by
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
