import { client } from "@/db"
import { resolveProfileImageUrl } from "@/lib/profile-image"

export type ProfileSettingsUser = {
  name: string | null
  email: string
  image: string | null
  imageUrl: string | null
  nickname: string | null
  bio: string | null
}

export type ProfileSettingsCapabilities = {
  hasNickname: boolean
  hasBio: boolean
}

export async function getProfileSettingsCapabilities(): Promise<ProfileSettingsCapabilities> {
  const rows = await client<{ column_name: string }[]>`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name in ('nickname', 'bio')
  `

  const columns = new Set(rows.map((row) => row.column_name))

  return {
    hasNickname: columns.has("nickname"),
    hasBio: columns.has("bio"),
  }
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

  const { hasNickname, hasBio } = await getProfileSettingsCapabilities()

  if (hasNickname && hasBio) {
    const rows = await client<ProfileSettingsUser[]>`
      select name, email, image, nickname, bio
      from users
      where id = ${userId}
      limit 1
    `

    return withResolvedImage(rows[0])
  }

  if (hasNickname && !hasBio) {
    const rows = await client<ProfileSettingsUser[]>`
      select name, email, image, nickname, null::text as bio
      from users
      where id = ${userId}
      limit 1
    `

    return withResolvedImage(rows[0])
  }

  if (!hasNickname && hasBio) {
    const rows = await client<ProfileSettingsUser[]>`
      select name, email, image, null::varchar as nickname, bio
      from users
      where id = ${userId}
      limit 1
    `

    return withResolvedImage(rows[0])
  }

  const rows = await client<ProfileSettingsUser[]>`
    select name, email, image, null::varchar as nickname, null::text as bio
    from users
    where id = ${userId}
    limit 1
  `

  return withResolvedImage(rows[0])
}
