import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { env } from "@/lib/env"
import { db } from "@/db"
import { chatbotConversations, chatbotMessages } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import {
  retrieveRelevantChunks,
  type RetrievedChunk,
} from "@/lib/rag/retrieval"
import { stepCountIs, streamText, tool } from "ai"
import { chatModel } from "@/lib/ai/models"
import { z } from "zod"
import { getUserAIPersonalizationPrompt } from "@/lib/data/profile-settings"

type ChatBody = {
  conversationId: string
  message: string
  weekNumber?: number
  model?: string
  systemInstructions?: string
}

// ---------------------------------------------------------------------------
// Routing agent system prompt
// ---------------------------------------------------------------------------
// This defines the two-path routing behaviour:
//   Path 1 – General: small talk or off-curriculum questions → answer directly.
//   Path 2 – Course-Related: must call `searchCourseContext` first, then
//             respond with a strict Socratic persona using the retrieved chunks.
// ---------------------------------------------------------------------------
const ROUTING_AGENT_INSTRUCTIONS = `\
You are an elite, highly restricted educational routing agent embedded in a Learning Management System (LMS).

## Primary Directive
Analyse the student's message and strictly route it to one of two paths:

### Path 1 — General Query
If the student is making small talk or asking a basic question entirely unrelated to the course curriculum (e.g. greetings, "how are you", general trivia), respond directly and concisely.
Do NOT call any tools for this path.

### Path 2 — Course-Related Query  (Tool Call Required)
If the student's message concerns course material, assignments, lectures, code, algorithms, or any academic concept:
1. You MUST immediately call the \`searchCourseContext\` tool with a precise query derived from the student's message.
2. Wait for the retrieved document chunks.
3. Adopt a strict Socratic pedagogical persona grounded in those chunks.
4. Offer hints, guiding questions, conceptual scaffolding, and references to the retrieved material.

## CRITICAL CONSTRAINT — Help, but NEVER solve
You are strictly forbidden from:
- Writing final code, complete implementations, or worked-out solutions.
- Providing direct answers or giving away the answer outright.
- Skipping the \`searchCourseContext\` tool call for course-related questions.

Guide the student to deduce the answer themselves through questions, hints, and the retrieved course documentation.
If the retrieved context is insufficient, state what is missing and ask a clarifying question instead of answering directly.`

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const body = (await req.json()) as ChatBody

  const conversation = await db.query.chatbotConversations.findFirst({
    where: and(
      eq(chatbotConversations.id, body.conversationId),
      eq(chatbotConversations.userId, session.user.id)
    ),
    with: {
      chatbot: {
        columns: { id: true, subjectId: true, systemPrompt: true, model: true },
      },
    },
  })

  if (!conversation) {
    return new Response("Conversation not found", { status: 404 })
  }

  // Persist the user turn before streaming begins.
  await db.insert(chatbotMessages).values({
    conversationId: conversation.id,
    role: "user",
    content: body.message,
  })

  // Fetch conversation history (most recent 12 messages, ascending).
  const history = await db.query.chatbotMessages.findMany({
    where: eq(chatbotMessages.conversationId, conversation.id),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
    limit: 12,
  })

  const aiPersonalizationPrompt = await getUserAIPersonalizationPrompt(
    session.user.id
  )

  // Combine the routing agent instructions with any chatbot-specific prompt
  // and optional per-request system instructions (e.g. week context).
  const systemPrompt = [
    ROUTING_AGENT_INSTRUCTIONS,
    aiPersonalizationPrompt,
    conversation.chatbot.systemPrompt,
    body.systemInstructions?.trim(),
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n\n---\n\n")

  // Captured inside the tool's `execute` closure so citations are available
  // in `onFinish` without a second DB round-trip.
  let retrievedChunks: RetrievedChunk[] = []

  const { subjectId } = conversation.chatbot
  const weekNumber = body.weekNumber

  const result = streamText({
    model: await chatModel(),
    system: systemPrompt,
    messages: history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    tools: {
      searchCourseContext: tool({
        description:
          "Search the course knowledge base and retrieve relevant document chunks. " +
          "Call this for ANY question related to course material, assignments, lectures, or academic concepts.",
        inputSchema: z.object({
          query: z
            .string()
            .describe(
              "A precise search query derived from the student's question, " +
                "optimised for semantic similarity retrieval against course documents."
            ),
        }),
        execute: async ({ query }) => {
          const chunks = await retrieveRelevantChunks(query, {
            subjectId,
            weekNumber,
            limit: 8,
          })
          // Capture for citation persistence in onFinish.
          retrievedChunks = chunks
          return chunks
            .map((chunk) => `[source:${chunk.id}]\n${chunk.chunkText}`)
            .join("\n\n---\n\n")
        },
      }),
    },
    // Allow: tool call → tool result → final response (up to 3 LLM steps).
    stopWhen: stepCountIs(3),
    onFinish: async ({ text }) => {
      await db.insert(chatbotMessages).values({
        conversationId: conversation.id,
        role: "assistant",
        content: text,
        citations: retrievedChunks.map((chunk) => ({
          chunkId: chunk.id,
          fileId: chunk.fileId,
        })),
      })
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
