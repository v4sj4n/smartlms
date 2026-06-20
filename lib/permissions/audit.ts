"use server"

/**
 * Permission Audit System
 *
 * This module provides comprehensive permission auditing capabilities
 * to ensure all routes and actions have proper authorization checks.
 */

import { db } from "@/db"
import { PermissionService, requirePermission } from "./permissions"
import type { Permission, Resource, UserRole } from "./types"

// ============================================================================
// AUDIT RESULT TYPES
// ============================================================================

export type PermissionCheckResult = {
  path: string
  hasCheck: boolean
  requiredRole?: UserRole[]
  requiredPermission?: Permission
  issues: string[]
}

export type AuditReport = {
  timestamp: Date
  totalRoutes: number
  checkedRoutes: number
  issues: PermissionCheckResult[]
  summary: {
    critical: number
    warning: number
    info: number
  }
}

export type RoutePermission = {
  path: string
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  requiredRoles: UserRole[]
  resourceType?: Resource
  resourceIdParam?: string
  description: string
}

// ============================================================================
// DEFINED ROUTE PERMISSIONS
// This documents all API routes and their required permissions
// ============================================================================

export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // Admin Routes - Full Access
  {
    path: "/api/schedules/generate",
    method: "POST",
    requiredRoles: ["ADMIN"],
    description: "Generate schedule",
  },
  {
    path: "/api/schedules/validate",
    method: "GET",
    requiredRoles: ["ADMIN", "PROFESSOR"],
    description: "Validate schedule",
  },
  {
    path: "/api/schedules/apply",
    method: "POST",
    requiredRoles: ["ADMIN"],
    description: "Apply generated schedule",
  },

  // Academic Structure - Admin Only
  {
    path: "/api/academic/groups",
    method: "POST",
    requiredRoles: ["ADMIN"],
    description: "Create student group",
  },
  {
    path: "/api/academic/groups",
    method: "PUT",
    requiredRoles: ["ADMIN"],
    description: "Update student group",
  },
  {
    path: "/api/academic/groups",
    method: "DELETE",
    requiredRoles: ["ADMIN"],
    description: "Delete student group",
  },
  {
    path: "/api/academic/assignments",
    method: "POST",
    requiredRoles: ["ADMIN"],
    description: "Create subject assignment",
  },
  {
    path: "/api/academic/assignments",
    method: "DELETE",
    requiredRoles: ["ADMIN"],
    description: "Delete subject assignment",
  },

  // Professor Availability - Self or Admin
  {
    path: "/api/professors/availability",
    method: "GET",
    requiredRoles: ["PROFESSOR", "ADMIN"],
    description: "Get professor availability",
  },
  {
    path: "/api/professors/availability",
    method: "PUT",
    requiredRoles: ["PROFESSOR", "ADMIN"],
    description: "Update professor availability",
  },

  // Schedule Viewing - Role Based
  {
    path: "/api/schedules/student",
    method: "GET",
    requiredRoles: ["STUDENT"],
    description: "Get student schedule",
  },
  {
    path: "/api/schedules/professor",
    method: "GET",
    requiredRoles: ["PROFESSOR"],
    description: "Get professor schedule",
  },
  {
    path: "/api/schedules/group",
    method: "GET",
    requiredRoles: ["ADMIN", "PROFESSOR", "STUDENT"],
    description: "Get group schedule",
  },
]

// ============================================================================
// AUDIT FUNCTIONS
// ============================================================================

/**
 * Check if a user has access to a specific resource
 */
export async function auditResourceAccess(
  userId: string,
  resourceType: Resource,
  resourceId: string,
  action: "read" | "create" | "update" | "delete"
): Promise<{
  allowed: boolean
  userRole: UserRole | null
  issues: string[]
}> {
  const issues: string[] = []

  try {
    // Get user role
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
      columns: { role: true },
    })

    if (!user) {
      return { allowed: false, userRole: null, issues: ["User not found"] }
    }

    const userRole = user.role as UserRole

    // Check if user has permission
    const hasAccess = await PermissionService.canAccessResource(
      userId,
      resourceType,
      resourceId,
      action
    )

    if (!hasAccess) {
      issues.push(`User with role ${userRole} cannot ${action} ${resourceType}`)
    }

    return {
      allowed: hasAccess,
      userRole,
      issues,
    }
  } catch (error) {
    return {
      allowed: false,
      userRole: null,
      issues: [
        `Error checking permissions: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
    }
  }
}

/**
 * Audit a specific API route
 */
export async function auditRoute(
  route: RoutePermission
): Promise<PermissionCheckResult> {
  const issues: string[] = []

  // Check if route has required roles defined
  if (route.requiredRoles.length === 0) {
    issues.push("No required roles defined for this route")
  }

  // Check if resource-based permissions are defined where needed
  if (route.path.includes("/api/") && !route.resourceType) {
    // API routes that modify data should have resource permissions
    if (["POST", "PUT", "DELETE", "PATCH"].includes(route.method)) {
      issues.push("Modifying API route should have resourceType defined")
    }
  }

  return {
    path: `${route.method} ${route.path}`,
    hasCheck: route.requiredRoles.length > 0,
    requiredRole: route.requiredRoles,
    issues,
  }
}

/**
 * Run full permission audit
 */
export async function runPermissionAudit(): Promise<AuditReport> {
  const results: PermissionCheckResult[] = []
  let critical = 0
  let warning = 0
  let info = 0

  for (const route of ROUTE_PERMISSIONS) {
    const result = await auditRoute(route)
    results.push(result)

    // Count issues by severity
    for (const issue of result.issues) {
      if (issue.includes("No required roles")) {
        critical++
      } else if (issue.includes("should have resourceType")) {
        warning++
      } else {
        info++
      }
    }
  }

  return {
    timestamp: new Date(),
    totalRoutes: ROUTE_PERMISSIONS.length,
    checkedRoutes: results.length,
    issues: results.filter((r) => r.issues.length > 0),
    summary: { critical, warning, info },
  }
}

/**
 * Generate permission audit report as markdown
 */
export function generateAuditReportMarkdown(report: AuditReport): string {
  const lines = [
    "# Permission Audit Report",
    "",
    `**Generated:** ${report.timestamp.toISOString()}`,
    "",
    "## Summary",
    "",
    `- **Total Routes:** ${report.totalRoutes}`,
    `- **Checked Routes:** ${report.checkedRoutes}`,
    `- **Critical Issues:** ${report.summary.critical} 🔴`,
    `- **Warnings:** ${report.summary.warning} 🟡`,
    `- **Info:** ${report.summary.info} 🔵`,
    "",
    "## Issues Found",
    "",
  ]

  if (report.issues.length === 0) {
    lines.push("✅ No issues found! All routes have proper permission checks.")
  } else {
    for (const issue of report.issues) {
      lines.push(`### ${issue.path}`)
      lines.push("")
      for (const detail of issue.issues) {
        const emoji = detail.includes("No required roles")
          ? "🔴"
          : detail.includes("should have")
            ? "🟡"
            : "🔵"
        lines.push(`- ${emoji} ${detail}`)
      }
      lines.push("")
    }
  }

  lines.push("---")
  lines.push("")
  lines.push("## Route Permissions Reference")
  lines.push("")
  lines.push("| Route | Method | Required Roles | Resource | Description |")
  lines.push("|-------|--------|----------------|----------|-------------|")

  for (const route of ROUTE_PERMISSIONS) {
    const roles = route.requiredRoles.join(", ")
    const resource = route.resourceType || "-"
    lines.push(
      `| \`${route.path}\` | ${route.method} | ${roles} | ${resource} | ${route.description} |`
    )
  }

  return lines.join("\n")
}

// ============================================================================
// ENFORCEMENT HELPERS
// ============================================================================

/**
 * Middleware helper to enforce route permissions
 * Use this in API routes to standardize permission checking
 */
export async function enforceRoutePermission(
  userId: string,
  requiredRoles: UserRole[],
  resourceType?: Resource,
  resourceId?: string,
  action: "read" | "create" | "update" | "delete" = "read"
): Promise<{ allowed: boolean; error?: string }> {
  try {
    // Check user role
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
      columns: { role: true },
    })

    if (!user) {
      return { allowed: false, error: "User not found" }
    }

    const userRole = user.role as UserRole

    if (!requiredRoles.includes(userRole)) {
      return {
        allowed: false,
        error: `Access denied. Required roles: ${requiredRoles.join(", ")}. User role: ${userRole}`,
      }
    }

    // If resource checking is needed
    if (resourceType && resourceId) {
      const hasResourceAccess = await PermissionService.canAccessResource(
        userId,
        resourceType,
        resourceId,
        action
      )

      if (!hasResourceAccess) {
        return {
          allowed: false,
          error: `Access denied to ${resourceType} resource`,
        }
      }
    }

    return { allowed: true }
  } catch (error) {
    return {
      allowed: false,
      error: `Permission check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}
