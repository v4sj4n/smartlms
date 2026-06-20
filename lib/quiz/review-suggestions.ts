import { db } from "@/db"
import {
  fileChunks,
  files,
  lectureMaterials,
  questions,
  quizzes,
  quizAnswers,
  quizAttempts,
} from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"

export type LectureReviewSuggestion = {
  materialId: string
  title: string
  type: string
  href: string
  reason: string
  missedQuestionCount: number
}

function keywordOverlap(a: string, b: string): number {
  const wordsA = new Set(
    a
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3)
  )
  const wordsB = b
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3)
  return wordsB.filter((w) => wordsA.has(w)).length
}

export async function computeReviewSuggestions(
  attemptId: string,
  courseId: string,
  weekId: string
): Promise<LectureReviewSuggestion[]> {
  const attempt = await db.query.quizAttempts.findFirst({
    where: eq(quizAttempts.id, attemptId),
    with: {
      quiz: {
        with: {
          questions: true,
        },
      },
    },
  })

  if (!attempt?.quiz) {
    return []
  }

  const wrongAnswers = await db.query.quizAnswers.findMany({
    where: and(
      eq(quizAnswers.attemptId, attemptId),
      eq(quizAnswers.isCorrect, false)
    ),
    with: {
      question: true,
    },
  })

  const materials = await db.query.lectureMaterials.findMany({
    where: and(
      eq(lectureMaterials.weekId, weekId),
      eq(lectureMaterials.isPublished, true)
    ),
    orderBy: (m, { desc }) => [desc(m.createdAt)],
  })

  if (wrongAnswers.length === 0) {
    return []
  }

  const materialScores = new Map<
    string,
    { material: (typeof materials)[0]; score: number; count: number }
  >()

  for (const wrong of wrongAnswers) {
    const question = wrong.question
    if (!question) continue

    const chunkIds = question.sourceChunkIds ?? []
    let fileIds: string[] = []

    if (chunkIds.length > 0) {
      const chunks = await db.query.fileChunks.findMany({
        where: inArray(fileChunks.id, chunkIds),
        columns: { fileId: true },
      })
      fileIds = [...new Set(chunks.map((c) => c.fileId))]
    }

    if (question.sourceFileId) {
      fileIds.push(question.sourceFileId)
    }

    if (fileIds.length === 0 && attempt.quiz.sourceFileId) {
      fileIds.push(attempt.quiz.sourceFileId)
    }

    const linkedMaterials = new Set<string>()

    for (const fileId of fileIds) {
      const file = await db.query.files.findFirst({
        where: eq(files.id, fileId),
        columns: { id: true, name: true, path: true },
      })
      if (!file) continue

      for (const material of materials) {
        const urlMatch =
          material.contentUrl &&
          (material.contentUrl.includes(file.path) ||
            material.contentUrl.includes(file.name))
        const titleMatch = keywordOverlap(question.content, material.title) > 0

        if (urlMatch || titleMatch) {
          linkedMaterials.add(material.id)
        }
      }
    }

    if (linkedMaterials.size === 0) {
      for (const material of materials) {
        if (keywordOverlap(question.content, material.title) > 0) {
          linkedMaterials.add(material.id)
        }
      }
    }

    for (const materialId of linkedMaterials) {
      const material = materials.find((m) => m.id === materialId)
      if (!material) continue
      const existing = materialScores.get(materialId)
      const addScore = question.points
      if (existing) {
        existing.score += addScore
        existing.count += 1
      } else {
        materialScores.set(materialId, {
          material,
          score: addScore,
          count: 1,
        })
      }
    }
  }

  if (materialScores.size === 0 && materials.length > 0) {
    for (const material of materials.slice(0, 3)) {
      materialScores.set(material.id, {
        material,
        score: 1,
        count: 1,
      })
    }
  }

  const ranked = [...materialScores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return ranked.map(({ material, count }) => ({
    materialId: material.id,
    title: material.title,
    type: material.type,
    href: `/student/courses/${courseId}?weekId=${weekId}&materialId=${material.id}`,
    reason: `You missed ${count} question${count !== 1 ? "s" : ""} related to this lecture`,
    missedQuestionCount: count,
  }))
}

export async function getReviewSuggestionsForAttempt(attemptId: string) {
  const attempt = await db.query.quizAttempts.findFirst({
    where: eq(quizAttempts.id, attemptId),
    with: {
      quiz: {
        with: {
          week: {
            columns: { id: true, courseId: true },
          },
        },
      },
    },
  })

  if (!attempt?.quiz?.week) {
    return []
  }

  if (attempt.reviewSuggestions && attempt.reviewSuggestions.length > 0) {
    return attempt.reviewSuggestions
  }

  return computeReviewSuggestions(
    attemptId,
    attempt.quiz.week.courseId,
    attempt.quiz.week.id
  )
}
