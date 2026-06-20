"use server"

import { db } from "@/db"
import { courseSchedules, courses, dayOfWeekEnum } from "@/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export type DayOfWeek = (typeof dayOfWeekEnum.enumValues)[number]

export async function getCourseSchedules(courseId: string) {
  try {
    const schedules = await db.query.courseSchedules.findMany({
      where: eq(courseSchedules.courseId, courseId),
      orderBy: [asc(courseSchedules.dayOfWeek), asc(courseSchedules.startTime)],
    })
    return { success: true, data: schedules }
  } catch (error) {
    console.error("Failed to fetch schedules:", error)
    return { success: false, error: "Failed to fetch schedules" }
  }
}

export async function createSchedule(data: {
  courseId: string
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  room?: string
  building?: string
}) {
  try {
    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(data.startTime) || !timeRegex.test(data.endTime)) {
      return {
        success: false,
        error: "Invalid time format. Use HH:MM (24h format)",
      }
    }

    const [schedule] = await db
      .insert(courseSchedules)
      .values({
        courseId: data.courseId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        room: data.room,
        building: data.building,
      })
      .returning()

    revalidatePath(`/admin/courses/${data.courseId}`)
    revalidatePath(`/professor/courses/${data.courseId}`)
    return { success: true, data: schedule }
  } catch (error) {
    console.error("Failed to create schedule:", error)
    return { success: false, error: "Failed to create schedule" }
  }
}

export async function updateSchedule(
  scheduleId: string,
  data: {
    dayOfWeek?: DayOfWeek
    startTime?: string
    endTime?: string
    room?: string
    building?: string
  }
) {
  try {
    // Validate time format if provided
    if (data.startTime || data.endTime) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
      if (
        (data.startTime && !timeRegex.test(data.startTime)) ||
        (data.endTime && !timeRegex.test(data.endTime))
      ) {
        return {
          success: false,
          error: "Invalid time format. Use HH:MM (24h format)",
        }
      }
    }

    const [schedule] = await db
      .update(courseSchedules)
      .set({
        ...(data.dayOfWeek && { dayOfWeek: data.dayOfWeek }),
        ...(data.startTime && { startTime: data.startTime }),
        ...(data.endTime && { endTime: data.endTime }),
        ...(data.room !== undefined && { room: data.room }),
        ...(data.building !== undefined && { building: data.building }),
        updatedAt: new Date(),
      })
      .where(eq(courseSchedules.id, scheduleId))
      .returning()

    if (!schedule) {
      return { success: false, error: "Schedule not found" }
    }

    revalidatePath(`/admin/courses/${schedule.courseId}`)
    revalidatePath(`/professor/courses/${schedule.courseId}`)
    return { success: true, data: schedule }
  } catch (error) {
    console.error("Failed to update schedule:", error)
    return { success: false, error: "Failed to update schedule" }
  }
}

export async function deleteSchedule(scheduleId: string) {
  try {
    const schedule = await db.query.courseSchedules.findFirst({
      where: eq(courseSchedules.id, scheduleId),
    })

    if (!schedule) {
      return { success: false, error: "Schedule not found" }
    }

    await db.delete(courseSchedules).where(eq(courseSchedules.id, scheduleId))

    revalidatePath(`/admin/courses/${schedule.courseId}`)
    revalidatePath(`/professor/courses/${schedule.courseId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to delete schedule:", error)
    return { success: false, error: "Failed to delete schedule" }
  }
}

export async function createMultipleSchedules(
  courseId: string,
  schedules: {
    dayOfWeek: DayOfWeek
    startTime: string
    endTime: string
    room?: string
    building?: string
  }[]
) {
  try {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/

    for (const schedule of schedules) {
      if (
        !timeRegex.test(schedule.startTime) ||
        !timeRegex.test(schedule.endTime)
      ) {
        return {
          success: false,
          error: `Invalid time format: ${schedule.startTime} - ${schedule.endTime}`,
        }
      }
    }

    const values = schedules.map((s) => ({
      courseId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room,
      building: s.building,
    }))

    const created = await db.insert(courseSchedules).values(values).returning()

    revalidatePath(`/admin/courses/${courseId}`)
    revalidatePath(`/professor/courses/${courseId}`)
    return { success: true, data: created }
  } catch (error) {
    console.error("Failed to create schedules:", error)
    return { success: false, error: "Failed to create schedules" }
  }
}

export async function getCoursesWithSchedules() {
  try {
    const data = await db.query.courses.findMany({
      with: {
        schedules: {
          orderBy: [
            asc(courseSchedules.dayOfWeek),
            asc(courseSchedules.startTime),
          ],
        },
        teacher: {
          columns: {
            id: true,
            name: true,
            fullName: true,
          },
        },
        studyProgram: true,
        enrollments: true,
      },
      orderBy: [asc(courses.title)],
    })
    return { success: true, data }
  } catch (error) {
    console.error("Failed to fetch courses with schedules:", error)
    return { success: false, error: "Failed to fetch courses" }
  }
}
