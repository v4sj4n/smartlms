import { getServerSession } from "next-auth"
import { notFound, redirect } from "next/navigation"

import { authOptions } from "@/lib/auth"
import { getCourseById } from "@/lib/actions/courses"
import { getQuizById } from "@/lib/actions/quizzes"
import { QuizSession } from "@/components/student-quiz-session"
import { BreadcrumbLabels } from "@/components/breadcrumb-labels"

export default async function StudentCourseQuizSessionPage({
  params,
}: {
  params: Promise<{ id: string; quizId: string }>
}) {
  const { id, quizId } = await params

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

  const { data: quiz, success: quizSuccess } = await getQuizById(quizId)

  if (!quizSuccess || !quiz) {
    notFound()
  }

  const week = (course.weeks || []).find((item) => item.id === quiz.weekId)

  if (!week) {
    notFound()
  }

  return (
    <>
      <BreadcrumbLabels
        labels={{
          [`/student/courses/${course.id}`]: course.title,
          [`/student/courses/${course.id}/quizzes`]: "Quizzes",
          [`/student/courses/${course.id}/quizzes/${quiz.id}`]: quiz.title,
        }}
      />
      <QuizSession
        courseId={course.id}
        courseTitle={course.title}
        quizId={quiz.id}
        quizTitle={quiz.title}
        weekTitle={`Week ${week.weekNumber}: ${week.title}`}
        backHref={`/student/courses/${course.id}?weekId=${week.id}`}
        questions={quiz.questions}
        timeLimitMinutes={quiz.timeLimitMinutes}
        userId={session.user.id}
      />
    </>
  )
}
