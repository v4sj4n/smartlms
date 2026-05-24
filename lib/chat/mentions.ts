const mentionRegex = /@([a-zA-Z0-9_.-]{2,32})/g

export function extractMentions(message: string): string[] {
  const matches = message.matchAll(mentionRegex)
  const usernames = new Set<string>()

  for (const match of matches) {
    const username = match[1]?.trim().toLowerCase()
    if (username) usernames.add(username)
  }

  return [...usernames]
}
