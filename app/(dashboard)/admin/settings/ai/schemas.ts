import { z } from "zod"

import {
  MODEL_TYPES,
  PROVIDER_ORDER,
  type AIModelType,
} from "@/lib/ai/provider-registry"

export const aiProviderIdSchema = z.enum(PROVIDER_ORDER)
export const aiModelTypeSchema = z.enum(MODEL_TYPES)
export const aiProviderStatusSchema = z.enum(["enabled", "disabled"])

export const aiModelFormSchema = z.object({
  id: z.string().optional(),
  providerId: aiProviderIdSchema,
  modelName: z.string().trim().min(1, "Model name is required").max(128),
  modelIdentifier: z
    .string()
    .trim()
    .min(1, "Model identifier is required")
    .max(128),
  modelType: aiModelTypeSchema,
  enabled: z.boolean(),
})

export const aiConfigSectionSchema = z.object({
  providerId: aiProviderIdSchema,
  modelId: z.string().trim().min(1, "Model is required").max(128),
  apiKey: z.string().trim().max(512),
  baseUrl: z.string().trim().max(256),
})

export type AIModelFormValues = z.infer<typeof aiModelFormSchema>
export type AIConfigSectionValues = z.infer<typeof aiConfigSectionSchema>
export type AIProviderStatusValue = z.infer<typeof aiProviderStatusSchema>
export type ProviderId = z.infer<typeof aiProviderIdSchema>
export type ModelType = AIModelType
