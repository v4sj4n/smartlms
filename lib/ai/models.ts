import { createAnthropic } from "@ai-sdk/anthropic"
import { createCohere } from "@ai-sdk/cohere"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createGroq } from "@ai-sdk/groq"
import { createMistral } from "@ai-sdk/mistral"
import { createOpenAI } from "@ai-sdk/openai"
import { createXai } from "@ai-sdk/xai"
import type { EmbeddingModel, LanguageModel } from "ai"
import { getAISettings, type AISettings } from "@/lib/data/ai-settings"

type ChatProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "xai"
  | "cohere"
  | "deepseek"
  | "groq"
  | "fireworks"
  | "togetherai"
  | "perplexity"
  | "local"
  | "ollama"
  | "lm-studio"

type EmbeddingProvider =
  | "openai"
  | "google"
  | "mistral"
  | "cohere"
  | "local"
  | "ollama"
  | "lm-studio"

type ModelPreferences = {
  chatProvider: ChatProvider
  chatModelId: string
  chatApiKey: string | null
  chatBaseUrl: string | null
  chatTemperature: string
  chatMaxTokens: number
  embeddingProvider: EmbeddingProvider
  embeddingModelId: string
  embeddingApiKey: string | null
  embeddingBaseUrl: string | null
  embeddingDimensions: number
  isEnabled: boolean
  allowFileUploads: boolean
}

const DEFAULT_CHAT_PROVIDER: ChatProvider = "google"
const DEFAULT_CHAT_MODEL_ID = "gemini-2.0-flash-001"
const DEFAULT_EMBEDDING_PROVIDER: EmbeddingProvider = "google"
const DEFAULT_EMBEDDING_MODEL_ID = "gemini-embedding-001"
const DEFAULT_EMBEDDING_DIMENSIONS = 768
const CACHE_TTL_MS = 60 * 1000
const LOCAL_OPENAI_COMPATIBLE_BASE_URLS: Record<
  "local" | "ollama" | "lm-studio",
  string
> = {
  local: "http://localhost:11434",
  ollama: "http://localhost:11434",
  "lm-studio": "http://localhost:1234",
}

const DEFAULT_MODEL_PREFERENCES: ModelPreferences = {
  chatProvider: DEFAULT_CHAT_PROVIDER,
  chatModelId: DEFAULT_CHAT_MODEL_ID,
  chatApiKey: null,
  chatBaseUrl: null,
  chatTemperature: "0.7",
  chatMaxTokens: 4096,
  embeddingProvider: DEFAULT_EMBEDDING_PROVIDER,
  embeddingModelId: DEFAULT_EMBEDDING_MODEL_ID,
  embeddingApiKey: null,
  embeddingBaseUrl: null,
  embeddingDimensions: DEFAULT_EMBEDDING_DIMENSIONS,
  isEnabled: true,
  allowFileUploads: true,
}

let cachedSettings: AISettings | null = null
let cacheExpiry = 0

async function getCachedAISettings(): Promise<AISettings | null> {
  const now = Date.now()
  if (cachedSettings && cacheExpiry > now) {
    return cachedSettings
  }

  const settings = await getAISettings()
  if (settings) {
    cachedSettings = settings
    cacheExpiry = now + CACHE_TTL_MS
  }

  return settings
}

export function invalidateAISettingsCache(): void {
  cachedSettings = null
  cacheExpiry = 0
}

function resolveModelPreferences(
  settings: AISettings | null
): ModelPreferences {
  if (!settings || !settings.isEnabled) {
    return DEFAULT_MODEL_PREFERENCES
  }

  return {
    ...DEFAULT_MODEL_PREFERENCES,
    ...settings,
    chatProvider: settings.chatProvider as ChatProvider,
    embeddingProvider: settings.embeddingProvider as EmbeddingProvider,
  }
}

export async function getModelPreferences(): Promise<ModelPreferences> {
  const settings = await getCachedAISettings()
  return resolveModelPreferences(settings)
}

function createChatProvider(settings: ModelPreferences) {
  const apiKey = settings.chatApiKey ?? ""
  const baseURL =
    settings.chatBaseUrl ||
    (settings.chatProvider in LOCAL_OPENAI_COMPATIBLE_BASE_URLS
      ? LOCAL_OPENAI_COMPATIBLE_BASE_URLS[
          settings.chatProvider as keyof typeof LOCAL_OPENAI_COMPATIBLE_BASE_URLS
        ]
      : undefined)

  switch (settings.chatProvider) {
    case "openai":
      return createOpenAI({ apiKey, baseURL })
    case "anthropic":
      return createAnthropic({ apiKey, baseURL })
    case "google":
      return createGoogleGenerativeAI({ apiKey, baseURL })
    case "mistral":
      return createMistral({ apiKey, baseURL })
    case "xai":
      return createXai({ apiKey, baseURL })
    case "cohere":
      return createCohere({ apiKey, baseURL })
    case "deepseek":
      return createDeepSeek({ apiKey, baseURL })
    case "groq":
      return createGroq({ apiKey, baseURL })
    case "fireworks":
    case "togetherai":
    case "perplexity":
    case "local":
    case "ollama":
    case "lm-studio":
      return createOpenAI({ apiKey, baseURL })
    default:
      return createGoogleGenerativeAI({ apiKey, baseURL })
  }
}

function createEmbeddingProvider(settings: ModelPreferences) {
  const apiKey = settings.embeddingApiKey || settings.chatApiKey || ""
  const baseURL =
    settings.embeddingBaseUrl ||
    settings.chatBaseUrl ||
    (settings.embeddingProvider in LOCAL_OPENAI_COMPATIBLE_BASE_URLS
      ? LOCAL_OPENAI_COMPATIBLE_BASE_URLS[
          settings.embeddingProvider as keyof typeof LOCAL_OPENAI_COMPATIBLE_BASE_URLS
        ]
      : undefined)

  switch (settings.embeddingProvider) {
    case "openai":
      return createOpenAI({ apiKey: apiKey ?? "", baseURL })
    case "google":
      return createGoogleGenerativeAI({ apiKey: apiKey ?? "", baseURL })
    case "mistral":
      return createMistral({ apiKey: apiKey ?? "", baseURL })
    case "cohere":
      return createCohere({ apiKey: apiKey ?? "", baseURL })
    case "local":
    case "ollama":
    case "lm-studio":
      return createOpenAI({ apiKey, baseURL })
    default:
      return createGoogleGenerativeAI({ apiKey, baseURL })
  }
}

function resolveChatModel(
  settings: ModelPreferences,
  modelId: string = settings.chatModelId
): LanguageModel {
  const provider = createChatProvider(settings)

  switch (settings.chatProvider) {
    case "openai":
    case "fireworks":
    case "togetherai":
    case "perplexity":
    case "local":
    case "ollama":
    case "lm-studio":
      return (provider as ReturnType<typeof createOpenAI>)(modelId)
    case "anthropic":
      return (provider as ReturnType<typeof createAnthropic>)(modelId)
    case "google":
      return (provider as ReturnType<typeof createGoogleGenerativeAI>)(modelId)
    case "mistral":
      return (provider as ReturnType<typeof createMistral>)(modelId)
    case "xai":
      return (provider as ReturnType<typeof createXai>)(modelId)
    case "cohere":
      return (provider as ReturnType<typeof createCohere>)(modelId)
    case "deepseek":
      return (provider as ReturnType<typeof createDeepSeek>)(modelId)
    case "groq":
      return (provider as ReturnType<typeof createGroq>)(modelId)
    default:
      return (provider as ReturnType<typeof createGoogleGenerativeAI>)(
        modelId || DEFAULT_CHAT_MODEL_ID
      )
  }
}

function resolveEmbeddingModel(
  settings: ModelPreferences,
  modelId: string = settings.embeddingModelId
): EmbeddingModel {
  const provider = createEmbeddingProvider(settings)

  switch (settings.embeddingProvider) {
    case "openai":
      return (provider as ReturnType<typeof createOpenAI>).textEmbeddingModel(
        modelId
      )
    case "google":
      return (
        provider as ReturnType<typeof createGoogleGenerativeAI>
      ).textEmbeddingModel(modelId)
    case "mistral":
      return (provider as ReturnType<typeof createMistral>).textEmbeddingModel(
        modelId
      )
    case "cohere":
      return (provider as ReturnType<typeof createCohere>).textEmbeddingModel(
        modelId
      )
    case "local":
    case "ollama":
    case "lm-studio":
      return (provider as ReturnType<typeof createOpenAI>).textEmbeddingModel(
        modelId
      )
    default:
      return (
        provider as ReturnType<typeof createGoogleGenerativeAI>
      ).textEmbeddingModel(DEFAULT_EMBEDDING_MODEL_ID)
  }
}

export async function getChatModel(): Promise<LanguageModel> {
  const preferences = await getModelPreferences()
  return resolveChatModel(preferences)
}

export async function getEmbeddingModel(): Promise<EmbeddingModel> {
  const preferences = await getModelPreferences()
  return resolveEmbeddingModel(preferences)
}

export async function chatModel(modelId?: string): Promise<LanguageModel> {
  const preferences = await getModelPreferences()
  return resolveChatModel(preferences, modelId ?? preferences.chatModelId)
}

export async function embeddingModel(): Promise<EmbeddingModel> {
  return getEmbeddingModel()
}

export async function getEmbeddingConfig(): Promise<{
  model: EmbeddingModel
  provider: string
  dimensions: number
}> {
  const preferences = await getModelPreferences()

  return {
    model: resolveEmbeddingModel(preferences),
    provider: preferences.embeddingProvider,
    dimensions: preferences.embeddingDimensions,
  }
}

export const EMBEDDING_MODEL = DEFAULT_EMBEDDING_MODEL_ID
export type { AISettings } from "@/lib/data/ai-settings"
