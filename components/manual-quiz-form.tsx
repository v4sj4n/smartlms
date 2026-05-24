"use client"

import { type FormEvent, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"

import { createManualQuiz } from "@/lib/actions/quizzes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type WeekOption = {
  id: string
  title: string
  weekNumber: number
}

type ManualQuestion = {
  id: string
  type: "multiple_choice" | "true_false"
  content: string
  points: number
  options: string[]
  correctOptionIndex: number
  correctBooleanAnswer: boolean
}

type Props = {
  courseId: string
  weeks: WeekOption[]
  defaultWeekId: string
}

function createNewQuestion(): ManualQuestion {
  return {
    id: crypto.randomUUID(),
    type: "multiple_choice",
    content: "",
    points: 1,
    options: ["", "", "", ""],
    correctOptionIndex: 0,
    correctBooleanAnswer: true,
  }
}

export function ManualQuizForm({ courseId, weeks, defaultWeekId }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [weekId, setWeekId] = useState(defaultWeekId)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<"graded" | "practice">("graded")
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | "">("")
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "medium"
  )
  const [questions, setQuestions] = useState<ManualQuestion[]>([
    createNewQuestion(),
  ])

  const selectedWeek = useMemo(
    () => weeks.find((week) => week.id === weekId) ?? null,
    [weekId, weeks]
  )

  const updateQuestion = (
    questionId: string,
    patch: Partial<ManualQuestion>
  ) => {
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === questionId ? { ...question, ...patch } : question
      )
    )
  }

  const removeQuestion = (questionId: string) => {
    setQuestions((prev) => {
      if (prev.length === 1) return prev
      return prev.filter((question) => question.id !== questionId)
    })
  }

  const addQuestion = () => {
    setQuestions((prev) => [...prev, createNewQuestion()])
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!weekId) {
      toast.error("Please select a folder")
      return
    }

    if (!title.trim()) {
      toast.error("Quiz title is required")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createManualQuiz({
        weekId,
        title,
        description,
        type,
        difficulty,
        timeLimitMinutes:
          timeLimitMinutes === "" ? undefined : Number(timeLimitMinutes),
        questions: questions.map((question) => ({
          type: question.type,
          content: question.content,
          points: question.points,
          options:
            question.type === "multiple_choice"
              ? question.options.map((content, index) => ({
                  content,
                  isCorrect: index === question.correctOptionIndex,
                }))
              : undefined,
          correctBooleanAnswer:
            question.type === "true_false"
              ? question.correctBooleanAnswer
              : undefined,
        })),
      })

      if (!result.success) {
        toast.error(result.error || "Failed to create quiz")
        return
      }

      toast.success("Quiz created")
      if (selectedWeek) {
        router.push(`/professor/courses/${courseId}/folders/${selectedWeek.id}`)
        return
      }
      router.push(`/professor/courses/${courseId}`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create quiz"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="weekId">Folder</Label>
          <Select value={weekId} onValueChange={setWeekId}>
            <SelectTrigger id="weekId" className="h-10 w-full">
              <SelectValue placeholder="Select folder" />
            </SelectTrigger>
            <SelectContent>
              {weeks.map((week) => (
                <SelectItem key={week.id} value={week.id}>
                  Folder {week.weekNumber}: {week.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quizType">Quiz type</Label>
          <Select
            value={type}
            onValueChange={(value) => setType(value as "graded" | "practice")}
          >
            <SelectTrigger id="quizType" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="graded">Graded</SelectItem>
              <SelectItem value="practice">Practice</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Midterm Review Quiz"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional quiz description"
          rows={3}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="difficulty">Difficulty</Label>
          <Select
            value={difficulty}
            onValueChange={(value) =>
              setDifficulty(value as "easy" | "medium" | "hard")
            }
          >
            <SelectTrigger id="difficulty" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timeLimit">Time limit (minutes)</Label>
          <Input
            id="timeLimit"
            type="number"
            min={1}
            value={timeLimitMinutes}
            onChange={(event) => {
              const next = event.target.value
              setTimeLimitMinutes(next === "" ? "" : Number(next))
            }}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Questions</h3>
          <Button type="button" variant="outline" onClick={addQuestion}>
            <Plus className="mr-2 h-4 w-4" />
            Add question
          </Button>
        </div>

        {questions.map((question, index) => (
          <div key={question.id} className="space-y-4 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">Question {index + 1}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeQuestion(question.id)}
                disabled={questions.length === 1}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label>Prompt</Label>
                <Textarea
                  value={question.content}
                  onChange={(event) =>
                    updateQuestion(question.id, { content: event.target.value })
                  }
                  placeholder="Enter your question"
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={question.type}
                  onValueChange={(value) =>
                    updateQuestion(question.id, {
                      type: value as "multiple_choice" | "true_false",
                    })
                  }
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">
                      Multiple choice
                    </SelectItem>
                    <SelectItem value="true_false">True / False</SelectItem>
                  </SelectContent>
                </Select>

                <Label>Points</Label>
                <Input
                  type="number"
                  min={1}
                  value={question.points}
                  onChange={(event) =>
                    updateQuestion(question.id, {
                      points: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                />
              </div>
            </div>

            {question.type === "multiple_choice" ? (
              <div className="space-y-3">
                <Label>Options (choose one correct)</Label>
                {question.options.map((option, optionIndex) => (
                  <div
                    key={`${question.id}-option-${optionIndex}`}
                    className="flex gap-2"
                  >
                    <Input
                      value={option}
                      onChange={(event) => {
                        const next = [...question.options]
                        next[optionIndex] = event.target.value
                        updateQuestion(question.id, { options: next })
                      }}
                      placeholder={`Option ${optionIndex + 1}`}
                    />
                    <Button
                      type="button"
                      variant={
                        question.correctOptionIndex === optionIndex
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        updateQuestion(question.id, {
                          correctOptionIndex: optionIndex,
                        })
                      }
                    >
                      Correct
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Correct answer</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={
                      question.correctBooleanAnswer ? "default" : "outline"
                    }
                    onClick={() =>
                      updateQuestion(question.id, {
                        correctBooleanAnswer: true,
                      })
                    }
                  >
                    True
                  </Button>
                  <Button
                    type="button"
                    variant={
                      question.correctBooleanAnswer ? "outline" : "default"
                    }
                    onClick={() =>
                      updateQuestion(question.id, {
                        correctBooleanAnswer: false,
                      })
                    }
                  >
                    False
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Quiz"}
        </Button>
      </div>
    </form>
  )
}
