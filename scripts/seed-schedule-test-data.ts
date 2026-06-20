#!/usr/bin/env tsx
/**
 * Populates an academic year with study programs, courses, professors,
 * student groups, subject assignments, and professor availability windows
 * so the schedule generator can be tested.
 *
 * Usage:
 *   npx tsx scripts/seed-schedule-test-data.ts
 *   npx tsx scripts/seed-schedule-test-data.ts <school-year-id>
 */

import { db } from "../db"
import {
  users,
  userAuth,
  schoolYears,
  semesters,
  studyPrograms,
  studentGroups,
  studentGroupMembers,
  studentProgramEnrollments,
  courses,
  subjectAssignments,
  courseSchedules,
} from "../db/schema"
import { eq, inArray } from "drizzle-orm"
import bcrypt from "bcryptjs"

const DEFAULT_SCHOOL_YEAR_ID = "2239cf94-e83b-4101-8a57-ed1855fd94b6"

type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY"

type AvailabilitySlot = {
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
}

type ProfessorSeed = {
  name: string
  fullName: string
  email: string
  availability: AvailabilitySlot[]
  maxWeeklyHours: number
  preferredTimeSlots?: Array<AvailabilitySlot & { priority: number }>
}

/** Two-hour blocks aligned with the schedule generator grid */
const GRID_SLOTS: AvailabilitySlot[] = [
  { dayOfWeek: "MONDAY", startTime: "09:00", endTime: "11:00" },
  { dayOfWeek: "MONDAY", startTime: "11:15", endTime: "13:15" },
  { dayOfWeek: "MONDAY", startTime: "14:00", endTime: "16:00" },
  { dayOfWeek: "TUESDAY", startTime: "09:00", endTime: "11:00" },
  { dayOfWeek: "TUESDAY", startTime: "11:15", endTime: "13:15" },
  { dayOfWeek: "TUESDAY", startTime: "14:00", endTime: "16:00" },
  { dayOfWeek: "WEDNESDAY", startTime: "09:00", endTime: "11:00" },
  { dayOfWeek: "WEDNESDAY", startTime: "11:15", endTime: "13:15" },
  { dayOfWeek: "WEDNESDAY", startTime: "14:00", endTime: "16:00" },
  { dayOfWeek: "THURSDAY", startTime: "09:00", endTime: "11:00" },
  { dayOfWeek: "THURSDAY", startTime: "11:15", endTime: "13:15" },
  { dayOfWeek: "THURSDAY", startTime: "14:00", endTime: "16:00" },
  { dayOfWeek: "FRIDAY", startTime: "09:00", endTime: "11:00" },
  { dayOfWeek: "FRIDAY", startTime: "11:15", endTime: "13:15" },
  { dayOfWeek: "FRIDAY", startTime: "14:00", endTime: "16:00" },
]

function pickSlots(keys: string[]): AvailabilitySlot[] {
  return GRID_SLOTS.filter((slot) =>
    keys.includes(`${slot.dayOfWeek}:${slot.startTime}`)
  )
}

const PROFESSORS: ProfessorSeed[] = [
  {
    name: "Prof. Ana Kola",
    fullName: "Ana Kola",
    email: "ana.kola@optimolms.com",
    maxWeeklyHours: 18,
    availability: pickSlots([
      "MONDAY:09:00",
      "MONDAY:14:00",
      "WEDNESDAY:09:00",
      "WEDNESDAY:14:00",
      "FRIDAY:09:00",
      "FRIDAY:14:00",
    ]),
    preferredTimeSlots: [
      {
        dayOfWeek: "MONDAY",
        startTime: "09:00",
        endTime: "11:00",
        priority: 5,
      },
    ],
  },
  {
    name: "Prof. Marko Duri",
    fullName: "Marko Duri",
    email: "marko.duri@optimolms.com",
    maxWeeklyHours: 20,
    availability: pickSlots([
      "TUESDAY:09:00",
      "TUESDAY:11:15",
      "TUESDAY:14:00",
      "THURSDAY:09:00",
      "THURSDAY:11:15",
      "THURSDAY:14:00",
    ]),
    preferredTimeSlots: [
      {
        dayOfWeek: "TUESDAY",
        startTime: "14:00",
        endTime: "16:00",
        priority: 4,
      },
    ],
  },
  {
    name: "Prof. Elira Hoxha",
    fullName: "Elira Hoxha",
    email: "elira.hoxha@optimolms.com",
    maxWeeklyHours: 16,
    availability: pickSlots([
      "MONDAY:14:00",
      "TUESDAY:14:00",
      "WEDNESDAY:14:00",
      "THURSDAY:14:00",
      "FRIDAY:14:00",
      "MONDAY:11:15",
      "WEDNESDAY:11:15",
    ]),
  },
  {
    name: "Prof. Drin Krasniqi",
    fullName: "Drin Krasniqi",
    email: "drin.krasniqi@optimolms.com",
    maxWeeklyHours: 20,
    availability: pickSlots([
      "WEDNESDAY:09:00",
      "WEDNESDAY:11:15",
      "THURSDAY:09:00",
      "FRIDAY:09:00",
      "TUESDAY:14:00",
      "FRIDAY:14:00",
    ]),
  },
  {
    name: "Prof. Lina Petrova",
    fullName: "Lina Petrova",
    email: "lina.petrova@optimolms.com",
    maxWeeklyHours: 22,
    availability: pickSlots([
      "MONDAY:09:00",
      "MONDAY:11:15",
      "TUESDAY:09:00",
      "TUESDAY:11:15",
      "THURSDAY:09:00",
      "THURSDAY:14:00",
      "FRIDAY:11:15",
    ]),
  },
]

const PROGRAMS = [
  {
    name: "Informatics",
    code: "INFO",
    description:
      "Computer science, software engineering, and information systems.",
    courses: [
      {
        title: "Algorithms & Data Structures",
        professorIndex: 0,
        semester: "FIRST" as const,
      },
      {
        title: "Database Systems",
        professorIndex: 4,
        semester: "FIRST" as const,
      },
      {
        title: "Operating Systems",
        professorIndex: 3,
        semester: "SECOND" as const,
      },
      {
        title: "Software Engineering",
        professorIndex: 1,
        semester: "SECOND" as const,
      },
      {
        title: "Computer Networks",
        professorIndex: 2,
        semester: "FIRST" as const,
      },
    ],
  },
  {
    name: "Business Administration",
    code: "BUS",
    description: "Management, finance, marketing, and entrepreneurship.",
    courses: [
      {
        title: "Microeconomics",
        professorIndex: 2,
        semester: "FIRST" as const,
      },
      {
        title: "Marketing Principles",
        professorIndex: 4,
        semester: "FIRST" as const,
      },
      {
        title: "Financial Accounting",
        professorIndex: 0,
        semester: "SECOND" as const,
      },
      { title: "Business Law", professorIndex: 3, semester: "SECOND" as const },
      {
        title: "Business Statistics",
        professorIndex: 1,
        semester: "FIRST" as const,
      },
    ],
  },
  {
    name: "Civil Engineering",
    code: "CE",
    description: "Structural design, materials, and infrastructure planning.",
    courses: [
      {
        title: "Statics & Mechanics",
        professorIndex: 3,
        semester: "FIRST" as const,
      },
      {
        title: "Thermodynamics",
        professorIndex: 0,
        semester: "FIRST" as const,
      },
      {
        title: "CAD & Drafting",
        professorIndex: 1,
        semester: "SECOND" as const,
      },
      {
        title: "Materials Science",
        professorIndex: 4,
        semester: "SECOND" as const,
      },
      {
        title: "Project Management",
        professorIndex: 2,
        semester: "FIRST" as const,
      },
    ],
  },
]

async function ensureProfessor(prof: ProfessorSeed, passwordHash: string) {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, prof.email),
  })

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        name: prof.name,
        fullName: prof.fullName,
        role: "PROFESSOR",
        availability: prof.availability,
        maxWeeklyHours: prof.maxWeeklyHours,
        preferredTimeSlots: prof.preferredTimeSlots ?? [],
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning()

    return updated
  }

  const [created] = await db
    .insert(users)
    .values({
      name: prof.name,
      fullName: prof.fullName,
      email: prof.email,
      role: "PROFESSOR",
      availability: prof.availability,
      maxWeeklyHours: prof.maxWeeklyHours,
      preferredTimeSlots: prof.preferredTimeSlots ?? [],
    })
    .returning()

  await db.insert(userAuth).values({
    userId: created.id,
    passwordHash,
  })

  return created
}

async function clearYearData(schoolYearId: string) {
  const yearCourses = await db.query.courses.findMany({
    where: eq(courses.schoolYearId, schoolYearId),
    columns: { id: true },
  })
  const courseIds = yearCourses.map((c) => c.id)

  await db
    .delete(courseSchedules)
    .where(eq(courseSchedules.academicYearId, schoolYearId))

  if (courseIds.length > 0) {
    await db
      .delete(courseSchedules)
      .where(inArray(courseSchedules.courseId, courseIds))
  }

  const programs = await db.query.studyPrograms.findMany({
    where: eq(studyPrograms.schoolYearId, schoolYearId),
    columns: { id: true },
  })
  const programIds = programs.map((p) => p.id)

  if (programIds.length > 0) {
    const groups = await db.query.studentGroups.findMany({
      where: inArray(studentGroups.studyProgramId, programIds),
      columns: { id: true },
    })
    const groupIds = groups.map((g) => g.id)

    if (groupIds.length > 0) {
      await db
        .delete(studentGroupMembers)
        .where(inArray(studentGroupMembers.groupId, groupIds))
      await db
        .delete(subjectAssignments)
        .where(inArray(subjectAssignments.groupId, groupIds))
    }

    await db
      .delete(studentGroups)
      .where(inArray(studentGroups.studyProgramId, programIds))
  }

  if (courseIds.length > 0) {
    await db
      .delete(subjectAssignments)
      .where(inArray(subjectAssignments.courseId, courseIds))
    await db.delete(courses).where(inArray(courses.id, courseIds))
  }

  await db
    .delete(studentProgramEnrollments)
    .where(eq(studentProgramEnrollments.schoolYearId, schoolYearId))

  await db
    .delete(studyPrograms)
    .where(eq(studyPrograms.schoolYearId, schoolYearId))
  await db.delete(semesters).where(eq(semesters.schoolYearId, schoolYearId))
}

async function main() {
  const schoolYearId = process.argv[2] || DEFAULT_SCHOOL_YEAR_ID

  console.log("=".repeat(60))
  console.log("📅 Schedule test data seeder")
  console.log("=".repeat(60))

  const schoolYear = await db.query.schoolYears.findFirst({
    where: eq(schoolYears.id, schoolYearId),
  })

  if (!schoolYear) {
    console.error(`❌ School year not found: ${schoolYearId}`)
    process.exit(1)
  }

  console.log(`\n🏫 Target year: ${schoolYear.name} (${schoolYearId})`)

  console.log("\n🧹 Clearing existing year structure...")
  await clearYearData(schoolYearId)

  await db.transaction(async (tx) => {
    await tx.update(schoolYears).set({ isActive: false })
    await tx
      .update(schoolYears)
      .set({ isActive: true })
      .where(eq(schoolYears.id, schoolYearId))
  })

  console.log("📆 Creating semesters...")
  await db.insert(semesters).values([
    {
      schoolYearId,
      type: "FIRST",
      startDate: schoolYear.startDate,
      midDate: "2025-11-15",
      endDate: "2026-01-31",
    },
    {
      schoolYearId,
      type: "SECOND",
      startDate: "2026-02-01",
      midDate: "2026-04-15",
      endDate: schoolYear.endDate,
    },
  ])

  console.log("👨‍🏫 Ensuring professors with availability...")
  const passwordHash = await bcrypt.hash("password123", 10)
  const professorRecords = []

  for (const prof of PROFESSORS) {
    const record = await ensureProfessor(prof, passwordHash)
    professorRecords.push(record)
    console.log(
      `  ✅ ${prof.fullName} (${prof.availability.length} availability windows)`
    )
  }

  let totalGroups = 0
  let totalCourses = 0
  let totalAssignments = 0

  for (const programDef of PROGRAMS) {
    console.log(`\n📚 Program: ${programDef.name}`)

    const [program] = await db
      .insert(studyPrograms)
      .values({
        name: programDef.name,
        code: programDef.code,
        description: programDef.description,
        schoolYearId,
      })
      .returning()

    const groups = []
    for (const yearLevel of [1, 2]) {
      const [group] = await db
        .insert(studentGroups)
        .values({
          name: `${programDef.name} — Year ${yearLevel}`,
          studyProgramId: program.id,
          yearLevel,
          capacity: 30,
        })
        .returning()
      groups.push(group)
      totalGroups++
      console.log(`  👥 Group: ${group.name}`)
    }

    for (const courseDef of programDef.courses) {
      const professor = professorRecords[courseDef.professorIndex]

      const [course] = await db
        .insert(courses)
        .values({
          title: courseDef.title,
          description: `${courseDef.title} for ${programDef.name} students.`,
          teacherId: professor.id,
          schoolYearId,
          studyProgramId: program.id,
          semester: courseDef.semester,
          isPublished: true,
        })
        .returning()

      totalCourses++

      for (const group of groups) {
        await db.insert(subjectAssignments).values({
          professorId: professor.id,
          courseId: course.id,
          groupId: group.id,
          requiredHours: 2,
          sessionType: "lecture",
        })
        totalAssignments++
      }

      console.log(`  📖 ${course.title} → ${professor.fullName}`)
    }
  }

  // Enroll existing students into first program/group if any exist
  const students = await db.query.users.findMany({
    where: eq(users.role, "STUDENT"),
    limit: 6,
  })

  if (students.length > 0) {
    const firstProgram = await db.query.studyPrograms.findFirst({
      where: eq(studyPrograms.schoolYearId, schoolYearId),
      with: { studentGroups: true },
    })

    if (firstProgram?.studentGroups[0]) {
      for (const student of students.slice(0, 4)) {
        await db
          .insert(studentProgramEnrollments)
          .values({
            studentId: student.id,
            studyProgramId: firstProgram.id,
            schoolYearId,
          })
          .onConflictDoNothing()

        await db
          .insert(studentGroupMembers)
          .values({
            groupId: firstProgram.studentGroups[0].id,
            studentId: student.id,
          })
          .onConflictDoNothing()
      }
      console.log(
        `\n🎓 Enrolled ${Math.min(students.length, 4)} students into ${firstProgram.name}`
      )
    }
  }

  console.log("\n" + "=".repeat(60))
  console.log("✅ Schedule test data ready")
  console.log("=".repeat(60))
  console.log(`  Semesters:           2`)
  console.log(`  Study programs:      ${PROGRAMS.length}`)
  console.log(`  Student groups:      ${totalGroups}`)
  console.log(`  Courses (subjects):  ${totalCourses}`)
  console.log(`  Subject assignments: ${totalAssignments}`)
  console.log(`  Professors:          ${professorRecords.length}`)
  console.log(`  Existing schedules:  0 (generate fresh)`)
  console.log()
  console.log("Next steps:")
  console.log(`  1. Open /admin/academic/school-years/${schoolYearId}`)
  console.log("  2. Go to /admin/academic/schedules")
  console.log('  3. Choose "Random (Fast)" and click Generate Schedule')
  console.log()
  console.log("Professor logins (password: password123):")
  for (const prof of PROFESSORS) {
    console.log(`  - ${prof.email}`)
  }

  process.exit(0)
}

main().catch((error) => {
  console.error("❌ Seeding failed:", error)
  process.exit(1)
})
