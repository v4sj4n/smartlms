import { db } from "@/db"
import { aiResponseCache } from "@/db/schema"
import { sql, eq, lt } from "drizzle-orm"
import { embedQuery } from "./embeddings"

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_SIMILARITY_THRESHOLD = 0.92
const DEFAULT_CACHE_TTL_HOURS = 24

// ============================================================================
// CACHE RETRIEVAL
// ============================================================================

/**
 * Check if a semantically similar question exists in the cache
 */
export async function getCachedResponse(
  question: string,
  contextHash: string,
  userRole?: string,
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD
): Promise<string | null> {
  try {
    // Generate embedding for the question
    const embedding = await embedQuery(question)

    // Search for similar cached responses
    const similarEntries = (await db.execute(sql`
      SELECT 
        id,
        question,
        response,
        context_hash,
        1 - (embedding <=> ${`[${embedding.join(",")}]`}::vector) AS similarity
      FROM ai_response_cache
      WHERE 
        expires_at > NOW()
        AND context_hash = ${contextHash}
        AND (
          user_role IS NULL 
          OR user_role = ${userRole || "STUDENT"}
          OR ${userRole === "ADMIN"}
        )
        AND 1 - (embedding <=> ${`[${embedding.join(",")}]`}::vector) >= ${threshold}
      ORDER BY similarity DESC
      LIMIT 1
    `)) as unknown as Array<{
      id: string
      question: string
      response: string
      context_hash: string
      similarity: number
    }>

    if (!similarEntries || similarEntries.length === 0) {
      return null
    }

    const entry = similarEntries[0]

    // Update hit count
    await db
      .update(aiResponseCache)
      .set({
        hitCount: sql`${aiResponseCache.hitCount} + 1`,
      })
      .where(eq(aiResponseCache.id, entry.id as string))

    console.log(
      `[AI Cache] Hit for similar question (similarity: ${entry.similarity})`
    )
    return entry.response as string
  } catch (error) {
    console.error("[AI Cache] Error retrieving from cache:", error)
    return null
  }
}

/**
 * Store a new response in the semantic cache
 */
export async function cacheResponse(
  question: string,
  contextHash: string,
  response: string,
  userRole?: string,
  ttlHours: number = DEFAULT_CACHE_TTL_HOURS
): Promise<void> {
  try {
    // Generate embedding for the question
    const embedding = await embedQuery(question)

    // Calculate expiration
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + ttlHours)

    // Store in cache
    await db.insert(aiResponseCache).values({
      question: normalizeQuestion(question),
      embedding,
      response,
      contextHash,
      expiresAt,
      userRole: userRole || null,
    })

    console.log("[AI Cache] Stored new response")
  } catch (error) {
    console.error("[AI Cache] Error storing in cache:", error)
    // Don't throw - caching failures shouldn't break the AI response
  }
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Invalidate cache entries matching a pattern
 */
export async function invalidateCache(pattern: string): Promise<number> {
  try {
    await db
      .delete(aiResponseCache)
      .where(sql`question ILIKE ${`%${pattern}%`}`)

    console.log(`[AI Cache] Invalidated entries matching: ${pattern}`)
    return 0 // Note: drizzle-orm delete doesn't return rowCount, use query to count if needed
  } catch (error) {
    console.error("[AI Cache] Error invalidating cache:", error)
    return 0
  }
}

/**
 * Invalidate cache by context hash
 */
export async function invalidateCacheByContext(
  contextHash: string
): Promise<number> {
  try {
    await db
      .delete(aiResponseCache)
      .where(eq(aiResponseCache.contextHash, contextHash))

    console.log(`[AI Cache] Invalidated entries for context: ${contextHash}`)
    return 0 // Note: drizzle-orm delete doesn't return rowCount, use query to count if needed
  } catch (error) {
    console.error("[AI Cache] Error invalidating cache:", error)
    return 0
  }
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    await db
      .delete(aiResponseCache)
      .where(lt(aiResponseCache.expiresAt, new Date()))

    console.log(`[AI Cache] Cleaned up expired entries`)
    return 0 // Note: drizzle-orm delete doesn't return rowCount, use query to count if needed
  } catch (error) {
    console.error("[AI Cache] Error cleaning up cache:", error)
    return 0
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number
  expiredEntries: number
  avgHitCount: number
  topQueries: Array<{ question: string; hitCount: number }>
}> {
  try {
    const now = new Date()

    // Total entries
    const totalResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM ai_response_cache
    `)
    const totalEntries = Number(
      (totalResult[0] as { count: string | number }).count
    )

    // Expired entries
    const expiredResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM ai_response_cache
      WHERE expires_at < ${now}
    `)
    const expiredEntries = Number(
      (expiredResult[0] as { count: string | number }).count
    )

    // Average hit count
    const avgResult = await db.execute(sql`
      SELECT AVG(hit_count) as avg FROM ai_response_cache
    `)
    const avgHitCount =
      Number((avgResult[0] as { avg: string | number | null }).avg) || 0

    // Top queries
    const topQueriesResult = await db.execute(sql`
      SELECT question, hit_count
      FROM ai_response_cache
      ORDER BY hit_count DESC
      LIMIT 10
    `)
    const topQueries = (
      topQueriesResult as unknown as Array<{
        question: string
        hit_count: string | number
      }>
    ).map((row) => ({
      question: row.question,
      hitCount: Number(row.hit_count),
    }))

    return {
      totalEntries,
      expiredEntries,
      avgHitCount,
      topQueries,
    }
  } catch (error) {
    console.error("[AI Cache] Error getting stats:", error)
    return {
      totalEntries: 0,
      expiredEntries: 0,
      avgHitCount: 0,
      topQueries: [],
    }
  }
}

// ============================================================================
// MAIN CACHE INTERFACE
// ============================================================================

/**
 * Get response from cache or generate new one
 * This is the main function to use for AI responses with caching
 */
export async function getAIResponseWithCache(params: {
  question: string
  contextHash: string
  userRole?: string
  generateResponse: () => Promise<string>
  threshold?: number
  ttlHours?: number
}): Promise<string> {
  const {
    question,
    contextHash,
    userRole,
    generateResponse,
    threshold,
    ttlHours,
  } = params

  // Try to get from cache
  const cached = await getCachedResponse(
    question,
    contextHash,
    userRole,
    threshold
  )
  if (cached) {
    return cached
  }

  // Generate new response
  const response = await generateResponse()

  // Store in cache
  await cacheResponse(question, contextHash, response, userRole, ttlHours)

  return response
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/[?.!,;:]$/g, "") // Remove trailing punctuation
}
