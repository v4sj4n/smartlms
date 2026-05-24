import { z } from "zod"

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const

export const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024

export const createSignedUploadSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_UPLOAD_MIME_TYPES),
  size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  subjectId: z.string().uuid().optional(),
  weekNumber: z.number().int().min(1).max(52).optional(),
  clubId: z.string().uuid().optional(),
})

export const finalizeUploadSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_UPLOAD_MIME_TYPES),
  size: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  path: z.string().min(5),
  subjectId: z.string().uuid().optional(),
  weekNumber: z.number().int().min(1).max(52).optional(),
  clubId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
})
