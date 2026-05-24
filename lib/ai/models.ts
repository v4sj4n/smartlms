import { google } from "@ai-sdk/google"

// Use the latest Google embedding model here (not loaded from .env).
// This is not a secret and should be kept in code per project preference.
export const EMBEDDING_MODEL = "google/gemini-embedding-001"

export function chatModel(modelId = "gemini-3-flash-preview") {
  return google(modelId)
}

export function embeddingModel(modelId = EMBEDDING_MODEL) {
  // Return the hardcoded provider model identifier string expected by `embed`/`embedMany`.
  return modelId
}
