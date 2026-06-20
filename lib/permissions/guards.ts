import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-guard"
import type { Permission, Resource, Module } from "./types"
import { PermissionService } from "./permissions"

/**
 * Server-side permission guards for route protection
 */

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/sign-in")
  }
  return user
}

export async function requireRole(
  allowedRoles: ("ADMIN" | "PROFESSOR" | "STUDENT")[]
) {
  const user = await requireAuth()
  const userRole = user.role as "ADMIN" | "PROFESSOR" | "STUDENT"

  if (!allowedRoles.includes(userRole)) {
    redirect("/dashboard")
  }

  return user
}

export async function requirePermission(
  permission: Permission,
  resourceId?: string,
  resourceType?: Resource
) {
  const user = await requireAuth()

  const hasPermission = await PermissionService.hasPermission(
    user.id,
    permission,
    resourceId,
    resourceType
  )

  if (!hasPermission) {
    redirect("/dashboard?error=permission_denied")
  }

  return user
}

export async function requireModuleAccess(module: Module) {
  const user = await requireAuth()

  const canAccess = await PermissionService.canAccessModule(user.id, module)

  if (!canAccess) {
    redirect("/dashboard?error=module_access_denied")
  }

  return user
}

export async function requireCourseAccess(
  courseId: string,
  action: "read" | "update" | "delete" | "publish" = "read"
) {
  return requirePermission(
    `courses:${action}` as Permission,
    courseId,
    "course"
  )
}

export async function requireAssignmentAccess(
  assignmentId: string,
  action: "read" | "update" | "delete" | "grade" = "read"
) {
  return requirePermission(
    `assignments:${action}` as Permission,
    assignmentId,
    "assignment"
  )
}

export async function requireQuizAccess(
  quizId: string,
  action: "read" | "update" | "delete" | "grade" = "read"
) {
  return requirePermission(`quizzes:${action}` as Permission, quizId, "quiz")
}

export async function requireClubAccess(
  clubId: string,
  action: "read" | "update" | "delete" | "manage_members" = "read"
) {
  return requirePermission(`clubs:${action}` as Permission, clubId, "club")
}

export async function requireLearningHubAccess(
  hubId: string,
  action: "read" | "update" | "delete" | "manage_groups" = "read"
) {
  return requirePermission(
    `learning_hub:${action}` as Permission,
    hubId,
    "learning_hub"
  )
}

export async function requireFileAccess(
  fileId: string,
  action: "read" | "update" | "delete" | "upload" = "read"
) {
  return requirePermission(`files:${action}` as Permission, fileId, "file")
}

export async function requireUserAccess(
  userId: string,
  action: "read" | "update" | "delete" = "read"
) {
  return requirePermission(`users:${action}` as Permission, userId, "user")
}

export async function requireAnnouncementAccess(
  announcementId: string,
  action: "read" | "update" | "delete" | "publish" = "read"
) {
  return requirePermission(
    `announcements:${action}` as Permission,
    announcementId,
    "announcement"
  )
}

/**
 * AI Management Guards
 */

export async function requireAIAccess(
  action:
    | "read"
    | "configure"
    | "manage_models"
    | "manage_providers"
    | "view_usage"
    | "manage_api_keys"
    | "set_limits"
    | "manage_tones"
    | "custom_instructions" = "read"
) {
  return requirePermission(`ai:${action}` as Permission)
}

export async function requireAIConfiguration() {
  return requirePermission("ai:configure")
}

export async function requireAIModelManagement() {
  return requirePermission("ai:manage_models")
}

export async function requireAIProviderManagement() {
  return requirePermission("ai:manage_providers")
}

export async function requireAICustomInstructions() {
  return requirePermission("ai:custom_instructions")
}

/**
 * Granular Course Guards
 */

export async function requireCourseAnalytics(courseId: string) {
  return requirePermission("courses:view_analytics", courseId, "course")
}

export async function requireCourseStudentEnrollment(courseId: string) {
  return requirePermission("courses:enroll_students", courseId, "course")
}

export async function requireCourseAssignmentManagement(courseId: string) {
  return requirePermission("courses:manage_assignments", courseId, "course")
}

export async function requireCourseQuizManagement(courseId: string) {
  return requirePermission("courses:manage_quizzes", courseId, "course")
}

/**
 * Granular Assignment Guards
 */

export async function requireAssignmentSubmission(assignmentId: string) {
  return requirePermission("assignments:submit", assignmentId, "assignment")
}

export async function requireAssignmentGrading(assignmentId: string) {
  return requirePermission("assignments:grade", assignmentId, "assignment")
}

export async function requireAssignmentViewSubmissions(assignmentId: string) {
  return requirePermission(
    "assignments:view_submissions",
    assignmentId,
    "assignment"
  )
}

/**
 * Granular Quiz Guards
 */

export async function requireQuizTaking(quizId: string) {
  return requirePermission("quizzes:take", quizId, "quiz")
}

export async function requireQuizViewResults(quizId: string) {
  return requirePermission("quizzes:view_results", quizId, "quiz")
}

export async function requireQuizQuestionManagement(quizId: string) {
  return requirePermission("quizzes:manage_questions", quizId, "quiz")
}

/**
 * Granular Club Guards
 */

export async function requireClubEventManagement(clubId: string) {
  return requirePermission("clubs:manage_events", clubId, "club")
}

export async function requireClubResourceManagement(clubId: string) {
  return requirePermission("clubs:manage_resources", clubId, "club")
}

export async function requireClubAnnouncements(clubId: string) {
  return requirePermission("clubs:post_announcements", clubId, "club")
}

/**
 * Granular Learning Hub Guards
 */

export async function requireLearningHubResourceManagement(hubId: string) {
  return requirePermission(
    "learning_hub:manage_resources",
    hubId,
    "learning_hub"
  )
}

export async function requireLearningHubProgressTracking(hubId: string) {
  return requirePermission("learning_hub:track_progress", hubId, "learning_hub")
}

export async function requireLearningHubContentSharing(hubId: string) {
  return requirePermission("learning_hub:share_content", hubId, "learning_hub")
}

/**
 * Settings Guards
 */

export async function requireSettingsManagement(
  action:
    | "read"
    | "update"
    | "manage_profile"
    | "manage_preferences"
    | "manage_notifications"
    | "manage_security" = "read"
) {
  return requirePermission(`settings:${action}` as Permission)
}

export async function requireProfileManagement() {
  return requirePermission("settings:manage_profile")
}

export async function requireNotificationManagement() {
  return requirePermission("settings:manage_notifications")
}

/**
 * Specialized guards for specific route patterns
 */

export async function requireProfessorOrAdmin() {
  return requireRole(["PROFESSOR", "ADMIN"])
}

export async function requireAdminOnly() {
  return requireRole(["ADMIN"])
}

export async function requireStudentOrProfessor() {
  return requireRole(["STUDENT", "PROFESSOR"])
}

/**
 * Context-aware permission checker for components
 */
export async function checkPermission(
  permission: Permission,
  resourceId?: string,
  resourceType?: Resource
): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false

  return PermissionService.hasPermission(
    user.id,
    permission,
    resourceId,
    resourceType
  )
}

export async function checkModuleAccess(module: Module): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false

  return PermissionService.canAccessModule(user.id, module)
}
