import { db } from "@/db"
import { sql } from "drizzle-orm"
import { resolveProfileImageUrl } from "@/lib/profile-image"

export type ProfileSettingsUser = {
  name: string | null
  email: string
  image: string | null
  imageUrl: string | null
  nickname: string | null
  bio: string | null
  aiTone: string | null
  aiCustomInstructions: string | null
}

export type ProfileSettingsCapabilities = {
  hasNickname: boolean
  hasBio: boolean
  hasAiTone: boolean
  hasAiCustomInstructions: boolean
}

export async function getProfileSettingsCapabilities(): Promise<ProfileSettingsCapabilities> {
  const rows = (await db.execute(sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name in ('nickname', 'bio', 'ai_tone', 'ai_custom_instructions')
  `)) as Array<{ column_name: string }>

  const columns = new Set(rows.map((row) => row.column_name))

  return {
    hasNickname: columns.has("nickname"),
    hasBio: columns.has("bio"),
    hasAiTone: columns.has("ai_tone"),
    hasAiCustomInstructions: columns.has("ai_custom_instructions"),
  }
}

function selectOrNull(
  columnName: string,
  alias: string,
  hasColumn: boolean,
  fallbackType: string
) {
  return hasColumn
    ? sql.raw(`${columnName} as "${alias}"`)
    : sql.raw(`null::${fallbackType} as "${alias}"`)
}

export async function getProfileSettingsUserById(
  userId: string
): Promise<ProfileSettingsUser | null> {
  async function withResolvedImage(
    row: Omit<ProfileSettingsUser, "imageUrl"> | undefined
  ) {
    if (!row) return null

    return {
      ...row,
      imageUrl: await resolveProfileImageUrl(row.image),
    }
  }

  const { hasNickname, hasBio, hasAiTone, hasAiCustomInstructions } =
    await getProfileSettingsCapabilities()

  const rows = (await db.execute(
    sql<ProfileSettingsUser>`
      select
        name,
        email,
        image,
        ${selectOrNull("nickname", "nickname", hasNickname, "varchar")},
        ${selectOrNull("bio", "bio", hasBio, "text")},
        ${selectOrNull("ai_tone", "aiTone", hasAiTone, "varchar")},
        ${selectOrNull(
          "ai_custom_instructions",
          "aiCustomInstructions",
          hasAiCustomInstructions,
          "text"
        )}
      from users
      where id = ${userId}
      limit 1
    `
  )) as ProfileSettingsUser[]

  return withResolvedImage(rows[0])
}

const AI_TONE_GUIDANCE: Record<string, string> = {
  Default: "Use a neutral, clear, and balanced tone.",
  Professional: "Use a polished, formal, and precise tone.",
  Friendly: "Use a warm, encouraging, and approachable tone.",
  Candid: "Be direct, honest, and concise.",
  Quirky: "Use a light, playful tone while staying clear and useful.",
  Efficient: "Be succinct, practical, and outcome-oriented.",
  Cynical: "Use a dry, skeptical tone, but stay respectful and helpful.",
}

export function buildAIPersonalizationPrompt(user: {
  aiTone: string | null
  aiCustomInstructions: string | null
}): string {
  const tone =
    user.aiTone && AI_TONE_GUIDANCE[user.aiTone] ? user.aiTone : "Default"
  const lines = [
    "User AI personalization preferences:",
    `- Default tone: ${tone}. ${AI_TONE_GUIDANCE[tone]}`,
  ]

  const customInstructions = user.aiCustomInstructions?.trim()
  if (customInstructions) {
    lines.push(`- Custom instructions: ${customInstructions}`)
  }

  return lines.join("\n")
}

export async function getUserAIPersonalizationPrompt(
  userId: string
): Promise<string | null> {
  const user = await getProfileSettingsUserById(userId)

  if (!user) {
    return null
  }

  return buildAIPersonalizationPrompt(user)
}
