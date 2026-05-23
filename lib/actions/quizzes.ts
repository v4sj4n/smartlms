"use server"

import { db } from "@/db"
import { quizzes, questions, questionOptions, submissions } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"

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
