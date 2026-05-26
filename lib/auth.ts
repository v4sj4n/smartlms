import { NextAuthOptions } from "next-auth"
import type { Adapter } from "next-auth/adapters"
import CredentialsProvider from "next-auth/providers/credentials"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import bcrypt from "bcryptjs"
import { db } from "@/db"
import { users, userAuth } from "@/db/schema"
import { eq } from "drizzle-orm"
import { resolveProfileImageUrl } from "@/lib/profile-image"

type AuthUser = {
  id: string
  role?: string | null
  image?: string | null
  nickname?: string | null
}

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db) as unknown as Adapter,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const userRecord = await db.query.users.findFirst({
          where: eq(users.email, credentials.email),
        })

        if (!userRecord) {
          return null
        }

        const authRecord = await db.query.userAuth.findFirst({
          where: eq(userAuth.userId, userRecord.id),
        })

        if (!authRecord) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          authRecord.passwordHash
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: userRecord.id,
          email: userRecord.email,
          name: userRecord.name || userRecord.fullName || "",
          nickname: userRecord.nickname,
          role: userRecord.role,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as AuthUser).id
        token.role = (user as AuthUser).role ?? token.role ?? "student"
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        const su = session.user as unknown as AuthUser
        su.id = token.id as string
        su.role = token.role as string

        if (token.id) {
          const userRecord = await db.query.users.findFirst({
            where: eq(users.id, token.id as string),
            columns: {
              image: true,
              nickname: true,
            },
          })

          su.image = await resolveProfileImageUrl(userRecord?.image ?? null)
          su.nickname = userRecord?.nickname ?? null
        }
      }
      return session
    },
  },
  pages: {
    signIn: "/sign-in",
  },
}
