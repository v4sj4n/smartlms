import * as React from "react"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/lib/auth"
import { SettingsNav, type SettingsNavItem } from "@/components/settings-nav"

const settingsNav: SettingsNavItem[] = [
  {
    title: "Profile",
    href: "/professor/settings",
    icon: "user",
    description: "Update your profile image, nickname, and bio",
  },
  {
    title: "AI Personalizations",
    href: "/professor/settings/ai",
    icon: "sparkles",
    description: "Set your default AI tone and instructions",
  },
]

export default async function ProfessorSettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "PROFESSOR") {
    redirect("/sign-in")
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Settings
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          Manage your profile and AI personalizations.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <aside className="w-full shrink-0 lg:w-52">
          <SettingsNav items={settingsNav} />
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
