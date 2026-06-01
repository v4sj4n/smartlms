"use client"

import { type FormEvent, useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowDown,
  ArrowUp,
  Check,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react"

import { createManualFlashcards, createManualQuiz } from "@/lib/actions/quizzes"
import { getWeekFiles } from "@/lib/actions/week-files"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

type FileItem = {
  id: string
  name: string
  mimeType: string
  size: number
  status: string
  createdAt: Date
}

type GeneratedQuizQuestion = {
  type: "mcq" | "true_false"
  prompt: string
  options?: string[]
  answer: string | boolean | string[]
  explanation: string
  difficulty: "easy" | "medium" | "hard"
  sourceChunkIds: string[]
}

type GeneratedFlashcard = {
  front: string
  back: string
  difficulty: "easy" | "medium" | "hard"
  sourceChunkIds: string[]
}

type QuizDraftQuestion = {
  id: string
  type: "multiple_choice" | "true_false"
  content: string
  points: number
  options: string[]
  correctOptionIndex: number
  correctBooleanAnswer: boolean
  explanation: string
  difficulty: "easy" | "medium" | "hard"
}

type FlashcardDraft = {
  id: string
  frontContent: string
  backContent: string
  difficulty: "easy" | "medium" | "hard"
}

type Props = {
  weekId: string
  weekTitle: string
  trigger?: React.ReactNode
}

function createNewQuizQuestion(): QuizDraftQuestion {
  return {
    id: crypto.randomUUID(),
    type: "multiple_choice",
    content: "",
    points: 1,
    options: ["", "", "", ""],
    correctOptionIndex: 0,
    correctBooleanAnswer: true,
    explanation: "",
    difficulty: "medium",
  }
}

function createNewFlashcard(): FlashcardDraft {
  return {
    id: crypto.randomUUID(),
    frontContent: "",
    backContent: "",
    difficulty: "medium",
  }
}

function pointsFromDifficulty(difficulty: "easy" | "medium" | "hard"): number {
  if (difficulty === "hard") return 3
  if (difficulty === "medium") return 2
  return 1
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(Math.max(index, 0), length - 1)
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return items
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  if (!item) return items
  next.splice(toIndex, 0, item)
  return next
}

function mapGeneratedQuizQuestions(
  questions: GeneratedQuizQuestion[]
): QuizDraftQuestion[] {
  return questions.map((question) => {
    const options =
      question.type === "mcq"
        ? (question.options?.filter((option) => option.trim().length > 0) ?? [])
        : []
    const correctOptionText =
      typeof question.answer === "string"
        ? question.answer
        : Array.isArray(question.answer)
          ? (question.answer[0] ?? "")
          : ""
    const correctOptionIndex =
      question.type === "mcq"
        ? Math.max(
            0,
            options.findIndex((option) => option === correctOptionText)
          )
        : 0

    return {
      id: crypto.randomUUID(),
      type: question.type === "mcq" ? "multiple_choice" : "true_false",
      content: question.prompt,
      points: pointsFromDifficulty(question.difficulty),
      options:
        question.type === "mcq"
          ? options.length >= 2
            ? options
            : ["", "", "", ""]
          : ["True", "False"],
      correctOptionIndex,
      correctBooleanAnswer:
        question.type === "true_false"
          ? typeof question.answer === "boolean"
            ? question.answer
            : String(question.answer).toLowerCase() === "true"
          : true,
      explanation: question.explanation,
      difficulty: question.difficulty,
    }
  })
}

function mapGeneratedFlashcards(cards: GeneratedFlashcard[]): FlashcardDraft[] {
  return cards.map((card) => ({
    id: crypto.randomUUID(),
    frontContent: card.front,
    backContent: card.back,
    difficulty: card.difficulty,
  }))
}

function createQuizPayload(questions: QuizDraftQuestion[]) {
  return questions.map((question) => ({
    type: question.type,
    content: question.content.trim(),
    points: Math.max(1, Math.floor(question.points) || 1),
    options:
      question.type === "multiple_choice"
        ? question.options.map((content, index) => ({
            content: content.trim(),
            isCorrect: index === question.correctOptionIndex,
          }))
        : undefined,
    correctBooleanAnswer:
      question.type === "true_false"
        ? question.correctBooleanAnswer
        : undefined,
  }))
}

function validateQuizDraft(questions: QuizDraftQuestion[]) {
  const invalidQuestion = questions.find((question) => !question.content.trim())
  if (invalidQuestion) {
    return "Every question needs a prompt"
  }

  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index]
    if (question.type === "multiple_choice") {
      const options = question.options
        .map((option) => option.trim())
        .filter(Boolean)
      if (options.length < 2) {
        return `Question ${index + 1} needs at least two options`
      }
      if (
        question.correctOptionIndex < 0 ||
        question.correctOptionIndex >= options.length
      ) {
        return `Question ${index + 1} must have a valid correct option`
      }
    }
  }

  return null
}

function validateFlashcardsDraft(cards: FlashcardDraft[]) {
  const invalidCard = cards.find(
    (card) => !card.frontContent.trim() || !card.backContent.trim()
  )
  return invalidCard ? "Every flashcard needs a front and back" : null
}

function QuizDraftEditor({
  weekTitle,
  draft,
  onBack,
  onCancel,
  onSave,
  isSaving,
}: {
  weekTitle: string
  draft: GeneratedQuizQuestion[]
  onBack: () => void
  onCancel: () => void
  onSave: (input: {
    title: string
    description?: string
    type: "graded" | "practice"
    difficulty: "easy" | "medium" | "hard"
    timeLimitMinutes?: number
    questions: ReturnType<typeof createQuizPayload>
  }) => Promise<void>
  isSaving: boolean
}) {
  const [title, setTitle] = useState(`AI Study Quiz — ${weekTitle}`)
  const [description, setDescription] = useState("")
  const [type, setType] = useState<"graded" | "practice">("practice")
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "medium"
  )
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | "">("")
  const [questions, setQuestions] = useState<QuizDraftQuestion[]>(() =>
    draft.length > 0
      ? mapGeneratedQuizQuestions(draft)
      : [createNewQuizQuestion()]
  )

  const updateQuestion = (
    questionId: string,
    patch: Partial<QuizDraftQuestion>
  ) => {
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === questionId ? { ...question, ...patch } : question
      )
    )
  }

  const addQuestion = () => {
    setQuestions((prev) => [...prev, createNewQuizQuestion()])
  }

  const removeQuestion = (questionId: string) => {
    setQuestions((prev) =>
      prev.length === 1 ? prev : prev.filter((q) => q.id !== questionId)
    )
  }

  const moveQuestion = (questionId: string, direction: -1 | 1) => {
    setQuestions((prev) => {
      const index = prev.findIndex((question) => question.id === questionId)
      const targetIndex = index + direction
      if (index < 0 || targetIndex < 0 || targetIndex >= prev.length) {
        return prev
      }
      return moveItem(prev, index, targetIndex)
    })
  }

  const updateOption = (
    questionId: string,
    optionIndex: number,
    value: string
  ) => {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.id !== questionId || question.type !== "multiple_choice") {
          return question
        }

        const nextOptions = [...question.options]
        nextOptions[optionIndex] = value
        return { ...question, options: nextOptions }
      })
    )
  }

  const addOption = (questionId: string) => {
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === questionId && question.type === "multiple_choice"
          ? { ...question, options: [...question.options, ""] }
          : question
      )
    )
  }

  const removeOption = (questionId: string, optionIndex: number) => {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.id !== questionId || question.type !== "multiple_choice") {
          return question
        }

        if (question.options.length <= 2) {
          return question
        }

        const nextOptions = question.options.filter(
          (_, index) => index !== optionIndex
        )
        const nextCorrectIndex =
          optionIndex < question.correctOptionIndex
            ? question.correctOptionIndex - 1
            : optionIndex === question.correctOptionIndex
              ? 0
              : question.correctOptionIndex

        return {
          ...question,
          options: nextOptions,
          correctOptionIndex: clampIndex(nextCorrectIndex, nextOptions.length),
        }
      })
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const validationError = validateQuizDraft(questions)
    if (validationError) {
      toast.error(validationError)
      return
    }

    if (!title.trim()) {
      toast.error("Quiz title is required")
      return
    }

    await onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      difficulty,
      timeLimitMinutes:
        timeLimitMinutes === ""
          ? undefined
          : Math.max(1, Number(timeLimitMinutes)),
      questions: createQuizPayload(questions),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="ai-quiz-title">Title</Label>
          <Input
            id="ai-quiz-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Midterm Review Quiz"
            required
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="ai-quiz-description">Description</Label>
          <Textarea
            id="ai-quiz-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional quiz description"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-quiz-type">Quiz type</Label>
          <Select
            value={type}
            onValueChange={(value) => setType(value as "graded" | "practice")}
          >
            <SelectTrigger id="ai-quiz-type" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="graded">Graded</SelectItem>
              <SelectItem value="practice">Practice</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-quiz-difficulty">Difficulty</Label>
          <Select
            value={difficulty}
            onValueChange={(value) =>
              setDifficulty(value as "easy" | "medium" | "hard")
            }
          >
            <SelectTrigger id="ai-quiz-difficulty" className="h-10 w-full">
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
          <Label htmlFor="ai-quiz-time-limit">Time limit (minutes)</Label>
          <Input
            id="ai-quiz-time-limit"
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
        <div className="flex items-center justify-between gap-3">
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
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => moveQuestion(question.id, -1)}
                  disabled={index === 0}
                  aria-label="Move question up"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => moveQuestion(question.id, 1)}
                  disabled={index === questions.length - 1}
                  aria-label="Move question down"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
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
                      options:
                        value === "multiple_choice"
                          ? question.options.length >= 2
                            ? question.options
                            : ["", "", "", ""]
                          : ["True", "False"],
                      correctOptionIndex:
                        value === "multiple_choice"
                          ? clampIndex(
                              question.correctOptionIndex,
                              question.options.length || 4
                            )
                          : 0,
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

                <Label>Difficulty</Label>
                <Select
                  value={question.difficulty}
                  onValueChange={(value) =>
                    updateQuestion(question.id, {
                      difficulty: value as "easy" | "medium" | "hard",
                    })
                  }
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Explanation</Label>
              <Textarea
                value={question.explanation}
                onChange={(event) =>
                  updateQuestion(question.id, {
                    explanation: event.target.value,
                  })
                }
                placeholder="Optional explanation shown after answering"
                rows={2}
              />
            </div>

            {question.type === "multiple_choice" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label>Options</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addOption(question.id)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add option
                  </Button>
                </div>

                {question.options.map((option, optionIndex) => (
                  <div
                    key={`${question.id}-option-${optionIndex}`}
                    className="flex gap-2"
                  >
                    <Input
                      value={option}
                      onChange={(event) =>
                        updateOption(
                          question.id,
                          optionIndex,
                          event.target.value
                        )
                      }
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(question.id, optionIndex)}
                      disabled={question.options.length <= 2}
                      aria-label="Remove option"
                    >
                      <Trash2 className="h-4 w-4" />
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

      <div className="flex items-center justify-between gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back to generation
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Quiz"}
          </Button>
        </div>
      </div>
    </form>
  )
}

function FlashcardDraftEditor({
  draft,
  onBack,
  onCancel,
  onSave,
  isSaving,
}: {
  draft: GeneratedFlashcard[]
  onBack: () => void
  onCancel: () => void
  onSave: (input: {
    difficulty: "easy" | "medium" | "hard"
    cards: { frontContent: string; backContent: string }[]
  }) => Promise<void>
  isSaving: boolean
}) {
  const difficulty: "easy" | "medium" | "hard" = "medium"
  const [cards, setCards] = useState<FlashcardDraft[]>(() =>
    draft.length > 0 ? mapGeneratedFlashcards(draft) : [createNewFlashcard()]
  )

  const updateCard = (cardId: string, patch: Partial<FlashcardDraft>) => {
    setCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, ...patch } : card))
    )
  }

  const addCard = () => {
    setCards((prev) => [...prev, createNewFlashcard()])
  }

  const removeCard = (cardId: string) => {
    setCards((prev) =>
      prev.length === 1 ? prev : prev.filter((card) => card.id !== cardId)
    )
  }

  const moveCard = (cardId: string, direction: -1 | 1) => {
    setCards((prev) => {
      const index = prev.findIndex((card) => card.id === cardId)
      const targetIndex = index + direction
      if (index < 0 || targetIndex < 0 || targetIndex >= prev.length) {
        return prev
      }
      return moveItem(prev, index, targetIndex)
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const validationError = validateFlashcardsDraft(cards)
    if (validationError) {
      toast.error(validationError)
      return
    }

    await onSave({
      difficulty,
      cards: cards.map((card) => ({
        frontContent: card.frontContent.trim(),
        backContent: card.backContent.trim(),
      })),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Cards</h3>
          <Button type="button" variant="outline" onClick={addCard}>
            <Plus className="mr-2 h-4 w-4" />
            Add card
          </Button>
        </div>

        {cards.map((card, index) => (
          <div key={card.id} className="space-y-3 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">Card {index + 1}</p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => moveCard(card.id, -1)}
                  disabled={index === 0}
                  aria-label="Move card up"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => moveCard(card.id, 1)}
                  disabled={index === cards.length - 1}
                  aria-label="Move card down"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCard(card.id)}
                  disabled={cards.length === 1}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Front</Label>
              <Input
                value={card.frontContent}
                onChange={(event) =>
                  updateCard(card.id, { frontContent: event.target.value })
                }
                placeholder="Concept / term"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Back</Label>
              <Textarea
                value={card.backContent}
                onChange={(event) =>
                  updateCard(card.id, { backContent: event.target.value })
                }
                placeholder="Definition / explanation"
                rows={3}
                required
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back to generation
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Flashcards"}
          </Button>
        </div>
      </div>
    </form>
  )
}

export function AIContentGeneratorDialog({
  weekId,
  weekTitle,
  trigger,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"setup" | "edit">("setup")
  const [contentType, setContentType] = useState<"quiz" | "flashcards">("quiz")
  const [generationMode, setGenerationMode] = useState<
    "source_materials" | "prompt"
  >("source_materials")
  const [focusPrompt, setFocusPrompt] = useState("")
  const [customPrompt, setCustomPrompt] = useState("")
  const [title, setTitle] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamedText, setStreamedText] = useState("")
  const [streamedItems, setStreamedItems] = useState<
    Array<Record<string, unknown>>
  >([])
  const [isSaving, setIsSaving] = useState(false)
  const [isFetchingFiles, setIsFetchingFiles] = useState(false)
  const [files, setFiles] = useState<FileItem[]>([])
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())
  const [hasFetchedFiles, setHasFetchedFiles] = useState(false)
  const [quizDraft, setQuizDraft] = useState<GeneratedQuizQuestion[]>([])
  const [flashcardDraft, setFlashcardDraft] = useState<GeneratedFlashcard[]>([])
  const [draftRevision, setDraftRevision] = useState(0)

  const fetchFiles = useCallback(async () => {
    if (hasFetchedFiles) return
    setIsFetchingFiles(true)
    try {
      const result = await getWeekFiles(weekId)
      if (result.success && result.data) {
        setFiles(result.data)
        setSelectedFileIds(new Set(result.data.map((file) => file.id)))
        setHasFetchedFiles(true)
      } else {
        toast.error(result.error || "Failed to load files")
      }
    } catch {
      toast.error("Failed to load files")
    } finally {
      setIsFetchingFiles(false)
    }
  }, [weekId, hasFetchedFiles])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (nextOpen && !hasFetchedFiles) {
        void fetchFiles()
      }
      if (!nextOpen) {
        setStep("setup")
        setGenerationMode("source_materials")
        setQuizDraft([])
        setFlashcardDraft([])
        setIsGenerating(false)
        setStreamedText("")
        setStreamedItems([])
        setIsSaving(false)
        setCustomPrompt("")
      }
    },
    [fetchFiles, hasFetchedFiles]
  )

  const toggleFile = (fileId: string) => {
    setSelectedFileIds((previous) => {
      const next = new Set(previous)
      if (next.has(fileId)) {
        next.delete(fileId)
      } else {
        next.add(fileId)
      }
      return next
    })
  }

  const handleGenerate = async () => {
    if (generationMode === "source_materials" && selectedFileIds.size === 0) {
      toast.error("Please select at least one source file")
      return
    }

    if (generationMode === "prompt" && !customPrompt.trim()) {
      toast.error("Please enter a custom prompt")
      return
    }

    setIsGenerating(true)
    setStreamedText("")
    setStreamedItems([])
    try {
      const response = await fetch("/api/ai/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekId,
          contentType,
          generationMode,
          focusPrompt: focusPrompt.trim() || undefined,
          customPrompt:
            generationMode === "prompt" ? customPrompt.trim() : undefined,
          fileIds:
            generationMode === "source_materials"
              ? Array.from(selectedFileIds)
              : undefined,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        toast.error(errorText || "Failed to generate content")
        return
      }

      if (!response.body) {
        toast.error("No response stream received")
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setStreamedText(accumulated)

        const itemsKey = contentType === "quiz" ? "questions" : "flashcards"
        const keyIndex = accumulated.indexOf(`"${itemsKey}"`)
        if (keyIndex !== -1) {
          const arrayStart = accumulated.indexOf("[", keyIndex)
          if (arrayStart !== -1) {
            const partial = accumulated.slice(arrayStart + 1)
            const parsed: Array<Record<string, unknown>> = []
            let depth = 0
            let objStart = -1
            for (let i = 0; i < partial.length; i++) {
              const ch = partial[i]
              if (ch === "{" && depth === 0) {
                objStart = i
                depth = 1
              } else if (ch === "{") depth++
              else if (ch === "}" && depth === 1) {
                depth = 0
                try {
                  const obj = JSON.parse(
                    partial.slice(objStart, i + 1)
                  ) as Record<string, unknown>
                  parsed.push(obj)
                } catch {
                  /* incomplete */
                }
                objStart = -1
              } else if (ch === "}") depth--
            }
            setStreamedItems(parsed)
          }
        }
      }

      const rawText = accumulated.trim()
      if (!rawText) {
        toast.error("AI returned an empty response")
        return
      }

      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim()

      const objectStart = cleaned.indexOf("{")
      const objectEnd = cleaned.lastIndexOf("}")
      const jsonCandidate =
        objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart
          ? cleaned.slice(objectStart, objectEnd + 1)
          : cleaned

      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(jsonCandidate)
      } catch {
        toast.error("AI returned malformed JSON")
        return
      }

      if (contentType === "quiz") {
        const payload = Array.isArray(parsedJson)
          ? { questions: parsedJson }
          : parsedJson &&
              typeof parsedJson === "object" &&
              "questions" in parsedJson
            ? parsedJson
            : parsedJson
        const questions = (payload as { questions?: unknown }).questions
        if (!Array.isArray(questions) || questions.length === 0) {
          toast.error("AI did not return valid quiz questions")
          return
        }
        setQuizDraft(questions as GeneratedQuizQuestion[])
        setFlashcardDraft([])
      } else {
        const payload = Array.isArray(parsedJson)
          ? { flashcards: parsedJson }
          : parsedJson &&
              typeof parsedJson === "object" &&
              "flashcards" in parsedJson
            ? parsedJson
            : parsedJson
        const cards = (payload as { flashcards?: unknown }).flashcards
        if (!Array.isArray(cards) || cards.length === 0) {
          toast.error("AI did not return valid flashcards")
          return
        }
        setFlashcardDraft(cards as GeneratedFlashcard[])
        setQuizDraft([])
      }

      setDraftRevision((previous) => previous + 1)
      setStreamedText("")
      setStreamedItems([])
      setStep("edit")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveQuiz = async (input: {
    title: string
    description?: string
    type: "graded" | "practice"
    difficulty: "easy" | "medium" | "hard"
    timeLimitMinutes?: number
    questions: ReturnType<typeof createQuizPayload>
  }) => {
    setIsSaving(true)
    try {
      const result = await createManualQuiz({
        weekId,
        title: input.title,
        description: input.description,
        type: input.type,
        difficulty: input.difficulty,
        timeLimitMinutes: input.timeLimitMinutes,
        questions: input.questions,
      })

      if (!result.success) {
        toast.error(result.error || "Failed to create quiz")
        return
      }

      toast.success("Quiz saved")
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create quiz"
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveFlashcards = async (input: {
    difficulty: "easy" | "medium" | "hard"
    cards: { frontContent: string; backContent: string }[]
  }) => {
    setIsSaving(true)
    try {
      const result = await createManualFlashcards({
        weekId,
        difficulty: input.difficulty,
        cards: input.cards,
      })

      if (!result.success) {
        toast.error(result.error || "Failed to create flashcards")
        return
      }

      toast.success(`${result.data?.createdCount ?? 0} flashcards saved`)
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create flashcards"
      )
    } finally {
      setIsSaving(false)
    }
  }

  const selectedCount = selectedFileIds.size
  const totalFiles = files.length
  const editorKey = useMemo(
    () => `${contentType}-${draftRevision}`,
    [contentType, draftRevision]
  )

  const editorTitle =
    contentType === "quiz"
      ? "Review AI Quiz Draft"
      : "Review AI Flashcard Draft"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/5"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate with AI
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[98vw] sm:max-w-[50vw]">
        <div className="max-h-[85vh] overflow-y-auto pr-1">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {step === "setup" ? "Generate content with AI" : editorTitle}
            </DialogTitle>
            <DialogDescription>
              {step === "setup"
                ? `${weekTitle} — AI drafts one content type at a time, then you edit before saving.`
                : "Review, reorder, edit, and save only when you're ready."}
            </DialogDescription>
          </DialogHeader>

          {step === "setup" ? (
            <div
              className="space-y-5 pt-4"
              onKeyDown={(event) => {
                if (event.key === " ") {
                  event.stopPropagation()
                }
              }}
            >
              <div className="space-y-2">
                <Label>What to generate</Label>
                <Select
                  value={contentType}
                  onValueChange={(value) => {
                    setContentType(value as "quiz" | "flashcards")
                    setFocusPrompt("")
                    setTitle("")
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="flashcards">Flashcards</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Generation method</Label>
                <Select
                  value={generationMode}
                  onValueChange={(value) =>
                    setGenerationMode(value as "source_materials" | "prompt")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="source_materials">
                      Based on source materials
                    </SelectItem>
                    <SelectItem value="prompt">
                      Based on custom prompt
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {contentType === "quiz" ? (
                <div className="space-y-2">
                  <Label htmlFor="ai-title">Title (optional)</Label>
                  <Input
                    id="ai-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Midterm Review Quiz"
                  />
                </div>
              ) : null}

              {generationMode === "source_materials" && (
                <div className="space-y-2">
                  <Label htmlFor="ai-focus">
                    Focus area / special instructions
                    <span className="ml-1 text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    id="ai-focus"
                    value={focusPrompt}
                    onChange={(event) => setFocusPrompt(event.target.value)}
                    placeholder="E.g. Focus on thermodynamics equations, ignore historical context..."
                    rows={3}
                  />
                </div>
              )}

              {generationMode === "prompt" && (
                <div className="space-y-2">
                  <Label htmlFor="ai-custom-prompt">
                    Custom prompt
                    <span className="ml-1 text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="ai-custom-prompt"
                    value={customPrompt}
                    onChange={(event) => setCustomPrompt(event.target.value)}
                    placeholder="Describe the content you want to generate. E.g. Create a quiz about photosynthesis with 5 multiple choice questions covering the light-dependent reactions, Calvin cycle, and factors affecting photosynthesis rate..."
                    rows={4}
                    required
                  />
                </div>
              )}

              {generationMode === "source_materials" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Source materials</Label>
                    {totalFiles > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedCount} of {totalFiles} selected
                      </Badge>
                    )}
                  </div>

                  {isFetchingFiles ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading materials...
                    </div>
                  ) : files.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      <FileText className="mx-auto mb-2 h-6 w-6 opacity-50" />
                      No materials found in this folder.
                      <br />
                      Upload files first before generating content.
                    </div>
                  ) : (
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                      {files.map((file) => (
                        <label
                          key={file.id}
                          className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
                        >
                          <Checkbox
                            checked={selectedFileIds.has(file.id)}
                            onCheckedChange={() => toggleFile(file.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {file.status === "READY"
                                ? "Ready for AI"
                                : file.status === "PROCESSING"
                                  ? "Processing..."
                                  : file.status}
                            </p>
                          </div>
                          {file.status === "READY" && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={isGenerating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="gap-1.5"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate draft
                    </>
                  )}
                </Button>
              </div>

              {isGenerating && streamedText && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>
                      {streamedItems.length > 0
                        ? `${streamedItems.length} ${contentType === "quiz" ? "question" : "card"}${streamedItems.length === 1 ? "" : "s"} generated…`
                        : "Generating…"}
                    </span>
                  </div>
                  <div className="max-h-56 space-y-1.5 overflow-y-auto">
                    {streamedItems.map((item, idx) =>
                      contentType === "quiz" ? (
                        <div
                          key={idx}
                          className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm"
                        >
                          <span className="mr-2 text-xs font-semibold text-muted-foreground">
                            Q{idx + 1}
                          </span>
                          <span className="text-foreground/80">
                            {String(
                              (item as { prompt?: unknown }).prompt ?? ""
                            )}
                          </span>
                          {(item as { difficulty?: string }).difficulty ? (
                            <span className="ml-2 text-xs text-muted-foreground opacity-70">
                              · {(item as { difficulty?: string }).difficulty}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div
                          key={idx}
                          className="grid grid-cols-2 gap-1.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm"
                        >
                          <p className="truncate text-foreground/80">
                            {String((item as { front?: unknown }).front ?? "")}
                          </p>
                          <p className="truncate text-muted-foreground">
                            {String((item as { back?: unknown }).back ?? "")}
                          </p>
                        </div>
                      )
                    )}
                    {streamedItems.length === 0 && (
                      <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Waiting for first item…
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="pt-4"
              onKeyDown={(event) => {
                if (event.key === " ") {
                  event.stopPropagation()
                }
              }}
            >
              {contentType === "quiz" ? (
                <QuizDraftEditor
                  key={editorKey}
                  weekTitle={weekTitle}
                  draft={quizDraft}
                  onBack={() => setStep("setup")}
                  onCancel={() => setOpen(false)}
                  onSave={handleSaveQuiz}
                  isSaving={isSaving}
                />
              ) : (
                <FlashcardDraftEditor
                  key={editorKey}
                  draft={flashcardDraft}
                  onBack={() => setStep("setup")}
                  onCancel={() => setOpen(false)}
                  onSave={handleSaveFlashcards}
                  isSaving={isSaving}
                />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
