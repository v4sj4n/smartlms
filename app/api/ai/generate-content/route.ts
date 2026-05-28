import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/db"
import { courseWeeks, fileChunks, files } from "@/db/schema"
import { and, eq, inArray, isNull } from "drizzle-orm"
import { chatModel } from "@/lib/ai/models"
import { getUserAIPersonalizationPrompt } from "@/lib/data/profile-settings"
import { streamText } from "ai"

type GenerateContentBody = {
  weekId: string
  contentType: "quiz" | "flashcards"
  focusPrompt?: string
  fileIds?: string[]
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { role, id: userId } = session.user as {
    id: string
    role: "ADMIN" | "PROFESSOR" | "STUDENT"
  }

  if (role !== "ADMIN" && role !== "PROFESSOR") {
    return new Response("Forbidden", { status: 403 })
  }

  const body = (await req.json()) as GenerateContentBody

  const week = await db.query.courseWeeks.findFirst({
    where: eq(courseWeeks.id, body.weekId),
    with: {
      course: {
        columns: { id: true, teacherId: true, title: true },
      },
    },
  })

  if (!week || !week.course) {
    return new Response("Folder not found", { status: 404 })
  }

  if (role !== "ADMIN" && week.course.teacherId !== userId) {
    return new Response("Forbidden", { status: 403 })
  }

  const whereClause = body.fileIds?.length
    ? and(
        eq(files.subjectId, week.course.id),
        eq(files.weekNumber, week.weekNumber),
        inArray(files.id, body.fileIds),
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
    return new Response(
      "No source materials found for this folder. Please upload files first.",
      { status: 422 }
    )
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
    return new Response(
      "Selected materials have not been processed yet. Please wait for indexing to complete.",
      { status: 422 }
    )
  }

  const aiPersonalizationPrompt = await getUserAIPersonalizationPrompt(userId)
  const aiPersonalizationSection = aiPersonalizationPrompt
    ? `${aiPersonalizationPrompt}\n\n`
    : ""

  const context = chunks
    .map((chunk) => `[chunk:${chunk.id}] ${chunk.chunkText}`)
    .join("\n\n")

  const focusSection = body.focusPrompt
    ? `\n\nProfessor Focus / Special Instructions:\n${body.focusPrompt}`
    : ""

  const outputSchemaSection =
    body.contentType === "quiz"
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
- For mcq questions: provide 4 options, with the answer being the exact text of the correct option.
- For true_false questions: answer must be boolean true or false.
- For flashcards: front should be a clear question/prompt, back should be the concise answer.

${outputSchemaSection}`

  const userPrompt = `Generate ${
    body.contentType === "quiz" ? "quiz questions" : "flashcards"
  } from these chunks.${focusSection}

${
  body.contentType === "quiz"
    ? "Include a mix of mcq (5-8) and true_false (2-4) questions."
    : "Include 8-15 flashcards."
}

Chunks:
${context}`

  const result = streamText({
    model: await chatModel(),
    system: systemPrompt,
    prompt: userPrompt,
    providerOptions: {
      google: {
        structuredOutputs: false,
      },
    },
  })

  return result.toTextStreamResponse({
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
