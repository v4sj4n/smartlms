"use client"

import { useActionState, useEffect, useState } from "react"
import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Bot,
  Brain,
  Check,
  Eye,
  EyeOff,
  Key,
  Link,
  Loader2,
  RefreshCw,
  Settings,
  Sparkles,
  Thermometer,
  Type,
  Info,
} from "lucide-react"

import { updateAIConfiguration, type UpdateAISettingsState } from "@/lib/actions/ai-settings"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"

// AI Provider definitions with their available models
const AI_PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4, GPT-3.5, and embedding models",
    requiresApiKey: true,
    models: {
      chat: [
        { id: "gpt-4o", name: "GPT-4o", description: "Latest multimodal model" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Fast and affordable" },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "High quality" },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "Cost effective" },
        { id: "o3-mini", name: "o3-mini", description: "Reasoning model" },
        { id: "o1", name: "o1", description: "Advanced reasoning" },
      ],
      embedding: [
        { id: "text-embedding-3-small", name: "text-embedding-3-small", description: "1536 dims" },
        { id: "text-embedding-3-large", name: "text-embedding-3-large", description: "3072 dims" },
        { id: "text-embedding-ada-002", name: "text-embedding-ada-002", description: "Legacy" },
      ],
    },
    defaultBaseUrl: "https://api.openai.com/v1",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models",
    requiresApiKey: true,
    models: {
      chat: [
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Best balance" },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", description: "Fast" },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus", description: "Most capable" },
        { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet", description: "Reliable" },
        { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", description: "Quick responses" },
      ],
      embedding: [], // Anthropic doesn't provide embeddings
    },
    defaultBaseUrl: "https://api.anthropic.com",
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    description: "Grok models",
    requiresApiKey: true,
    models: {
      chat: [
        { id: "grok-2", name: "Grok 2", description: "Latest" },
        { id: "grok-2-vision", name: "Grok 2 Vision", description: "Vision capable" },
        { id: "grok-beta", name: "Grok Beta", description: "Beta version" },
      ],
      embedding: [],
    },
    defaultBaseUrl: "https://api.x.ai",
  },
  {
    id: "google",
    name: "Google Gemini",
    description: "Gemini models",
    requiresApiKey: true,
    models: {
      chat: [
        { id: "gemini-2.0-flash-001", name: "Gemini 2.0 Flash", description: "Fast and efficient" },
        { id: "gemini-2.0-pro-exp-02-05", name: "Gemini 2.0 Pro", description: "Advanced reasoning" },
        { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", description: "Fast responses" },
        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Complex tasks" },
        { id: "gemini-1.0-pro", name: "Gemini 1.0 Pro", description: "Reliable" },
      ],
      embedding: [
        { id: "gemini-embedding-exp-03-07", name: "gemini-embedding-exp", description: "768 dims" },
        { id: "gemini-embedding-001", name: "gemini-embedding-001", description: "768 dims" },
      ],
    },
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
  },
  {
    id: "mistral",
    name: "Mistral",
    description: "Mistral AI models",
    requiresApiKey: true,
    models: {
      chat: [
        { id: "mistral-large-latest", name: "Mistral Large", description: "Most capable" },
        { id: "mistral-medium-latest", name: "Mistral Medium", description: "Balanced" },
        { id: "mistral-small-latest", name: "Mistral Small", description: "Fast" },
        { id: "codestral-latest", name: "Codestral", description: "Code generation" },
        { id: "pixtral-large-latest", name: "Pixtral Large", description: "Vision" },
      ],
      embedding: [
        { id: "mistral-embed", name: "mistral-embed", description: "1024 dims" },
      ],
    },
    defaultBaseUrl: "https://api.mistral.ai",
  },
  {
    id: "groq",
    name: "Groq",
    description: "Ultra-fast inference",
    requiresApiKey: true,
    models: {
      chat: [
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", description: "Most capable" },
        { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", description: "Fast" },
        { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", description: "Balanced" },
        { id: "gemma2-9b-it", name: "Gemma 2 9B", description: "Efficient" },
        { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 (distilled)", description: "Reasoning" },
      ],
      embedding: [],
    },
    defaultBaseUrl: "https://api.groq.com/openai/v1",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "Open source models",
    requiresApiKey: true,
    models: {
      chat: [
        { id: "deepseek-chat", name: "DeepSeek Chat", description: "General purpose" },
        { id: "deepseek-reasoner", name: "DeepSeek Reasoner", description: "Chain of thought" },
        { id: "deepseek-coder", name: "DeepSeek Coder", description: "Code generation" },
      ],
      embedding: [],
    },
    defaultBaseUrl: "https://api.deepseek.com",
  },
  {
    id: "cohere",
    name: "Cohere",
    description: "Command and embed models",
    requiresApiKey: true,
    models: {
      chat: [
        { id: "command-r-plus", name: "Command R+", description: "Advanced" },
        { id: "command-r", name: "Command R", description: "Balanced" },
        { id: "command", name: "Command", description: "General purpose" },
        { id: "command-light", name: "Command Light", description: "Fast" },
      ],
      embedding: [
        { id: "embed-english-v3", name: "embed-english-v3", description: "1024 dims" },
        { id: "embed-english-light-v3", name: "embed-english-light-v3", description: "384 dims" },
        { id: "embed-multilingual-v3", name: "embed-multilingual-v3", description: "1024 dims" },
      ],
    },
    defaultBaseUrl: "https://api.cohere.com",
  },
  {
    id: "togetherai",
    name: "Together.ai",
    description: "Open source model hosting",
    requiresApiKey: true,
    models: {
      chat: [
        { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", name: "Llama 3.3 70B", description: "Meta" },
        { id: "meta-llama/Llama-3.2-3B-Instruct-Turbo", name: "Llama 3.2 3B", description: "Fast" },
        { id: "mistralai/Mixtral-8x22B-Instruct-v0.1", name: "Mixtral 8x22B", description: "Mistral" },
        { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", name: "Qwen 2.5 72B", description: "Alibaba" },
        { id: "databricks/dbrx-instruct", name: "DBRX", description: "Databricks" },
      ],
      embedding: [
        { id: "togethercomputer/m2-bert-80M-8k-retrieval", name: "M2-BERT 80M", description: "768 dims" },
        { id: "togethercomputer/m2-bert-80M-32k-retrieval", name: "M2-BERT 80M 32K", description: "768 dims" },
      ],
    },
    defaultBaseUrl: "https://api.together.xyz/v1",
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    description: "Fast inference for open models",
    requiresApiKey: true,
    models: {
      chat: [
        { id: "accounts/fireworks/models/llama-v3p3-70b-instruct", name: "Llama 3.3 70B", description: "Meta" },
        { id: "accounts/fireworks/models/llama-v3p1-8b-instruct", name: "Llama 3.1 8B", description: "Fast" },
        { id: "accounts/fireworks/models/mixtral-8x22b-instruct", name: "Mixtral 8x22B", description: "Mistral" },
        { id: "accounts/fireworks/models/qwen2p5-72b-instruct", name: "Qwen 2.5 72B", description: "Alibaba" },
      ],
      embedding: [
        { id: "nomic-ai/nomic-embed-text-v1.5", name: "Nomic Embed v1.5", description: "768 dims" },
      ],
    },
    defaultBaseUrl: "https://api.fireworks.ai/inference/v1",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    description: "Online LLMs with search",
    requiresApiKey: true,
    models: {
      chat: [
        { id: "sonar-pro", name: "Sonar Pro", description: "Advanced search" },
        { id: "sonar", name: "Sonar", description: "Balanced" },
        { id: "sonar-reasoning-pro", name: "Sonar Reasoning Pro", description: "Chain of thought" },
        { id: "sonar-reasoning", name: "Sonar Reasoning", description: "Reasoning" },
      ],
      embedding: [],
    },
    defaultBaseUrl: "https://api.perplexity.ai",
  },
  {
    id: "local",
    name: "Local / Custom",
    description: "Ollama, LM Studio, or custom endpoints",
    requiresApiKey: false,
    models: {
      chat: [
        { id: "llama3.3", name: "Llama 3.3", description: "Meta" },
        { id: "llama3.2", name: "Llama 3.2", description: "Meta" },
        { id: "llama3.1", name: "Llama 3.1", description: "Meta" },
        { id: "mistral", name: "Mistral", description: "Mistral AI" },
        { id: "mixtral", name: "Mixtral", description: "Mistral AI" },
        { id: "qwen2.5", name: "Qwen 2.5", description: "Alibaba" },
        { id: "phi4", name: "Phi-4", description: "Microsoft" },
        { id: "gemma2", name: "Gemma 2", description: "Google" },
        { id: "custom", name: "Custom Model", description: "Enter model name" },
      ],
      embedding: [
        { id: "nomic-embed-text", name: "Nomic Embed", description: "768 dims" },
        { id: "mxbai-embed-large", name: "MXBAI Embed Large", description: "1024 dims" },
        { id: "snowflake-arctic-embed", name: "Snowflake Arctic", description: "Various dims" },
        { id: "custom", name: "Custom Model", description: "Enter model name" },
      ],
    },
    defaultBaseUrl: "http://localhost:11434/v1", // Ollama default
  },
] as const

type AISettingsFormProps = {
  settings: {
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
  }
}

const initialState: UpdateAISettingsState = {
  success: false,
  message: "",
}

function maskApiKey(key: string | null): string {
  if (!key) return ""
  if (key.length <= 8) return "••••••••"
  return key.slice(0, 4) + "•••••••••••••••••••••••••••••••••" + key.slice(-4)
}

export function AISettingsForm({ settings }: AISettingsFormProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(
    updateAIConfiguration,
    initialState
  )

  // Local state for form fields
  const [chatProvider, setChatProvider] = useState(settings.chatProvider)
  const [chatModelId, setChatModelId] = useState(settings.chatModelId)
  const [chatApiKey, setChatApiKey] = useState(settings.chatApiKey || "")
  const [chatBaseUrl, setChatBaseUrl] = useState(settings.chatBaseUrl || "")
  const [chatTemperature, setChatTemperature] = useState(parseFloat(settings.chatTemperature))
  const [chatMaxTokens, setChatMaxTokens] = useState(settings.chatMaxTokens)
  const [showChatApiKey, setShowChatApiKey] = useState(false)
  const [chatApiKeyModified, setChatApiKeyModified] = useState(false)

  const [embeddingProvider, setEmbeddingProvider] = useState(settings.embeddingProvider)
  const [embeddingModelId, setEmbeddingModelId] = useState(settings.embeddingModelId)
  const [embeddingApiKey, setEmbeddingApiKey] = useState(settings.embeddingApiKey || "")
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState(settings.embeddingBaseUrl || "")
  const [embeddingDimensions, setEmbeddingDimensions] = useState(settings.embeddingDimensions)
  const [showEmbeddingApiKey, setShowEmbeddingApiKey] = useState(false)
  const [embeddingApiKeyModified, setEmbeddingApiKeyModified] = useState(false)

  const [isEnabled, setIsEnabled] = useState(settings.isEnabled)
  const [allowFileUploads, setAllowFileUploads] = useState(settings.allowFileUploads)

  // Get provider details
  const chatProviderInfo = AI_PROVIDERS.find((p) => p.id === chatProvider)
  const embeddingProviderInfo = AI_PROVIDERS.find((p) => p.id === embeddingProvider)

  // Get available models for current providers
  const chatModels = chatProviderInfo?.models.chat || []
  const embeddingModels = embeddingProviderInfo?.models.embedding || []

  // Sync custom model inputs when provider changes
  const handleChatProviderChange = (providerId: string) => {
    setChatProvider(providerId)
    const provider = AI_PROVIDERS.find((p) => p.id === providerId)
    if (provider && provider.models.chat.length > 0) {
      setChatModelId(provider.models.chat[0].id)
    }
    if (provider?.defaultBaseUrl) {
      setChatBaseUrl(provider.defaultBaseUrl)
    }
  }

  const handleEmbeddingProviderChange = (providerId: string) => {
    setEmbeddingProvider(providerId)
    const provider = AI_PROVIDERS.find((p) => p.id === providerId)
    if (provider && provider.models.embedding.length > 0) {
      setEmbeddingModelId(provider.models.embedding[0]?.id ?? "")
    }
    if (provider?.defaultBaseUrl) {
      setEmbeddingBaseUrl(provider.defaultBaseUrl)
    }
  }

  // Handle success state - use a ref to track if we've handled this success
  const handledSuccessRef = React.useRef<string | null>(null)
  useEffect(() => {
    if (state.success && state.message !== handledSuccessRef.current) {
      handledSuccessRef.current = state.message
      router.refresh()
      // Reset key modified flags in a microtask to avoid cascading renders
      queueMicrotask(() => {
        setChatApiKeyModified(false)
        setEmbeddingApiKeyModified(false)
      })
    }
  }, [state.success, state.message, router])

  return (
    <form action={formAction} className="space-y-8">
      {/* Hidden inputs for state values */}
      <input type="hidden" name="chatProvider" value={chatProvider} />
      <input type="hidden" name="chatModelId" value={chatModelId} />
      <input type="hidden" name="embeddingProvider" value={embeddingProvider} />
      <input type="hidden" name="embeddingModelId" value={embeddingModelId} />
      <input type="hidden" name="chatTemperature" value={chatTemperature.toString()} />
      <input type="hidden" name="chatMaxTokens" value={chatMaxTokens.toString()} />
      <input type="hidden" name="embeddingDimensions" value={embeddingDimensions.toString()} />

      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          AI Configuration
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure AI providers, models, and feature settings for your workspace.
        </p>
      </div>

      {/* Status Alert */}
      {state.message && (
        <Alert 
          variant={state.success ? "default" : "destructive"}
          className="rounded-xl border-0 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_2px_-1px_rgba(0,0,0,0.06),0px_2px_4px_0px_rgba(0,0,0,0.04)]"
        >
          <AlertDescription className="flex items-center gap-2 text-sm">
            {state.success && <Check className="h-4 w-4" />}
            {state.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Feature Settings Card */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <Settings className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Feature Settings
          </h2>
        </div>

        <Card className="overflow-hidden rounded-xl border border-border/40 bg-card/50 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_2px_-1px_rgba(0,0,0,0.06),0px_2px_4px_0px_rgba(0,0,0,0.04)] transition-shadow duration-200 hover:shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08),0px_1px_2px_-1px_rgba(0,0,0,0.08),0px_2px_4px_0px_rgba(0,0,0,0.06)]">
          <CardContent className="divide-y divide-border/40 p-0">
            {/* AI Features Toggle */}
            <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="isEnabled" className="text-sm font-medium">
                    Enable AI Features
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Turn off to disable all AI-powered features across the platform
                  </p>
                </div>
              </div>
              <Switch
                id="isEnabled"
                name="isEnabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
                className="data-[state=checked]:bg-primary"
              />
            </div>

            {/* File Uploads Toggle */}
            <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Sparkles className="h-4 w-4 text-secondary-foreground" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="allowFileUploads" className="text-sm font-medium">
                    Allow File Uploads
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Let users upload files for AI processing and chat
                  </p>
                </div>
              </div>
              <Switch
                id="allowFileUploads"
                name="allowFileUploads"
                checked={allowFileUploads}
                onCheckedChange={setAllowFileUploads}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Chat Model Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Chat Model
          </h2>
        </div>

        <Card className="overflow-hidden rounded-xl border border-border/40 bg-card/50 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_2px_-1px_rgba(0,0,0,0.06),0px_2px_4px_0px_rgba(0,0,0,0.04)]">
          <CardContent className="space-y-6 p-5">
            {/* Provider & Model - 1:2 Ratio */}
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Provider Selection - 1 column */}
              <div className="space-y-2.5">
                <Label htmlFor="chatProviderSelect" className="text-sm font-medium">
                  Provider
                </Label>
                <Select value={chatProvider} onValueChange={handleChatProviderChange}>
                  <SelectTrigger 
                    id="chatProviderSelect" 
                    className="w-full rounded-lg border-border/40 bg-background/50"
                    style={{ height: "2.5rem" }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-80 rounded-lg">
                    {AI_PROVIDERS.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <div className="flex flex-col items-start py-1">
                          <span className="font-medium">{provider.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {provider.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model Selection - 2 columns */}
              <div className="space-y-2.5 sm:col-span-2">
                <Label htmlFor="chatModelSelect" className="text-sm font-medium">
                  Model
                </Label>
                <Select value={chatModelId} onValueChange={setChatModelId}>
                  <SelectTrigger 
                    id="chatModelSelect" 
                    className="w-full rounded-lg border-border/40 bg-background/50"
                    style={{ height: "2.5rem" }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-80 rounded-lg">
                    {chatModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center gap-2 py-1">
                          <span className="font-medium">{model.name}</span>
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {model.description}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                    {chatModels.length === 0 && (
                      <SelectItem value="custom">Custom model (enter manually)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {chatModels.length === 0 || chatModelId === "custom" ? (
                  <Input
                    placeholder="Enter model ID (e.g., my-custom-model)"
                    value={chatModelId === "custom" ? "" : chatModelId}
                    onChange={(e) => setChatModelId(e.target.value)}
                    className="h-12 w-full rounded-lg border-border/40 bg-background/50"
                  />
                ) : null}
              </div>
            </div>

            {/* API Key */}
            {chatProviderInfo?.requiresApiKey && (
              <div className="space-y-2.5">
                <Label htmlFor="chatApiKey" className="flex items-center gap-2 text-sm font-medium">
                  <Key className="h-3.5 w-3.5 text-muted-foreground" />
                  API Key
                </Label>
                <div className="relative">
                  <Input
                    id="chatApiKey"
                    name="chatApiKey"
                    type={showChatApiKey ? "text" : "password"}
                    placeholder={settings.chatApiKey ? maskApiKey(settings.chatApiKey) : "Enter API key"}
                    value={chatApiKeyModified ? chatApiKey : ""}
                    onChange={(e) => {
                      setChatApiKey(e.target.value)
                      setChatApiKeyModified(true)
                    }}
                    className="rounded-lg border-border/40 bg-background/50 pr-10 font-mono text-sm"
                    style={{ height: "2.5rem" }}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowChatApiKey(!showChatApiKey)}
                  >
                    {showChatApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {!chatApiKeyModified && settings.chatApiKey && (
                  <p className="text-xs text-muted-foreground">
                    Key is saved (hidden). Enter a new key to replace it.
                  </p>
                )}
              </div>
            )}

            {/* Base URL (for local/custom) */}
            {chatProvider === "local" && (
              <div className="space-y-2.5">
                <Label htmlFor="chatBaseUrl" className="flex items-center gap-2 text-sm font-medium">
                  <Link className="h-3.5 w-3.5 text-muted-foreground" />
                  Base URL
                </Label>
                <Input
                  id="chatBaseUrl"
                  name="chatBaseUrl"
                  placeholder="http://localhost:11434/v1"
                  value={chatBaseUrl}
                  onChange={(e) => setChatBaseUrl(e.target.value)}
                  className="rounded-lg border-border/40 bg-background/50 font-mono text-sm"
                  style={{ height: "2.5rem" }}
                />
                <p className="text-xs text-muted-foreground">
                  Endpoint URL for Ollama, LM Studio, or other local providers
                </p>
              </div>
            )}

            <Separator className="bg-border/40" />

            {/* Temperature */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="chatTemperature" className="flex items-center gap-2 text-sm font-medium">
                  <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
                  Temperature
                </Label>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums">
                  {chatTemperature.toFixed(1)}
                </span>
              </div>
              <Slider
                id="chatTemperature"
                min={0}
                max={2}
                step={0.1}
                value={[chatTemperature]}
                onValueChange={([value]) => setChatTemperature(value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Deterministic</span>
                <span>Creative</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div className="space-y-2.5">
              <Label htmlFor="chatMaxTokens" className="flex items-center gap-2 text-sm font-medium">
                <Type className="h-3.5 w-3.5 text-muted-foreground" />
                Max Tokens
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="chatMaxTokens"
                  type="number"
                  min={256}
                  max={8192}
                  step={256}
                  value={chatMaxTokens}
                  onChange={(e) => setChatMaxTokens(parseInt(e.target.value) || 4096)}
                  className="w-32 rounded-lg border-border/40 bg-background/50 text-sm tabular-nums"
                  style={{ height: "2.5rem" }}
                />
                <span className="text-xs text-muted-foreground">
                  Maximum tokens per response
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Embedding Model Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <Brain className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Embedding Model
          </h2>
        </div>

        <Card className="overflow-hidden rounded-xl border border-border/40 bg-card/50 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_2px_-1px_rgba(0,0,0,0.06),0px_2px_4px_0px_rgba(0,0,0,0.04)]">
          <CardContent className="space-y-6 p-5">
            {/* Info Banner */}
            <div className="flex items-start gap-3 rounded-lg bg-secondary/40 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">About Embeddings</p>
                <p className="text-xs text-muted-foreground">
                  Embedding models convert text to vectors for RAG and semantic search. 
                  Changing this requires re-indexing all documents.
                </p>
              </div>
            </div>

            {/* Provider & Model - 1:2 Ratio */}
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Provider Selection - 1 column */}
              <div className="space-y-2.5">
                <Label htmlFor="embeddingProviderSelect" className="text-sm font-medium">
                  Provider
                </Label>
                <Select
                  value={embeddingProvider}
                  onValueChange={handleEmbeddingProviderChange}
                >
                  <SelectTrigger 
                    id="embeddingProviderSelect" 
                    className="w-full rounded-lg border-border/40 bg-background/50"
                    style={{ height: "2.5rem" }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-80 rounded-lg">
                    {AI_PROVIDERS.filter((p) => p.models.embedding.length > 0 || p.id === "local").map(
                      (provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          <div className="flex flex-col items-start py-1">
                            <span className="font-medium">{provider.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {provider.description}
                            </span>
                          </div>
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Model Selection - 2 columns */}
              <div className="space-y-2.5 sm:col-span-2">
                <Label htmlFor="embeddingModelSelect" className="text-sm font-medium">
                  Model
                </Label>
                <Select value={embeddingModelId} onValueChange={setEmbeddingModelId}>
                  <SelectTrigger 
                    id="embeddingModelSelect" 
                    className="w-full rounded-lg border-border/40 bg-background/50"
                    style={{ height: "2.5rem" }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-80 rounded-lg">
                    {embeddingModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center gap-2 py-1">
                          <span className="font-medium">{model.name}</span>
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {model.description}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                    {embeddingModels.length === 0 && (
                      <SelectItem value="custom">Custom model (enter manually)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {embeddingModels.length === 0 || embeddingModelId === "custom" ? (
                  <Input
                    placeholder="Enter embedding model ID"
                    value={embeddingModelId === "custom" ? "" : embeddingModelId}
                    onChange={(e) => setEmbeddingModelId(e.target.value)}
                    className="h-12 w-full rounded-lg border-border/40 bg-background/50"
                  />
                ) : null}
              </div>
            </div>

            {/* API Key */}
            {embeddingProviderInfo?.requiresApiKey && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="embeddingApiKey" className="flex items-center gap-2 text-sm font-medium">
                    <Key className="h-3.5 w-3.5 text-muted-foreground" />
                    API Key
                  </Label>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    Optional
                  </Badge>
                </div>
                <div className="relative">
                  <Input
                    id="embeddingApiKey"
                    name="embeddingApiKey"
                    type={showEmbeddingApiKey ? "text" : "password"}
                    placeholder={
                      settings.embeddingApiKey
                        ? maskApiKey(settings.embeddingApiKey)
                        : "Same as chat or enter separate key"
                    }
                    value={embeddingApiKeyModified ? embeddingApiKey : ""}
                    onChange={(e) => {
                      setEmbeddingApiKey(e.target.value)
                      setEmbeddingApiKeyModified(true)
                    }}
                    className="rounded-lg border-border/40 bg-background/50 pr-10 font-mono text-sm"
                    style={{ height: "2.5rem" }}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowEmbeddingApiKey(!showEmbeddingApiKey)}
                  >
                    {showEmbeddingApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {!embeddingApiKeyModified && settings.embeddingApiKey && (
                  <p className="text-xs text-muted-foreground">
                    Key is saved (hidden). Leave empty to use the same provider with chat API key.
                  </p>
                )}
              </div>
            )}

            {/* Base URL (for local/custom) */}
            {embeddingProvider === "local" && (
              <div className="space-y-2.5">
                <Label htmlFor="embeddingBaseUrl" className="flex items-center gap-2 text-sm font-medium">
                  <Link className="h-3.5 w-3.5 text-muted-foreground" />
                  Base URL
                </Label>
                <Input
                  id="embeddingBaseUrl"
                  name="embeddingBaseUrl"
                  placeholder="http://localhost:11434/v1"
                  value={embeddingBaseUrl}
                  onChange={(e) => setEmbeddingBaseUrl(e.target.value)}
                  className="rounded-lg border-border/40 bg-background/50 font-mono text-sm"
                  style={{ height: "2.5rem" }}
                />
              </div>
            )}

            <Separator className="bg-border/40" />

            {/* Embedding Dimensions */}
            <div className="space-y-2.5">
              <Label htmlFor="embeddingDimensions" className="text-sm font-medium">
                Embedding Dimensions
              </Label>
              <Select
                value={embeddingDimensions.toString()}
                onValueChange={(v) => setEmbeddingDimensions(parseInt(v))}
              >
                <SelectTrigger 
                  id="embeddingDimensions"
                  className="w-full rounded-lg border-border/40 bg-background/50"
                  style={{ height: "2.5rem" }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="384">384 dimensions (Cohere Light)</SelectItem>
                  <SelectItem value="768">768 dimensions (Google, Nomic)</SelectItem>
                  <SelectItem value="1024">1024 dimensions (Mistral, Cohere)</SelectItem>
                  <SelectItem value="1536">1536 dimensions (OpenAI)</SelectItem>
                  <SelectItem value="3072">3072 dimensions (OpenAI Large)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Higher dimensions offer better accuracy but use more storage
              </p>
              <input type="hidden" name="embeddingDimensions" value={embeddingDimensions} />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Sticky Save Bar */}
      <div className="sticky bottom-6 z-20 mt-8">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-card/95 p-4 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_4px_12px_-2px_rgba(0,0,0,0.08),0px_8px_24px_-4px_rgba(0,0,0,0.06)] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Settings className="h-4 w-4 text-primary" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium">AI Configuration</p>
              <p className="text-xs text-muted-foreground">
                {state.success ? "Settings saved successfully" : "Unsaved changes"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {state.success && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <Check className="h-4 w-4" />
                <span className="hidden sm:inline">Saved</span>
              </span>
            )}
            <Button 
              type="submit" 
              disabled={isPending} 
              className="h-10 gap-2 rounded-lg px-5 transition-transform active:scale-[0.96]"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
