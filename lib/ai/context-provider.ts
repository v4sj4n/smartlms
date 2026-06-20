import { db } from "@/db"
import {
  users,
  courses,
  courseSchedules,
  studentGroups,
  studentGroupMembers,
  subjectAssignments,
  schoolYears,
  studyPrograms,
  submissions,
} from "@/db/schema"
import { eq, and } from "drizzle-orm"
import type { DayOfWeek } from "@/lib/actions/schedules"

// ============================================================================
// TYPES
// ============================================================================

export type StudentScheduleInfo = {
  courseId: string
  courseTitle: string
  professorName: string
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  room: string
}

export type ProfessorScheduleInfo = {
  courseId: string
  courseTitle: string
  groupName: string
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  room: string
}

export type SubjectInfo = {
  id: string
  title: string
  description: string | null
  professor: string
  program: string
  year: string
}

export type GroupScheduleInfo = {
  subject: string
  professor: string
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  room: string
}

export type AttendanceSummary = {
  totalClasses: number
  attendedClasses: number
  attendanceRate: number
  byCourse: Array<{
    courseId: string
    courseTitle: string
    rate: number
  }>
}

export type GradesSummary = {
  averageGrade: number
  totalAssignments: number
  completedAssignments: number
  byCourse: Array<{
    courseId: string
    courseTitle: string
    averageGrade: number
    assignmentsCompleted: number
  }>
}

// ============================================================================
// AI CONTEXT TOOLS
// These functions provide LMS context to AI assistants
// ============================================================================

export async function getStudentSchedule(
  studentId: string,
  academicYearId?: string
): Promise<StudentScheduleInfo[]> {
  try {
    // Get student's groups
    const memberships = await db.query.studentGroupMembers.findMany({
      where: eq(studentGroupMembers.studentId, studentId),
      columns: { groupId: true },
    })

    const groupIds = memberships.map((m) => m.groupId)

    if (groupIds.length === 0) {
      return []
    }

    // Get schedules for these groups
    let query = db.query.courseSchedules.findMany({
      where: (schedules, { inArray }) => inArray(schedules.groupId, groupIds),
      with: {
        course: true,
        subjectAssignment: {
          with: {
            professor: {
              columns: { fullName: true, name: true },
            },
          },
        },
      },
      orderBy: [courseSchedules.dayOfWeek, courseSchedules.startTime],
    })

    if (academicYearId) {
      query = db.query.courseSchedules.findMany({
        where: (schedules, { and, inArray, eq }) =>
          and(
            inArray(schedules.groupId, groupIds),
            eq(schedules.academicYearId, academicYearId)
          ),
        with: {
          course: true,
          subjectAssignment: {
            with: {
              professor: {
                columns: { fullName: true, name: true },
              },
            },
          },
        },
        orderBy: [courseSchedules.dayOfWeek, courseSchedules.startTime],
      }) as typeof query
    }

    const schedules = await query

    return schedules.map((s) => ({
      courseId: s.course.id,
      courseTitle: s.course.title,
      professorName:
        s.subjectAssignment?.professor?.fullName ||
        s.subjectAssignment?.professor?.name ||
        "Unknown",
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room || "TBA",
    }))
  } catch (error) {
    console.error("[AI Context] Error getting student schedule:", error)
    return []
  }
}

export async function getProfessorSchedule(
  professorId: string,
  academicYearId?: string
): Promise<ProfessorScheduleInfo[]> {
  try {
    // Get professor's assignments
    const assignments = await db.query.subjectAssignments.findMany({
      where: eq(subjectAssignments.professorId, professorId),
      columns: { id: true },
    })

    const assignmentIds = assignments.map((a) => a.id)

    if (assignmentIds.length === 0) {
      return []
    }

    // Get schedules for these assignments
    let query = db.query.courseSchedules.findMany({
      where: (schedules, { inArray }) =>
        inArray(schedules.subjectAssignmentId, assignmentIds),
      with: {
        course: true,
        group: true,
      },
      orderBy: [courseSchedules.dayOfWeek, courseSchedules.startTime],
    })

    if (academicYearId) {
      query = db.query.courseSchedules.findMany({
        where: (schedules, { and, inArray, eq }) =>
          and(
            inArray(schedules.subjectAssignmentId, assignmentIds),
            eq(schedules.academicYearId, academicYearId)
          ),
        with: {
          course: true,
          group: true,
        },
        orderBy: [courseSchedules.dayOfWeek, courseSchedules.startTime],
      }) as typeof query
    }

    const schedules = await query

    return schedules.map((s) => ({
      courseId: s.course.id,
      courseTitle: s.course.title,
      groupName: s.group?.name || "Unknown Group",
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room || "TBA",
    }))
  } catch (error) {
    console.error("[AI Context] Error getting professor schedule:", error)
    return []
  }
}

export async function getSubjectInfo(
  subjectId: string
): Promise<SubjectInfo | null> {
  try {
    const course = await db.query.courses.findFirst({
      where: eq(courses.id, subjectId),
      with: {
        teacher: {
          columns: { fullName: true, name: true },
        },
        studyProgram: true,
        schoolYear: true,
      },
    })

    if (!course) {
      return null
    }

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      professor: course.teacher?.fullName || course.teacher?.name || "Unknown",
      program: course.studyProgram?.name || "General",
      year: course.schoolYear?.name || "Unknown",
    }
  } catch (error) {
    console.error("[AI Context] Error getting subject info:", error)
    return null
  }
}

export async function getGroupSchedule(
  groupId: string
): Promise<GroupScheduleInfo[]> {
  try {
    const schedules = await db.query.courseSchedules.findMany({
      where: eq(courseSchedules.groupId, groupId),
      with: {
        course: true,
        subjectAssignment: {
          with: {
            professor: {
              columns: { fullName: true, name: true },
            },
          },
        },
      },
      orderBy: [courseSchedules.dayOfWeek, courseSchedules.startTime],
    })

    return schedules.map((s) => ({
      subject: s.course.title,
      professor:
        s.subjectAssignment?.professor?.fullName ||
        s.subjectAssignment?.professor?.name ||
        "Unknown",
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room || "TBA",
    }))
  } catch (error) {
    console.error("[AI Context] Error getting group schedule:", error)
    return []
  }
}

export async function getAttendanceSummary(
  studentId: string
): Promise<AttendanceSummary> {
  // This is a placeholder - actual attendance tracking would need a dedicated table
  // For now, return mock data
  return {
    totalClasses: 40,
    attendedClasses: 36,
    attendanceRate: 90,
    byCourse: [
      { courseId: "1", courseTitle: "Advanced Machine Learning", rate: 92 },
      { courseId: "2", courseTitle: "Web Application Engineering", rate: 88 },
    ],
  }
}

export async function getGradesSummary(
  studentId: string
): Promise<GradesSummary> {
  try {
    // Get student's submissions
    const studentSubmissions = await db.query.submissions.findMany({
      where: eq(submissions.studentId, studentId),
      with: {
        week: {
          with: {
            course: true,
          },
        },
      },
    })

    if (studentSubmissions.length === 0) {
      return {
        averageGrade: 0,
        totalAssignments: 0,
        completedAssignments: 0,
        byCourse: [],
      }
    }

    // Calculate grades by course
    const courseGrades = new Map<
      string,
      { grades: number[]; title: string; count: number }
    >()

    for (const submission of studentSubmissions) {
      if (submission.score !== null && submission.maxScore > 0) {
        const courseId = submission.week.course.id
        const grade = (submission.score / submission.maxScore) * 100

        if (!courseGrades.has(courseId)) {
          courseGrades.set(courseId, {
            grades: [],
            title: submission.week.course.title,
            count: 0,
          })
        }

        const courseData = courseGrades.get(courseId)!
        courseData.grades.push(grade)
        courseData.count++
      }
    }

    // Calculate averages
    let totalGradeSum = 0
    let totalCount = 0
    const byCourse: GradesSummary["byCourse"] = []

    for (const [courseId, data] of courseGrades) {
      const avgGrade =
        data.grades.reduce((a, b) => a + b, 0) / data.grades.length
      totalGradeSum += avgGrade
      totalCount++

      byCourse.push({
        courseId,
        courseTitle: data.title,
        averageGrade: Math.round(avgGrade),
        assignmentsCompleted: data.count,
      })
    }

    return {
      averageGrade: totalCount > 0 ? Math.round(totalGradeSum / totalCount) : 0,
      totalAssignments: studentSubmissions.length,
      completedAssignments: studentSubmissions.filter(
        (s) => s.status === "graded"
      ).length,
      byCourse,
    }
  } catch (error) {
    console.error("[AI Context] Error getting grades summary:", error)
    return {
      averageGrade: 0,
      totalAssignments: 0,
      completedAssignments: 0,
      byCourse: [],
    }
  }
}

// ============================================================================
// CONTEXT BUILDER
// ============================================================================

export type UserContext = {
  userId: string
  role: "ADMIN" | "PROFESSOR" | "STUDENT"
  name: string
  academicYearId?: string
}

export async function buildAIContext(
  userContext: UserContext
): Promise<string> {
  const { userId, role, name, academicYearId } = userContext

  let context = `User: ${name} (${role})\n\n`

  try {
    if (role === "STUDENT") {
      // Add student-specific context
      const schedule = await getStudentSchedule(userId, academicYearId)
      if (schedule.length > 0) {
        context += "Current Schedule:\n"
        for (const entry of schedule) {
          context += `- ${entry.courseTitle}: ${entry.dayOfWeek} ${entry.startTime}-${entry.endTime} (${entry.room}) with ${entry.professorName}\n`
        }
        context += "\n"
      }

      const grades = await getGradesSummary(userId)
      if (grades.byCourse.length > 0) {
        context += "Grades Summary:\n"
        context += `- Overall Average: ${grades.averageGrade}%\n`
        context += `- Assignments: ${grades.completedAssignments}/${grades.totalAssignments} completed\n`
        for (const course of grades.byCourse) {
          context += `- ${course.courseTitle}: ${course.averageGrade}% (${course.assignmentsCompleted} assignments)\n`
        }
        context += "\n"
      }

      const attendance = await getAttendanceSummary(userId)
      context += `Attendance: ${attendance.attendanceRate}% (${attendance.attendedClasses}/${attendance.totalClasses} classes)\n\n`
    }

    if (role === "PROFESSOR") {
      // Add professor-specific context
      const schedule = await getProfessorSchedule(userId, academicYearId)
      if (schedule.length > 0) {
        context += "Teaching Schedule:\n"
        for (const entry of schedule) {
          context += `- ${entry.courseTitle} (${entry.groupName}): ${entry.dayOfWeek} ${entry.startTime}-${entry.endTime} (${entry.room})\n`
        }
        context += "\n"
      }
    }

    if (role === "ADMIN") {
      // Add admin-specific context
      const activeYear = await db.query.schoolYears.findFirst({
        where: eq(schoolYears.isActive, true),
      })

      if (activeYear) {
        context += `Active Academic Year: ${activeYear.name}\n\n`

        const programs = await db.query.studyPrograms.findMany({
          where: eq(studyPrograms.schoolYearId, activeYear.id),
        })

        context += `Study Programs: ${programs.map((p) => p.name).join(", ")}\n\n`
      }
    }

    return context
  } catch (error) {
    console.error("[AI Context] Error building context:", error)
    return context
  }
}

// ============================================================================
// TOOLS FOR AI
// These are the functions that the AI can call
// ============================================================================

export const aiContextTools = {
  getStudentSchedule,
  getProfessorSchedule,
  getSubjectInfo,
  getGroupSchedule,
  getAttendanceSummary,
  getGradesSummary,
  buildAIContext,
}
