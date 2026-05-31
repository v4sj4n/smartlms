"use server"

import { z } from "zod"
import { and, eq, inArray, isNull } from "drizzle-orm"

import { db } from "@/db"
import { courseWeeks, fileChunks, files } from "@/db/schema"
import { requireRole } from "@/lib/auth-guard"
import { chatModel } from "@/lib/ai/models"
import { getUserAIPersonalizationPrompt } from "@/lib/data/profile-settings"
import { generateText } from "ai"

const GeneratedQuizQuestion = z.object({
  type: z.enum(["mcq", "true_false"]),
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

const GeneratedQuizDraft = z.object({
  questions: z.array(GeneratedQuizQuestion).min(1).max(20),
})

const GeneratedFlashcardDraft = z.object({
  flashcards: z.array(GeneratedFlashcard).min(1).max(30),
})

function stripCodeFences(value: string): string {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim()
}

function extractJsonCandidate(value: string): string {
  const cleaned = stripCodeFences(value)
  const objectStart = cleaned.indexOf("{")
  const objectEnd = cleaned.lastIndexOf("}")
  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    return cleaned.slice(objectStart, objectEnd + 1)
  }

  const arrayStart = cleaned.indexOf("[")
  const arrayEnd = cleaned.lastIndexOf("]")
  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    return cleaned.slice(arrayStart, arrayEnd + 1)
  }

  return cleaned
}

function parseJsonSafely(value: string): unknown {
  const candidate = extractJsonCandidate(value)

  try {
    return JSON.parse(candidate)
  } catch {
    try {
      const firstBrace = candidate.indexOf("{")
      const firstBracket = candidate.indexOf("[")
      const start =
        firstBrace === -1
          ? firstBracket
          : firstBracket === -1
            ? firstBrace
            : Math.min(firstBrace, firstBracket)

      if (start >= 0) {
        const tail = candidate.slice(start)
        const lastBrace = tail.lastIndexOf("}")
        const lastBracket = tail.lastIndexOf("]")
        const end = Math.max(lastBrace, lastBracket)
        if (end >= 0) {
          return JSON.parse(tail.slice(0, end + 1))
        }
      }
    } catch {
      // Fall through to the caller-specific error below.
    }

    throw new Error("AI returned malformed JSON")
  }
}

function normalizeQuizDraft(value: unknown) {
  const payload = Array.isArray(value)
    ? { questions: value }
    : value && typeof value === "object" && "questions" in value
      ? { questions: (value as { questions?: unknown }).questions }
      : value

  const parsed = GeneratedQuizDraft.safeParse(payload)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ")
    throw new Error(
      `AI quiz draft validation failed: ${issues || "invalid questions array"}`
    )
  }

  return parsed.data
}

function normalizeFlashcardDraft(value: unknown) {
  const payload = Array.isArray(value)
    ? { flashcards: value }
    : value && typeof value === "object" && "flashcards" in value
      ? { flashcards: (value as { flashcards?: unknown }).flashcards }
      : value

  const parsed = GeneratedFlashcardDraft.safeParse(payload)
  if (!parsed.success) {
    throw new Error(
      "AI flashcard draft did not include a valid flashcards array"
    )
  }

  return parsed.data
}

export async function generateContentWithAI(input: {
  weekId: string
  contentType: "quiz" | "flashcards"
  focusPrompt?: string
  fileIds?: string[]
  title?: string
}) {
  try {
    const user = await requireRole(["ADMIN", "PROFESSOR"])

    const week = await db.query.courseWeeks.findFirst({
      where: eq(courseWeeks.id, input.weekId),
      with: {
        course: {
          columns: {
            id: true,
            teacherId: true,
            title: true,
          },
        },
      },
    })

    if (!week || !week.course) {
      return { success: false, error: "Folder not found" }
    }

    if (user.role !== "ADMIN" && week.course.teacherId !== user.id) {
      return { success: false, error: "Forbidden" }
    }

    const aiPersonalizationPrompt = await getUserAIPersonalizationPrompt(
      user.id
    )
    const aiPersonalizationSection = aiPersonalizationPrompt
      ? `${aiPersonalizationPrompt}\n\n`
      : ""

    const whereClause = input.fileIds?.length
      ? and(
          eq(files.subjectId, week.course.id),
          eq(files.weekNumber, week.weekNumber),
          inArray(files.id, input.fileIds),
          isNull(files.deletedAt)
        )
      : and(
          eq(files.subjectId, week.course.id),
          eq(files.weekNumber, week.weekNumber),
          isNull(files.deletedAt)
        )

    const weekFiles = await db.query.files.findMany({
      where: whereClause,
      columns: { id: true, name: true },
    })

    if (!weekFiles.length) {
      return {
        success: false,
        error:
          "No source materials found for this folder. Please upload files first.",
      }
    }

    const chunks = await db.query.fileChunks.findMany({
      where: inArray(
        fileChunks.fileId,
        weekFiles.map((file) => file.id)
      ),
      orderBy: (c, { asc }) => [asc(c.chunkIndex)],
      limit: 80,
      columns: { id: true, chunkText: true, fileId: true },
    })

    if (!chunks.length) {
      return {
        success: false,
        error:
          "Selected materials have not been processed yet. Please wait for indexing to complete.",
      }
    }

    const context = chunks
      .map((chunk) => `[chunk:${chunk.id}] ${chunk.chunkText}`)
      .join("\n\n")

    const focusSection = input.focusPrompt
      ? `\n\nProfessor Focus / Special Instructions:\n${input.focusPrompt}`
      : ""

    const outputSchemaSection =
      input.contentType === "quiz"
        ? `
Output format:
{
  "questions": [
    {
      "type": "mcq" | "true_false",
      "prompt": string,
      "options": string[],
      "answer": string | string[] | boolean,
      "explanation": string,
      "difficulty": "easy" | "medium" | "hard",
      "sourceChunkIds": string[]
    }
  ]
}`
        : `
Output format:
{
  "flashcards": [
    {
      "front": string,
      "back": string,
      "difficulty": "easy" | "medium" | "hard",
      "sourceChunkIds": string[]
    }
  ]
}`

    const systemPrompt = `You are an expert LMS content generator.

${aiPersonalizationSection}Rules:
- Output JSON only.
- Return exactly one top-level field for the requested content type.
- If generating quizzes, return only "questions".
- If generating flashcards, return only "flashcards".
- Every item must include valid sourceChunkIds from the provided chunk IDs.
- Avoid duplicates and near-duplicates.
- Keep answers concise and correct.
  - Preserve normal word spacing in every string value. Do not collapse words, remove spaces inside sentences, or concatenate separate words.
- For mcq questions: provide 4 options, with the answer being the exact text of the correct option.
- For true_false questions: answer must be boolean true or false.
- For flashcards: front should be a clear question/prompt, back should be the concise answer.

${outputSchemaSection}`

    const userPrompt = `Generate ${
      input.contentType === "quiz" ? "quiz questions" : "flashcards"
    } from these chunks.${focusSection}

${
  input.contentType === "quiz"
    ? "Include a mix of mcq (5-8) and true_false (2-4) questions."
    : "Include 8-15 flashcards."
}

Chunks:
${context}`
    const response = await generateText({
      model: await chatModel(),
      system: systemPrompt,
      prompt: userPrompt,
      providerOptions: {
        google: {
          structuredOutputs: false,
        },
      },
    })

    const rawText = response.text
    if (!rawText) {
      return { success: false, error: "AI returned an empty response" }
    }

    const parsedJson = parseJsonSafely(rawText)

    if (input.contentType === "quiz") {
      const draft = normalizeQuizDraft(parsedJson)
      return {
        success: true,
        data: {
          contentType: "quiz" as const,
          draft,
        },
      }
    }

    const draft = normalizeFlashcardDraft(parsedJson)
    return {
      success: true,
      data: {
        contentType: "flashcards" as const,
        draft,
      },
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate content",
    }
  }
}
