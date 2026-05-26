"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { updateAISettings } from "@/lib/data/ai-settings"

export type UpdateAISettingsState = {
  success: boolean
  message: string
  maskedKeys?: {
    chatApiKeyMasked: boolean
    embeddingApiKeyMasked: boolean
  }
}

const initialState: UpdateAISettingsState = {
  success: false,
  message: "",
}

const VALID_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "mistral",
  "groq",
  "xai",
  "cohere",
  "deepseek",
  "fireworks",
  "togetherai",
  "perplexity",
  "local",
] as const

function sanitizeText(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return ""
  return value.trim()
}

function sanitizeNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null
  const num = parseInt(value.trim(), 10)
  return isNaN(num) ? null : num
}

function sanitizeFloat(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "0.7"
  const num = parseFloat(value.trim())
  if (isNaN(num)) return "0.7"
  return Math.max(0, Math.min(2, num)).toString()
}

function isValidProvider(
  provider: string
): provider is (typeof VALID_PROVIDERS)[number] {
  return VALID_PROVIDERS.includes(provider as (typeof VALID_PROVIDERS)[number])
}

export async function updateAIConfiguration(
  _prevState: UpdateAISettingsState = initialState,
  formData: FormData
): Promise<UpdateAISettingsState> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return {
      success: false,
      message: "Unauthorized. Only admins can update AI settings.",
    }
  }

  const chatProvider = sanitizeText(formData.get("chatProvider"))
  const chatModelId = sanitizeText(formData.get("chatModelId"))
  const chatApiKey = sanitizeText(formData.get("chatApiKey"))
  const chatBaseUrl = sanitizeText(formData.get("chatBaseUrl"))
  const chatTemperature = sanitizeFloat(formData.get("chatTemperature"))
  const chatMaxTokens = sanitizeNumber(formData.get("chatMaxTokens")) ?? 4096

  const embeddingProvider = sanitizeText(formData.get("embeddingProvider"))
  const embeddingModelId = sanitizeText(formData.get("embeddingModelId"))
  const embeddingApiKey = sanitizeText(formData.get("embeddingApiKey"))
  const embeddingBaseUrl = sanitizeText(formData.get("embeddingBaseUrl"))
  const embeddingDimensions =
    sanitizeNumber(formData.get("embeddingDimensions")) ?? 1536

  const isEnabled = formData.get("isEnabled") === "on"
  const allowFileUploads = formData.get("allowFileUploads") === "on"

  // Validation
  if (!chatProvider || !isValidProvider(chatProvider)) {
    return { success: false, message: "Invalid chat provider selected." }
  }

  if (!chatModelId || chatModelId.length > 128) {
    return {
      success: false,
      message: "Chat model ID is required and must be 128 characters or less.",
    }
  }

  if (!embeddingProvider || !isValidProvider(embeddingProvider)) {
    return { success: false, message: "Invalid embedding provider selected." }
  }

  if (!embeddingModelId || embeddingModelId.length > 128) {
    return {
      success: false,
      message:
        "Embedding model ID is required and must be 128 characters or less.",
    }
  }

  // Local provider requires base URL
  if (chatProvider === "local" && !chatBaseUrl) {
    return {
      success: false,
      message: "Local provider requires a base URL endpoint.",
    }
  }

  if (embeddingProvider === "local" && !embeddingBaseUrl) {
    return {
      success: false,
      message: "Local embedding provider requires a base URL endpoint.",
    }
  }

  try {
    const success = await updateAISettings({
      chatProvider,
      chatModelId,
      chatApiKey: chatApiKey || null,
      chatBaseUrl: chatBaseUrl || null,
      chatTemperature,
      chatMaxTokens,
      embeddingProvider,
      embeddingModelId,
      embeddingApiKey: embeddingApiKey || null,
      embeddingBaseUrl: embeddingBaseUrl || null,
      embeddingDimensions,
      isEnabled,
      allowFileUploads,
      updatedBy: session.user.id,
    })

    if (!success) {
      return {
        success: false,
        message: "Failed to save AI settings. Please try again.",
      }
    }

    revalidatePath("/admin/settings")
    revalidatePath("/admin/settings/ai")

    return {
      success: true,
      message: "AI settings updated successfully.",
      maskedKeys: {
        chatApiKeyMasked: chatApiKey.length > 0,
        embeddingApiKeyMasked: embeddingApiKey.length > 0,
      },
    }
  } catch (error) {
    console.error("Failed to update AI settings:", error)
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    }
  }
}
