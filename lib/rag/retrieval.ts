import { db } from "@/db"
import { sql } from "drizzle-orm"
import { embedQuery } from "@/lib/ai/embeddings"

type RetrievalOptions = {
  subjectId: string
  weekNumber?: number
  limit?: number
}

export type RetrievedChunk = {
  id: string
  fileId: string
  chunkText: string
  metadata: Record<string, unknown>
  score: number
}

export async function retrieveRelevantChunks(
  query: string,
  options: RetrievalOptions
): Promise<RetrievedChunk[]> {
  const embedding = await embedQuery(query)
  const limit = options.limit ?? 8

  const rows = await db.execute(sql`
    with vec as (
      select
        id,
        file_id as "fileId",
        chunk_text as "chunkText",
        metadata,
        1 - (embedding <=> ${`[${embedding.join(",")}]`}::vector) as vec_score
      from file_chunks
      where (metadata->>'subjectId')::uuid = ${options.subjectId}::uuid
      ${
        options.weekNumber
          ? sql`and (metadata->>'weekNumber')::int = ${options.weekNumber}`
          : sql``
      }
      order by embedding <=> ${`[${embedding.join(",")}]`}::vector
      limit 30
    ),
    txt as (
      select
        id,
        ts_rank(
          to_tsvector('english', chunk_text),
          plainto_tsquery('english', ${query})
        ) as txt_score
      from file_chunks
      where to_tsvector('english', chunk_text) @@ plainto_tsquery('english', ${query})
      limit 30
    )
    select
      v.id,
      v."fileId",
      v."chunkText",
      v.metadata,
      (0.7 * v.vec_score + 0.3 * coalesce(t.txt_score, 0))::float as score
    from vec v
    left join txt t on t.id = v.id
    order by score desc
    limit ${limit}
  `)

  return rows as unknown as RetrievedChunk[]
}
