const required = [
  "DATABASE_URL",
  "GEMINI_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const

type RequiredKey = (typeof required)[number]

export function getEnv(key: RequiredKey): string {
  const value = process.env[key]

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

function getOptionalEnv(key: string, fallback: string): string {
  const value = process.env[key]
  return value && value.trim().length > 0 ? value : fallback
}

function getOptionalNumberEnv(key: string, fallback: number): number {
  const value = process.env[key]
  if (!value) return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const env = {
  DATABASE_URL: getEnv("DATABASE_URL"),
  GENAI_CHAT_MODEL: getOptionalEnv("GENAI_CHAT_MODEL", "gemini-3.5-flash"),
  GENAI_QUIZ_MODEL: getOptionalEnv(
    "GENAI_QUIZ_MODEL",
    "gemini-3.1-pro-preview"
  ),
  GENAI_EMBEDDING_MODEL: getOptionalEnv(
    "GENAI_EMBEDDING_MODEL",
    "gemini-embedding-001"
  ),
  GENAI_EMBEDDING_DIMENSIONS: getOptionalNumberEnv(
    "GENAI_EMBEDDING_DIMENSIONS",
    1536
  ),
  NEXT_PUBLIC_SUPABASE_URL: getEnv("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
}
