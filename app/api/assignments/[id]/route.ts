import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getAssignmentById } from "@/lib/actions/assignments"
import { getSubmissionForAssignment } from "@/lib/actions/submissions"
import { getCourseById } from "@/lib/actions/courses"
import { createConversation } from "@/lib/actions/chatbot"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { id } = await params

  const assignmentResult = await getAssignmentById(id)
  if (!assignmentResult.success || !assignmentResult.data) {
    return new Response("Assignment not found", { status: 404 })
  }

  const assignment = assignmentResult.data

  // Check enrollment for students and get course/chatbot info
  let chatbot = null
  let conversationId: string | null = null
  let courseTitle = ""

  if (session.user.role === "STUDENT") {
    const courseId = assignment.week?.course?.id
    courseTitle = assignment.week?.course?.title || ""

    if (!courseId) {
      return new Response("Course not found", { status: 404 })
    }

    const courseResult = await getCourseById(courseId)
    if (!courseResult.success || !courseResult.data) {
      return new Response("Course not found", { status: 404 })
    }

    const course = courseResult.data
    const isEnrolled = course.enrollments?.some(
      (e: { studentId: string }) => e.studentId === session.user.id
    )
    if (!isEnrolled) {
      return new Response("Forbidden", { status: 403 })
    }

    // Get chatbot info for the course
    chatbot = course.chatbots?.[0] ?? null
    if (chatbot) {
      const conversation = await createConversation(
        chatbot.id,
        `Assignment: ${assignment.title}`
      )
      conversationId = conversation.id
    }
  }

  // Get submission if student
  let submission = null
  if (session.user.role === "STUDENT") {
    const submissionResult = await getSubmissionForAssignment(
      id,
      session.user.id
    )
    if (submissionResult.success) {
      submission = submissionResult.data
    }
  }

  return Response.json({
    assignment,
    submission,
    chatbot,
    conversationId,
    courseTitle,
  })
}
