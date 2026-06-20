"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { gradeSubmission } from "@/lib/actions/submissions"

type RubricCriterion = { name: string; description: string; points: number }

type GradingFormProps = {
  submissionId: string
  maxScore: number
  currentScore: number | null
  currentFeedback: string | null
  rubric?: { criteria: RubricCriterion[] } | null
}

export function GradingForm({
  submissionId,
  maxScore,
  currentScore,
  currentFeedback,
  rubric,
}: GradingFormProps) {
  const router = useRouter()
  const [score, setScore] = useState(currentScore?.toString() ?? "")
  const [feedback, setFeedback] = useState(currentFeedback ?? "")
  const [rubricScores, setRubricScores] = useState<Record<string, string>>(() =>
    Object.fromEntries((rubric?.criteria ?? []).map((c) => [c.name, ""]))
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedScore = Number(score)
    if (Number.isNaN(parsedScore)) {
      toast.error("Enter a valid score")
      return
    }

    setIsSubmitting(true)
    const rubricPayload = (rubric?.criteria ?? [])
      .map((c) => ({
        name: c.name,
        points: Number(rubricScores[c.name] ?? 0),
      }))
      .filter((r) => !Number.isNaN(r.points))

    const result = await gradeSubmission({
      submissionId,
      score: parsedScore,
      feedback,
      rubricScores: rubricPayload.length ? rubricPayload : undefined,
    })

    setIsSubmitting(false)

    if (!result.success) {
      toast.error(result.error ?? "Failed to save grade")
      return
    }

    toast.success("Grade published")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="score">Score (0–{maxScore})</Label>
        <Input
          id="score"
          type="number"
          min={0}
          max={maxScore}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          required
        />
      </div>

      {rubric?.criteria?.length ? (
        <div className="space-y-3 rounded-lg border border-border/60 p-4">
          <p className="text-sm font-medium">Rubric</p>
          {rubric.criteria.map((criterion) => (
            <div key={criterion.name} className="space-y-1">
              <Label>
                {criterion.name} (max {criterion.points})
              </Label>
              <p className="text-xs text-muted-foreground">
                {criterion.description}
              </p>
              <Input
                type="number"
                min={0}
                max={criterion.points}
                value={rubricScores[criterion.name] ?? ""}
                onChange={(e) =>
                  setRubricScores((prev) => ({
                    ...prev,
                    [criterion.name]: e.target.value,
                  }))
                }
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="feedback">Feedback</Label>
        <Textarea
          id="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={5}
          placeholder="Write feedback for the student..."
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Publish grade"}
      </Button>
    </form>
  )
}
