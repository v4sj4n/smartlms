-- Update embedding dimensions from 1536 to 1024
-- Updates ai_settings default and existing row, and resizes the file_chunks vector column

-- Update column default on ai_settings
ALTER TABLE "ai_settings" ALTER COLUMN "embedding_dimensions" SET DEFAULT 1024;

-- Update existing settings row to 1024
UPDATE "ai_settings" SET "embedding_dimensions" = 1024;

-- Drop existing index on file_chunks embedding (required before altering column type)
DROP INDEX IF EXISTS "idx_file_chunks_embedding";

-- Truncate existing chunks (vectors are incompatible across dimensions)
TRUNCATE TABLE "file_chunks";

-- Alter the embedding column to vector(1024)
ALTER TABLE "file_chunks" ALTER COLUMN "embedding" TYPE vector(1024)
  USING embedding::text::vector(1024);
