import NextAuth, { DefaultSession, DefaultUser } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      nickname?: string | null
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    id: string
    role: string
    nickname?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    nickname?: string | null
  }
}
