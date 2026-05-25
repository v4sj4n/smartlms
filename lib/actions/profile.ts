"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { eq } from "drizzle-orm"

import { authOptions } from "@/lib/auth"
import { db } from "@/db"
import { users } from "@/db/schema"
import { getProfileSettingsCapabilities } from "@/lib/data/profile-settings"
import { normalizeProfileImageReference } from "@/lib/profile-image"

export type UpdateProfileSettingsState = {
  success: boolean
  message: string
}

const initialState: UpdateProfileSettingsState = {
  success: false,
  message: "",
}

function sanitizeText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return ""
  return value.trim()
}

export async function updateOwnProfileSettings(
  _prevState: UpdateProfileSettingsState = initialState,
  formData: FormData
): Promise<UpdateProfileSettingsState> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return { success: false, message: "You must be signed in." }
  }

  const role = session.user.role
  if (role !== "STUDENT" && role !== "PROFESSOR" && role !== "ADMIN") {
    return {
      success: false,
      message: "Only students, professors, and admins can update these settings.",
    }
  }

  const nickname = sanitizeText(formData.get("nickname"))
  const bio = sanitizeText(formData.get("bio"))
  const imageInput = sanitizeText(formData.get("image"))

  if (nickname.length > 64) {
    return {
      success: false,
      message: "Nickname must be 64 characters or less.",
    }
  }

  if (bio.length > 500) {
    return { success: false, message: "Bio must be 500 characters or less." }
  }

  const normalizedImage = normalizeProfileImageReference(imageInput)
  if (imageInput && !normalizedImage) {
    return {
      success: false,
      message: "Profile image must be a valid URL or uploaded file path.",
    }
  }

  try {
    const { hasNickname, hasBio } = await getProfileSettingsCapabilities()

    const updateData: {
      image: string | null
      updatedAt: Date
      nickname?: string | null
      bio?: string | null
    } = {
      image: normalizedImage,
      updatedAt: new Date(),
    }

    if (hasNickname) {
      updateData.nickname = nickname || null
    }

    if (hasBio) {
      updateData.bio = bio || null
    }

    await db.update(users).set(updateData).where(eq(users.id, session.user.id))

    revalidatePath("/student")
    revalidatePath("/student/settings")
    revalidatePath("/professor")
    revalidatePath("/professor/settings")

    if (!hasNickname || !hasBio) {
      return {
        success: true,
        message:
          "Saved. Run latest migrations to enable nickname and bio storage.",
      }
    }

    return { success: true, message: "Profile settings updated." }
  } catch (error) {
    console.error("Failed to update profile settings:", error)
    return { success: false, message: "Failed to update settings. Try again." }
  }
}
