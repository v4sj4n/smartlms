import Link from "next/link"
import { BookOpen, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { LectureReviewSuggestion } from "@/lib/quiz/review-suggestions"

type QuizReviewSuggestionsProps = {
  suggestions: LectureReviewSuggestion[]
  perfectScore?: boolean
}

export function QuizReviewSuggestions({
  suggestions,
  perfectScore,
}: QuizReviewSuggestionsProps) {
  if (perfectScore) {
    return (
      <Card className="rounded-2xl border-emerald-500/30 bg-emerald-500/5">
        <CardHeader>
          <CardTitle className="text-base">Great work!</CardTitle>
          <CardDescription>
            No urgent review needed — you answered everything correctly.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (suggestions.length === 0) {
    return null
  }

  return (
    <Card className="rounded-2xl border-border/50">
      <CardHeader>
        <CardTitle className="text-base">
          Based on your quiz answers, review these lectures
        </CardTitle>
        <CardDescription>
          Focus on these materials to strengthen weak areas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion) => (
          <Link
            key={suggestion.materialId}
            href={suggestion.href}
            className="group flex items-center gap-3 rounded-xl border border-border/60 p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{suggestion.title}</p>
                <Badge variant="outline" className="text-[10px]">
                  {suggestion.type}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {suggestion.reason}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
