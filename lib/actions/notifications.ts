"use server"

import { db } from "@/db"
import { notifications } from "@/db/schema"
import { eq, and, desc, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"

export type NotificationType =
  | "grade"
  | "assignment_due"
  | "announcement"
  | "general"

export async function createNotification(data: {
  userId: string
  type: NotificationType
  title: string
  body: string
  href?: string
}) {
  try {
    const [notification] = await db
      .insert(notifications)
      .values({
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        href: data.href,
      })
      .returning()

    revalidatePath("/dashboard")
    return { success: true, data: notification }
  } catch (error) {
    console.error("Failed to create notification:", error)
    return { success: false, error: "Failed to create notification" }
  }
}

export async function getNotificationsForUser(limit = 20) {
  try {
    const user = await requireAuth()

    const items = await db.query.notifications.findMany({
      where: eq(notifications.userId, user.id),
      orderBy: [desc(notifications.createdAt)],
      limit,
    })

    const unreadCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(eq(notifications.userId, user.id), isNull(notifications.readAt))
      )

    return {
      success: true,
      data: items,
      unreadCount: unreadCount[0]?.count ?? 0,
    }
  } catch (error) {
    console.error("Failed to fetch notifications:", error)
    return {
      success: false,
      error: "Failed to fetch notifications",
      data: [],
      unreadCount: 0,
    }
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const user = await requireAuth()

    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, user.id)
        )
      )

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Failed to mark notification read:", error)
    return { success: false, error: "Failed to mark notification read" }
  }
}

export async function markAllNotificationsRead() {
  try {
    const user = await requireAuth()

    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.userId, user.id), isNull(notifications.readAt))
      )

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Failed to mark all notifications read:", error)
    return { success: false, error: "Failed to mark all notifications read" }
  }
}
