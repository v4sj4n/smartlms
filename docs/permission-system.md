# Permission System Documentation

## Overview

The SmartLMS now features a comprehensive permission and module-based access control system that replaces the basic role-based checks throughout the application. This system provides fine-grained control over what users can access and do within the platform.

## Architecture

### Core Components

1. **Types** (`lib/permissions/types.ts`)
   - Defines all permission types, resources, modules, and user roles
   - Establishes the data structures for permission checking

2. **Rules** (`lib/permissions/rules.ts`)
   - Contains permission rules for each user role
   - Defines role hierarchy and module access
   - Provides helper functions for permission checking

3. **Permission Service** (`lib/permissions/permissions.ts`)
   - Core permission checking logic
   - Handles resource-specific permissions (ownership, enrollment, etc.)
   - Provides server-side permission validation

4. **Guards** (`lib/permissions/guards.ts`)
   - Server-side route protection functions
   - Middleware for protecting routes and API endpoints
   - Specialized guards for different resource types

5. **Hooks** (`lib/permissions/hooks.ts`)
   - Client-side permission checking for React components
   - Permission wrapper components for conditional rendering
   - Role-based access hooks

## User Roles and Permissions

### ADMIN
- **Full system access** - Can manage all aspects of the platform
- **User management** - Create, update, delete users
- **Course management** - Full control over all courses
- **System administration** - Manage settings, AI configurations
- **Academic management** - Manage school years, programs, semesters

### PROFESSOR
- **Course management** - Create and manage their assigned courses
- **Content creation** - Create assignments, quizzes, flashcards for their courses
- **Student assessment** - Grade assignments and quizzes
- **Club management** - Create and manage clubs they're involved with
- **Limited user access** - Can view student information for their courses

### STUDENT
- **Course access** - View enrolled courses and content
- **Assignment submission** - Submit and view their assignments
- **Quiz participation** - Take quizzes and view their results
- **Learning hub** - Personal learning space management
- **Club participation** - Join and participate in clubs
- **File uploads** - Upload files for assignments and club activities

## Modules

The system is organized into the following modules:

- **dashboard** - Main dashboard access
- **courses** - Course management and access
- **assignments** - Assignment creation and submission
- **quizzes** - Quiz creation and taking
- **flashcards** - Flashcard creation and study
- **files** - File management and uploads
- **clubs** - Club management and participation
- **learning_hub** - Personal learning spaces
- **academic** - Academic structure management (Admin only)
- **users** - User management (Admin only)
- **settings** - User and system settings
- **announcements** - Announcement creation and viewing

## Usage Examples

### Server-side Route Protection

```typescript
// Protect a route requiring course access
export default async function CoursePage({ params }: { params: { id: string } }) {
  const user = await requireModuleAccess("courses")
  // or for specific course access
  const user = await requireCourseAccess(params.id, "read")
  
  // Your page logic here
}
```

### Permission-based Actions

```typescript
// In server actions
"use server"

import { requirePermission } from "@/lib/permissions/guards"

export async function deleteCourse(courseId: string) {
  await requirePermission("courses:delete", courseId, "course")
  
  // Delete logic here
}
```

### Client-side Permission Components

```typescript
// Using permission guards in components
import { PermissionGuard, RoleGuard } from "@/components/permission-guard"

function CourseActions({ courseId }: { courseId: string }) {
  return (
    <PermissionGuard permission="courses:update" resourceId={courseId} resourceType="course">
      <button>Edit Course</button>
    </PermissionGuard>
  )
}

// Role-based rendering
function AdminPanel() {
  return (
    <RoleGuard roles={["ADMIN"]}>
      <div>Admin-only content</div>
    </RoleGuard>
  )
}
```

### Client-side Permission Hooks

```typescript
import { usePermissions } from "@/lib/permissions/hooks"

function CourseCard({ course }: { course: Course }) {
  const { hasPermission, canAccessModule } = usePermissions()
  
  const canEdit = hasPermission("courses:update")
  const canViewDetails = canAccessModule("courses")
  
  return (
    <div>
      {canViewDetails && <CourseDetails course={course} />}
      {canEdit && <EditButton courseId={course.id} />}
    </div>
  )
}
```

## Migration Guide

### From Old Role Checks

**Before:**
```typescript
const user = await requireRole(["PROFESSOR", "ADMIN"])
```

**After:**
```typescript
const user = await requireModuleAccess("courses")
// or for specific permissions
const user = await requirePermission("courses:create")
```

### Updating Components

1. Replace role-based checks with permission-based checks
2. Use permission guards for conditional rendering
3. Implement resource-specific permission checking where needed

### Best Practices

1. **Use the most specific permission possible** - Instead of checking for a role, check for the specific action
2. **Implement resource-level permissions** - Check if user can access specific resources, not just the module
3. **Use permission guards in UI** - Hide or disable features users can't access
4. **Validate permissions on the server** - Never trust client-side permission checks alone
5. **Plan for future permissions** - Design your permission checks to be easily extensible

## Resource-Specific Permissions

The system supports resource-level permission checking for:

- **Courses** - Ownership and enrollment-based access
- **Clubs** - Membership and role-based access
- **Learning Hubs** - Ownership and supervision access
- **Files** - Context-based access (course, club, etc.)
- **Users** - Self-management and admin access

## Testing

To test the permission system:

1. **Create test users** for each role
2. **Test route protection** - Try accessing restricted routes
3. **Test component permissions** - Verify UI elements show/hide correctly
4. **Test resource permissions** - Verify users can only access their resources
5. **Test permission escalation** - Ensure higher roles can access lower role permissions

## Future Enhancements

The permission system is designed to be extensible:

1. **Custom roles** - Add new user roles beyond the basic three
2. **Fine-grained permissions** - Add more specific permissions as needed
3. **Permission groups** - Group permissions for easier management
4. **Time-based permissions** - Add temporary access controls
5. **Audit logging** - Track permission usage and violations
