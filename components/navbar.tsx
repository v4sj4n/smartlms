"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { OptimoLogo } from "@/components/optimo-logo"

const NAV_LINKS = [
  { id: "features", label: "Features" },
  { id: "qa", label: "Q&A" },
  { id: "about", label: "About" },
]

export function Navbar() {
  const [activeSection, setActiveSection] = useState<string | null>(null)

  useEffect(() => {
    const handleScroll = () => {
      const triggerY = window.scrollY + window.innerHeight / 3

      let current: string | null = null
      for (const { id } of NAV_LINKS) {
        const el = document.getElementById(id)
        if (el && el.offsetTop <= triggerY) {
          current = id
        }
      }
      setActiveSection(current)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="flex h-16 w-full items-center gap-8 px-6 md:px-10">
        <Link href="/" className="flex items-center gap-2">
          <OptimoLogo
            width={28}
            height={28}
            className="fill-foreground dark:fill-white"
          />
          <span className="font-heading text-xl font-bold tracking-tight">
            Optimo
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-4 md:gap-6">
          {NAV_LINKS.map(({ id, label }) => {
            const isActive = activeSection === id
            return (
              <Link
                key={id}
                href={`#${id}`}
                className={`hidden text-sm transition-colors sm:block ${
                  isActive
                    ? "font-bold text-foreground"
                    : "font-medium text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
