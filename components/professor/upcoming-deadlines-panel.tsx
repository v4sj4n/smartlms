"use client"

import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { UpcomingDeadline } from "@/lib/actions/dashboard-intelligence"
import { Calendar, Clock, ArrowRight, CheckCircle2 } from "lucide-react"

interface UpcomingDeadlinesPanelProps {
  deadlines: UpcomingDeadline[]
  maxItems?: number
}

export function UpcomingDeadlinesPanel({
  deadlines,
  maxItems = 5,
}: UpcomingDeadlinesPanelProps) {
  const visibleDeadlines = deadlines.slice(0, maxItems)

  return (
    <Card className="surface-elevated">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Upcoming Deadlines
            </CardTitle>
            <CardDescription className="mt-1">
              Due in the next 7 days
            </CardDescription>
          </div>
          {deadlines.length > 0 && (
            <Badge variant="secondary" className="h-5 px-2 text-xs">
              {deadlines.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleDeadlines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No upcoming deadlines
            </p>
            <p className="text-xs text-muted-foreground">
              Everything is on schedule for the next 7 days.
            </p>
          </div>
        ) : (
          <>
            {visibleDeadlines.map((deadline) => (
              <Link
                key={deadline.id}
                href={deadline.href}
                className="group flex items-center gap-3 rounded-lg border border-border/60 bg-background p-3 transition-colors hover:border-border hover:bg-muted/50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {deadline.title}
                    </p>
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px] capitalize"
                    >
                      {deadline.type}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{deadline.courseTitle}</span>
                    <span className="text-border">•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(deadline.dueDate), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}
