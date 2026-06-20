import type { PermissionRule, UserRole, Permission, Module } from "./types"

export const PERMISSION_RULES: Record<UserRole, PermissionRule> = {
  ADMIN: {
    role: "ADMIN",
    permissions: [
      // User Management
      "users:read",
      "users:create",
      "users:update",
      "users:delete",

      // Course Management - Full Access
      "courses:read",
      "courses:create",
      "courses:update",
      "courses:delete",
      "courses:publish",
      "courses:enroll_students",
      "courses:manage_assignments",
      "courses:manage_quizzes",
      "courses:manage_files",
      "courses:view_analytics",
      "courses:export_data",

      // Course Content Management
      "course_content:read",
      "course_content:create",
      "course_content:update",
      "course_content:delete",
      "course_content:publish",
      "course_content:manage_folders",

      // Assignment Management
      "assignments:read",
      "assignments:create",
      "assignments:update",
      "assignments:delete",
      "assignments:grade",
      "assignments:submit",
      "assignments:view_submissions",
      "assignments:manage_deadlines",
      "assignments:export_grades",

      // Quiz Management
      "quizzes:read",
      "quizzes:create",
      "quizzes:update",
      "quizzes:delete",
      "quizzes:grade",
      "quizzes:take",
      "quizzes:view_results",
      "quizzes:manage_questions",
      "quizzes:export_results",

      // Flashcard Management
      "flashcards:read",
      "flashcards:create",
      "flashcards:update",
      "flashcards:delete",
      "flashcards:study",
      "flashcards:share",

      // File Management
      "files:read",
      "files:create",
      "files:update",
      "files:delete",
      "files:upload",
      "files:download",
      "files:manage_permissions",

      // Club Management
      "clubs:read",
      "clubs:create",
      "clubs:update",
      "clubs:delete",
      "clubs:manage_members",
      "clubs:manage_events",
      "clubs:manage_resources",
      "clubs:post_announcements",
      "clubs:view_analytics",

      // Learning Hub Management
      "learning_hub:read",
      "learning_hub:create",
      "learning_hub:update",
      "learning_hub:delete",
      "learning_hub:manage_groups",
      "learning_hub:manage_members",
      "learning_hub:manage_resources",
      "learning_hub:share_content",
      "learning_hub:track_progress",

      // Academic Management
      "academic:read",
      "academic:create",
      "academic:update",
      "academic:delete",
      "academic:manage_programs",
      "academic:manage_semesters",

      // System Management
      "system:read",
      "system:update",
      "system:manage_settings",
      "system:view_logs",
      "system:manage_backups",

      // AI Management - Full Access
      "ai:read",
      "ai:configure",
      "ai:manage_models",
      "ai:manage_providers",
      "ai:view_usage",
      "ai:manage_api_keys",
      "ai:set_limits",
      "ai:manage_tones",
      "ai:custom_instructions",

      // Settings Management
      "settings:read",
      "settings:update",
      "settings:manage_profile",
      "settings:manage_preferences",
      "settings:manage_notifications",
      "settings:manage_security",

      // Announcements
      "announcements:read",
      "announcements:create",
      "announcements:update",
      "announcements:delete",
      "announcements:publish",
      "announcements:target_specific",
    ],
    moduleAccess: [
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
      "ai",
    ],
  },
  PROFESSOR: {
    role: "PROFESSOR",
    permissions: [
      // Limited User Management
      "users:read",

      // Course Management (own courses)
      "courses:read",
      "courses:create",
      "courses:update",
      "courses:publish",
      "courses:enroll_students",
      "courses:manage_assignments",
      "courses:manage_quizzes",
      "courses:manage_files",
      "courses:view_analytics",

      // Course Content Management (own courses)
      "course_content:read",
      "course_content:create",
      "course_content:update",
      "course_content:publish",
      "course_content:manage_folders",

      // Assignment Management (own courses)
      "assignments:read",
      "assignments:create",
      "assignments:update",
      "assignments:delete",
      "assignments:grade",
      "assignments:view_submissions",
      "assignments:manage_deadlines",
      "assignments:export_grades",

      // Quiz Management (own courses)
      "quizzes:read",
      "quizzes:create",
      "quizzes:update",
      "quizzes:delete",
      "quizzes:grade",
      "quizzes:view_results",
      "quizzes:manage_questions",
      "quizzes:export_results",

      // Flashcard Management (own courses)
      "flashcards:read",
      "flashcards:create",
      "flashcards:update",
      "flashcards:delete",
      "flashcards:share",

      // File Management
      "files:read",
      "files:create",
      "files:update",
      "files:delete",
      "files:upload",
      "files:download",

      // Club Management
      "clubs:read",
      "clubs:create",
      "clubs:update",
      "clubs:manage_members",
      "clubs:manage_events",
      "clubs:manage_resources",
      "clubs:post_announcements",

      // Learning Hub Management (limited)
      "learning_hub:read",

      // Settings Management
      "settings:read",
      "settings:update",
      "settings:manage_profile",
      "settings:manage_preferences",
      "settings:manage_notifications",

      // Announcements (own courses)
      "announcements:read",
      "announcements:create",
      "announcements:update",
      "announcements:publish",

      // Limited AI Access
      "ai:read",
      "ai:custom_instructions",
    ],
    moduleAccess: [
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
    ],
  },
  STUDENT: {
    role: "STUDENT",
    permissions: [
      // User Management (own profile)
      "users:read",
      "users:update",

      // Course Management (enrolled courses)
      "courses:read",

      // Course Content Management (enrolled courses)
      "course_content:read",

      // Assignment Management (submissions)
      "assignments:read",
      "assignments:create",
      "assignments:update",
      "assignments:submit",

      // Quiz Management (taking quizzes)
      "quizzes:read",
      "quizzes:create",
      "quizzes:take",
      "quizzes:view_results",

      // Flashcard Management
      "flashcards:read",
      "flashcards:study",

      // File Management
      "files:read",
      "files:upload",
      "files:download",

      // Club Management
      "clubs:read",
      "clubs:create",
      "clubs:update",

      // Learning Hub Management (own hub)
      "learning_hub:read",
      "learning_hub:create",
      "learning_hub:update",
      "learning_hub:delete",
      "learning_hub:manage_groups",
      "learning_hub:manage_members",
      "learning_hub:manage_resources",
      "learning_hub:share_content",
      "learning_hub:track_progress",

      // Settings Management (own settings)
      "settings:read",
      "settings:update",
      "settings:manage_profile",
      "settings:manage_preferences",
      "settings:manage_notifications",
      "settings:manage_security",

      // Announcements (read-only)
      "announcements:read",

      // Limited AI Access
      "ai:custom_instructions",
    ],
    moduleAccess: [
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
    ],
  },
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  STUDENT: 1,
  PROFESSOR: 2,
  ADMIN: 3,
}

export function canAccessModule(role: UserRole, module: Module): boolean {
  return PERMISSION_RULES[role]?.moduleAccess.includes(module) || false
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return PERMISSION_RULES[role]?.permissions.includes(permission) || false
}

export function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY[role] || 0
}

export function hasHigherOrEqualRole(
  userRole: UserRole,
  targetRole: UserRole
): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(targetRole)
}
