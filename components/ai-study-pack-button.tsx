"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"

import { generateStudyPackFromFile } from "@/lib/actions/quiz-generation"
import { Button } from "@/components/ui/button"

type Props = {
  fileId: string
  weekId: string
  fileName: string
}

export function AiStudyPackButton({ fileId, weekId, fileName }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        const result = await generateStudyPackFromFile({
          fileId,
          weekId,
          title: `${fileName} Study Pack`,
        })

        if (!result.success) {
          toast.error("Failed to generate study pack")
          return
        }

        toast.success(
          `Generated ${result.data.questions} questions and ${result.data.flashcards} flashcards`
        )
        router.refresh()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to generate study pack"
        )
      }
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleGenerate}
      disabled={isPending}
    >
      <Sparkles className="h-4 w-4" />
      {isPending ? "Generating..." : "Generate AI study pack"}
    </Button>
  )
}
