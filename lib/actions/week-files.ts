"use server"

import { db } from "@/db"
import { files, courseWeeks } from "@/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import { requireAuth } from "@/lib/auth-guard"

export async function getWeekFiles(weekId: string) {
  try {
    const user = await requireAuth()
    if (!["ADMIN", "PROFESSOR"].includes(user.role)) {
      return { success: false, error: "Forbidden" }
    }

    const week = await db.query.courseWeeks.findFirst({
      where: eq(courseWeeks.id, weekId),
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
      return { success: false, error: "Folder not found" }
    }

    if (user.role !== "ADMIN" && week.course.teacherId !== user.id) {
      return { success: false, error: "Forbidden" }
    }

    const weekFiles = await db.query.files.findMany({
      where: and(
        eq(files.subjectId, week.course.id),
        eq(files.weekNumber, week.weekNumber),
        isNull(files.deletedAt)
      ),
      columns: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        status: true,
        createdAt: true,
      },
      orderBy: (f, { desc }) => [desc(f.createdAt)],
    })

    return { success: true, data: weekFiles }
  } catch (error) {
    console.error("Failed to fetch week files:", error)
    return { success: false, error: "Failed to fetch files" }
  }
}
