import { createSupabaseServiceClient } from "@/lib/supabase/server"

const STORAGE_BUCKET = "uploads"

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

function isStoragePath(value: string) {
  return (
    /^[A-Za-z0-9/_-]+(?:\.[A-Za-z0-9]+)?$/.test(value) && !value.startsWith("/")
  )
}

export function normalizeProfileImageReference(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  if (isHttpUrl(trimmed)) {
    return trimmed
  }

  if (isStoragePath(trimmed)) {
    return trimmed
  }

  return null
}

export async function resolveProfileImageUrl(image: string | null) {
  if (!image) {
    return null
  }

  if (isHttpUrl(image)) {
    return image
  }

  try {
    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(image, 60 * 60)

    if (error || !data) {
      return null
    }

    return data.signedUrl
  } catch {
    return null
  }
}
