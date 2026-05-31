"use server"

import { generateText } from "ai"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import {
  courseWeeks,
  lectureMaterials,
  questionOptions,
  questions,
  quizzes,
  submissions,
} from "@/db/schema"
import { chatModel } from "@/lib/ai/models"

type SeminarQuestionInput = {
  type: "true_false" | "multiple_choice"
  content: string
  options?: string[]
}

type SeminarResponseInput = {
  questionId: string
  answer: string | string[] | boolean
}

function serialize(value: unknown) {
  return JSON.stringify(value)
}

async function getWeekWithCourse(weekId: string) {
  return db.query.courseWeeks.findFirst({
    where: eq(courseWeeks.id, weekId),
    with: {
      course: {
        with: {
          enrollments: true,
        },
      },
    },
  })
}

export async function createSeminar(data: {
  weekId: string
  title: string
  content: string
  questions: SeminarQuestionInput[]
  requiresUpload?: boolean
  uploadInstructions?: string
}) {
  const week = await getWeekWithCourse(data.weekId)
  if (!week || !week.course) {
    return { success: false, error: "Course week not found" }
  }

  const [seminar] = await db
    .insert(quizzes)
    .values({
      weekId: data.weekId,
      title: data.title,
      description: data.content,
      type: "graded",
      origin: "MANUAL",
      status: "DRAFT",
      difficulty: "medium",
    })
    .returning()

  await db.insert(lectureMaterials).values({
    weekId: data.weekId,
    title: data.title,
    description: [
      data.content,
      data.requiresUpload ? "File upload required." : null,
      data.uploadInstructions?.trim() || null,
    ]
      .filter(Boolean)
      .join("\n\n"),
    type: "DOCUMENT",
    orderIndex: 0,
    isPublished: true,
  })

  for (const [index, question] of data.questions.entries()) {
    const [createdQuestion] = await db
      .insert(questions)
      .values({
        quizId: seminar.id,
        type: question.type,
        content: question.content,
        orderIndex: index,
      })
      .returning()

    if (question.options?.length) {
      await db.insert(questionOptions).values(
        question.options.map((option, optionIndex) => ({
          questionId: createdQuestion.id,
          content: option,
          isCorrect: optionIndex === 0,
        }))
      )
    }
  }

  revalidatePath(`/professor/courses/${week.course.id}`)
  return { success: true, data: seminar }
}

export async function submitSeminarResponse(data: {
  seminarId: string
  studentId: string
  weekId: string
  answers: SeminarResponseInput[]
  uploadedFileUrl?: string | null
}) {
  const seminar = await db.query.quizzes.findFirst({
    where: eq(quizzes.id, data.seminarId),
    with: {
      week: {
        with: {
          course: {
            with: {
              enrollments: true,
            },
          },
        },
      },
    },
  })

  if (!seminar?.week?.course) {
    return { success: false, error: "Seminar not found" }
  }

  const [response] = await db
    .insert(submissions)
    .values({
      studentId: data.studentId,
      weekId: data.weekId,
      type: "seminar",
      referenceId: data.seminarId,
      content: serialize({ answers: data.answers }),
      fileUrl: data.uploadedFileUrl ?? null,
      maxScore: 0,
      status: "submitted",
      submittedAt: new Date(),
    })
    .returning()

  const evaluation = await evaluateSeminarCompletion(data.seminarId)

  revalidatePath(`/student/courses/${seminar.week.course.id}`)
  revalidatePath(`/professor/courses/${seminar.week.course.id}`)

  return {
    success: true,
    data: {
      response,
      evaluation,
    },
  }
}

export async function evaluateSeminarCompletion(seminarId: string) {
  const seminar = await db.query.quizzes.findFirst({
    where: eq(quizzes.id, seminarId),
    with: {
      week: {
        with: {
          course: {
            with: {
              enrollments: true,
            },
          },
        },
      },
    },
  })

  if (!seminar?.week?.course) {
    return { completed: false, generated: 0 }
  }

  const enrollments = seminar.week.course.enrollments ?? []
  if (enrollments.length === 0) {
    return { completed: false, generated: 0 }
  }

  const responses = await db.query.submissions.findMany({
    where: and(
      eq(submissions.referenceId, seminar.id),
      eq(submissions.type, "seminar")
    ),
    columns: { studentId: true, content: true },
  })

  const responseStudentIds = new Set(responses.map((row) => row.studentId))
  const allStudentsResponded = enrollments.every((enrollment) =>
    responseStudentIds.has(enrollment.studentId)
  )

  if (!allStudentsResponded) {
    return { completed: false, generated: 0 }
  }

  let generated = 0

  for (const enrollment of enrollments) {
    const existingFollowUp = await db.query.submissions.findFirst({
      where: and(
        eq(submissions.studentId, enrollment.studentId),
        eq(submissions.referenceId, seminar.id),
        eq(submissions.type, "assignment")
      ),
      columns: { id: true },
    })

    if (existingFollowUp) {
      continue
    }

    const studentResponse = responses.find(
      (row) => row.studentId === enrollment.studentId
    )

    const followUpPrompt = await generateText({
      model: await chatModel(),
      system:
        "You are an LMS assistant that writes tailored follow-up assignments based on seminar responses.",
      prompt: `Generate a concise personalized follow-up assignment for this seminar.\n\nSeminar title: ${seminar.title}\nSeminar description: ${seminar.description || ""}\nStudent response: ${studentResponse?.content || ""}\n\nReturn only the assignment instructions.`,
    })

    await db.insert(submissions).values({
      studentId: enrollment.studentId,
      weekId: seminar.weekId,
      type: "assignment",
      referenceId: seminar.id,
      content:
        followUpPrompt.text || `Follow-up assignment for ${seminar.title}`,
      maxScore: 0,
      status: "submitted",
      submittedAt: new Date(),
    })
    generated += 1
  }

  revalidatePath(`/professor/courses/${seminar.week.course.id}`)
  revalidatePath(`/student/courses/${seminar.week.course.id}`)

  return {
    completed: true,
    generated,
  }
}
