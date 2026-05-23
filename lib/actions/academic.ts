"use server"

import { db } from "@/db"
import {
  schoolYears,
  semesters,
  studyPrograms,
  studentProgramEnrollments,
} from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// ============================================================================
// SCHOOL YEAR ACTIONS
// ============================================================================

export async function createSchoolYear(data: {
  name: string
  startDate: string
  endDate: string
  isActive?: boolean
}) {
  try {
    const [schoolYear] = await db
      .insert(schoolYears)
      .values({
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: data.isActive ?? false,
      })
      .returning()

    revalidatePath("/admin/academic")
    return { success: true, data: schoolYear }
  } catch (error) {
    console.error("Failed to create school year:", error)
    return { success: false, error: "Failed to create school year" }
  }
}

export async function getSchoolYears() {
  try {
    const data = await db.query.schoolYears.findMany({
      orderBy: desc(schoolYears.startDate),
      with: {
        semesters: true,
        studyPrograms: true,
      },
    })
    return { success: true, data }
  } catch (error) {
    console.error("Failed to fetch school years:", error)
    return { success: false, error: "Failed to fetch school years" }
  }
}

export async function setActiveSchoolYear(id: string) {
  try {
    await db.transaction(async (tx) => {
      await tx.update(schoolYears).set({ isActive: false })
      await tx
        .update(schoolYears)
        .set({ isActive: true })
        .where(eq(schoolYears.id, id))
    })

    revalidatePath("/admin/academic")
    return { success: true }
  } catch (error) {
    console.error("Failed to set active school year:", error)
    return { success: false, error: "Failed to set active school year" }
  }
}

// ============================================================================
// SEMESTER ACTIONS
// ============================================================================

export async function createSemester(data: {
  schoolYearId: string
  type: "FIRST" | "SECOND"
  startDate: string
  midDate: string
  endDate: string
}) {
  try {
    const [semester] = await db
      .insert(semesters)
      .values({
        schoolYearId: data.schoolYearId,
        type: data.type,
        startDate: data.startDate,
        midDate: data.midDate,
        endDate: data.endDate,
      })
      .returning()

    revalidatePath("/admin/academic")
    return { success: true, data: semester }
  } catch (error) {
    console.error("Failed to create semester:", error)
    return { success: false, error: "Failed to create semester" }
  }
}

// ============================================================================
// STUDY PROGRAM ACTIONS
// ============================================================================

export async function createStudyProgram(data: {
  name: string
  code?: string
  description?: string
  schoolYearId: string
}) {
  try {
    const [program] = await db
      .insert(studyPrograms)
      .values({
        name: data.name,
        code: data.code,
        description: data.description,
        schoolYearId: data.schoolYearId,
      })
      .returning()

    revalidatePath("/admin/academic")
    return { success: true, data: program }
  } catch (error) {
    console.error("Failed to create study program:", error)
    return { success: false, error: "Failed to create study program" }
  }
}

export async function getStudyPrograms() {
  try {
    const data = await db.query.studyPrograms.findMany({
      with: {
        schoolYear: true,
      },
    })
    return { success: true, data }
  } catch (error) {
    console.error("Failed to fetch study programs:", error)
    return { success: false, error: "Failed to fetch study programs" }
  }
}

export async function enrollStudentInProgram(data: {
  studentId: string
  studyProgramId: string
  schoolYearId: string
}) {
  try {
    const [enrollment] = await db
      .insert(studentProgramEnrollments)
      .values({
        studentId: data.studentId,
        studyProgramId: data.studyProgramId,
        schoolYearId: data.schoolYearId,
      })
      .returning()

    revalidatePath("/admin/academic/enrollments")
    return { success: true, data: enrollment }
  } catch (error) {
    console.error("Failed to enroll student:", error)
    return { success: false, error: "Failed to enroll student" }
  }
}
