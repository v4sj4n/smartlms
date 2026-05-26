import * as React from "react"
import { requireRole } from "@/lib/auth-guard"
import { db } from "@/db"
import { courseEnrollments, courses, users } from "@/db/schema"
import { eq } from "drizzle-orm"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BookOpen, GraduationCap, ArrowRight, LayoutGrid } from "lucide-react"
import Link from "next/link"

export default async function StudentCoursesPage() {
  const user = await requireRole(["STUDENT"])

  // Fetch enrolled courses
  const enrolledCourses = await db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      semester: courses.semester,
      teacherName: users.name,
    })
    .from(courseEnrollments)
    .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
    .leftJoin(users, eq(courses.teacherId, users.id))
    .where(eq(courseEnrollments.studentId, user.id))

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8">
      <div className="reveal-in" style={{ animationDelay: "0ms" }}>
        <div>
          <h1 className="flex items-center gap-3 font-heading text-2xl font-bold text-balance sm:text-3xl">
            <BookOpen className="h-7 w-7 shrink-0 text-primary sm:h-8 sm:w-8" />
            My Courses
          </h1>
          <p className="mt-2 text-pretty text-muted-foreground">
            View and access all the courses you are currently enrolled in.
          </p>
        </div>
      </div>

      {enrolledCourses.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {enrolledCourses.map((course) => (
            <Card
              key={course.id}
              className="surface-elevated reveal-in group flex flex-col rounded-2xl border border-border/40"
              style={{ animationDelay: "80ms" }}
            >
              <CardHeader className="pb-4">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary transition-transform duration-300 group-hover:scale-110">
                    <LayoutGrid className="h-5 w-5" />
                  </div>
                  <Badge
                    variant="secondary"
                    className="border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] whitespace-nowrap text-primary uppercase"
                  >
                    {course.semester} Semester
                  </Badge>
                </div>
                <CardTitle className="line-clamp-2 font-heading text-xl leading-tight font-bold">
                  {course.title}
                </CardTitle>
                <CardDescription className="mt-2 line-clamp-2 text-sm leading-relaxed text-pretty">
                  {course.description ||
                    "No description provided for this course."}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex-1 pb-6">
                <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-muted/30 p-3 text-sm font-medium text-muted-foreground">
                  <GraduationCap className="h-4.5 w-4.5 text-primary" />
                  <span className="truncate">
                    Prof. {course.teacherName || "Unassigned"}
                  </span>
                </div>
              </CardContent>
              <div className="px-6 pt-0 pb-6">
                <Link href={`/student/courses/${course.id}`}>
                  <Button className="w-full gap-2 rounded-xl py-5 shadow-sm transition-[background-color,transform] duration-150 ease-out group-hover:bg-primary/90 active:scale-[0.96]">
                    Enter Course{" "}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex min-h-100 flex-col items-center justify-center rounded-3xl border border-border/40 bg-muted/10 p-12 text-center shadow-sm">
          <div className="mb-4 rounded-full bg-primary/10 p-4">
            <BookOpen className="h-12 w-12 text-primary" />
          </div>
          <h3 className="mb-2 font-heading text-xl font-bold">
            No Courses Found
          </h3>
          <p className="mx-auto max-w-md text-pretty text-muted-foreground">
            You are not enrolled in any courses for the current semester. Please
            check back later or contact your academic advisor.
          </p>
        </Card>
      )}
    </div>
  )
}
