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
  Clock,
  MapPin,
  Pin,
} from "lucide-react"
import Link from "next/link"
import { AffirmationCard } from "@/components/student/affirmation-card"
import { TaskPlanner } from "@/components/student/task-planner"
import { WeekCalendar } from "@/components/student/week-calendar"

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
            Welcome back, {displayName}!
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
              className="transition-[transform] duration-150 ease-out active:scale-[0.96]"
            >
              <BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />
              My Courses
            </Button>
          </Link>
          <Link href="/student/clubs">
            <Button
              size="sm"
              className="transition-[transform] duration-150 ease-out active:scale-[0.96]"
            >
              <Users className="mr-2 h-4 w-4" aria-hidden="true" />
              Explore Clubs
            </Button>
          </Link>
        </div>
      </div>

      {/* Week Calendar */}
      <div
        className="reveal-in"
        style={{ animationDelay: "120ms" }}
      >
        <WeekCalendar />
      </div>

      {/* Main two-column layout: tabs on the left, panel widgets on the right */}
      <div
        className="reveal-in grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_300px]"
        style={{ animationDelay: "180ms" }}
      >
        {/* Main Content Tabs */}
        <Tabs defaultValue="schedule" className="space-y-4">
          <div className="relative">
            <TabsList className="w-full overflow-x-auto sm:w-auto" aria-label="Dashboard sections">
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="courses">
                My Courses
                {enrolledCourses.length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 font-mono text-[10px] font-bold tabular-nums text-primary">
                    {enrolledCourses.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="clubs">Clubs</TabsTrigger>
              <TabsTrigger value="announcements">Announcements</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="schedule" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Today&apos;s Schedule</h3>
            </div>

            {enrolledCourses.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {enrolledCourses.slice(0, 5).map((course, i) => {
                  const times = [
                    "09:00 – 10:30",
                    "11:00 – 12:30",
                    "14:00 – 15:00",
                    "15:30 – 17:00",
                    "17:15 – 18:15",
                  ]
                  const durations = ["90 min", "90 min", "60 min", "90 min", "60 min"]
                  return (
                    <Link key={course.id} href={`/student/courses/${course.id}`}>
                      <div
                        className="surface-elevated grid cursor-pointer overflow-hidden rounded-2xl bg-card transition-[box-shadow,transform] hover:bg-muted/50"
                        style={{ gridTemplateColumns: "1fr auto" }}
                      >
                        <div className="flex flex-col gap-1 px-4 py-3.5">
                          <span className="line-clamp-1 text-sm font-semibold text-foreground">
                            {course.title}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {course.studyProgram?.name || "General"}
                          </span>
                        </div>
                        <div className="flex flex-col items-end justify-center gap-0.5 px-4 py-3.5">
                          <span className="flex items-center gap-1 font-mono text-xs font-medium text-foreground">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {times[i % times.length]}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {durations[i % durations.length]}
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    <Clock className="h-7 w-7 text-muted-foreground/60" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-semibold text-balance">No Classes Today</h3>
                  <p className="mt-1.5 max-w-sm text-center text-sm text-pretty text-muted-foreground">
                    You have no scheduled classes for today.
                  </p>
                </CardContent>
              </Card>
            )}

          </TabsContent>

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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
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
                            <BookOpen className="h-3 w-3" aria-hidden="true" />
                            {course.weeks?.length || 0} weeks
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" aria-hidden="true" />
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
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    <BookOpen className="h-7 w-7 text-muted-foreground/60" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-semibold text-balance">No Enrolled Courses</h3>
                  <p className="mt-1.5 max-w-sm text-center text-sm text-pretty text-muted-foreground">
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

            {clubs && clubs.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
                {clubs.slice(0, 6).map((club) => (
                  <Link key={club.id} href={`/student/clubs/${club.id}`}>
                    <Card className="surface-elevated h-full cursor-pointer transition-[background-color,box-shadow,transform] hover:bg-muted/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{club.name}</CardTitle>
                        <CardDescription>
                          <span className="tabular-nums">{club.members?.length || 0}</span> members
                          {" · "}
                          <span className="tabular-nums">{club.materials?.length || 0}</span> materials
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
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    <Users className="h-7 w-7 text-muted-foreground/60" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-semibold text-balance">No Clubs Available</h3>
                  <p className="mt-1.5 max-w-sm text-center text-sm text-pretty text-muted-foreground">
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
              <div className="grid gap-3">
                {announcements.map((announcement) => (
                  <Card
                    key={announcement.id}
                    className={announcement.isPinned ? "border-l-[3px] border-l-primary" : ""}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-2">
                        {announcement.isPinned && (
                          <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                        )}
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base text-balance">
                            {announcement.title}
                          </CardTitle>
                          <CardDescription className="mt-0.5">
                            By{" "}
                            {announcement.author?.fullName ||
                              announcement.author?.name ||
                              "Unknown"}
                            {" · "}
                            {new Date(announcement.publishedAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        {announcement.isPinned && (
                          <Badge variant="secondary" className="shrink-0">
                            Pinned
                          </Badge>
                        )}
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
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    <CheckCircle className="h-7 w-7 text-muted-foreground/60" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-semibold text-balance">All Clear</h3>
                  <p className="mt-1.5 max-w-sm text-center text-sm text-pretty text-muted-foreground">
                    No system announcements at this time. Check back later for updates.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Right Panel: Affirmation + Task Planner only */}
        <div className="flex flex-col gap-4">
          <AffirmationCard />
          <TaskPlanner />
        </div>
      </div>
    </div>
  )
}
