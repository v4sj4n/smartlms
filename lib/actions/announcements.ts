"use server"

import { db } from "@/db"
import { announcements, users } from "@/db/schema"
import { eq, and, desc, or, isNull, gte } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// ============================================================================
// ANNOUNCEMENT ACTIONS
// ============================================================================

export async function createAnnouncement(data: {
  title: string
  content: string
  scope: "global" | "school_year" | "program" | "course" | "club"
  referenceId?: string
  authorId: string
  isPinned?: boolean
  expiresAt?: Date
}) {
  try {
    const [announcement] = await db
      .insert(announcements)
      .values({
        title: data.title,
        content: data.content,
        scope: data.scope,
        referenceId: data.referenceId,
        authorId: data.authorId,
        isPinned: data.isPinned ?? false,
        expiresAt: data.expiresAt,
        isPublished: true,
        publishedAt: new Date(),
      })
      .returning()

    revalidatePath("/admin/announcements")
    revalidatePath("/dashboard")
    return { success: true, data: announcement }
  } catch (error) {
    console.error("Failed to create announcement:", error)
    return { success: false, error: "Failed to create announcement" }
  }
}

export async function getAnnouncements(filters?: {
  scope?: "global" | "school_year" | "program" | "course" | "club"
  referenceId?: string
  isPublished?: boolean
  isPinned?: boolean
  limit?: number
}) {
  try {
    const query = db.query.announcements.findMany({
      where: (announcements, { and, eq, or, isNull, gte }) => {
        const conditions = []

        if (filters?.scope) {
          conditions.push(eq(announcements.scope, filters.scope))
        }
        if (filters?.referenceId) {
          conditions.push(eq(announcements.referenceId, filters.referenceId))
        }
        if (filters?.isPublished !== undefined) {
          conditions.push(eq(announcements.isPublished, filters.isPublished))
        }
        if (filters?.isPinned !== undefined) {
          conditions.push(eq(announcements.isPinned, filters.isPinned))
        }

        // Only show non-expired or null expiresAt
        conditions.push(
          or(
            isNull(announcements.expiresAt),
            gte(announcements.expiresAt, new Date())
          )
        )

        return and(...conditions)
      },
      with: {
        author: {
          columns: {
            id: true,
            name: true,
            fullName: true,
            image: true,
          },
        },
      },
      orderBy: [desc(announcements.isPinned), desc(announcements.publishedAt)],
      limit: filters?.limit ?? 50,
    })

    const data = await query
    return { success: true, data }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('relation "announcements" does not exist')
    ) {
      return { success: true, data: [] }
    }

    console.error("Failed to fetch announcements:", error)
    return { success: false, error: "Failed to fetch announcements" }
  }
}

export async function getAnnouncementsForUser(
  userId: string,
  userRole: string,
  enrollmentInfo?: {
    schoolYearId?: string
    programId?: string
    courseIds?: string[]
    clubIds?: string[]
  }
) {
  try {
    // Get global announcements
    const globalAnnouncements = await db.query.announcements.findMany({
      where: and(
        eq(announcements.scope, "global"),
        eq(announcements.isPublished, true),
        or(
          isNull(announcements.expiresAt),
          gte(announcements.expiresAt, new Date())
        )
      ),
      with: {
        author: {
          columns: {
            id: true,
            name: true,
            fullName: true,
          },
        },
      },
    })

    // Get scoped announcements based on user's enrollments
    const scopedAnnouncements: typeof globalAnnouncements = []

    if (enrollmentInfo?.schoolYearId) {
      const yearAnnouncements = await db.query.announcements.findMany({
        where: and(
          eq(announcements.scope, "school_year"),
          eq(announcements.referenceId, enrollmentInfo.schoolYearId),
          eq(announcements.isPublished, true),
          or(
            isNull(announcements.expiresAt),
            gte(announcements.expiresAt, new Date())
          )
        ),
        with: {
          author: {
            columns: {
              id: true,
              name: true,
              fullName: true,
            },
          },
        },
      })
      scopedAnnouncements.push(...yearAnnouncements)
    }

    if (enrollmentInfo?.programId) {
      const programAnnouncements = await db.query.announcements.findMany({
        where: and(
          eq(announcements.scope, "program"),
          eq(announcements.referenceId, enrollmentInfo.programId),
          eq(announcements.isPublished, true),
          or(
            isNull(announcements.expiresAt),
            gte(announcements.expiresAt, new Date())
          )
        ),
        with: {
          author: {
            columns: {
              id: true,
              name: true,
              fullName: true,
            },
          },
        },
      })
      scopedAnnouncements.push(...programAnnouncements)
    }

    // Combine and sort by pinned and date
    const allAnnouncements = [...globalAnnouncements, ...scopedAnnouncements]
    allAnnouncements.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return (
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      )
    })

    return { success: true, data: allAnnouncements }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('relation "announcements" does not exist')
    ) {
      return { success: true, data: [] }
    }

    console.error("Failed to fetch announcements for user:", error)
    return { success: false, error: "Failed to fetch announcements" }
  }
}

export async function deleteAnnouncement(id: string) {
  try {
    await db.delete(announcements).where(eq(announcements.id, id))
    revalidatePath("/admin/announcements")
    return { success: true }
  } catch (error) {
    console.error("Failed to delete announcement:", error)
    return { success: false, error: "Failed to delete announcement" }
  }
}
