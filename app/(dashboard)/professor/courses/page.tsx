import * as React from "react"
import { requireCourseAccess } from "@/lib/permissions/route-guards"
import { getCourses } from "@/lib/actions/courses"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BookOpen, Clock, LayoutGrid, ArrowRight } from "lucide-react"
import Link from "next/link"

export default async function ProfessorCoursesPage() {
  const user = await requireCourseAccess("", "read") // Empty courseId for general course access

  const { data: taughtCourses } = await getCourses({ teacherId: user.id })

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8">
      <div
        className="reveal-in flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
        style={{ animationDelay: "0ms" }}
      >
        <div>
          <h1 className="flex items-center gap-3 font-heading text-2xl font-bold text-balance sm:text-3xl">
            <BookOpen className="h-7 w-7 shrink-0 text-primary sm:h-8 sm:w-8" />
            My Courses
          </h1>
          <p className="mt-2 text-pretty text-muted-foreground">
            View and manage your assigned courses. Click on a course to view
            folders, add content, and manage quizzes.
          </p>
        </div>
      </div>

      {taughtCourses && taughtCourses.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {taughtCourses.map(
            (course: {
              id: string
              title: string
              description?: string | null
              semester: string | null
              studyProgram?: { name: string } | null
            }) => (
              <Link
                key={course.id}
                href={`/professor/courses/${course.id}`}
                className="group block"
              >
                <Card
                  className="surface-elevated reveal-in flex h-full flex-col rounded-2xl border border-border/40 transition-[box-shadow,transform,border-color] group-hover:border-primary/50"
                  style={{ animationDelay: "80ms" }}
                >
                  <CardHeader className="pb-4">
                    <div className="mb-2 flex items-start gap-4">
                      <div className="rounded-xl bg-primary/10 p-2.5 text-primary transition-transform duration-300 group-hover:scale-110">
                        <LayoutGrid className="h-5 w-5" />
                      </div>
                    </div>
                    <CardTitle className="line-clamp-2 font-heading text-xl leading-tight font-bold transition-colors group-hover:text-primary">
                      {course.title}
                    </CardTitle>
                    <CardDescription className="mt-2 line-clamp-2 text-sm leading-relaxed text-pretty">
                      {course.description ||
                        "No description provided for this course."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto flex-1 pb-6">
                    <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-muted/30 p-3 text-sm font-medium text-muted-foreground">
                      <Clock className="h-4.5 w-4.5 text-primary" />
                      <span>{course.semester || "N/A"} Semester</span>
                      {course.studyProgram?.name && (
                        <>
                          <span className="text-muted-foreground/50">•</span>
                          <span>{course.studyProgram.name}</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                  <div className="px-6 pt-0 pb-6">
                    <div className="flex items-center justify-between text-sm text-muted-foreground transition-colors group-hover:text-primary">
                      <span>Click to view course details</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Card>
              </Link>
            )
          )}
        </div>
      ) : (
        <Card className="flex min-h-100 flex-col items-center justify-center rounded-3xl border border-border/40 bg-muted/10 p-12 text-center shadow-sm">
          <div className="mb-4 rounded-full bg-primary/10 p-4">
            <BookOpen className="h-12 w-12 text-primary" />
          </div>
          <h3 className="mb-2 font-heading text-xl font-bold">
            No Assigned Courses
          </h3>
          <p className="mx-auto mb-6 max-w-md text-pretty text-muted-foreground">
            You haven&apos;t been assigned any courses yet. Contact the
            administration to get your courses assigned.
          </p>
        </Card>
      )}
    </div>
  )
}
