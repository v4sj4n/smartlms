import { env } from "@/lib/env"
import { embed, embedMany } from "ai"
import { embeddingModel } from "@/lib/ai/models"

function coerceEmbeddingDimensions(embedding: number[]) {
  if (embedding.length === env.GENAI_EMBEDDING_DIMENSIONS) {
    return embedding
  }

  if (embedding.length > env.GENAI_EMBEDDING_DIMENSIONS) {
    return embedding.slice(0, env.GENAI_EMBEDDING_DIMENSIONS)
  }

  throw new Error(
    `Embedding size ${embedding.length} is smaller than required vector size ${env.GENAI_EMBEDDING_DIMENSIONS}`
  )
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return []

  const response = await embedMany({
    model: embeddingModel(env.GENAI_EMBEDDING_MODEL),
    values: texts,
    providerOptions: {
      google: {
        outputDimensionality: env.GENAI_EMBEDDING_DIMENSIONS,
        taskType: "RETRIEVAL_DOCUMENT",
      },
    },
  })

  return response.embeddings.map((embedding) =>
    coerceEmbeddingDimensions(embedding)
  )
}

export async function embedQuery(text: string): Promise<number[]> {
  const response = await embed({
    model: embeddingModel(env.GENAI_EMBEDDING_MODEL),
    value: text,
    providerOptions: {
      google: {
        outputDimensionality: env.GENAI_EMBEDDING_DIMENSIONS,
        taskType: "RETRIEVAL_QUERY",
      },
    },
  })

  return coerceEmbeddingDimensions(response.embedding)
}
