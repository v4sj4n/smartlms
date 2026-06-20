-- Create ai_response_cache table for semantic caching
CREATE TABLE ai_response_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  embedding vector(768) NOT NULL,
  response text NOT NULL,
  context_hash text NOT NULL,
  hit_count integer DEFAULT 1 NOT NULL,
  created_at timestamp DEFAULT NOW() NOT NULL,
  expires_at timestamp NOT NULL,
  user_role text DEFAULT NULL
);

-- Add indexes for similarity search and expiration
CREATE INDEX idx_ai_cache_embedding ON ai_response_cache USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_ai_cache_expires ON ai_response_cache(expires_at);
CREATE INDEX idx_ai_cache_context ON ai_response_cache(context_hash);
CREATE INDEX idx_ai_cache_user_role ON ai_response_cache(user_role) WHERE user_role IS NOT NULL;

-- Add HNSW index for better similarity search performance (if pgvector >= 0.5.0)
-- CREATE INDEX idx_ai_cache_embedding_hnsw ON ai_response_cache USING hnsw (embedding vector_cosine_ops);

-- Add comments
COMMENT ON TABLE ai_response_cache IS 'Semantic cache for AI responses using pgvector';
COMMENT ON COLUMN ai_response_cache.question IS 'Normalized question text';
COMMENT ON COLUMN ai_response_cache.embedding IS 'Vector embedding of the question';
COMMENT ON COLUMN ai_response_cache.context_hash IS 'Hash of context data for invalidation';
COMMENT ON COLUMN ai_response_cache.hit_count IS 'Number of times this cache entry was used';
COMMENT ON COLUMN ai_response_cache.expires_at IS 'TTL expiration timestamp';
COMMENT ON COLUMN ai_response_cache.user_role IS 'Role-specific cache (ADMIN, PROFESSOR, STUDENT or NULL for universal)';
