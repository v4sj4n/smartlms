import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "@/db"
import { users, userAuth } from "@/db/schema"
import { eq } from "drizzle-orm"

export const authOptions: NextAuthOptions = {
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
          name: userRecord.fullName,
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
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        ;(session.user as any).id = token.id as string
        ;(session.user as any).role = token.role as string
      }
      return session
    },
  },
  pages: {
    signIn: "/sign-in",
  },
}
