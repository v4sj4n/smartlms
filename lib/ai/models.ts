import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createMistral } from "@ai-sdk/mistral"
import { createXai } from "@ai-sdk/xai"
import { createCohere } from "@ai-sdk/cohere"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { createGroq } from "@ai-sdk/groq"
import type { LanguageModel, EmbeddingModel } from "ai"
import { getAISettings, type AISettings } from "@/lib/data/ai-settings"

// Cache for AI settings to avoid repeated DB calls
let cachedSettings: AISettings | null = null
let cacheExpiry: number = 0
const CACHE_TTL_MS = 60 * 1000 // 1 minute cache

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

// Provider factory functions
function createChatProvider(settings: AISettings) {
  const apiKey = settings.chatApiKey || getEnvKeyForProvider(settings.chatProvider)
  const baseURL = settings.chatBaseUrl || undefined

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
    // These use OpenAI-compatible API
    case "fireworks":
    case "togetherai":
    case "perplexity":
    case "local":
      return createOpenAI({ apiKey, baseURL })
    default:
      // Fallback to Google
      return createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
  }
}

function createEmbeddingProvider(settings: AISettings) {
  const apiKey = settings.embeddingApiKey || settings.chatApiKey || getEnvKeyForProvider(settings.embeddingProvider)
  const baseURL = settings.embeddingBaseUrl || settings.chatBaseUrl || undefined

  switch (settings.embeddingProvider) {
    case "openai":
      return createOpenAI({ apiKey, baseURL })
    case "google":
      return createGoogleGenerativeAI({ apiKey, baseURL })
    case "mistral":
      return createMistral({ apiKey, baseURL })
    case "cohere":
      return createCohere({ apiKey, baseURL })
    // Local/self-hosted embeddings use OpenAI-compatible API (Ollama, etc)
    case "local":
      return createOpenAI({ apiKey: apiKey || "ollama", baseURL })
    default:
      // Fallback to Google
      return createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
  }
}

function getEnvKeyForProvider(provider: string): string | undefined {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY
    case "google":
      return process.env.GEMINI_API_KEY
    case "mistral":
      return process.env.MISTRAL_API_KEY
    case "xai":
      return process.env.XAI_API_KEY
    case "groq":
      return process.env.GROQ_API_KEY
    case "cohere":
      return process.env.COHERE_API_KEY
    case "deepseek":
      return process.env.DEEPSEEK_API_KEY
    case "fireworks":
      return process.env.FIREWORKS_API_KEY
    case "togetherai":
      return process.env.TOGETHER_API_KEY
    case "perplexity":
      return process.env.PERPLEXITY_API_KEY
    default:
      return undefined
  }
}

// Default embedding model (fallback)
export const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001"

/**
 * Get the configured chat model
 * Falls back to Google Gemini if settings unavailable
 */
export async function getChatModel(): Promise<LanguageModel> {
  const settings = await getCachedAISettings()
  
  if (!settings || !settings.isEnabled) {
    // Fallback to Google
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    })
    return google("gemini-2.0-flash-001")
  }

  const provider = createChatProvider(settings)
  
  // Handle provider-specific model creation
  switch (settings.chatProvider) {
    case "openai":
    case "fireworks":
    case "togetherai":
    case "perplexity":
    case "local":
      return (provider as ReturnType<typeof createOpenAI>)(settings.chatModelId)
    case "anthropic":
      return (provider as ReturnType<typeof createAnthropic>)(settings.chatModelId)
    case "google":
      return (provider as ReturnType<typeof createGoogleGenerativeAI>)(settings.chatModelId)
    case "mistral":
      return (provider as ReturnType<typeof createMistral>)(settings.chatModelId)
    case "xai":
      return (provider as ReturnType<typeof createXai>)(settings.chatModelId)
    case "cohere":
      return (provider as ReturnType<typeof createCohere>)(settings.chatModelId)
    case "deepseek":
      return (provider as ReturnType<typeof createDeepSeek>)(settings.chatModelId)
    case "groq":
      return (provider as ReturnType<typeof createGroq>)(settings.chatModelId)
    default:
      return (provider as ReturnType<typeof createGoogleGenerativeAI>)(settings.chatModelId)
  }
}

/**
 * Get the configured embedding model
 * Falls back to Google if settings unavailable
 */
export async function getEmbeddingModel(): Promise<EmbeddingModel> {
  const settings = await getCachedAISettings()
  
  if (!settings) {
    // Fallback to Google
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    })
    return google.textEmbeddingModel(DEFAULT_EMBEDDING_MODEL)
  }

  const provider = createEmbeddingProvider(settings)
  
  switch (settings.embeddingProvider) {
    case "openai":
      return (provider as ReturnType<typeof createOpenAI>).textEmbeddingModel(settings.embeddingModelId)
    case "google":
      return (provider as ReturnType<typeof createGoogleGenerativeAI>).textEmbeddingModel(settings.embeddingModelId)
    case "mistral":
      return (provider as ReturnType<typeof createMistral>).textEmbeddingModel(settings.embeddingModelId)
    case "cohere":
      return (provider as ReturnType<typeof createCohere>).textEmbeddingModel(settings.embeddingModelId)
    case "local":
      return (provider as ReturnType<typeof createOpenAI>).textEmbeddingModel(settings.embeddingModelId)
    default:
      return (provider as ReturnType<typeof createGoogleGenerativeAI>).textEmbeddingModel(DEFAULT_EMBEDDING_MODEL)
  }
}

/**
 * Legacy exports for backward compatibility
 * These use the configured settings automatically
 */
export async function chatModel(modelId?: string): Promise<LanguageModel> {
  const settings = await getCachedAISettings()
  const overrideSettings = modelId && settings ? { ...settings, chatModelId: modelId } : settings
  if (!overrideSettings) {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
    return google(modelId ?? "gemini-2.0-flash-001")
  }
  const provider = createChatProvider(overrideSettings)
  switch (overrideSettings.chatProvider) {
    case "openai":
    case "fireworks":
    case "togetherai":
    case "perplexity":
    case "local":
      return (provider as ReturnType<typeof createOpenAI>)(overrideSettings.chatModelId)
    case "anthropic":
      return (provider as ReturnType<typeof createAnthropic>)(overrideSettings.chatModelId)
    case "google":
      return (provider as ReturnType<typeof createGoogleGenerativeAI>)(overrideSettings.chatModelId)
    case "mistral":
      return (provider as ReturnType<typeof createMistral>)(overrideSettings.chatModelId)
    case "xai":
      return (provider as ReturnType<typeof createXai>)(overrideSettings.chatModelId)
    case "cohere":
      return (provider as ReturnType<typeof createCohere>)(overrideSettings.chatModelId)
    case "deepseek":
      return (provider as ReturnType<typeof createDeepSeek>)(overrideSettings.chatModelId)
    case "groq":
      return (provider as ReturnType<typeof createGroq>)(overrideSettings.chatModelId)
    default:
      return (provider as ReturnType<typeof createGoogleGenerativeAI>)(overrideSettings.chatModelId)
  }
}

export async function embeddingModel(): Promise<EmbeddingModel> {
  return getEmbeddingModel()
}

export const EMBEDDING_MODEL = DEFAULT_EMBEDDING_MODEL

/**
 * Returns the resolved embedding model, provider name, and dimensions from DB settings.
 */
export async function getEmbeddingConfig(): Promise<{
  model: EmbeddingModel
  provider: string
  dimensions: number
}> {
  const settings = await getCachedAISettings()

  const provider = settings?.embeddingProvider ?? "google"
  const dimensions = settings?.embeddingDimensions ?? 1536

  const model = await getEmbeddingModel()

  return { model, provider, dimensions }
}

// Re-export types
export type { AISettings } from "@/lib/data/ai-settings"
