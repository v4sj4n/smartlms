import { db } from "./index"
import {
  users,
  userAuth,
  schoolYears,
  semesters,
  studyPrograms,
  studentProgramEnrollments,
  courses,
  courseEnrollments,
  courseWeeks,
  quizzes,
  questions,
  questionOptions,
  flashcards,
  clubs,
  clubMembers,
  clubMessages,
  announcements,
} from "./schema"
import bcrypt from "bcryptjs"

type UserRole = "ADMIN" | "PROFESSOR" | "STUDENT"

async function createSeedUser(data: {
  name: string
  fullName: string
  email: string
  role: UserRole
  passwordHash: string
}) {
  const [user] = await db
    .insert(users)
    .values({
      name: data.name,
      fullName: data.fullName,
      email: data.email,
      role: data.role,
    })
    .returning()

  await db.insert(userAuth).values({
    userId: user.id,
    passwordHash: data.passwordHash,
  })

  return user
}

async function main() {
  console.log("🌱 Starting database seeding...")

  console.log("🧹 Cleaning existing seed data...")
  await db.delete(users)
  await db.delete(schoolYears)
  await db.delete(studyPrograms)
  await db.delete(courses)
  await db.delete(clubs)

  const passwordHash = await bcrypt.hash("password123", 10)

  console.log("👥 Seeding users...")
  const adminUser = await createSeedUser({
    name: "Admin User",
    fullName: "Admin User",
    email: "admin@smartlms.com",
    role: "ADMIN",
    passwordHash,
  })

  const professorUser = await createSeedUser({
    name: "Prof. Sarah Connor",
    fullName: "Sarah Connor",
    email: "sarahconnor@smartlms.com",
    role: "PROFESSOR",
    passwordHash,
  })

  const advisorUser = await createSeedUser({
    name: "Prof. Arben Kodra",
    fullName: "Arben Kodra",
    email: "arbenkodra@smartlms.com",
    role: "PROFESSOR",
    passwordHash,
  })

  const johnStudent = await createSeedUser({
    name: "Student John Doe",
    fullName: "John Doe",
    email: "johnd@smartlms.com",
    role: "STUDENT",
    passwordHash,
  })

  const miraStudent = await createSeedUser({
    name: "Student Mira Kola",
    fullName: "Mira Kola",
    email: "mkola@smartlms.com",
    role: "STUDENT",
    passwordHash,
  })

  console.log("🏫 Seeding academic structure...")
  const [schoolYear] = await db
    .insert(schoolYears)
    .values({
      name: "2025-2026",
      startDate: "2025-09-01",
      endDate: "2026-06-30",
      isActive: true,
    })
    .returning()

  await db.insert(semesters).values([
    {
      schoolYearId: schoolYear.id,
      type: "FIRST",
      startDate: "2025-09-01",
      midDate: "2025-11-15",
      endDate: "2026-01-31",
    },
    {
      schoolYearId: schoolYear.id,
      type: "SECOND",
      startDate: "2026-02-01",
      midDate: "2026-04-15",
      endDate: "2026-06-30",
    },
  ])

  const [computerScienceProgram, dataScienceProgram] = await db
    .insert(studyPrograms)
    .values([
      {
        name: "Computer Science",
        code: "CS",
        description: "Bachelor of Computer Science",
        schoolYearId: schoolYear.id,
      },
      {
        name: "Data Science",
        code: "DS",
        description: "Bachelor of Data Science and Analytics",
        schoolYearId: schoolYear.id,
      },
    ])
    .returning()

  await db.insert(studentProgramEnrollments).values([
    {
      studentId: johnStudent.id,
      studyProgramId: computerScienceProgram.id,
      schoolYearId: schoolYear.id,
    },
    {
      studentId: miraStudent.id,
      studyProgramId: dataScienceProgram.id,
      schoolYearId: schoolYear.id,
    },
  ])

  console.log("📚 Seeding courses and course content...")
  const [machineLearningCourse, webEngineeringCourse, visualizationCourse] =
    await db
      .insert(courses)
      .values([
        {
          title: "Advanced Machine Learning",
          description:
            "Linear models, cost functions, gradient descent, and regularization.",
          teacherId: professorUser.id,
          schoolYearId: schoolYear.id,
          studyProgramId: computerScienceProgram.id,
          semester: "FIRST",
          isPublished: true,
        },
        {
          title: "Web Application Engineering",
          description:
            "Full-stack application patterns with authentication, data models, and UI workflows.",
          teacherId: professorUser.id,
          schoolYearId: schoolYear.id,
          studyProgramId: computerScienceProgram.id,
          semester: "SECOND",
          isPublished: true,
        },
        {
          title: "Data Visualization Studio",
          description:
            "Practical dashboards, visual encodings, and storytelling with data.",
          teacherId: advisorUser.id,
          schoolYearId: schoolYear.id,
          studyProgramId: dataScienceProgram.id,
          semester: "FIRST",
          isPublished: true,
        },
      ])
      .returning()

  await db.insert(courseEnrollments).values([
    {
      studentId: johnStudent.id,
      courseId: machineLearningCourse.id,
    },
    {
      studentId: miraStudent.id,
      courseId: machineLearningCourse.id,
    },
    {
      studentId: johnStudent.id,
      courseId: webEngineeringCourse.id,
    },
    {
      studentId: miraStudent.id,
      courseId: visualizationCourse.id,
    },
  ])

  const seededWeeks = await db
    .insert(courseWeeks)
    .values([
      {
        courseId: machineLearningCourse.id,
        weekNumber: 1,
        title: "Model Foundations",
        description:
          "Vectors, features, loss functions, and the supervised learning workflow.",
      },
      {
        courseId: machineLearningCourse.id,
        weekNumber: 2,
        title: "Optimization",
        description: "Gradient descent, learning rates, and validation curves.",
      },
      {
        courseId: webEngineeringCourse.id,
        weekNumber: 1,
        title: "Product Skeleton",
        description:
          "Routing, shared layouts, auth guards, and data access boundaries.",
      },
      {
        courseId: webEngineeringCourse.id,
        weekNumber: 2,
        title: "Server Actions",
        description:
          "Mutations, validation, cache revalidation, and error handling.",
      },
      {
        courseId: visualizationCourse.id,
        weekNumber: 1,
        title: "Visual Encoding",
        description: "Choosing marks, channels, and comparison structures.",
      },
      {
        courseId: visualizationCourse.id,
        weekNumber: 2,
        title: "Dashboard Critique",
        description:
          "Improving scan paths, density, color, and narrative emphasis.",
      },
    ])
    .returning()

  const weekByCourseAndNumber = (courseId: string, weekNumber: number) => {
    const week = seededWeeks.find(
      (item) => item.courseId === courseId && item.weekNumber === weekNumber
    )

    if (!week) {
      throw new Error(
        `Missing seeded week ${weekNumber} for course ${courseId}`
      )
    }

    return week
  }

  const mlWeekOne = weekByCourseAndNumber(machineLearningCourse.id, 1)
  const webWeekOne = weekByCourseAndNumber(webEngineeringCourse.id, 1)
  const vizWeekOne = weekByCourseAndNumber(visualizationCourse.id, 1)

  const [mlQuiz] = await db
    .insert(quizzes)
    .values({
      weekId: mlWeekOne.id,
      title: "Model Foundations Check",
      description: "Quick practice quiz for supervised learning basics.",
      type: "practice",
      timeLimitMinutes: 15,
    })
    .returning()

  const [mlQuestionOne, mlQuestionTwo] = await db
    .insert(questions)
    .values([
      {
        quizId: mlQuiz.id,
        type: "true_false",
        content:
          "A loss function measures how far predictions are from expected outputs.",
        points: 1,
        orderIndex: 1,
      },
      {
        quizId: mlQuiz.id,
        type: "multiple_choice",
        content: "Which technique helps reduce overfitting?",
        points: 2,
        orderIndex: 2,
      },
    ])
    .returning()

  await db.insert(questionOptions).values([
    {
      questionId: mlQuestionOne.id,
      content: "True",
      isCorrect: true,
      explanation: "Loss functions quantify prediction error.",
    },
    {
      questionId: mlQuestionOne.id,
      content: "False",
      isCorrect: false,
    },
    {
      questionId: mlQuestionTwo.id,
      content: "Regularization",
      isCorrect: true,
      explanation: "Regularization discourages overly complex models.",
    },
    {
      questionId: mlQuestionTwo.id,
      content: "Increasing noise in labels",
      isCorrect: false,
    },
    {
      questionId: mlQuestionTwo.id,
      content: "Removing validation data",
      isCorrect: false,
    },
  ])

  await db.insert(flashcards).values([
    {
      weekId: mlWeekOne.id,
      frontContent: "Gradient descent",
      backContent:
        "An iterative optimization method that updates parameters in the direction that reduces loss.",
    },
    {
      weekId: webWeekOne.id,
      frontContent: "Server action",
      backContent:
        "A server-side function callable from React components or forms in a Next.js application.",
    },
    {
      weekId: vizWeekOne.id,
      frontContent: "Visual channel",
      backContent:
        "A visual property such as position, length, color, or size used to encode data.",
    },
  ])

  console.log("🎯 Seeding full-year clubs, members, and chat...")
  const [roboticsClub, webBuildersClub, cultureClub] = await db
    .insert(clubs)
    .values([
      {
        name: "Robotics & AI Club",
        description:
          "Students build small robotics prototypes and experiment with machine learning ideas.",
        schoolYearId: schoolYear.id,
      },
      {
        name: "Web Builders Club",
        description:
          "A practical club for shipping portfolio projects, hackathon apps, and campus tools.",
        schoolYearId: schoolYear.id,
      },
      {
        name: "Campus Culture Club",
        description:
          "A student-led space for events, community projects, and creative campus activities.",
        schoolYearId: schoolYear.id,
      },
    ])
    .returning()

  await db.insert(clubMembers).values([
    {
      clubId: roboticsClub.id,
      userId: johnStudent.id,
      role: "LEADER",
    },
    {
      clubId: roboticsClub.id,
      userId: miraStudent.id,
      role: "MEMBER",
    },
    {
      clubId: roboticsClub.id,
      userId: advisorUser.id,
      role: "ADVISOR",
    },
    {
      clubId: webBuildersClub.id,
      userId: miraStudent.id,
      role: "LEADER",
    },
    {
      clubId: webBuildersClub.id,
      userId: johnStudent.id,
      role: "MEMBER",
    },
    {
      clubId: webBuildersClub.id,
      userId: professorUser.id,
      role: "ADVISOR",
    },
    {
      clubId: cultureClub.id,
      userId: johnStudent.id,
      role: "MEMBER",
    },
    {
      clubId: cultureClub.id,
      userId: miraStudent.id,
      role: "MEMBER",
    },
  ])

  await db.insert(clubMessages).values([
    {
      clubId: roboticsClub.id,
      authorId: advisorUser.id,
      content:
        "Welcome to the full-year Robotics & AI Club. Introduce yourself and share what you want to build this year.",
      createdAt: new Date("2025-09-05T09:00:00"),
      updatedAt: new Date("2025-09-05T09:00:00"),
    },
    {
      clubId: roboticsClub.id,
      authorId: johnStudent.id,
      content: "I can bring the sensor kit for our first prototype discussion.",
      createdAt: new Date("2025-09-05T09:18:00"),
      updatedAt: new Date("2025-09-05T09:18:00"),
    },
    {
      clubId: webBuildersClub.id,
      authorId: miraStudent.id,
      content:
        "I added the deployment checklist. Let us use it for every project demo this year.",
      createdAt: new Date("2025-09-06T14:30:00"),
      updatedAt: new Date("2025-09-06T14:30:00"),
    },
    {
      clubId: webBuildersClub.id,
      authorId: professorUser.id,
      content:
        "Nice. Keep project links and setup notes in the chat so new members can catch up quickly.",
      createdAt: new Date("2025-09-06T15:10:00"),
      updatedAt: new Date("2025-09-06T15:10:00"),
    },
    {
      clubId: cultureClub.id,
      authorId: johnStudent.id,
      content:
        "The event template is up. Add ideas there before we vote on the first activity.",
      createdAt: new Date("2025-09-07T11:45:00"),
      updatedAt: new Date("2025-09-07T11:45:00"),
    },
  ])

  await db.insert(announcements).values([
    {
      title: "Welcome to the 2025-2026 academic year",
      content:
        "Courses, student clubs, and professor-led activities are now available in the dashboard.",
      scope: "global",
      authorId: adminUser.id,
      isPinned: true,
      isPublished: true,
      publishedAt: new Date("2025-09-01T09:00:00"),
    },
    {
      title: "Robotics & AI Club is open",
      content:
        "Nice. Keep project links and setup notes in the chat so new members can catch up quickly.",
      scope: "club",
      referenceId: roboticsClub.id,
      authorId: advisorUser.id,
      isPinned: false,
      isPublished: true,
      publishedAt: new Date("2026-05-20T10:00:00"),
    },
  ])

  console.log("✨ Seeding completed successfully!")
  console.log("--------------------------------------------------")
  console.log("Test Credentials (Password for all: password123):")
  console.log(" - Admin:          admin@smartlms.com")
  console.log(" - Professor:      professor@smartlms.com")
  console.log(" - Club Advisor:   advisor@smartlms.com")
  console.log(" - Student:        student@smartlms.com")
  console.log(" - Second Student: student2@smartlms.com")
  console.log("--------------------------------------------------")
  process.exit(0)
}

main().catch((err) => {
  console.error("❌ Seed failed:", err)
  process.exit(1)
})
