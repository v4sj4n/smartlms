type DisplayNameUser = {
  nickname?: string | null
  name?: string | null
  email?: string | null
  role?: string | null
}

export function getUserDisplayName(user: DisplayNameUser | null | undefined) {
  const nickname = user?.nickname?.trim()
  if (nickname) return nickname

  const name = user?.name?.trim()
  if (name) return name

  if (user?.role === "ADMIN") return "Admin"
  if (user?.role === "PROFESSOR") return "Professor"
  if (user?.role === "STUDENT") return "Student"

  return user?.email?.trim() || "User"
}