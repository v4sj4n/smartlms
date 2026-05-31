"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  Play,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { submitQuizAttempt } from "@/lib/actions/quizzes"

type QuizOption = {
  id: string
  content: string
  isCorrect?: boolean
}

type QuizQuestion = {
  id: string
  content: string
  points: number
  type: "true_false" | "multiple_choice" | "short_answer"
  options: QuizOption[]
}

type QuizSessionProps = {
  courseId: string
  courseTitle: string
  quizId: string
  quizTitle: string
  weekTitle: string
  backHref: string
  questions?: QuizQuestion[]
  timeLimitMinutes?: number | null
  userId: string
  existingAttempt?: SavedQuizAttempt
}

type QuizResult = {
  score: number
  maxScore: number
  completedAt: string
}

type SavedQuizAttempt = QuizResult | null

export function QuizSession({
  courseId,
  courseTitle,
  quizId,
  quizTitle,
  weekTitle,
  backHref,
  questions,
  timeLimitMinutes,
  userId,
  existingAttempt,
}: QuizSessionProps) {
  const storageKey = `optimo.quiz.${userId}.${courseId}.${quizId}`
  const timeLimitSeconds = timeLimitMinutes ? timeLimitMinutes * 60 : null
  const safeQuestions = questions ?? []

  const [hydrated, setHydrated] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [clockNow, setClockNow] = useState<number>(() => Date.now())
  const [status, setStatus] = useState<"ready" | "submitting" | "finished">(
    existingAttempt ? "finished" : "ready"
  )
  const [result, setResult] = useState<QuizResult | null>(
    existingAttempt ?? null
  )

  useEffect(() => {
    const savedState = localStorage.getItem(storageKey)

    let restoredIndex = 0
    let restoredAnswers: Record<string, string> = {}
    let restoredStartedAt: number | null = null

    if (savedState) {
      try {
        const parsed = JSON.parse(savedState) as {
          currentIndex?: number
          answers?: Record<string, string>
          startedAt?: number
        }

        if (typeof parsed.currentIndex === "number") {
          restoredIndex = Math.min(
            Math.max(parsed.currentIndex, 0),
            Math.max(safeQuestions.length - 1, 0)
          )
        }

        if (parsed.answers && typeof parsed.answers === "object") {
          restoredAnswers = parsed.answers
        }

        if (typeof parsed.startedAt === "number") {
          restoredStartedAt = parsed.startedAt
        }
      } catch {
        localStorage.removeItem(storageKey)
      }
    }

    queueMicrotask(() => {
      setCurrentIndex(restoredIndex)
      setAnswers(restoredAnswers)
      setStartedAt(restoredStartedAt ?? Date.now())
      setHydrated(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated || status === "finished" || startedAt === null) {
      return
    }

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        currentIndex,
        answers,
        startedAt,
      })
    )
  }, [answers, currentIndex, hydrated, startedAt, status, storageKey])

  useEffect(() => {
    if (!hydrated || !timeLimitSeconds || status === "finished") {
      return
    }

    const updateClock = () => setClockNow(Date.now())
    updateClock()

    const interval = window.setInterval(updateClock, 1000)
    return () => window.clearInterval(interval)
  }, [hydrated, status, timeLimitSeconds])

  const currentQuestion = safeQuestions[currentIndex]
  const totalQuestions = safeQuestions.length
  const questionProgress =
    totalQuestions > 0 ? (currentIndex + 1) / totalQuestions : 0
  const elapsedSeconds = startedAt
    ? Math.floor((clockNow - startedAt) / 1000)
    : 0
  const remainingSeconds =
    timeLimitSeconds !== null
      ? Math.max(timeLimitSeconds - elapsedSeconds, 0)
      : null

  const formatTime = (seconds: number) => {
    const safeSeconds = Math.max(seconds, 0)
    const minutes = Math.floor(safeSeconds / 60)
    const remainder = safeSeconds % 60
    return `${minutes}:${String(remainder).padStart(2, "0")}`
  }

  const selectOption = (questionId: string, optionId: string) => {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: optionId,
    }))
  }

  const updateTextAnswer = (questionId: string, value: string) => {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: value,
    }))
  }

  const goPrevious = () => {
    if (currentIndex === 0) {
      return
    }

    setCurrentIndex((previous) => previous - 1)
  }

  async function handleSubmit() {
    if (status !== "ready") {
      return
    }

    setStatus("submitting")

    const response = await submitQuizAttempt({
      quizId,
      answers,
    })

    if (!response.success || !response.data) {
      setStatus("ready")
      toast.error(response.error || "Failed to submit quiz")
      return
    }

    const completedAt = new Date().toISOString()

    localStorage.removeItem(storageKey)

    setResult({
      score: response.data.score,
      maxScore: response.data.maxScore,
      completedAt,
    })
    setStatus("finished")
    toast.success(
      `Quiz completed: ${response.data.score}/${response.data.maxScore}`
    )
  }

  const goNext = () => {
    if (currentIndex >= totalQuestions - 1) {
      void handleSubmit()
      return
    }

    setCurrentIndex((previous) => previous + 1)
  }

  useEffect(() => {
    if (
      timeLimitSeconds !== null &&
      remainingSeconds === 0 &&
      status === "ready" &&
      hydrated
    ) {
      const timeoutId = window.setTimeout(() => {
        void handleSubmit()
      }, 0)

      return () => window.clearTimeout(timeoutId)
    }
    // handleSubmit is intentionally excluded — it's stable and including it
    // would require useCallback, which is unnecessary here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, remainingSeconds, status, timeLimitSeconds])

  if (safeQuestions.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-4 py-10">
        <Card className="w-full rounded-[2rem] border-border/50 bg-card/90 shadow-2xl shadow-black/5 backdrop-blur">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground/50" />
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                No questions yet
              </h1>
              <p className="max-w-sm text-sm text-muted-foreground">
                This quiz has not been populated with questions.
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link href={backHref}>Back to quiz list</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "finished" && result) {
    const percentage = Math.round((result.score / result.maxScore) * 100)

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_36%)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <Button
            asChild
            variant="ghost"
            className="w-fit rounded-full pr-4 pl-2"
          >
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to quiz list
            </Link>
          </Button>

          <Card className="rounded-[2rem] border-border/50 bg-card/90 shadow-2xl shadow-black/10 backdrop-blur">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <div className="space-y-2">
                <p className="text-sm font-medium tracking-[0.24em] text-muted-foreground uppercase">
                  Quiz completed
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-balance">
                  {quizTitle}
                </h1>
                <p className="text-sm text-muted-foreground">{courseTitle}</p>
                <p className="text-sm text-muted-foreground">{weekTitle}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/50 bg-muted/30 p-5">
                  <p className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                    Score
                  </p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums">
                    {result.score} / {result.maxScore}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-muted/30 p-5">
                  <p className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                    Completion
                  </p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums">
                    {percentage}%
                  </p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-muted/30 p-5">
                  <p className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                    Completed at
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {new Date(result.completedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild className="rounded-full">
                  <Link href={backHref}>
                    <Play className="mr-2 h-4 w-4" />
                    Review quiz list
                  </Link>
                </Button>
                {!existingAttempt && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      setCurrentIndex(0)
                      setAnswers({})
                      setResult(null)
                      setStatus("ready")
                      setStartedAt(Date.now())
                    }}
                  >
                    Restart quiz
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_36%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" className="rounded-full pr-4 pl-2">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to quizzes
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1.5 tabular-nums shadow-sm backdrop-blur">
              Question {currentIndex + 1} / {totalQuestions}
            </span>
            <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur">
              {weekTitle}
            </span>
            {timeLimitSeconds !== null && remainingSeconds !== null && (
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 tabular-nums shadow-sm backdrop-blur",
                  remainingSeconds <= 60 &&
                    "border-destructive/30 text-destructive"
                )}
              >
                <Clock3 className="h-4 w-4" />
                {formatTime(remainingSeconds)}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium tracking-[0.24em] text-muted-foreground uppercase">
            Quiz Session
          </p>
          <div className="space-y-1">
            <p
              className="max-w-full truncate text-sm font-medium text-muted-foreground"
              title={courseTitle}
            >
              {courseTitle}
            </p>
            <h1
              className="max-w-full truncate text-3xl font-semibold tracking-tight sm:text-4xl"
              title={quizTitle}
            >
              {quizTitle}
            </h1>
          </div>
          <p className="max-w-2xl text-sm text-pretty text-muted-foreground sm:text-base">
            Answer one question at a time. Your selections stay saved while you
            move through the quiz.
          </p>
        </div>

        <Card className="rounded-[2rem] border-border/50 bg-card/90 shadow-2xl shadow-black/10 backdrop-blur">
          <CardContent className="space-y-6 p-4 sm:p-6 lg:p-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>{courseTitle}</span>
                <span className="tabular-nums">
                  {Math.round(questionProgress * 100)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/70">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${questionProgress * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex flex-col items-stretch justify-between gap-3 border-b border-border/60 pb-5 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full sm:min-w-32"
                  onClick={goPrevious}
                  disabled={currentIndex === 0 || status === "submitting"}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>

                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="rounded-full border border-border/50 bg-muted/20 px-3 py-1.5 tabular-nums">
                    {Object.keys(answers).length} answered
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    Save is automatic while you move.
                  </span>
                </div>

                <Button
                  type="button"
                  className="rounded-full sm:min-w-32"
                  onClick={goNext}
                  disabled={status === "submitting"}
                >
                  {currentIndex >= totalQuestions - 1 ? (
                    status === "submitting" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting
                      </>
                    ) : (
                      <>
                        Finish quiz
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )
                  ) : (
                    <>
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                    Question {currentIndex + 1}
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight text-balance">
                    {currentQuestion.content}
                  </h2>
                </div>
                <span className="rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground tabular-nums">
                  {currentQuestion.points} pts
                </span>
              </div>

              {currentQuestion.options.length === 0 ||
              currentQuestion.type === "short_answer" ? (
                <div className="space-y-2">
                  <Textarea
                    value={answers[currentQuestion.id] ?? ""}
                    onChange={(event) =>
                      updateTextAnswer(currentQuestion.id, event.target.value)
                    }
                    placeholder="Type your answer here"
                    rows={6}
                    className="rounded-2xl"
                  />
                  <p className="text-sm text-muted-foreground">
                    This response will be submitted for instructor grading.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {currentQuestion.options.map((option, optionIndex) => {
                    const isSelected = answers[currentQuestion.id] === option.id

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          selectOption(currentQuestion.id, option.id)
                        }
                        className={cn(
                          "group flex min-h-14 items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-[transform,background-color,border-color,box-shadow,color] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none active:scale-[0.96]",
                          isSelected
                            ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                            : "border-border/50 bg-muted/20 text-foreground hover:border-primary/20 hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors",
                              isSelected
                                ? "border-primary/30 bg-primary text-primary-foreground"
                                : "border-border/60 bg-background text-muted-foreground"
                            )}
                          >
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          <span className="text-sm sm:text-base">
                            {option.content}
                          </span>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
