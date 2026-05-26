import { db, client } from "@/db"
import { aiSettings } from "@/db/schema"
import { eq } from "drizzle-orm"

export type AISettings = {
  id: string
  chatProvider: string
  chatModelId: string
  chatApiKey: string | null
  chatBaseUrl: string | null
  chatTemperature: string
  chatMaxTokens: number
  embeddingProvider: string
  embeddingModelId: string
  embeddingApiKey: string | null
  embeddingBaseUrl: string | null
  embeddingDimensions: number
  isEnabled: boolean
  allowFileUploads: boolean
  updatedAt: Date
  updatedBy: string | null
}

export async function getAISettings(): Promise<AISettings | null> {
  try {
    const rows = await client<AISettings[]>`
      SELECT 
        id,
        chat_provider as "chatProvider",
        chat_model_id as "chatModelId",
        chat_api_key as "chatApiKey",
        chat_base_url as "chatBaseUrl",
        chat_temperature as "chatTemperature",
        chat_max_tokens as "chatMaxTokens",
        embedding_provider as "embeddingProvider",
        embedding_model_id as "embeddingModelId",
        embedding_api_key as "embeddingApiKey",
        embedding_base_url as "embeddingBaseUrl",
        embedding_dimensions as "embeddingDimensions",
        is_enabled as "isEnabled",
        allow_file_uploads as "allowFileUploads",
        updated_at as "updatedAt",
        updated_by as "updatedBy"
      FROM ai_settings
      LIMIT 1
    `
    return rows[0] ?? null
  } catch (error) {
    console.error("Failed to fetch AI settings:", error)
    return null
  }
}

export async function updateAISettings(
  settings: Omit<AISettings, "id" | "updatedAt"> & { updatedBy: string }
): Promise<boolean> {
  try {
    const existing = await getAISettings()

    if (existing) {
      await db
        .update(aiSettings)
        .set({
          chatProvider: settings.chatProvider as typeof aiSettings.$inferInsert.chatProvider,
          chatModelId: settings.chatModelId,
          chatApiKey: settings.chatApiKey,
          chatBaseUrl: settings.chatBaseUrl,
          chatTemperature: settings.chatTemperature,
          chatMaxTokens: settings.chatMaxTokens,
          embeddingProvider: settings.embeddingProvider as typeof aiSettings.$inferInsert.embeddingProvider,
          embeddingModelId: settings.embeddingModelId,
          embeddingApiKey: settings.embeddingApiKey,
          embeddingBaseUrl: settings.embeddingBaseUrl,
          embeddingDimensions: settings.embeddingDimensions,
          isEnabled: settings.isEnabled,
          allowFileUploads: settings.allowFileUploads,
          updatedBy: settings.updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(aiSettings.id, existing.id))
    } else {
      await db.insert(aiSettings).values({
        chatProvider: settings.chatProvider as typeof aiSettings.$inferInsert.chatProvider,
        chatModelId: settings.chatModelId,
        chatApiKey: settings.chatApiKey,
        chatBaseUrl: settings.chatBaseUrl,
        chatTemperature: settings.chatTemperature,
        chatMaxTokens: settings.chatMaxTokens,
        embeddingProvider: settings.embeddingProvider as typeof aiSettings.$inferInsert.embeddingProvider,
        embeddingModelId: settings.embeddingModelId,
        embeddingApiKey: settings.embeddingApiKey,
        embeddingBaseUrl: settings.embeddingBaseUrl,
        embeddingDimensions: settings.embeddingDimensions,
        isEnabled: settings.isEnabled,
        allowFileUploads: settings.allowFileUploads,
        updatedBy: settings.updatedBy,
      })
    }

    return true
  } catch (error) {
    console.error("Failed to update AI settings:", error)
    return false
  }
}
