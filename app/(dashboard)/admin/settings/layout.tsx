"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { User, BrainCircuit } from "lucide-react"
import { cn } from "@/lib/utils"

const settingsNav = [
  {
    title: "Profile",
    href: "/admin/settings",
    icon: User,
    description: "Manage your profile details",
  },
  {
    title: "AI Config",
    href: "/admin/settings/ai",
    icon: BrainCircuit,
    description: "Configure AI providers & models",
  },
]

export default function AdminSettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Manage your account preferences and platform configuration.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Settings sidebar nav */}
        <aside className="w-full shrink-0 lg:w-52">
          <nav className="flex flex-row gap-1 lg:flex-col">
            {settingsNav.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.96]",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-200",
                      isActive ? "scale-105" : "group-hover:scale-105"
                    )}
                  />
                  <span className="truncate">{item.title}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Settings content */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
