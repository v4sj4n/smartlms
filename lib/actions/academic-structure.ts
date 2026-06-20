"use server"

import { db } from "@/db"
import {
  studentGroups,
  studentGroupMembers,
  subjectAssignments,
  schoolYears,
  studyPrograms,
  users,
  courses,
  courseSchedules,
} from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// ============================================================================
// STUDENT GROUPS
// ============================================================================

export async function createStudentGroup(data: {
  name: string
  studyProgramId: string
  yearLevel: number
  capacity?: number
}) {
  try {
    const [group] = await db
      .insert(studentGroups)
      .values({
        name: data.name,
        studyProgramId: data.studyProgramId,
        yearLevel: data.yearLevel,
        capacity: data.capacity ?? 30,
      })
      .returning()

    revalidatePath("/admin/academic")
    return { success: true, data: group }
  } catch (error) {
    console.error("Failed to create student group:", error)
    return { success: false, error: "Failed to create student group" }
  }
}

export async function getStudentGroups(filters?: {
  studyProgramId?: string
  yearLevel?: number
}) {
  try {
    const query = db.query.studentGroups.findMany({
      with: {
        studyProgram: {
          with: {
            schoolYear: true,
          },
        },
        members: {
          with: {
            student: true,
          },
        },
        subjectAssignments: {
          with: {
            professor: true,
            course: true,
          },
        },
      },
      orderBy: desc(studentGroups.createdAt),
    })

    const data = await query

    // Apply filters in memory if provided
    let filtered = data
    if (filters?.studyProgramId) {
      filtered = filtered.filter(
        (g) => g.studyProgramId === filters.studyProgramId
      )
    }
    if (filters?.yearLevel !== undefined) {
      filtered = filtered.filter((g) => g.yearLevel === filters.yearLevel)
    }

    return { success: true, data: filtered }
  } catch (error) {
    console.error("Failed to fetch student groups:", error)
    return { success: false, error: "Failed to fetch student groups" }
  }
}

export async function getStudentGroupById(id: string) {
  try {
    const group = await db.query.studentGroups.findFirst({
      where: eq(studentGroups.id, id),
      with: {
        studyProgram: {
          with: {
            schoolYear: true,
          },
        },
        members: {
          with: {
            student: true,
          },
        },
        subjectAssignments: {
          with: {
            professor: true,
            course: true,
            schedules: true,
          },
        },
      },
    })

    if (!group) {
      return { success: false, error: "Student group not found" }
    }

    return { success: true, data: group }
  } catch (error) {
    console.error("Failed to fetch student group:", error)
    return { success: false, error: "Failed to fetch student group" }
  }
}

export async function updateStudentGroup(
  id: string,
  data: {
    name?: string
    yearLevel?: number
    capacity?: number
  }
) {
  try {
    const [group] = await db
      .update(studentGroups)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.yearLevel !== undefined && { yearLevel: data.yearLevel }),
        ...(data.capacity !== undefined && { capacity: data.capacity }),
        updatedAt: new Date(),
      })
      .where(eq(studentGroups.id, id))
      .returning()

    if (!group) {
      return { success: false, error: "Student group not found" }
    }

    revalidatePath("/admin/academic")
    return { success: true, data: group }
  } catch (error) {
    console.error("Failed to update student group:", error)
    return { success: false, error: "Failed to update student group" }
  }
}

export async function deleteStudentGroup(id: string) {
  try {
    await db.delete(studentGroups).where(eq(studentGroups.id, id))

    revalidatePath("/admin/academic")
    return { success: true }
  } catch (error) {
    console.error("Failed to delete student group:", error)
    return { success: false, error: "Failed to delete student group" }
  }
}

// ============================================================================
// STUDENT GROUP MEMBERSHIPS
// ============================================================================

export async function addStudentToGroup(data: {
  groupId: string
  studentId: string
}) {
  try {
    // Check if group has capacity
    const group = await db.query.studentGroups.findFirst({
      where: eq(studentGroups.id, data.groupId),
      with: {
        members: true,
      },
    })

    if (!group) {
      return { success: false, error: "Group not found" }
    }

    if (group.capacity !== null && group.members.length >= group.capacity) {
      return { success: false, error: "Group has reached maximum capacity" }
    }

    const [membership] = await db
      .insert(studentGroupMembers)
      .values({
        groupId: data.groupId,
        studentId: data.studentId,
      })
      .returning()

    revalidatePath(`/admin/academic/groups/${data.groupId}`)
    return { success: true, data: membership }
  } catch (error) {
    console.error("Failed to add student to group:", error)
    return { success: false, error: "Failed to add student to group" }
  }
}

export async function removeStudentFromGroup(
  groupId: string,
  studentId: string
) {
  try {
    await db
      .delete(studentGroupMembers)
      .where(
        and(
          eq(studentGroupMembers.groupId, groupId),
          eq(studentGroupMembers.studentId, studentId)
        )
      )

    revalidatePath(`/admin/academic/groups/${groupId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to remove student from group:", error)
    return { success: false, error: "Failed to remove student from group" }
  }
}

export async function getStudentGroupsForStudent(studentId: string) {
  try {
    const memberships = await db.query.studentGroupMembers.findMany({
      where: eq(studentGroupMembers.studentId, studentId),
      with: {
        group: {
          with: {
            studyProgram: true,
            subjectAssignments: {
              with: {
                professor: true,
                course: true,
                schedules: true,
              },
            },
          },
        },
      },
    })

    return { success: true, data: memberships.map((m) => m.group) }
  } catch (error) {
    console.error("Failed to fetch student groups:", error)
    return { success: false, error: "Failed to fetch student groups" }
  }
}

// ============================================================================
// SUBJECT ASSIGNMENTS
// ============================================================================

export async function createSubjectAssignment(data: {
  professorId: string
  courseId: string
  groupId: string
  requiredHours?: number
  sessionType?: "lecture" | "seminar"
}) {
  try {
    // Check if assignment already exists
    const existing = await db.query.subjectAssignments.findFirst({
      where: and(
        eq(subjectAssignments.professorId, data.professorId),
        eq(subjectAssignments.courseId, data.courseId),
        eq(subjectAssignments.groupId, data.groupId)
      ),
    })

    if (existing) {
      return {
        success: false,
        error:
          "Assignment already exists for this professor, course, and group",
      }
    }

    const [assignment] = await db
      .insert(subjectAssignments)
      .values({
        professorId: data.professorId,
        courseId: data.courseId,
        groupId: data.groupId,
        requiredHours: data.requiredHours ?? 2,
        sessionType: data.sessionType ?? "lecture",
      })
      .returning()

    revalidatePath("/admin/academic/assignments")
    return { success: true, data: assignment }
  } catch (error) {
    console.error("Failed to create subject assignment:", error)
    return { success: false, error: "Failed to create subject assignment" }
  }
}

export async function getSubjectAssignments(filters?: {
  professorId?: string
  courseId?: string
  groupId?: string
  academicYearId?: string
}) {
  try {
    const query = db.query.subjectAssignments.findMany({
      with: {
        professor: true,
        course: {
          with: {
            schoolYear: true,
            studyProgram: true,
          },
        },
        group: {
          with: {
            studyProgram: true,
          },
        },
        schedules: true,
      },
      orderBy: desc(subjectAssignments.createdAt),
    }) as Promise<(typeof subjectAssignments.$inferSelect)[]>

    const data = await query

    // Apply filters
    let filtered = data as (typeof subjectAssignments.$inferSelect & {
      professor: typeof users.$inferSelect
      course: typeof courses.$inferSelect & {
        schoolYear: typeof schoolYears.$inferSelect
        studyProgram: typeof studyPrograms.$inferSelect
      }
      group: typeof studentGroups.$inferSelect & {
        studyProgram: typeof studyPrograms.$inferSelect
      }
      schedules: (typeof courseSchedules.$inferSelect)[]
    })[]

    if (filters?.professorId) {
      filtered = filtered.filter((a) => a.professorId === filters.professorId)
    }
    if (filters?.courseId) {
      filtered = filtered.filter((a) => a.courseId === filters.courseId)
    }
    if (filters?.groupId) {
      filtered = filtered.filter((a) => a.groupId === filters.groupId)
    }
    if (filters?.academicYearId) {
      filtered = filtered.filter(
        (a) => a.course.schoolYear?.id === filters.academicYearId
      )
    }

    return { success: true, data: filtered }
  } catch (error) {
    console.error("Failed to fetch subject assignments:", error)
    return { success: false, error: "Failed to fetch subject assignments" }
  }
}

export async function getProfessorAssignments(professorId: string) {
  try {
    const assignments = await db.query.subjectAssignments.findMany({
      where: eq(subjectAssignments.professorId, professorId),
      with: {
        course: {
          with: {
            schoolYear: true,
            studyProgram: true,
          },
        },
        group: {
          with: {
            studyProgram: true,
            members: true,
          },
        },
        schedules: true,
      },
    })

    return { success: true, data: assignments }
  } catch (error) {
    console.error("Failed to fetch professor assignments:", error)
    return { success: false, error: "Failed to fetch professor assignments" }
  }
}

export async function updateSubjectAssignment(
  id: string,
  data: {
    requiredHours?: number
  }
) {
  try {
    const [assignment] = await db
      .update(subjectAssignments)
      .set({
        ...(data.requiredHours !== undefined && {
          requiredHours: data.requiredHours,
        }),
        updatedAt: new Date(),
      })
      .where(eq(subjectAssignments.id, id))
      .returning()

    if (!assignment) {
      return { success: false, error: "Assignment not found" }
    }

    revalidatePath("/admin/academic/assignments")
    return { success: true, data: assignment }
  } catch (error) {
    console.error("Failed to update subject assignment:", error)
    return { success: false, error: "Failed to update subject assignment" }
  }
}

export async function deleteSubjectAssignment(id: string) {
  try {
    await db.delete(subjectAssignments).where(eq(subjectAssignments.id, id))

    revalidatePath("/admin/academic/assignments")
    return { success: true }
  } catch (error) {
    console.error("Failed to delete subject assignment:", error)
    return { success: false, error: "Failed to delete subject assignment" }
  }
}

// ============================================================================
// GROUP SCHEDULE
// ============================================================================

export async function getGroupSchedule(groupId: string) {
  try {
    const schedules = await db.query.courseSchedules.findMany({
      where: eq(courseSchedules.groupId, groupId),
      with: {
        course: true,
        subjectAssignment: {
          with: {
            professor: true,
          },
        },
      },
      orderBy: [courseSchedules.dayOfWeek, courseSchedules.startTime],
    })

    return { success: true, data: schedules }
  } catch (error) {
    console.error("Failed to fetch group schedule:", error)
    return { success: false, error: "Failed to fetch group schedule" }
  }
}

export async function getAcademicYearSchedule(academicYearId: string) {
  try {
    const schedules = await db.query.courseSchedules.findMany({
      where: eq(courseSchedules.academicYearId, academicYearId),
      with: {
        course: true,
        group: true,
        subjectAssignment: {
          with: {
            professor: true,
          },
        },
      },
      orderBy: [courseSchedules.dayOfWeek, courseSchedules.startTime],
    })

    return { success: true, data: schedules }
  } catch (error) {
    console.error("Failed to fetch academic year schedule:", error)
    return { success: false, error: "Failed to fetch academic year schedule" }
  }
}
