"use server"

import { z } from "zod"
import { db } from "@/db"
import {
  fileChunks,
  files,
  flashcards,
  quizQuestions,
  quizzes,
} from "@/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import { requireRole } from "@/lib/auth-guard"
import { env } from "@/lib/env"
import { generateText } from "ai"
import { chatModel } from "@/lib/ai/models"

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
  await requireRole(["ADMIN", "PROFESSOR"])

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

  const context = chunks
    .map((chunk) => `[chunk:${chunk.id}] ${chunk.chunkText}`)
    .join("\n\n")

  const prompt = `Generate study content from these chunks.\n\nRules:\n- Output JSON only.\n- Every question/flashcard must include valid sourceChunkIds from provided chunk ids.\n- Avoid duplicates and near duplicates.\n- Keep answers concise and correct.\n\nChunks:\n${context}`

  const response = await generateText({
    model: await chatModel(env.GENAI_QUIZ_MODEL),
    system: "You are an LMS assessment generator.",
    prompt,
    providerOptions: {
      google: {
        structuredOutputs: false,
      },
    },
  })

  const parsedText = response.text

  if (!parsedText) {
    throw new Error("AI returned an empty quiz payload")
  }

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
