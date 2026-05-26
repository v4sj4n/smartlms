"use server"

import { client, db } from "@/db"
import {
  chatbots,
  courses,
  courseWeeks,
  courseEnrollments,
  lectureMaterials,
  semesters,
} from "@/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

type CourseSchemaCompatibility = {
  lectureMaterialsTableExists: boolean
  quizzesSchemaCompatible: boolean
  flashcardsSchemaCompatible: boolean
}

const relatedUserColumns = {
  id: true,
  name: true,
  email: true,
  image: true,
  nickname: true,
  fullName: true,
} as const

let courseSchemaCompatibilityPromise: Promise<CourseSchemaCompatibility> | null =
  null

async function hasTable(tableName: string) {
  const rows = await client<{ exists: boolean }[]>`
    select to_regclass(${`public.${tableName}`}) is not null as "exists"
  `

  return rows[0]?.exists ?? false
}

async function hasColumn(tableName: string, columnName: string) {
  const rows = await client<{ exists: boolean }[]>`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${tableName}
        and column_name = ${columnName}
    ) as "exists"
  `

  return rows[0]?.exists ?? false
}

async function hasColumns(tableName: string, columnNames: string[]) {
  const checks = await Promise.all(
    columnNames.map((columnName) => hasColumn(tableName, columnName))
  )

  return checks.every(Boolean)
}

async function getCourseSchemaCompatibility(): Promise<CourseSchemaCompatibility> {
  if (!courseSchemaCompatibilityPromise) {
    courseSchemaCompatibilityPromise = (async () => {
      const [
        lectureMaterialsTableExists,
        quizzesTableExists,
        flashcardsTableExists,
      ] = await Promise.all([
        hasTable("lecture_materials"),
        hasTable("quizzes"),
        hasTable("flashcards"),
      ])

      const [quizzesSchemaCompatible, flashcardsSchemaCompatible] =
        await Promise.all([
          quizzesTableExists
            ? hasColumns("quizzes", [
                "source_file_id",
                "origin",
                "status",
                "difficulty",
              ])
            : Promise.resolve(false),
          flashcardsTableExists
            ? hasColumns("flashcards", [
                "source_file_id",
                "origin",
                "status",
                "difficulty",
                "source_chunk_ids",
                "fingerprint",
              ])
            : Promise.resolve(false),
        ])

      return {
        lectureMaterialsTableExists,
        quizzesSchemaCompatible,
        flashcardsSchemaCompatible,
      }
    })()
  }

  return courseSchemaCompatibilityPromise
}

async function ensureCourseChatbot(courseId: string, courseTitle: string) {
  const existingChatbot = await db.query.chatbots.findFirst({
    where: eq(chatbots.subjectId, courseId),
  })

  if (existingChatbot) {
    return existingChatbot
  }

  const [createdChatbot] = await db
    .insert(chatbots)
    .values({
      subjectId: courseId,
      systemPrompt: `You are the AI assistant for the course "${courseTitle}". Help students understand the material, guide their thinking, and point them toward relevant course content.`,
    })
    .returning()

  return createdChatbot
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
        teacher: {
          columns: relatedUserColumns,
        },
        schoolYear: true,
        studyProgram: true,
        weeks: true,
        enrollments: {
          with: {
            student: {
              columns: relatedUserColumns,
            },
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
    const {
      lectureMaterialsTableExists,
      quizzesSchemaCompatible,
      flashcardsSchemaCompatible,
    } = await getCourseSchemaCompatibility()

    const course = await db.query.courses.findFirst({
      where: eq(courses.id, id),
      with: {
        teacher: {
          columns: relatedUserColumns,
        },
        schoolYear: true,
        studyProgram: true,
        weeks: {
          orderBy: [asc(courseWeeks.weekNumber)],
          with: {
            ...(lectureMaterialsTableExists ? { materials: true } : {}),
            ...(quizzesSchemaCompatible
              ? {
                  quizzes: {
                    with: {
                      questions: {
                        with: {
                          options: true,
                        },
                        orderBy: (questions, { asc }) => [
                          asc(questions.orderIndex),
                        ],
                      },
                    },
                  },
                }
              : {}),
            ...(flashcardsSchemaCompatible ? { flashcards: true } : {}),
          },
        },
        enrollments: {
          with: {
            student: {
              columns: relatedUserColumns,
            },
          },
        },
        chatbots: true,
      },
    })

    if (!course) {
      return { success: false, error: "Course not found" }
    }

    const chatbotsForCourse = course.chatbots ?? []
    if (chatbotsForCourse.length === 0) {
      const chatbot = await ensureCourseChatbot(course.id, course.title)
      course.chatbots = [chatbot]
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
