import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export async function getSession() {
  return await getServerSession(authOptions)
}

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/sign-in")
  }
  return user
}

export async function requireRole(
  allowedRoles: ("ADMIN" | "PROFESSOR" | "STUDENT")[]
) {
  const user = await requireAuth()
  if (!allowedRoles.includes(user.role as any)) {
    redirect("/dashboard")
  }
  return user
}
