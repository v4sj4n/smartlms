"use client"

import { type FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { createManualFlashcards } from "@/lib/actions/quizzes"
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

type FlashcardDraft = {
  id: string
  frontContent: string
  backContent: string
}

type Props = {
  courseId: string
  weeks: WeekOption[]
  defaultWeekId: string
}

function createNewCard(): FlashcardDraft {
  return {
    id: crypto.randomUUID(),
    frontContent: "",
    backContent: "",
  }
}

export function ManualFlashcardsForm({
  courseId,
  weeks,
  defaultWeekId,
}: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [weekId, setWeekId] = useState(defaultWeekId)
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "medium"
  )
  const [cards, setCards] = useState<FlashcardDraft[]>([createNewCard()])

  const updateCard = (cardId: string, patch: Partial<FlashcardDraft>) => {
    setCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, ...patch } : card))
    )
  }

  const addCard = () => {
    setCards((prev) => [...prev, createNewCard()])
  }

  const removeCard = (cardId: string) => {
    setCards((prev) => {
      if (prev.length === 1) return prev
      return prev.filter((card) => card.id !== cardId)
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!weekId) {
      toast.error("Please select a folder")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createManualFlashcards({
        weekId,
        difficulty,
        cards: cards.map((card) => ({
          frontContent: card.frontContent,
          backContent: card.backContent,
        })),
      })

      if (!result.success) {
        toast.error(result.error || "Failed to create flashcards")
        return
      }

      toast.success(`${result.data?.createdCount ?? 0} flashcards created`)
      router.push(`/professor/courses/${courseId}/folders/${weekId}`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create flashcards"
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
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
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

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Flashcards"}
        </Button>
      </div>
    </form>
  )
}
