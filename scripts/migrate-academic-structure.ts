#!/usr/bin/env tsx
/**
 * Academic Structure Migration Script
 *
 * This script migrates existing data to the new academic structure:
 * 1. Creates student groups from existing program enrollments
 * 2. Creates subject assignments from existing course-teacher relationships
 * 3. Migrates existing schedules to include group references
 */

import { db } from "../db"
import {
  schoolYears,
  studyPrograms,
  courses,
  users,
  studentGroups,
  studentGroupMembers,
  subjectAssignments,
  courseSchedules,
  studentProgramEnrollments,
  courseEnrollments,
} from "../db/schema"
import { eq, and } from "drizzle-orm"

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_GROUP_CAPACITY = 30
const DEFAULT_REQUIRED_HOURS = 3

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

async function migrateStudentGroups() {
  console.log("🎓 Creating student groups from program enrollments...")

  // Get all program enrollments
  const enrollments = await db.query.studentProgramEnrollments.findMany({
    with: {
      studyProgram: true,
      student: true,
    },
  })

  const groupsCreated: Map<string, string> = new Map() // programId-year -> groupId

  for (const enrollment of enrollments) {
    const programId = enrollment.studyProgramId
    const yearLevel = 1 // Default to year 1 since we don't track this currently
    const groupKey = `${programId}-${yearLevel}`

    // Check if group already exists
    if (!groupsCreated.has(groupKey)) {
      const [group] = await db
        .insert(studentGroups)
        .values({
          name: `${enrollment.studyProgram.name} - Year ${yearLevel}`,
          studyProgramId: programId,
          yearLevel,
          capacity: DEFAULT_GROUP_CAPACITY,
        })
        .returning()

      groupsCreated.set(groupKey, group.id)
      console.log(`  ✅ Created group: ${group.name}`)
    }

    // Add student to group
    const groupId = groupsCreated.get(groupKey)!

    try {
      await db.insert(studentGroupMembers).values({
        groupId,
        studentId: enrollment.studentId,
      })
      console.log(
        `    👤 Added student ${enrollment.student.name || enrollment.studentId} to group`
      )
    } catch (e) {
      // Student might already be in group
      console.log(`    ⚠️ Student ${enrollment.studentId} already in group`)
    }
  }

  console.log(`✅ Created ${groupsCreated.size} student groups\n`)
  return groupsCreated
}

async function migrateSubjectAssignments() {
  console.log(
    "📚 Creating subject assignments from course-teacher relationships..."
  )

  // Get all courses with teachers
  const coursesWithTeachers = await db.query.courses.findMany({
    where: (courses, { isNotNull }) => isNotNull(courses.teacherId),
    with: {
      teacher: true,
      studyProgram: true,
    },
  })

  const assignmentsCreated = 0

  for (const course of coursesWithTeachers) {
    if (!course.teacherId) continue

    // Find student groups for this program
    const groups = await db.query.studentGroups.findMany({
      where: eq(studentGroups.studyProgramId, course.studyProgramId!),
    })

    for (const group of groups) {
      try {
        await db.insert(subjectAssignments).values({
          professorId: course.teacherId,
          courseId: course.id,
          groupId: group.id,
          requiredHours: DEFAULT_REQUIRED_HOURS,
        })
        console.log(
          `  ✅ Created assignment: ${course.title} -> ${group.name} (${course.teacher?.name || course.teacherId})`
        )
      } catch (e) {
        // Assignment might already exist
        console.log(
          `  ⚠️ Assignment already exists for ${course.title} -> ${group.name}`
        )
      }
    }
  }

  console.log(`✅ Created subject assignments\n`)
}

async function migrateExistingSchedules() {
  console.log("📅 Migrating existing schedule entries...")

  // Get all existing schedules
  const schedules = await db.query.courseSchedules.findMany({
    with: {
      course: true,
    },
  })

  let updatedCount = 0

  for (const schedule of schedules) {
    // Find the subject assignment for this course
    const assignments = await db.query.subjectAssignments.findMany({
      where: eq(subjectAssignments.courseId, schedule.courseId),
    })

    if (assignments.length > 0) {
      // Use the first assignment (or we could try to match by group if available)
      const assignment = assignments[0]

      // Get the academic year from the course
      const course = await db.query.courses.findFirst({
        where: eq(courses.id, schedule.courseId),
      })

      if (course?.schoolYearId) {
        await db
          .update(courseSchedules)
          .set({
            groupId: assignment.groupId,
            subjectAssignmentId: assignment.id,
            academicYearId: course.schoolYearId,
          })
          .where(eq(courseSchedules.id, schedule.id))

        updatedCount++
        console.log(
          `  ✅ Updated schedule entry: ${schedule.dayOfWeek} ${schedule.startTime}-${schedule.endTime}`
        )
      }
    }
  }

  console.log(`✅ Updated ${updatedCount} schedule entries\n`)
}

async function setDefaultProfessorAvailability() {
  console.log("👨‍🏫 Setting default availability for professors...")

  // Get all professors
  const professors = await db.query.users.findMany({
    where: eq(users.role, "PROFESSOR"),
  })

  const defaultAvailability = [
    { dayOfWeek: "MONDAY", startTime: "09:00", endTime: "17:00" },
    { dayOfWeek: "TUESDAY", startTime: "09:00", endTime: "17:00" },
    { dayOfWeek: "WEDNESDAY", startTime: "09:00", endTime: "17:00" },
    { dayOfWeek: "THURSDAY", startTime: "09:00", endTime: "17:00" },
    { dayOfWeek: "FRIDAY", startTime: "09:00", endTime: "17:00" },
  ] as const

  for (const professor of professors) {
    // Only set if not already set
    if (!professor.availability) {
      await db
        .update(users)
        .set({
          availability: [...defaultAvailability],
          maxWeeklyHours: 20,
        })
        .where(eq(users.id, professor.id))

      console.log(
        `  ✅ Set default availability for ${professor.name || professor.id}`
      )
    }
  }

  console.log(`✅ Processed ${professors.length} professors\n`)
}

// ============================================================================
// MAIN MIGRATION
// ============================================================================

async function runMigration() {
  console.log("=".repeat(60))
  console.log("🏫 Academic Structure Migration")
  console.log("=".repeat(60))
  console.log()

  try {
    // Step 1: Create student groups
    await migrateStudentGroups()

    // Step 2: Create subject assignments
    await migrateSubjectAssignments()

    // Step 3: Migrate existing schedules
    await migrateExistingSchedules()

    // Step 4: Set default professor availability
    await setDefaultProfessorAvailability()

    console.log("=".repeat(60))
    console.log("✅ Migration completed successfully!")
    console.log("=".repeat(60))
    console.log()
    console.log("Summary:")
    console.log("  - Student groups created from program enrollments")
    console.log(
      "  - Subject assignments created from course-teacher relationships"
    )
    console.log(
      "  - Existing schedules updated with group and assignment references"
    )
    console.log("  - Default availability set for professors")
    console.log()
    console.log("Next steps:")
    console.log("  1. Review created groups and adjust names if needed")
    console.log("  2. Verify subject assignments have correct required hours")
    console.log("  3. Update professor availability with actual preferences")
    console.log("  4. Generate schedules using the new Schedule Generator")
  } catch (error) {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  }

  process.exit(0)
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
}

export { runMigration }
