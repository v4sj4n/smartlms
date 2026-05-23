"use server"

import { client, db } from "@/db"
import {
  courses,
  courseWeeks,
  courseEnrollments,
  lectureMaterials,
  semesters,
} from "@/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

async function hasTable(tableName: string) {
  const rows = await client<{ exists: boolean }[]>`
    select to_regclass(${`public.${tableName}`}) is not null as "exists"
  `

  return rows[0]?.exists ?? false
}

// ============================================================================
// COURSE ACTIONS
// ============================================================================

export async function createCourse(data: {
  title: string
  description?: string
  teacherId: string
  schoolYearId: string
  studyProgramId: string
  semester: "FIRST" | "SECOND"
  isPublished?: boolean
}) {
  try {
    const [course] = await db
      .insert(courses)
      .values({
        title: data.title,
        description: data.description,
        teacherId: data.teacherId,
        schoolYearId: data.schoolYearId,
        studyProgramId: data.studyProgramId,
        semester: data.semester,
        isPublished: data.isPublished ?? false,
      })
      .returning()

    revalidatePath("/admin/courses")
    revalidatePath("/professor/courses")
    return { success: true, data: course }
  } catch (error) {
    console.error("Failed to create course:", error)
    return { success: false, error: "Failed to create course" }
  }
}

export async function getCourses(filters?: {
  teacherId?: string
  schoolYearId?: string
  studyProgramId?: string
  semester?: "FIRST" | "SECOND"
  isPublished?: boolean
}) {
  try {
    const query = db.query.courses.findMany({
      with: {
        teacher: true,
        schoolYear: true,
        studyProgram: true,
        weeks: true,
        enrollments: {
          with: {
            student: true,
          },
        },
      },
      orderBy: [asc(courses.createdAt)],
    })

    const data = await query

    // Apply filters in memory since drizzle doesn't support complex filtering
    let filteredData = data
    if (filters?.teacherId) {
      filteredData = filteredData.filter(
        (c) => c.teacherId === filters.teacherId
      )
    }
    if (filters?.schoolYearId) {
      filteredData = filteredData.filter(
        (c) => c.schoolYearId === filters.schoolYearId
      )
    }
    if (filters?.studyProgramId) {
      filteredData = filteredData.filter(
        (c) => c.studyProgramId === filters.studyProgramId
      )
    }
    if (filters?.semester) {
      filteredData = filteredData.filter((c) => c.semester === filters.semester)
    }
    if (filters?.isPublished !== undefined) {
      filteredData = filteredData.filter(
        (c) => c.isPublished === filters.isPublished
      )
    }

    return { success: true, data: filteredData }
  } catch (error) {
    console.error("Failed to fetch courses:", error)
    return { success: false, error: "Failed to fetch courses" }
  }
}

export async function getCourseById(id: string) {
  try {
    const lectureMaterialsTableExists = await hasTable("lecture_materials")

    const course = await db.query.courses.findFirst({
      where: eq(courses.id, id),
      with: {
        teacher: true,
        schoolYear: true,
        studyProgram: true,
        weeks: {
          orderBy: [asc(courseWeeks.weekNumber)],
          with: {
            ...(lectureMaterialsTableExists ? { materials: true } : {}),
            quizzes: true,
            flashcards: true,
          },
        },
        enrollments: {
          with: {
            student: true,
          },
        },
      },
    })

    if (!course) {
      return { success: false, error: "Course not found" }
    }

    let semesterWindow: null | {
      id: string
      startDate: string
      endDate: string
      type: "FIRST" | "SECOND"
    } = null

    if (course.schoolYearId && course.semester) {
      const semester = await db.query.semesters.findFirst({
        where: and(
          eq(semesters.schoolYearId, course.schoolYearId),
          eq(semesters.type, course.semester)
        ),
      })

      if (semester) {
        semesterWindow = {
          id: semester.id,
          startDate: semester.startDate,
          endDate: semester.endDate,
          type: semester.type,
        }
      }
    }

    return {
      success: true,
      data: {
        ...course,
        semesterWindow,
      },
    }
  } catch (error) {
    console.error("Failed to fetch course:", error)
    return { success: false, error: "Failed to fetch course" }
  }
}

// ============================================================================
// COURSE WEEK ACTIONS
// ============================================================================

export async function createCourseWeek(data: {
  courseId: string
  weekNumber: number
  title: string
  description?: string
}) {
  try {
    const [week] = await db
      .insert(courseWeeks)
      .values({
        courseId: data.courseId,
        weekNumber: data.weekNumber,
        title: data.title,
        description: data.description,
      })
      .returning()

    revalidatePath(`/professor/courses/${data.courseId}/content`)
    return { success: true, data: week }
  } catch (error) {
    console.error("Failed to create course week:", error)
    return { success: false, error: "Failed to create course week" }
  }
}

// ============================================================================
// ENROLLMENT ACTIONS
// ============================================================================

export async function enrollStudentInCourse(data: {
  studentId: string
  courseId: string
}) {
  try {
    const [enrollment] = await db
      .insert(courseEnrollments)
      .values({
        studentId: data.studentId,
        courseId: data.courseId,
      })
      .returning()

    revalidatePath(`/admin/courses/${data.courseId}/enrollments`)
    return { success: true, data: enrollment }
  } catch (error) {
    console.error("Failed to enroll student:", error)
    return { success: false, error: "Failed to enroll student" }
  }
}

// ============================================================================
// LECTURE MATERIAL ACTIONS
// ============================================================================

export async function createLectureMaterial(data: {
  weekId: string
  title: string
  description?: string
  type: "VIDEO" | "PDF" | "LINK" | "DOCUMENT" | "PRESENTATION"
  contentUrl?: string
  fileSize?: number
  duration?: number
  orderIndex?: number
}) {
  try {
    const [material] = await db
      .insert(lectureMaterials)
      .values({
        weekId: data.weekId,
        title: data.title,
        description: data.description,
        type: data.type,
        contentUrl: data.contentUrl,
        fileSize: data.fileSize,
        duration: data.duration,
        orderIndex: data.orderIndex ?? 0,
      })
      .returning()

    revalidatePath(`/professor/content`)
    return { success: true, data: material }
  } catch (error) {
    console.error("Failed to create lecture material:", error)
    return { success: false, error: "Failed to create lecture material" }
  }
}
