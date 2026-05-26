"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BrainCircuit, Sparkles, User, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const settingsNavIcons = {
  user: User,
  sparkles: Sparkles,
  brainCircuit: BrainCircuit,
} as const

type SettingsNavIconKey = keyof typeof settingsNavIcons

export type SettingsNavItem = {
  title: string
  href: string
  description: string
  icon: SettingsNavIconKey
}

export function SettingsNav({ items }: { items: SettingsNavItem[] }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-row gap-1 lg:flex-col">
      {items.map((item) => {
        const isActive = pathname === item.href
        const Icon = settingsNavIcons[item.icon] as LucideIcon

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.96]",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon
              className={cn(
                "h-4.5 w-4.5 shrink-0 transition-transform duration-200",
                isActive ? "scale-105" : "group-hover:scale-105"
              )}
            />
            <span className="truncate">{item.title}</span>
          </Link>
        )
      })}
    </nav>
  )
}
