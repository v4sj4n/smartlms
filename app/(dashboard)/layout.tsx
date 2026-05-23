"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Bell, Moon, Search, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  // Generate breadcrumbs from current path segments
  const getBreadcrumbs = () => {
    const paths = pathname.split("/").filter((x) => x)
    return paths.map((path, index) => {
      const href = "/" + paths.slice(0, index + 1).join("/")
      const label = path.charAt(0).toUpperCase() + path.slice(1)
      const isLast = index === paths.length - 1
      return { href, label, isLast }
    })
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full overflow-x-hidden bg-background">
        {/* Dynamic Role-Aware Sidebar */}
        <AppSidebar />

        {/* Dashboard Shell Content */}
        <div className="flex flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-md supports-backdrop-filter:bg-background/60 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="h-9 w-9 rounded-lg border border-border/40 text-foreground transition-[background-color,border-color,color,transform] duration-200 hover:bg-sidebar-accent active:scale-[0.96]" />
              <Separator
                orientation="vertical"
                className="hidden h-6 bg-border/50 md:block"
              />

              {/* Dynamic Breadcrumbs */}
              <Breadcrumb className="hidden md:block">
                <BreadcrumbList className="gap-1.5 text-sm font-medium">
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      href="/dashboard"
                      className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    >
                      Optimo
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={crumb.href}>
                      <BreadcrumbSeparator className="text-muted-foreground/60" />
                      <BreadcrumbItem>
                        {crumb.isLast ? (
                          <BreadcrumbPage className="font-semibold tracking-tight text-foreground">
                            {crumb.label}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink
                            href={crumb.href}
                            className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
                          >
                            {crumb.label}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </React.Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            {/* Header Right Interactions */}
            <div className="flex items-center gap-3">
              {/* Search Box */}
              <div className="relative hidden w-48 sm:block lg:w-64">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
                <Input
                  placeholder="Search resources, files..."
                  className="h-9 w-full rounded-xl border-border/40 bg-muted/40 pl-9 text-sm transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-muted-foreground/60 focus:bg-background focus:ring-1 focus:ring-primary/45"
                />
              </div>

              {/* Theme Toggle Button */}
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-lg border-border/40 text-foreground transition-[background-color,border-color,transform] duration-200 hover:bg-muted/60 active:scale-[0.96]"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle Theme"
              >
                <Sun className="h-4 w-4 scale-100 rotate-0 transition-transform duration-300 dark:scale-0 dark:-rotate-90" />
                <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-transform duration-300 dark:scale-100 dark:rotate-0" />
              </Button>

              {/* Notifications Button */}
              <Button
                variant="outline"
                size="icon"
                className="relative h-9 w-9 rounded-lg border-border/40 text-foreground transition-[background-color,border-color,transform] duration-200 hover:bg-muted/60 active:scale-[0.96]"
                aria-label="View Notifications"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1 right-1 h-2 w-2 animate-pulse rounded-full bg-destructive" />
              </Button>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="relative flex-1 bg-background/50 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <div className="mx-auto w-full max-w-7xl animate-in duration-300 fade-in slide-in-from-bottom-2">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
