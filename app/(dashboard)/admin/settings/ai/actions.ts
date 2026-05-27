"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { and, eq } from "drizzle-orm"

import { authOptions } from "@/lib/auth"
import { db } from "@/db"
import { aiModels, aiProviders } from "@/db/schema"
import { updateAISettings, getAISettings } from "@/lib/data/ai-settings"
import { getProviderRegistryEntry } from "@/lib/ai/provider-registry"
import {
  aiConfigSectionSchema,
  aiModelFormSchema,
  aiProviderStatusSchema,
  type AIConfigSectionValues,
  type AIModelFormValues,
  type AIProviderStatusValue,
} from "./schemas"
import {
  DEFAULT_AI_SETTINGS,
  ensureAIProvidersSeeded,
  getModelOptionsForProvider,
} from "./data"

export type AIAdminActionResult = {
  success: boolean
  message: string
}

async function requireAdminSession() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null
  }

  return session
}

function normalizeBaseUrl(providerId: string, baseUrl: string) {
  if (baseUrl) {
    return baseUrl
  }

  return getProviderRegistryEntry(providerId)?.local
    ? (getProviderRegistryEntry(providerId)?.defaultBaseUrl ?? null)
    : null
}

async function isDuplicateIdentifier(
  providerId: string,
  modelIdentifier: string,
  excludeId?: string
): Promise<boolean> {
  const existing = await db.query.aiModels.findFirst({
    where: and(
      eq(aiModels.providerId, providerId),
      eq(aiModels.modelIdentifier, modelIdentifier)
    ),
    columns: { id: true },
  })

  if (!existing) {
    return false
  }

  return existing.id !== excludeId
}

async function getSectionModelOptions(
  providerId: string,
  modelType: "text" | "embedding"
) {
  const models = await db.select().from(aiModels)
  return getModelOptionsForProvider(providerId, modelType, models, false)
}

export async function createAIModelAction(
  input: AIModelFormValues
): Promise<AIAdminActionResult> {
  const session = await requireAdminSession()

  if (!session) {
    return { success: false, message: "Unauthorized." }
  }

  const parsed = aiModelFormSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, message: "Please correct the model form." }
  }

  await ensureAIProvidersSeeded()

  const provider = getProviderRegistryEntry(parsed.data.providerId)
  if (!provider) {
    return { success: false, message: "Invalid provider selected." }
  }

  if (!provider.supportedModelTypes.includes(parsed.data.modelType)) {
    return {
      success: false,
      message: "That provider does not support the selected model type.",
    }
  }

  if (
    await isDuplicateIdentifier(
      parsed.data.providerId,
      parsed.data.modelIdentifier
    )
  ) {
    return {
      success: false,
      message: "Model identifiers must be unique per provider.",
    }
  }

  await db.insert(aiModels).values({
    providerId: parsed.data.providerId,
    modelName: parsed.data.modelName,
    modelIdentifier: parsed.data.modelIdentifier,
    modelType: parsed.data.modelType,
    enabled: parsed.data.enabled,
  })

  revalidatePath("/admin/settings")
  revalidatePath("/admin/settings/ai")

  return { success: true, message: "Model created." }
}

export async function updateAIModelAction(
  input: AIModelFormValues
): Promise<AIAdminActionResult> {
  const session = await requireAdminSession()

  if (!session) {
    return { success: false, message: "Unauthorized." }
  }

  const parsed = aiModelFormSchema.safeParse(input)
  if (!parsed.success || !parsed.data.id) {
    return { success: false, message: "Please correct the model form." }
  }

  await ensureAIProvidersSeeded()

  const provider = getProviderRegistryEntry(parsed.data.providerId)
  if (!provider) {
    return { success: false, message: "Invalid provider selected." }
  }

  if (!provider.supportedModelTypes.includes(parsed.data.modelType)) {
    return {
      success: false,
      message: "That provider does not support the selected model type.",
    }
  }

  if (
    await isDuplicateIdentifier(
      parsed.data.providerId,
      parsed.data.modelIdentifier,
      parsed.data.id
    )
  ) {
    return {
      success: false,
      message: "Model identifiers must be unique per provider.",
    }
  }

  await db
    .update(aiModels)
    .set({
      providerId: parsed.data.providerId,
      modelName: parsed.data.modelName,
      modelIdentifier: parsed.data.modelIdentifier,
      modelType: parsed.data.modelType,
      enabled: parsed.data.enabled,
    })
    .where(eq(aiModels.id, parsed.data.id))

  revalidatePath("/admin/settings")
  revalidatePath("/admin/settings/ai")

  return { success: true, message: "Model updated." }
}

export async function deleteAIModelAction(input: {
  id: string
}): Promise<AIAdminActionResult> {
  const session = await requireAdminSession()

  if (!session) {
    return { success: false, message: "Unauthorized." }
  }

  await db.delete(aiModels).where(eq(aiModels.id, input.id))

  revalidatePath("/admin/settings")
  revalidatePath("/admin/settings/ai")

  return { success: true, message: "Model deleted." }
}

export async function setAIModelEnabledAction(input: {
  id: string
  enabled: boolean
}): Promise<AIAdminActionResult> {
  const session = await requireAdminSession()

  if (!session) {
    return { success: false, message: "Unauthorized." }
  }

  await db
    .update(aiModels)
    .set({ enabled: input.enabled })
    .where(eq(aiModels.id, input.id))

  revalidatePath("/admin/settings")
  revalidatePath("/admin/settings/ai")

  return {
    success: true,
    message: input.enabled ? "Model enabled." : "Model disabled.",
  }
}

export async function setAIProviderStatusAction(input: {
  id: string
  status: AIProviderStatusValue
}): Promise<AIAdminActionResult> {
  const session = await requireAdminSession()

  if (!session) {
    return { success: false, message: "Unauthorized." }
  }

  const parsed = aiProviderStatusSchema.safeParse(input.status)
  if (!parsed.success) {
    return { success: false, message: "Please pick a valid provider status." }
  }

  await ensureAIProvidersSeeded()

  await db
    .update(aiProviders)
    .set({ status: parsed.data })
    .where(eq(aiProviders.id, input.id))

  revalidatePath("/admin/settings")
  revalidatePath("/admin/settings/ai")

  return {
    success: true,
    message:
      parsed.data === "enabled" ? "Provider enabled." : "Provider disabled.",
  }
}

async function updateSectionRouting(
  section: "text" | "embedding",
  values: AIConfigSectionValues
): Promise<AIAdminActionResult> {
  const session = await requireAdminSession()

  if (!session) {
    return { success: false, message: "Unauthorized." }
  }

  const parsed = aiConfigSectionSchema.safeParse(values)
  if (!parsed.success) {
    return { success: false, message: "Please correct the AI routing form." }
  }

  await ensureAIProvidersSeeded()

  const provider = getProviderRegistryEntry(parsed.data.providerId)
  if (!provider) {
    return { success: false, message: "Invalid provider selected." }
  }

  if (!provider.supportedModelTypes.includes(section)) {
    return {
      success: false,
      message: "That provider does not support this section.",
    }
  }

  const availableModels = await getSectionModelOptions(
    parsed.data.providerId,
    section
  )
  const modelExists = availableModels.some(
    (model) => model.modelIdentifier === parsed.data.modelId
  )

  if (!modelExists) {
    return {
      success: false,
      message: "Pick a valid model for the selected provider.",
    }
  }

  const currentSettings = (await getAISettings()) ?? {
    id: crypto.randomUUID(),
    ...DEFAULT_AI_SETTINGS,
    updatedAt: new Date(),
    updatedBy: null,
  }

  const normalizedBaseUrl = normalizeBaseUrl(
    parsed.data.providerId,
    parsed.data.baseUrl
  )

  const nextSettings = {
    chatProvider:
      section === "text"
        ? parsed.data.providerId
        : currentSettings.chatProvider,
    chatModelId:
      section === "text" ? parsed.data.modelId : currentSettings.chatModelId,
    chatApiKey:
      section === "text"
        ? parsed.data.apiKey || null
        : currentSettings.chatApiKey,
    chatBaseUrl:
      section === "text" ? normalizedBaseUrl : currentSettings.chatBaseUrl,
    chatTemperature: currentSettings.chatTemperature,
    chatMaxTokens: currentSettings.chatMaxTokens,
    embeddingProvider:
      section === "embedding"
        ? parsed.data.providerId
        : currentSettings.embeddingProvider,
    embeddingModelId:
      section === "embedding"
        ? parsed.data.modelId
        : currentSettings.embeddingModelId,
    embeddingApiKey:
      section === "embedding"
        ? parsed.data.apiKey || null
        : currentSettings.embeddingApiKey,
    embeddingBaseUrl:
      section === "embedding"
        ? normalizedBaseUrl
        : currentSettings.embeddingBaseUrl,
    embeddingDimensions: currentSettings.embeddingDimensions,
    isEnabled: currentSettings.isEnabled,
    allowFileUploads: currentSettings.allowFileUploads,
    updatedBy: session.user.id,
  }

  const saved = await updateAISettings(nextSettings)
  if (!saved) {
    return { success: false, message: "Failed to save AI settings." }
  }

  revalidatePath("/admin/settings")
  revalidatePath("/admin/settings/ai")

  return { success: true, message: "AI routing updated." }
}

export async function updateTextRoutingAction(
  values: AIConfigSectionValues
): Promise<AIAdminActionResult> {
  return updateSectionRouting("text", values)
}

export async function updateEmbeddingRoutingAction(
  values: AIConfigSectionValues
): Promise<AIAdminActionResult> {
  return updateSectionRouting("embedding", values)
}
