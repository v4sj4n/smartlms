"use server"

import { db } from "@/db"
import { assignments } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"

// ============================================================================
// ASSIGNMENT ACTIONS
// ============================================================================

export async function createAssignment(data: {
  weekId: string
  title: string
  description?: string
  type?: "essay" | "project" | "homework" | "lab_report" | "presentation"
  origin?: "manual" | "ai_generated"
  sourceFileId?: string
  submissionType?: "text" | "file" | "both"
  maxScore?: number
  dueDate?: Date
  timeLimitMinutes?: number
  allowLateSubmissions?: boolean
  rubric?: {
    criteria: { name: string; description: string; points: number }[]
  }
}) {
  try {
    const user = await requireAuth()
    
    const [assignment] = await db
      .insert(assignments)
      .values({
        weekId: data.weekId,
        title: data.title,
        description: data.description,
        type: data.type ?? "homework",
        origin: data.origin ?? "manual",
        sourceFileId: data.sourceFileId,
        submissionType: data.submissionType ?? "both",
        maxScore: data.maxScore ?? 100,
        dueDate: data.dueDate,
        timeLimitMinutes: data.timeLimitMinutes,
        allowLateSubmissions: data.allowLateSubmissions ?? true,
        createdBy: user.id,
        rubric: data.rubric,
      })
      .returning()

    revalidatePath(`/professor/courses`)
    return { success: true, data: assignment }
  } catch (error) {
    console.error("Failed to create assignment:", error)
    return { success: false, error: "Failed to create assignment" }
  }
}

export async function getAssignmentById(id: string) {
  try {
    const assignment = await db.query.assignments.findFirst({
      where: eq(assignments.id, id),
      with: {
        week: {
          with: {
            course: true,
          },
        },
        sourceFile: true,
        creator: {
          columns: {
            id: true,
            name: true,
            fullName: true,
            email: true,
          },
        },
      },
    })

    if (!assignment) {
      return { success: false, error: "Assignment not found" }
    }

    return { success: true, data: assignment }
  } catch (error) {
    console.error("Failed to fetch assignment:", error)
    return { success: false, error: "Failed to fetch assignment" }
  }
}

export async function getAssignmentsByWeekId(weekId: string) {
  try {
    const weekAssignments = await db.query.assignments.findMany({
      where: eq(assignments.weekId, weekId),
      orderBy: (assignments, { desc }) => [desc(assignments.createdAt)],
    })

    return { success: true, data: weekAssignments }
  } catch (error) {
    console.error("Failed to fetch assignments:", error)
    return { success: false, error: "Failed to fetch assignments" }
  }
}

export async function updateAssignment(
  id: string,
  data: {
    title?: string
    description?: string
    type?: "essay" | "project" | "homework" | "lab_report" | "presentation"
    submissionType?: "text" | "file" | "both"
    maxScore?: number
    dueDate?: Date | null
    timeLimitMinutes?: number | null
    isPublished?: boolean
    allowLateSubmissions?: boolean
    rubric?: {
      criteria: { name: string; description: string; points: number }[]
    } | null
  }
) {
  try {
    const [assignment] = await db
      .update(assignments)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(assignments.id, id))
      .returning()

    revalidatePath(`/professor/courses`)
    return { success: true, data: assignment }
  } catch (error) {
    console.error("Failed to update assignment:", error)
    return { success: false, error: "Failed to update assignment" }
  }
}

export async function deleteAssignment(id: string) {
  try {
    await db.delete(assignments).where(eq(assignments.id, id))

    revalidatePath(`/professor/courses`)
    return { success: true }
  } catch (error) {
    console.error("Failed to delete assignment:", error)
    return { success: false, error: "Failed to delete assignment" }
  }
}

export async function publishAssignment(id: string) {
  try {
    const [assignment] = await db
      .update(assignments)
      .set({
        isPublished: true,
        updatedAt: new Date(),
      })
      .where(eq(assignments.id, id))
      .returning()

    revalidatePath(`/professor/courses`)
    return { success: true, data: assignment }
  } catch (error) {
    console.error("Failed to publish assignment:", error)
    return { success: false, error: "Failed to publish assignment" }
  }
}
