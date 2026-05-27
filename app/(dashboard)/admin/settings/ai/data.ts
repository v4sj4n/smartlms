import { client, db } from "@/db"
import { aiModels, aiProviders } from "@/db/schema"
import { getAISettings, type AISettings } from "@/lib/data/ai-settings"
import {
  getProviderRegistryEntries,
  type AIModelType,
  type ProviderDefaultModel,
} from "@/lib/ai/provider-registry"

export type AIAdminModelRow = typeof aiModels.$inferSelect
export type AIAdminProviderRow = typeof aiProviders.$inferSelect

export type AIProviderCatalogItem = AIAdminProviderRow

export type AIAdminPageData = {
  settings: AISettings | null
  providers: AIProviderCatalogItem[]
  models: AIAdminModelRow[]
}

export const DEFAULT_AI_SETTINGS: Omit<
  AISettings,
  "id" | "updatedAt" | "updatedBy"
> = {
  chatProvider: "google",
  chatModelId: "gemini-2.0-flash-001",
  chatApiKey: null,
  chatBaseUrl: null,
  chatTemperature: "0.7",
  chatMaxTokens: 4096,
  embeddingProvider: "google",
  embeddingModelId: "gemini-embedding-001",
  embeddingApiKey: null,
  embeddingBaseUrl: null,
  embeddingDimensions: 768,
  isEnabled: true,
  allowFileUploads: true,
}

async function hasTable(tableName: string): Promise<boolean> {
  const rows = await client<{ exists: boolean }[]>`
    select to_regclass(${"public." + tableName}) is not null as "exists"
  `

  return rows[0]?.exists ?? false
}

async function hasColumn(
  tableName: string,
  columnName: string
): Promise<boolean> {
  const rows = await client<{ exists: boolean }[]>`
    select exists(
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${tableName}
        and column_name = ${columnName}
    ) as "exists"
  `

  return rows[0]?.exists ?? false
}

async function ensureAIProvidersSchema(): Promise<void> {
  if (!(await hasTable("ai_providers"))) {
    return
  }

  await client`
    DO $$
    BEGIN
      CREATE TYPE "ai_provider_status" AS ENUM ('enabled', 'disabled');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `

  if (!(await hasColumn("ai_providers", "status"))) {
    await client`
      ALTER TABLE "ai_providers"
      ADD COLUMN "status" "ai_provider_status" NOT NULL DEFAULT 'enabled'
    `
  }

  if (!(await hasColumn("ai_providers", "local"))) {
    await client`
      ALTER TABLE "ai_providers"
      ADD COLUMN "local" boolean NOT NULL DEFAULT false
    `
  }

  await client`
    UPDATE "ai_providers"
    SET
      "status" = COALESCE("status", 'enabled'),
      "local" = COALESCE(
        "local",
        CASE WHEN "id" IN ('local', 'ollama', 'lm-studio') THEN true ELSE false END
      )
  `
}

export async function ensureAIProvidersSeeded(): Promise<void> {
  if (!(await hasTable("ai_providers"))) {
    return
  }

  await ensureAIProvidersSchema()

  const providerRows = getProviderRegistryEntries().map((provider) => ({
    id: provider.id,
    name: provider.name,
    status: "enabled" as const,
    local: provider.local,
  }))

  const existingProviders = await db
    .select({ id: aiProviders.id })
    .from(aiProviders)
  const existingIds = new Set(existingProviders.map((provider) => provider.id))
  const missingProviders = providerRows.filter(
    (provider) => !existingIds.has(provider.id)
  )

  if (missingProviders.length === 0) {
    return
  }

  await db.insert(aiProviders).values(missingProviders)
}

export function getModelOptionsForProvider(
  providerId: string,
  modelType: AIModelType,
  customModels: AIAdminModelRow[],
  includeDisabledCustomModels = false
): ProviderDefaultModel[] {
  const registryModels =
    getProviderRegistryEntries()
      .find((provider) => provider.id === providerId)
      ?.defaultModels.filter((model) => model.modelType === modelType) ?? []

  const databaseModels = customModels
    .filter((model) => model.providerId === providerId)
    .filter((model) => model.modelType === modelType)
    .filter((model) => includeDisabledCustomModels || model.enabled)
    .map((model) => ({
      modelName: model.modelName,
      modelIdentifier: model.modelIdentifier,
      modelType: model.modelType,
    }))

  const combined = [...registryModels, ...databaseModels]
  const seen = new Set<string>()

  return combined.filter((model) => {
    if (seen.has(model.modelIdentifier)) {
      return false
    }

    seen.add(model.modelIdentifier)
    return true
  })
}

export async function getAIAdminPageData(): Promise<AIAdminPageData> {
  const [providersTableExists, modelsTableExists] = await Promise.all([
    hasTable("ai_providers"),
    hasTable("ai_models"),
  ])

  if (providersTableExists) {
    await ensureAIProvidersSchema()
    await ensureAIProvidersSeeded()
  }

  const [settings, models, providers] = await Promise.all([
    getAISettings(),
    modelsTableExists ? db.select().from(aiModels) : Promise.resolve([]),
    providersTableExists ? db.select().from(aiProviders) : Promise.resolve([]),
  ])

  return {
    settings,
    providers,
    models,
  }
}
