"use server"

import { db } from "@/db"
import {
  quizzes,
  questions,
  questionOptions,
  submissions,
  flashcards,
  courseWeeks,
} from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"

// ============================================================================
// QUIZ ACTIONS
// ============================================================================

export async function createQuiz(data: {
  weekId: string
  title: string
  description?: string
  type?: "graded" | "practice"
  timeLimitMinutes?: number
}) {
  try {
    const [quiz] = await db
      .insert(quizzes)
      .values({
        weekId: data.weekId,
        title: data.title,
        description: data.description,
        type: data.type ?? "graded",
        timeLimitMinutes: data.timeLimitMinutes,
      })
      .returning()

    revalidatePath(`/professor/content`)
    return { success: true, data: quiz }
  } catch (error) {
    console.error("Failed to create quiz:", error)
    return { success: false, error: "Failed to create quiz" }
  }
}

export async function getQuizById(id: string) {
  try {
    const quiz = await db.query.quizzes.findFirst({
      where: eq(quizzes.id, id),
      with: {
        questions: {
          with: {
            options: true,
          },
          orderBy: (questions, { asc }) => [asc(questions.orderIndex)],
        },
        week: {
          with: {
            course: true,
          },
        },
      },
    })

    if (!quiz) {
      return { success: false, error: "Quiz not found" }
    }

    return { success: true, data: quiz }
  } catch (error) {
    console.error("Failed to fetch quiz:", error)
    return { success: false, error: "Failed to fetch quiz" }
  }
}

// ============================================================================
// QUESTION ACTIONS
// ============================================================================

export async function createQuestion(data: {
  quizId: string
  type: "true_false" | "multiple_choice"
  content: string
  points?: number
  orderIndex: number
}) {
  try {
    const [question] = await db
      .insert(questions)
      .values({
        quizId: data.quizId,
        type: data.type,
        content: data.content,
        points: data.points ?? 1,
        orderIndex: data.orderIndex,
      })
      .returning()

    revalidatePath(`/professor/content`)
    return { success: true, data: question }
  } catch (error) {
    console.error("Failed to create question:", error)
    return { success: false, error: "Failed to create question" }
  }
}

export async function createQuestionOption(data: {
  questionId: string
  content: string
  isCorrect?: boolean
  explanation?: string
}) {
  try {
    const [option] = await db
      .insert(questionOptions)
      .values({
        questionId: data.questionId,
        content: data.content,
        isCorrect: data.isCorrect ?? false,
        explanation: data.explanation,
      })
      .returning()

    return { success: true, data: option }
  } catch (error) {
    console.error("Failed to create question option:", error)
    return { success: false, error: "Failed to create question option" }
  }
}

// ============================================================================
// SUBMISSION ACTIONS
// ============================================================================

export async function submitQuiz(data: {
  studentId: string
  weekId: string
  quizId: string
  answers: Record<string, string | string[]> // questionId -> answer(s)
  timeSpentSeconds?: number
}) {
  try {
    // Get quiz with questions and correct answers
    const quiz = await db.query.quizzes.findFirst({
      where: eq(quizzes.id, data.quizId),
      with: {
        questions: {
          with: {
            options: true,
          },
        },
      },
    })

    if (!quiz) {
      return { success: false, error: "Quiz not found" }
    }

    // Calculate score
    let totalScore = 0
    let maxScore = 0

    for (const question of quiz.questions) {
      maxScore += question.points
      const studentAnswer = data.answers[question.id]

      if (!studentAnswer) continue

      if (question.type === "true_false") {
        const correctOption = question.options.find(
          (o: { isCorrect: boolean }) => o.isCorrect
        )
        if (
          correctOption &&
          correctOption.content.toLowerCase() ===
            String(studentAnswer).toLowerCase()
        ) {
          totalScore += question.points
        }
      } else if (question.type === "multiple_choice") {
        const correctOptions = question.options
          .filter((o: { isCorrect: boolean }) => o.isCorrect)
          .map((o: { content: string }) => o.content)
        const studentAnswers = Array.isArray(studentAnswer)
          ? studentAnswer
          : [studentAnswer]

        // Check if all correct answers are selected and no incorrect ones
        const allCorrect = correctOptions.every((ans: string) =>
          studentAnswers.includes(ans)
        )
        const noIncorrect = studentAnswers.every((ans: string) =>
          correctOptions.includes(ans)
        )

        if (allCorrect && noIncorrect) {
          totalScore += question.points
        }
      }
    }

    // Create submission
    const [submission] = await db
      .insert(submissions)
      .values({
        studentId: data.studentId,
        weekId: data.weekId,
        type: "quiz",
        referenceId: data.quizId,
        content: JSON.stringify(data.answers),
        score: totalScore,
        maxScore: maxScore,
        status: "graded",
        submittedAt: new Date(),
        gradedAt: new Date(),
      })
      .returning()

    revalidatePath("/student/courses")
    return { success: true, data: { submission, score: totalScore, maxScore } }
  } catch (error) {
    console.error("Failed to submit quiz:", error)
    return { success: false, error: "Failed to submit quiz" }
  }
}

// ============================================================================
// MANUAL CONTENT CREATION ACTIONS
// ============================================================================

type ManualQuizQuestionInput = {
  type: "true_false" | "multiple_choice"
  content: string
  points?: number
  options?: { content: string; isCorrect?: boolean }[]
  correctBooleanAnswer?: boolean
}

async function resolveWeekAccess(weekId: string, userId: string, role: string) {
  const week = await db.query.courseWeeks.findFirst({
    where: eq(courseWeeks.id, weekId),
    with: {
      course: {
        columns: {
          id: true,
          teacherId: true,
        },
      },
    },
  })

  if (!week || !week.course) {
    throw new Error("Folder not found")
  }

  if (role !== "ADMIN" && week.course.teacherId !== userId) {
    throw new Error("Forbidden")
  }

  return week
}

export async function createManualQuiz(input: {
  weekId: string
  title: string
  description?: string
  type?: "graded" | "practice"
  timeLimitMinutes?: number
  difficulty?: "easy" | "medium" | "hard"
  status?: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED"
  questions: ManualQuizQuestionInput[]
}) {
  try {
    const user = await requireAuth()
    if (!["ADMIN", "PROFESSOR"].includes(user.role)) {
      return { success: false, error: "Forbidden" }
    }

    await resolveWeekAccess(input.weekId, user.id, user.role)

    const title = input.title.trim()
    if (!title) {
      return { success: false, error: "Quiz title is required" }
    }

    const validQuestions = input.questions
      .map((question) => ({
        ...question,
        content: question.content.trim(),
      }))
      .filter((question) => question.content.length > 0)

    if (!validQuestions.length) {
      return { success: false, error: "At least one question is required" }
    }

    const createdQuiz = await db.transaction(async (tx) => {
      const [quiz] = await tx
        .insert(quizzes)
        .values({
          weekId: input.weekId,
          title,
          description: input.description?.trim() || undefined,
          type: input.type ?? "graded",
          timeLimitMinutes: input.timeLimitMinutes,
          origin: "MANUAL" as const,
          difficulty: input.difficulty ?? "medium",
          status: input.status ?? "DRAFT",
        })
        .returning()

      for (let index = 0; index < validQuestions.length; index += 1) {
        const question = validQuestions[index]

        const [createdQuestion] = await tx
          .insert(questions)
          .values({
            quizId: quiz.id,
            type: question.type,
            content: question.content,
            points: question.points ?? 1,
            orderIndex: index,
          })
          .returning()

        if (question.type === "true_false") {
          const correctAnswer = question.correctBooleanAnswer ?? true
          await tx.insert(questionOptions).values([
            {
              questionId: createdQuestion.id,
              content: "True",
              isCorrect: correctAnswer,
            },
            {
              questionId: createdQuestion.id,
              content: "False",
              isCorrect: !correctAnswer,
            },
          ])
          continue
        }

        const options = (question.options ?? [])
          .map((option) => ({
            content: option.content.trim(),
            isCorrect: option.isCorrect ?? false,
          }))
          .filter((option) => option.content.length > 0)

        if (options.length < 2) {
          throw new Error(`Question ${index + 1} must have at least 2 options`)
        }

        const correctCount = options.filter((option) => option.isCorrect).length
        if (correctCount !== 1) {
          throw new Error(
            `Question ${index + 1} must have exactly one correct option`
          )
        }

        await tx.insert(questionOptions).values(
          options.map((option) => ({
            questionId: createdQuestion.id,
            content: option.content,
            isCorrect: option.isCorrect,
          }))
        )
      }

      return quiz
    })

    revalidatePath(`/professor/courses`)
    return { success: true, data: createdQuiz }
  } catch (error) {
    console.error("Failed to create manual quiz:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create manual quiz",
    }
  }
}

export async function createManualFlashcards(input: {
  weekId: string
  difficulty?: "easy" | "medium" | "hard"
  status?: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED"
  cards: { frontContent: string; backContent: string }[]
}) {
  try {
    const user = await requireAuth()
    if (!["ADMIN", "PROFESSOR"].includes(user.role)) {
      return { success: false, error: "Forbidden" }
    }

    await resolveWeekAccess(input.weekId, user.id, user.role)

    const cards = input.cards
      .map((card) => ({
        frontContent: card.frontContent.trim(),
        backContent: card.backContent.trim(),
      }))
      .filter(
        (card) => card.frontContent.length > 0 && card.backContent.length > 0
      )

    if (!cards.length) {
      return { success: false, error: "At least one flashcard is required" }
    }

    const createdCards = await db
      .insert(flashcards)
      .values(
        cards.map((card) => ({
          weekId: input.weekId,
          frontContent: card.frontContent,
          backContent: card.backContent,
          origin: "MANUAL" as const,
          difficulty: input.difficulty ?? "medium",
          status: input.status ?? "DRAFT",
        }))
      )
      .returning({ id: flashcards.id })

    revalidatePath(`/professor/courses`)
    return { success: true, data: { createdCount: createdCards.length } }
  } catch (error) {
    console.error("Failed to create manual flashcards:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create manual flashcards",
    }
  }
}
