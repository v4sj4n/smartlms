import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { and, eq, isNull } from "drizzle-orm"

import { authOptions } from "@/lib/auth"
import { db } from "@/db"
import { clubMembers, courseEnrollments, files } from "@/db/schema"
import { createSupabaseServiceClient } from "@/lib/supabase/server"

const UPLOAD_BUCKET = "uploads"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const path = req.nextUrl.searchParams.get("path")
  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 })
  }

  const file = await db.query.files.findFirst({
    where: and(eq(files.path, path), isNull(files.deletedAt)),
    columns: {
      id: true,
      subjectId: true,
      clubId: true,
      uploadedBy: true,
    },
  })

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  const role = session.user.role
  const userId = session.user.id

  if (role !== "ADMIN" && role !== "PROFESSOR") {
    let allowed = false

    if (file.uploadedBy === userId) {
      allowed = true
    }

    if (!allowed && file.subjectId) {
      const enrollment = await db.query.courseEnrollments.findFirst({
        where: and(
          eq(courseEnrollments.courseId, file.subjectId),
          eq(courseEnrollments.studentId, userId)
        ),
        columns: { id: true },
      })

      if (enrollment) {
        allowed = true
      }
    }

    if (!allowed && file.clubId) {
      const membership = await db.query.clubMembers.findFirst({
        where: and(
          eq(clubMembers.clubId, file.clubId),
          eq(clubMembers.userId, userId)
        ),
        columns: { id: true },
      })

      if (membership) {
        allowed = true
      }
    }

    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .createSignedUrl(path, 60)

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create signed download url" },
      { status: 500 }
    )
  }

  return NextResponse.redirect(data.signedUrl, { status: 302 })
}
