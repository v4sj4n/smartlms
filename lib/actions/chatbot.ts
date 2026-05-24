"use server"

import { db } from "@/db"
import {
  chatbotConversations,
  chatbotMessages,
  chatbots,
  courseEnrollments,
} from "@/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { requireAuth } from "@/lib/auth-guard"

async function assertCanAccessChatbot(
  userId: string,
  chatbotId: string,
  role: string
) {
  if (role === "ADMIN" || role === "PROFESSOR") return

  const bot = await db.query.chatbots.findFirst({
    where: eq(chatbots.id, chatbotId),
    columns: { subjectId: true },
  })

  if (!bot) {
    throw new Error("Chatbot not found")
  }

  const enrollment = await db.query.courseEnrollments.findFirst({
    where: and(
      eq(courseEnrollments.courseId, bot.subjectId),
      eq(courseEnrollments.studentId, userId)
    ),
    columns: { id: true },
  })

  if (!enrollment) {
    throw new Error("Forbidden")
  }
}

export async function createConversation(chatbotId: string, title?: string) {
  const user = await requireAuth()
  await assertCanAccessChatbot(user.id, chatbotId, user.role)

  const [conversation] = await db
    .insert(chatbotConversations)
    .values({ userId: user.id, chatbotId, title })
    .returning()

  return conversation
}

export async function listConversations(chatbotId: string) {
  const user = await requireAuth()
  await assertCanAccessChatbot(user.id, chatbotId, user.role)

  return db.query.chatbotConversations.findMany({
    where: and(
      eq(chatbotConversations.userId, user.id),
      eq(chatbotConversations.chatbotId, chatbotId)
    ),
    orderBy: [desc(chatbotConversations.updatedAt)],
  })
}

export async function getConversationMessages(conversationId: string) {
  const user = await requireAuth()

  const conversation = await db.query.chatbotConversations.findFirst({
    where: eq(chatbotConversations.id, conversationId),
    columns: { id: true, userId: true },
  })

  if (!conversation || conversation.userId !== user.id) {
    throw new Error("Forbidden")
  }

  return db.query.chatbotMessages.findMany({
    where: eq(chatbotMessages.conversationId, conversationId),
    orderBy: [desc(chatbotMessages.createdAt)],
    limit: 50,
  })
}
