"use server"

import { getCourses } from "@/lib/actions/courses"

export type LecturerCourseSummary = {
  id: string
  title: string
  description?: string | null
  teacherId?: string | null
  semester?: "FIRST" | "SECOND" | null
  isPublished?: boolean
}

export type LecturerCourseContext = {
  courses: LecturerCourseSummary[]
  activeCourse: LecturerCourseSummary | null
  requiresSelection: boolean
  selectedCourseId: string | null
}

export async function getLecturerCourseContext(params: {
  lecturerId: string
  selectedCourseId?: string | null
}): Promise<LecturerCourseContext> {
  const { data } = await getCourses({ teacherId: params.lecturerId })
  const courses = (data ?? []) as LecturerCourseSummary[]

  if (courses.length === 0) {
    return {
      courses,
      activeCourse: null,
      requiresSelection: false,
      selectedCourseId: null,
    }
  }

  const selectedCourse = params.selectedCourseId
    ? courses.find((course) => course.id === params.selectedCourseId) ?? null
    : null

  if (selectedCourse) {
    return {
      courses,
      activeCourse: selectedCourse,
      requiresSelection: false,
      selectedCourseId: selectedCourse.id,
    }
  }

  if (courses.length === 1) {
    return {
      courses,
      activeCourse: courses[0] ?? null,
      requiresSelection: false,
      selectedCourseId: courses[0]?.id ?? null,
    }
  }

  return {
    courses,
    activeCourse: null,
    requiresSelection: true,
    selectedCourseId: null,
  }
}
