"use server"

import { db } from "@/db"
import { submissions, assignments, courseWeeks, courses } from "@/db/schema"
import { eq, and, desc, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth-guard"
import { createNotification } from "@/lib/actions/notifications"

// ============================================================================
// SUBMISSION ACTIONS
// ============================================================================

export async function getSubmissionForAssignment(
  assignmentId: string,
  studentId: string
) {
  try {
    const submission = await db.query.submissions.findFirst({
      where: and(
        eq(submissions.referenceId, assignmentId),
        eq(submissions.studentId, studentId),
        eq(submissions.type, "assignment")
      ),
      orderBy: (submissions, { desc }) => [desc(submissions.submittedAt)],
    })

    return { success: true, data: submission }
  } catch (error) {
    console.error("Failed to fetch submission:", error)
    return { success: false, error: "Failed to fetch submission" }
  }
}

export async function submitAssignment(data: {
  assignmentId: string
  weekId: string
  content?: string
  fileUrl?: string
  fileName?: string
}) {
  try {
    const user = await requireRole(["STUDENT"])
    const studentId = user.id

    const assignment = await db.query.assignments.findFirst({
      where: eq(assignments.id, data.assignmentId),
      columns: {
        id: true,
        dueDate: true,
        maxScore: true,
        allowLateSubmissions: true,
        submissionType: true,
      },
    })

    if (!assignment) {
      return { success: false, error: "Assignment not found" }
    }

    const now = new Date()
    const isLate = assignment.dueDate && now > assignment.dueDate
    if (isLate && !assignment.allowLateSubmissions) {
      return { success: false, error: "Assignment is past due date" }
    }

    if (assignment.submissionType === "file" && !data.fileUrl) {
      return { success: false, error: "This assignment requires a file upload" }
    }
    if (assignment.submissionType === "text" && !data.content) {
      return {
        success: false,
        error: "This assignment requires a text submission",
      }
    }

    const existingSubmission = await db.query.submissions.findFirst({
      where: and(
        eq(submissions.referenceId, data.assignmentId),
        eq(submissions.studentId, studentId),
        eq(submissions.type, "assignment")
      ),
    })

    if (existingSubmission) {
      const [submission] = await db
        .update(submissions)
        .set({
          content: data.content,
          fileUrl: data.fileUrl,
          submittedAt: new Date(),
          status: isLate ? "late" : "submitted",
        })
        .where(eq(submissions.id, existingSubmission.id))
        .returning()

      revalidatePath(`/student/courses`)
      return { success: true, data: submission, isUpdate: true }
    }

    const [submission] = await db
      .insert(submissions)
      .values({
        studentId,
        weekId: data.weekId,
        type: "assignment",
        referenceId: data.assignmentId,
        content: data.content,
        fileUrl: data.fileUrl,
        maxScore: assignment.maxScore,
        status: isLate ? "late" : "submitted",
      })
      .returning()

    revalidatePath(`/student/courses`)
    return { success: true, data: submission, isUpdate: false }
  } catch (error) {
    console.error("Failed to submit assignment:", error)
    return { success: false, error: "Failed to submit assignment" }
  }
}

export async function getStudentSubmissionsForCourse(
  courseId: string,
  studentId: string
) {
  try {
    const subs = await db.query.submissions.findMany({
      where: and(
        eq(submissions.studentId, studentId),
        eq(submissions.type, "assignment")
      ),
      with: {
        week: {
          with: {
            course: true,
          },
        },
      },
      orderBy: (submissions, { desc }) => [desc(submissions.submittedAt)],
    })

    const courseSubmissions = subs.filter(
      (sub) => sub.week?.course?.id === courseId
    )

    return { success: true, data: courseSubmissions }
  } catch (error) {
    console.error("Failed to fetch submissions:", error)
    return { success: false, error: "Failed to fetch submissions" }
  }
}

async function assertProfessorCourseAccess(
  courseId: string,
  userId: string,
  role: string
) {
  const course = await db.query.courses.findFirst({
    where: eq(courses.id, courseId),
    columns: { id: true, teacherId: true },
  })

  if (!course) {
    return { ok: false as const, error: "Course not found" }
  }

  if (role !== "ADMIN" && course.teacherId !== userId) {
    return { ok: false as const, error: "Forbidden" }
  }

  return { ok: true as const, course }
}

export async function getSubmissionsForCourse(
  courseId: string,
  filters?: { status?: "submitted" | "late" | "graded" }
) {
  try {
    const user = await requireRole(["ADMIN", "PROFESSOR"])
    const access = await assertProfessorCourseAccess(
      courseId,
      user.id,
      user.role
    )
    if (!access.ok) {
      return { success: false, error: access.error }
    }

    const weeks = await db.query.courseWeeks.findMany({
      where: eq(courseWeeks.courseId, courseId),
      columns: { id: true },
    })
    const weekIds = weeks.map((w) => w.id)

    if (weekIds.length === 0) {
      return { success: true, data: [] }
    }

    const subs = await db.query.submissions.findMany({
      where: and(
        eq(submissions.type, "assignment"),
        inArray(submissions.weekId, weekIds),
        filters?.status ? eq(submissions.status, filters.status) : undefined
      ),
      with: {
        student: {
          columns: {
            id: true,
            name: true,
            fullName: true,
            email: true,
          },
        },
        week: {
          columns: { id: true, weekNumber: true, title: true },
        },
      },
      orderBy: (submissions, { desc }) => [desc(submissions.submittedAt)],
    })

    const assignmentIds = [...new Set(subs.map((s) => s.referenceId))]
    const assignmentRows =
      assignmentIds.length > 0
        ? await db.query.assignments.findMany({
            where: inArray(assignments.id, assignmentIds),
            columns: { id: true, title: true, maxScore: true },
          })
        : []
    const assignmentMap = new Map(assignmentRows.map((a) => [a.id, a]))

    const enriched = subs.map((sub) => ({
      ...sub,
      assignment: assignmentMap.get(sub.referenceId) ?? null,
    }))

    return { success: true, data: enriched }
  } catch (error) {
    console.error("Failed to fetch course submissions:", error)
    return { success: false, error: "Failed to fetch submissions" }
  }
}

export async function getSubmissionById(submissionId: string) {
  try {
    const user = await requireRole(["ADMIN", "PROFESSOR"])

    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
      with: {
        student: {
          columns: {
            id: true,
            name: true,
            fullName: true,
            email: true,
          },
        },
        week: {
          with: {
            course: {
              columns: { id: true, title: true, teacherId: true },
            },
          },
        },
      },
    })

    if (!submission || !submission.week?.course) {
      return { success: false, error: "Submission not found" }
    }

    const access = await assertProfessorCourseAccess(
      submission.week.course.id,
      user.id,
      user.role
    )
    if (!access.ok) {
      return { success: false, error: access.error }
    }

    const assignment = await db.query.assignments.findFirst({
      where: eq(assignments.id, submission.referenceId),
    })

    return {
      success: true,
      data: {
        ...submission,
        assignment,
        course: submission.week.course,
      },
    }
  } catch (error) {
    console.error("Failed to fetch submission:", error)
    return { success: false, error: "Failed to fetch submission" }
  }
}

export async function gradeSubmission(data: {
  submissionId: string
  score: number
  feedback?: string
  rubricScores?: { name: string; points: number }[]
}) {
  try {
    const user = await requireRole(["ADMIN", "PROFESSOR"])

    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, data.submissionId),
      with: {
        week: {
          with: {
            course: {
              columns: { id: true, title: true, teacherId: true },
            },
          },
        },
      },
    })

    if (!submission || !submission.week?.course) {
      return { success: false, error: "Submission not found" }
    }

    const access = await assertProfessorCourseAccess(
      submission.week.course.id,
      user.id,
      user.role
    )
    if (!access.ok) {
      return { success: false, error: access.error }
    }

    if (data.score < 0 || data.score > submission.maxScore) {
      return {
        success: false,
        error: `Score must be between 0 and ${submission.maxScore}`,
      }
    }

    let feedbackText = data.feedback ?? ""
    if (data.rubricScores?.length) {
      const rubricLines = data.rubricScores
        .map((r) => `${r.name}: ${r.points} pts`)
        .join("\n")
      feedbackText = feedbackText
        ? `${feedbackText}\n\nRubric:\n${rubricLines}`
        : `Rubric:\n${rubricLines}`
    }

    const [graded] = await db
      .update(submissions)
      .set({
        score: data.score,
        feedback: feedbackText || null,
        status: "graded",
        gradedAt: new Date(),
        gradedBy: user.id,
      })
      .where(eq(submissions.id, data.submissionId))
      .returning()

    const assignment = await db.query.assignments.findFirst({
      where: eq(assignments.id, submission.referenceId),
      columns: { title: true },
    })

    await createNotification({
      userId: submission.studentId,
      type: "grade",
      title: "Assignment graded",
      body: `Your submission for "${assignment?.title ?? "assignment"}" in ${submission.week.course.title} has been graded: ${data.score}/${submission.maxScore}.`,
      href: `/student/courses/${submission.week.course.id}/assignments/${submission.referenceId}`,
    })

    revalidatePath(
      `/professor/courses/${submission.week.course.id}/submissions`
    )
    revalidatePath(
      `/professor/courses/${submission.week.course.id}/submissions/${submission.id}`
    )
    revalidatePath(
      `/student/courses/${submission.week.course.id}/assignments/${submission.referenceId}`
    )
    revalidatePath(`/student/courses/${submission.week.course.id}/grades`)

    return { success: true, data: graded }
  } catch (error) {
    console.error("Failed to grade submission:", error)
    return { success: false, error: "Failed to grade submission" }
  }
}

export type GradebookEntry = {
  studentId: string
  studentName: string
  studentEmail: string
  assignments: Record<
    string,
    {
      submissionId: string | null
      score: number | null
      maxScore: number
      status: string
    }
  >
}

export async function getCourseGradebook(courseId: string) {
  try {
    const user = await requireRole(["ADMIN", "PROFESSOR"])
    const access = await assertProfessorCourseAccess(
      courseId,
      user.id,
      user.role
    )
    if (!access.ok) {
      return { success: false, error: access.error }
    }

    const course = await db.query.courses.findFirst({
      where: eq(courses.id, courseId),
      with: {
        enrollments: {
          with: {
            student: {
              columns: { id: true, name: true, fullName: true, email: true },
            },
          },
        },
        weeks: {
          with: {
            assignments: {
              where: eq(assignments.isPublished, true),
              columns: { id: true, title: true, maxScore: true },
            },
          },
        },
      },
    })

    if (!course) {
      return { success: false, error: "Course not found" }
    }

    const allAssignments = (course.weeks ?? []).flatMap(
      (w) => w.assignments ?? []
    )
    const assignmentIds = allAssignments.map((a) => a.id)

    const subs =
      assignmentIds.length > 0
        ? await db.query.submissions.findMany({
            where: and(
              eq(submissions.type, "assignment"),
              inArray(submissions.referenceId, assignmentIds)
            ),
          })
        : []

    const gradebook: GradebookEntry[] = (course.enrollments ?? []).map(
      (enrollment) => {
        const student = enrollment.student
        const assignmentGrades: GradebookEntry["assignments"] = {}

        for (const assignment of allAssignments) {
          const sub = subs.find(
            (s) => s.studentId === student.id && s.referenceId === assignment.id
          )
          assignmentGrades[assignment.id] = {
            submissionId: sub?.id ?? null,
            score: sub?.score ?? null,
            maxScore: assignment.maxScore,
            status: sub?.status ?? "missing",
          }
        }

        return {
          studentId: student.id,
          studentName: student.fullName || student.name || student.email,
          studentEmail: student.email,
          assignments: assignmentGrades,
        }
      }
    )

    return {
      success: true,
      data: {
        assignments: allAssignments,
        gradebook,
      },
    }
  } catch (error) {
    console.error("Failed to fetch gradebook:", error)
    return { success: false, error: "Failed to fetch gradebook" }
  }
}

export async function exportCourseGradesCsv(courseId: string) {
  const result = await getCourseGradebook(courseId)
  if (!result.success || !result.data) {
    return {
      success: false as const,
      error: result.error ?? "Failed to export",
    }
  }

  const { assignments, gradebook } = result.data
  const header = ["Student Name", "Email", ...assignments.map((a) => a.title)]
  const rows = gradebook.map((row) => [
    row.studentName,
    row.studentEmail,
    ...assignments.map((a) => {
      const g = row.assignments[a.id]
      if (g.status === "missing") return ""
      if (g.score === null) return g.status
      return `${g.score}/${g.maxScore}`
    }),
  ])

  const csv = [header, ...rows]
    .map((line) =>
      line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n")

  return { success: true as const, data: csv }
}
