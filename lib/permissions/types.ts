export type UserRole = "ADMIN" | "PROFESSOR" | "STUDENT"

export type Permission =
  // User Management
  | "users:read"
  | "users:create"
  | "users:update"
  | "users:delete"

  // Course Management - Granular
  | "courses:read"
  | "courses:create"
  | "courses:update"
  | "courses:delete"
  | "courses:publish"
  | "courses:enroll_students"
  | "courses:manage_assignments"
  | "courses:manage_quizzes"
  | "courses:manage_files"
  | "courses:view_analytics"
  | "courses:export_data"

  // Course Content Management
  | "course_content:read"
  | "course_content:create"
  | "course_content:update"
  | "course_content:delete"
  | "course_content:publish"
  | "course_content:manage_folders"

  // Assignment Management - Granular
  | "assignments:read"
  | "assignments:create"
  | "assignments:update"
  | "assignments:delete"
  | "assignments:grade"
  | "assignments:submit"
  | "assignments:view_submissions"
  | "assignments:manage_deadlines"
  | "assignments:export_grades"

  // Quiz Management - Granular
  | "quizzes:read"
  | "quizzes:create"
  | "quizzes:update"
  | "quizzes:delete"
  | "quizzes:grade"
  | "quizzes:take"
  | "quizzes:view_results"
  | "quizzes:manage_questions"
  | "quizzes:export_results"

  // Flashcard Management
  | "flashcards:read"
  | "flashcards:create"
  | "flashcards:update"
  | "flashcards:delete"
  | "flashcards:study"
  | "flashcards:share"

  // File Management
  | "files:read"
  | "files:create"
  | "files:update"
  | "files:delete"
  | "files:upload"
  | "files:download"
  | "files:manage_permissions"

  // Club Management - Granular
  | "clubs:read"
  | "clubs:create"
  | "clubs:update"
  | "clubs:delete"
  | "clubs:manage_members"
  | "clubs:manage_events"
  | "clubs:manage_resources"
  | "clubs:post_announcements"
  | "clubs:view_analytics"

  // Learning Hub Management - Granular
  | "learning_hub:read"
  | "learning_hub:create"
  | "learning_hub:update"
  | "learning_hub:delete"
  | "learning_hub:manage_groups"
  | "learning_hub:manage_members"
  | "learning_hub:manage_resources"
  | "learning_hub:share_content"
  | "learning_hub:track_progress"

  // Academic Management
  | "academic:read"
  | "academic:create"
  | "academic:update"
  | "academic:delete"
  | "academic:manage_programs"
  | "academic:manage_semesters"

  // System Management - Granular
  | "system:read"
  | "system:update"
  | "system:manage_settings"
  | "system:view_logs"
  | "system:manage_backups"

  // AI Management - Granular
  | "ai:read"
  | "ai:configure"
  | "ai:manage_models"
  | "ai:manage_providers"
  | "ai:view_usage"
  | "ai:manage_api_keys"
  | "ai:set_limits"
  | "ai:manage_tones"
  | "ai:custom_instructions"

  // Settings Management - Granular
  | "settings:read"
  | "settings:update"
  | "settings:manage_profile"
  | "settings:manage_preferences"
  | "settings:manage_notifications"
  | "settings:manage_security"

  // Announcements
  | "announcements:read"
  | "announcements:create"
  | "announcements:update"
  | "announcements:delete"
  | "announcements:publish"
  | "announcements:target_specific"

export type Resource =
  | "user"
  | "course"
  | "assignment"
  | "quiz"
  | "flashcard"
  | "file"
  | "club"
  | "learning_hub"
  | "announcement"
  | "academic"

export type Module =
  | "dashboard"
  | "courses"
  | "assignments"
  | "quizzes"
  | "flashcards"
  | "files"
  | "clubs"
  | "learning_hub"
  | "academic"
  | "users"
  | "settings"
  | "announcements"
  | "ai"

export interface PermissionRule {
  role: UserRole
  permissions: Permission[]
  moduleAccess: Module[]
}

export interface ResourcePermission {
  resource: Resource
  resourceId?: string
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
    | "configure"
    | "take"
    | "submit"
    | "study"
    | "download"
}

export interface PermissionContext {
  user: {
    id: string
    role: UserRole
  }
  resource?: ResourcePermission
  module?: Module
}
