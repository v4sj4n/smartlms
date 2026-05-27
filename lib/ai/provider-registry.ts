export type AIModelType = "text" | "embedding"

export type ProviderDefaultModel = {
  modelName: string
  modelIdentifier: string
  modelType: AIModelType
}

export type ProviderRegistryEntry = {
  id: string
  name: string
  packageNames: readonly string[]
  local: boolean
  defaultBaseUrl: string
  supportedModelTypes: readonly AIModelType[]
  defaultModels: readonly ProviderDefaultModel[]
}

export const PROVIDER_REGISTRY = {
  openai: {
    id: "openai",
    name: "OpenAI",
    packageNames: ["openai", "@ai-sdk/openai", "@langchain/openai"],
    local: false,
    defaultBaseUrl: "https://api.openai.com/v1",
    supportedModelTypes: ["text", "embedding"],
    defaultModels: [
      {
        modelName: "GPT-4o",
        modelIdentifier: "gpt-4o",
        modelType: "text",
      },
      {
        modelName: "GPT-4o mini",
        modelIdentifier: "gpt-4o-mini",
        modelType: "text",
      },
      {
        modelName: "text-embedding-3-small",
        modelIdentifier: "text-embedding-3-small",
        modelType: "embedding",
      },
      {
        modelName: "text-embedding-3-large",
        modelIdentifier: "text-embedding-3-large",
        modelType: "embedding",
      },
    ],
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    packageNames: ["@anthropic-ai/sdk", "@ai-sdk/anthropic"],
    local: false,
    defaultBaseUrl: "https://api.anthropic.com",
    supportedModelTypes: ["text"],
    defaultModels: [
      {
        modelName: "Claude 3.5 Sonnet",
        modelIdentifier: "claude-3-5-sonnet-latest",
        modelType: "text",
      },
      {
        modelName: "Claude 3.5 Haiku",
        modelIdentifier: "claude-3-5-haiku-latest",
        modelType: "text",
      },
    ],
  },
  google: {
    id: "google",
    name: "Google Gemini",
    packageNames: ["@google/generative-ai", "@ai-sdk/google"],
    local: false,
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    supportedModelTypes: ["text", "embedding"],
    defaultModels: [
      {
        modelName: "Gemini 2.0 Flash",
        modelIdentifier: "gemini-2.0-flash-001",
        modelType: "text",
      },
      {
        modelName: "Gemini 2.0 Pro",
        modelIdentifier: "gemini-2.0-pro-exp-02-05",
        modelType: "text",
      },
      {
        modelName: "Gemini Embedding",
        modelIdentifier: "gemini-embedding-001",
        modelType: "embedding",
      },
    ],
  },
  mistral: {
    id: "mistral",
    name: "Mistral",
    packageNames: ["@mistralai/mistralai", "@ai-sdk/mistral"],
    local: false,
    defaultBaseUrl: "https://api.mistral.ai/v1",
    supportedModelTypes: ["text", "embedding"],
    defaultModels: [
      {
        modelName: "Mistral Large",
        modelIdentifier: "mistral-large-latest",
        modelType: "text",
      },
      {
        modelName: "Mistral Small",
        modelIdentifier: "mistral-small-latest",
        modelType: "text",
      },
      {
        modelName: "Mistral Embed",
        modelIdentifier: "mistral-embed",
        modelType: "embedding",
      },
    ],
  },
  groq: {
    id: "groq",
    name: "Groq",
    packageNames: ["groq-sdk", "@ai-sdk/groq"],
    local: false,
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    supportedModelTypes: ["text"],
    defaultModels: [
      {
        modelName: "Llama 3.3 70B Versatile",
        modelIdentifier: "llama-3.3-70b-versatile",
        modelType: "text",
      },
      {
        modelName: "Llama 3.1 8B Instant",
        modelIdentifier: "llama-3.1-8b-instant",
        modelType: "text",
      },
    ],
  },
  xai: {
    id: "xai",
    name: "xAI",
    packageNames: ["@ai-sdk/xai"],
    local: false,
    defaultBaseUrl: "https://api.x.ai/v1",
    supportedModelTypes: ["text"],
    defaultModels: [
      {
        modelName: "Grok 2",
        modelIdentifier: "grok-2",
        modelType: "text",
      },
      {
        modelName: "Grok Beta",
        modelIdentifier: "grok-beta",
        modelType: "text",
      },
    ],
  },
  cohere: {
    id: "cohere",
    name: "Cohere",
    packageNames: ["cohere-ai", "@ai-sdk/cohere"],
    local: false,
    defaultBaseUrl: "https://api.cohere.com/v1",
    supportedModelTypes: ["text", "embedding"],
    defaultModels: [
      {
        modelName: "Command R+",
        modelIdentifier: "command-r-plus",
        modelType: "text",
      },
      {
        modelName: "Command R",
        modelIdentifier: "command-r",
        modelType: "text",
      },
      {
        modelName: "Embed English v3",
        modelIdentifier: "embed-english-v3.0",
        modelType: "embedding",
      },
    ],
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    packageNames: ["deepseek", "@ai-sdk/deepseek"],
    local: false,
    defaultBaseUrl: "https://api.deepseek.com/v1",
    supportedModelTypes: ["text"],
    defaultModels: [
      {
        modelName: "DeepSeek Chat",
        modelIdentifier: "deepseek-chat",
        modelType: "text",
      },
      {
        modelName: "DeepSeek Reasoner",
        modelIdentifier: "deepseek-reasoner",
        modelType: "text",
      },
    ],
  },
  fireworks: {
    id: "fireworks",
    name: "Fireworks",
    packageNames: ["openai", "@ai-sdk/openai"],
    local: false,
    defaultBaseUrl: "https://api.fireworks.ai/inference/v1",
    supportedModelTypes: ["text", "embedding"],
    defaultModels: [],
  },
  togetherai: {
    id: "togetherai",
    name: "Together AI",
    packageNames: ["openai", "@ai-sdk/openai"],
    local: false,
    defaultBaseUrl: "https://api.together.xyz/v1",
    supportedModelTypes: ["text", "embedding"],
    defaultModels: [],
  },
  perplexity: {
    id: "perplexity",
    name: "Perplexity",
    packageNames: ["openai", "@ai-sdk/openai"],
    local: false,
    defaultBaseUrl: "https://api.perplexity.ai",
    supportedModelTypes: ["text"],
    defaultModels: [],
  },
  local: {
    id: "local",
    name: "Local OpenAI-compatible",
    packageNames: [],
    local: true,
    defaultBaseUrl: "http://localhost:11434",
    supportedModelTypes: ["text", "embedding"],
    defaultModels: [
      {
        modelName: "Local chat model",
        modelIdentifier: "local-chat",
        modelType: "text",
      },
      {
        modelName: "Local embedding model",
        modelIdentifier: "local-embed",
        modelType: "embedding",
      },
    ],
  },
  ollama: {
    id: "ollama",
    name: "Ollama",
    packageNames: ["ollama"],
    local: true,
    defaultBaseUrl: "http://localhost:11434",
    supportedModelTypes: ["text", "embedding"],
    defaultModels: [
      {
        modelName: "Llama 3.2",
        modelIdentifier: "llama3.2",
        modelType: "text",
      },
      {
        modelName: "nomic-embed-text",
        modelIdentifier: "nomic-embed-text",
        modelType: "embedding",
      },
    ],
  },
  "lm-studio": {
    id: "lm-studio",
    name: "LM Studio",
    packageNames: ["lmstudio-client", "@lmstudio/sdk", "lmstudio"],
    local: true,
    defaultBaseUrl: "http://localhost:1234",
    supportedModelTypes: ["text", "embedding"],
    defaultModels: [
      {
        modelName: "Local chat model",
        modelIdentifier: "local-chat",
        modelType: "text",
      },
      {
        modelName: "Local embedding model",
        modelIdentifier: "local-embed",
        modelType: "embedding",
      },
    ],
  },
} as const satisfies Record<string, ProviderRegistryEntry>

export const PROVIDER_ORDER = [
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
  "ollama",
  "lm-studio",
  "local",
] as const

export const MODEL_TYPES = ["text", "embedding"] as const

export type AIProviderId = (typeof PROVIDER_ORDER)[number]

export function getProviderRegistryEntries(): ProviderRegistryEntry[] {
  return PROVIDER_ORDER.map((providerId) => PROVIDER_REGISTRY[providerId])
}

export function getProviderRegistryEntry(
  providerId: string
): ProviderRegistryEntry | null {
  return PROVIDER_REGISTRY[providerId as AIProviderId] ?? null
}

export function getSupportedProvidersForModelType(modelType: AIModelType) {
  return getProviderRegistryEntries().filter((provider) =>
    provider.supportedModelTypes.includes(modelType)
  )
}

export function getDefaultModelsForProvider(providerId: string) {
  return getProviderRegistryEntry(providerId)?.defaultModels ?? []
}

export function detectInstalledPackages(
  packageNames: Record<string, unknown>
): Set<string> {
  return new Set(Object.keys(packageNames))
}

export function isProviderInstalled(
  providerId: string,
  installedPackages: Set<string>
): boolean {
  const provider = getProviderRegistryEntry(providerId)

  if (!provider) {
    return false
  }

  return provider.packageNames.some((packageName) =>
    installedPackages.has(packageName)
  )
}
