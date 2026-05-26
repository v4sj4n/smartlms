"use server"

import { db } from "@/db"
import {
  files,
  clubMembers,
  clubMaterials,
  courseWeeks,
  lectureMaterials,
} from "@/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import { requireAuth } from "@/lib/auth-guard"
import {
  createSignedUploadSchema,
  finalizeUploadSchema,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/validation/upload"
import { createSupabaseServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getBoss } from "@/lib/queues/boss"

const UPLOAD_BUCKET = "uploads"

async function assertUploadPermission(input: {
  role: string
  userId: string
  clubId?: string
}) {
  if (["ADMIN", "PROFESSOR"].includes(input.role)) {
    return
  }

  if (input.role === "STUDENT" && input.clubId) {
    const membership = await db.query.clubMembers.findFirst({
      where: and(
        eq(clubMembers.clubId, input.clubId),
        eq(clubMembers.userId, input.userId)
      ),
      columns: { id: true },
    })

    if (membership) {
      return
    }
  }

  throw new Error("You are not allowed to upload files here")
}

function mapMimeTypeToLectureMaterialType(mimeType: string) {
  if (mimeType === "application/pdf") return "PDF"
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return "PRESENTATION"
  }
  if (mimeType.startsWith("image/")) return "DOCUMENT"
  if (mimeType.startsWith("text/")) return "DOCUMENT"
  return "DOCUMENT"
}

function mapMimeTypeToClubMaterialType(mimeType: string) {
  if (mimeType === "application/pdf") return "PDF"
  if (mimeType.startsWith("image/")) return "IMAGE"
  return "DOCUMENT"
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
}

export async function createSignedUpload(input: unknown) {
  const user = await requireAuth()

  const data = createSignedUploadSchema.parse(input)

  if (!data.profileImage) {
    await assertUploadPermission({
      role: user.role,
      userId: user.id,
      clubId: data.clubId,
    })
  }

  if (data.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("File exceeds maximum allowed size")
  }

  const now = new Date()
  const stamp = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`
  const path = [
    data.profileImage ? "profile-images" : (data.subjectId ?? "unscoped"),
    data.profileImage
      ? user.id
      : data.weekNumber
        ? `week-${data.weekNumber}`
        : "week-none",
    data.profileImage ? stamp : (data.clubId ?? "club-none"),
    user.id,
    stamp,
    `${crypto.randomUUID()}-${safeFileName(data.name)}`,
  ].join("/")

  const supabase = createSupabaseServiceClient()
  const { data: signed, error } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .createSignedUploadUrl(path)

  if (error || !signed) {
    throw new Error(error?.message ?? "Failed to create signed upload url")
  }

  return {
    token: signed.token,
    path: signed.path,
    signedUrl: signed.signedUrl,
  }
}

export async function finalizeFileUpload(input: unknown) {
  const user = await requireAuth()

  const data = finalizeUploadSchema.parse(input)
  await assertUploadPermission({
    role: user.role,
    userId: user.id,
    clubId: data.clubId,
  })

  const [record] = await db
    .insert(files)
    .values({
      name: data.name,
      mimeType: data.mimeType,
      size: data.size,
      path: data.path,
      uploadedBy: user.id,
      subjectId: data.subjectId,
      weekNumber: data.weekNumber,
      clubId: data.clubId,
      metadata: data.metadata,
      status: "UPLOADED",
    })
    .returning()

  if (data.clubId) {
    const existingClubMaterial = await db.query.clubMaterials.findFirst({
      where: and(
        eq(clubMaterials.clubId, data.clubId),
        eq(clubMaterials.contentUrl, data.path)
      ),
      columns: { id: true },
    })

    if (!existingClubMaterial) {
      await db.insert(clubMaterials).values({
        clubId: data.clubId,
        uploadedBy: user.id,
        title: data.name,
        type: mapMimeTypeToClubMaterialType(data.mimeType),
        contentUrl: data.path,
        fileSize: data.size,
      })
    }

    revalidatePath(`/student/clubs/${data.clubId}`)
    revalidatePath(`/professor/clubs/${data.clubId}`)
    revalidatePath(`/admin/clubs/${data.clubId}`)
  }

  if (data.subjectId && data.weekNumber) {
    const week = await db.query.courseWeeks.findFirst({
      where: and(
        eq(courseWeeks.courseId, data.subjectId),
        eq(courseWeeks.weekNumber, data.weekNumber)
      ),
      columns: { id: true },
    })

    if (week) {
      const existingMaterial = await db.query.lectureMaterials.findFirst({
        where: and(
          eq(lectureMaterials.weekId, week.id),
          eq(lectureMaterials.contentUrl, data.path)
        ),
        columns: { id: true },
      })

      if (!existingMaterial) {
        await db.insert(lectureMaterials).values({
          weekId: week.id,
          title: data.name,
          type: mapMimeTypeToLectureMaterialType(data.mimeType),
          contentUrl: data.path,
          fileSize: data.size,
        })
      }
    }

    revalidatePath(`/professor/courses/${data.subjectId}`)
    revalidatePath(`/student/courses/${data.subjectId}`)
  }

  const boss = await getBoss()
  await boss.send("file.ingest", { fileId: record.id })

  revalidatePath("/professor/content")
  revalidatePath("/dashboard")

  return record
}

export async function softDeleteFile(fileId: string) {
  const user = await requireAuth()
  const file = await db.query.files.findFirst({
    where: and(eq(files.id, fileId), isNull(files.deletedAt)),
    columns: { id: true, uploadedBy: true },
  })

  if (!file) throw new Error("File not found")

  if (user.role !== "ADMIN" && file.uploadedBy !== user.id) {
    throw new Error("Forbidden")
  }

  await db
    .update(files)
    .set({ deletedAt: new Date(), status: "DELETED" })
    .where(eq(files.id, fileId))

  return { success: true }
}

export async function getSignedDownloadUrl(path: string) {
  const user = await requireAuth()

  if (!["ADMIN", "PROFESSOR", "STUDENT"].includes(user.role)) {
    throw new Error("Forbidden")
  }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .createSignedUrl(path, 60)

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create signed download url")
  }

  return data.signedUrl
}
