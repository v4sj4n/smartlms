import { db } from "@/db"
import { fileChunks, files } from "@/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import { createSupabaseServiceClient } from "@/lib/supabase/server"
import { chunkAcademicText } from "@/lib/rag/chunk"
import { extractTextByMimeType } from "@/lib/rag/extract"
import { embedTexts } from "@/lib/ai/embeddings"

const BUCKET = "uploads"
const EMBEDDING_BATCH_SIZE = 64

export async function ingestFileToRag(fileId: string) {
  const file = await db.query.files.findFirst({
    where: and(eq(files.id, fileId), isNull(files.deletedAt)),
  })

  if (!file) {
    throw new Error("File not found")
  }

  await db
    .update(files)
    .set({ status: "PROCESSING" })
    .where(eq(files.id, fileId))

  try {
    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(file.path)

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to download file from storage")
    }

    const arrayBuffer = await data.arrayBuffer()
    const rawText = await extractTextByMimeType({
      mimeType: file.mimeType,
      data: Buffer.from(arrayBuffer),
    })

    const chunks = chunkAcademicText(rawText)

    await db.delete(fileChunks).where(eq(fileChunks.fileId, file.id))

    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE)
      const embeddings = await embedTexts(batch.map((chunk) => chunk.chunkText))

      await db.insert(fileChunks).values(
        batch.map((chunk, index) => ({
          fileId: file.id,
          chunkIndex: chunk.chunkIndex,
          chunkText: chunk.chunkText,
          embedding: embeddings[index]!,
          metadata: {
            ...chunk.metadata,
            subjectId: file.subjectId,
            weekNumber: file.weekNumber,
            fileName: file.name,
          },
        }))
      )
    }

    await db.update(files).set({ status: "READY" }).where(eq(files.id, file.id))

    return { success: true, chunks: chunks.length }
  } catch (error) {
    await db
      .update(files)
      .set({
        status: "FAILED",
        metadata: {
          ...(file.metadata ?? {}),
          ingestError:
            error instanceof Error ? error.message : "Unknown ingest error",
        },
      })
      .where(eq(files.id, file.id))

    throw error
  }
}
