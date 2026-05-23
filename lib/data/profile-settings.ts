import { client } from "@/db"

export type ProfileSettingsUser = {
  name: string | null
  email: string
  image: string | null
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
  const { hasNickname, hasBio } = await getProfileSettingsCapabilities()

  if (hasNickname && hasBio) {
    const rows = await client<ProfileSettingsUser[]>`
      select name, email, image, nickname, bio
      from users
      where id = ${userId}
      limit 1
    `

    return rows[0] ?? null
  }

  if (hasNickname && !hasBio) {
    const rows = await client<ProfileSettingsUser[]>`
      select name, email, image, nickname, null::text as bio
      from users
      where id = ${userId}
      limit 1
    `

    return rows[0] ?? null
  }

  if (!hasNickname && hasBio) {
    const rows = await client<ProfileSettingsUser[]>`
      select name, email, image, null::varchar as nickname, bio
      from users
      where id = ${userId}
      limit 1
    `

    return rows[0] ?? null
  }

  const rows = await client<ProfileSettingsUser[]>`
    select name, email, image, null::varchar as nickname, null::text as bio
    from users
    where id = ${userId}
    limit 1
  `

  return rows[0] ?? null
}
