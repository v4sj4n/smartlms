"use server"

import { db } from "@/db"
import { submissions, assignments } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth-guard"

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

    // Get assignment details to check due date and max score
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

    // Check if submission is allowed
    const now = new Date()
    const isLate = assignment.dueDate && now > assignment.dueDate
    if (isLate && !assignment.allowLateSubmissions) {
      return { success: false, error: "Assignment is past due date" }
    }

    // Check submission type
    if (assignment.submissionType === "file" && !data.fileUrl) {
      return { success: false, error: "This assignment requires a file upload" }
    }
    if (assignment.submissionType === "text" && !data.content) {
      return {
        success: false,
        error: "This assignment requires a text submission",
      }
    }

    // Check if already submitted
    const existingSubmission = await db.query.submissions.findFirst({
      where: and(
        eq(submissions.referenceId, data.assignmentId),
        eq(submissions.studentId, studentId),
        eq(submissions.type, "assignment")
      ),
    })

    if (existingSubmission) {
      // Update existing submission
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

    // Create new submission
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

    // Filter by course
    const courseSubmissions = subs.filter(
      (sub) => sub.week?.course?.id === courseId
    )

    return { success: true, data: courseSubmissions }
  } catch (error) {
    console.error("Failed to fetch submissions:", error)
    return { success: false, error: "Failed to fetch submissions" }
  }
}
