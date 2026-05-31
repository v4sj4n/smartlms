"use server"

import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/db"
import { courseWeeks, flashcards, lectureMaterials, quizzes } from "@/db/schema"
import { requireRole } from "@/lib/auth-guard"

type ContentKind = "material" | "quiz" | "flashcardSet"

type ContentItem = {
  id: string
  kind: ContentKind
  memberIds?: string[]
}

export async function deleteWeekContentItem(input: {
  weekId: string
  item: ContentItem
}) {
  const user = await requireRole(["ADMIN", "PROFESSOR"])

  const week = await db.query.courseWeeks.findFirst({
    where: eq(courseWeeks.id, input.weekId),
    with: {
      course: {
        columns: {
          id: true,
          teacherId: true,
        },
      },
    },
  })

  if (!week || !week.course) {
    throw new Error("Folder not found")
  }

  if (user.role !== "ADMIN" && week.course.teacherId !== user.id) {
    throw new Error("Forbidden")
  }

  if (input.item.kind === "material") {
    const material = await db.query.lectureMaterials.findFirst({
      where: and(
        eq(lectureMaterials.id, input.item.id),
        eq(lectureMaterials.weekId, input.weekId)
      ),
      columns: { id: true },
    })

    if (!material) {
      throw new Error("Material not found")
    }

    await db
      .delete(lectureMaterials)
      .where(
        and(
          eq(lectureMaterials.id, input.item.id),
          eq(lectureMaterials.weekId, input.weekId)
        )
      )
  } else if (input.item.kind === "quiz") {
    const quiz = await db.query.quizzes.findFirst({
      where: and(
        eq(quizzes.id, input.item.id),
        eq(quizzes.weekId, input.weekId)
      ),
      columns: { id: true },
    })

    if (!quiz) {
      throw new Error("Quiz not found")
    }

    await db
      .delete(quizzes)
      .where(
        and(eq(quizzes.id, input.item.id), eq(quizzes.weekId, input.weekId))
      )
  } else {
    const flashcardIds = input.item.memberIds ?? []

    if (flashcardIds.length === 0) {
      throw new Error("Flashcard set not found")
    }

    await db
      .delete(flashcards)
      .where(
        and(
          eq(flashcards.weekId, input.weekId),
          inArray(flashcards.id, flashcardIds)
        )
      )
  }

  revalidatePath(`/professor/courses/${week.course.id}`)
  revalidatePath(`/professor/courses/${week.course.id}/folders/${week.id}`)
  revalidatePath(`/student/courses/${week.course.id}`)

  return { success: true }
}

export async function updateWeekContentPublicationState(input: {
  weekId: string
  items: ContentItem[]
  isPublished: boolean
}) {
  const user = await requireRole(["ADMIN", "PROFESSOR"])

  if (!input.items.length) {
    return { success: true }
  }

  const week = await db.query.courseWeeks.findFirst({
    where: eq(courseWeeks.id, input.weekId),
    with: {
      course: {
        columns: {
          id: true,
          teacherId: true,
        },
      },
    },
  })

  if (!week || !week.course) {
    throw new Error("Folder not found")
  }

  if (user.role !== "ADMIN" && week.course.teacherId !== user.id) {
    throw new Error("Forbidden")
  }

  const materialIds = input.items
    .filter((item) => item.kind === "material")
    .map((item) => item.id)
  const quizIds = input.items
    .filter((item) => item.kind === "quiz")
    .map((item) => item.id)
  const flashcardIds = input.items.flatMap((item) =>
    item.kind === "flashcardSet" ? (item.memberIds ?? []) : []
  )

  await db.transaction(async (tx) => {
    if (materialIds.length > 0) {
      await tx
        .update(lectureMaterials)
        .set({ isPublished: input.isPublished })
        .where(
          and(
            eq(lectureMaterials.weekId, input.weekId),
            inArray(lectureMaterials.id, materialIds)
          )
        )
    }

    if (quizIds.length > 0) {
      await tx
        .update(quizzes)
        .set({ status: input.isPublished ? "PUBLISHED" : "DRAFT" })
        .where(
          and(eq(quizzes.weekId, input.weekId), inArray(quizzes.id, quizIds))
        )
    }

    if (flashcardIds.length > 0) {
      await tx
        .update(flashcards)
        .set({ status: input.isPublished ? "PUBLISHED" : "DRAFT" })
        .where(
          and(
            eq(flashcards.weekId, input.weekId),
            inArray(flashcards.id, flashcardIds)
          )
        )
    }
  })

  revalidatePath(`/professor/courses/${week.course.id}`)
  revalidatePath(`/professor/courses/${week.course.id}/folders/${week.id}`)
  revalidatePath(`/student/courses/${week.course.id}`)

  return { success: true }
}
