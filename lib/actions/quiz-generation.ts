"use server"

import { z } from "zod"
import { db } from "@/db"
import {
  fileChunks,
  courseWeeks,
  files,
  flashcards,
  quizQuestions,
  quizzes,
} from "@/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth-guard"
import { generateText } from "ai"
import { chatModel } from "@/lib/ai/models"
import { getUserAIPersonalizationPrompt } from "@/lib/data/profile-settings"

const GeneratedQuestion = z.object({
  type: z.enum(["mcq", "true_false", "short_answer"]),
  prompt: z.string().min(10),
  options: z.array(z.string()).optional(),
  answer: z.union([z.string(), z.array(z.string()), z.boolean()]),
  explanation: z.string().min(10),
  difficulty: z.enum(["easy", "medium", "hard"]),
  sourceChunkIds: z.array(z.string().uuid()).min(1),
})

const GeneratedFlashcard = z.object({
  front: z.string().min(5),
  back: z.string().min(5),
  difficulty: z.enum(["easy", "medium", "hard"]),
  sourceChunkIds: z.array(z.string().uuid()).min(1),
})

const GeneratedPack = z.object({
  mcq: z.array(GeneratedQuestion).length(10),
  trueFalse: z.array(GeneratedQuestion).length(5),
  shortAnswer: z.array(GeneratedQuestion).length(3),
  flashcards: z.array(GeneratedFlashcard).length(20),
})

function createFingerprint(value: string): string {
  let hash = 0
  const normalized = value.trim().toLowerCase()
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16)
}

export async function generateQuizAndFlashcardsFromFile(input: {
  fileId: string
  quizId: string
}) {
  const user = await requireRole(["ADMIN", "PROFESSOR"])

  const file = await db.query.files.findFirst({
    where: and(eq(files.id, input.fileId), isNull(files.deletedAt)),
    columns: { id: true, name: true },
  })

  if (!file) {
    throw new Error("File not found")
  }

  const chunks = await db.query.fileChunks.findMany({
    where: eq(fileChunks.fileId, input.fileId),
    orderBy: (c, { asc }) => [asc(c.chunkIndex)],
    limit: 60,
    columns: { id: true, chunkText: true },
  })

  if (!chunks.length) {
    throw new Error("File has no indexed chunks yet")
  }

  const aiPersonalizationPrompt = await getUserAIPersonalizationPrompt(user.id)
  const aiPersonalizationSection = aiPersonalizationPrompt
    ? `${aiPersonalizationPrompt}\n\n`
    : ""

  const context = chunks
    .map((chunk) => `[chunk:${chunk.id}] ${chunk.chunkText}`)
    .join("\n\n")

  const prompt = `Generate study content from these chunks.\n\n${aiPersonalizationSection}Rules:\n- Output JSON only.\n- Every question/flashcard must include valid sourceChunkIds from provided chunk ids.\n- Avoid duplicates and near duplicates.\n- Keep answers concise and correct.\n- Preserve normal word spacing in every string value. Do not collapse words, remove spaces inside sentences, or concatenate separate words.\n\nChunks:\n${context}`

  const response = await generateText({
    model: await chatModel(),
    system: "You are an LMS assessment generator.",
    prompt,
    providerOptions: {
      google: {
        structuredOutputs: false,
      },
    },
  })

  const rawText = response.text

  if (!rawText) {
    throw new Error("AI returned an empty quiz payload")
  }

  const parsedText = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim()
  const parsed = GeneratedPack.parse(JSON.parse(parsedText))

  const questions = [...parsed.mcq, ...parsed.trueFalse, ...parsed.shortAnswer]

  await db.insert(quizQuestions).values(
    questions.map((question) => ({
      quizId: input.quizId,
      type: question.type,
      prompt: question.prompt,
      options: question.options ?? [],
      answer: question.answer,
      explanation: question.explanation,
      difficulty: question.difficulty,
      sourceChunkIds: question.sourceChunkIds,
      fingerprint: createFingerprint(
        `${question.prompt}:${JSON.stringify(question.answer)}`
      ),
    }))
  )

  const quiz = await db.query.quizzes.findFirst({
    where: eq(quizzes.id, input.quizId),
    columns: { weekId: true },
  })

  if (!quiz) {
    throw new Error("Quiz not found")
  }

  await db.insert(flashcards).values(
    parsed.flashcards.map((card) => ({
      weekId: quiz.weekId,
      frontContent: card.front,
      backContent: card.back,
      sourceFileId: input.fileId,
      origin: "AI" as const,
      status: "PENDING_REVIEW" as const,
      difficulty: card.difficulty,
      sourceChunkIds: card.sourceChunkIds,
      fingerprint: createFingerprint(`${card.front}:${card.back}`),
    }))
  )

  await db
    .update(quizzes)
    .set({
      origin: "AI" as const,
      status: "PENDING_REVIEW" as const,
      sourceFileId: input.fileId,
    })
    .where(eq(quizzes.id, input.quizId))

  return {
    success: true,
    generated: {
      questions: questions.length,
      flashcards: parsed.flashcards.length,
    },
  }
}

export async function generateStudyPackFromFile(input: {
  fileId: string
  weekId: string
  title?: string
}) {
  const user = await requireRole(["ADMIN", "PROFESSOR"])

  const file = await db.query.files.findFirst({
    where: and(eq(files.id, input.fileId), isNull(files.deletedAt)),
    columns: { id: true, name: true },
  })

  if (!file) {
    throw new Error("File not found")
  }

  const week = await db.query.courseWeeks.findFirst({
    where: eq(courseWeeks.id, input.weekId),
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

  if (user.role !== "ADMIN" && week.course.teacherId !== user.id) {
    throw new Error("Forbidden")
  }

  const [quiz] = await db
    .insert(quizzes)
    .values({
      weekId: week.id,
      title: input.title?.trim() || `${file.name} Study Pack`,
      description: `AI-generated study pack based on ${file.name}`,
      type: "graded",
      origin: "AI" as const,
      status: "PENDING_REVIEW" as const,
      difficulty: "medium",
    })
    .returning({ id: quizzes.id })

  const generated = await generateQuizAndFlashcardsFromFile({
    fileId: file.id,
    quizId: quiz.id,
  })

  revalidatePath(`/professor/courses/${week.course.id}`)
  revalidatePath(`/professor/courses/${week.course.id}/folders/${week.id}`)
  revalidatePath(`/student/courses/${week.course.id}`)

  return {
    success: true,
    data: {
      quizId: quiz.id,
      ...generated.generated,
    },
  }
}
