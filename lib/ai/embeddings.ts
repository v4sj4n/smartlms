import { embed, embedMany } from "ai"
import { getEmbeddingConfig } from "@/lib/ai/models"

function coerceEmbeddingDimensions(embedding: number[], dimensions: number) {
  if (embedding.length === dimensions) {
    return embedding
  }

  if (embedding.length > dimensions) {
    return embedding.slice(0, dimensions)
  }

  throw new Error(
    `Embedding size ${embedding.length} is smaller than required vector size ${dimensions}`
  )
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return []

  const { model, provider, dimensions } = await getEmbeddingConfig()

  const providerOptions =
    provider === "google"
      ? { google: { outputDimensionality: dimensions, taskType: "RETRIEVAL_DOCUMENT" } }
      : undefined

  const response = await embedMany({
    model,
    values: texts,
    providerOptions,
  })

  return response.embeddings.map((embedding) =>
    coerceEmbeddingDimensions(embedding, dimensions)
  )
}

export async function embedQuery(text: string): Promise<number[]> {
  const { model, provider, dimensions } = await getEmbeddingConfig()

  const providerOptions =
    provider === "google"
      ? { google: { outputDimensionality: dimensions, taskType: "RETRIEVAL_QUERY" } }
      : undefined

  const response = await embed({
    model,
    value: text,
    providerOptions,
  })

  return coerceEmbeddingDimensions(response.embedding, dimensions)
}
