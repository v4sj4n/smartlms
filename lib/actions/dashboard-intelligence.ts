"use server"

import { and, desc, eq, gte, isNull, lte, inArray } from "drizzle-orm"

import { db } from "@/db"
import {
  clubMessages,
  clubMembers,
  courseEnrollments,
  courses,
  courseWeeks,
  assignments,
  quizzes,
  quizAttempts,
  submissions,
} from "@/db/schema"

export type DashboardPriorityLevel = "important" | "notImportant"

export type DashboardPriorityItem = {
  id: string
  level: DashboardPriorityLevel
  title: string
  description: string
  href?: string | null
  courseId?: string | null
  courseTitle?: string | null
  source: "course" | "seminar" | "learning_hub" | "assignment" | "task"
  dueLabel?: string | null
  completed?: boolean
}

function makeItem(item: DashboardPriorityItem) {
  return item
}

export async function getStudentDashboardPriorities(userId: string) {
  const enrollments = await db.query.courseEnrollments.findMany({
    where: eq(courseEnrollments.studentId, userId),
    with: {
      course: {
        with: {
          weeks: {
            with: {
              quizzes: true,
            },
          },
        },
      },
    },
  })

  const attempts = await db.query.quizAttempts.findMany({
    where: eq(quizAttempts.userId, userId),
    columns: { quizId: true },
  })

  const attemptedQuizIds = new Set(attempts.map((attempt) => attempt.quizId))
  const important: DashboardPriorityItem[] = []
  const notImportant: DashboardPriorityItem[] = []

  for (const enrollment of enrollments) {
    const course = enrollment.course
    if (!course) continue

    const pendingQuizzes = (course.weeks ?? [])
      .flatMap((week) => week.quizzes ?? [])
      .filter((quiz) => !attemptedQuizIds.has(quiz.id))

    if (pendingQuizzes.length > 0) {
      important.push(
        makeItem({
          id: `student-course-${course.id}`,
          level: "important",
          title: `Pending seminar or quiz work in ${course.title}`,
          description: `${pendingQuizzes.length} item${pendingQuizzes.length === 1 ? "" : "s"} still need attention.`,
          href: `/student/courses/${course.id}`,
          courseId: course.id,
          courseTitle: course.title,
          source: "course",
        })
      )
    } else {
      notImportant.push(
        makeItem({
          id: `student-course-done-${course.id}`,
          level: "notImportant",
          title: `${course.title} is up to date`,
          description: "No incomplete quiz activity is pending right now.",
          href: `/student/courses/${course.id}`,
          courseId: course.id,
          courseTitle: course.title,
          source: "course",
          completed: true,
        })
      )
    }
  }

  const clubMemberships = await db.query.clubMembers.findMany({
    where: eq(clubMembers.userId, userId),
    with: {
      club: {
        with: {
          messages: {
            orderBy: [desc(clubMessages.createdAt)],
            limit: 1,
          },
        },
      },
    },
  })

  for (const membership of clubMemberships) {
    const club = membership.club
    const latestMessage = club?.messages?.[0]
    if (!club || !latestMessage) continue

    const isUnread = membership.lastReadMessageId !== latestMessage.id
    ;(isUnread ? important : notImportant).push(
      makeItem({
        id: `learning-hub-${club.id}`,
        level: isUnread ? "important" : "notImportant",
        title: isUnread ? `${club.name} has new activity` : `${club.name} is quiet`,
        description: latestMessage.content,
        href: `/student/clubs/${club.id}`,
        source: "learning_hub",
        completed: !isUnread,
      })
    )
  }

  return { important, notImportant }
}

export type PendingSubmission = {
  id: string
  studentName: string | null
  studentEmail: string
  assignmentTitle: string
  courseTitle: string
  submittedAt: Date
  type: "assignment" | "quiz"
  score?: number | null
  maxScore: number
  href: string
}

export type UpcomingDeadline = {
  id: string
  title: string
  courseTitle: string
  dueDate: Date
  type: "assignment" | "quiz"
  totalItems: number
  completedItems: number
  href: string
}

export type QuizPerformance = {
  quizId: string
  quizTitle: string
  courseTitle: string
  totalAttempts: number
  averageScore: number
  highestScore: number
  lowestScore: number
  href: string
}

export async function getPendingSubmissions(
  courseIds: string[]
): Promise<PendingSubmission[]> {
  if (courseIds.length === 0) return []

  const submissionsData = await db.query.submissions.findMany({
    where: and(
      eq(submissions.status, "submitted"),
      inArray(submissions.weekId, db.select({ id: courseWeeks.id }).from(courseWeeks).where(inArray(courseWeeks.courseId, courseIds)))
    ),
    with: {
      student: {
        columns: {
          id: true,
          name: true,
          email: true,
          fullName: true,
        },
      },
      week: {
        with: {
          course: {
            columns: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
    orderBy: [desc(submissions.submittedAt)],
    limit: 10,
  })

  return submissionsData.map((sub) => ({
    id: sub.id,
    studentName: sub.student?.fullName || sub.student?.name || null,
    studentEmail: sub.student?.email || "Unknown",
    assignmentTitle: sub.type === "quiz" ? "Quiz Submission" : "Assignment",
    courseTitle: sub.week?.course?.title || "Unknown Course",
    submittedAt: sub.submittedAt,
    type: sub.type as "assignment" | "quiz",
    score: sub.score,
    maxScore: sub.maxScore,
    href: `/professor/courses/${sub.week?.course?.id}/submissions/${sub.id}`,
  }))
}

export async function getUpcomingDeadlines(
  courseIds: string[]
): Promise<UpcomingDeadline[]> {
  if (courseIds.length === 0) return []

  const now = new Date()
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Get weekIds for the courses
  const weekIdsResult = await db.query.courseWeeks.findMany({
    where: inArray(courseWeeks.courseId, courseIds),
    columns: { id: true }
  })
  const weekIds = weekIdsResult.map(w => w.id)
  
  if (weekIds.length === 0) return []

  const assignmentsData = await db.query.assignments.findMany({
    where: and(
      gte(assignments.dueDate, now),
      lte(assignments.dueDate, sevenDaysLater),
      eq(assignments.isPublished, true),
      inArray(assignments.weekId, weekIds)
    ),
    with: {
      week: {
        with: {
          course: {
            columns: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  })

  return assignmentsData.map((assignment) => ({
    id: assignment.id,
    title: assignment.title,
    courseTitle: assignment.week?.course?.title || "Unknown Course",
    dueDate: assignment.dueDate!,
    type: "assignment" as const,
    totalItems: 0, // We'll fetch this separately if needed
    completedItems: 0,
    href: `/professor/courses/${assignment.week?.course?.id}/assignments/${assignment.id}`,
  }))
}

export async function getQuizPerformance(
  courseIds: string[]
): Promise<QuizPerformance[]> {
  if (courseIds.length === 0) return []

  // Get weekIds for the courses
  const weekIdsResult = await db.query.courseWeeks.findMany({
    where: inArray(courseWeeks.courseId, courseIds),
    columns: { id: true }
  })
  const weekIds = weekIdsResult.map(w => w.id)
  
  if (weekIds.length === 0) return []

  const quizzesData = await db.query.quizzes.findMany({
    where: and(
      eq(quizzes.status, "PUBLISHED"),
      inArray(quizzes.weekId, weekIds)
    ),
    with: {
      week: {
        with: {
          course: {
            columns: {
              id: true,
              title: true,
            },
          },
        },
      },
      attempts: {
        columns: {
          score: true,
        },
      },
    },
    limit: 5,
  })

  return quizzesData.map((quiz) => {
    const attempts = quiz.attempts || []
    const scores = attempts.map((a) => a.score)
    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0

    return {
      quizId: quiz.id,
      quizTitle: quiz.title,
      courseTitle: quiz.week?.course?.title || "Unknown Course",
      totalAttempts: attempts.length,
      averageScore: avgScore,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      href: `/professor/courses/${quiz.week?.course?.id}/quizzes/${quiz.id}`,
    }
  })
}

export async function getProfessorDashboardPriorities(userId: string) {
  const taughtCourses = await db.query.courses.findMany({
    where: eq(courses.teacherId, userId),
    with: {
      enrollments: true,
      weeks: {
        with: {
          quizzes: true,
        },
      },
    },
  })

  const important: DashboardPriorityItem[] = []
  const notImportant: DashboardPriorityItem[] = []

  for (const course of taughtCourses) {
    if (!course.isPublished) {
      important.push(
        makeItem({
          id: `professor-draft-${course.id}`,
          level: "important",
          title: `Publish ${course.title}`,
          description: "Course content is still in draft state.",
          href: `/professor/courses/${course.id}`,
          courseId: course.id,
          courseTitle: course.title,
          source: "course",
        })
      )
    } else {
      notImportant.push(
        makeItem({
          id: `professor-ready-${course.id}`,
          level: "notImportant",
          title: `${course.title} is published`,
          description: `${course.enrollments?.length ?? 0} enrolled student${(course.enrollments?.length ?? 0) === 1 ? "" : "s"}.`,
          href: `/professor/courses/${course.id}`,
          courseId: course.id,
          courseTitle: course.title,
          source: "course",
          completed: true,
        })
      )
    }

    if ((course.weeks?.length ?? 0) === 0) {
      important.push(
        makeItem({
          id: `professor-empty-${course.id}`,
          level: "important",
          title: `Add course content for ${course.title}`,
          description: "No week folders or seminar-ready learning content exist yet.",
          href: `/professor/courses/${course.id}/folders/new`,
          courseId: course.id,
          courseTitle: course.title,
          source: "seminar",
        })
      )
    }
  }

  const hubActivity = await db.query.clubMessages.findMany({
    where: isNull(clubMessages.deletedAt),
    orderBy: [desc(clubMessages.createdAt)],
    limit: 5,
    with: {
      club: true,
    },
  })

  for (const message of hubActivity) {
    if (!message.club) continue
    notImportant.push(
      makeItem({
        id: `professor-hub-${message.id}`,
        level: "notImportant",
        title: `${message.club.name} learning hub activity`,
        description: message.content,
        href: `/professor/clubs/${message.club.id}`,
        source: "learning_hub",
      })
    )
  }

  return { important, notImportant }
}

export async function getAdminDashboardPriorities() {
  const openCourses = await db.query.courses.findMany({
    with: {
      enrollments: true,
    },
  })

  const clubsList = await db.query.clubs.findMany({
    with: {
      members: true,
      messages: {
        orderBy: [desc(clubMessages.createdAt)],
        limit: 1,
      },
    },
  })

  const important: DashboardPriorityItem[] = []
  const notImportant: DashboardPriorityItem[] = []

  for (const course of openCourses) {
    if (!course.isPublished) {
      important.push(
        makeItem({
          id: `admin-course-${course.id}`,
          level: "important",
          title: `${course.title} is unpublished`,
          description: "Needs review before it can be treated as active.",
          href: "/admin/courses",
          courseId: course.id,
          courseTitle: course.title,
          source: "course",
        })
      )
    } else {
      notImportant.push(
        makeItem({
          id: `admin-course-ready-${course.id}`,
          level: "notImportant",
          title: `${course.title} is active`,
          description: `${course.enrollments?.length ?? 0} enrolled student${(course.enrollments?.length ?? 0) === 1 ? "" : "s"}.`,
          href: "/admin/courses",
          courseId: course.id,
          courseTitle: course.title,
          source: "course",
          completed: true,
        })
      )
    }
  }

  for (const club of clubsList) {
    const latestMessage = club.messages?.[0]
    if (!latestMessage) continue
    notImportant.push(
      makeItem({
        id: `admin-hub-${club.id}`,
        level: "notImportant",
        title: `${club.name} learning hub activity`,
        description: latestMessage.content,
        href: `/admin/clubs/${club.id}`,
        source: "learning_hub",
      })
    )
  }

  return { important, notImportant }
}
