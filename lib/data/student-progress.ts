import { db } from "@/db"
import {
  courseEnrollments,
  courseWeeks,
  assignments,
  submissions,
  quizAttempts,
  quizzes,
} from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"

export type StudentProgressSummary = {
  submittedAssignments: number
  totalPublishedAssignments: number
  courseProgressPercent: number
  averageGradePercent: number | null
}

export async function getStudentProgressSummary(
  studentId: string
): Promise<StudentProgressSummary> {
  const enrollments = await db.query.courseEnrollments.findMany({
    where: eq(courseEnrollments.studentId, studentId),
    with: {
      course: {
        with: {
          weeks: {
            with: {
              assignments: {
                where: eq(assignments.isPublished, true),
                columns: { id: true },
              },
            },
          },
        },
      },
    },
  })

  let totalPublishedAssignments = 0
  for (const enrollment of enrollments) {
    for (const week of enrollment.course?.weeks ?? []) {
      totalPublishedAssignments += week.assignments?.length ?? 0
    }
  }

  const assignmentSubs = await db.query.submissions.findMany({
    where: and(
      eq(submissions.studentId, studentId),
      eq(submissions.type, "assignment")
    ),
    columns: { id: true, score: true, maxScore: true, status: true },
  })

  const submittedAssignments = assignmentSubs.filter(
    (s) =>
      s.status === "submitted" || s.status === "late" || s.status === "graded"
  ).length

  const gradedSubs = assignmentSubs.filter(
    (s) => s.score !== null && s.maxScore > 0
  )
  const averageGradePercent =
    gradedSubs.length > 0
      ? Math.round(
          gradedSubs.reduce(
            (sum, s) => sum + (s.score! / s.maxScore) * 100,
            0
          ) / gradedSubs.length
        )
      : null

  const courseIds = enrollments.map((e) => e.courseId)
  let completedQuizCount = 0
  let totalQuizCount = 0

  if (courseIds.length > 0) {
    const weeks = await db.query.courseWeeks.findMany({
      where: inArray(courseWeeks.courseId, courseIds),
      columns: { id: true },
    })
    const weekIds = weeks.map((w) => w.id)

    if (weekIds.length > 0) {
      const courseQuizzes = await db.query.quizzes.findMany({
        where: and(
          inArray(quizzes.weekId, weekIds),
          eq(quizzes.status, "PUBLISHED")
        ),
        columns: { id: true },
      })
      totalQuizCount = courseQuizzes.length

      if (totalQuizCount > 0) {
        const attempts = await db.query.quizAttempts.findMany({
          where: eq(quizAttempts.userId, studentId),
          columns: { quizId: true },
        })
        const attemptedIds = new Set(attempts.map((a) => a.quizId))
        completedQuizCount = courseQuizzes.filter((q) =>
          attemptedIds.has(q.id)
        ).length
      }
    }
  }

  const totalItems = totalPublishedAssignments + totalQuizCount
  const completedItems = submittedAssignments + completedQuizCount
  const courseProgressPercent =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  return {
    submittedAssignments,
    totalPublishedAssignments,
    courseProgressPercent,
    averageGradePercent,
  }
}

export async function getStudentCourseGrades(
  studentId: string,
  courseId: string
) {
  const weeks = await db.query.courseWeeks.findMany({
    where: eq(courseWeeks.courseId, courseId),
    with: {
      assignments: {
        where: eq(assignments.isPublished, true),
      },
      quizzes: {
        where: eq(quizzes.status, "PUBLISHED"),
      },
    },
    orderBy: (w, { asc }) => [asc(w.weekNumber)],
  })

  const assignmentIds = weeks.flatMap((w) =>
    (w.assignments ?? []).map((a) => a.id)
  )
  const quizIds = weeks.flatMap((w) => (w.quizzes ?? []).map((q) => q.id))

  const assignmentSubs =
    assignmentIds.length > 0
      ? await db.query.submissions.findMany({
          where: and(
            eq(submissions.studentId, studentId),
            eq(submissions.type, "assignment"),
            inArray(submissions.referenceId, assignmentIds)
          ),
        })
      : []

  const quizAttemptRows =
    quizIds.length > 0
      ? await db.query.quizAttempts.findMany({
          where: and(
            eq(quizAttempts.userId, studentId),
            inArray(quizAttempts.quizId, quizIds)
          ),
        })
      : []

  return {
    weeks,
    assignmentSubs,
    quizAttempts: quizAttemptRows,
  }
}
