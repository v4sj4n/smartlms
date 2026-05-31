import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"

import { authOptions } from "@/lib/auth"
import { getCourses } from "@/lib/actions/courses"
import {
  getProfessorDashboardPriorities,
  getPendingSubmissions,
  getUpcomingDeadlines,
  getQuizPerformance,
} from "@/lib/actions/dashboard-intelligence"
import { getAnnouncements } from "@/lib/actions/announcements"
import { DashboardPriorityPanel } from "@/components/dashboard-priority-panel"
import { ProfessorAffirmationCard } from "@/components/professor/professor-affirmation-card"
import { TeachingSchedule } from "@/components/professor/teaching-schedule"
import { RecentSubmissionsPanel } from "@/components/professor/recent-submissions-panel"
import { UpcomingDeadlinesPanel } from "@/components/professor/upcoming-deadlines-panel"
import { QuizPerformanceCard } from "@/components/professor/quiz-performance-card"
import { WeekCalendar } from "@/components/student/week-calendar"
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
  BarChart3,
  TrendingUp,
  Award,
  FileText,
  CheckCircle,
  Pin,
  HelpCircle,
} from "lucide-react"

export default async function ProfessorDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "PROFESSOR") {
    redirect("/sign-in")
  }

  const displayName = getUserDisplayName(session.user)

  const [{ data: courses }, priorities, { data: announcements }] =
    await Promise.all([
      getCourses({ teacherId: session.user.id }),
      getProfessorDashboardPriorities(session.user.id),
      getAnnouncements({ scope: "global", limit: 5 }),
    ])

  const myCourses = courses || []

  // Get all course IDs for fetching dashboard data
  const courseIds = myCourses.map((c) => c.id)

  // Fetch data for all courses
  const [pendingSubmissions, upcomingDeadlines, quizPerformance] =
    await Promise.all([
      getPendingSubmissions(courseIds),
      getUpcomingDeadlines(courseIds),
      getQuizPerformance(courseIds),
    ])

  // Calculate totals across all courses
  const totalStudents = myCourses.reduce(
    (acc, course) => acc + (course.enrollments?.length || 0),
    0
  )
  const totalQuizzes = myCourses.reduce(
    (acc, course) =>
      acc +
      (course.weeks?.reduce(
        (wAcc, week) =>
          wAcc + ((week as { quizzes?: unknown[] }).quizzes?.length || 0),
        0
      ) || 0),
    0
  )
  const totalMaterials = myCourses.reduce(
    (acc, course) =>
      acc +
      (course.weeks?.reduce(
        (wAcc, week) =>
          wAcc + ((week as { materials?: unknown[] }).materials?.length || 0),
        0
      ) || 0),
    0
  )

  if (myCourses.length === 0) {
    return (
      <div className="flex-1 space-y-6">
        <div
          className="reveal-in flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ animationDelay: "0ms" }}
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              Welcome back, {displayName}!
            </h1>
            <p className="mt-1 text-pretty text-muted-foreground">
              Ready to inspire and guide your students today.
            </p>
          </div>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <BookOpen className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="mt-4 font-semibold text-balance">
              No Courses Assigned
            </h3>
            <p className="mt-1.5 max-w-sm text-center text-sm text-pretty text-muted-foreground">
              You haven&apos;t been assigned to any courses yet. Contact your
              administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6">
      {/* Welcome Header - Same pattern as student */}
      <div
        className="reveal-in flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        style={{ animationDelay: "0ms" }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            Welcome back, {displayName}!
          </h1>
          <p className="mt-1 text-pretty text-muted-foreground">
            Here&apos;s what&apos;s happening with your teaching today.
          </p>
        </div>
        <div className="flex flex-col items-start gap-0.5 sm:items-end">
          <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
            {(() => {
              const d = new Date()
              const day = d.getUTCDay() || 7
              const tmp = new Date(
                Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
              )
              tmp.setUTCDate(tmp.getUTCDate() + 4 - day)
              const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
              const week = Math.ceil(
                ((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
              )
              return `Week ${week} / ${d.getFullYear()}`
            })()}
          </span>
          <span className="text-sm text-muted-foreground">
            <span className="font-mono font-semibold text-foreground tabular-nums">
              {myCourses.length}
            </span>{" "}
            {myCourses.length === 1 ? "course" : "courses"} ·{" "}
            <span className="font-mono font-semibold text-foreground tabular-nums">
              {totalStudents}
            </span>{" "}
            {totalStudents === 1 ? "student" : "students"}
          </span>
        </div>
      </div>

      {/* Week Calendar - Same as student */}
      <div className="reveal-in" style={{ animationDelay: "120ms" }}>
        <WeekCalendar />
      </div>

      {/* Main two-column layout: tabs on the left, panel widgets on the right - Same as student */}
      <div
        className="reveal-in grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_300px]"
        style={{ animationDelay: "180ms" }}
      >
        {/* Main Content Tabs - Same pattern as student */}
        <Tabs defaultValue="overview" className="space-y-4">
          <div className="relative">
            <TabsList
              className="w-full overflow-x-auto overflow-y-hidden sm:w-auto [&::-webkit-scrollbar]:hidden"
              aria-label="Dashboard sections"
            >
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="courses">
                My Courses
                {myCourses.length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 font-mono text-[10px] font-bold text-primary tabular-nums">
                    {myCourses.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="announcements">Announcements</TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab - Professor's main dashboard */}
          <TabsContent value="overview" className="space-y-4">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <Card className="surface-elevated">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    My Courses
                  </CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">
                    {myCourses.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {myCourses.length === 1
                      ? "Active course"
                      : "Active courses"}
                  </p>
                </CardContent>
              </Card>

              <Card className="surface-elevated">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Students
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">
                    {totalStudents}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enrolled across all courses
                  </p>
                </CardContent>
              </Card>

              <Card className="surface-elevated">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Pending Reviews
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">
                    {pendingSubmissions.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Submissions to grade
                  </p>
                </CardContent>
              </Card>

              <Card className="surface-elevated">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Quizzes</CardTitle>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">
                    {totalQuizzes}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Published quizzes
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Submissions & Deadlines Row */}
            <div className="grid gap-4 md:grid-cols-2">
              <RecentSubmissionsPanel submissions={pendingSubmissions} />
              <UpcomingDeadlinesPanel deadlines={upcomingDeadlines} />
            </div>

            {/* Quiz Performance */}
            <QuizPerformanceCard performances={quizPerformance} />
          </TabsContent>

          {/* Courses Tab - Similar to student's My Courses */}
          <TabsContent value="courses" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">My Teaching Courses</h3>
              <Link href="/professor/courses">
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
              {myCourses.map((course) => (
                <Link key={course.id} href={`/professor/courses/${course.id}`}>
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
                          <Users className="h-3 w-3" aria-hidden="true" />
                          {course.enrollments?.length || 0} students
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" aria-hidden="true" />
                          {course.weeks?.length || 0} weeks
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Today&apos;s Teaching Schedule
              </h3>
            </div>
            <TeachingSchedule courses={myCourses} />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Teaching Analytics</h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="surface-elevated">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Avg Quiz Score
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">
                      {quizPerformance.length > 0
                        ? Math.round(
                            quizPerformance.reduce(
                              (a, b) => a + b.averageScore,
                              0
                            ) / quizPerformance.length
                          )
                        : 0}
                      %
                    </p>
                  </div>
                  <Award className="h-5 w-5 text-primary" />
                </CardContent>
              </Card>

              <Card className="surface-elevated">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Total Attempts
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">
                      {quizPerformance.reduce((a, b) => a + b.totalAttempts, 0)}
                    </p>
                  </div>
                  <FileText className="h-5 w-5 text-primary" />
                </CardContent>
              </Card>

              <Card className="surface-elevated">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Highest Score
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">
                      {quizPerformance.length > 0
                        ? Math.max(
                            ...quizPerformance.map((p) => p.highestScore)
                          )
                        : 0}
                      %
                    </p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-primary" />
                </CardContent>
              </Card>

              <Card className="surface-elevated">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Materials Created
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">
                      {totalMaterials}
                    </p>
                  </div>
                  <BarChart3 className="h-5 w-5 text-primary" />
                </CardContent>
              </Card>
            </div>

            <Card className="surface-elevated">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Quiz Performance by Course
                </CardTitle>
                <CardDescription>
                  Average scores across all your courses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {quizPerformance.length > 0 ? (
                    quizPerformance.slice(0, 5).map((perf) => (
                      <div key={perf.quizId} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-sm font-medium">
                            {perf.quizTitle}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {perf.courseTitle}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${perf.averageScore}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-foreground">
                              {perf.averageScore}%
                            </span>{" "}
                            avg
                          </span>
                          <span>{perf.totalAttempts} attempts</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <BarChart3 className="h-8 w-8 text-muted-foreground/60" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        No quiz data yet
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="surface-elevated">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Student Enrollment by Course
                </CardTitle>
                <CardDescription>Current enrollment numbers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {myCourses.map((course) => {
                    const count = course.enrollments?.length || 0
                    const maxStudents = 50 // Assuming max capacity
                    return (
                      <div key={course.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-sm font-medium">
                            {course.title}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={count > 0 ? "default" : "secondary"}
                            >
                              {count > 0 ? "Active" : "Empty"}
                            </Badge>
                            <span className="w-10 text-right text-sm font-semibold tabular-nums">
                              {count}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.min((count / maxStudents) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Announcements Tab - Same as student */}
          <TabsContent value="announcements" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">System Announcements</h3>
            </div>

            {announcements && announcements.length > 0 ? (
              <div className="grid gap-3">
                {announcements.map((announcement) => (
                  <Card
                    key={announcement.id}
                    className={announcement.isPinned ? "bg-primary/3" : ""}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-2">
                        {announcement.isPinned && (
                          <Pin
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                            aria-hidden="true"
                          />
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
                            {new Date(
                              announcement.publishedAt
                            ).toLocaleDateString()}
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
                    <CheckCircle
                      className="h-7 w-7 text-muted-foreground/60"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="mt-4 font-semibold text-balance">All Clear</h3>
                  <p className="mt-1.5 max-w-sm text-center text-sm text-pretty text-muted-foreground">
                    No system announcements at this time. Check back later for
                    updates.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Right Panel: Affirmation + Priority Panel - Same as student */}
        <div className="flex flex-col gap-4">
          <ProfessorAffirmationCard />
          <DashboardPriorityPanel
            important={priorities.important}
            notImportant={priorities.notImportant}
            title="Teaching Priorities"
          />
        </div>
      </div>
    </div>
  )
}
