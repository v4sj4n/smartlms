"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Image from "next/image"
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
import { getUserDisplayName } from "@/lib/display-name"

export function AppSidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()

  const user = session?.user
  const role = user?.role ?? "STUDENT"
  const displayName = getUserDisplayName(user)
  const settingsUrl =
    role === "PROFESSOR"
      ? "/professor/settings"
      : role === "STUDENT"
        ? "/student/settings"
        : "/admin/settings"

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
          {
            title: "Settings",
            url: "/admin/settings",
            icon: Settings,
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
            <SidebarMenuButton
              size="lg"
              aria-label="Optimo"
              className="justify-start gap-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:px-0! hover:bg-transparent"
            >
              <div className="flex aspect-square size-10 items-center justify-center overflow-hidden rounded-xl bg-background shadow-md ring-1 ring-border/60 transition-transform duration-200 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:shadow-none">
                <Image
                  src="/optimo-logo.svg"
                  alt="Optimo logo"
                  width={40}
                  height={40}
                  className="h-full w-full object-contain p-1 transition-[filter] dark:invert"
                  priority
                />
              </div>
              <div className="ml-2 grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
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
                  className="w-full justify-between rounded-xl p-2 transition-all duration-200 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <div className="flex items-center gap-2 text-left group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:gap-0">
                    <Avatar className="h-9 w-9 border-2 border-primary/20 shadow-sm group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:shadow-none">
                      <AvatarImage
                        src={user?.image || undefined}
                        alt={displayName || "User Avatar"}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="ml-1 grid max-w-30 leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate text-sm font-bold text-foreground">
                        {displayName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email || "user@smartlms.com"}
                      </span>
                    </div>
                  </div>
                  <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/80 group-data-[collapsible=icon]:hidden" />
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
