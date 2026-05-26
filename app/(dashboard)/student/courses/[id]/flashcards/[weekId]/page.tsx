import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"

import { authOptions } from "@/lib/auth"
import { getCourseById } from "@/lib/actions/courses"
import { FlashcardStudySession } from "@/components/student-flashcard-session"
import { BreadcrumbLabels } from "@/components/breadcrumb-labels"

export default async function StudentCourseFlashcardSessionPage({
  params,
}: {
  params: Promise<{ id: string; weekId: string }>
}) {
  const { id, weekId } = await params

  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "STUDENT") {
    redirect("/sign-in")
  }

  const { data: course, success } = await getCourseById(id)

  if (!success || !course) {
    notFound()
  }

  const enrollments = course.enrollments || []
  const isEnrolled = enrollments.some(
    (enrollment: { studentId: string }) =>
      enrollment.studentId === session.user.id
  )

  if (!isEnrolled) {
    redirect("/student/courses")
  }

  const week = (course.weeks || []).find((item) => item.id === weekId)

  if (!week) {
    notFound()
  }

  return (
    <>
      <BreadcrumbLabels
        labels={{
          [`/student/courses/${course.id}`]: course.title,
          [`/student/courses/${course.id}/flashcards`]: "Flashcards",
          [`/student/courses/${course.id}/flashcards/${week.id}`]: `Week ${week.weekNumber}: ${week.title}`,
        }}
      />
      <FlashcardStudySession
        courseId={course.id}
        courseTitle={course.title}
        weekId={week.id}
        weekTitle={`Week ${week.weekNumber}: ${week.title}`}
        backHref={`/student/courses/${course.id}?weekId=${week.id}`}
        flashcards={(week.flashcards || []).filter(
          (f) => f.status === "PUBLISHED"
        )}
        userId={session.user.id}
      />
    </>
  )
}
