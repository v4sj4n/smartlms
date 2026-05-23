"use server"

import { db } from "@/db"
import {
  clubs,
  clubMembers,
  clubMaterials,
  clubMessages,
  clubPosts,
  clubEvents,
} from "@/db/schema"
import { eq, and, asc, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// ============================================================================
// CLUB ACTIONS
// ============================================================================

export async function createClub(data: {
  name: string
  description?: string
  schoolYearId?: string
  bannerImageUrl?: string
}) {
  try {
    const [club] = await db
      .insert(clubs)
      .values({
        name: data.name,
        description: data.description,
      })
      .returning()

    revalidatePath("/admin/clubs")
    revalidatePath("/student/clubs")
    return { success: true, data: club }
  } catch (error) {
    console.error("Failed to create club:", error)
    return { success: false, error: "Failed to create club" }
  }
}

export async function getClubs() {
  try {
    const data = await db.query.clubs.findMany({
      orderBy: [desc(clubs.createdAt)],
      with: {
        members: {
          with: {
            user: true,
          },
        },
        materials: {
          orderBy: [
            desc(clubMaterials.isPinned),
            asc(clubMaterials.orderIndex),
            desc(clubMaterials.createdAt),
          ],
          limit: 3,
          with: {
            uploader: true,
          },
        },
        messages: {
          orderBy: [desc(clubMessages.createdAt)],
          limit: 3,
          with: {
            author: true,
          },
        },
      },
    })
    return { success: true, data }
  } catch (error) {
    console.error("Failed to fetch clubs:", error)
    return { success: false, error: "Failed to fetch clubs" }
  }
}

export async function getClubById(id: string) {
  try {
    const club = await db.query.clubs.findFirst({
      where: eq(clubs.id, id),
      with: {
        members: {
          with: {
            user: true,
          },
        },
        materials: {
          orderBy: [
            desc(clubMaterials.isPinned),
            asc(clubMaterials.orderIndex),
            desc(clubMaterials.createdAt),
          ],
          with: {
            uploader: true,
          },
        },
        messages: {
          orderBy: [asc(clubMessages.createdAt)],
          with: {
            author: true,
          },
        },
      },
    })

    if (!club) {
      return { success: false, error: "Club not found" }
    }

    return { success: true, data: club }
  } catch (error) {
    console.error("Failed to fetch club:", error)
    return { success: false, error: "Failed to fetch club" }
  }
}

export async function joinClub(
  clubId: string,
  userId: string,
  role: "LEADER" | "MEMBER" | "ADVISOR" = "MEMBER"
) {
  try {
    const [membership] = await db
      .insert(clubMembers)
      .values({
        clubId,
        userId,
        role,
      })
      .returning()

    revalidatePath(`/student/clubs/${clubId}`)
    return { success: true, data: membership }
  } catch (error) {
    console.error("Failed to join club:", error)
    return { success: false, error: "Failed to join club" }
  }
}

export async function leaveClub(clubId: string, userId: string) {
  try {
    await db
      .delete(clubMembers)
      .where(
        and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId))
      )

    revalidatePath(`/student/clubs/${clubId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to leave club:", error)
    return { success: false, error: "Failed to leave club" }
  }
}

// ============================================================================
// CLUB MATERIAL ACTIONS
// ============================================================================

export async function createClubMaterial(data: {
  clubId: string
  uploadedBy?: string
  title: string
  description?: string
  type: "PDF" | "LINK" | "DOCUMENT" | "VIDEO" | "IMAGE"
  contentUrl?: string
  fileSize?: number
  orderIndex?: number
  isPinned?: boolean
}) {
  try {
    const [material] = await db
      .insert(clubMaterials)
      .values({
        clubId: data.clubId,
        uploadedBy: data.uploadedBy,
        title: data.title,
        description: data.description,
        type: data.type,
        contentUrl: data.contentUrl,
        fileSize: data.fileSize,
        orderIndex: data.orderIndex ?? 0,
        isPinned: data.isPinned ?? false,
      })
      .returning()

    revalidatePath(`/student/clubs/${data.clubId}`)
    revalidatePath(`/admin/clubs/${data.clubId}`)
    return { success: true, data: material }
  } catch (error) {
    console.error("Failed to create club material:", error)
    return { success: false, error: "Failed to create club material" }
  }
}

// ============================================================================
// CLUB CHAT ACTIONS
// ============================================================================

export async function createClubMessage(data: {
  clubId: string
  authorId: string
  content: string
}) {
  try {
    const [message] = await db
      .insert(clubMessages)
      .values({
        clubId: data.clubId,
        authorId: data.authorId,
        content: data.content,
      })
      .returning()

    revalidatePath(`/student/clubs/${data.clubId}`)
    revalidatePath(`/admin/clubs/${data.clubId}`)
    return { success: true, data: message }
  } catch (error) {
    console.error("Failed to create club message:", error)
    return { success: false, error: "Failed to create club message" }
  }
}

export async function getClubMessages(clubId: string) {
  try {
    const data = await db.query.clubMessages.findMany({
      where: eq(clubMessages.clubId, clubId),
      orderBy: [asc(clubMessages.createdAt)],
      with: {
        author: true,
      },
    })

    return { success: true, data }
  } catch (error) {
    console.error("Failed to fetch club messages:", error)
    return { success: false, error: "Failed to fetch club messages" }
  }
}

// ============================================================================
// LEGACY CLUB POST ACTIONS
// ============================================================================

export async function createClubPost(data: {
  clubId: string
  authorId: string
  title: string
  content: string
  imageUrl?: string
}) {
  try {
    const [post] = await db
      .insert(clubPosts)
      .values({
        clubId: data.clubId,
        authorId: data.authorId,
        title: data.title,
        content: data.content,
        imageUrl: data.imageUrl,
      })
      .returning()

    revalidatePath(`/student/clubs/${data.clubId}`)
    return { success: true, data: post }
  } catch (error) {
    console.error("Failed to create club post:", error)
    return { success: false, error: "Failed to create club post" }
  }
}

// ============================================================================
// LEGACY CLUB EVENT ACTIONS
// ============================================================================

export async function createClubEvent(data: {
  clubId: string
  createdBy: string
  title: string
  description?: string
  location?: string
  startDate: Date
  endDate?: Date
}) {
  try {
    const [event] = await db
      .insert(clubEvents)
      .values({
        clubId: data.clubId,
        createdBy: data.createdBy,
        title: data.title,
        description: data.description,
        location: data.location,
        startDate: data.startDate,
        endDate: data.endDate,
      })
      .returning()

    revalidatePath(`/student/clubs/${data.clubId}`)
    return { success: true, data: event }
  } catch (error) {
    console.error("Failed to create club event:", error)
    return { success: false, error: "Failed to create club event" }
  }
}
