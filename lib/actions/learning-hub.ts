"use server"

import { db } from "@/db"
import {
  files,
  learningHubGroupMembers,
  learningHubGroupMessages,
  learningHubGroups,
  learningHubItems,
  learningHubs,
} from "@/db/schema"
import { requireRole } from "@/lib/auth-guard"
import { and, asc, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

const learningHubItemTypes = ["goal", "note", "task", "resource"] as const

type LearningHubItemType = (typeof learningHubItemTypes)[number]

function generateJoinCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
}

function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim()
}

async function requireStudentId() {
  const user = await requireRole(["STUDENT"])
  return user.id
}

async function generateUniqueJoinCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const joinCode = generateJoinCode()
    const existing = await db.query.learningHubGroups.findFirst({
      where: eq(learningHubGroups.joinCode, joinCode),
      columns: { id: true },
    })

    if (!existing) {
      return joinCode
    }
  }

  return generateJoinCode()
}

async function getLearningHubDetails(studentId: string) {
  return await db.query.learningHubs.findFirst({
    where: eq(learningHubs.studentId, studentId),
    with: {
      items: {
        orderBy: [
          asc(learningHubItems.orderIndex),
          desc(learningHubItems.createdAt),
        ],
      },
      groups: {
        orderBy: [desc(learningHubGroups.createdAt)],
        with: {
          members: {
            with: {
              user: true,
            },
          },
          messages: {
            orderBy: [desc(learningHubGroupMessages.createdAt)],
            limit: 1,
            with: {
              author: true,
            },
          },
          files: {
            orderBy: [desc(files.createdAt)],
            limit: 1,
            with: {
              uploader: true,
            },
          },
        },
      },
    },
  })
}

async function ensureStudentLearningHub(studentId: string) {
  const existingHub = await getLearningHubDetails(studentId)

  if (existingHub) {
    return existingHub
  }

  await db.insert(learningHubs).values({ studentId }).onConflictDoNothing()

  return await getLearningHubDetails(studentId)
}

async function ensureGroupMembership(studentId: string, groupId: string) {
  return await db.query.learningHubGroupMembers.findFirst({
    where: and(
      eq(learningHubGroupMembers.groupId, groupId),
      eq(learningHubGroupMembers.userId, studentId)
    ),
    columns: { id: true },
  })
}

async function ensureJoinedGroup(studentId: string, groupId: string) {
  const membership = await ensureGroupMembership(studentId, groupId)

  if (!membership) {
    return null
  }

  return await db.query.learningHubGroups.findFirst({
    where: eq(learningHubGroups.id, groupId),
    with: {
      creator: true,
      members: { with: { user: true } },
      messages: {
        orderBy: [asc(learningHubGroupMessages.createdAt)],
        with: { author: true },
      },
      files: {
        orderBy: [desc(files.createdAt)],
        with: { uploader: true },
      },
    },
  })
}

export async function getStudentLearningHub() {
  try {
    const studentId = await requireStudentId()
    const data = await ensureStudentLearningHub(studentId)
    return { success: true, data }
  } catch (error) {
    console.error("Failed to fetch learning hub:", error)
    return { success: false, error: "Failed to fetch learning hub" }
  }
}

export async function getDiscoverableLearningHubGroups() {
  try {
    const studentId = await requireStudentId()
    const groups = await db.query.learningHubGroups.findMany({
      where: eq(learningHubGroups.isDiscoverable, true),
      orderBy: [desc(learningHubGroups.createdAt)],
      with: {
        creator: true,
        members: { with: { user: true } },
        messages: {
          orderBy: [desc(learningHubGroupMessages.createdAt)],
          limit: 1,
          with: { author: true },
        },
        files: {
          orderBy: [desc(files.createdAt)],
          limit: 1,
          with: { uploader: true },
        },
      },
    })

    return {
      success: true,
      data: groups.filter(
        (group) => !group.members?.some((member) => member.userId === studentId)
      ),
    }
  } catch (error) {
    console.error("Failed to fetch discoverable learning hub groups:", error)
    return {
      success: false,
      error: "Failed to fetch discoverable learning hub groups",
    }
  }
}

export async function getStudentLearningHubGroup(groupId: string) {
  try {
    const studentId = await requireStudentId()
    const data = await ensureJoinedGroup(studentId, groupId)

    if (!data) {
      return { success: false, error: "Group not found" }
    }

    return { success: true, data }
  } catch (error) {
    console.error("Failed to fetch learning hub group:", error)
    return { success: false, error: "Failed to fetch learning hub group" }
  }
}

export async function createLearningHubItem(formData: FormData) {
  try {
    const studentId = await requireStudentId()
    const title = normalizeText(formData.get("title"))
    const description = normalizeText(formData.get("description"))
    const rawType = normalizeText(formData.get("type")) || "note"
    const dueAtValue = normalizeText(formData.get("dueAt"))

    if (!title) {
      return { success: false, error: "Title is required" }
    }

    const type: LearningHubItemType = learningHubItemTypes.includes(
      rawType as LearningHubItemType
    )
      ? (rawType as LearningHubItemType)
      : "note"

    const hub = await ensureStudentLearningHub(studentId)

    if (!hub) {
      return { success: false, error: "Learning hub not found" }
    }

    const dueAt = dueAtValue ? new Date(dueAtValue) : null

    const [item] = await db
      .insert(learningHubItems)
      .values({
        hubId: hub.id,
        type,
        title,
        description: description || null,
        dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
      })
      .returning()

    revalidatePath("/student/learning-hub")
    revalidatePath("/student")

    return { success: true, data: item }
  } catch (error) {
    console.error("Failed to create learning hub item:", error)
    return { success: false, error: "Failed to create learning hub item" }
  }
}

export async function createLearningHubGroup(formData: FormData) {
  try {
    const studentId = await requireStudentId()
    const title = normalizeText(formData.get("title"))
    const description = normalizeText(formData.get("description"))
    const isDiscoverable = formData.get("private") !== "true"

    if (!title) {
      return { success: false, error: "Topic is required" }
    }

    const hub = await ensureStudentLearningHub(studentId)

    if (!hub) {
      return { success: false, error: "Learning hub not found" }
    }

    const joinCode = await generateUniqueJoinCode()

    const [group] = await db
      .insert(learningHubGroups)
      .values({
        hubId: hub.id,
        createdById: studentId,
        title,
        description: description || null,
        joinCode,
        isDiscoverable,
      })
      .returning()

    await db.insert(learningHubGroupMembers).values({
      groupId: group.id,
      userId: studentId,
      role: "OWNER",
    })

    revalidatePath("/student/learning-hub")
    revalidatePath("/student")
    revalidatePath(`/student/learning-hub/${group.id}`)

    return { success: true, data: group }
  } catch (error) {
    console.error("Failed to create learning hub group:", error)
    return { success: false, error: "Failed to create learning hub group" }
  }
}

export async function joinLearningHubGroup(groupId: string) {
  try {
    const studentId = await requireStudentId()

    const group = await db.query.learningHubGroups.findFirst({
      where: eq(learningHubGroups.id, groupId),
      columns: { id: true },
    })

    if (!group) {
      return { success: false, error: "Group not found" }
    }

    const existingMembership = await ensureGroupMembership(studentId, group.id)

    if (!existingMembership) {
      await db.insert(learningHubGroupMembers).values({
        groupId: group.id,
        userId: studentId,
        role: "MEMBER",
      })
    }

    revalidatePath("/student/learning-hub")
    revalidatePath(`/student/learning-hub/${group.id}`)

    return { success: true, data: group }
  } catch (error) {
    console.error("Failed to join learning hub group:", error)
    return { success: false, error: "Failed to join learning hub group" }
  }
}

export async function joinLearningHubGroupByCode(formData: FormData) {
  try {
    const joinCode = normalizeText(formData.get("joinCode")).toUpperCase()

    if (!joinCode) {
      return { success: false, error: "Join code is required" }
    }

    const group = await db.query.learningHubGroups.findFirst({
      where: eq(learningHubGroups.joinCode, joinCode),
      columns: { id: true },
    })

    if (!group) {
      return { success: false, error: "Invalid join code" }
    }

    return await joinLearningHubGroup(group.id)
  } catch (error) {
    console.error("Failed to join learning hub group:", error)
    return { success: false, error: "Failed to join learning hub group" }
  }
}

export async function createLearningHubMessage(formData: FormData) {
  try {
    const studentId = await requireStudentId()
    const groupId = normalizeText(formData.get("groupId"))
    const content = normalizeText(formData.get("content"))

    if (!groupId || !content) {
      return { success: false, error: "Message cannot be empty" }
    }

    const membership = await ensureGroupMembership(studentId, groupId)

    if (!membership) {
      return { success: false, error: "You are not a member of this group" }
    }

    const [message] = await db
      .insert(learningHubGroupMessages)
      .values({
        groupId,
        authorId: studentId,
        content,
      })
      .returning()

    revalidatePath(`/student/learning-hub/${groupId}`)
    revalidatePath("/student/learning-hub")

    return { success: true, data: message }
  } catch (error) {
    console.error("Failed to create learning hub message:", error)
    return { success: false, error: "Failed to create learning hub message" }
  }
}
