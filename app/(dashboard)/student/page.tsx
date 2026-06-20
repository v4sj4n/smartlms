import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { getCourses } from "@/lib/actions/courses"
import { getStudentDashboardPriorities } from "@/lib/actions/dashboard-intelligence"
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
import { DashboardPriorityPanel } from "@/components/dashboard-priority-panel"
import {
  BookOpen,
  Users,
  ArrowRight,
  CheckCircle,
  Clock,
  Pin,
  FileText,
  BarChart3,
  GraduationCap,
  TrendingUp,
  Award,
} from "lucide-react"
import Link from "next/link"
import { AffirmationCard } from "@/components/student/affirmation-card"
import { WeekCalendar } from "@/components/student/week-calendar"
import { ScheduleList } from "@/components/student/schedule-list"
import { getStudentProgressSummary } from "@/lib/data/student-progress"

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "STUDENT") {
    redirect("/sign-in")
  }

  const [{ data: allCourses }, { data: announcements }] = await Promise.all([
    getCourses(),
    getAnnouncements({ scope: "global", limit: 5 }),
  ])

  const { important, notImportant } = await getStudentDashboardPriorities(
    session.user.id
  )

  const progressSummary = await getStudentProgressSummary(session.user.id)

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
      {/* Week Calendar */}
      <div className="reveal-in" style={{ animationDelay: "120ms" }}>
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
            <TabsList
              className="w-full overflow-x-auto overflow-y-hidden sm:w-auto [&::-webkit-scrollbar]:hidden"
              aria-label="Dashboard sections"
            >
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="courses">
                My Courses
                {enrolledCourses.length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 font-mono text-[10px] font-bold text-primary tabular-nums">
                    {enrolledCourses.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="announcements">Announcements</TabsTrigger>
              <TabsTrigger value="stats">Stats</TabsTrigger>
              <TabsTrigger value="grades">Grades</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="schedule" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Today&apos;s Schedule</h3>
            </div>

            <ScheduleList courses={enrolledCourses} />
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
                    <BookOpen
                      className="h-7 w-7 text-muted-foreground/60"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="mt-4 font-semibold text-balance">
                    No Enrolled Courses
                  </h3>
                  <p className="mt-1.5 max-w-sm text-center text-sm text-pretty text-muted-foreground">
                    You&apos;re not enrolled in any courses yet. Contact your
                    administrator or academic advisor.
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

          <TabsContent value="stats" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Statistics</h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="surface-elevated">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Completed Quizzes
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">12</p>
                  </div>
                  <Award className="h-5 w-5 text-primary" />
                </CardContent>
              </Card>

              <Card className="surface-elevated">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Submitted Assignments
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">
                      {progressSummary.submittedAssignments}
                    </p>
                  </div>
                  <FileText className="h-5 w-5 text-primary" />
                </CardContent>
              </Card>

              <Card className="surface-elevated">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Course Progress
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">
                      {progressSummary.courseProgressPercent}%
                    </p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-primary" />
                </CardContent>
              </Card>

              {progressSummary.averageGradePercent !== null && (
                <Card className="surface-elevated">
                  <CardContent className="flex items-center justify-between p-5">
                    <div>
                      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        Average Grade
                      </p>
                      <p className="mt-1 text-2xl font-bold tabular-nums">
                        {progressSummary.averageGradePercent}%
                      </p>
                    </div>
                    <Award className="h-5 w-5 text-primary" />
                  </CardContent>
                </Card>
              )}
            </div>

            <Card className="surface-elevated">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Assignments by Course
                </CardTitle>
                <CardDescription>
                  Overview of submitted and pending assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {enrolledCourses.length > 0 ? (
                    enrolledCourses.slice(0, 4).map((course, i) => {
                      const submitted = [4, 2, 1, 3]
                      const pending = [1, 2, 0, 1]
                      return (
                        <div key={course.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="truncate text-sm font-medium">
                              {course.title}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {submitted[i % submitted.length]}/
                              {submitted[i % submitted.length] +
                                pending[i % pending.length]}{" "}
                              submitted
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${(submitted[i % submitted.length] / (submitted[i % submitted.length] + pending[i % pending.length])) * 100}%`,
                              }}
                            />
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <div className="h-2 w-2 rounded-full bg-primary" />
                              {submitted[i % submitted.length]} submitted
                            </span>
                            <span className="flex items-center gap-1">
                              <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                              {pending[i % pending.length]} pending
                            </span>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <BarChart3 className="h-8 w-8 text-muted-foreground/60" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Enroll in courses to see assignment statistics
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="surface-elevated">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quizzes by Course</CardTitle>
                <CardDescription>
                  Overview of completed and upcoming quizzes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {enrolledCourses.length > 0 ? (
                    enrolledCourses.slice(0, 4).map((course, i) => {
                      const completed = [3, 2, 1, 4]
                      const upcoming = [1, 1, 2, 0]
                      return (
                        <div key={course.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="truncate text-sm font-medium">
                              {course.title}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {completed[i % completed.length]}/
                              {completed[i % completed.length] +
                                upcoming[i % upcoming.length]}{" "}
                              completed
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${(completed[i % completed.length] / (completed[i % completed.length] + upcoming[i % upcoming.length])) * 100}%`,
                              }}
                            />
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-primary" />
                              {completed[i % completed.length]} completed
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {upcoming[i % upcoming.length]} upcoming
                            </span>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Award className="h-8 w-8 text-muted-foreground/60" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Enroll in courses to see quiz statistics
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="grades" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Grades</h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="surface-elevated">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Average Grade
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">85%</p>
                  </div>
                  <GraduationCap className="h-5 w-5 text-primary" />
                </CardContent>
              </Card>

              <Card className="surface-elevated">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Highest Grade
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">96%</p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-primary" />
                </CardContent>
              </Card>

              <Card className="surface-elevated">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Lowest Grade
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">78%</p>
                  </div>
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>

              <Card className="surface-elevated">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Passing Rate
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">100%</p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-primary" />
                </CardContent>
              </Card>
            </div>

            <Card className="surface-elevated">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Grade Distribution by Course
                </CardTitle>
                <CardDescription>
                  Your current grades across all courses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {enrolledCourses.length > 0 ? (
                    enrolledCourses.slice(0, 4).map((course, i) => {
                      const grades = [92, 88, 85, 79]
                      const grade = grades[i % grades.length]
                      const getGradeColor = (g: number) => {
                        if (g >= 90) return "bg-primary"
                        if (g >= 80) return "bg-secondary"
                        if (g >= 70) return "bg-muted-foreground"
                        return "bg-destructive"
                      }
                      return (
                        <div key={course.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="truncate text-sm font-medium">
                              {course.title}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={grade >= 80 ? "default" : "secondary"}
                              >
                                {grade >= 90
                                  ? "A"
                                  : grade >= 80
                                    ? "B"
                                    : grade >= 70
                                      ? "C"
                                      : "D"}
                              </Badge>
                              <span className="w-10 text-right text-sm font-semibold tabular-nums">
                                {grade}%
                              </span>
                            </div>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${getGradeColor(grade)}`}
                              style={{ width: `${grade}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <BarChart3 className="h-8 w-8 text-muted-foreground/60" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Enroll in courses to see grade distribution
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="surface-elevated">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Recent Grade Updates
                </CardTitle>
                <CardDescription>
                  Latest grade changes and feedback
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        Advanced Machine Learning
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Quiz 3: 92% (+5% from last quiz)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10">
                      <CheckCircle className="h-5 w-5 text-secondary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        Data Visualization Studio
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Assignment 2: 88% (stable)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted-foreground/10">
                      <Award className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Robotics & AI</p>
                      <p className="text-xs text-muted-foreground">
                        Midterm Exam: 85% (first attempt)
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Right Panel: Affirmation + Task Planner only */}
        <div className="flex flex-col gap-4">
          <AffirmationCard />
          <DashboardPriorityPanel
            important={important}
            notImportant={notImportant}
            title="Tasks"
          />
        </div>
      </div>
    </div>
  )
}
