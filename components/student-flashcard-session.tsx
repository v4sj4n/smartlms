"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type FlashcardItem = {
  id: string
  frontContent: string
  backContent: string
}

type FlashcardStudySessionProps = {
  courseId: string
  courseTitle: string
  weekId: string
  weekTitle: string
  backHref: string
  flashcards: FlashcardItem[]
  userId: string
}

export function FlashcardStudySession({
  courseId,
  courseTitle,
  weekId,
  weekTitle,
  backHref,
  flashcards,
  userId,
}: FlashcardStudySessionProps) {
  const storageKey = `optimo.flashcards.${userId}.${courseId}.${weekId}`
  const [hydrated, setHydrated] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  useEffect(() => {
    const savedState = localStorage.getItem(storageKey)

    let restoredIndex = 0
    let restoredFlipped = false

    if (savedState) {
      try {
        const parsed = JSON.parse(savedState) as {
          currentIndex?: number
          isFlipped?: boolean
        }

        if (typeof parsed.currentIndex === "number") {
          restoredIndex = Math.min(
            Math.max(parsed.currentIndex, 0),
            Math.max(flashcards.length - 1, 0)
          )
        }

        if (typeof parsed.isFlipped === "boolean") {
          restoredFlipped = parsed.isFlipped
        }
      } catch {
        localStorage.removeItem(storageKey)
      }
    }

    setCurrentIndex(restoredIndex)
    setIsFlipped(restoredFlipped)
    setHydrated(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        currentIndex,
        isFlipped,
      })
    )
  }, [currentIndex, hydrated, isFlipped, storageKey])

  const currentFlashcard = flashcards[currentIndex]
  const currentNumber = flashcards.length > 0 ? currentIndex + 1 : 0

  const goPrevious = () => {
    if (currentIndex === 0) {
      return
    }

    setCurrentIndex((previous) => previous - 1)
    setIsFlipped(false)
  }

  const goNext = () => {
    if (currentIndex >= flashcards.length - 1) {
      return
    }

    setCurrentIndex((previous) => previous + 1)
    setIsFlipped(false)
  }

  const toggleFlip = () => {
    setIsFlipped((previous) => !previous)
  }

  if (flashcards.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 py-10">
        <Card className="w-full rounded-[2rem] border-border/50 bg-card/90 shadow-2xl shadow-black/5 backdrop-blur">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground/50" />
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                No flashcards yet
              </h1>
              <p className="max-w-sm text-sm text-muted-foreground">
                This week does not have any flashcards available yet.
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link href={backHref}>Back to week overview</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_34%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" className="rounded-full pr-4 pl-2">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to week
            </Link>
          </Button>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1.5 tabular-nums shadow-sm backdrop-blur">
              {currentNumber} / {flashcards.length}
            </span>
            <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur">
              {weekTitle}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium tracking-[0.24em] text-muted-foreground uppercase">
            Flashcard Study Session
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
              title={weekTitle}
            >
              {weekTitle}
            </h1>
          </div>
          <p className="max-w-2xl text-sm text-pretty text-muted-foreground sm:text-base">
            Study one card at a time. Flip when ready, then move forward without
            losing your place.
          </p>
        </div>

        <Card className="rounded-[2rem] border-border/50 bg-card/90 shadow-2xl shadow-black/10 backdrop-blur">
          <CardContent className="space-y-6 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              <button
                type="button"
                onClick={toggleFlip}
                aria-label={isFlipped ? "Show question" : "Reveal answer"}
                className="group relative h-[24rem] w-full rounded-[2rem] [perspective:2000px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background focus-visible:outline-none sm:h-[28rem]"
              >
                <div
                  className={cn(
                    "relative h-full w-full rounded-[2rem] transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)] [transform-style:preserve-3d]",
                    isFlipped && "[transform:rotateY(180deg)]"
                  )}
                  style={{ willChange: "transform" }}
                >
                  <div className="absolute inset-0 overflow-hidden rounded-[2rem] border border-border/60 bg-card/100 p-5 shadow-[0_28px_60px_rgba(15,23,42,0.12)] [backface-visibility:hidden] sm:p-8">
                    <div className="absolute top-0 left-0 h-2 w-full rounded-t-[2rem] bg-gradient-to-r from-primary to-primary/70" />
                    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-[1.5rem] border border-border/40 bg-primary/5 px-6 py-5 text-primary shadow-sm">
                          <Image
                            src="/optimo-logo.svg"
                            alt="Optimo logo"
                            width={160}
                            height={56}
                            priority={false}
                            className="h-12 w-auto transition-[filter] dark:invert"
                          />
                        </div>
                        <p className="text-sm font-semibold tracking-[0.3em] text-muted-foreground uppercase">
                          Optimo Study Deck
                        </p>
                      </div>
                      <div className="max-w-xl space-y-3">
                        <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
                          {currentFlashcard.frontContent}
                        </h2>
                        <p className="text-sm text-muted-foreground/80 sm:text-base">
                          Click the card or press Enter to reveal the answer.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="absolute inset-0 [transform:rotateY(180deg)] overflow-hidden rounded-[2rem] border border-border/50 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(30,41,59,0.94))] p-5 text-white shadow-[0_28px_60px_rgba(15,23,42,0.18)] [backface-visibility:hidden] sm:p-8">
                    <div className="flex h-full flex-col justify-between gap-6">
                      <div className="flex items-center justify-between gap-3 text-sm text-white/70">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 tracking-[0.2em] uppercase">
                          Answer
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 tabular-nums">
                          {currentNumber} / {flashcards.length}
                        </span>
                      </div>

                      <div className="flex flex-1 items-center justify-center text-center">
                        <div className="max-w-xl space-y-4">
                          <p className="text-sm font-medium tracking-[0.3em] text-white/55 uppercase">
                            {courseTitle}
                          </p>
                          <p className="text-2xl leading-tight font-semibold text-balance sm:text-3xl">
                            {currentFlashcard.backContent}
                          </p>
                        </div>
                      </div>

                      <p className="text-center text-sm text-white/60">
                        Flip back anytime, then continue to the next card.
                      </p>
                    </div>
                  </div>
                </div>
              </button>

              <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full sm:min-w-32"
                  onClick={goPrevious}
                  disabled={currentIndex === 0}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-full sm:min-w-32"
                  onClick={toggleFlip}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {isFlipped ? "Show question" : "Reveal answer"}
                </Button>

                <Button
                  type="button"
                  className="rounded-full sm:min-w-32"
                  onClick={goNext}
                  disabled={currentIndex >= flashcards.length - 1}
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
