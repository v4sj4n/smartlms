"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  PermissionGuard,
  PermissionButton,
  usePermissions,
} from "@/components/permission-guard"
import {
  BookOpen,
  Users,
  FileText,
  HelpCircle,
  BarChart3,
  Settings,
  Plus,
  Download,
  Eye,
  Edit,
  Trash2,
} from "lucide-react"

interface CourseManagementProps {
  courseId: string
  courseName: string
  isTeacher?: boolean
  studentCount?: number
}

export function CourseManagement({
  courseId,
  courseName,
  isTeacher = false,
  studentCount = 0,
}: CourseManagementProps) {
  const { hasPermission } = usePermissions()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{courseName}</h2>
          <p className="text-muted-foreground">
            Manage course content and settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{studentCount} Students</Badge>
          {isTeacher && <Badge variant="default">Instructor</Badge>}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Course Actions */}
            <PermissionGuard
              permission="courses:update"
              resourceId={courseId}
              resourceType="course"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Course Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <PermissionButton
                    permission="courses:update"
                    resourceId={courseId}
                    resourceType="course"
                    className="w-full justify-start"
                    onClick={() => console.log("Edit course settings")}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Course
                  </PermissionButton>

                  <PermissionButton
                    permission="courses:publish"
                    resourceId={courseId}
                    resourceType="course"
                    className="w-full justify-start"
                    onClick={() => console.log("Publish course")}
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    Publish Course
                  </PermissionButton>

                  <PermissionButton
                    permission="courses:enroll_students"
                    resourceId={courseId}
                    resourceType="course"
                    className="w-full justify-start"
                    onClick={() => console.log("Manage enrollments")}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Enroll Students
                  </PermissionButton>
                </CardContent>
              </Card>
            </PermissionGuard>

            {/* Content Management */}
            <PermissionGuard
              permission="course_content:create"
              resourceId={courseId}
              resourceType="course"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Content</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <PermissionButton
                    permission="course_content:create"
                    resourceId={courseId}
                    resourceType="course"
                    className="w-full justify-start"
                    onClick={() => console.log("Add new folder")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Folder
                  </PermissionButton>

                  <PermissionButton
                    permission="files:upload"
                    className="w-full justify-start"
                    onClick={() => console.log("Upload files")}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Upload Files
                  </PermissionButton>

                  <PermissionButton
                    permission="course_content:manage_folders"
                    resourceId={courseId}
                    resourceType="course"
                    className="w-full justify-start"
                    onClick={() => console.log("Manage folders")}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Manage Folders
                  </PermissionButton>
                </CardContent>
              </Card>
            </PermissionGuard>

            {/* Analytics Access */}
            <PermissionGuard
              permission="courses:view_analytics"
              resourceId={courseId}
              resourceType="course"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Analytics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <PermissionButton
                    permission="courses:view_analytics"
                    resourceId={courseId}
                    resourceType="course"
                    className="w-full justify-start"
                    onClick={() => console.log("View course analytics")}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View Analytics
                  </PermissionButton>

                  <PermissionButton
                    permission="courses:export_data"
                    resourceId={courseId}
                    resourceType="course"
                    className="w-full justify-start"
                    onClick={() => console.log("Export course data")}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export Data
                  </PermissionButton>
                </CardContent>
              </Card>
            </PermissionGuard>
          </div>
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Assignments</h3>
            <PermissionButton
              permission="assignments:create"
              resourceId={courseId}
              resourceType="course"
              onClick={() => console.log("Create new assignment")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Assignment
            </PermissionButton>
          </div>

          <div className="space-y-3">
            {[
              {
                id: "1",
                title: "Midterm Project",
                dueDate: "2024-03-15",
                submissions: 23,
                total: 30,
              },
              {
                id: "2",
                title: "Lab Report",
                dueDate: "2024-03-20",
                submissions: 18,
                total: 30,
              },
              {
                id: "3",
                title: "Final Essay",
                dueDate: "2024-04-01",
                submissions: 5,
                total: 30,
              },
            ].map((assignment) => (
              <Card key={assignment.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{assignment.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        Due: {assignment.dueDate} • {assignment.submissions}/
                        {assignment.total} submitted
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Student View */}
                      <PermissionButton
                        permission="assignments:submit"
                        resourceId={assignment.id}
                        resourceType="assignment"
                        variant="outline"
                        size="sm"
                        onClick={() => console.log("Submit assignment")}
                      >
                        Submit
                      </PermissionButton>

                      {/* Teacher View */}
                      <PermissionButton
                        permission="assignments:view_submissions"
                        resourceId={assignment.id}
                        resourceType="assignment"
                        variant="outline"
                        size="sm"
                        onClick={() => console.log("View submissions")}
                      >
                        <Eye className="h-4 w-4" />
                      </PermissionButton>

                      <PermissionButton
                        permission="assignments:grade"
                        resourceId={assignment.id}
                        resourceType="assignment"
                        variant="outline"
                        size="sm"
                        onClick={() => console.log("Grade assignments")}
                      >
                        Grade
                      </PermissionButton>

                      <PermissionButton
                        permission="assignments:manage_deadlines"
                        resourceId={assignment.id}
                        resourceType="assignment"
                        variant="outline"
                        size="sm"
                        onClick={() => console.log("Manage deadline")}
                      >
                        <Settings className="h-4 w-4" />
                      </PermissionButton>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Quizzes Tab */}
        <TabsContent value="quizzes" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Quizzes</h3>
            <PermissionButton
              permission="quizzes:create"
              resourceId={courseId}
              resourceType="course"
              onClick={() => console.log("Create new quiz")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Quiz
            </PermissionButton>
          </div>

          <div className="space-y-3">
            {[
              {
                id: "1",
                title: "Chapter 1 Quiz",
                questions: 10,
                attempts: 25,
                status: "Active",
              },
              {
                id: "2",
                title: "Midterm Exam",
                questions: 50,
                attempts: 28,
                status: "Active",
              },
              {
                id: "3",
                title: "Final Exam",
                questions: 100,
                attempts: 0,
                status: "Scheduled",
              },
            ].map((quiz) => (
              <Card key={quiz.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{quiz.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {quiz.questions} questions • {quiz.attempts} attempts •{" "}
                        {quiz.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Student View */}
                      <PermissionButton
                        permission="quizzes:take"
                        resourceId={quiz.id}
                        resourceType="quiz"
                        variant="outline"
                        size="sm"
                        onClick={() => console.log("Take quiz")}
                      >
                        Take Quiz
                      </PermissionButton>

                      <PermissionButton
                        permission="quizzes:view_results"
                        resourceId={quiz.id}
                        resourceType="quiz"
                        variant="outline"
                        size="sm"
                        onClick={() => console.log("View results")}
                      >
                        View Results
                      </PermissionButton>

                      {/* Teacher View */}
                      <PermissionButton
                        permission="quizzes:manage_questions"
                        resourceId={quiz.id}
                        resourceType="quiz"
                        variant="outline"
                        size="sm"
                        onClick={() => console.log("Manage questions")}
                      >
                        <Edit className="h-4 w-4" />
                      </PermissionButton>

                      <PermissionButton
                        permission="quizzes:grade"
                        resourceId={quiz.id}
                        resourceType="quiz"
                        variant="outline"
                        size="sm"
                        onClick={() => console.log("Grade quiz")}
                      >
                        Grade
                      </PermissionButton>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Course Files</h3>
            <PermissionButton
              permission="files:upload"
              onClick={() => console.log("Upload files")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Upload Files
            </PermissionButton>
          </div>

          <div className="space-y-3">
            {[
              {
                id: "1",
                name: "Syllabus.pdf",
                size: "2.3 MB",
                type: "PDF",
                uploadedBy: "Prof. Smith",
              },
              {
                id: "2",
                name: "Lecture Notes.docx",
                size: "1.1 MB",
                type: "Document",
                uploadedBy: "Prof. Smith",
              },
              {
                id: "3",
                name: "Tutorial Video.mp4",
                size: "45.2 MB",
                type: "Video",
                uploadedBy: "Prof. Smith",
              },
            ].map((file) => (
              <Card key={file.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{file.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {file.size} • {file.type} • Uploaded by{" "}
                        {file.uploadedBy}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PermissionButton
                        permission="files:download"
                        variant="outline"
                        size="sm"
                        onClick={() => console.log("Download file")}
                      >
                        <Download className="h-4 w-4" />
                      </PermissionButton>

                      <PermissionButton
                        permission="files:manage_permissions"
                        resourceId={file.id}
                        resourceType="file"
                        variant="outline"
                        size="sm"
                        onClick={() => console.log("Manage permissions")}
                      >
                        <Settings className="h-4 w-4" />
                      </PermissionButton>

                      <PermissionButton
                        permission="files:delete"
                        resourceId={file.id}
                        resourceType="file"
                        variant="outline"
                        size="sm"
                        onClick={() => console.log("Delete file")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </PermissionButton>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <PermissionGuard
            permission="courses:view_analytics"
            resourceId={courseId}
            resourceType="course"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <h4 className="text-2xl font-bold">85%</h4>
                  <p className="text-sm text-muted-foreground">
                    Avg. Completion Rate
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <h4 className="text-2xl font-bold">78%</h4>
                  <p className="text-sm text-muted-foreground">Avg. Grade</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <h4 className="text-2xl font-bold">4.2</h4>
                  <p className="text-sm text-muted-foreground">Avg. Rating</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <h4 className="text-2xl font-bold">92%</h4>
                  <p className="text-sm text-muted-foreground">
                    Engagement Rate
                  </p>
                </CardContent>
              </Card>
            </div>
          </PermissionGuard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
