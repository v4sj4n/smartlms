import { db } from "@/db"
import { users, userAuth } from "@/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

export async function getUsersByRole(role: "ADMIN" | "PROFESSOR" | "STUDENT") {
  return await db.query.users.findMany({
    where: eq(users.role, role),
    orderBy: (users, { asc }) => [asc(users.fullName)],
  })
}

export async function getUserById(id: string) {
  return await db.query.users.findFirst({
    where: eq(users.id, id),
  })
}

export async function getUserByEmail(email: string) {
  return await db.query.users.findFirst({
    where: eq(users.email, email),
  })
}

export async function createUser(data: {
  name?: string
  email: string
  fullName?: string
  role?: "ADMIN" | "PROFESSOR" | "STUDENT"
  password?: string
}) {
  const [user] = await db
    .insert(users)
    .values({
      name: data.name,
      email: data.email,
      fullName: data.fullName,
      role: data.role ?? "STUDENT",
    })
    .returning()

  if (data.password) {
    const passwordHash = await bcrypt.hash(data.password, 10)
    await db.insert(userAuth).values({
      userId: user.id,
      passwordHash,
    })
  }

  return user
}

export async function verifyUserPassword(email: string, password: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    with: {
      auth: true,
    },
  })

  if (!user || !user.auth) {
    return null
  }

  const isValid = await bcrypt.compare(password, user.auth.passwordHash)

  if (!isValid) {
    return null
  }

  return user
}
