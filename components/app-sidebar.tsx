"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import {
  BookOpen,
  Compass,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  ChevronsUpDown,
  User,
  Sparkles,
  School,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

function OptimoMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 540.92 490.7"
      className="h-8 w-8 text-foreground transition-colors duration-200 dark:text-white"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M238.18,222.21c-.09,19.09-29.1,19.09-29.19,0,.09-19.09,29.1-19.09,29.19,0Z" />
      <path d="M332.28,222.25c-.09,18.99-28.94,18.99-29.03,0,.09-18.99,28.94-18.99,29.03,0Z" />
      <path d="M359.53,66.33c-76.07-97.22-230.81-14.69-200.86,101.95,22.83,83.41,105.62,184.79,3.67,247.44-71.56,47.36-191.6-21.66-155.83-109.58,17.51-44.17,76.19-55.56,107.44-23.35,18.73,18.72,28.63,59.72,7,59-20.47-.68-2.21-27.55-28.32-46.28-25.22-18.98-62.72-1-67.59,29.38-11.97,67.51,79.76,105.17,129.72,67.94,61.06-39.85,25.59-112.32.19-163.01C87.89,116.34,176.53-32.91,311.86,6.44c74.63,22.06,114.77,106.9,90.91,179.62-14,51.07-44.59,88.08-50.06,132.53-13.78,108.3,164.42,121.2,164.46,12.68-1.28-32.53-38.61-55.53-66.52-36.96-27.87,17.5-10.35,45.38-29.08,47.43-38.13.83,6.87-110.22,84.06-68.73,66.39,39.61,30.52,136.98-36.69,152.74-73.87,25.29-157.32-40.59-138.04-119.58,18.68-77.44,94.07-162.1,28.64-239.84Z" />
      <path d="M270.6,390.58c-31.5,80.99-114.11,125.22-193.84,84.9-4.25-4.52-5.03-9.78-2.39-14.3,2.39-4.09,9.45-7.91,14.62-5.33,82.09,43.23,168.31-38.55,169.95-121.83-.47-15.53,22.57-16.8,23.26-.79,2.62,43.38,22.36,84.33,56.53,111.19,70.23,54.19,119.02-7.52,128.92,18.46,2.46,6.93-1.41,12.37-8.13,15.43-75.8,36.17-161.02-10.99-188.91-87.73Z" />
    </svg>
  )
}

export function AppSidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()

  const user = session?.user
  const role = user?.role ?? "STUDENT"
  const settingsUrl =
    role === "PROFESSOR"
      ? "/professor/settings"
      : role === "STUDENT"
        ? "/student/settings"
        : "/admin"

  // Define navigation items per role
  const getNavItems = () => {
    switch (role) {
      case "ADMIN":
        return [
          {
            title: "Dashboard",
            url: "/admin",
            icon: LayoutDashboard,
          },
          {
            title: "Courses",
            url: "/admin/courses",
            icon: BookOpen,
          },
          {
            title: "Academic",
            url: "/admin/academic",
            icon: School,
          },
          {
            title: "Users",
            url: "/admin/users",
            icon: Users,
          },
          {
            title: "Clubs",
            url: "/admin/clubs",
            icon: Compass,
          },
        ]
      case "PROFESSOR":
        return [
          {
            title: "Dashboard",
            url: "/professor",
            icon: LayoutDashboard,
          },
          {
            title: "My Courses",
            url: "/professor/courses",
            icon: BookOpen,
          },
          {
            title: "Clubs",
            url: "/professor/clubs",
            icon: Compass,
          },
          {
            title: "Settings",
            url: "/professor/settings",
            icon: Settings,
          },
        ]
      case "STUDENT":
      default:
        return [
          {
            title: "Dashboard",
            url: "/student",
            icon: LayoutDashboard,
          },
          {
            title: "My Courses",
            url: "/student/courses",
            icon: BookOpen,
          },
          {
            title: "Clubs",
            url: "/student/clubs",
            icon: Compass,
          },
          {
            title: "Settings",
            url: "/student/settings",
            icon: Settings,
          },
        ]
    }
  }

  const navItems = getNavItems()

  // Format display role text
  const getRoleLabel = (roleStr: string) => {
    if (roleStr === "ADMIN") return "Admin Portal"
    if (roleStr === "PROFESSOR") return "Professor Desk"
    return "Student Hub"
  }

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      {/* Brand Header */}
      <SidebarHeader className="border-b border-sidebar-border/50 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="hover:bg-transparent">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-primary/10 shadow-md ring-1 ring-border/60 transition-all duration-300 hover:scale-105">
                <OptimoMark />
              </div>
              <div className="ml-2 grid flex-1 text-left leading-tight">
                <span className="font-heading text-lg font-bold tracking-tight text-foreground">
                  Optimo
                </span>
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {getRoleLabel(role)}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Main Sidebar Links */}
      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Menu Options
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-1">
              {navItems.map((item) => {
                const isActive =
                  item.title === "Dashboard"
                    ? pathname === item.url
                    : pathname === item.url ||
                      pathname.startsWith(item.url + "/")
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-primary font-semibold text-primary-foreground shadow-sm shadow-primary/20"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      <Link
                        href={item.url}
                        className="flex w-full items-center gap-3"
                      >
                        <item.icon
                          className={`h-4.5 w-4.5 transition-transform duration-200 ${isActive ? "scale-105" : "group-hover:scale-105"}`}
                        />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Sidebar Footer - Account details */}
      <SidebarFooter className="border-t border-sidebar-border/50 bg-sidebar-accent/10 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="w-full justify-between rounded-xl p-2 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <div className="flex items-center gap-2 text-left">
                    <Avatar className="h-9 w-9 border-2 border-primary/20 shadow-sm">
                      <AvatarImage
                        src={user?.image || undefined}
                        alt={user?.name || "User Avatar"}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="ml-1 grid max-w-30 leading-tight">
                      <span className="truncate text-sm font-bold text-foreground">
                        {user?.name || "Default Account"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email || "user@smartlms.com"}
                      </span>
                    </div>
                  </div>
                  <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/80" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl"
                side="right"
                align="end"
                sideOffset={10}
              >
                <DropdownMenuLabel className="px-2.5 py-2">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm leading-none font-bold text-foreground">
                        {user?.name}
                      </p>
                      <Badge
                        variant="outline"
                        className="border-primary/30 bg-primary/5 px-1.5 py-0 text-[10px] font-bold text-primary uppercase"
                      >
                        {role}
                      </Badge>
                    </div>
                    <p className="truncate text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>My Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span>Upgrade Plan</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <Link href={settingsUrl}>
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span>Account Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/sign-in" })}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
