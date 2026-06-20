"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  PermissionGuard,
  PermissionButton,
  PermissionLink,
} from "@/components/permission-guard"
import { usePermissions } from "@/lib/permissions/hooks"
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Users,
  Settings,
  BookOpen,
  Plus,
  Eye,
  FileText,
  HelpCircle,
} from "lucide-react"
import Link from "next/link"

interface CourseActionsProps {
  courseId: string
  courseTitle: string
  isTeacher?: boolean
  isEnrolled?: boolean
}

export function CourseActions({
  courseId,
  courseTitle,
  isTeacher = false,
  isEnrolled = false,
}: CourseActionsProps) {
  const { hasPermission } = usePermissions()

  return (
    <div className="flex items-center gap-2">
      {/* View Course - Everyone with course access */}
      <PermissionLink
        permission="courses:read"
        resourceId={courseId}
        resourceType="course"
        href={`/courses/${courseId}`}
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      >
        <Eye className="mr-2 h-4 w-4" />
        View Course
      </PermissionLink>

      {/* Teacher Actions */}
      {isTeacher && (
        <PermissionGuard
          permission="courses:update"
          resourceId={courseId}
          resourceType="course"
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Edit Course */}
              <PermissionButton
                permission="courses:update"
                resourceId={courseId}
                resourceType="course"
                className="w-full justify-start"
                onClick={() => {
                  // Navigate to edit course
                  window.location.href = `/courses/${courseId}/edit`
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Course
              </PermissionButton>

              {/* Course Settings */}
              <PermissionButton
                permission="courses:update"
                resourceId={courseId}
                resourceType="course"
                className="w-full justify-start"
                onClick={() => {
                  // Navigate to course settings
                  window.location.href = `/courses/${courseId}/settings`
                }}
              >
                <Settings className="mr-2 h-4 w-4" />
                Course Settings
              </PermissionButton>

              <DropdownMenuSeparator />

              {/* Manage Content */}
              <PermissionGuard permission="course_content:create">
                <DropdownMenuItem asChild>
                  <Link
                    href={`/courses/${courseId}/content/new`}
                    className="flex items-center"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Content
                  </Link>
                </DropdownMenuItem>
              </PermissionGuard>

              {/* Manage Assignments */}
              <PermissionGuard permission="assignments:create">
                <DropdownMenuItem asChild>
                  <Link
                    href={`/courses/${courseId}/assignments/new`}
                    className="flex items-center"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Create Assignment
                  </Link>
                </DropdownMenuItem>
              </PermissionGuard>

              {/* Manage Quizzes */}
              <PermissionGuard permission="quizzes:create">
                <DropdownMenuItem asChild>
                  <Link
                    href={`/courses/${courseId}/quizzes/new`}
                    className="flex items-center"
                  >
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Create Quiz
                  </Link>
                </DropdownMenuItem>
              </PermissionGuard>

              {/* Manage Students */}
              <PermissionGuard permission="users:read">
                <DropdownMenuItem asChild>
                  <Link
                    href={`/courses/${courseId}/students`}
                    className="flex items-center"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Manage Students
                  </Link>
                </DropdownMenuItem>
              </PermissionGuard>

              <DropdownMenuSeparator />

              {/* Delete Course - Admin only or course owner */}
              <PermissionButton
                permission="courses:delete"
                resourceId={courseId}
                resourceType="course"
                className="w-full justify-start text-destructive focus:text-destructive"
                onClick={() => {
                  if (
                    confirm(`Are you sure you want to delete "${courseTitle}"?`)
                  ) {
                    // Delete course logic
                    console.log("Deleting course:", courseId)
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Course
              </PermissionButton>
            </DropdownMenuContent>
          </DropdownMenu>
        </PermissionGuard>
      )}

      {/* Student Actions */}
      {isEnrolled && !isTeacher && (
        <PermissionGuard permission="assignments:create">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/courses/${courseId}/assignments`}>
              <FileText className="mr-2 h-4 w-4" />
              Assignments
            </Link>
          </Button>
        </PermissionGuard>
      )}

      {/* Enroll/Join Course */}
      {!isEnrolled && !isTeacher && (
        <PermissionGuard permission="courses:read">
          <Button variant="outline" size="sm">
            <BookOpen className="mr-2 h-4 w-4" />
            Join Course
          </Button>
        </PermissionGuard>
      )}
    </div>
  )
}

/**
 * Course Card with Permission-based Actions
 */
export function CourseCardWithActions({
  course,
  isTeacher = false,
  isEnrolled = false,
}: {
  course: {
    id: string
    title: string
    description?: string
    semester?: string
    teacherName?: string
  }
  isTeacher?: boolean
  isEnrolled?: boolean
}) {
  const { canAccessModule } = usePermissions()

  if (!canAccessModule("courses")) {
    return null
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-lg font-semibold">{course.title}</h3>
        <p className="text-sm text-muted-foreground">{course.description}</p>
        {course.semester && (
          <p className="mt-1 text-xs text-muted-foreground">
            {course.semester} Semester
          </p>
        )}
        {course.teacherName && (
          <p className="text-xs text-muted-foreground">
            Instructor: {course.teacherName}
          </p>
        )}
      </div>

      <CourseActions
        courseId={course.id}
        courseTitle={course.title}
        isTeacher={isTeacher}
        isEnrolled={isEnrolled}
      />
    </div>
  )
}
