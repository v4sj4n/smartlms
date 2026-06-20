import { requirePermission, requireModuleAccess } from "./guards"
import { PermissionService } from "./permissions"
import type { Permission, Module } from "./types"

/**
 * Route-specific permission guards for different modules
 * These provide higher-level, context-aware permission checking for specific routes
 */

/**
 * Course Route Guards
 */
export async function requireCourseAccess(
  courseId: string,
  action: "read" | "update" | "delete" | "manage" = "read"
) {
  const permission = `courses:${action}` as Permission
  const user = await requirePermission(permission, courseId, "course")

  // For now, basic permission check is sufficient
  // Additional resource-specific validation can be added later
  return user
}

export async function requireCourseEnrollment(courseId: string) {
  const user = await requirePermission(
    "courses:read" as Permission,
    courseId,
    "course"
  )

  // Students must be enrolled, professors/admins can access any course
  if (user.role === "STUDENT") {
    // TODO: Add enrollment check when database schema is ready
    // For now, permission check is sufficient
  }

  return user
}

export async function requireCourseOwnership(courseId: string) {
  const user = await requirePermission(
    "courses:update" as Permission,
    courseId,
    "course"
  )

  // Only course owners (professors) or admins can manage
  if (user.role !== "ADMIN") {
    // TODO: Add ownership check when database schema is ready
    // For now, permission check is sufficient
  }

  return user
}

/**
 * Club Route Guards
 */
export async function requireClubAccess(
  clubId: string,
  action: "read" | "update" | "delete" | "manage_members" = "read"
) {
  const permission = `clubs:${action}` as Permission
  const user = await requirePermission(permission, clubId, "club")

  // For now, basic permission check is sufficient
  return user
}

export async function requireClubMembership(clubId: string) {
  const user = await requirePermission(
    "clubs:read" as Permission,
    clubId,
    "club"
  )

  // Check if user is a member of the club
  // TODO: Add membership check when database schema is ready
  return user
}

export async function requireClubLeadership(clubId: string) {
  const user = await requirePermission(
    "clubs:manage_members" as Permission,
    clubId,
    "club"
  )

  // Check if user has leadership role in the club
  // TODO: Add leadership check when database schema is ready
  return user
}

/**
 * Assignment Route Guards
 */
export async function requireAssignmentAccess(
  assignmentId: string,
  action: "read" | "update" | "delete" | "grade" = "read"
) {
  const permission = `assignments:${action}` as Permission
  const user = await requirePermission(permission, assignmentId, "assignment")

  // For now, basic permission check is sufficient
  return user
}

export async function requireAssignmentSubmission(assignmentId: string) {
  const user = await requirePermission(
    "assignments:submit" as Permission,
    assignmentId,
    "assignment"
  )

  // Students can only submit their own work
  if (user.role === "STUDENT") {
    // TODO: Add submission access check when database schema is ready
  }

  return user
}

/**
 * Quiz Route Guards
 */
export async function requireQuizAccess(
  quizId: string,
  action: "read" | "update" | "delete" | "grade" = "read"
) {
  const permission = `quizzes:${action}` as Permission
  const user = await requirePermission(permission, quizId, "quiz")

  // For now, basic permission check is sufficient
  return user
}

export async function requireQuizTaking(quizId: string) {
  const user = await requirePermission(
    "quizzes:take" as Permission,
    quizId,
    "quiz"
  )

  // Students can only take quizzes they have access to
  if (user.role === "STUDENT") {
    // TODO: Add quiz taking access check when database schema is ready
  }

  return user
}

/**
 * Learning Hub Route Guards
 */
export async function requireLearningHubAccess(
  hubId: string,
  action: "read" | "update" | "delete" | "manage" = "read"
) {
  const permission = `learning_hub:${action}` as Permission
  const user = await requirePermission(permission, hubId, "learning_hub")

  // For now, basic permission check is sufficient
  return user
}

export async function requireLearningHubOwnership(hubId: string) {
  const user = await requirePermission(
    "learning_hub:update" as Permission,
    hubId,
    "learning_hub"
  )

  // Only hub owners (students) or admins can manage
  if (user.role !== "ADMIN") {
    // TODO: Add ownership check when database schema is ready
  }

  return user
}

/**
 * File Route Guards
 */
export async function requireFileAccess(
  fileId: string,
  action: "read" | "update" | "delete" | "download" = "read"
) {
  const permission = `files:${action}` as Permission
  const user = await requirePermission(permission, fileId, "file")

  // For now, basic permission check is sufficient
  return user
}

/**
 * User Route Guards
 */
export async function requireUserAccess(
  userId: string,
  action: "read" | "update" | "delete" = "read"
) {
  const user = await requirePermission(
    `users:${action}` as Permission,
    userId,
    "user"
  )

  // Users can only update their own profile (except admins)
  if (action === "update" && user.role !== "ADMIN" && user.id !== userId) {
    throw new Error(`Access denied: Cannot update another user's profile`)
  }

  return user
}

/**
 * Module Route Guards (for general module access)
 */
export async function requireModuleRoute(
  module: Module,
  action: "read" | "create" | "update" | "delete" = "read"
) {
  const user = await requireModuleAccess(module)

  // Check specific action permissions
  const permission = `${module}:${action}` as Permission
  const hasActionPermission = await PermissionService.hasPermission(
    user.id,
    permission,
    undefined,
    undefined
  )

  if (!hasActionPermission) {
    throw new Error(`Access denied: Cannot ${action} in ${module} module`)
  }

  return user
}

/**
 * Academic Route Guards
 */
export async function requireAcademicAccess(
  action: "read" | "create" | "update" | "delete" = "read"
) {
  const user = await requirePermission(`academic:${action}` as Permission)
  return user
}

/**
 * AI Route Guards
 */
export async function requireAIAccess(
  action:
    | "read"
    | "configure"
    | "manage_models"
    | "custom_instructions" = "read"
) {
  const user = await requirePermission(`ai:${action}` as Permission)
  return user
}

/**
 * Settings Route Guards
 */
export async function requireSettingsAccess(
  action: "read" | "update" | "manage_profile" | "manage_preferences" = "read"
) {
  const user = await requirePermission(`settings:${action}` as Permission)

  // Users can only manage their own profile/settings
  if (
    (action === "manage_profile" || action === "manage_preferences") &&
    user.role === "ADMIN"
  ) {
    // Admins can manage any settings
    return user
  }

  return user
}

/**
 * Announcement Route Guards
 */
export async function requireAnnouncementAccess(
  announcementId: string,
  action: "read" | "update" | "delete" | "publish" = "read"
) {
  const permission = `announcements:${action}` as Permission
  const user = await requirePermission(
    permission,
    announcementId,
    "announcement"
  )

  // For now, basic permission check is sufficient
  return user
}
