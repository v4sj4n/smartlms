"use client"

import * as React from "react"
import {
  PermissionGuard as BasePermissionGuard,
  ModuleGuard as BaseModuleGuard,
  RoleGuard as BaseRoleGuard,
  usePermissions,
} from "@/lib/permissions/hooks"
import type { Permission, Resource, Module } from "@/lib/permissions/types"

// Re-export usePermissions for convenience
export { usePermissions } from "@/lib/permissions/hooks"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Lock, Shield } from "lucide-react"

/**
 * Enhanced permission guard components with user-friendly fallbacks
 */

interface PermissionGuardProps {
  permission: string
  resourceId?: string
  resourceType?: string
  fallback?: React.ReactNode
  children: React.ReactNode
  showAccessDeniedMessage?: boolean
}

export function PermissionGuard({
  permission,
  resourceId,
  resourceType,
  fallback,
  children,
  showAccessDeniedMessage = false,
}: PermissionGuardProps) {
  const defaultFallback = showAccessDeniedMessage ? (
    <Alert className="border-amber-200 bg-amber-50 text-amber-800">
      <Lock className="h-4 w-4" />
      <AlertDescription>
        You don&apos;t have permission to access this feature.
      </AlertDescription>
    </Alert>
  ) : null

  return (
    <BasePermissionGuard
      permission={permission as Permission}
      resourceId={resourceId}
      resourceType={resourceType as Resource}
      fallback={fallback || defaultFallback}
    >
      {children}
    </BasePermissionGuard>
  )
}

interface ModuleGuardProps {
  module: string
  fallback?: React.ReactNode
  children: React.ReactNode
  showAccessDeniedMessage?: boolean
}

export function ModuleGuard({
  module,
  fallback,
  children,
  showAccessDeniedMessage = false,
}: ModuleGuardProps) {
  const defaultFallback = showAccessDeniedMessage ? (
    <Alert className="border-amber-200 bg-amber-50 text-amber-800">
      <Shield className="h-4 w-4" />
      <AlertDescription>
        You don&apos;t have access to the {module} module.
      </AlertDescription>
    </Alert>
  ) : null

  return (
    <BaseModuleGuard
      module={module as Module}
      fallback={fallback || defaultFallback}
    >
      {children}
    </BaseModuleGuard>
  )
}

interface RoleGuardProps {
  roles: ("ADMIN" | "PROFESSOR" | "STUDENT")[]
  fallback?: React.ReactNode
  children: React.ReactNode
  showAccessDeniedMessage?: boolean
}

export function RoleGuard({
  roles,
  fallback,
  children,
  showAccessDeniedMessage = false,
}: RoleGuardProps) {
  const defaultFallback = showAccessDeniedMessage ? (
    <Alert className="border-amber-200 bg-amber-50 text-amber-800">
      <Lock className="h-4 w-4" />
      <AlertDescription>
        This feature is only available to: {roles.join(", ")}.
      </AlertDescription>
    </Alert>
  ) : null

  return (
    <BaseRoleGuard roles={roles} fallback={fallback || defaultFallback}>
      {children}
    </BaseRoleGuard>
  )
}

/**
 * Permission-aware button component
 */
interface PermissionButtonProps {
  permission: string
  children: React.ReactNode
  disabled?: boolean
  className?: string
  onClick?: () => void
  resourceId?: string
  resourceType?: string
  fallback?: React.ReactNode
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

export function PermissionButton({
  permission,
  children,
  disabled,
  className,
  onClick,
  fallback,
  variant = "default",
  size = "default",
}: PermissionButtonProps) {
  const { hasPermission } = usePermissions()

  if (!hasPermission(permission as Permission)) {
    return <>{fallback}</>
  }

  return (
    <button
      className={className}
      disabled={disabled}
      onClick={onClick}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  )
}

/**
 * Permission-aware link component
 */
interface PermissionLinkProps {
  permission: string
  href: string
  children: React.ReactNode
  className?: string
  resourceId?: string
  resourceType?: string
  fallback?: React.ReactNode
}

export function PermissionLink({
  permission,
  href,
  children,
  className,
  fallback,
}: PermissionLinkProps) {
  const { hasPermission } = usePermissions()

  if (!hasPermission(permission as Permission)) {
    return <>{fallback}</>
  }

  return (
    <a href={href} className={className}>
      {children}
    </a>
  )
}

/**
 * Permission status indicator component
 */
export function PermissionStatus() {
  const { user, isAdmin, isProfessor } = usePermissions()

  if (!user) {
    return null
  }

  const getRoleColor = () => {
    if (isAdmin()) return "bg-red-100 text-red-800 border-red-200"
    if (isProfessor()) return "bg-blue-100 text-blue-800 border-blue-200"
    return "bg-green-100 text-green-800 border-green-200"
  }

  const getRoleLabel = () => {
    if (isAdmin()) return "Administrator"
    if (isProfessor()) return "Professor"
    return "Student"
  }

  return (
    <div
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getRoleColor()}`}
    >
      {getRoleLabel()}
    </div>
  )
}
