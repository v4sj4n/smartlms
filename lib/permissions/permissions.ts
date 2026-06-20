import { db } from "@/db"
import {
  users,
  courses,
  clubMembers,
  courseEnrollments,
  learningHubs,
} from "@/db/schema"
import { eq, and } from "drizzle-orm"
import type { UserRole, Permission, Resource, Module } from "./types"
import { hasPermission as hasRolePermission, canAccessModule } from "./rules"

export class PermissionService {
  /**
   * Check if a user has a specific permission
   */
  static async hasPermission(
    userId: string,
    permission: Permission,
    resourceId?: string,
    resourceType?: Resource
  ): Promise<boolean> {
    // Get user with role
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    })

    if (!user) return false

    const role = user.role as UserRole

    // Check role-based permission
    if (!hasRolePermission(role, permission)) {
      return false
    }

    // If no resource context, permission is granted based on role
    if (!resourceId || !resourceType) {
      return true
    }

    // Check resource-specific permissions
    return this.checkResourcePermission(
      userId,
      role,
      resourceType,
      resourceId,
      permission
    )
  }

  /**
   * Check if a user can access a specific module
   */
  static async canAccessModule(
    userId: string,
    module: Module
  ): Promise<boolean> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    })

    if (!user) return false

    return canAccessModule(user.role as UserRole, module)
  }

  /**
   * Check if user can access a specific resource
   */
  static async canAccessResource(
    userId: string,
    resourceType: Resource,
    resourceId: string,
    action:
      | "read"
      | "create"
      | "update"
      | "delete"
      | "publish"
      | "grade"
      | "manage_members"
      | "manage_groups"
      | "upload"
      | "manage_ai"
  ): Promise<boolean> {
    const permission = `${resourceType}:${action}` as Permission
    return this.hasPermission(userId, permission, resourceId, resourceType)
  }

  /**
   * Get all permissions for a user
   */
  static async getUserPermissions(userId: string): Promise<{
    role: UserRole
    permissions: Permission[]
    moduleAccess: Module[]
  }> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    })

    if (!user) {
      return {
        role: "STUDENT",
        permissions: [],
        moduleAccess: [],
      }
    }

    const role = user.role as UserRole

    // Import rules dynamically to avoid circular dependencies
    const { PERMISSION_RULES } = await import("./rules")

    return PERMISSION_RULES[role]
  }

  /**
   * Check resource-specific permissions (ownership, enrollment, etc.)
   */
  private static async checkResourcePermission(
    userId: string,
    role: UserRole,
    resourceType: Resource,
    resourceId: string,
    permission: Permission
  ): Promise<boolean> {
    switch (resourceType) {
      case "course":
        return this.checkCoursePermission(userId, role, resourceId, permission)
      case "assignment":
        return this.checkAssignmentPermission(
          userId,
          role,
          resourceId,
          permission
        )
      case "quiz":
        return this.checkQuizPermission(userId, role, resourceId, permission)
      case "club":
        return this.checkClubPermission(userId, role, resourceId, permission)
      case "learning_hub":
        return this.checkLearningHubPermission(
          userId,
          role,
          resourceId,
          permission
        )
      case "file":
        return this.checkFilePermission(userId, role, resourceId, permission)
      case "user":
        return this.checkUserPermission(userId, role, resourceId, permission)
      default:
        // For other resources, rely on role-based permissions
        return true
    }
  }

  private static async checkCoursePermission(
    userId: string,
    role: UserRole,
    courseId: string,
    permission: Permission
  ): Promise<boolean> {
    const course = await db.query.courses.findFirst({
      where: eq(courses.id, courseId),
      columns: { teacherId: true },
    })

    if (!course) return false

    // Admin can access any course
    if (role === "ADMIN") return true

    // Professor can access their own courses
    if (role === "PROFESSOR" && course.teacherId === userId) return true

    // Students can read enrolled courses
    if (role === "STUDENT" && permission === "courses:read") {
      const enrollment = await db.query.courseEnrollments.findFirst({
        where: and(
          eq(courseEnrollments.studentId, userId),
          eq(courseEnrollments.courseId, courseId)
        ),
      })
      return !!enrollment
    }

    return false
  }

  private static async checkAssignmentPermission(
    userId: string,
    role: UserRole,
    _assignmentId: string,
    _permission: Permission
  ): Promise<boolean> {
    // For now, simplify assignment permission checking
    // In a full implementation, you'd query the assignment and check course ownership
    return role === "ADMIN" || role === "PROFESSOR"
  }

  private static async checkQuizPermission(
    userId: string,
    role: UserRole,
    _quizId: string,
    _permission: Permission
  ): Promise<boolean> {
    // For now, simplify quiz permission checking
    // In a full implementation, you'd query the quiz and check course ownership
    return role === "ADMIN" || role === "PROFESSOR"
  }

  private static async checkClubPermission(
    userId: string,
    role: UserRole,
    clubId: string,
    permission: Permission
  ): Promise<boolean> {
    const membership = await db.query.clubMembers.findFirst({
      where: eq(clubMembers.clubId, clubId),
      with: {
        user: {
          columns: { role: true },
        },
      },
    })

    if (!membership) return false

    // Admin can manage any club
    if (role === "ADMIN") return true

    // Check if user is a member
    const userMembership = await db.query.clubMembers.findFirst({
      where: and(
        eq(clubMembers.clubId, clubId),
        eq(clubMembers.userId, userId)
      ),
      columns: { role: true },
    })

    if (!userMembership) return false

    // Club leaders and advisors can manage
    if (["LEADER", "ADVISOR"].includes(userMembership.role)) {
      return true
    }

    // Regular members have limited permissions
    return ["clubs:read", "clubs:update"].includes(permission)
  }

  private static async checkLearningHubPermission(
    userId: string,
    role: UserRole,
    hubId: string,
    permission: Permission
  ): Promise<boolean> {
    const hub = await db.query.learningHubs.findFirst({
      where: eq(learningHubs.id, hubId),
      columns: { studentId: true },
    })

    if (!hub) return false

    // Admin can access any learning hub
    if (role === "ADMIN") return true

    // Students can only access their own learning hub
    if (role === "STUDENT" && hub.studentId === userId) return true

    // Professors have read access for supervision
    if (role === "PROFESSOR" && permission === "learning_hub:read") return true

    return false
  }

  private static async checkFilePermission(
    userId: string,
    role: UserRole,
    _fileId: string,
    _permission: Permission
  ): Promise<boolean> {
    // For now, simplify file permission checking
    // In a full implementation, you'd check file ownership and course/club context
    return role === "ADMIN" || role === "PROFESSOR"
  }

  private static async checkUserPermission(
    userId: string,
    role: UserRole,
    targetUserId: string,
    permission: Permission
  ): Promise<boolean> {
    // Admin can manage any user
    if (role === "ADMIN") return true

    // Users can manage their own profile
    if (userId === targetUserId) {
      return ["users:read", "users:update"].includes(permission)
    }

    return false
  }
}

/**
 * Server-side permission checker functions
 */
export async function requirePermission(
  userId: string,
  permission: Permission,
  resourceId?: string,
  resourceType?: Resource
): Promise<boolean> {
  const hasPermission = await PermissionService.hasPermission(
    userId,
    permission,
    resourceId,
    resourceType
  )
  if (!hasPermission) {
    throw new Error(`Permission denied: ${permission}`)
  }
  return true
}

export async function requireModuleAccess(
  userId: string,
  module: Module
): Promise<boolean> {
  const canAccess = await PermissionService.canAccessModule(userId, module)
  if (!canAccess) {
    throw new Error(`Access denied to module: ${module}`)
  }
  return true
}
