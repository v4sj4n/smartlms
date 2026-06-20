"use client"

import React from "react"
import { useSession } from "next-auth/react"
import type { Permission, Resource, Module } from "./types"

/**
 * Client-side permission hooks for components
 */

export function usePermissions() {
  const { data: session } = useSession()
  const user = session?.user

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false

    // For client-side, we'll use a simplified role-based check
    // In a real app, you might want to fetch detailed permissions from an API
    const rolePermissions = getRolePermissions(
      user.role as "ADMIN" | "PROFESSOR" | "STUDENT"
    )
    return rolePermissions.includes(permission)
  }

  const canAccessModule = (module: Module): boolean => {
    if (!user) return false

    const roleModules = getRoleModules(
      user.role as "ADMIN" | "PROFESSOR" | "STUDENT"
    )
    return roleModules.includes(module)
  }

  const hasRole = (role: "ADMIN" | "PROFESSOR" | "STUDENT"): boolean => {
    return user?.role === role
  }

  const isAdmin = () => hasRole("ADMIN")
  const isProfessor = () => hasRole("PROFESSOR")
  const isStudent = () => hasRole("STUDENT")

  return {
    user,
    hasPermission,
    canAccessModule,
    hasRole,
    isAdmin,
    isProfessor,
    isStudent,
  }
}

export function usePermission(permission: Permission) {
  const { hasPermission } = usePermissions()
  return hasPermission(permission)
}

export function useModuleAccess(module: Module) {
  const { canAccessModule } = usePermissions()
  return canAccessModule(module)
}

/**
 * Permission wrapper components for conditional rendering
 */

interface PermissionGuardProps {
  permission: Permission
  resourceId?: string
  resourceType?: Resource
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function PermissionGuard({
  permission,
  resourceId,
  resourceType,
  fallback = null,
  children,
}: PermissionGuardProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _resourceId = resourceId
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _resourceType = resourceType
  const { hasPermission } = usePermissions()

  if (!hasPermission(permission)) {
    return fallback
  }

  return children
}

interface ModuleGuardProps {
  module: Module
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function ModuleGuard({
  module,
  fallback = null,
  children,
}: ModuleGuardProps) {
  const { canAccessModule } = usePermissions()

  if (!canAccessModule(module)) {
    return fallback
  }

  return children
}

interface RoleGuardProps {
  roles: ("ADMIN" | "PROFESSOR" | "STUDENT")[]
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function RoleGuard({
  roles,
  fallback = null,
  children,
}: RoleGuardProps) {
  const { hasRole } = usePermissions()

  const hasRequiredRole = roles.some((role) => hasRole(role))

  if (!hasRequiredRole) {
    return fallback
  }

  return children
}

/**
 * Helper functions to get role permissions and modules
 * These should match the server-side rules in rules.ts
 */

function getRolePermissions(
  role: "ADMIN" | "PROFESSOR" | "STUDENT"
): Permission[] {
  switch (role) {
    case "ADMIN":
      return [
        "users:read",
        "users:create",
        "users:update",
        "users:delete",
        "courses:read",
        "courses:create",
        "courses:update",
        "courses:delete",
        "courses:publish",
        "course_content:read",
        "course_content:create",
        "course_content:update",
        "course_content:delete",
        "course_content:publish",
        "assignments:read",
        "assignments:create",
        "assignments:update",
        "assignments:delete",
        "assignments:grade",
        "quizzes:read",
        "quizzes:create",
        "quizzes:update",
        "quizzes:delete",
        "quizzes:grade",
        "flashcards:read",
        "flashcards:create",
        "flashcards:update",
        "flashcards:delete",
        "files:read",
        "files:create",
        "files:update",
        "files:delete",
        "files:upload",
        "clubs:read",
        "clubs:create",
        "clubs:update",
        "clubs:delete",
        "clubs:manage_members",
        "learning_hub:read",
        "learning_hub:create",
        "learning_hub:update",
        "learning_hub:delete",
        "learning_hub:manage_groups",
        "academic:read",
        "academic:create",
        "academic:update",
        "academic:delete",
        "system:read",
        "system:update",
        "ai:configure",
        "announcements:read",
        "announcements:create",
        "announcements:update",
        "announcements:delete",
        "announcements:publish",
      ]
    case "PROFESSOR":
      return [
        "users:read",
        "courses:read",
        "courses:create",
        "courses:update",
        "courses:publish",
        "course_content:read",
        "course_content:create",
        "course_content:update",
        "course_content:publish",
        "assignments:read",
        "assignments:create",
        "assignments:update",
        "assignments:delete",
        "assignments:grade",
        "quizzes:read",
        "quizzes:create",
        "quizzes:update",
        "quizzes:delete",
        "quizzes:grade",
        "flashcards:read",
        "flashcards:create",
        "flashcards:update",
        "flashcards:delete",
        "files:read",
        "files:create",
        "files:update",
        "files:delete",
        "files:upload",
        "clubs:read",
        "clubs:create",
        "clubs:update",
        "clubs:manage_members",
        "learning_hub:read",
        "announcements:read",
        "announcements:create",
        "announcements:update",
        "announcements:publish",
      ]
    case "STUDENT":
      return [
        "users:read",
        "users:update",
        "courses:read",
        "course_content:read",
        "assignments:read",
        "assignments:create",
        "assignments:update",
        "quizzes:read",
        "quizzes:create",
        "flashcards:read",
        "files:read",
        "files:upload",
        "clubs:read",
        "clubs:create",
        "clubs:update",
        "learning_hub:read",
        "learning_hub:create",
        "learning_hub:update",
        "learning_hub:delete",
        "learning_hub:manage_groups",
        "announcements:read",
      ]
    default:
      return []
  }
}

function getRoleModules(role: "ADMIN" | "PROFESSOR" | "STUDENT"): Module[] {
  switch (role) {
    case "ADMIN":
      return [
        "dashboard",
        "courses",
        "assignments",
        "quizzes",
        "flashcards",
        "files",
        "clubs",
        "learning_hub",
        "academic",
        "users",
        "settings",
        "announcements",
      ]
    case "PROFESSOR":
      return [
        "dashboard",
        "courses",
        "assignments",
        "quizzes",
        "flashcards",
        "files",
        "clubs",
        "learning_hub",
        "announcements",
        "settings",
      ]
    case "STUDENT":
      return [
        "dashboard",
        "courses",
        "assignments",
        "quizzes",
        "flashcards",
        "files",
        "clubs",
        "learning_hub",
        "announcements",
        "settings",
      ]
    default:
      return []
  }
}
