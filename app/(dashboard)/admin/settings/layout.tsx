import * as React from "react"
import { SettingsNav, type SettingsNavItem } from "@/components/settings-nav"

const settingsNav: SettingsNavItem[] = [
  {
    title: "Profile",
    href: "/admin/settings",
    icon: "user",
    description: "Manage your profile details",
  },
  {
    title: "AI Config",
    href: "/admin/settings/ai",
    icon: "brainCircuit",
    description: "Configure AI providers & models",
  },
]

export default function AdminSettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Settings
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          Manage your account preferences and platform configuration.
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
