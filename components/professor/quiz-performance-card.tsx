"use client"

import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { QuizPerformance } from "@/lib/actions/dashboard-intelligence"
import { HelpCircle, TrendingUp, TrendingDown, Minus, Users } from "lucide-react"

interface QuizPerformanceCardProps {
  performances: QuizPerformance[]
  maxItems?: number
}

function PerformanceTrend({
  average,
}: {
  average: number
}) {
  if (average >= 80) {
    return (
      <div className="flex items-center gap-1 text-emerald-600">
        <TrendingUp className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Good</span>
      </div>
    )
  }
  if (average >= 60) {
    return (
      <div className="flex items-center gap-1 text-amber-600">
        <Minus className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Average</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1 text-red-600">
      <TrendingDown className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">Needs Work</span>
    </div>
  )
}

export function QuizPerformanceCard({
  performances,
  maxItems = 3,
}: QuizPerformanceCardProps) {
  const visiblePerformances = performances.slice(0, maxItems)

  return (
    <Card className="surface-elevated">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <HelpCircle className="h-4 w-4" />
          Quiz Performance
        </CardTitle>
        <CardDescription className="mt-1">
          Recent quiz statistics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {visiblePerformances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <HelpCircle className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">
              No quiz data yet
            </p>
            <p className="text-xs text-muted-foreground">
              Quiz performance will appear here once students take quizzes.
            </p>
          </div>
        ) : (
          <>
            {visiblePerformances.map((performance) => (
              <Link
                key={performance.quizId}
                href={performance.href}
                className="group block rounded-lg border border-border/60 bg-background p-3 transition-colors hover:bg-muted/50 hover:border-border"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {performance.quizTitle}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {performance.courseTitle}
                    </p>
                  </div>
                  <PerformanceTrend average={performance.averageScore} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-md bg-muted/50 p-2 text-center">
                    <p className="text-lg font-semibold tabular-nums">
                      {performance.averageScore}%
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Avg
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2 text-center">
                    <p className="text-lg font-semibold tabular-nums text-emerald-600">
                      {performance.highestScore}%
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      High
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-lg font-semibold tabular-nums">
                        {performance.totalAttempts}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Attempts
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}
