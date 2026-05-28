"use server"

import { db } from "@/db"
import {
  clubMembers,
  clubMessages,
  clubMessageReads,
  clubMessageReactions,
  users,
} from "@/db/schema"
import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"
import { extractMentions } from "@/lib/chat/mentions"

const DEFAULT_PAGE_SIZE = 30

type Attachment = { path: string; name: string; mimeType: string; size: number }

export async function getUserById(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      fullName: true,
      nickname: true,
      image: true,
      role: true,
    },
  })
  return user
}

async function assertClubAccess(clubId: string, userId: string, role: string) {
  if (role === "ADMIN" || role === "PROFESSOR") {
    return
  }

  const membership = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)),
    columns: { userId: true },
  })

  if (!membership) {
    throw new Error("Forbidden")
  }
}

async function cleanupExpiredClubMessages(clubId: string) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  await db
    .update(clubMessages)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(clubMessages.clubId, clubId),
        isNull(clubMessages.deletedAt),
        lt(clubMessages.createdAt, cutoff)
      )
    )
}

export async function getClubMessagesPage(params: {
  clubId: string
  cursorCreatedAt?: string
  limit?: number
}) {
  const user = await requireAuth()
  await assertClubAccess(params.clubId, user.id, user.role)
  await cleanupExpiredClubMessages(params.clubId)

  const limit = Math.min(params.limit ?? DEFAULT_PAGE_SIZE, 100)
  const cursorDate = params.cursorCreatedAt
    ? new Date(params.cursorCreatedAt)
    : undefined

  const rows = await db.query.clubMessages.findMany({
    where: cursorDate
      ? and(
          eq(clubMessages.clubId, params.clubId),
          isNull(clubMessages.deletedAt),
          lt(clubMessages.createdAt, cursorDate)
        )
      : and(
          eq(clubMessages.clubId, params.clubId),
          isNull(clubMessages.deletedAt)
        ),
    orderBy: [desc(clubMessages.createdAt)],
    limit: limit + 1,
    with: {
      author: {
        columns: {
          id: true,
          fullName: true,
          nickname: true,
          image: true,
          role: true,
        },
      },
      reactions: true,
    },
  })

  const hasMore = rows.length > limit
  const items = (hasMore ? rows.slice(0, limit) : rows).reverse()
  const nextCursor = hasMore ? items[0]?.createdAt.toISOString() : null

  return { items, nextCursor }
}

export async function sendClubMessage(input: {
  clubId: string
  content: string
  replyToId?: string
  attachments?: Attachment[]
}) {
  const user = await requireAuth()
  await assertClubAccess(input.clubId, user.id, user.role)
  await cleanupExpiredClubMessages(input.clubId)

  const mentions = extractMentions(input.content)
  let mentionedUserIds: string[] = []

  if (mentions.length) {
    const mentionedUsers = await db.query.users.findMany({
      where: inArray(users.nickname, mentions),
      columns: { id: true },
    })
    mentionedUserIds = mentionedUsers.map((u) => u.id)
  }

  const [message] = await db
    .insert(clubMessages)
    .values({
      clubId: input.clubId,
      authorId: user.id,
      content: input.content.trim(),
      replyToId: input.replyToId,
      attachments: input.attachments ?? [],
      mentionedUserIds,
    })
    .returning()

  revalidatePath(`/student/clubs/${input.clubId}`)
  revalidatePath(`/professor/clubs/${input.clubId}`)
  revalidatePath(`/admin/clubs/${input.clubId}`)

  return message
}

export async function editClubMessage(input: {
  messageId: string
  content: string
}) {
  const user = await requireAuth()

  const existing = await db.query.clubMessages.findFirst({
    where: eq(clubMessages.id, input.messageId),
    columns: { authorId: true, clubId: true, deletedAt: true },
  })

  if (!existing || existing.deletedAt) {
    throw new Error("Message not found")
  }

  if (existing.authorId !== user.id && user.role !== "ADMIN") {
    throw new Error("Forbidden")
  }

  const mentions = extractMentions(input.content)
  let mentionedUserIds: string[] = []

  if (mentions.length) {
    const mentionedUsers = await db.query.users.findMany({
      where: inArray(users.nickname, mentions),
      columns: { id: true },
    })
    mentionedUserIds = mentionedUsers.map((u) => u.id)
  }

  const [updated] = await db
    .update(clubMessages)
    .set({
      content: input.content.trim(),
      mentionedUserIds,
      editedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(clubMessages.id, input.messageId))
    .returning()

  revalidatePath(`/student/clubs/${existing.clubId}`)
  revalidatePath(`/professor/clubs/${existing.clubId}`)
  revalidatePath(`/admin/clubs/${existing.clubId}`)

  return updated
}

export async function deleteClubMessage(messageId: string) {
  const user = await requireAuth()

  const existing = await db.query.clubMessages.findFirst({
    where: eq(clubMessages.id, messageId),
    columns: { authorId: true, clubId: true, deletedAt: true },
  })

  if (!existing || existing.deletedAt) {
    throw new Error("Message not found")
  }

  if (existing.authorId !== user.id && user.role !== "ADMIN") {
    throw new Error("Forbidden")
  }

  await db
    .update(clubMessages)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(clubMessages.id, messageId))

  revalidatePath(`/student/clubs/${existing.clubId}`)
  revalidatePath(`/professor/clubs/${existing.clubId}`)
  revalidatePath(`/admin/clubs/${existing.clubId}`)

  return { success: true }
}

export async function toggleMessageReaction(input: {
  messageId: string
  emoji: string
}) {
  const user = await requireAuth()
  const message = await db.query.clubMessages.findFirst({
    where: eq(clubMessages.id, input.messageId),
    columns: { id: true, clubId: true },
  })

  if (!message) throw new Error("Message not found")

  await assertClubAccess(message.clubId, user.id, user.role)

  const existing = await db.query.clubMessageReactions.findFirst({
    where: and(
      eq(clubMessageReactions.messageId, input.messageId),
      eq(clubMessageReactions.userId, user.id),
      eq(clubMessageReactions.emoji, input.emoji)
    ),
  })

  if (existing) {
    await db
      .delete(clubMessageReactions)
      .where(
        and(
          eq(clubMessageReactions.messageId, input.messageId),
          eq(clubMessageReactions.userId, user.id),
          eq(clubMessageReactions.emoji, input.emoji)
        )
      )
  } else {
    await db.insert(clubMessageReactions).values({
      messageId: input.messageId,
      userId: user.id,
      emoji: input.emoji,
    })
  }

  return { success: true }
}

export async function markMessageAsRead(input: {
  clubId: string
  messageId: string
}) {
  const user = await requireAuth()
  await assertClubAccess(input.clubId, user.id, user.role)

  await db
    .insert(clubMessageReads)
    .values({ messageId: input.messageId, userId: user.id })
    .onConflictDoUpdate({
      target: [clubMessageReads.messageId, clubMessageReads.userId],
      set: { readAt: new Date() },
    })

  await db
    .update(clubMembers)
    .set({ lastReadMessageId: input.messageId })
    .where(
      and(eq(clubMembers.clubId, input.clubId), eq(clubMembers.userId, user.id))
    )

  return { success: true }
}

export async function getClubMessageReadState(clubId: string) {
  const user = await requireAuth()
  await assertClubAccess(clubId, user.id, user.role)
  await cleanupExpiredClubMessages(clubId)

  const membership = await db.query.clubMembers.findFirst({
    where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, user.id)),
    columns: { lastReadMessageId: true },
  })

  const latest = await db.query.clubMessages.findFirst({
    where: and(eq(clubMessages.clubId, clubId), isNull(clubMessages.deletedAt)),
    orderBy: [desc(clubMessages.createdAt)],
    columns: { id: true, createdAt: true },
  })

  return {
    lastReadMessageId: membership?.lastReadMessageId ?? null,
    latestMessageId: latest?.id ?? null,
    latestCreatedAt: latest?.createdAt ?? null,
  }
}
